/**
 * Report assembly + file export for /admin/reports.
 *
 * Everything that turns Firestore documents into rows lives here (pure, unit
 * tested); the page only fetches documents and hands them over. Money stays in
 * integer kobo and is rendered with formatNaira at the row boundary so the
 * exported file shows Naira while a machine reading `amount_kobo` stays exact.
 */

import { calculateCompetitionRevenue } from "@/lib/revenue-split";
import { lagosDateTime } from "@/lib/format";
import { num, str, toMs } from "@/lib/doc-values";
import { formatNaira } from "@/lib/utils";

// Re-exported so report consumers only need one import for both coercion and
// report building.
export { num, str, toMs } from "@/lib/doc-values";

export type ReportKey = "users" | "revenue" | "competitions" | "payouts" | "referrals" | "audit";

export type ExportFormat = "csv" | "xlsx" | "json";

export interface RawDoc {
  id: string;
  data: Record<string, unknown>;
}

export interface ReportSource {
  users: RawDoc[];
  competitions: RawDoc[];
  payouts: RawDoc[];
  commissions: RawDoc[];
  logs: RawDoc[];
  /** `platformSettings/raffila_config.rewardPool.contributionPct` */
  rewardPoolPct: number;
}

export interface DateRange {
  from?: string;
  to?: string;
}

export type ReportCell = string | number;

export interface ReportTable {
  key: ReportKey;
  label: string;
  columns: string[];
  rows: Array<Record<string, ReportCell>>;
}

export const REPORT_LABELS: Record<ReportKey, string> = {
  users: "Users report",
  revenue: "Revenue report",
  competitions: "Competitions summary",
  payouts: "Payouts",
  referrals: "Referral tree",
  audit: "Full audit",
};

export function emptyReportSource(): ReportSource {
  return {
    users: [],
    competitions: [],
    payouts: [],
    commissions: [],
    logs: [],
    rewardPoolPct: 0,
  };
}

// ---------------------------------------------------------------------------
// value coercion (see @/lib/doc-values for the readers themselves)
// ---------------------------------------------------------------------------

/** Stable, human-readable timestamp (Lagos time). */
export function stamp(ms: number): string {
  if (!ms) return "—";
  return lagosDateTime(ms);
}

export function naira(kobo: number): string {
  return formatNaira(kobo);
}

// ---------------------------------------------------------------------------
// date range
// ---------------------------------------------------------------------------

export function inRange(ms: number, range?: DateRange): boolean {
  const from = range?.from?.trim();
  const to = range?.to?.trim();
  if (!from && !to) return true;
  // Docs with no usable timestamp are kept — an export must never silently
  // drop rows it cannot date.
  if (!ms) return true;
  if (from) {
    const start = Date.parse(`${from}T00:00:00`);
    if (Number.isFinite(start) && ms < start) return false;
  }
  if (to) {
    const end = Date.parse(`${to}T23:59:59.999`);
    if (Number.isFinite(end) && ms > end) return false;
  }
  return true;
}

function pickTime(data: Record<string, unknown>, keys: string[]): number {
  for (const key of keys) {
    const ms = toMs(data[key]);
    if (ms) return ms;
  }
  return 0;
}

/** Filter → map → newest-first. `make` returns the row plus the timestamp to order it by. */
function buildRows<TRow extends Record<string, ReportCell>>(
  docs: RawDoc[],
  range: DateRange | undefined,
  timeKeys: string[],
  make: (doc: RawDoc, ms: number) => { row: TRow; ms: number },
): TRow[] {
  const kept: Array<{ ms: number; row: TRow }> = [];
  for (const doc of docs) {
    const ms = pickTime(doc.data, timeKeys);
    if (!inRange(ms, range)) continue;
    const made = make(doc, ms);
    kept.push({ ms: made.ms, row: made.row });
  }
  kept.sort((a, b) => b.ms - a.ms);
  return kept.map((entry) => entry.row);
}

function table(
  key: ReportKey,
  columns: string[],
  rows: Array<Record<string, ReportCell>>,
): ReportTable {
  return { key, label: REPORT_LABELS[key], columns, rows };
}

// ---------------------------------------------------------------------------
// row builders
// ---------------------------------------------------------------------------

const USER_COLUMNS = [
  "user_id",
  "name",
  "email",
  "username",
  "role",
  "status",
  "email_verified",
  "referral_code",
  "referred_by",
  "created_at",
  "last_seen",
];

function usersTable(source: ReportSource, range?: DateRange): ReportTable {
  const rows = buildRows(source.users, range, ["createdAt", "joinedAt", "lastLoginAt"], (d, ms) => {
    const v = d.data;
    return {
      ms: pickTime(v, ["createdAt", "joinedAt"]) || ms,
      row: {
        user_id: d.id,
        name: str(v["displayName"]) || str(v["name"]) || "—",
        email: str(v["email"]),
        username: str(v["username"]) || "—",
        role: str(v["role"]) || "user",
        status: str(v["status"]) || "active",
        email_verified: str(v["emailVerified"]) || "false",
        referral_code: str(v["referralCode"]),
        referred_by: str(v["referredBy"]),
        created_at: stamp(ms),
        last_seen: stamp(pickTime(v, ["lastLoginAt", "updatedAt"])),
      },
    };
  });

  return table("users", USER_COLUMNS, rows);
}

const COMPETITION_COLUMNS = [
  "slug",
  "title",
  "category",
  "status",
  "partner",
  "entry_price",
  "total_entries",
  "entries_sold",
  "revenue",
  "winner",
  "closes",
  "created_at",
];

function competitionsTable(source: ReportSource, range?: DateRange): ReportTable {
  const rows = buildRows(source.competitions, range, ["createdAt", "closesAt", "drawDate"], (d) => {
    const v = d.data;
    const sold = num(v["entriesSold"]);
    const price = num(v["ticketPrice"]);
    return {
      ms: pickTime(v, ["createdAt"]),
      row: {
        slug: str(v["slug"]) || d.id,
        title: str(v["title"]),
        category: str(v["category"]),
        status: str(v["status"]),
        partner: str(v["partner"]),
        entry_price: naira(price),
        total_entries: num(v["totalEntries"]),
        entries_sold: sold,
        revenue: naira(sold * price),
        winner: str(v["winnerDisplayName"]) || "—",
        closes: str(v["closes"]) || str(v["drawDate"]) || "—",
        created_at: stamp(pickTime(v, ["createdAt"])),
      },
    };
  });

  return table("competitions", COMPETITION_COLUMNS, rows);
}

const REVENUE_COLUMNS = [
  "slug",
  "title",
  "entries_sold",
  "entry_price",
  "gross_revenue",
  "partner_pct",
  "partner_share",
  "rafilla_share",
  "reward_pool_pct",
  "reward_pool_contribution",
];

function revenueTable(source: ReportSource, range?: DateRange): ReportTable {
  const rows = buildRows(source.competitions, range, ["createdAt", "closesAt", "drawDate"], (d) => {
    const v = d.data;
    const calc = calculateCompetitionRevenue(
      num(v["entriesSold"]),
      num(v["ticketPrice"]),
      num(v["partnerPercentage"]),
    );
    const poolPct = Math.min(100, Math.max(0, source.rewardPoolPct));
    const poolKobo = Math.round((calc.grossRevenueKobo * poolPct) / 100);
    return {
      ms: calc.grossRevenueKobo,
      row: {
        slug: str(v["slug"]) || d.id,
        title: str(v["title"]),
        entries_sold: calc.validTicketsSold,
        entry_price: naira(calc.entryPriceKobo),
        gross_revenue: naira(calc.grossRevenueKobo),
        partner_pct: calc.partnerPercentage,
        partner_share: naira(calc.partnerAmountKobo),
        rafilla_share: naira(calc.rafillaAmountKobo),
        reward_pool_pct: source.rewardPoolPct,
        reward_pool_contribution: naira(poolKobo),
      },
    };
  });

  return table("revenue", REVENUE_COLUMNS, rows);
}

const PAYOUT_COLUMNS = [
  "payout_id",
  "created_at",
  "type",
  "recipient",
  "recipient_email",
  "user_id",
  "reason",
  "amount",
  "amount_kobo",
  "status",
  "bank",
  "destination",
  "account_name",
  "paid_at",
  "processed_by",
];

function payoutsTable(source: ReportSource, range?: DateRange): ReportTable {
  const rows = buildRows(source.payouts, range, ["createdAt", "paidAt", "processedAt"], (d) => {
    const v = d.data;
    const amountKobo = num(v["amountKobo"]);
    const account = str(v["accountNumber"]);
    const paidAt = v["paidAt"] ? stamp(toMs(v["paidAt"])) : "—";
    return {
      ms: pickTime(v, ["createdAt"]),
      row: {
        payout_id: d.id,
        created_at: stamp(pickTime(v, ["createdAt"])),
        type: str(v["type"]) || "REFERRAL",
        recipient: str(v["userName"]) || str(v["userEmail"]) || "—",
        recipient_email: str(v["userEmail"]),
        user_id: str(v["userId"]),
        reason: str(v["reason"]) || "—",
        amount: naira(amountKobo),
        amount_kobo: amountKobo,
        status: str(v["status"]) || "PENDING",
        bank: str(v["bank"]) || "—",
        destination: account ? `${str(v["bank"]) || "—"} ••••${account.slice(-4)}` : "—",
        account_name: str(v["accountName"]) || "—",
        paid_at: paidAt,
        processed_by: str(v["processedBy"]) || "—",
      },
    };
  });

  return table("payouts", PAYOUT_COLUMNS, rows);
}

const REFERRAL_COLUMNS = [
  "commission_id",
  "beneficiary",
  "beneficiary_id",
  "level",
  "rate_pct",
  "buyer",
  "buyer_uid",
  "reference",
  "competition",
  "amount",
  "amount_kobo",
  "status",
  "created_at",
];

function referralsTable(source: ReportSource, range?: DateRange): ReportTable {
  const rows = buildRows(source.commissions, range, ["createdAt"], (d) => {
    const v = d.data;
    const amountKobo = num(v["amountKobo"]);
    return {
      ms: pickTime(v, ["createdAt"]),
      row: {
        commission_id: d.id,
        beneficiary: str(v["beneficiaryName"]) || str(v["beneficiary"]) || "—",
        beneficiary_id: str(v["beneficiaryId"]),
        level: num(v["level"]) || 1,
        rate_pct: num(v["ratePct"]),
        buyer: str(v["buyerName"]),
        buyer_uid: str(v["buyerUid"]),
        reference: str(v["reference"]),
        competition: str(v["competition"]),
        amount: naira(amountKobo),
        amount_kobo: amountKobo,
        status: str(v["status"]) || "AVAILABLE",
        created_at: stamp(pickTime(v, ["createdAt"])),
      },
    };
  });

  return table("referrals", REFERRAL_COLUMNS, rows);
}

const AUDIT_COLUMNS = [
  "id",
  "timestamp",
  "actor",
  "actor_email",
  "actor_id",
  "role",
  "event",
  "target",
  "target_id",
  "risk",
  "summary",
];

function auditTable(source: ReportSource, range?: DateRange): ReportTable {
  const rows = buildRows(source.logs, range, ["createdAt", "timestamp"], (d, ms) => {
    const v = d.data;
    return {
      ms,
      row: {
        id: d.id,
        timestamp: stamp(ms),
        actor: str(v["actorName"]) || str(v["actor"]) || "System",
        actor_email: str(v["actorEmail"]),
        actor_id: str(v["actorId"]),
        role: str(v["actorRole"] ?? v["role"]) || "—",
        event: str(v["eventType"]),
        target: str(v["targetType"]),
        target_id: str(v["targetId"]),
        risk: str(v["riskLevel"]) || "low",
        summary: str(v["summary"]),
      },
    };
  });

  return table("audit", AUDIT_COLUMNS, rows);
}

export function buildReportTable(
  key: ReportKey,
  source: ReportSource,
  range?: DateRange,
): ReportTable {
  switch (key) {
    case "users":
      return usersTable(source, range);
    case "revenue":
      return revenueTable(source, range);
    case "competitions":
      return competitionsTable(source, range);
    case "payouts":
      return payoutsTable(source, range);
    case "referrals":
      return referralsTable(source, range);
    case "audit":
      return auditTable(source, range);
  }
}

// ---------------------------------------------------------------------------
// serialization
// ---------------------------------------------------------------------------

export function csvCell(value: unknown): string {
  const raw = value == null ? "" : String(value);
  return /[",\n\r]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
}

export function toCsv(report: ReportTable): string {
  const lines = [report.columns.map(csvCell).join(",")];
  for (const row of report.rows) {
    lines.push(report.columns.map((c) => csvCell(row[c])).join(","));
  }
  return lines.join("\r\n");
}

export function toJson(report: ReportTable, now = new Date()): string {
  return JSON.stringify(
    {
      report: report.key,
      label: report.label,
      generatedAt: now.toISOString(),
      rowCount: report.rows.length,
      rows: report.rows,
    },
    null,
    2,
  );
}

export function reportFilename(key: ReportKey, fmt: ExportFormat, now = new Date()): string {
  const day = now.toISOString().slice(0, 10);
  return `raffila-${key}-${day}.${fmt}`;
}

// ---------------------------------------------------------------------------
// download
// ---------------------------------------------------------------------------

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Renders the report in the requested format and saves it to the browser. */
export async function exportReportTable(
  report: ReportTable,
  fmt: ExportFormat,
  now = new Date(),
): Promise<{ filename: string; bytes: number }> {
  const filename = reportFilename(report.key, fmt, now);

  if (fmt === "csv") {
    // UTF-8 BOM so Excel opens ₦ and accented names correctly.
    const blob = new Blob(["\uFEFF", toCsv(report)], { type: "text/csv;charset=utf-8" });
    downloadBlob(filename, blob);
    return { filename, bytes: blob.size };
  }

  if (fmt === "json") {
    const blob = new Blob([toJson(report, now)], { type: "application/json" });
    downloadBlob(filename, blob);
    return { filename, bytes: blob.size };
  }

  // write-excel-file is a browser-native XLSX writer (the npm `xlsx` package is
  // unmaintained and carries unfixed prototype-pollution advisories). Load it
  // lazily so it never lands in the initial bundle.
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const sheetData = [
    report.columns.map((column) => ({ value: column, fontWeight: true })),
    ...report.rows.map((row) => report.columns.map((column) => ({ value: row[column] ?? "" }))),
  ];
  const file = writeXlsxFile(sheetData, { sheet: report.label.slice(0, 31) });
  const blob = await file.toBlob();
  downloadBlob(filename, blob);
  return { filename, bytes: blob.size };
}

import { describe, expect, it } from "vitest";
import {
  buildReportTable,
  csvCell,
  emptyReportSource,
  inRange,
  naira,
  num,
  reportFilename,
  str,
  toCsv,
  toJson,
  toMs,
  type RawDoc,
  type ReportSource,
} from "@/lib/report-export";
import { formatNaira } from "@/lib/utils";

const MARCH_2026 = Date.parse("2026-03-10T12:00:00Z");
const JAN_2026 = Date.parse("2026-01-05T12:00:00Z");

function source(overrides: Partial<ReportSource> = {}): ReportSource {
  return { ...emptyReportSource(), ...overrides };
}

const users: RawDoc[] = [
  {
    id: "u_1",
    data: {
      displayName: "Ada Obi",
      email: "ada@example.com",
      username: "ada",
      role: "admin",
      emailVerified: true,
      referralCode: "ADA42",
      createdAt: MARCH_2026,
    },
  },
  {
    id: "u_2",
    data: {
      displayName: 'Tola, "Q"',
      email: "tola@example.com",
      createdAt: JAN_2026,
    },
  },
];

const competitions: RawDoc[] = [
  {
    id: "mercedes-benz-c-class",
    data: {
      slug: "mercedes-benz-c-class",
      title: "Mercedes C-Class",
      category: "Auto",
      status: "COMPLETED",
      partner: "Lumen Motors",
      ticketPrice: 50_000,
      entriesSold: 40,
      totalEntries: 100,
      partnerPercentage: 80,
      createdAt: MARCH_2026,
    },
  },
  {
    id: "nova-x1",
    data: {
      slug: "nova-x1",
      title: "Nova X1",
      ticketPrice: 25_000,
      entriesSold: 0,
      partnerPercentage: 50,
      createdAt: JAN_2026,
    },
  },
];

const payouts: RawDoc[] = [
  {
    id: "po_1",
    data: {
      type: "REFERRAL",
      userName: "Ada Obi",
      userEmail: "ada@example.com",
      userId: "u_1",
      amountKobo: 150_000,
      status: "PAID",
      bank: "GTBank",
      accountNumber: "0123456789",
      accountName: "Ada Obi",
      reason: "Level 1 commission",
      createdAt: MARCH_2026,
    },
  },
];

const commissions: RawDoc[] = [
  {
    id: "REF-1-L1",
    data: {
      beneficiaryId: "u_9",
      beneficiaryName: "Seyi",
      level: 1,
      ratePct: 10,
      buyerName: "Ada",
      buyerUid: "u_1",
      reference: "RF-1",
      competition: "Mercedes C-Class",
      amountKobo: 50_000,
      status: "AVAILABLE",
      createdAt: MARCH_2026,
    },
  },
];

const logs: RawDoc[] = [
  {
    id: "log_1",
    data: {
      actorName: "Admin",
      actorEmail: "admin@example.com",
      actorId: "u_a",
      actorRole: "admin",
      eventType: "PAYOUT_COMPLETE",
      targetType: "payout",
      targetId: "po_1",
      riskLevel: "high",
      summary: "Paid out",
      createdAt: MARCH_2026,
    },
  },
];

function fullSource(overrides: Partial<ReportSource> = {}): ReportSource {
  return {
    users,
    competitions,
    payouts,
    commissions,
    logs,
    rewardPoolPct: 5,
    ...overrides,
  };
}

describe("report export — value coercion", () => {
  it("coerces Firestore Timestamp-like objects, dates and primitives", () => {
    const at = new Date(MARCH_2026);
    expect(toMs({ toDate: () => at })).toBe(MARCH_2026);
    expect(toMs(MARCH_2026)).toBe(MARCH_2026);
    expect(toMs("2026-03-10T12:00:00Z")).toBe(MARCH_2026);
    expect(toMs(null)).toBe(0);
    expect(toMs(undefined)).toBe(0);

    expect(str({ toDate: () => at })).toBe(at.toISOString());
    expect(str(true)).toBe("");
    expect(str(7)).toBe("7");
    expect(str(null)).toBe("");

    expect(num("12,500")).toBe(12500);
    expect(num("₦1,000")).toBe(1000);
    expect(num(NaN)).toBe(0);
    expect(num(true)).toBe(0);
  });

  it("formats kobo as Naira", () => {
    expect(naira(500_000)).toBe(formatNaira(500_000));
  });
});

describe("report export — date range", () => {
  it("includes everything when the range is empty", () => {
    expect(inRange(MARCH_2026)).toBe(true);
    expect(inRange(0, {})).toBe(true);
  });

  it("keeps rows inside the inclusive day bounds", () => {
    const range = { from: "2026-03-01", to: "2026-03-31" };
    expect(inRange(MARCH_2026, range)).toBe(true);
    expect(inRange(JAN_2026, range)).toBe(false);
    expect(inRange(Date.parse("2026-03-01T00:00:00"), range)).toBe(true);
    expect(inRange(Date.parse("2026-03-31T23:59:59"), range)).toBe(true);
    expect(inRange(Date.parse("2026-04-01T00:00:01"), range)).toBe(false);
  });

  it("never drops rows it cannot date", () => {
    expect(inRange(0, { from: "2026-03-01", to: "2026-03-31" })).toBe(true);
  });
});

describe("report export — CSV", () => {
  it("escapes commas, quotes and newlines", () => {
    expect(csvCell("plain")).toBe("plain");
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("line\nbreak")).toBe('"line\nbreak"');
    expect(csvCell(null)).toBe("");
    expect(csvCell(42)).toBe("42");
  });

  it("emits a header row plus one CRLF-terminated row per document", () => {
    const report = buildReportTable("users", fullSource());
    const csv = toCsv(report);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe(report.columns.join(","));
    expect(lines).toHaveLength(report.rows.length + 1);
    expect(csv).toContain('"Tola, ""Q"""');
    expect(csv).toContain("ada@example.com");
  });

  it("always writes every declared column, even when a field is missing", () => {
    const report = buildReportTable("competitions", fullSource());
    for (const row of report.rows) {
      expect(Object.keys(row).sort()).toEqual([...report.columns].sort());
    }
    expect(toCsv(report).split("\r\n")[0]).toBe(report.columns.join(","));
  });
});

describe("report export — JSON", () => {
  it("wraps rows with report metadata", () => {
    const report = buildReportTable("payouts", fullSource());
    const parsed = JSON.parse(toJson(report, new Date(MARCH_2026))) as {
      report: string;
      generatedAt: string;
      rowCount: number;
      rows: Array<Record<string, unknown>>;
    };
    expect(parsed.report).toBe("payouts");
    expect(parsed.generatedAt).toBe(new Date(MARCH_2026).toISOString());
    expect(parsed.rowCount).toBe(report.rows.length);
    expect(parsed.rows).toHaveLength(report.rows.length);
  });
});

describe("report export — row builders", () => {
  it("builds a users report ordered newest-first", () => {
    const report = buildReportTable("users", fullSource());
    expect(report.label).toBe("Users report");
    expect(report.rows.map((r) => r["user_id"])).toEqual(["u_1", "u_2"]);
    expect(report.rows[0]!["role"]).toBe("admin");
    expect(report.rows[0]!["referral_code"]).toBe("ADA42");
  });

  it("splits revenue into partner, platform and reward pool shares", () => {
    const report = buildReportTable("revenue", fullSource());
    const mercedes = report.rows.find((r) => r["slug"] === "mercedes-benz-c-class")!;
    // 40 × ₦500 = ₦20,000 gross (2,000,000 kobo)
    expect(mercedes["gross_revenue"]).toBe(naira(2_000_000));
    expect(mercedes["partner_pct"]).toBe(80);
    expect(mercedes["partner_share"]).toBe(naira(1_600_000));
    expect(mercedes["rafilla_share"]).toBe(naira(400_000));
    expect(mercedes["reward_pool_pct"]).toBe(5);
    expect(mercedes["reward_pool_contribution"]).toBe(naira(100_000));
  });

  it("exports payout money as both formatted Naira and exact kobo", () => {
    const report = buildReportTable("payouts", fullSource());
    const row = report.rows[0]!;
    expect(row["amount"]).toBe(formatNaira(150_000));
    expect(row["amount_kobo"]).toBe(150_000);
    expect(row["status"]).toBe("PAID");
    expect(row["reason"]).toBe("Level 1 commission");
    expect(row["destination"]).toContain("••••6789");
    expect(report.columns).toContain("paid_at");
    expect(report.columns).toContain("processed_by");
  });

  it("exports referral commissions with level, rate and beneficiary", () => {
    const report = buildReportTable("referrals", fullSource());
    const row = report.rows[0]!;
    expect(row["level"]).toBe(1);
    expect(row["rate_pct"]).toBe(10);
    expect(row["beneficiary"]).toBe("Seyi");
    expect(row["beneficiary_id"]).toBe("u_9");
    expect(row["amount_kobo"]).toBe(50_000);
  });

  it("exports the audit log with event and risk columns", () => {
    const report = buildReportTable("audit", fullSource());
    const row = report.rows[0]!;
    expect(row["event"]).toBe("PAYOUT_COMPLETE");
    expect(row["target"]).toBe("payout");
    expect(row["risk"]).toBe("high");
    expect(report.columns).toContain("summary");
  });

  it("applies the date range across every report type", () => {
    const keys = ["users", "revenue", "competitions", "payouts", "referrals", "audit"] as const;
    for (const key of keys) {
      const all = buildReportTable(key, fullSource());
      const march = buildReportTable(key, fullSource(), {
        from: "2026-03-01",
        to: "2026-03-31",
      });
      expect(march.rows.length, key).toBeLessThanOrEqual(all.rows.length);
      expect(march.columns, key).toEqual(all.columns);
    }
    // January-only window must empty out the March-dated audit log.
    expect(
      buildReportTable("audit", fullSource(), { from: "2026-02-01", to: "2026-02-28" }).rows,
    ).toHaveLength(0);
  });

  it("returns an empty, well-formed table when there is no data", () => {
    const report = buildReportTable("payouts", emptyReportSource());
    expect(report.rows).toEqual([]);
    expect(report.columns.length).toBeGreaterThan(0);
    expect(toCsv(report).split("\r\n")).toHaveLength(1);
  });
});

describe("report export — filenames", () => {
  it("stamps the file with the report key and day", () => {
    const now = new Date(Date.parse("2026-03-12T09:00:00Z"));
    expect(reportFilename("users", "csv", now)).toBe("raffila-users-2026-03-12.csv");
    expect(reportFilename("audit", "json", now)).toBe("raffila-audit-2026-03-12.json");
    expect(reportFilename("revenue", "xlsx", now)).toBe("raffila-revenue-2026-03-12.xlsx");
  });
});

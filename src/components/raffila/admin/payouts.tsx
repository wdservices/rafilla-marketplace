import { useEffect, useState } from "react";
import {
  Search,
  Download,
  MoreHorizontal,
  Banknote,
  Eye,
  Clock3,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  UserRound,
  Building2,
  UsersRound,
  Receipt,
  Check,
  Undo2,
  PlayCircle,
  FileText,
  Filter,
  CalendarDays,
  Trophy,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminShell } from "@/components/raffila/admin/admin-shell";
import { useAuthSession } from "@/hooks/useAuthSession";
import { db } from "@/lib/firebase";
import { toMs } from "@/lib/doc-values";
import { adminSetPayoutStatus } from "@/lib/referral-server";
import { defaultPayoutReason, payoutReceiptLine, readPayoutAudit } from "@/lib/payout-tracking";
import { lagosDateShort, lagosDateTimeWithYear } from "@/lib/format";
import { cn, formatNaira } from "@/lib/utils";
import { collection, getDocs, limit, query } from "firebase/firestore";

type PayoutStatus =
  "PENDING" | "UNDER_REVIEW" | "PROCESSING" | "PAID" | "FAILED" | "REVERSED" | "REJECTED";
type PayoutType = "WINNER" | "PARTNER" | "REFERRAL";

const PAYOUT_STATUSES = new Set<string>([
  "PENDING",
  "UNDER_REVIEW",
  "PROCESSING",
  "PAID",
  "FAILED",
  "REVERSED",
  "REJECTED",
]);

const TINTS = ["sky", "mint", "coral", "lemon", "lilac"] as const;
type Tint = (typeof TINTS)[number];

interface PayoutRow {
  id: string;
  createdAtMs: number;
  date: string;
  recipient: string;
  recipientType: "USER" | "PARTNER";
  initials: string;
  tint: Tint;
  type: PayoutType;
  amountKobo: number;
  sourceBank: string;
  destination: string;
  status: PayoutStatus;
  userId: string;
  /** What the money is for. */
  reason: string;
  /** When it was actually paid, or null while outstanding. */
  paidAtMs: number | null;
  paidAt: string;
  processedBy: string;
  paymentReference: string;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "–";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}

function tintOf(id: string): Tint {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return TINTS[h % TINTS.length]!;
}

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function toPayoutRow(id: string, v: Record<string, unknown>): PayoutRow {
  const createdAtMs = toMs(v["createdAt"]);
  const rawType = typeof v["type"] === "string" ? (v["type"] as string).toUpperCase() : "";
  const type: PayoutType =
    rawType === "WINNER" ? "WINNER" : rawType === "PARTNER" ? "PARTNER" : "REFERRAL";
  const rawStatus =
    typeof v["status"] === "string" ? (v["status"] as string).toUpperCase() : "PENDING";
  const status = (PAYOUT_STATUSES.has(rawStatus) ? rawStatus : "PENDING") as PayoutStatus;
  const userName = typeof v["userName"] === "string" ? (v["userName"] as string) : "";
  const userEmail = typeof v["userEmail"] === "string" ? (v["userEmail"] as string) : "";
  const recipient = userName || userEmail || "Unknown recipient";
  const bankValue = v["bank"];
  const bank = typeof bankValue === "string" && bankValue ? bankValue : "—";
  const accountNumber =
    typeof v["accountNumber"] === "string" ? (v["accountNumber"] as string) : "";
  const accountName = typeof v["accountName"] === "string" ? (v["accountName"] as string) : "";
  const destination =
    [accountNumber ? `••••${accountNumber.slice(-4)}` : "", accountName]
      .filter(Boolean)
      .join(" · ") || "—";
  const audit = readPayoutAudit(v);
  return {
    id,
    createdAtMs,
    date: createdAtMs ? lagosDateShort(createdAtMs) : "—",
    recipient,
    recipientType: type === "PARTNER" ? "PARTNER" : "USER",
    initials: initialsOf(recipient),
    tint: tintOf(id),
    type,
    amountKobo: typeof v["amountKobo"] === "number" ? (v["amountKobo"] as number) : 0,
    sourceBank: bank,
    destination,
    status,
    userId: typeof v["userId"] === "string" ? (v["userId"] as string) : "",
    reason: audit.reason || defaultPayoutReason(type),
    paidAtMs: audit.paidAt,
    paidAt: audit.paidAt ? lagosDateTimeWithYear(audit.paidAt) : "—",
    processedBy: audit.paidByName || audit.paidBy,
    paymentReference: audit.paymentReference,
  };
}

const tintBg: Record<Tint, string> = {
  sky: "bg-sky/30 text-ink",
  mint: "bg-mint/35 text-ink",
  coral: "bg-coral/20 text-coral",
  lemon: "bg-lemon/40 text-ink",
  lilac: "bg-lilac/35 text-ink",
};

const statusPill: Record<PayoutStatus, string> = {
  PENDING: "bg-lemon/40 text-ink",
  UNDER_REVIEW: "bg-lilac/35 text-ink",
  PROCESSING: "bg-sky/25 text-ink",
  PAID: "bg-mint/35 text-ink",
  FAILED: "bg-coral/20 text-coral",
  REVERSED: "bg-ink/15 text-ink",
  REJECTED: "bg-coral/25 text-coral",
};

const typeIcon: Record<PayoutType, { icon: typeof Trophy; label: string; tone: string }> = {
  WINNER: { icon: Trophy as any, label: "Winner payout", tone: "bg-coral/20 text-coral" },
  PARTNER: { icon: Building2, label: "Partner settlement", tone: "bg-lilac/35 text-ink" },
  REFERRAL: { icon: UsersRound, label: "Referral cash-out", tone: "bg-sky/25 text-ink" },
};

export function AdminPayoutsPage() {
  const { user } = useAuthSession();
  const adminUid = user?.id?.startsWith("firebase_")
    ? user.id.slice("firebase_".length)
    : (user?.id ?? "");

  const [tab, setTab] = useState<"winner" | "partner" | "referral">("winner");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [receiptFor, setReceiptFor] = useState<PayoutRow | null>(null);
  /** Settlement confirmation: the payout being settled, plus the audit detail. */
  const [settle, setSettle] = useState<{
    p: PayoutRow;
    status: "PAID" | "REJECTED" | "REVERSED";
    activity: "PAYOUT_COMPLETE" | "PAYOUT_FAIL" | "PAYOUT_REVERSE";
    message: string;
    reason: string;
    reference: string;
    /** When the admin opened this confirmation — the recorded settlement time. */
    at: number;
  } | null>(null);

  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        // No orderBy/where — equality + order across fields would need a
        // composite index. Sorted in JS instead. Admins may list all payouts
        // per firestore.rules; non-admins get permission-denied (handled below).
        const snap = await getDocs(query(collection(db, "payouts"), limit(200)));
        const rows = snap.docs
          .map((d) => toPayoutRow(d.id, d.data() as Record<string, unknown>))
          .sort((a, b) => b.createdAtMs - a.createdAtMs);
        if (!cancelled) setPayouts(rows);
      } catch (err) {
        const code = (err as { code?: string })?.code;
        if (!cancelled)
          setLoadError(
            code === "permission-denied"
              ? "Firestore denied access. Publish the latest firestore.rules, then refresh."
              : (err as Error)?.message || "Could not load payouts",
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const typeMap: Record<string, PayoutType> = {
    winner: "WINNER",
    partner: "PARTNER",
    referral: "REFERRAL",
  };

  const filtered = payouts.filter((p) => {
    const s = search.toLowerCase();
    if (s && !p.recipient.toLowerCase().includes(s) && !p.id.toLowerCase().includes(s))
      return false;
    if (statusFilter !== "all" && p.status.toLowerCase() !== statusFilter) return false;
    if (dateFrom && p.createdAtMs < new Date(`${dateFrom}T00:00:00`).getTime()) return false;
    if (dateTo && p.createdAtMs > new Date(`${dateTo}T23:59:59.999`).getTime()) return false;
    return p.type === typeMap[tab];
  });

  const allSelected = filtered.length > 0 && filtered.every((p) => selected[p.id]);
  const selectedCount = Object.values(selected).filter(Boolean).length;

  const applyStatus = async (
    p: PayoutRow,
    status: "PROCESSING" | "PAID" | "FAILED" | "REVERSED" | "REJECTED",
    activity: "PAYOUT_INITIATE" | "PAYOUT_COMPLETE" | "PAYOUT_FAIL" | "PAYOUT_REVERSE",
    message: string,
    extra?: { reason?: string; paymentReference?: string },
  ) => {
    if (busyId) return;
    if (!adminUid) {
      toast.error("Missing admin identity", {
        description: "Sign in as an admin to settle payouts.",
      });
      return;
    }
    setBusyId(p.id);
    try {
      const res = await adminSetPayoutStatus({
        data: { adminUid, payoutId: p.id, status, ...extra },
      });
      if (!res.ok) {
        toast.error(res.error || "Could not update payout");
        return;
      }
      void import("@/lib/activity-log").then(({ logActivity }) =>
        logActivity({
          eventType: activity,
          targetType: "payout",
          targetId: p.id,
          summary: `${message} · ${p.id} (${formatNaira(p.amountKobo)})`,
          details: { amountKobo: p.amountKobo, status },
        }),
      );
      toast.success(message, { description: p.id });
      setRefreshKey((k) => k + 1);
    } catch (err) {
      toast.error((err as Error)?.message || "Could not update payout");
    } finally {
      setBusyId(null);
    }
  };

  /** Settling money always records why, and once paid, the transfer reference. */
  const openSettle = (
    p: PayoutRow,
    status: "PAID" | "REJECTED" | "REVERSED",
    activity: "PAYOUT_COMPLETE" | "PAYOUT_FAIL" | "PAYOUT_REVERSE",
    message: string,
  ) => {
    if (busyId || !adminUid) {
      if (!adminUid)
        toast.error("Missing admin identity", {
          description: "Sign in as an admin to settle payouts.",
        });
      return;
    }
    setSettle({
      p,
      status,
      activity,
      message,
      reason: p.reason || defaultPayoutReason(p.type),
      reference: p.paymentReference,
      at: Date.now(),
    });
  };

  const confirmSettle = async () => {
    if (!settle) return;
    const { p, status, activity, message, reason, reference } = settle;
    setSettle(null);
    await applyStatus(p, status, activity, message, {
      reason: reason.trim(),
      paymentReference: status === "PAID" ? reference.trim() : "",
    });
  };

  const processSelected = async () => {
    const targets = filtered.filter(
      (p) => selected[p.id] && (p.status === "PENDING" || p.status === "UNDER_REVIEW"),
    );
    if (!targets.length) {
      toast.info("Nothing to process", {
        description: "Select pending or under-review payouts first.",
      });
      return;
    }
    if (busyId) return;
    if (!adminUid) {
      toast.error("Missing admin identity", {
        description: "Sign in as an admin to settle payouts.",
      });
      return;
    }
    setBusyId("batch");
    let done = 0;
    for (const p of targets) {
      try {
        const res = await adminSetPayoutStatus({
          data: { adminUid, payoutId: p.id, status: "PROCESSING" },
        });
        if (res.ok) done++;
      } catch {
        /* keep going; summary reports the count */
      }
    }
    setBusyId(null);
    setSelected({});
    toast.success(`${done} of ${targets.length} payouts queued for processing`);
    setRefreshKey((k) => k + 1);
  };

  /** Plain-text receipt — answers amount, recipient, when, and what for. */
  const downloadReceipt = (p: PayoutRow) => {
    const body = [
      "RAFFILA PAYOUT RECEIPT",
      "======================",
      `Payout ID       : ${p.id}`,
      `Status          : ${p.status}`,
      `Amount          : ${formatNaira(p.amountKobo)}`,
      `Recipient       : ${p.recipient}`,
      `Destination     : ${p.destination}`,
      `Type            : ${typeIcon[p.type].label}`,
      `For what        : ${p.reason}`,
      `Requested       : ${p.date}`,
      `Paid at         : ${p.paidAt}`,
      `Settled by      : ${p.processedBy || "—"}`,
      `Payment reference: ${p.paymentReference || "—"}`,
      `Issued          : ${lagosDateTimeWithYear(Date.now())}`,
      "",
      payoutReceiptLine({
        amountKobo: p.amountKobo,
        recipient: p.recipient,
        paidAt: p.paidAtMs,
        reason: p.reason,
      }),
    ].join("\n");
    const blob = new Blob([body], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `receipt-${p.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportCsv = () => {
    const header = [
      "ID",
      "Date",
      "Recipient",
      "Type",
      "Amount (kobo)",
      "Source",
      "Destination",
      "Status",
      "For what",
      "Paid at",
      "Settled by",
      "Payment reference",
    ];
    const lines = filtered.map((p) =>
      [
        p.id,
        csvCell(p.date),
        csvCell(p.recipient),
        p.type,
        String(p.amountKobo),
        csvCell(p.sourceBank),
        csvCell(p.destination),
        p.status,
        csvCell(p.reason),
        csvCell(p.paidAt),
        csvCell(p.processedBy),
        csvCell(p.paymentReference),
      ].join(","),
    );
    const blob = new Blob([[header.join(","), ...lines].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payouts-${tab}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const stats = payouts.reduce(
    (acc, p) => {
      acc.all++;
      acc.total += p.amountKobo;
      if (p.status === "PENDING") acc.pending++;
      if (p.status === "PROCESSING") acc.processing++;
      if (p.status === "PAID") {
        acc.paid++;
        acc.paidTotal += p.amountKobo;
      }
      if (p.status === "FAILED") acc.failed++;
      if (p.status === "REVERSED") acc.reversed++;
      return acc;
    },
    { all: 0, pending: 0, processing: 0, paid: 0, failed: 0, reversed: 0, total: 0, paidTotal: 0 },
  );

  const pillBg: Record<string, string> = {
    all: "bg-ink/5 text-ink",
    pending: "bg-lemon/40 text-ink",
    under_review: "bg-lilac/35 text-ink",
    processing: "bg-sky/25 text-ink",
    paid: "bg-mint/35 text-ink",
    failed: "bg-coral/20 text-coral",
    reversed: "bg-ink/15 text-ink",
    rejected: "bg-coral/25 text-coral",
  };

  return (
    <AdminShell activeNav="payouts" title="Payouts">
      <header className="mb-6">
        <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-coral">
          Admin · Payouts
        </p>
        <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">
          Payouts
        </h1>
        <p className="mt-2 max-w-2xl text-base font-bold text-ink/60">
          Winner payouts, partner settlements, and referral cash-outs — all finance movements in one
          queue.
        </p>
      </header>

      <section className="mb-5 flex flex-wrap gap-2">
        {[
          {
            k: "all",
            label: "All payouts",
            sub: stats.all,
            tone: "all" as const,
            icon: Banknote,
            subIsCount: true,
          },
          {
            k: "pending",
            label: "Pending",
            sub: stats.pending,
            tone: "pending" as const,
            icon: Clock3,
            subIsCount: true,
          },
          {
            k: "processing",
            label: "Processing",
            sub: stats.processing,
            tone: "processing" as const,
            icon: PlayCircle,
            subIsCount: true,
          },
          {
            k: "paid",
            label: "Paid",
            sub: stats.paid,
            tone: "paid" as const,
            icon: CheckCircle2,
            subIsCount: true,
            alt: formatNaira(stats.paidTotal),
          },
          {
            k: "failed",
            label: "Failed",
            sub: stats.failed,
            tone: "failed" as const,
            icon: XCircle,
            subIsCount: true,
          },
          {
            k: "reversed",
            label: "Reversed",
            sub: stats.reversed,
            tone: "reversed" as const,
            icon: Undo2,
            subIsCount: true,
          },
        ].map((p) => (
          <Card
            key={p.k}
            className="rounded-[22px] border-0 bg-paper p-0 ring-1 ring-ink/5 shadow-none min-w-[160px]"
          >
            <CardContent className="flex items-center gap-3 p-4">
              <div className={cn("grid size-10 place-items-center rounded-xl", pillBg[p.tone])}>
                <p.icon className="size-4.5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[10px] font-extrabold uppercase tracking-[0.12em] text-ink/45">
                  {p.label}
                </p>
                <p className="truncate font-display text-lg font-extrabold text-ink">
                  {p.subIsCount ? p.sub : formatNaira(p.sub as any)}
                </p>
                {p.alt && <p className="truncate text-[11px] font-bold text-ink/55">{p.alt}</p>}
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card className="rounded-[28px] border-0 bg-paper p-0 ring-1 ring-ink/5 shadow-none">
        <CardContent className="space-y-4 p-5 sm:p-6">
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <div className="flex flex-wrap items-center gap-3 justify-between">
              <TabsList className="rounded-full bg-cream p-1">
                <TabsTrigger
                  value="winner"
                  className="rounded-full px-4 py-1.5 text-xs font-extrabold data-[state=active]:bg-paper data-[state=active]:text-ink data-[state=active]:shadow-sm data-[state=inactive]:text-ink/60"
                >
                  <Trophy className="mr-1.5 size-3.5" /> Winner payouts
                </TabsTrigger>
                <TabsTrigger
                  value="partner"
                  className="rounded-full px-4 py-1.5 text-xs font-extrabold data-[state=active]:bg-paper data-[state=active]:text-ink data-[state=active]:shadow-sm data-[state=inactive]:text-ink/60"
                >
                  <Building2 className="mr-1.5 size-3.5" /> Partner settlements
                </TabsTrigger>
                <TabsTrigger
                  value="referral"
                  className="rounded-full px-4 py-1.5 text-xs font-extrabold data-[state=active]:bg-paper data-[state=active]:text-ink data-[state=active]:shadow-sm data-[state=inactive]:text-ink/60"
                >
                  <UsersRound className="mr-1.5 size-3.5" /> Referral cash-outs
                </TabsTrigger>
              </TabsList>
              {selectedCount > 0 && (
                <Button variant="primary" disabled={!!busyId} onClick={processSelected}>
                  <PlayCircle className="size-4" /> Process selected ({selectedCount})
                </Button>
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink/40" />
                <Input
                  placeholder="Search recipient or ID…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-10 rounded-full border-0 bg-cream pl-9 pr-4 text-xs font-bold text-ink placeholder:text-ink/40 focus-visible:ring-coral"
                />
              </div>
              <div className="flex items-center gap-2 rounded-full bg-cream px-3 py-1.5 text-xs font-bold text-ink/65 ring-1 ring-ink/10">
                <CalendarDays className="size-3.5" />
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="h-7 w-32 border-0 bg-transparent p-0 font-bold text-ink shadow-none focus-visible:ring-0"
                />
                <span>→</span>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="h-7 w-32 border-0 bg-transparent p-0 font-bold text-ink shadow-none focus-visible:ring-0"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-10 w-40 rounded-full bg-cream px-4 text-xs font-extrabold text-ink shadow-none ring-1 ring-ink/10 focus:ring-coral">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-[22px] bg-paper p-1">
                  <SelectItem value="all" className="rounded-xl font-bold">
                    All statuses
                  </SelectItem>
                  <SelectItem value="pending" className="rounded-xl font-bold">
                    Pending
                  </SelectItem>
                  <SelectItem value="under_review" className="rounded-xl font-bold">
                    Under review
                  </SelectItem>
                  <SelectItem value="processing" className="rounded-xl font-bold">
                    Processing
                  </SelectItem>
                  <SelectItem value="paid" className="rounded-xl font-bold">
                    Paid
                  </SelectItem>
                  <SelectItem value="failed" className="rounded-xl font-bold">
                    Failed
                  </SelectItem>
                  <SelectItem value="reversed" className="rounded-xl font-bold">
                    Reversed
                  </SelectItem>
                  <SelectItem value="rejected" className="rounded-xl font-bold">
                    Rejected
                  </SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRefreshKey((k) => k + 1)}
                disabled={loading}
              >
                <RefreshCw className={cn("size-3.5", loading && "animate-spin")} /> Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={exportCsv} disabled={loading}>
                <Download className="size-3.5" /> Export CSV
              </Button>
            </div>

            <TabsContent value={tab} className="mt-0">
              <div className="overflow-x-auto -mx-2 px-2">
                <Table>
                  <TableHeader className="[&_tr]:border-ink/10">
                    <TableRow>
                      <TableHead className="py-3 w-10">
                        <Checkbox
                          checked={allSelected}
                          onCheckedChange={(v) => {
                            const next: Record<string, boolean> = {};
                            if (v) filtered.forEach((p) => (next[p.id] = true));
                            setSelected(next);
                          }}
                        />
                      </TableHead>
                      <TableHead className="py-3 font-extrabold text-ink/65">ID</TableHead>
                      <TableHead className="py-3 font-extrabold text-ink/65">Date</TableHead>
                      <TableHead className="py-3 font-extrabold text-ink/65">Recipient</TableHead>
                      <TableHead className="py-3 font-extrabold text-ink/65">Type</TableHead>
                      <TableHead className="py-3 font-extrabold text-ink/65">For what</TableHead>
                      <TableHead className="py-3 text-right font-extrabold text-ink/65">
                        Amount
                      </TableHead>
                      <TableHead className="py-3 font-extrabold text-ink/65">Source</TableHead>
                      <TableHead className="py-3 font-extrabold text-ink/65">Destination</TableHead>
                      <TableHead className="py-3 font-extrabold text-ink/65">Status</TableHead>
                      <TableHead className="py-3 font-extrabold text-ink/65">Paid at</TableHead>
                      <TableHead className="py-3 text-right font-extrabold text-ink/65">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="[&_tr]:border-ink/10">
                    {filtered.map((p) => (
                      <TableRow key={p.id} className="hover:bg-lilac/10">
                        <TableCell className="py-3">
                          <Checkbox
                            checked={!!selected[p.id]}
                            onCheckedChange={(v) => setSelected({ ...selected, [p.id]: !!v })}
                          />
                        </TableCell>
                        <TableCell className="py-3 text-[11px] font-extrabold text-ink/70 whitespace-nowrap">
                          {p.id}
                        </TableCell>
                        <TableCell className="py-3 text-xs font-bold text-ink/65 whitespace-nowrap">
                          {p.date}
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="flex items-center gap-3">
                            <Avatar className={cn("size-9 ring-2 ring-paper", tintBg[p.tint])}>
                              <AvatarFallback
                                className={cn("text-xs font-extrabold", tintBg[p.tint])}
                              >
                                {p.initials}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-extrabold text-ink max-w-[160px]">
                                {p.recipient}
                              </p>
                              <Badge
                                className={cn(
                                  "mt-0.5 rounded-full px-1.5 py-0 text-[9px] font-extrabold uppercase tracking-wider ring-0",
                                  p.recipientType === "USER"
                                    ? "bg-sky/25 text-ink"
                                    : "bg-lilac/35 text-ink",
                                )}
                              >
                                {p.recipientType}
                              </Badge>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-3">
                          <Badge
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-extrabold ring-0",
                              typeIcon[p.type].tone,
                            )}
                          >
                            {typeIcon[p.type].label}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-3">
                          <p
                            className="max-w-[220px] truncate text-[11px] font-bold text-ink/65"
                            title={p.reason}
                          >
                            {p.reason}
                          </p>
                        </TableCell>
                        <TableCell className="py-3 text-right text-xs font-extrabold text-ink whitespace-nowrap">
                          {formatNaira(p.amountKobo)}
                        </TableCell>
                        <TableCell className="py-3 text-[11px] font-bold text-ink/65 whitespace-nowrap">
                          {p.sourceBank}
                        </TableCell>
                        <TableCell className="py-3 text-[11px] font-bold text-ink/65 whitespace-nowrap">
                          {p.destination}
                        </TableCell>
                        <TableCell className="py-3">
                          <Badge
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ring-0",
                              statusPill[p.status],
                            )}
                          >
                            {p.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-3 text-[11px] font-bold text-ink/65 whitespace-nowrap">
                          {p.paidAt}
                          {p.processedBy && (
                            <span className="block text-ink/40">by {p.processedBy}</span>
                          )}
                        </TableCell>
                        <TableCell className="py-3 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8"
                                aria-label={`Payout actions for ${p.id}`}
                              >
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="w-52 rounded-[22px] bg-paper p-1.5"
                            >
                              <DropdownMenuLabel className="rounded-xl px-3 py-2 text-[11px] font-extrabold uppercase tracking-wider text-ink/45">
                                {p.id}
                              </DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="rounded-xl cursor-pointer px-3 py-2 text-sm font-bold text-ink/75 focus:bg-lilac/20 focus:text-ink"
                                onClick={() => setReceiptFor(p)}
                              >
                                <Receipt className="mr-2 size-4" /> View receipt
                              </DropdownMenuItem>
                              {(p.status === "PENDING" || p.status === "UNDER_REVIEW") && (
                                <DropdownMenuItem
                                  className="rounded-xl cursor-pointer px-3 py-2 text-sm font-bold text-ink/75 focus:bg-lilac/20 focus:text-ink disabled:opacity-50"
                                  disabled={!!busyId}
                                  onClick={() =>
                                    applyStatus(
                                      p,
                                      "PROCESSING",
                                      "PAYOUT_INITIATE",
                                      "Payout queued for processing",
                                    )
                                  }
                                >
                                  <PlayCircle className="mr-2 size-4" /> Process
                                </DropdownMenuItem>
                              )}
                              {(p.status === "PENDING" || p.status === "UNDER_REVIEW") && (
                                <DropdownMenuItem
                                  className="rounded-xl cursor-pointer px-3 py-2 text-sm font-bold text-coral focus:bg-coral/15 disabled:opacity-50"
                                  disabled={!!busyId}
                                  onClick={() =>
                                    openSettle(p, "REJECTED", "PAYOUT_FAIL", "Payout rejected")
                                  }
                                >
                                  <XCircle className="mr-2 size-4" /> Reject
                                </DropdownMenuItem>
                              )}
                              {p.status === "PROCESSING" && (
                                <DropdownMenuItem
                                  className="rounded-xl cursor-pointer px-3 py-2 text-sm font-bold text-mint-700 focus:bg-mint/20 disabled:opacity-50"
                                  disabled={!!busyId}
                                  onClick={() =>
                                    openSettle(p, "PAID", "PAYOUT_COMPLETE", "Payout marked paid")
                                  }
                                >
                                  <CheckCircle2 className="mr-2 size-4" /> Mark paid
                                </DropdownMenuItem>
                              )}
                              {(p.status === "PAID" || p.status === "PROCESSING") && (
                                <DropdownMenuItem
                                  className="rounded-xl cursor-pointer px-3 py-2 text-sm font-bold text-coral focus:bg-coral/15 disabled:opacity-50"
                                  disabled={!!busyId}
                                  onClick={() =>
                                    openSettle(p, "REVERSED", "PAYOUT_REVERSE", "Payout reversed")
                                  }
                                >
                                  <Undo2 className="mr-2 size-4" /> Reverse
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                    {loading && (
                      <TableRow>
                        <TableCell
                          colSpan={12}
                          className="py-10 text-center text-sm font-bold text-ink/50"
                        >
                          Loading payouts…
                        </TableCell>
                      </TableRow>
                    )}
                    {!loading && loadError && (
                      <TableRow>
                        <TableCell
                          colSpan={12}
                          className="py-10 text-center text-sm font-bold text-coral"
                        >
                          {loadError}
                        </TableCell>
                      </TableRow>
                    )}
                    {!loading && !loadError && filtered.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={12}
                          className="py-10 text-center text-sm font-bold text-ink/50"
                        >
                          No payouts for this filter yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={!!receiptFor} onOpenChange={(v) => !v && setReceiptFor(null)}>
        <DialogContent className="rounded-[28px] bg-cream p-0 shadow-none sm:max-w-2xl">
          <DialogHeader className="flex-row items-start justify-between gap-4 border-b border-ink/10 px-6 py-5 sm:!flex-row sm:!items-center sm:!justify-between sm:!text-left">
            <div>
              <DialogTitle className="flex items-center gap-3 font-display text-2xl font-extrabold text-ink">
                <span className="grid size-10 place-items-center rounded-2xl bg-mint/35">
                  <Receipt className="size-4.5 text-ink" />
                </span>
                {receiptFor && `Payout receipt · ${receiptFor.id}`}
              </DialogTitle>
              {receiptFor && (
                <p className="mt-1 text-[11px] font-bold text-ink/55">Issued {receiptFor.date}</p>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => receiptFor && downloadReceipt(receiptFor)}
            >
              <FileText className="size-3.5" /> Download receipt
            </Button>
          </DialogHeader>
          {receiptFor && (
            <div className="space-y-4 px-6 py-5">
              <Card className="rounded-[22px] border-0 bg-paper p-0 ring-1 ring-ink/5">
                <CardContent className="p-5">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <Label className="text-[11px] font-extrabold uppercase tracking-wider text-ink/45">
                        Amount
                      </Label>
                      <p className="mt-1 font-display text-2xl font-extrabold text-ink">
                        {formatNaira(receiptFor.amountKobo)}
                      </p>
                    </div>
                    <div>
                      <Label className="text-[11px] font-extrabold uppercase tracking-wider text-ink/45">
                        Status
                      </Label>
                      <div className="mt-1">
                        <Badge
                          className={cn(
                            "rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase ring-0",
                            statusPill[receiptFor.status],
                          )}
                        >
                          {receiptFor.status}
                        </Badge>
                      </div>
                    </div>
                    <Separator className="col-span-2" />
                    <div>
                      <Label className="text-[11px] font-extrabold uppercase tracking-wider text-ink/45">
                        Recipient
                      </Label>
                      <p className="mt-1 font-extrabold text-ink">{receiptFor.recipient}</p>
                      <p className="text-xs font-bold text-ink/55">{receiptFor.destination}</p>
                    </div>
                    <div>
                      <Label className="text-[11px] font-extrabold uppercase tracking-wider text-ink/45">
                        Type
                      </Label>
                      <p className="mt-1 font-extrabold text-ink">
                        {typeIcon[receiptFor.type].label}
                      </p>
                      <p className="text-xs font-bold text-ink/55">
                        Source: {receiptFor.sourceBank}
                      </p>
                    </div>
                    <Separator className="col-span-2" />
                    <div className="col-span-2">
                      <Label className="text-[11px] font-extrabold uppercase tracking-wider text-ink/45">
                        For what
                      </Label>
                      <p className="mt-1 font-extrabold text-ink">{receiptFor.reason}</p>
                    </div>
                    <div>
                      <Label className="text-[11px] font-extrabold uppercase tracking-wider text-ink/45">
                        Paid at
                      </Label>
                      <p className="mt-1 font-extrabold text-ink">{receiptFor.paidAt}</p>
                      {receiptFor.processedBy && (
                        <p className="text-xs font-bold text-ink/55">
                          Settled by {receiptFor.processedBy}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label className="text-[11px] font-extrabold uppercase tracking-wider text-ink/45">
                        Payment reference
                      </Label>
                      <p className="mt-1 font-extrabold text-ink">
                        {receiptFor.paymentReference || "—"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!settle} onOpenChange={(v) => !v && setSettle(null)}>
        <DialogContent className="rounded-[28px] bg-cream p-0 shadow-none sm:max-w-lg">
          <DialogHeader className="border-b border-ink/10 px-6 py-5 sm:!text-left">
            <DialogTitle className="font-display text-2xl font-extrabold text-ink">
              {settle?.status === "PAID" && "Confirm payout"}
              {settle?.status === "REJECTED" && "Reject payout"}
              {settle?.status === "REVERSED" && "Reverse payout"}
            </DialogTitle>
            <DialogDescription className="text-sm font-bold text-ink/60">
              {settle &&
                `${formatNaira(settle.p.amountKobo)} to ${settle.p.recipient} · ${settle.p.id}`}
            </DialogDescription>
          </DialogHeader>
          {settle && (
            <div className="space-y-4 px-6 py-5">
              <div>
                <Label
                  htmlFor="settle-reason"
                  className="text-[11px] font-extrabold uppercase tracking-wider text-ink/45"
                >
                  For what
                </Label>
                <Textarea
                  id="settle-reason"
                  value={settle.reason}
                  onChange={(e) => setSettle({ ...settle, reason: e.target.value })}
                  rows={2}
                  className="mt-1.5 rounded-2xl border-0 bg-paper font-bold text-ink shadow-none ring-1 ring-ink/10 focus-visible:ring-coral"
                  placeholder="Why this money is moving…"
                />
              </div>
              {settle.status === "PAID" && (
                <div>
                  <Label
                    htmlFor="settle-ref"
                    className="text-[11px] font-extrabold uppercase tracking-wider text-ink/45"
                  >
                    Payment reference
                  </Label>
                  <Input
                    id="settle-ref"
                    value={settle.reference}
                    onChange={(e) => setSettle({ ...settle, reference: e.target.value })}
                    className="mt-1.5 h-10 rounded-full border-0 bg-paper font-bold text-ink shadow-none ring-1 ring-ink/10 focus-visible:ring-coral"
                    placeholder="Transfer / Paystack reference…"
                  />
                </div>
              )}
              <div className="rounded-2xl bg-paper p-4 ring-1 ring-ink/10">
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-ink/45">
                  {settle.status === "PAID" ? "Payment date & time" : "Settled at"}
                </p>
                <p className="mt-1 font-display text-lg font-extrabold text-ink">
                  {lagosDateTimeWithYear(settle.at)}
                </p>
                <p className="mt-1 text-xs font-bold text-ink/55">
                  {settle.status === "PAID"
                    ? "Recorded on the payout as the payment timestamp."
                    : "Reserved balance is returned to the recipient."}
                </p>
              </div>
            </div>
          )}
          <DialogFooter className="border-t border-ink/10 px-6 py-4">
            <Button variant="outline" size="sm" onClick={() => setSettle(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={!!busyId || !settle?.reason.trim()}
              onClick={confirmSettle}
            >
              {settle?.status === "PAID" && <CheckCircle2 className="size-4" />}
              {settle?.status === "REJECTED" && <XCircle className="size-4" />}
              {settle?.status === "REVERSED" && <Undo2 className="size-4" />}
              {settle?.status === "PAID" && "Confirm paid"}
              {settle?.status === "REJECTED" && "Reject payout"}
              {settle?.status === "REVERSED" && "Reverse payout"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}

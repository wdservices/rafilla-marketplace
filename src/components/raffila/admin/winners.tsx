import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  Gift,
  MoreHorizontal,
  PackageCheck,
  RefreshCw,
  Search,
  Truck,
  Trophy,
} from "lucide-react";
import { toast } from "sonner";
import { collection, doc, getDocs, limit, query, setDoc } from "firebase/firestore";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { AdminShell } from "@/components/raffila/admin/admin-shell";
import { useAuthSession } from "@/hooks/useAuthSession";
import { db } from "@/lib/firebase";
import { toMs } from "@/lib/doc-values";
import { lagosDateWithYear, lagosDateTimeWithYear } from "@/lib/format";
import {
  DELIVERY_METHOD_LABELS,
  FULFILLMENT_LABELS,
  fulfillmentStamp,
  readWinnerFulfillment,
  winnerFulfillmentWrite,
  winnerReceiptWrite,
  type DeliveryMethod,
  type WinnerFulfillment,
  type WinnerFulfillmentStatus,
} from "@/lib/payout-tracking";
import { cn } from "@/lib/utils";

interface WinnerRow {
  id: string;
  winnerName: string;
  winnerHandle: string;
  competitionTitle: string;
  prize: string;
  ticketNumber: string;
  drawMs: number;
  createdAtMs: number;
  f: WinnerFulfillment;
}

const STATUS_ORDER: WinnerFulfillmentStatus[] = [
  "RECEIVED",
  "OUT_FOR_DELIVERY",
  "PENDING_CLAIM",
  "HANDOVER_FAILED",
];

const statusPill: Record<WinnerFulfillmentStatus, string> = {
  RECEIVED: "bg-mint/35 text-ink",
  OUT_FOR_DELIVERY: "bg-sky/25 text-ink",
  PENDING_CLAIM: "bg-lemon/40 text-ink",
  HANDOVER_FAILED: "bg-coral/20 text-coral",
};

const TINTS = ["sky", "mint", "coral", "lemon", "lilac"] as const;
type Tint = (typeof TINTS)[number];

const tintBg: Record<Tint, string> = {
  sky: "bg-sky/30 text-ink",
  mint: "bg-mint/35 text-ink",
  coral: "bg-coral/20 text-coral",
  lemon: "bg-lemon/40 text-ink",
  lilac: "bg-lilac/35 text-ink",
};

function tintOf(id: string): Tint {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return TINTS[h % TINTS.length]!;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "–";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function toWinnerRow(id: string, v: Record<string, unknown>): WinnerRow {
  const str = (key: string): string => {
    const raw = v[key];
    return typeof raw === "string" ? raw : "";
  };
  const drawMs = toMs(v["drawDate"] ?? v["createdAt"]);
  return {
    id,
    winnerName: str("winnerName") || "Verified Winner",
    winnerHandle: str("winnerHandle"),
    competitionTitle: str("competitionTitle") || "Untitled competition",
    prize: str("prize"),
    ticketNumber: str("ticketNumber"),
    drawMs,
    createdAtMs: toMs(v["createdAt"]) || drawMs,
    f: readWinnerFulfillment(v),
  };
}

/** `<input type="datetime-local">` value for a Date, in local time. */
function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes(),
  )}`;
}

function strError(err: unknown): string {
  return (err as Error)?.message || String(err);
}

export function AdminWinnersPage() {
  const { user } = useAuthSession();
  const adminUid = user?.id?.startsWith("firebase_")
    ? user.id.slice("firebase_".length)
    : (user?.id ?? "");
  const adminName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.email || "Admin";

  const [rows, setRows] = useState<WinnerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  const [confirmFor, setConfirmFor] = useState<WinnerRow | null>(null);
  const [when, setWhen] = useState("");
  const [method, setMethod] = useState<DeliveryMethod>("COURIER");
  const [note, setNote] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        // No orderBy/where — sorted in JS so no composite index is needed.
        const snap = await getDocs(query(collection(db, "winners"), limit(200)));
        const list = snap.docs
          .map((d) => toWinnerRow(d.id, d.data() as Record<string, unknown>))
          .sort((a, b) => b.createdAtMs - a.createdAtMs);
        if (!cancelled) setRows(list);
      } catch (err) {
        const code = (err as { code?: string })?.code;
        if (!cancelled)
          setLoadError(
            code === "permission-denied"
              ? "Firestore denied access. Publish the latest firestore.rules, then refresh."
              : strError(err),
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const stats = useMemo(() => {
    const s = {
      total: rows.length,
      received: 0,
      outstanding: 0,
      delivering: 0,
      failed: 0,
    };
    for (const r of rows) {
      if (r.f.fulfillmentStatus === "RECEIVED") s.received++;
      else if (r.f.fulfillmentStatus === "OUT_FOR_DELIVERY") s.delivering++;
      else if (r.f.fulfillmentStatus === "HANDOVER_FAILED") s.failed++;
      else s.outstanding++;
    }
    return s;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.f.fulfillmentStatus !== statusFilter) return false;
      if (!q) return true;
      return (
        r.winnerName.toLowerCase().includes(q) ||
        r.winnerHandle.toLowerCase().includes(q) ||
        r.competitionTitle.toLowerCase().includes(q) ||
        r.ticketNumber.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q)
      );
    });
  }, [rows, search, statusFilter]);

  const commit = useCallback(
    async (row: WinnerRow, payload: Record<string, string>) => {
      if (busyId) return;
      if (!adminUid) {
        toast.error("Missing admin identity", {
          description: "Sign in as an admin to update prize handovers.",
        });
        return;
      }
      setBusyId(row.id);
      try {
        await setDoc(doc(db, "winners", row.id), payload, { merge: true });
        toast.success("Prize handover updated", {
          description: `${row.winnerName} · ${row.competitionTitle}`,
        });
        setRefreshKey((k) => k + 1);
      } catch (err) {
        const code = (err as { code?: string })?.code;
        toast.error(
          code === "permission-denied"
            ? "Firestore denied the write. Publish the latest firestore.rules."
            : strError(err),
        );
      } finally {
        setBusyId(null);
      }
    },
    [adminUid, busyId],
  );

  const markReceived = useCallback(
    (row: WinnerRow) => {
      if (!when) return;
      const receivedAt = new Date(when).getTime();
      if (!Number.isFinite(receivedAt)) {
        toast.error("Invalid date", { description: "Pick a valid date and time." });
        return;
      }
      setConfirmFor(null);
      void commit(
        row,
        winnerReceiptWrite({
          receivedAt,
          adminUid,
          adminName,
          deliveryMethod: method,
          note,
        }),
      );
    },
    [adminUid, adminName, commit, method, note, when],
  );

  const transition = useCallback(
    (row: WinnerRow, status: Exclude<WinnerFulfillmentStatus, "RECEIVED">) => {
      void commit(row, winnerFulfillmentWrite(status, { adminUid, adminName }));
    },
    [adminUid, adminName, commit],
  );

  const openConfirm = (row: WinnerRow) => {
    setWhen(toLocalInputValue(new Date()));
    setMethod("COURIER");
    setNote("");
    setConfirmFor(row);
  };

  const exportCsv = () => {
    const header = [
      "ID",
      "Winner",
      "Handle",
      "Competition",
      "Prize",
      "Ticket",
      "Drawn",
      "Fulfillment status",
      "Received at",
      "Received by",
      "Delivery method",
      "Note",
    ];
    const lines = filtered.map((r) =>
      [
        r.id,
        csvCell(r.winnerName),
        csvCell(r.winnerHandle),
        csvCell(r.competitionTitle),
        csvCell(r.prize),
        csvCell(r.ticketNumber),
        csvCell(r.drawMs ? lagosDateWithYear(r.drawMs) : "—"),
        FULFILLMENT_LABELS[r.f.fulfillmentStatus],
        csvCell(fulfillmentStamp(r.f.receivedAt)),
        csvCell(r.f.receivedByName || "—"),
        r.f.deliveryMethod ? DELIVERY_METHOD_LABELS[r.f.deliveryMethod] : "—",
        csvCell(r.f.fulfillmentNote),
      ].join(","),
    );
    const blob = new Blob([[header.join(","), ...lines].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `winners-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const confirmPreview = when ? lagosDateTimeWithYear(new Date(when).getTime()) : "—";

  return (
    <AdminShell activeNav="winners" title="Winners">
      <header className="mb-6">
        <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-coral">
          Admin · Winners
        </p>
        <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">
          Winner handovers
        </h1>
        <p className="mt-2 max-w-2xl text-base font-bold text-ink/60">
          Track whether each prize has been handed over — with the date and time the winner
          confirmed receipt.
        </p>
      </header>

      <section className="mb-5 flex flex-wrap gap-2">
        {[
          { k: "all", label: "All winners", value: stats.total, icon: Trophy, tone: "bg-ink/5" },
          {
            k: "RECEIVED",
            label: "Received",
            value: stats.received,
            icon: PackageCheck,
            tone: "bg-mint/35",
          },
          {
            k: "PENDING_CLAIM",
            label: "Awaiting handover",
            value: stats.outstanding,
            icon: Clock3,
            tone: "bg-lemon/40",
          },
          {
            k: "OUT_FOR_DELIVERY",
            label: "Out for delivery",
            value: stats.delivering,
            icon: Truck,
            tone: "bg-sky/25",
          },
          {
            k: "HANDOVER_FAILED",
            label: "Handover failed",
            value: stats.failed,
            icon: AlertTriangle,
            tone: "bg-coral/20",
          },
        ].map((c) => (
          <Card
            key={c.k}
            onClick={() => setStatusFilter(c.k)}
            className={cn(
              "min-w-[168px] cursor-pointer rounded-[22px] border-0 bg-paper p-0 shadow-none ring-1 transition-all",
              statusFilter === c.k ? "ring-coral/50" : "ring-ink/5",
            )}
          >
            <CardContent className="flex items-center gap-3 p-4">
              <div className={cn("grid size-10 place-items-center rounded-xl", c.tone)}>
                <c.icon className="size-4.5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[10px] font-extrabold uppercase tracking-[0.12em] text-ink/45">
                  {c.label}
                </p>
                <p className="truncate font-display text-lg font-extrabold text-ink">{c.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card className="rounded-[28px] border-0 bg-paper p-0 ring-1 ring-ink/5 shadow-none">
        <CardContent className="space-y-4 p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[200px] max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink/40" />
              <Input
                placeholder="Search winner, competition, ticket…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-10 rounded-full border-0 bg-cream pl-9 pr-4 text-xs font-bold text-ink placeholder:text-ink/40 focus-visible:ring-coral"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-10 w-52 rounded-full bg-cream px-4 text-xs font-extrabold text-ink shadow-none ring-1 ring-ink/10 focus:ring-coral">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-[22px] bg-paper p-1">
                <SelectItem value="all" className="rounded-xl font-bold">
                  All handover states
                </SelectItem>
                {STATUS_ORDER.map((s) => (
                  <SelectItem key={s} value={s} className="rounded-xl font-bold">
                    {FULFILLMENT_LABELS[s]}
                  </SelectItem>
                ))}
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

          <div className="overflow-x-auto -mx-2 px-2">
            <Table>
              <TableHeader className="[&_tr]:border-ink/10">
                <TableRow>
                  <TableHead className="py-3 font-extrabold text-ink/65">Winner</TableHead>
                  <TableHead className="py-3 font-extrabold text-ink/65">Competition</TableHead>
                  <TableHead className="py-3 font-extrabold text-ink/65">Ticket</TableHead>
                  <TableHead className="py-3 font-extrabold text-ink/65">Drawn</TableHead>
                  <TableHead className="py-3 font-extrabold text-ink/65">Handover status</TableHead>
                  <TableHead className="py-3 font-extrabold text-ink/65">Received at</TableHead>
                  <TableHead className="py-3 text-right font-extrabold text-ink/65">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="[&_tr]:border-ink/10">
                {filtered.map((r) => {
                  const tint = tintOf(r.id);
                  return (
                    <TableRow key={r.id} className="hover:bg-lilac/10">
                      <TableCell className="py-3">
                        <div className="flex items-center gap-3">
                          <Avatar className={cn("size-9 ring-2 ring-paper", tintBg[tint])}>
                            <AvatarFallback className={cn("text-xs font-extrabold", tintBg[tint])}>
                              {initialsOf(r.winnerName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="max-w-[180px] truncate text-sm font-extrabold text-ink">
                              {r.winnerName}
                            </p>
                            <p className="text-[11px] font-bold text-ink/50">
                              {r.winnerHandle ? `@${r.winnerHandle}` : r.id}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        <p className="max-w-[200px] truncate text-xs font-extrabold text-ink">
                          {r.competitionTitle}
                        </p>
                        {r.prize && (
                          <p className="max-w-[200px] truncate text-[11px] font-bold text-ink/55">
                            {r.prize}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="py-3 text-xs font-bold text-ink/65 whitespace-nowrap">
                        {r.ticketNumber ? `#${r.ticketNumber}` : "—"}
                      </TableCell>
                      <TableCell className="py-3 text-xs font-bold text-ink/65 whitespace-nowrap">
                        {r.drawMs ? lagosDateWithYear(r.drawMs) : "—"}
                      </TableCell>
                      <TableCell className="py-3">
                        <Badge
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-extrabold ring-0",
                            statusPill[r.f.fulfillmentStatus],
                          )}
                        >
                          {FULFILLMENT_LABELS[r.f.fulfillmentStatus]}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-3 text-[11px] font-bold text-ink/65 whitespace-nowrap">
                        {fulfillmentStamp(r.f.receivedAt)}
                        {r.f.receivedAt && r.f.receivedByName && (
                          <span className="block text-ink/40">
                            confirmed by {r.f.receivedByName}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              aria-label={`Handover actions for ${r.winnerName}`}
                            >
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="w-60 rounded-[22px] bg-paper p-1.5"
                          >
                            <DropdownMenuLabel className="rounded-xl px-3 py-2 text-[11px] font-extrabold uppercase tracking-wider text-ink/45">
                              {r.id}
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="rounded-xl cursor-pointer px-3 py-2 text-sm font-bold text-ink/75 focus:bg-lilac/20 focus:text-ink disabled:opacity-50"
                              disabled={busyId === r.id}
                              onClick={() => openConfirm(r)}
                            >
                              <Gift className="mr-2 size-4" /> Confirm received…
                            </DropdownMenuItem>
                            {r.f.fulfillmentStatus !== "OUT_FOR_DELIVERY" && (
                              <DropdownMenuItem
                                className="rounded-xl cursor-pointer px-3 py-2 text-sm font-bold text-ink/75 focus:bg-lilac/20 focus:text-ink disabled:opacity-50"
                                disabled={busyId === r.id}
                                onClick={() => transition(r, "OUT_FOR_DELIVERY")}
                              >
                                <Truck className="mr-2 size-4" /> Mark out for delivery
                              </DropdownMenuItem>
                            )}
                            {r.f.fulfillmentStatus !== "PENDING_CLAIM" && (
                              <DropdownMenuItem
                                className="rounded-xl cursor-pointer px-3 py-2 text-sm font-bold text-ink/75 focus:bg-lilac/20 focus:text-ink disabled:opacity-50"
                                disabled={busyId === r.id}
                                onClick={() => transition(r, "PENDING_CLAIM")}
                              >
                                <Clock3 className="mr-2 size-4" /> Reset to awaiting handover
                              </DropdownMenuItem>
                            )}
                            {r.f.fulfillmentStatus !== "HANDOVER_FAILED" && (
                              <DropdownMenuItem
                                className="rounded-xl cursor-pointer px-3 py-2 text-sm font-bold text-coral focus:bg-coral/15 disabled:opacity-50"
                                disabled={busyId === r.id}
                                onClick={() => transition(r, "HANDOVER_FAILED")}
                              >
                                <AlertTriangle className="mr-2 size-4" /> Report handover failed
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {loading && (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="py-10 text-center text-sm font-bold text-ink/50"
                    >
                      Loading winners…
                    </TableCell>
                  </TableRow>
                )}
                {!loading && loadError && (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="py-10 text-center text-sm font-bold text-coral"
                    >
                      {loadError}
                    </TableCell>
                  </TableRow>
                )}
                {!loading && !loadError && filtered.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="py-10 text-center text-sm font-bold text-ink/50"
                    >
                      No winners match this filter yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!confirmFor} onOpenChange={(v) => !v && setConfirmFor(null)}>
        <DialogContent className="rounded-[28px] bg-cream p-0 shadow-none sm:max-w-lg">
          <DialogHeader className="border-b border-ink/10 px-6 py-5 sm:!text-left">
            <DialogTitle className="font-display text-2xl font-extrabold text-ink">
              Confirm prize receipt
            </DialogTitle>
            <DialogDescription className="text-sm font-bold text-ink/60">
              {confirmFor && `${confirmFor.winnerName} · ${confirmFor.competitionTitle}`}
            </DialogDescription>
          </DialogHeader>
          {confirmFor && (
            <div className="space-y-4 px-6 py-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label
                    htmlFor="received-at"
                    className="text-[11px] font-extrabold uppercase tracking-wider text-ink/45"
                  >
                    Received on
                  </Label>
                  <Input
                    id="received-at"
                    type="datetime-local"
                    value={when}
                    onChange={(e) => setWhen(e.target.value)}
                    className="mt-1.5 h-10 rounded-2xl border-0 bg-paper font-bold text-ink shadow-none ring-1 ring-ink/10 focus-visible:ring-coral"
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-extrabold uppercase tracking-wider text-ink/45">
                    Handover method
                  </Label>
                  <Select value={method} onValueChange={(v) => setMethod(v as DeliveryMethod)}>
                    <SelectTrigger className="mt-1.5 h-10 w-full rounded-2xl bg-paper px-4 text-xs font-extrabold text-ink shadow-none ring-1 ring-ink/10 focus:ring-coral">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-[22px] bg-paper p-1">
                      {(Object.keys(DELIVERY_METHOD_LABELS) as DeliveryMethod[]).map((m) => (
                        <SelectItem key={m} value={m} className="rounded-xl font-bold">
                          {DELIVERY_METHOD_LABELS[m]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label
                  htmlFor="receipt-note"
                  className="text-[11px] font-extrabold uppercase tracking-wider text-ink/45"
                >
                  Confirmation note
                </Label>
                <Textarea
                  id="receipt-note"
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="mt-1.5 rounded-2xl border-0 bg-paper font-bold text-ink shadow-none ring-1 ring-ink/10 focus-visible:ring-coral"
                  placeholder="Optional: who handed it over, ID verified, etc."
                />
              </div>

              <div className="rounded-2xl bg-paper p-4 ring-1 ring-ink/10">
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-ink/45">
                  Recorded receipt time
                </p>
                <p className="mt-1 font-display text-lg font-extrabold text-ink">
                  {confirmPreview}
                </p>
                <p className="mt-1 text-xs font-bold text-ink/55">
                  Confirmed by {adminName} · {DELIVERY_METHOD_LABELS[method]}
                </p>
              </div>
            </div>
          )}
          <DialogFooter className="border-t border-ink/10 px-6 py-4">
            <Button variant="outline" size="sm" onClick={() => setConfirmFor(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={!confirmFor || !!busyId || !when}
              onClick={() => confirmFor && markReceived(confirmFor)}
            >
              <CheckCircle2 className="size-4" /> Confirm received
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="mt-4 flex items-center gap-2 text-[11px] font-bold text-ink/45">
        <CalendarDays className="size-3.5" />
        Showing {filtered.length} of {rows.length} winner records.
      </div>
    </AdminShell>
  );
}

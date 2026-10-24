import { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
  type Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ACTIVITY_EVENTS, type ActivityEventType, type ActivityRisk } from "@/lib/activity-log";
import { AdminShell } from "./admin-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Search,
  Calendar,
  Shield,
  Eye,
  History,
  Download,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  AlertCircle,
  ShieldCheck,
  ShieldAlert,
  Activity,
  UserPlus,
  LogIn,
  KeyRound,
  Ticket,
  Wallet,
  Settings,
  CreditCard,
  Trash2,
  Edit3,
  Ban,
  CheckCircle2,
  FileText,
  Users,
  Trophy,
  Bell,
  Mail,
  Smartphone,
  Lock,
} from "lucide-react";

const EVENT_TYPES = ACTIVITY_EVENTS;

type EventType = ActivityEventType;
type RiskLevel = ActivityRisk;

interface AuditLog {
  id: string;
  timestamp: string;
  actorName: string;
  actorEmail: string;
  actorId: string;
  actorRole: string;
  eventType: EventType;
  targetType: string;
  targetId: string;
  summary: string;
  details: Record<string, unknown>;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  riskLevel: RiskLevel;
}

import { lagosDayKey, lagosDateShort, lagosTime, lagosDateTime } from "@/lib/format";

function toIso(value: unknown, fallback?: unknown): string {
  try {
    if (value && typeof (value as Timestamp).toDate === "function") {
      return ((value as Timestamp).toDate() as Date).toISOString();
    }
  } catch {
    // fall through
  }
  if (typeof value === "string" && value) return value;
  if (typeof fallback === "string" && fallback) return fallback;
  return new Date(0).toISOString();
}

function docToLog(id: string, data: Record<string, unknown>): AuditLog {
  const eventType =
    typeof data["eventType"] === "string" &&
    (EVENT_TYPES as readonly string[]).includes(data["eventType"] as string)
      ? (data["eventType"] as EventType)
      : "USER_UPDATE";
  return {
    id,
    timestamp: toIso(data["createdAt"], data["clientAt"]),
    actorName: (data["actorName"] as string) || "Unknown",
    actorEmail: (data["actorEmail"] as string) || "",
    actorId: (data["actorId"] as string) || "",
    actorRole: (data["actorRole"] as string) || "",
    eventType,
    targetType: (data["targetType"] as string) || "",
    targetId: (data["targetId"] as string) || "",
    summary: (data["summary"] as string) || "",
    details: (data["details"] as Record<string, unknown>) || {},
    oldValue: (data["oldValue"] as Record<string, unknown> | null) ?? null,
    newValue: (data["newValue"] as Record<string, unknown> | null) ?? null,
    riskLevel: (data["riskLevel"] as RiskLevel) || "low",
  };
}

const riskBadge = (r: RiskLevel) => {
  switch (r) {
    case "low":
      return (
        <Badge variant="outline" className="bg-mint/20 text-ink border-mint">
          <ShieldCheck className="w-3 h-3 mr-1" /> Low
        </Badge>
      );
    case "medium":
      return (
        <Badge variant="outline" className="bg-lemon/30 text-ink border-lemon">
          <AlertCircle className="w-3 h-3 mr-1" /> Med
        </Badge>
      );
    case "high":
      return (
        <Badge variant="outline" className="bg-coral/20 text-ink border-coral">
          <AlertTriangle className="w-3 h-3 mr-1" /> High
        </Badge>
      );
    case "critical":
      return (
        <Badge className="bg-coral text-white border-coral">
          <ShieldAlert className="w-3 h-3 mr-1" /> CRITICAL
        </Badge>
      );
  }
};

const eventIcon = (e: EventType) => {
  if (e.startsWith("AUTH")) {
    if (e === "AUTH_LOGIN") return <LogIn className="w-3.5 h-3.5" />;
    if (e === "AUTH_REGISTER" || e === "USER_CREATE") return <UserPlus className="w-3.5 h-3.5" />;
    if (e === "AUTH_PASSWORD_CHANGE" || e === "AUTH_PASSWORD_RESET")
      return <KeyRound className="w-3.5 h-3.5" />;
    return <Lock className="w-3.5 h-3.5" />;
  }
  if (e.startsWith("TICKET")) return <Ticket className="w-3.5 h-3.5" />;
  if (e.startsWith("PAYOUT")) return <CreditCard className="w-3.5 h-3.5" />;
  if (e.startsWith("WALLET")) return <Wallet className="w-3.5 h-3.5" />;
  if (e.startsWith("CONFIG")) return <Settings className="w-3.5 h-3.5" />;
  if (e.startsWith("USER")) return <Users className="w-3.5 h-3.5" />;
  if (e.startsWith("PARTNER")) return <Users className="w-3.5 h-3.5" />;
  if (e.startsWith("COMPETITION")) return <Trophy className="w-3.5 h-3.5" />;
  if (e.startsWith("NOTIFICATION"))
    return e === "NOTIFICATION_SEND" ? (
      <Mail className="w-3.5 h-3.5" />
    ) : (
      <Bell className="w-3.5 h-3.5" />
    );
  if (e.startsWith("REFERRAL")) return <Users className="w-3.5 h-3.5" />;
  if (e.startsWith("FRAUD")) return <ShieldAlert className="w-3.5 h-3.5" />;
  if (e.startsWith("CRM")) return <FileText className="w-3.5 h-3.5" />;
  return <Activity className="w-3.5 h-3.5" />;
};

const eventBadge = (e: EventType) => {
  const tint = e.startsWith("AUTH")
    ? "bg-sky/20 text-ink border-sky"
    : e.startsWith("TICKET")
      ? "bg-coral/20 text-ink border-coral"
      : e.startsWith("PAYOUT")
        ? "bg-mint/20 text-ink border-mint"
        : e.startsWith("WALLET")
          ? "bg-lemon/30 text-ink border-lemon"
          : e.startsWith("CONFIG")
            ? "bg-lilac/20 text-ink border-lilac"
            : e.startsWith("USER")
              ? "bg-sky/20 text-ink border-sky"
              : e.startsWith("PARTNER")
                ? "bg-mint/20 text-ink border-mint"
                : e.startsWith("COMPETITION")
                  ? "bg-coral/20 text-ink border-coral"
                  : e.startsWith("FRAUD")
                    ? "bg-coral/20 text-ink border-coral"
                    : "bg-ink/10 text-ink border-ink/30";
  return (
    <Badge variant="outline" className={`${tint} font-mono text-[10px]`}>
      {eventIcon(e)}
      <span className="ml-1">{e.replace(/_/g, " ")}</span>
    </Badge>
  );
};

const RISK_LEVELS: RiskLevel[] = ["low", "medium", "high", "critical"];
const FETCH_LIMIT = 200;

export function AdminAuditLogsPage() {
  const [eventFilter, setEventFilter] = useState<EventType | "all">("all");
  const [riskFilter, setRiskFilter] = useState<RiskLevel | "all">("all");
  const [userQuery, setUserQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 12;
  const [diffLog, setDiffLog] = useState<AuditLog | null>(null);

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const snap = await getDocs(
          query(collection(db, "activityLogs"), orderBy("createdAt", "desc"), limit(FETCH_LIMIT)),
        );
        if (cancelled) return;
        setLogs(snap.docs.map((d) => docToLog(d.id, d.data() as Record<string, unknown>)));
      } catch (err: any) {
        if (!cancelled) {
          setLoadError(err?.message || "Could not load activity logs");
          setLogs([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const filtered = useMemo(() => {
    const out = logs.filter((l) => {
      if (eventFilter !== "all" && l.eventType !== eventFilter) return false;
      if (riskFilter !== "all" && l.riskLevel !== riskFilter) return false;
      if (userQuery) {
        const q = userQuery.toLowerCase();
        if (
          !l.actorName.toLowerCase().includes(q) &&
          !l.actorId.toLowerCase().includes(q) &&
          !l.actorEmail.toLowerCase().includes(q) &&
          !(l.summary || "").toLowerCase().includes(q)
        )
          return false;
      }
      if (dateFrom) {
        if (new Date(l.timestamp) < new Date(dateFrom)) return false;
      }
      if (dateTo) {
        if (new Date(l.timestamp) > new Date(dateTo + "T23:59:59")) return false;
      }
      return true;
    });
    return out;
  }, [logs, eventFilter, riskFilter, userQuery, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const pageLogs = filtered.slice((page - 1) * perPage, page * perPage);

  const stats = useMemo(
    () => ({
      total: logs.length,
      low: logs.filter((l) => l.riskLevel === "low").length,
      medium: logs.filter((l) => l.riskLevel === "medium").length,
      high: logs.filter((l) => l.riskLevel === "high").length,
      critical: logs.filter((l) => l.riskLevel === "critical").length,
    }),
    [logs],
  );

  function download(filename: string, content: string, mime: string) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  const exportCsv = () => {
    const rows = [
      [
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
      ],
      ...filtered.map((l) => [
        l.id,
        l.timestamp,
        l.actorName,
        l.actorEmail,
        l.actorId,
        l.actorRole,
        l.eventType,
        l.targetType,
        l.targetId,
        l.riskLevel,
        (l.summary || "").replace(/"/g, '""'),
      ]),
    ];
    download(
      `raffila-audit-${new Date().toISOString().slice(0, 10)}.csv`,
      rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n"),
      "text/csv",
    );
  };

  const exportJson = () => {
    download(
      `raffila-audit-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(filtered, null, 2),
      "application/json",
    );
  };

  function logsToSheet(logs: AuditLog[]) {
    return logs.map((l) => ({
      Date: lagosDateTime(l.timestamp),
      Actor: l.actorName,
      Email: l.actorEmail,
      ActorID: l.actorId,
      Role: l.actorRole,
      Event: l.eventType,
      Target: l.targetType,
      TargetID: l.targetId,
      Risk: l.riskLevel,
      Summary: l.summary || "",
      Details: Object.keys(l.details || {}).length > 0 ? JSON.stringify(l.details) : "",
    }));
  }

  const exportExcel = async (logs: AuditLog[], filename: string) => {
    // Lazy: write-excel-file only loads when an admin exports a spreadsheet.
    const { default: writeXlsxFile } = await import("write-excel-file/browser");
    const rows = logsToSheet(logs);
    const keys = Object.keys(rows[0] ?? {}) as Array<keyof (typeof rows)[number]>;
    const sheetData = [
      keys.map((key) => ({ value: key as string, fontWeight: true })),
      ...rows.map((row) =>
        keys.map((key) => ({
          value: typeof row[key] === "number" ? row[key] : String(row[key] ?? ""),
        })),
      ),
    ];
    await writeXlsxFile(sheetData, {
      sheet: "Activity",
      columns: [20, 22, 28, 22, 10, 22, 16, 24, 10, 44, 50].map((width) => ({ width })),
    }).toFile(filename);
  };

  // ---- Per-user consolidated history ----
  const [historyActor, setHistoryActor] = useState<{
    actorId: string;
    actorName: string;
    actorEmail: string;
  } | null>(null);
  const [historyLogs, setHistoryLogs] = useState<AuditLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (!historyActor) return;
    let cancelled = false;
    (async () => {
      setHistoryLoading(true);
      try {
        const snap = await getDocs(
          query(
            collection(db, "activityLogs"),
            where("actorId", "==", historyActor.actorId),
            limit(300),
          ),
        );
        if (cancelled) return;
        const rows = snap.docs.map((d) => docToLog(d.id, d.data() as Record<string, unknown>));
        rows.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
        setHistoryLogs(rows);
      } catch {
        if (!cancelled) setHistoryLogs([]);
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [historyActor]);

  const historyGroups = useMemo(() => {
    const groups: Array<{ key: string; label: string; logs: AuditLog[] }> = [];
    const now = Date.now();
    const todayKey = lagosDayKey(now);
    const yesterdayKey = lagosDayKey(now - 86400000);
    for (const l of historyLogs) {
      const dayKey = lagosDayKey(l.timestamp);
      const label =
        dayKey === todayKey
          ? "Today"
          : dayKey === yesterdayKey
            ? "Yesterday"
            : new Date(l.timestamp).toLocaleDateString("en-NG", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
                timeZone: "Africa/Lagos",
              });
      const last = groups[groups.length - 1];
      if (last && last.label === label) last.logs.push(l);
      else groups.push({ key: label, label, logs: [l] });
    }
    return groups;
  }, [historyLogs]);

  return (
    <AdminShell activeNav="audit-logs" title="Audit Logs">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl text-ink">Audit Logs</h1>
            <p className="font-body text-ink/60 text-sm mt-1">
              Immutable event log streamed from Firestore — every user and admin action.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <Badge
              variant="outline"
              className="rounded-full font-body text-emerald-700 border-emerald-300 bg-emerald-50"
            >
              <span className="mr-1.5 inline-block size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live · Firestore
            </Badge>
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => {
                setPage(1);
                setRefreshKey((k) => k + 1);
              }}
            >
              <Activity className="w-4 h-4 mr-2" /> Refresh
            </Button>
            <Button variant="outline" className="rounded-full" onClick={exportCsv}>
              <FileText className="w-4 h-4 mr-2" /> Export CSV
            </Button>
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => {
                void exportExcel(
                  filtered,
                  `raffila-audit-${new Date().toISOString().slice(0, 10)}.xlsx`,
                );
              }}
            >
              <Download className="w-4 h-4 mr-2" /> Export Excel
            </Button>
            <Button variant="outline" className="rounded-full" onClick={exportJson}>
              <FileText className="w-4 h-4 mr-2" /> Export JSON
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <Card className="bg-cream/50 border-ink/10">
            <CardContent className="p-4">
              <p className="text-xs font-body text-ink/50 uppercase tracking-wider">Total events</p>
              <p className="font-display text-2xl text-ink mt-1">{stats.total}</p>
            </CardContent>
          </Card>
          <Card className="bg-mint/10 border-mint/30">
            <CardContent className="p-4">
              <p className="text-xs font-body text-ink/60 uppercase tracking-wider flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Low
              </p>
              <p className="font-display text-2xl text-ink mt-1">{stats.low}</p>
            </CardContent>
          </Card>
          <Card className="bg-lemon/15 border-lemon/40">
            <CardContent className="p-4">
              <p className="text-xs font-body text-ink/60 uppercase tracking-wider flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Medium
              </p>
              <p className="font-display text-2xl text-ink mt-1">{stats.medium}</p>
            </CardContent>
          </Card>
          <Card className="bg-coral/10 border-coral/40">
            <CardContent className="p-4">
              <p className="text-xs font-body text-ink/60 uppercase tracking-wider flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> High
              </p>
              <p className="font-display text-2xl text-ink mt-1">{stats.high}</p>
            </CardContent>
          </Card>
          <Card className="bg-coral/25 border-coral col-span-2 sm:col-span-1">
            <CardContent className="p-4">
              <p className="text-xs font-body text-ink/70 uppercase tracking-wider flex items-center gap-1 font-bold">
                <ShieldAlert className="w-3 h-3" /> CRITICAL
              </p>
              <p className="font-display text-2xl text-coral mt-1">{stats.critical}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-ink text-lg">Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="space-y-1.5">
                <Label className="font-body text-xs text-ink/60 uppercase tracking-wider">
                  Actor / summary search
                </Label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink/40" />
                  <Input
                    className="pl-9 rounded-full"
                    placeholder="Name, email, ID, action…"
                    value={userQuery}
                    onChange={(e) => setUserQuery(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="font-body text-xs text-ink/60 uppercase tracking-wider">
                  Event type
                </Label>
                <Select
                  value={eventFilter}
                  onValueChange={(v) => setEventFilter(v as EventType | "all")}
                >
                  <SelectTrigger className="rounded-full">
                    <SelectValue placeholder="All events" />
                  </SelectTrigger>
                  <SelectContent className="max-h-80">
                    <SelectItem value="all">All event types ({EVENT_TYPES.length})</SelectItem>
                    {EVENT_TYPES.map((e) => (
                      <SelectItem key={e} value={e} className="font-mono text-xs">
                        {e.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="font-body text-xs text-ink/60 uppercase tracking-wider">
                  Risk level
                </Label>
                <Select
                  value={riskFilter}
                  onValueChange={(v) => setRiskFilter(v as RiskLevel | "all")}
                >
                  <SelectTrigger className="rounded-full">
                    <SelectValue placeholder="All risks" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All risk levels</SelectItem>
                    {RISK_LEVELS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r === "critical" ? "CRITICAL" : r[0]!.toUpperCase() + r.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="font-body text-xs text-ink/60 uppercase tracking-wider flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> From
                </Label>
                <Input
                  type="date"
                  className="rounded-full"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="font-body text-xs text-ink/60 uppercase tracking-wider flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> To
                </Label>
                <Input
                  type="date"
                  className="rounded-full"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4 flex-wrap">
              <Button
                variant="ghost"
                className="rounded-full"
                onClick={() => {
                  setEventFilter("all");
                  setRiskFilter("all");
                  setUserQuery("");
                  setDateFrom("");
                  setDateTo("");
                  setPage(1);
                }}
              >
                Reset filters
              </Button>
              <Badge variant="outline" className="font-body">
                {filtered.length} results
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead
                      className="font-body text-xs uppercase text-ink/50"
                      title="West Africa Time (GMT+1)"
                    >
                      Timestamp · GMT+1
                    </TableHead>
                    <TableHead className="font-body text-xs uppercase text-ink/50">Actor</TableHead>
                    <TableHead className="font-body text-xs uppercase text-ink/50">Event</TableHead>
                    <TableHead className="font-body text-xs uppercase text-ink/50">
                      Target
                    </TableHead>
                    <TableHead className="font-body text-xs uppercase text-ink/50">Delta</TableHead>
                    <TableHead className="font-body text-xs uppercase text-ink/50">Risk</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-12 text-center">
                        <div className="flex flex-col items-center gap-2 text-ink/50">
                          <Activity className="w-6 h-6 animate-pulse" />
                          <p className="font-body text-sm">Loading activity from Firestore…</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : loadError ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-12 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <AlertTriangle className="w-6 h-6 text-coral" />
                          <p className="font-body text-sm text-ink">{loadError}</p>
                          <p className="font-body text-xs text-ink/50">
                            Publish the updated firestore.rules, then refresh.
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : pageLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-12 text-center">
                        <div className="flex flex-col items-center gap-2 text-ink/50">
                          <Shield className="w-6 h-6" />
                          <p className="font-body text-sm font-semibold text-ink">
                            No activity yet
                          </p>
                          <p className="font-body text-xs">
                            Actions across the app will appear here as users and admins use Raffila.
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    pageLogs.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="font-body text-sm whitespace-nowrap">
                          <div className="text-ink">
                            {lagosDateShort(l.timestamp)}, {lagosTime(l.timestamp)}{" "}
                            <span className="text-[10px] font-bold text-ink/40">GMT+1</span>
                          </div>
                          <div className="text-ink/40 text-[11px]">{l.id}</div>
                        </TableCell>
                        <TableCell>
                          <button
                            type="button"
                            className="text-left group"
                            title="View full history for this user"
                            onClick={() =>
                              setHistoryActor({
                                actorId: l.actorId,
                                actorName: l.actorName,
                                actorEmail: l.actorEmail,
                              })
                            }
                          >
                            <div className="font-body text-sm text-ink underline-offset-2 group-hover:underline group-hover:text-coral">
                              {l.actorName}
                            </div>
                            <div className="text-[11px] text-ink/40 font-mono truncate max-w-[220px]">
                              {l.actorEmail || l.actorId}
                            </div>
                          </button>
                        </TableCell>
                        <TableCell>{eventBadge(l.eventType)}</TableCell>
                        <TableCell>
                          <div className="text-xs font-body text-ink/70">{l.targetType}</div>
                          <div className="font-mono text-[11px] text-ink">{l.targetId}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-[11px]">
                            {l.oldValue ? (
                              <>
                                <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-mono">
                                  -old
                                </span>
                                <ChevronRight className="w-3 h-3 text-ink/30" />
                                <span className="px-1.5 py-0.5 rounded bg-mint/30 text-ink font-mono">
                                  +new
                                </span>
                              </>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-ink/5 text-ink/50 font-mono">
                                CREATE
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{riskBadge(l.riskLevel)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="rounded-full"
                              onClick={() => setDiffLog(l)}
                            >
                              <Eye className="w-3.5 h-3.5 mr-1" /> Diff
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="rounded-full"
                              title="Full history for this user"
                              onClick={() =>
                                setHistoryActor({
                                  actorId: l.actorId,
                                  actorName: l.actorName,
                                  actorEmail: l.actorEmail,
                                })
                              }
                            >
                              <History className="w-3.5 h-3.5 mr-1" /> History
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="p-4 flex items-center justify-between border-t border-ink/10">
              <p className="font-body text-xs text-ink/50">
                Showing {(page - 1) * perPage + 1}–{Math.min(page * perPage, filtered.length)} of{" "}
                {filtered.length}
              </p>
              <Pagination className="justify-end m-0 w-auto">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      size="sm"
                      onClick={(e) => {
                        e.preventDefault();
                        if (page > 1) setPage(page - 1);
                      }}
                      className={page <= 1 ? "pointer-events-none opacity-40" : ""}
                    />
                  </PaginationItem>
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <PaginationItem key={i}>
                      <PaginationLink
                        href="#"
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault();
                          setPage(i + 1);
                        }}
                        isActive={page === i + 1}
                      >
                        {i + 1}
                      </PaginationLink>
                    </PaginationItem>
                  ))}
                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      size="sm"
                      onClick={(e) => {
                        e.preventDefault();
                        if (page < totalPages) setPage(page + 1);
                      }}
                      className={page >= totalPages ? "pointer-events-none opacity-40" : ""}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!diffLog} onOpenChange={(o) => !o && setDiffLog(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-ink flex items-center gap-2">
              <Shield className="w-5 h-5 text-coral" /> Event diff — {diffLog?.id}
            </DialogTitle>
            <DialogDescription className="font-body">
              {diffLog && (
                <>
                  <span className="font-mono text-ink">{diffLog.eventType}</span> by{" "}
                  <span className="text-ink font-semibold">{diffLog.actorName}</span> ·{" "}
                  {lagosDateTime(diffLog.timestamp)}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {diffLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs font-body">
                <div className="p-3 rounded-xl bg-cream/60">
                  <p className="text-ink/50 uppercase tracking-wider mb-1">Actor</p>
                  <p className="text-ink font-semibold">{diffLog.actorName}</p>
                  <p className="font-mono text-ink/60 break-all">{diffLog.actorEmail}</p>
                  <p className="font-mono text-ink/60 break-all">{diffLog.actorId}</p>
                  <p className="mt-1 inline-block rounded-full bg-ink/10 px-2 py-0.5 text-[10px] font-extrabold uppercase">
                    {diffLog.actorRole || "unknown"}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-cream/60">
                  <p className="text-ink/50 uppercase tracking-wider mb-1">Target</p>
                  <p className="text-ink font-mono">{diffLog.targetType || "—"}</p>
                  <p className="text-ink font-mono font-semibold break-all">
                    {diffLog.targetId || "—"}
                  </p>
                  <div className="mt-1">{riskBadge(diffLog.riskLevel)}</div>
                </div>
              </div>
              {(diffLog.summary || Object.keys(diffLog.details || {}).length > 0) && (
                <div className="p-3 rounded-xl bg-cream/60 text-xs font-body">
                  <p className="text-ink/50 uppercase tracking-wider mb-1">Summary</p>
                  {diffLog.summary && <p className="text-ink font-semibold">{diffLog.summary}</p>}
                  {Object.keys(diffLog.details || {}).length > 0 && (
                    <pre className="mt-2 bg-ink text-cream p-3 rounded-xl text-[11px] overflow-x-auto font-mono leading-relaxed">
                      {JSON.stringify(diffLog.details, null, 2)}
                    </pre>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge
                      variant="outline"
                      className="bg-red-100 text-red-700 border-red-200 rounded-full text-[10px]"
                    >
                      <ChevronLeft className="w-3 h-3 mr-1" /> OLD VALUE
                    </Badge>
                  </div>
                  <pre className="bg-ink text-cream p-4 rounded-xl text-[11px] overflow-x-auto font-mono leading-relaxed">
                    {JSON.stringify(diffLog.oldValue ?? null, null, 2)}
                  </pre>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge
                      variant="outline"
                      className="bg-mint/30 text-ink border-mint rounded-full text-[10px]"
                    >
                      NEW VALUE <ChevronRight className="w-3 h-3 ml-1" />
                    </Badge>
                  </div>
                  <pre className="bg-ink text-cream p-4 rounded-xl text-[11px] overflow-x-auto font-mono leading-relaxed">
                    {JSON.stringify(diffLog.newValue ?? null, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" className="rounded-full" onClick={() => setDiffLog(null)}>
              Close
            </Button>
            <Button className="rounded-full">
              <Edit3 className="w-4 h-4 mr-2" /> Escalate to review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!historyActor} onOpenChange={(o) => !o && setHistoryActor(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-ink flex items-center gap-2">
              <History className="w-5 h-5 text-coral" /> {historyActor?.actorName} — full history
            </DialogTitle>
            <DialogDescription className="font-body">
              Every recorded activity for{" "}
              <span className="font-mono text-ink">{historyActor?.actorEmail}</span> · newest first
              · {historyLogs.length} event{historyLogs.length === 1 ? "" : "s"}
            </DialogDescription>
          </DialogHeader>
          {historyLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm font-bold text-ink/55">
              <Activity className="w-5 h-5 animate-pulse" /> Loading history…
            </div>
          ) : historyLogs.length === 0 ? (
            <p className="py-10 text-center text-sm font-bold text-ink/55">
              No activity recorded for this user yet.
            </p>
          ) : (
            <div className="space-y-5">
              {historyGroups.map((g) => (
                <div key={g.key}>
                  <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink/45">
                    {g.label}
                  </p>
                  <ul className="space-y-2">
                    {g.logs.map((l) => (
                      <li
                        key={l.id}
                        className="flex flex-wrap items-center gap-2 rounded-2xl bg-cream/50 px-3.5 py-2.5 ring-1 ring-ink/5"
                      >
                        <span className="font-mono text-[11px] font-bold text-ink/55 whitespace-nowrap">
                          {lagosTime(l.timestamp)} <span className="text-ink/40">GMT+1</span>
                        </span>
                        {eventBadge(l.eventType)}
                        <span className="min-w-0 flex-1 text-xs font-bold text-ink/75">
                          {l.summary || l.targetType || "—"}
                        </span>
                        {riskBadge(l.riskLevel)}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => setHistoryActor(null)}
            >
              Close
            </Button>
            <Button
              variant="primary"
              className="rounded-full"
              disabled={historyLogs.length === 0}
              onClick={() => {
                if (historyActor) {
                  void exportExcel(
                    historyLogs,
                    `raffila-${historyActor.actorName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-history-${new Date().toISOString().slice(0, 10)}.xlsx`,
                  );
                }
              }}
            >
              <Download className="w-4 h-4 mr-2" /> Download Excel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}

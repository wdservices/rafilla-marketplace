import { useCallback, useEffect, useState } from "react";
import {
  Download,
  CalendarDays,
  FileSpreadsheet,
  FileJson,
  BarChart3,
  Users,
  DollarSign,
  Trophy,
  Banknote,
  UsersRound,
  ClipboardList,
  TrendingUp,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { collection, doc, getDoc, getDocs, limit, query } from "firebase/firestore";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { AdminShell } from "@/components/raffila/admin/admin-shell";
import { db } from "@/lib/firebase";
import {
  buildReportTable,
  emptyReportSource,
  exportReportTable,
  type ExportFormat,
  type RawDoc,
  type ReportKey,
  type ReportSource,
} from "@/lib/report-export";
import { cn, formatNaira } from "@/lib/utils";

interface ExportDef {
  key: ReportKey;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "ink" | "coral" | "sky" | "mint" | "lemon" | "lilac";
  formats: ExportFormat[];
  lastRun: string;
}

const toneBg: Record<ExportDef["tone"], string> = {
  ink: "bg-ink/8",
  coral: "bg-coral/15",
  sky: "bg-sky/20",
  mint: "bg-mint/25",
  lemon: "bg-lemon/30",
  lilac: "bg-lilac/25",
};

const toneIcon: Record<ExportDef["tone"], string> = {
  ink: "text-ink",
  coral: "text-coral",
  sky: "text-ink",
  mint: "text-ink",
  lemon: "text-ink",
  lilac: "text-ink",
};

const EXPORT_CARDS: ExportDef[] = [
  {
    key: "users",
    label: "Users report",
    description: "Account sign-ups, verification, role, and status snapshots.",
    icon: Users,
    tone: "sky",
    formats: ["csv", "xlsx"],
    lastRun: "Not yet exported",
  },
  {
    key: "revenue",
    label: "Revenue report",
    description: "Entry revenue, fees, reward pool, partner split breakdown.",
    icon: DollarSign,
    tone: "ink",
    formats: ["csv", "xlsx"],
    lastRun: "Not yet exported",
  },
  {
    key: "competitions",
    label: "Competitions summary",
    description: "Campaign lifecycle, partner, entries, dates, winner details.",
    icon: Trophy,
    tone: "coral",
    formats: ["csv"],
    lastRun: "Not yet exported",
  },
  {
    key: "payouts",
    label: "Payouts",
    description: "All request statuses, banks, size bands, risk-score distribution.",
    icon: Banknote,
    tone: "lilac",
    formats: ["csv", "xlsx"],
    lastRun: "Not yet exported",
  },
  {
    key: "referrals",
    label: "Referral tree",
    description: "All 5 levels · earned, unpaid, paid, clawbacks with lineage.",
    icon: UsersRound,
    tone: "lemon",
    formats: ["csv"],
    lastRun: "Not yet exported",
  },
  {
    key: "audit",
    label: "Full audit JSON",
    description: "Complete immutable audit log export · structured JSON with row metadata.",
    icon: ClipboardList,
    tone: "mint",
    formats: ["json"],
    lastRun: "Not yet exported",
  },
];

function BarChart({ data, color, label }: { data: number[]; color: string; label: string }) {
  const w = 500;
  const h = 180;
  const pad = 22;
  const max = Math.max(...data) * 1.15;
  const bw = ((w - pad * 2) / data.length) * 0.65;
  const gap = ((w - pad * 2) / data.length) * 0.35;
  const gridOklch = "oklch(0.95 0.01 255)";
  const labelOklch = "oklch(0.5 0.04 257)";
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return (
    <div>
      <p className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.12em] text-ink/45">
        {label}
      </p>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-[180px] w-full">
        <defs>
          <pattern id={`bg-${color}`} width="42" height="26" patternUnits="userSpaceOnUse">
            <path d={`M 42 0 L 0 0 0 26`} fill="none" stroke={gridOklch} strokeWidth="1" />
          </pattern>
        </defs>
        <rect
          x={pad}
          y={pad}
          width={w - pad * 2}
          height={h - pad * 2}
          fill={`url(#bg-${color})`}
          rx="10"
        />
        {data.map((v, i) => {
          const x = pad + i * (bw + gap) + gap / 2;
          const bh = (v / max) * (h - pad * 2);
          const y = h - pad - bh;
          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={bw}
              height={bh}
              rx={bw / 2 > 8 ? 8 : bw / 2}
              fill={color}
              opacity={i === data.length - 1 ? 1 : 0.82}
            />
          );
        })}
        {[0, Math.floor(data.length / 2), data.length - 1].map((i) => (
          <text
            key={i}
            x={pad + i * (bw + gap) + gap / 2 + bw / 2}
            y={h - 6}
            fontSize="9"
            fill={labelOklch}
            fontWeight="700"
            textAnchor="middle"
          >
            {months[i % 12]}
          </text>
        ))}
      </svg>
    </div>
  );
}

function HBarChart({
  items,
  color,
}: {
  items: Array<{ name: string; val: number }>;
  color: string;
}) {
  const max = Math.max(...items.map((i) => i.val));
  const gridOklch = "oklch(0.95 0.01 255)";
  return (
    <div className="space-y-4">
      {items.map((it) => {
        const pct = Math.round((it.val / max) * 100);
        return (
          <div key={it.name}>
            <div className="flex items-center justify-between gap-3">
              <p className="truncate text-sm font-extrabold text-ink">{it.name}</p>
              <span className="text-[11px] font-extrabold text-ink/65 shrink-0">
                {it.val.toLocaleString("en-NG")}
              </span>
            </div>
            <div
              className="mt-1.5 h-3 overflow-hidden rounded-full"
              style={{ backgroundColor: gridOklch }}
            >
              <div
                className="h-full rounded-full"
                style={{ width: `${pct}%`, backgroundColor: color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function AdminReportsPage() {
  const [granularity, setGranularity] = useState("day");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [source, setSource] = useState<ReportSource>(emptyReportSource);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [busyKey, setBusyKey] = useState<ReportKey | null>(null);
  const [lastRuns, setLastRuns] = useState<Record<string, string>>(() =>
    Object.fromEntries(EXPORT_CARDS.map((c) => [c.key, c.lastRun])),
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const [usersSnap, compsSnap, payoutsSnap, logsSnap, configSnap] = await Promise.all([
          getDocs(query(collection(db, "users"), limit(300))),
          getDocs(query(collection(db, "competitions"), limit(100))),
          getDocs(query(collection(db, "payouts"), limit(200))),
          getDocs(query(collection(db, "activityLogs"), limit(500))),
          getDoc(doc(db, "platformSettings", "raffila_config")),
        ]);
        if (cancelled) return;

        const toRaw = (snap: typeof usersSnap): RawDoc[] =>
          snap.docs.map((d) => ({ id: d.id, data: d.data() as Record<string, unknown> }));
        const users = toRaw(usersSnap);

        // referralCommissions is a per-user subcollection, so only users that
        // actually earned a commission are worth a round-trip.
        const earners = users
          .filter((u) => Number(u.data["referralEarnedTotalKobo"] ?? 0) > 0)
          .slice(0, 120);
        const commissionSnaps = await Promise.all(
          earners.map((u) =>
            getDocs(query(collection(db, "users", u.id, "referralCommissions"), limit(200))),
          ),
        );
        if (cancelled) return;

        const commissions: RawDoc[] = [];
        commissionSnaps.forEach((snap, i) => {
          const ownerId = earners[i]!.id;
          snap.docs.forEach((d) =>
            commissions.push({
              id: d.id,
              data: { ...(d.data() as Record<string, unknown>), beneficiaryId: ownerId },
            }),
          );
        });

        const config = (configSnap.data() ?? {}) as Record<string, unknown>;
        const pool = (config["rewardPool"] ?? {}) as Record<string, unknown>;

        setSource({
          users,
          competitions: toRaw(compsSnap),
          payouts: toRaw(payoutsSnap),
          commissions,
          logs: toRaw(logsSnap),
          rewardPoolPct: Number(pool["contributionPct"] ?? 0) || 0,
        });
      } catch (err) {
        if (!cancelled) {
          setLoadError((err as { message?: string })?.message || String(err));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const runReport = useCallback(
    async (r: ExportDef, fmt: ExportFormat) => {
      if (busyKey) return;
      setBusyKey(r.key);
      try {
        const report = buildReportTable(r.key, source, { from: dateFrom, to: dateTo });
        if (!report.rows.length) {
          toast.error(`${r.label} is empty`, {
            description: "No rows fall inside the selected date range. Widen it and retry.",
          });
          return;
        }
        const { filename, bytes } = await exportReportTable(report, fmt);
        setLastRuns((prev) => ({ ...prev, [r.key]: "Just now" }));
        toast.success(`${filename} downloaded`, {
          description: `${report.rows.length.toLocaleString("en-NG")} rows · ${(bytes / 1024).toFixed(0)} KB`,
        });
      } catch (err) {
        toast.error(`${r.label} export failed`, {
          description: (err as { message?: string })?.message || String(err),
        });
      } finally {
        setBusyKey(null);
      }
    },
    [source, dateFrom, dateTo, busyKey],
  );

  const revenueByMonth = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const ticketsByCat = [
    { name: "Auto", val: 0 },
    { name: "Tech", val: 0 },
    { name: "Property", val: 0 },
    { name: "Jewelry", val: 0 },
    { name: "Home", val: 0 },
    { name: "Experience", val: 0 },
  ];
  const topCompetitions = [
    { name: "Mercedes C-Class 2025", val: 0 },
    { name: "Nova X1 Tech Bundle", val: 0 },
    { name: "Lagos 2-Bed Apt", val: 0 },
    { name: "Ikeja Home Studio", val: 0 },
    { name: "Abuja Generator Pack", val: 0 },
    { name: "PH Laptop Suite", val: 0 },
  ];

  return (
    <AdminShell activeNav="reports" title="Reports">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-coral">
            Admin · Reports
          </p>
          <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">
            Reports
          </h1>
          <p className="mt-2 max-w-2xl text-base font-bold text-ink/60">
            Export data snapshots for finance, audit, and operations. Money stored as integer kobo;
            exports show formatted Naira.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-full bg-white ring-1 ring-ink/10 px-3.5 py-2 text-xs font-bold text-ink/65">
            <CalendarDays className="size-3.5" />
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              placeholder="From"
              aria-label="Report start date"
              className="h-7 w-32 border-0 bg-transparent p-0 font-bold text-ink shadow-none focus-visible:ring-0 [&::-webkit-calendar-picker-indicator]:opacity-50"
            />
            <span>→</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              placeholder="To"
              aria-label="Report end date"
              className="h-7 w-32 border-0 bg-transparent p-0 font-bold text-ink shadow-none focus-visible:ring-0 [&::-webkit-calendar-picker-indicator]:opacity-50"
            />
            {(dateFrom || dateTo) && (
              <button
                type="button"
                onClick={() => {
                  setDateFrom("");
                  setDateTo("");
                }}
                className="rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-coral hover:bg-coral/10"
              >
                Clear
              </button>
            )}
          </div>
          <Select value={granularity} onValueChange={setGranularity}>
            <SelectTrigger className="h-10 w-40 rounded-full bg-white ring-1 ring-ink/10 px-4 text-xs font-extrabold text-ink shadow-none focus:ring-coral">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-[22px] bg-white p-1.5 ring-1 ring-ink/10">
              <SelectItem value="hour" className="rounded-xl font-bold">
                By hour
              </SelectItem>
              <SelectItem value="day" className="rounded-xl font-bold">
                By day
              </SelectItem>
              <SelectItem value="week" className="rounded-xl font-bold">
                By week
              </SelectItem>
              <SelectItem value="month" className="rounded-xl font-bold">
                By month
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </header>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-bold text-ink/55">
          {loading
            ? "Loading report data from Firestore…"
            : loadError
              ? `Could not load report data · ${loadError}`
              : `${source.users.length.toLocaleString("en-NG")} users · ${source.competitions.length.toLocaleString("en-NG")} competitions · ${source.payouts.length.toLocaleString("en-NG")} payouts · ${source.commissions.length.toLocaleString("en-NG")} commissions`}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setRefreshKey((k) => k + 1)}
          disabled={loading}
          className="rounded-full h-8 px-4 text-xs font-bold"
        >
          <RefreshCw className={cn("size-3.5 mr-1.5", loading && "animate-spin")} /> Refresh data
        </Button>
      </div>

      <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {EXPORT_CARDS.map((r) => (
          <Card
            key={r.key}
            className="group rounded-[24px] border-0 bg-white p-0 ring-1 ring-ink/8 shadow-sm"
          >
            <CardContent className="flex h-full flex-col p-6">
              <div className="flex items-start justify-between gap-3">
                <div className={cn("grid size-12 place-items-center rounded-2xl", toneBg[r.tone])}>
                  <r.icon className={cn("size-5", toneIcon[r.tone])} />
                </div>
                <Badge className="rounded-full bg-cream px-2.5 py-1 text-[10px] font-extrabold text-ink/60 ring-1 ring-ink/10">
                  {lastRuns[r.key]}
                </Badge>
              </div>
              <h3 className="mt-4 font-display text-xl font-extrabold text-ink">{r.label}</h3>
              <p className="mt-2 min-h-[3.25rem] text-sm font-bold leading-relaxed text-ink/60">
                {r.description}
              </p>
              <div className="mt-5 flex flex-wrap gap-2 pt-2">
                {r.formats.map((fmt) => {
                  const busy = busyKey === r.key;
                  return (
                    <Button
                      key={fmt}
                      variant={fmt === "csv" ? "primary" : "outline"}
                      size="sm"
                      onClick={() => void runReport(r, fmt)}
                      disabled={busy || loading || !!loadError}
                      className="rounded-full h-9 px-4"
                      aria-label={`Download ${r.label} as ${fmt.toUpperCase()}`}
                    >
                      {busy ? (
                        <RefreshCw className="size-3.5 mr-1.5 animate-spin" />
                      ) : fmt === "xlsx" ? (
                        <FileSpreadsheet className="size-3.5 mr-1.5" />
                      ) : fmt === "json" ? (
                        <FileJson className="size-3.5 mr-1.5" />
                      ) : (
                        <Download className="size-3.5 mr-1.5" />
                      )}
                      {fmt.toUpperCase()}
                    </Button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <Separator className="my-8 bg-ink/8" />

      <section>
        <div className="mb-5 flex items-end justify-between">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-ink/45">
              Preview charts
            </p>
            <h3 className="mt-1 font-display text-2xl font-extrabold text-ink">Data at a glance</h3>
          </div>
          <Badge className="rounded-full bg-lilac/25 px-3 py-1 text-[10px] font-extrabold text-ink ring-0">
            <BarChart3 className="mr-1 size-3" /> Rolling MTD
          </Badge>
        </div>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
          <Card className="rounded-[24px] border-0 bg-white p-0 ring-1 ring-ink/8 shadow-sm">
            <CardContent className="p-6">
              <BarChart
                data={revenueByMonth}
                color="oklch(0.52 0.12 150)"
                label="Revenue by month (₦M)"
              />
            </CardContent>
          </Card>
          <Card className="rounded-[24px] border-0 bg-white p-0 ring-1 ring-ink/8 shadow-sm">
            <CardContent className="p-6">
              <p className="mb-5 text-[11px] font-extrabold uppercase tracking-[0.12em] text-ink/45">
                Tickets by category
              </p>
              <HBarChart items={ticketsByCat} color="oklch(0.58 0.12 250)" />
            </CardContent>
          </Card>
          <Card className="rounded-[24px] border-0 bg-white p-0 ring-1 ring-ink/8 shadow-sm">
            <CardContent className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-ink/45">
                  Top competitions · revenue
                </p>
                <TrendingUp className="size-4 text-coral" />
              </div>
              <div className="space-y-2.5">
                {topCompetitions.map((c, idx) => (
                  <div
                    key={c.name}
                    className="flex items-center gap-3 rounded-2xl bg-cream/60 px-3.5 py-2.5"
                  >
                    <span className="text-[11px] font-extrabold text-ink/45 w-5 shrink-0">
                      #{idx + 1}
                    </span>
                    <Trophy className="size-3.5 shrink-0 text-coral" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-extrabold text-ink">{c.name}</p>
                    </div>
                    <span className="text-[11px] font-extrabold text-ink/70 whitespace-nowrap">
                      {formatNaira(c.val)}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </AdminShell>
  );
}

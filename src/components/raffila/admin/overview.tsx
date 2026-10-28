import { useEffect, useMemo, useState } from "react";
import { lagosChartLabels, lagosDateShort } from "@/lib/format";
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { fetchAllEntries } from "@/lib/admin-entries";
import {
  Users,
  Trophy,
  Ticket,
  DollarSign,
  Banknote,
  Gift,
  TrendingUp,
  UserPlus,
  Clock,
  Eye,
  PlayCircle,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AdminShell } from "@/components/raffila/admin/admin-shell";
import { cn, formatNaira } from "@/lib/utils";
import { db } from "@/lib/firebase";

interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  delta?: string;
  deltaPositive?: boolean;
  icon: React.ComponentType<{ className?: string }>;
  tone: "ink" | "sky" | "mint" | "coral" | "lemon" | "lilac";
}

const toneBg: Record<KpiCardProps["tone"], string> = {
  ink: "bg-ink/5",
  sky: "bg-sky/25",
  mint: "bg-mint/30",
  coral: "bg-coral/18",
  lemon: "bg-lemon/35",
  lilac: "bg-lilac/30",
};

const toneIcon: Record<KpiCardProps["tone"], string> = {
  ink: "text-ink",
  sky: "text-ink",
  mint: "text-ink",
  coral: "text-coral",
  lemon: "text-ink",
  lilac: "text-ink",
};

function KpiCard({ label, value, sub, delta, deltaPositive, icon: Icon, tone }: KpiCardProps) {
  return (
    <Card className="rounded-[28px] border-0 bg-paper p-0 ring-1 ring-ink/5 shadow-none">
      <CardContent className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-ink/45">
              {label}
            </p>
            <p className="mt-2 font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
              {value}
            </p>
            {sub && <p className="mt-1 text-sm font-bold text-ink/55">{sub}</p>}
            {delta && (
              <div
                className={cn(
                  "mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold",
                  deltaPositive ? "bg-mint/30 text-ink" : "bg-coral/20 text-ink",
                )}
              >
                {deltaPositive ? (
                  <TrendingUp className="size-3" />
                ) : (
                  <TrendingUp className="size-3 rotate-180" />
                )}
                {delta}
              </div>
            )}
          </div>
          <div
            className={cn(
              "grid size-12 shrink-0 place-items-center rounded-2xl sm:size-14",
              toneBg[tone],
            )}
          >
            <Icon className={cn("size-5 sm:size-6", toneIcon[tone])} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DualChartBars({ tickets, revenueBase }: { tickets: number[]; revenueBase: number[] }) {
  const days = 14;
  const w = 720;
  const h = 240;
  const pad = 28;
  const t = Array.from({ length: days }, (_, i) => tickets[i] ?? 0);
  const r = Array.from({ length: days }, (_, i) => revenueBase[i] ?? 0);
  const maxT = Math.max(1, ...t) * 1.15;
  const maxR = Math.max(1, ...r) * 1.15;
  const barArea = w - pad * 2;
  const bw = (barArea / days) * 0.38;
  const gap = (barArea / days) * 0.62;
  const toYT = (v: number) => h - pad - (v / maxT) * (h - pad * 2);
  const toYR = (v: number) => h - pad - (v / maxR) * (h - pad * 2);
  const labels = lagosChartLabels(days);
  const coralOklch = "oklch(0.75 0.14 35)";
  const skyOklch = "oklch(0.76 0.12 255)";
  const gridOklch = "oklch(0.929 0.013 255.508)";
  const labelOklch = "oklch(0.554 0.046 257.417)";

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-[240px] w-full">
      <defs>
        <pattern id="agrid" width="60" height="32" patternUnits="userSpaceOnUse">
          <path d={`M 60 0 L 0 0 0 32`} fill="none" stroke={gridOklch} strokeWidth="1" />
        </pattern>
      </defs>
      <rect x={pad} y={pad} width={w - pad * 2} height={h - pad * 2} fill="url(#agrid)" rx="12" />
      {t.map((v, i) => {
        const x = pad + i * (bw + gap) + gap / 2;
        const bh = (v / maxT) * (h - pad * 2);
        const y = h - pad - bh;
        return (
          <rect
            key={`t${i}`}
            x={x}
            y={y}
            width={bw}
            height={bh}
            rx={bw / 2}
            fill={coralOklch}
            opacity="0.85"
          />
        );
      })}
      {r.map((v, i) => {
        const x = pad + i * (bw + gap) + gap / 2 + bw;
        const bh = (v / maxR) * (h - pad * 2);
        const y = h - pad - bh;
        return (
          <rect
            key={`r${i}`}
            x={x}
            y={y}
            width={bw}
            height={bh}
            rx={bw / 2}
            fill={skyOklch}
            opacity="0.75"
          />
        );
      })}
      {[0, 3, 6, 9, 13].map((i) => (
        <text
          key={i}
          x={pad + i * (bw + gap) + gap / 2 + bw}
          y={h - 8}
          fontSize="9"
          fill={labelOklch}
          fontWeight="700"
          textAnchor="middle"
        >
          {labels[i]}
        </text>
      ))}
      <circle
        cx={pad + 13 * (bw + gap) + gap / 2 + bw / 2}
        cy={toYT(t[13]!)}
        r="3.5"
        fill={coralOklch}
      />
      <circle
        cx={pad + 13 * (bw + gap) + gap / 2 + bw + bw / 2}
        cy={toYR(r[13]!)}
        r="3.5"
        fill={skyOklch}
      />
    </svg>
  );
}

interface RegistrationRow {
  id: string;
  name: string;
  email: string;
  initials: string;
  tint: "coral" | "sky" | "mint" | "lemon" | "lilac";
  date: string;
  verified: boolean;
}

const tintBg: Record<string, string> = {
  sky: "bg-sky/30 text-ink",
  mint: "bg-mint/35 text-ink",
  coral: "bg-coral/20 text-coral",
  lemon: "bg-lemon/40 text-ink",
  lilac: "bg-lilac/35 text-ink",
  ink: "bg-ink/10 text-ink",
};

const REG_TINTS: RegistrationRow["tint"][] = ["coral", "sky", "mint", "lemon", "lilac"];

interface PayoutRow {
  id: string;
  user: string;
  initials: string;
  tint: "lemon" | "sky" | "mint" | "coral" | "lilac";
  amount: number;
}

type CompStatus = "DRAFT" | "SCHEDULED" | "LIVE" | "DRAWING" | "RESULTED" | "CLOSED" | "COMPLETED";

function toMs(value: unknown): number {
  try {
    const v = value as any;
    if (v && typeof v.toDate === "function") return (v.toDate() as Date).getTime();
  } catch {
    // ignore
  }
  if (typeof value === "string" && value) {
    const t = new Date(value).getTime();
    return Number.isNaN(t) ? 0 : t;
  }
  if (typeof value === "number") return value;
  return 0;
}

function initialsOfName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.slice(0, 1) ?? "") + (parts[1]?.slice(0, 1) ?? "")).toUpperCase() || "U";
}

function mapCompStatus(raw: unknown): CompStatus {
  const s = String(raw ?? "").toUpperCase();
  const known: CompStatus[] = [
    "DRAFT",
    "SCHEDULED",
    "LIVE",
    "DRAWING",
    "RESULTED",
    "CLOSED",
    "COMPLETED",
  ];
  if ((known as string[]).includes(s)) return s as CompStatus;
  if (s === "ENDED") return "CLOSED";
  return "SCHEDULED";
}

/** Revenue-shaped view of one purchase, for the breakdown panel. */
type EntryRevenueFact = {
  competitionSlug: string;
  competitionTitle: string;
  quantity: number;
  amountKobo: number;
  isReferral: boolean;
  createdAtMs: number;
};

type CompFact = {
  slug: string;
  title: string;
  entriesSold: number;
  totalEntries: number;
  entryPriceKobo: number;
};

/**
 * Per-competition revenue. The overall REVENUE card answers "how much did we
 * take"; this answers "which competition took it". Sums are derived from the
 * entry records rather than a stored counter so they can never drift from the
 * purchases they represent.
 */
/**
 * Per-competition totals derived from entry records.
 *
 * Exported (and unit-tested) because getting this wrong silently understates
 * revenue: tickets and revenue must accumulate into the SAME bucket, or an
 * early write is clobbered by a later one holding a stale snapshot.
 */
export function buildCompetitionRows(
  entries: EntryRevenueFact[],
  competitions: CompFact[],
): Array<CompFact & { tickets: number; revenueKobo: number }> {
  const bySlug = new Map<string, { tickets: number; revenueKobo: number }>();
  for (const e of entries) {
    const slug = e.competitionSlug || "unknown";
    // One read, one mutation, one write — no interleaved helpers.
    const cur = bySlug.get(slug) ?? { tickets: 0, revenueKobo: 0 };
    cur.tickets += e.quantity;
    // Referral orders are paid from referral balance, not cash.
    if (!e.isReferral) cur.revenueKobo += e.amountKobo;
    bySlug.set(slug, cur);
  }
  return competitions
    .map((c) => {
      const acc = bySlug.get(c.slug);
      return {
        ...c,
        tickets: acc?.tickets ?? 0,
        revenueKobo: acc?.revenueKobo ?? 0,
      };
    })
    .sort((a, b) => b.revenueKobo - a.revenueKobo || b.tickets - a.tickets);
}

function CompetitionRevenue({
  entries,
  competitions,
}: {
  entries: EntryRevenueFact[];
  competitions: CompFact[];
}) {
  const [selected, setSelected] = useState<string>("all");

  const rows = useMemo(() => buildCompetitionRows(entries, competitions), [entries, competitions]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => ({
          tickets: acc.tickets + r.tickets,
          revenueKobo: acc.revenueKobo + r.revenueKobo,
        }),
        { tickets: 0, revenueKobo: 0 },
      ),
    [rows],
  );

  const focus = selected === "all" ? null : (rows.find((r) => r.slug === selected) ?? null);
  const shownTickets = focus ? focus.tickets : totals.tickets;
  const shownRevenue = focus ? focus.revenueKobo : totals.revenueKobo;
  const shownEntries = focus?.totalEntries ?? 0;
  const shownSold = focus?.entriesSold ?? 0;

  return (
    <section className="mt-6">
      <Card className="rounded-[28px] border-0 bg-paper p-0 ring-1 ring-ink/5 shadow-none">
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-ink/45">
                Revenue by competition
              </p>
              <h3 className="mt-1 font-display text-xl font-extrabold text-ink">
                Where the money came from
              </h3>
            </div>
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              aria-label="Select a competition to break down revenue"
              className="h-10 max-w-[260px] rounded-full border-0 bg-lilac/20 px-4 text-xs font-extrabold text-ink ring-1 ring-ink/10 focus:ring-coral/60"
            >
              <option value="all">All competitions</option>
              {rows.map((r) => (
                <option key={r.slug} value={r.slug}>
                  {r.title}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-2xl bg-white p-4 ring-1 ring-ink/5">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-ink/45">
                Tickets sold
              </p>
              <p className="mt-1.5 font-display text-2xl font-extrabold text-ink">
                {shownTickets.toLocaleString("en-NG")}
              </p>
            </div>
            <div className="rounded-2xl bg-white p-4 ring-1 ring-ink/5">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-ink/45">
                Revenue generated
              </p>
              <p className="mt-1.5 font-display text-2xl font-extrabold text-ink">
                {formatNaira(shownRevenue)}
              </p>
            </div>
            {focus ? (
              <>
                <div className="rounded-2xl bg-white p-4 ring-1 ring-ink/5">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-ink/45">
                    Entry price
                  </p>
                  <p className="mt-1.5 font-display text-2xl font-extrabold text-ink">
                    {formatNaira(focus.entryPriceKobo)}
                  </p>
                </div>
                <div className="rounded-2xl bg-white p-4 ring-1 ring-ink/5">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-ink/45">
                    Entries remaining
                  </p>
                  <p className="mt-1.5 font-display text-2xl font-extrabold text-ink">
                    {Math.max(0, shownEntries - shownSold).toLocaleString("en-NG")}
                  </p>
                  <p className="mt-0.5 text-[10px] font-bold text-ink/40">
                    of {shownEntries.toLocaleString("en-NG")}
                  </p>
                </div>
              </>
            ) : (
              <div className="col-span-2 rounded-2xl bg-white p-4 ring-1 ring-ink/5">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-ink/45">
                  Scope
                </p>
                <p className="mt-1.5 text-sm font-extrabold text-ink">
                  All {rows.length} competition{rows.length === 1 ? "" : "s"}
                </p>
                <p className="mt-0.5 text-[11px] font-bold text-ink/45">
                  Pick a competition above to see its own totals.
                </p>
              </div>
            )}
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left">
              <thead>
                <tr className="border-b border-ink/5 text-[10px] font-extrabold uppercase tracking-wider text-ink/45">
                  <th className="py-2">Competition</th>
                  <th className="py-2 text-right">Tickets</th>
                  <th className="py-2 text-right">Revenue</th>
                  <th className="py-2 text-right">Share</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-xs font-bold text-ink/45">
                      No competitions yet.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => {
                    const pct =
                      totals.revenueKobo > 0
                        ? Math.round((r.revenueKobo / totals.revenueKobo) * 100)
                        : r.tickets > 0
                          ? 0
                          : 0;
                    return (
                      <tr
                        key={r.slug}
                        onClick={() => setSelected(r.slug)}
                        className={cn(
                          "cursor-pointer border-b border-ink/5 text-sm last:border-0 hover:bg-white",
                          selected === r.slug && "bg-white",
                        )}
                      >
                        <td className="py-2.5 pr-3">
                          <p className="truncate font-extrabold text-ink">{r.title}</p>
                          <p className="truncate text-[11px] font-bold text-ink/40">{r.slug}</p>
                        </td>
                        <td className="py-2.5 text-right font-display font-extrabold tabular-nums text-ink">
                          {r.tickets.toLocaleString("en-NG")}
                        </td>
                        <td className="py-2.5 text-right font-extrabold tabular-nums text-ink">
                          {formatNaira(r.revenueKobo)}
                        </td>
                        <td className="py-2.5 pl-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-ink/8">
                              <div
                                className="h-full rounded-full bg-coral"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="w-9 text-right text-[11px] font-extrabold tabular-nums text-ink/55">
                              {pct}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function actionFor(status: CompStatus): string {
  switch (status) {
    case "LIVE":
      return "Monitor entries";
    case "DRAWING":
      return "Start draw now";
    case "SCHEDULED":
      return "Review asset";
    case "RESULTED":
      return "Verify winner";
    case "COMPLETED":
      return "Archive";
    case "CLOSED":
      return "Settle partner";
    default:
      return "Publish schedule";
  }
}

const statusTone: Record<CompStatus, string> = {
  DRAFT: "bg-ink/10 text-ink",
  SCHEDULED: "bg-sky/25 text-ink",
  LIVE: "bg-mint/35 text-ink",
  DRAWING: "bg-lemon/40 text-ink",
  RESULTED: "bg-lilac/35 text-ink",
  CLOSED: "bg-ink/15 text-ink",
  COMPLETED: "bg-coral/20 text-coral",
};

export function AdminOverview() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [totalUsers, setTotalUsers] = useState(0);
  const [userWeekDelta, setUserWeekDelta] = useState("—");
  const [userWeekUp, setUserWeekUp] = useState(true);
  const [activeComps, setActiveComps] = useState(0);
  const [totalComps, setTotalComps] = useState(0);
  const [tickets7d, setTickets7d] = useState(0);
  const [revenue7d, setRevenue7d] = useState(0);
  const [revenueMtd, setRevenueMtd] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingSum, setPendingSum] = useState(0);
  const [referralPool, setReferralPool] = useState(0);
  const [chartTickets, setChartTickets] = useState<number[]>(Array(14).fill(0));
  const [chartRevenue, setChartRevenue] = useState<number[]>(Array(14).fill(0));
  const [registrations, setRegistrations] = useState<RegistrationRow[]>([]);
  const [payoutQueue, setPayoutQueue] = useState<PayoutRow[]>([]);
  const [lifecycle, setLifecycle] = useState<
    Array<{ name: string; pct: number; status: CompStatus; action: string }>
  >([]);
  // Raw rows kept for the per-competition revenue breakdown below.
  const [entryDocs, setEntryDocs] = useState<EntryRevenueFact[]>([]);
  const [compRows, setCompRows] = useState<CompFact[]>([]);
  // Never render "0 revenue" because a query silently failed — say so instead.
  const [entryLoadError, setEntryLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const [usersSnap, compsSnap, entryLoad, payoutSnap] = await Promise.all([
          getDocs(query(collection(db, "users"), limit(300))),
          getDocs(query(collection(db, "competitions"), limit(100))),
          // Per-user reads, NOT a collectionGroup query — that needs a
          // collection-group index which is not auto-created, and a swallowed
          // rejection rendered "0 tickets / ₦0" on this dashboard.
          fetchAllEntries(),
          getDocs(query(collection(db, "payouts"), limit(100))).catch(() => null),
        ]);
        if (cancelled) return;

        const now = Date.now();
        const dayMs = 86400000;
        const weekAgo = now - 7 * dayMs;
        const twoWeeksAgo = now - 14 * dayMs;
        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);

        // Users
        const userDocs = usersSnap.docs.map((d) => ({
          id: d.id,
          v: d.data() as Record<string, unknown>,
        }));
        setTotalUsers(userDocs.length);
        let thisWeek = 0;
        let prevWeek = 0;
        let pool = 0;
        const regs: Array<{ ms: number; row: RegistrationRow }> = [];
        userDocs.forEach((u, i) => {
          const ms = toMs(u.v["createdAt"]);
          if (ms >= weekAgo) thisWeek++;
          else if (ms >= twoWeeksAgo) prevWeek++;
          pool += Number(u.v["referralEarningsKobo"] ?? 0) || 0;
          const first = (u.v["firstName"] as string) || "";
          const last = (u.v["lastName"] as string) || "";
          const display =
            (u.v["displayName"] as string) ||
            `${first} ${last}`.trim() ||
            u.v["handle"] ||
            u.id.slice(0, 8);
          regs.push({
            ms,
            row: {
              id: u.id,
              name: String(display),
              email: (u.v["email"] as string) || "",
              initials: initialsOfName(String(display)),
              tint: REG_TINTS[i % REG_TINTS.length]!,
              date: ms ? lagosDateShort(ms) : "—",
              verified: u.v["verified"] === true,
            },
          });
        });
        setReferralPool(pool);
        if (prevWeek > 0) {
          const pct = Math.round(((thisWeek - prevWeek) / prevWeek) * 100);
          setUserWeekDelta(`${pct >= 0 ? "+" : ""}${pct}% week`);
          setUserWeekUp(pct >= 0);
        } else {
          setUserWeekDelta(thisWeek > 0 ? `${thisWeek} new this week` : "0% week");
          setUserWeekUp(true);
        }
        regs.sort((a, b) => b.ms - a.ms);
        setRegistrations(regs.slice(0, 6).map((r) => r.row));

        // Competitions
        const comps = compsSnap.docs.map((d) => ({
          id: d.id,
          v: d.data() as Record<string, unknown>,
        }));
        setTotalComps(comps.length);
        setActiveComps(
          comps.filter((c) => String(c.v["status"] ?? "").toUpperCase() === "LIVE").length,
        );
        setLifecycle(
          comps.slice(0, 8).map((c) => {
            const total = Number(c.v["totalEntries"] ?? 0) || 0;
            const sold = Number(c.v["entriesSold"] ?? 0) || 0;
            const status = mapCompStatus(c.v["status"]);
            return {
              name: String(c.v["title"] ?? c.v["name"] ?? c.id),
              pct: total > 0 ? Math.min(100, Math.round((sold / total) * 100)) : 0,
              status,
              action: actionFor(status),
            };
          }),
        );

        // Per-competition revenue panel inputs.
        setCompRows(
          comps.map((c) => ({
            slug: c.id,
            title: String(c.v["title"] ?? c.v["name"] ?? c.id),
            entriesSold: Number(c.v["entriesSold"] ?? 0) || 0,
            totalEntries: Number(c.v["totalEntries"] ?? 0) || 0,
            entryPriceKobo: Number(c.v["entryPrice"] ?? 0) || 0,
          })),
        );
        setEntryLoadError(entryLoad.error);
        setEntryDocs(
          entryLoad.entries.map((e) => ({
            competitionSlug: e.competitionSlug,
            competitionTitle: e.competitionTitle,
            quantity: e.quantity,
            amountKobo: e.amountKobo,
            isReferral: !!e.referralReference,
            createdAtMs: e.createdAtMs,
          })),
        );

        // Ticket purchases → 7d / MTD / 14-day chart
        // Derived from the entry records, which carry the real `amountKobo`.
        // Referral orders are paid from referral balance, not cash, so they
        // count as tickets but not revenue.
        const tickets = Array(14).fill(0) as number[];
        const revenue = Array(14).fill(0) as number[];
        let count7 = 0;
        let rev7 = 0;
        let revM = 0;
        entryLoad.entries.forEach((e) => {
          const ms = e.createdAtMs;
          const ticketQty = e.quantity;
          if (!ms || ticketQty <= 0) return;
          const amt = e.referralReference ? 0 : e.amountKobo;
          const dayIdx = Math.floor((now - ms) / dayMs);
          if (dayIdx >= 0 && dayIdx < 14) {
            tickets[13 - dayIdx]! += ticketQty;
            revenue[13 - dayIdx]! += amt;
          }
          if (ms >= weekAgo) {
            count7 += ticketQty;
            rev7 += amt;
          }
          if (ms >= monthStart.getTime()) revM += amt;
        });
        setChartTickets(tickets);
        setChartRevenue(revenue);
        setTickets7d(count7);
        setRevenue7d(rev7);
        setRevenueMtd(revM);

        // Payouts (collection may not exist yet)
        if (payoutSnap) {
          const pend = payoutSnap.docs.filter((d) => {
            const s = String((d.data() as Record<string, unknown>)["status"] ?? "").toLowerCase();
            return s === "pending" || s === "processing" || s === "queued";
          });
          setPendingCount(pend.length);
          let sum = 0;
          const rows: PayoutRow[] = pend.slice(0, 5).map((d, i) => {
            const v = d.data() as Record<string, unknown>;
            const amt = Number(v["amountKobo"] ?? v["amount"] ?? 0) || 0;
            sum += amt;
            const who = String(v["userName"] ?? v["user"] ?? v["email"] ?? d.id);
            return {
              id: d.id,
              user: who,
              initials: initialsOfName(who),
              tint: (["lemon", "sky", "mint", "coral", "lilac"] as const)[i % 5]!,
              amount: amt,
            };
          });
          setPendingSum(sum);
          setPayoutQueue(rows);
        }
      } catch (err: any) {
        if (!cancelled) {
          const code = err?.code as string | undefined;
          setLoadError(
            code === "permission-denied"
              ? "Firestore denied access. Publish the latest firestore.rules, then refresh."
              : err?.message || "Could not load dashboard data",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AdminShell activeNav="dashboard" title="Dashboard">
      <header className="mb-6">
        <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-coral">
          Admin · Overview
        </p>
        <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">
          Dashboard
        </h1>
        <p className="mt-2 max-w-2xl text-base font-bold text-ink/60">
          Key metrics and live snapshot of the Raffila platform.{" "}
          {!loading && !loadError && <span className="text-emerald-700">Live from Firestore.</span>}
        </p>
        {loadError && (
          <p className="mt-2 max-w-2xl rounded-xl bg-coral/10 px-4 py-2 text-sm font-bold text-coral">
            {loadError}
          </p>
        )}
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard
          label="Total users"
          value={loading ? "…" : String(totalUsers)}
          delta={userWeekDelta}
          deltaPositive={userWeekUp}
          icon={Users}
          tone="ink"
        />
        <KpiCard
          label="Active competitions"
          value={loading ? "…" : String(activeComps)}
          {...(loading ? {} : { sub: `${totalComps} total` })}
          icon={Trophy}
          tone="sky"
        />
        <KpiCard
          label="Tickets sold (7 days)"
          value={loading ? "…" : String(tickets7d)}
          sub={formatNaira(revenue7d)}
          icon={Ticket}
          tone="lemon"
        />
        <KpiCard
          label="Revenue (MTD)"
          value={formatNaira(revenueMtd)}
          icon={DollarSign}
          tone="coral"
        />
        <KpiCard
          label="Pending payouts"
          value={loading ? "…" : String(pendingCount)}
          sub={formatNaira(pendingSum)}
          icon={Banknote}
          tone="lilac"
        />
        <KpiCard
          label="Referral pool (all-time)"
          value={formatNaira(referralPool)}
          icon={Gift}
          tone="mint"
        />
      </section>

      {entryLoadError && (
        <div className="mt-6 rounded-[22px] bg-coral/10 p-5 ring-1 ring-coral/30">
          <p className="text-sm font-extrabold text-ink">Ticket data could not be loaded</p>
          <p className="mt-1 text-xs font-bold text-ink/60">
            Revenue and ticket counts below are unreliable until this is resolved: {entryLoadError}
          </p>
        </div>
      )}

      <CompetitionRevenue entries={entryDocs} competitions={compRows} />

      <section className="mt-6">
        <Card className="rounded-[28px] border-0 bg-paper p-0 ring-1 ring-ink/5 shadow-none">
          <CardContent className="p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-ink/45">
                  Daily performance · last 14 days
                </p>
                <h3 className="mt-1 font-display text-xl font-extrabold text-ink">
                  Tickets & revenue trend
                </h3>
              </div>
              <div className="flex items-center gap-4 text-[11px] font-extrabold">
                <span className="inline-flex items-center gap-1.5 text-ink/65">
                  <span className="size-2.5 rounded-full bg-coral" /> Tickets sold
                </span>
                <span className="inline-flex items-center gap-1.5 text-ink/65">
                  <span className="size-2.5 rounded-full bg-sky" /> Daily revenue
                </span>
              </div>
            </div>
            <div className="mt-4 -mx-2">
              <DualChartBars tickets={chartTickets} revenueBase={chartRevenue} />
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="rounded-[28px] border-0 bg-paper p-0 ring-1 ring-ink/5 shadow-none lg:col-span-2 xl:col-span-1">
          <CardContent className="p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-ink/45">
                  Sign-ups
                </p>
                <h3 className="mt-1 font-display text-xl font-extrabold text-ink">
                  Recent registrations
                </h3>
              </div>
              <Button variant="outline" size="sm">
                <UserPlus className="size-3.5" /> Invite
              </Button>
            </div>
            <div className="mt-4 overflow-x-auto">
              <Table>
                <TableHeader className="[&_tr]:border-ink/10">
                  <TableRow>
                    <TableHead className="px-0 py-3 font-extrabold text-ink/65">User</TableHead>
                    <TableHead className="py-3 font-extrabold text-ink/65">Date</TableHead>
                    <TableHead className="py-3 font-extrabold text-ink/65">Verified</TableHead>
                    <TableHead className="py-3 text-right font-extrabold text-ink/65">
                      Action
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="[&_tr]:border-ink/10">
                  {loading && (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="py-8 text-center text-sm font-bold text-ink/55"
                      >
                        Loading…
                      </TableCell>
                    </TableRow>
                  )}
                  {!loading && registrations.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="py-8 text-center text-sm font-bold text-ink/55"
                      >
                        No registrations yet.
                      </TableCell>
                    </TableRow>
                  )}
                  {registrations.map((r, i) => (
                    <TableRow key={i} className="hover:bg-lilac/10">
                      <TableCell className="px-0 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar className={cn("size-9 ring-2 ring-paper", tintBg[r.tint])}>
                            <AvatarFallback
                              className={cn("text-xs font-extrabold", tintBg[r.tint])}
                            >
                              {r.initials}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-extrabold text-ink">{r.name}</p>
                            <p className="truncate text-xs font-bold text-ink/55">{r.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-3 text-xs font-bold text-ink/65 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="size-3" />
                          {r.date}
                        </span>
                      </TableCell>
                      <TableCell className="py-3">
                        {r.verified ? (
                          <Badge className="rounded-full bg-mint/30 px-2 py-0.5 text-[10px] font-extrabold text-ink ring-0">
                            Verified
                          </Badge>
                        ) : (
                          <Badge className="rounded-full bg-ink/10 px-2 py-0.5 text-[10px] font-extrabold text-ink ring-0">
                            Pending
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="py-3 text-right">
                        <Button variant="outline" size="sm">
                          <Eye className="size-3.5" /> Impersonate
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-0 bg-paper p-0 ring-1 ring-ink/5 shadow-none">
          <CardContent className="p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-ink/45">
                  Finance
                </p>
                <h3 className="mt-1 font-display text-xl font-extrabold text-ink">
                  Pending payouts
                </h3>
              </div>
              <Badge className="rounded-full bg-coral/15 px-2.5 py-1 text-[10px] font-extrabold text-coral ring-0">
                {payoutQueue.length} items
              </Badge>
            </div>
            <div className="mt-4 space-y-2.5">
              {!loading && payoutQueue.length === 0 && (
                <p className="rounded-2xl bg-cream/50 px-4 py-6 text-center text-xs font-bold text-ink/55">
                  No pending payouts.
                </p>
              )}
              {payoutQueue.map((p, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-2xl bg-cream/50 px-3 py-2.5"
                >
                  <Avatar className={cn("size-9 ring-2 ring-paper", tintBg[p.tint])}>
                    <AvatarFallback className={cn("text-xs font-extrabold", tintBg[p.tint])}>
                      {p.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-extrabold text-ink">{p.user}</p>
                    <p className="truncate text-[11px] font-bold text-ink/55">
                      {formatNaira(p.amount)}
                    </p>
                  </div>
                  <Badge className="rounded-full bg-lemon/40 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-ink ring-0">
                    Pending
                  </Badge>
                  <Button variant="primary" size="sm">
                    <PlayCircle className="size-3.5" /> Process
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-0 bg-paper p-0 ring-1 ring-ink/5 shadow-none">
          <CardContent className="p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-ink/45">
                  Competitions
                </p>
                <h3 className="mt-1 font-display text-xl font-extrabold text-ink">
                  Lifecycle status
                </h3>
              </div>
              <Button asChild variant="outline" size="sm">
                <a href="/admin/competitions">View all</a>
              </Button>
            </div>
            <div className="mt-4 overflow-x-auto">
              <Table>
                <TableHeader className="[&_tr]:border-ink/10">
                  <TableRow>
                    <TableHead className="px-0 py-3 font-extrabold text-ink/65">Name</TableHead>
                    <TableHead className="py-3 font-extrabold text-ink/65">Entries</TableHead>
                    <TableHead className="py-3 font-extrabold text-ink/65">Status</TableHead>
                    <TableHead className="py-3 text-right font-extrabold text-ink/65">
                      Next
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="[&_tr]:border-ink/10">
                  {loading && (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="py-8 text-center text-sm font-bold text-ink/55"
                      >
                        Loading…
                      </TableCell>
                    </TableRow>
                  )}
                  {!loading && lifecycle.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="py-8 text-center text-sm font-bold text-ink/55"
                      >
                        No competitions yet.
                      </TableCell>
                    </TableRow>
                  )}
                  {lifecycle.map((c, i) => (
                    <TableRow key={i} className="hover:bg-lilac/10">
                      <TableCell className="px-0 py-3">
                        <p className="truncate text-sm font-extrabold text-ink max-w-[220px]">
                          {c.name}
                        </p>
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-16 overflow-hidden rounded-full bg-cream">
                            <div className="h-full bg-coral" style={{ width: `${c.pct}%` }} />
                          </div>
                          <span className="text-[11px] font-extrabold text-ink/65">{c.pct}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        <Badge
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ring-0",
                            statusTone[c.status],
                          )}
                        >
                          {c.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-3 text-right text-xs font-bold text-ink/65 whitespace-nowrap">
                        {c.action}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </section>
    </AdminShell>
  );
}

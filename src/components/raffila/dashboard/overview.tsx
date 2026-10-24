import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Wallet, Users, Ticket, Trophy, Copy, Check, Clock } from "lucide-react";
import { collection, doc, limit, onSnapshot, orderBy, query } from "firebase/firestore";

import { DashboardAppShell } from "@/components/raffila/dashboard/app-shell";
import { Button } from "@/components/ui/button";
import { formatNaira } from "@/lib/raffila-data";
import { lagosGreeting } from "@/lib/format";
import { useCompetitions, findCompetition, isCompetitionConcluded } from "@/hooks/useCompetitions";
import { cn } from "@/lib/utils";
import { useAuthSession } from "@/hooks/useAuthSession";
import { fetchFeatureFlags } from "@/lib/platform-config";
import { db } from "@/lib/firebase";

type KpiProps = {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  iconBg: string;
  right?: React.ReactNode;
};

function KpiCard({ label, value, sub, icon, iconBg, right }: KpiProps) {
  return (
    <div className="rounded-[24px] bg-white p-6 ring-1 ring-ink/5 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink/45">
            {label}
          </p>
          <p className="mt-2 font-display text-2xl font-extrabold text-ink sm:text-3xl">{value}</p>
          {sub && <p className="mt-1 text-xs font-bold text-ink/45">{sub}</p>}
        </div>
        <div className={`grid size-12 shrink-0 place-items-center rounded-2xl ${iconBg}`}>
          {icon}
        </div>
      </div>
      {right}
    </div>
  );
}

const statusStyles: Record<RecentEntry["status"], string> = {
  Entered: "bg-mint/30 text-ink",
  Drawn: "bg-sky/20 text-ink",
  Won: "bg-lemon/40 text-ink",
  Lost: "bg-ink/10 text-ink/70",
  Completed: "bg-ink/10 text-ink/70",
};

type RecentEntry = {
  id: string;
  competition: string;
  tickets: number;
  drawDate: string;
  status: "Entered" | "Won" | "Lost" | "Drawn" | "Completed";
};

/** Shape of users/{uid}/entries/{entryId}, written server-side on payment. */
type RawEntry = {
  entryId: string;
  competitionSlug: string;
  competitionTitle: string;
  quantity: number;
  amountKobo: number;
  status: string;
  createdAtMs: number;
  ticketNumbers: string[];
  isWinner: boolean;
};

function toMs(v: unknown): number {
  try {
    const x = v as { toDate?: () => Date };
    if (x && typeof x.toDate === "function") return x.toDate().getTime();
  } catch {
    /* fall through */
  }
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v) {
    const t = new Date(v).getTime();
    return Number.isNaN(t) ? 0 : t;
  }
  return 0;
}

export function DashboardOverviewPage() {
  const { user } = useAuthSession();
  const { competitions, activeCompetitions } = useCompetitions();
  const [walletEnabled, setWalletEnabled] = useState(true);

  // Wallet kill-switch: Admin → Settings → Feature availability.
  useEffect(() => {
    let cancelled = false;
    fetchFeatureFlags()
      .then((f) => {
        if (!cancelled) setWalletEnabled(f["wallet"] !== false);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  const firstName = user?.firstName || "there";
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyId = (id: string) => {
    navigator.clipboard?.writeText(id).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const greeting = lagosGreeting();
  const uid = user?.id?.startsWith("firebase_") ? user.id.slice("firebase_".length) : user?.id;

  // Live referral stats + code from the user's own document.
  const [referral, setReferral] = useState({
    availableKobo: 0,
    totalNetwork: 0,
    code: "",
    loaded: false,
  });
  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(
      doc(db, "users", uid),
      (snap) => {
        const v = (snap.exists() ? snap.data() : {}) as Record<string, unknown>;
        const counts = (v["referralTreeCount"] ?? {}) as Record<string, unknown>;
        const n = (x: unknown) => Number(x) || 0;
        setReferral({
          availableKobo: n(v["referralEarningsKobo"]),
          totalNetwork:
            n(counts["l1"]) + n(counts["l2"]) + n(counts["l3"]) + n(counts["l4"]) + n(counts["l5"]),
          code: String(v["referralCode"] ?? ""),
          loaded: true,
        });
      },
      () => setReferral((r) => ({ ...r, loaded: true })),
    );
    return () => unsub();
  }, [uid]);

  // Live entries for this user, written server-side on confirmed payment.
  const [rawEntries, setRawEntries] = useState<RawEntry[]>([]);
  useEffect(() => {
    if (!uid) {
      setRawEntries([]);
      return;
    }
    const unsub = onSnapshot(
      query(collection(db, "users", uid, "entries"), orderBy("createdAt", "desc"), limit(100)),
      (snap) => {
        setRawEntries(
          snap.docs.map((d) => {
            const v = d.data() as Record<string, unknown>;
            const tktNums = Array.isArray(v["ticketNumbers"])
              ? (v["ticketNumbers"] as unknown[]).map(String)
              : [];
            return {
              entryId: String(v["entryId"] ?? d.id),
              competitionSlug: String(v["competitionSlug"] ?? ""),
              competitionTitle: String(v["competitionTitle"] ?? v["competitionSlug"] ?? "—"),
              quantity: Number(v["quantity"] ?? 0) || 0,
              amountKobo: Number(v["amountKobo"] ?? 0) || 0,
              status: String(v["status"] ?? "CONFIRMED").toUpperCase(),
              createdAtMs: toMs(v["createdAt"]),
              ticketNumbers: tktNums,
              isWinner:
                v["winnerTicketNumber"] != null ||
                String(v["status"] ?? "").toUpperCase() === "WON",
            };
          }),
        );
      },
      () => setRawEntries([]),
    );
    return () => unsub();
  }, [uid]);

  const resolvedEntries = useMemo(() => {
    return rawEntries.map((e) => {
      const comp = findCompetition(competitions, e.competitionSlug);
      const isConcluded = isCompetitionConcluded(comp);
      const winTkt = comp?.winnerTicketNumber || comp?.winningTicketNumber;
      const isWinner =
        e.isWinner ||
        (comp && comp.winnerUserId === uid) ||
        (Boolean(winTkt) && e.ticketNumbers.some((t) => String(t) === String(winTkt)));

      const prizeValueKobo = comp?.marketValueKobo || comp?.prizeValueKobo || 0;
      return {
        ...e,
        isWinner,
        isConcluded,
        prizeValueKobo,
        drawDate: comp?.drawDate || comp?.closes || "—",
      };
    });
  }, [rawEntries, competitions, uid]);

  const totalTickets = useMemo(
    () => resolvedEntries.reduce((n, e) => n + e.quantity, 0),
    [resolvedEntries],
  );
  const competitionsEntered = useMemo(
    () => new Set(resolvedEntries.map((e) => e.competitionSlug).filter(Boolean)).size,
    [resolvedEntries],
  );
  const totalSpentKobo = useMemo(
    () => resolvedEntries.reduce((n, e) => n + e.amountKobo, 0),
    [resolvedEntries],
  );
  const activeCompetitionsCount = activeCompetitions.length;
  const prizesWon = useMemo(
    () => resolvedEntries.filter((e) => e.isWinner).length,
    [resolvedEntries],
  );
  const wonValueKobo = useMemo(
    () =>
      resolvedEntries
        .filter((e) => e.isWinner)
        .reduce((n, e) => n + (e.prizeValueKobo || e.amountKobo), 0),
    [resolvedEntries],
  );

  const recentEntries: RecentEntry[] = useMemo(
    () =>
      resolvedEntries.slice(0, 5).map((e) => {
        return {
          id: e.entryId,
          competition: e.competitionTitle,
          tickets: e.quantity,
          drawDate: e.drawDate,
          status: e.isWinner
            ? "Won"
            : e.isConcluded
              ? "Completed"
              : e.status === "REFUNDED"
                ? "Lost"
                : "Entered",
        };
      }),
    [resolvedEntries],
  );

  return (
    <DashboardAppShell
      title="Overview"
      breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Overview" }]}
    >
      <div className="space-y-6">
        <section className="overflow-hidden rounded-[24px] bg-white p-6 ring-1 ring-ink/5 sm:p-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-coral">
                Welcome back
              </p>
              <h2 className="mt-2 break-words font-display text-2xl font-extrabold leading-tight tracking-tight text-ink sm:text-3xl lg:text-4xl">
                {greeting} 👋
              </h2>
              <h3 className="mt-1 font-display text-xl font-extrabold text-ink sm:text-2xl">
                {firstName}
              </h3>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink/55">
                Your next win could be one ticket away.
              </p>
            </div>
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center lg:w-auto">
              {walletEnabled && (
                <div className="flex-1 rounded-2xl bg-cream px-4 py-3.5 ring-1 ring-ink/5 sm:min-w-[140px] sm:flex-none">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-ink/45">
                    Wallet balance
                  </p>
                  <p className="mt-1 break-words font-display text-lg font-extrabold text-ink sm:text-xl lg:text-2xl">
                    {formatNaira(0)}
                  </p>
                </div>
              )}
              <div className="flex-1 rounded-2xl bg-cream px-4 py-3.5 ring-1 ring-ink/5 sm:min-w-[140px] sm:flex-none">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-ink/45">
                  Referral earnings
                </p>
                <p className="mt-1 break-words font-display text-lg font-extrabold text-ink sm:text-xl lg:text-2xl">
                  {formatNaira(referral.availableKobo)}
                </p>
              </div>
              <Button asChild variant="primary" size="md" className="w-full sm:w-auto">
                <Link to="/dashboard/competitions">
                  Browse competitions <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        <div className="grid gap-4 grid-cols-1 xs:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Total entries"
            value={totalTickets.toLocaleString("en-NG")}
            sub={`Across ${competitionsEntered} competition${competitionsEntered === 1 ? "" : "s"}`}
            icon={<Ticket className="size-5 text-coral" />}
            iconBg="bg-coral/10"
          />
          <KpiCard
            label="Active competitions"
            value={activeCompetitionsCount.toLocaleString("en-NG")}
            sub="Draws coming up"
            icon={<Trophy className="size-5 text-coral" />}
            iconBg="bg-coral/10"
          />
          <KpiCard
            label="Prizes won"
            value={prizesWon.toLocaleString("en-NG")}
            sub={`${formatNaira(wonValueKobo)} value`}
            icon={<Trophy className="size-5 text-coral" />}
            iconBg="bg-coral/10"
          />
          <KpiCard
            label="Referrals recruited"
            value={String(referral.totalNetwork)}
            sub="In your network"
            icon={<Users className="size-5 text-coral" />}
            iconBg="bg-coral/10"
            right={
              referral.code ? (
                <Button asChild variant="outline" size="sm" className="mt-3 w-full text-xs">
                  <Link to="/dashboard/referrals">Copy referral link</Link>
                </Button>
              ) : null
            }
          />
        </div>

        <section className="rounded-[24px] bg-white p-6 ring-1 ring-ink/5 sm:p-7">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink/45">
                Don't miss out
              </p>
              <h2 className="mt-2 font-display text-xl font-extrabold text-ink sm:text-2xl">
                Upcoming draws
              </h2>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/dashboard/competitions">
                View all <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </div>

          <div className="mt-5 grid gap-4 grid-cols-1 lg:grid-cols-2">
            {competitions.slice(0, 2).map((comp) => {
              const sold = comp.entriesSold;
              const total = comp.totalEntries;
              return (
                <article
                  key={comp.slug}
                  className="flex flex-col overflow-hidden rounded-[24px] ring-1 ring-ink/5 bg-white hover:shadow-md hover:ring-coral/20 transition-all sm:flex-row"
                >
                  <div className="bg-cream/60 p-3 flex items-center justify-center sm:w-[42%] sm:shrink-0">
                    <img
                      src={comp.image}
                      alt={`${comp.title} prize`}
                      loading="lazy"
                      decoding="async"
                      className="h-[160px] w-full object-contain rounded-xl sm:h-full sm:max-h-[180px]"
                    />
                  </div>
                  <div className="flex flex-1 flex-col justify-between gap-3 p-4 sm:p-5">
                    <div className="min-w-0">
                      <h3 className="line-clamp-2 font-display text-base font-extrabold leading-tight text-ink sm:text-lg">
                        {comp.title}
                      </h3>
                      <div className="mt-2 flex items-center gap-2 text-[11px] font-bold text-ink/50">
                        <span className="inline-flex items-center gap-1">
                          <Ticket className="size-3.5 shrink-0" />{" "}
                          {Math.min(100, Math.round((sold / total) * 100))}% sold
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 w-full rounded-full bg-cream overflow-hidden">
                        <div
                          className="h-full rounded-full bg-coral transition-all duration-500"
                          style={{ width: `${Math.min(100, (sold / total) * 100)}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-lemon/30 px-3 py-1 text-[10px] font-extrabold text-ink">
                        <Clock className="size-3 shrink-0" />
                        Ends {comp.closes}
                      </span>
                      <Button asChild variant="primary" size="sm">
                        <Link to="/competitions/$slug" params={{ slug: comp.slug }}>
                          View <ArrowRight className="size-3" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="rounded-[24px] bg-white p-6 ring-1 ring-ink/5 sm:p-7">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink/45">
                Your ticket trail
              </p>
              <h2 className="mt-2 font-display text-xl font-extrabold text-ink sm:text-2xl">
                Recent entries
              </h2>
            </div>
            <Link
              to="/dashboard/entries"
              className="inline-flex items-center gap-1 text-xs font-extrabold text-coral hover:underline"
            >
              View all entries <ArrowRight className="size-3" />
            </Link>
          </div>

          <div className="mt-5 overflow-x-auto -mx-6 px-6 sm:mx-0 sm:px-0">
            <table className="w-full text-left text-sm min-w-[640px]">
              <thead className="bg-cream text-[11px] font-extrabold uppercase tracking-[0.12em] text-ink/45 rounded-2xl">
                <tr>
                  <th className="px-4 py-3 first:rounded-l-2xl last:rounded-r-2xl">Entry ID</th>
                  <th className="px-4 py-3">Competition</th>
                  <th className="px-4 py-3 text-center">Tickets</th>
                  <th className="px-4 py-3">Draw date</th>
                  <th className="px-4 py-3 first:rounded-l-2xl last:rounded-r-2xl">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/10">
                {recentEntries.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="grid size-12 place-items-center rounded-2xl bg-coral/10">
                          <Ticket className="size-5 text-coral" />
                        </div>
                        <div>
                          <p className="text-sm font-extrabold text-ink">No entries yet</p>
                          <p className="mt-1 text-xs font-bold text-ink/45">
                            Browse competitions and grab your first ticket
                          </p>
                        </div>
                        <Button asChild variant="primary" size="sm">
                          <Link to="/dashboard/competitions">
                            Browse competitions <ArrowRight className="size-3.5" />
                          </Link>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  recentEntries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-cream/40 transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-ink/70">
                            {entry.id}
                          </span>
                          <button
                            onClick={() => copyId(entry.id)}
                            className={cn(
                              "grid size-6 place-items-center rounded-full transition-colors",
                              copiedId === entry.id
                                ? "bg-mint/30 text-ink"
                                : "bg-cream text-ink/45 hover:text-coral",
                            )}
                            aria-label="Copy entry ID"
                          >
                            {copiedId === entry.id ? (
                              <Check className="size-3" />
                            ) : (
                              <Copy className="size-3" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-bold text-ink">{entry.competition}</td>
                      <td className="px-4 py-3.5 text-center font-display font-extrabold text-ink">
                        {entry.tickets}
                      </td>
                      <td className="px-4 py-3.5 text-xs font-bold text-ink/50">
                        {entry.drawDate}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2.5 py-1 text-[10px] font-extrabold",
                            statusStyles[entry.status],
                          )}
                        >
                          {entry.status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </DashboardAppShell>
  );
}

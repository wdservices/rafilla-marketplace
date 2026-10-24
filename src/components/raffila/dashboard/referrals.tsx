import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Copy,
  Check,
  ArrowRight,
  Trophy,
  MessageCircle,
  Send,
  Twitter,
  Banknote,
  Users,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";

import { DashboardAppShell } from "@/components/raffila/dashboard/app-shell";
import { Button } from "@/components/ui/button";
import { formatNaira } from "@/lib/raffila-data";
import { cn } from "@/lib/utils";
import { useAuthSession } from "@/hooks/useAuthSession";
import {
  getReferralDashboard,
  type GetReferralDashboardResult,
  type ReferralRecruit,
} from "@/lib/referral-server";
import { referralInviteUrl } from "@/lib/referral-core";

const levelPct: Record<number, string> = { 1: "10%", 2: "5%", 3: "3%", 4: "2%", 5: "1%" };
const levelRing: Record<number, string> = {
  1: "ring-coral/60",
  2: "ring-coral/45",
  3: "ring-coral/30",
  4: "ring-coral/20",
  5: "ring-ink/10",
};
const levelBadge: Record<number, string> = {
  1: "bg-coral/15 text-coral",
  2: "bg-sky/20 text-ink",
  3: "bg-lemon/30 text-ink",
  4: "bg-mint/30 text-ink",
  5: "bg-lilac/30 text-ink",
};

function shortDate(ms: number): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString("en-NG", { day: "2-digit", month: "short" });
}

function NodeCard({ node, level }: { node: ReferralRecruit; level: number }) {
  return (
    <div className="flex flex-col items-center">
      <div
        className={cn(
          "grid size-12 shrink-0 place-items-center rounded-full font-display text-xs font-extrabold ring-2",
          level <= 4 ? levelRing[level] : "ring-ink/10",
          "bg-coral/10 text-coral",
        )}
      >
        {node.initials}
      </div>
      <p className="mt-2 max-w-[80px] truncate text-center text-[11px] font-extrabold text-ink">
        {node.name.split(" ")[0]}
      </p>
      <p className="text-[10px] font-bold text-ink/45">{node.directRecruits} recruits</p>
    </div>
  );
}

export function DashboardReferralsPage() {
  const { user } = useAuthSession();
  const uid = user?.id?.startsWith("firebase_")
    ? user.id.slice("firebase_".length)
    : (user?.id ?? "");
  const firstName = user?.firstName || "User";
  const [data, setData] = useState<GetReferralDashboardResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"url" | "code" | null>(null);

  const load = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    setLoadError(null);
    try {
      const res = await getReferralDashboard({ data: { uid } });
      setData(res);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not load referral data");
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    void load();
  }, [load]);

  const code = data?.code ?? "";
  const refUrl = code
    ? referralInviteUrl(
        code,
        typeof window !== "undefined" ? window.location.origin : "https://raffila.com",
      )
    : "";
  const rates = data?.rates;
  const pctFor = (lv: number) => (rates ? `${rates[`l${lv}` as "l1"]}%` : levelPct[lv]);

  const copy = (what: "url" | "code", v: string) => {
    navigator.clipboard?.writeText(v).catch(() => {});
    setCopied(what);
    setTimeout(() => setCopied(null), 1800);
  };

  return (
    <DashboardAppShell
      title="Referrals"
      breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Referrals" }]}
    >
      <div className="space-y-6">
        <p className="max-w-2xl text-sm leading-relaxed text-ink/60 -mt-3">
          Invite friends and earn up to 5 levels of commissions every time someone you bring in
          enters a competition.
        </p>

        <div className="rounded-[24px] bg-white p-6 ring-1 ring-ink/5 sm:p-8">
          <div className="flex items-end justify-between gap-3 flex-wrap">
            <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-ink/45">
              My referral link
            </p>
            <button
              onClick={() => void load()}
              className="inline-flex items-center gap-1.5 text-[11px] font-extrabold text-ink/45 hover:text-ink"
            >
              <RefreshCw className={cn("size-3.5", loading && "animate-spin")} /> Refresh
            </button>
          </div>

          {loadError ? (
            <div className="mt-4 flex flex-col gap-3 rounded-2xl bg-rose/10 p-4 ring-1 ring-rose/20 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-ink">
                <AlertTriangle className="size-4 text-coral" /> {loadError}
              </div>
              <Button variant="outline" size="sm" onClick={() => void load()}>
                Retry
              </Button>
            </div>
          ) : null}

          {loading && !data ? (
            <div className="mt-4 h-12 w-full animate-pulse rounded-2xl bg-cream" />
          ) : code ? (
            <>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl bg-cream px-4 py-3 ring-1 ring-ink/5">
                  <span className="min-w-0 truncate font-mono text-xs font-bold text-ink">
                    {refUrl}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="primary" size="md" onClick={() => copy("url", refUrl)}>
                    {copied === "url" ? (
                      <>
                        <Check className="size-4" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="size-4" /> Copy
                      </>
                    )}
                  </Button>
                  <div className="inline-flex rounded-full bg-white p-1 ring-1 ring-ink/5">
                    <button
                      className="grid size-10 place-items-center rounded-full text-ink/60 hover:bg-green-100 hover:text-green-700 transition-colors"
                      aria-label="Share on WhatsApp"
                      onClick={() =>
                        window.open(
                          `https://wa.me/?text=${encodeURIComponent("Join Raffila and win big prizes! " + refUrl)}`,
                          "_blank",
                        )
                      }
                    >
                      <MessageCircle className="size-4" />
                    </button>
                    <button
                      className="grid size-10 place-items-center rounded-full text-ink/60 hover:bg-sky/20 hover:text-sky-700 transition-colors"
                      aria-label="Share on Telegram"
                      onClick={() =>
                        window.open(
                          `https://t.me/share/url?url=${encodeURIComponent(refUrl)}&text=${encodeURIComponent("Join Raffila!")}`,
                          "_blank",
                        )
                      }
                    >
                      <Send className="size-4" />
                    </button>
                    <button
                      className="grid size-10 place-items-center rounded-full text-ink/60 hover:bg-ink/5 transition-colors"
                      aria-label="Share on Twitter"
                      onClick={() =>
                        window.open(
                          `https://twitter.com/intent/tweet?url=${encodeURIComponent(refUrl)}&text=${encodeURIComponent("Join Raffila and win big prizes!")}`,
                          "_blank",
                        )
                      }
                    >
                      <Twitter className="size-4" />
                    </button>
                  </div>
                </div>
              </div>
              <p className="mt-2 text-[11px] font-bold text-ink/40">
                Your code: <span className="font-mono text-ink/60">{code}</span> — scanned or opened
                invite links attribute new sign-ups to you automatically.
              </p>
            </>
          ) : (
            <p className="mt-3 text-sm font-bold text-ink/50">Generating your referral code…</p>
          )}

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Invites opened"
              value={String(data?.inviteOpens ?? 0)}
              tone="bg-mint/30 text-ink"
            />
            <StatCard
              label="Total recruits"
              value={`${data?.directRecruits ?? 0} direct`}
              sub={`${data?.totalNetwork ?? 0} in network`}
              tone="bg-coral/15 text-coral"
            />
            <StatCard
              label="Total earned commissions"
              value={formatNaira(data?.earnedTotalKobo ?? 0)}
              tone="bg-sky/20 text-ink"
            />
            <div className="rounded-[24px] bg-white p-5 ring-1 ring-ink/5 transition-shadow hover:shadow-md">
              <span className="inline-block rounded-xl bg-coral/10 px-2.5 py-1 text-[10px] font-extrabold text-coral">
                Available balance
              </span>
              <p className="mt-3 font-display text-2xl font-extrabold text-ink sm:text-3xl">
                {formatNaira(data?.availableKobo ?? 0)}
              </p>
              <p className="mt-1 text-xs font-bold text-ink/45">
                {formatNaira(data?.pendingPayoutKobo ?? 0)} pending payout
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-[24px] bg-white p-6 ring-1 ring-ink/5 sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink/45">
                5-level earning tree
              </p>
              <h2 className="mt-2 font-display text-2xl font-extrabold text-ink">
                Your referral network
              </h2>
              <p className="mt-1 max-w-lg text-xs font-bold leading-relaxed text-ink/55">
                Coral ring = earning you commissions. Commissions are credited instantly on every
                paid entry.
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5 text-[10px] font-extrabold">
              {[1, 2, 3, 4, 5].map((lv) => (
                <span
                  key={lv}
                  className={cn(
                    "rounded-full px-2.5 py-1 ring-2",
                    levelRing[lv],
                    lv <= 4 ? "bg-coral/10 text-coral" : "bg-ink/5 text-ink/50",
                  )}
                >
                  L{lv} · {pctFor(lv)}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-8 space-y-8">
            <div className="flex justify-center">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "grid size-14 place-items-center rounded-full bg-coral font-display text-sm font-extrabold text-white ring-4",
                    levelRing[1],
                  )}
                >
                  {firstName.slice(0, 2).toUpperCase()}
                </div>
                <p className="mt-2 text-[11px] font-extrabold text-ink">{firstName} (You)</p>
                <p className="text-[10px] font-bold text-ink/45">
                  {data?.directRecruits ?? 0} recruits · L1 {pctFor(1)}
                </p>
              </div>
            </div>

            {data && data.recruits.length > 0 ? (
              <>
                <div className="flex justify-center">
                  <div className="h-8 w-px bg-ink/10" />
                </div>
                <div className="flex max-w-[760px] flex-wrap justify-center gap-6">
                  {data.recruits.slice(0, 12).map((n) => (
                    <NodeCard key={n.uid} node={n} level={1} />
                  ))}
                  {data.recruits.length > 12 ? (
                    <div className="flex flex-col items-center justify-center">
                      <p className="text-xs font-extrabold text-ink/50">
                        +{data.recruits.length - 12} more
                      </p>
                    </div>
                  ) : null}
                </div>
              </>
            ) : (
              <div className="mx-auto max-w-md rounded-2xl bg-cream p-5 text-center ring-1 ring-ink/5">
                <Users className="mx-auto size-6 text-ink/30" />
                <p className="mt-2 text-sm font-bold text-ink/60">No recruits yet</p>
                <p className="mt-1 text-xs font-bold text-ink/45">
                  Share your link — anyone who signs up through it joins your L1.
                </p>
              </div>
            )}

            {data && data.totalNetwork > 0 ? (
              <div className="flex flex-wrap justify-center gap-2 text-[11px] font-extrabold">
                {[1, 2, 3, 4, 5].map((lv) => (
                  <span
                    key={lv}
                    className={cn(
                      "rounded-full px-3 py-1.5 ring-1 ring-ink/10",
                      lv <= 4 ? "bg-coral/10 text-coral" : "bg-ink/5 text-ink/50",
                    )}
                  >
                    L{lv} · {data.treeCounts[`l${lv}` as "l1"]} members
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-[28px] bg-white p-6 ring-1 ring-ink/5 sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-ink/45">
                Commission ledger
              </p>
              <h2 className="mt-2 font-display text-2xl font-extrabold text-ink">
                Recent commissions
              </h2>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/dashboard/transactions">
                View all <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead className="bg-cream text-xs font-extrabold uppercase tracking-[0.12em] text-ink/45">
                <tr>
                  <th className="px-4 py-3">When</th>
                  <th className="px-4 py-3">Who</th>
                  <th className="hidden px-4 py-3 sm:table-cell">For what</th>
                  <th className="px-4 py-3">Level</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/10">
                {(data?.commissions ?? []).length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-10 text-center text-sm font-bold text-ink/45"
                    >
                      No commissions yet — they land here the moment a recruit buys a ticket.
                    </td>
                  </tr>
                ) : (
                  (data?.commissions ?? []).map((c) => (
                    <tr key={c.id} className="hover:bg-cream/40">
                      <td className="whitespace-nowrap px-4 py-3 text-xs font-bold text-ink/50">
                        {shortDate(c.createdAtMs)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="grid size-8 place-items-center rounded-full bg-lilac/30 font-display text-[10px] font-extrabold text-ink ring-1 ring-ink/5">
                            {c.buyerName.slice(0, 2).toUpperCase()}
                          </span>
                          <span className="text-sm font-extrabold text-ink">{c.buyerName}</span>
                        </div>
                      </td>
                      <td className="hidden px-4 py-3 text-sm font-bold text-ink/70 sm:table-cell">
                        {c.competition || "Ticket entry"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={cn(
                              "inline-flex rounded-full px-2 py-0.5 text-[10px] font-extrabold",
                              levelBadge[c.level] ?? levelBadge[1],
                            )}
                          >
                            L{c.level}
                          </span>
                          <span className="text-[10px] font-bold text-ink/45">
                            {rates ? `${c.ratePct}%` : levelPct[c.level]}
                          </span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-display text-base font-extrabold text-mint">
                        +{formatNaira(c.amountKobo)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2.5 py-1 text-[10px] font-extrabold",
                            c.status === "AVAILABLE"
                              ? "bg-mint/30 text-ink"
                              : "bg-lemon/40 text-ink",
                          )}
                        >
                          {c.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Button asChild variant="outline" size="lg" className="min-h-14 text-sm">
            <Link to="/dashboard/competitions">
              <Trophy className="size-4" /> USE FOR ENTRY <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild variant="primary" size="lg" className="min-h-14 text-sm">
            <Link to="/dashboard/referrals/payout">
              <Banknote className="size-4" /> REQUEST CASH PAYOUT <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </DashboardAppShell>
  );
}

function StatCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: string;
}) {
  return (
    <div className="rounded-[22px] bg-white p-5 ring-1 ring-ink/5">
      <span className={cn("inline-block rounded-xl px-2.5 py-1 text-[10px] font-extrabold", tone)}>
        {label}
      </span>
      <p className="mt-3 font-display text-2xl font-extrabold text-ink sm:text-3xl">{value}</p>
      {sub ? <p className="mt-1 text-xs font-bold text-ink/45">{sub}</p> : null}
    </div>
  );
}

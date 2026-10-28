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

const levelPct: Record<number, string> = { 1: "10%", 2: "6%", 3: "4%" };
const levelDescriptions: Record<number, string> = {
  1: "Direct Referrals — earn 10% from their ticket purchase",
  2: "Your level referrals — earn 6% from their ticket purchase",
  3: "Your level 2 referrals — earn 4% from their ticket purchase",
};
const levelRing: Record<number, string> = {
  1: "ring-coral/60",
  2: "ring-coral/45",
  3: "ring-coral/30",
};
const levelBadge: Record<number, string> = {
  1: "bg-coral/15 text-coral",
  2: "bg-sky/20 text-ink",
  3: "bg-lemon/30 text-ink",
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
  const [selectedLevel, setSelectedLevel] = useState<1 | 2 | 3>(1);

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
                3-level earning tree
              </p>
              <h2 className="mt-2 font-display text-2xl font-extrabold text-ink">
                Your referral network
              </h2>
              <p className="mt-1 max-w-lg text-xs font-bold leading-relaxed text-ink/55">
                Select a level below to view all clients in that tier. Commissions are credited
                instantly to your wallet on every paid ticket purchase.
              </p>
            </div>

            {/* Clickable Level Filter Buttons */}
            <div className="flex flex-wrap gap-2" role="tablist">
              {[1, 2, 3].map((lv) => {
                const isSelected = selectedLevel === lv;
                const count =
                  lv === 1
                    ? (data?.treeCounts?.l1 ?? data?.directRecruits ?? data?.recruits?.length ?? 0)
                    : lv === 2
                      ? (data?.treeCounts?.l2 ?? data?.recruitsByLevel?.l2?.length ?? 0)
                      : (data?.treeCounts?.l3 ?? data?.recruitsByLevel?.l3?.length ?? 0);
                return (
                  <button
                    key={lv}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => setSelectedLevel(lv as 1 | 2 | 3)}
                    className={cn(
                      "flex items-center gap-2 rounded-2xl px-3.5 py-2 transition-all text-xs font-extrabold cursor-pointer border",
                      isSelected
                        ? "bg-coral text-white border-coral shadow-md ring-2 ring-coral/20 scale-[1.02]"
                        : "bg-paper text-ink/75 hover:bg-cream/80 hover:text-ink border-ink/10",
                    )}
                  >
                    <span>Level {lv}</span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px]",
                        isSelected ? "bg-white/25 text-white" : "bg-coral/15 text-coral",
                      )}
                    >
                      {pctFor(lv)}
                    </span>
                    <span
                      className={cn(
                        "text-[10px] font-bold",
                        isSelected ? "text-white/85" : "text-ink/40",
                      )}
                    >
                      ({count})
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Level Info Banner */}
          <div className="mt-6 rounded-2xl bg-cream/70 p-4 ring-1 ring-ink/5 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2.5">
              <span className="grid size-7 place-items-center rounded-xl bg-coral text-white font-extrabold text-xs">
                L{selectedLevel}
              </span>
              <p className="text-xs font-extrabold text-ink">{levelDescriptions[selectedLevel]}</p>
            </div>
            <span className="text-[11px] font-bold text-ink/50">
              {(() => {
                const count =
                  selectedLevel === 1
                    ? (data?.recruitsByLevel?.l1?.length ?? data?.recruits?.length ?? 0)
                    : selectedLevel === 2
                      ? (data?.recruitsByLevel?.l2?.length ?? 0)
                      : (data?.recruitsByLevel?.l3?.length ?? 0);
                return `${count} client${count === 1 ? "" : "s"} at Level ${selectedLevel}`;
              })()}
            </span>
          </div>

          {/* Client List for Selected Level */}
          <div className="mt-6">
            {(() => {
              const clients =
                selectedLevel === 1
                  ? (data?.recruitsByLevel?.l1 ?? data?.recruits ?? [])
                  : selectedLevel === 2
                    ? (data?.recruitsByLevel?.l2 ?? [])
                    : (data?.recruitsByLevel?.l3 ?? []);

              if (clients.length === 0) {
                return (
                  <div className="rounded-2xl bg-paper/60 p-8 text-center ring-1 ring-ink/5">
                    <Users className="mx-auto size-7 text-ink/30" />
                    <p className="mt-2 text-sm font-extrabold text-ink">
                      No clients in Level {selectedLevel} yet
                    </p>
                    <p className="mt-1 text-xs max-w-md mx-auto font-medium text-ink/50 leading-relaxed">
                      {selectedLevel === 1 &&
                        "Share your referral link with friends. Anyone who signs up through your link becomes your Level 1 direct client and earns you 10% on every ticket purchase."}
                      {selectedLevel === 2 &&
                        "When your Level 1 direct referrals invite their own friends, those new users automatically join your Level 2 network and you earn 6% on every ticket purchase!"}
                      {selectedLevel === 3 &&
                        "When your Level 2 referrals invite others, they join your Level 3 network and you earn 4% on all their ticket purchases."}
                    </p>
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {clients.map((client) => (
                    <div
                      key={client.uid}
                      className="flex items-center gap-3.5 rounded-2xl bg-paper p-4 ring-1 ring-ink/5 transition-all hover:shadow-xs hover:border-coral/20"
                    >
                      <div className="grid size-11 place-items-center rounded-2xl bg-coral/10 font-display text-xs font-extrabold text-coral ring-2 ring-coral/25 shrink-0">
                        {client.initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-extrabold text-ink leading-tight">
                          {client.name}
                        </p>
                        <p className="truncate text-xs font-bold text-ink/45">
                          @{client.handle || "member"}
                        </p>
                        <div className="mt-1.5 flex items-center gap-2 text-[10px] font-bold text-ink/40">
                          <span>Joined {shortDate(client.joinedAtMs)}</span>
                          <span>•</span>
                          <span>{client.directRecruits} recruits</span>
                        </div>
                      </div>
                      <span className="shrink-0 rounded-full bg-coral/15 px-2.5 py-1 text-[10px] font-extrabold text-coral">
                        Earn {pctFor(selectedLevel)}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })()}
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

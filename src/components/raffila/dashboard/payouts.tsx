import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Check, ChevronDown, ShieldCheck, Building2, AlertCircle } from "lucide-react";

import { DashboardShell } from "@/components/raffila/dashboard/shell";
import { Button } from "@/components/ui/button";
import { formatNaira } from "@/lib/raffila-data";
import { cn } from "@/lib/utils";
import { useAuthSession } from "@/hooks/useAuthSession";
import {
  getReferralDashboard,
  requestReferralPayout,
  type GetReferralDashboardResult,
} from "@/lib/referral-server";

const banks = [
  "Access Bank",
  "Guaranty Trust Bank (GTB)",
  "Zenith Bank",
  "United Bank for Africa (UBA)",
  "First Bank of Nigeria",
  "Fidelity Bank",
  "Other bank",
];

type PayoutStatus = "PENDING" | "UNDER REVIEW" | "APPROVED" | "PAID" | "REJECTED";

type PayoutRow = {
  id: string;
  amountKobo: number;
  bank: string;
  accountNumber: string;
  accountName: string;
  status: string;
  createdAtMs: number;
  note: string;
};

const statusColor: Record<string, string> = {
  PENDING: "bg-lemon/40 text-ink",
  UNDER_REVIEW: "bg-sky/20 text-ink",
  UNDER: "bg-sky/20 text-ink",
  APPROVED: "bg-mint/30 text-ink",
  PROCESSING: "bg-sky/20 text-ink",
  PAID: "bg-coral/15 text-coral",
  REJECTED: "bg-rose/20 text-ink",
  FAILED: "bg-rose/20 text-ink",
  REVERSED: "bg-rose/20 text-ink",
};

function statusLabel(s: string): PayoutStatus | string {
  if (s === "UNDER_REVIEW" || s === "UNDER") return "UNDER REVIEW";
  return s;
}

function shortDateTime(ms: number): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function DashboardReferralsPayoutPage() {
  const { user } = useAuthSession();
  const uid = user?.id?.startsWith("firebase_")
    ? user.id.slice("firebase_".length)
    : (user?.id ?? "");
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "";
  const [data, setData] = useState<GetReferralDashboardResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [bank, setBank] = useState("Access Bank");
  const [accountName, setAccountName] = useState(fullName);
  const [accountNumber, setAccountNumber] = useState("");
  const [note, setNote] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableKobo = data?.availableKobo ?? 0;
  const minPayoutKobo = data?.minPayoutKobo ?? 5000_00;
  const minNaira = Math.round(minPayoutKobo / 100);
  const maxNaira = Math.floor(availableKobo / 100);
  const numAmount = Math.round(Number(amount) * 100) || 0;
  const overMax = numAmount > availableKobo;
  const underMin = numAmount > 0 && numAmount < minPayoutKobo;
  const disabled =
    submitting || !numAmount || overMax || underMin || !accountName || accountNumber.length < 10;

  const load = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    try {
      const res = await getReferralDashboard({ data: { uid } });
      setData(res);
    } catch {
      // Balance stays 0; the form still renders with the default minimum.
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async () => {
    if (disabled) return;
    setSubmitting(true);
    setError(null);
    try {
      await requestReferralPayout({
        data: {
          uid,
          bank,
          accountNumber,
          accountName,
          amountKobo: numAmount,
          note,
        },
      });
      setSubmitted(true);
      setAmount("");
      setAccountNumber("");
      setNote("");
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payout request failed");
    } finally {
      setSubmitting(false);
    }
  };

  const payouts: PayoutRow[] = data?.payouts ?? [];
  const pendingKobo = payouts
    .filter((p) => ["PENDING", "UNDER_REVIEW", "PROCESSING"].includes(p.status))
    .reduce((n, p) => n + p.amountKobo, 0);
  const paidKobo = payouts.filter((p) => p.status === "PAID").reduce((n, p) => n + p.amountKobo, 0);

  return (
    <DashboardShell activeNav="Referrals">
      <div className="mx-auto max-w-5xl space-y-6">
        <Link
          to="/dashboard/referrals"
          className="inline-flex items-center gap-1.5 text-sm font-extrabold text-ink/55 hover:text-ink"
        >
          <ArrowLeft className="size-4" /> Back to referrals
        </Link>

        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-coral">
            Referral earnings
          </p>
          <h1 className="mt-2 font-display text-4xl font-extrabold leading-tight tracking-tight text-ink sm:text-5xl">
            Request Payout
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-ink/60">
            Turn your available referral earnings into a bank transfer. Payouts are reviewed within
            24–48 hours.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="rounded-[28px] bg-paper p-6 ring-1 ring-ink/5 sm:p-8">
            {submitted ? (
              <div className="py-4 text-center">
                <div className="mx-auto grid size-20 place-items-center rounded-full bg-mint/30">
                  <Check className="size-10 text-coral" />
                </div>
                <h2 className="mt-5 font-display text-2xl font-extrabold text-ink sm:text-3xl">
                  Payout request submitted!
                </h2>
                <p className="mx-auto mt-2 max-w-sm text-sm font-bold leading-relaxed text-ink/55">
                  Expect review within 24–48 hours. You'll get an email once it's approved and paid.
                </p>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                  <Button
                    variant="outline"
                    size="md"
                    onClick={() => {
                      setSubmitted(false);
                      setAccountNumber("");
                      setNote("");
                    }}
                  >
                    Request another
                  </Button>
                  <Button asChild variant="primary" size="md">
                    <Link to="/dashboard/referrals">Back to referrals</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="rounded-2xl bg-mint/20 p-4 ring-1 ring-ink/5">
                  <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-ink/45">
                    Available balance
                  </p>
                  <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-display text-3xl font-extrabold text-ink sm:text-4xl">
                      {loading ? "—" : formatNaira(availableKobo)}
                    </p>
                    <button
                      onClick={() => setAmount(String(maxNaira))}
                      className="text-xs font-extrabold text-coral underline decoration-coral/40 underline-offset-4 hover:decoration-coral"
                    >
                      Use max
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 flex items-center justify-between text-xs font-extrabold uppercase tracking-[0.12em] text-ink/45">
                    <span>Amount (₦)</span>
                    <span className="font-bold normal-case tracking-normal text-ink/40">
                      Min ₦{minNaira.toLocaleString("en-NG")} · Max {formatNaira(availableKobo)}
                    </span>
                  </label>
                  <div className="flex min-h-12 items-center gap-2 rounded-2xl bg-cream px-4 ring-1 ring-ink/5 focus-within:ring-2 focus-within:ring-coral">
                    <span className="font-display text-xl font-extrabold text-ink">₦</span>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0"
                      className="w-full bg-transparent font-display text-2xl font-extrabold text-ink outline-none placeholder:text-ink/30"
                    />
                  </div>
                  {overMax && (
                    <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-rose/15 px-2.5 py-1 text-[10px] font-extrabold text-ink">
                      <AlertCircle className="size-3" /> Available balance is{" "}
                      {formatNaira(availableKobo)}
                    </p>
                  )}
                  {underMin && (
                    <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-rose/15 px-2.5 py-1 text-[10px] font-extrabold text-ink">
                      <AlertCircle className="size-3" /> Minimum payout is ₦
                      {minNaira.toLocaleString("en-NG")}
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-extrabold uppercase tracking-[0.12em] text-ink/45">
                    Bank name
                  </label>
                  <div className="relative">
                    <select
                      value={bank}
                      onChange={(e) => setBank(e.target.value)}
                      className="min-h-12 w-full appearance-none rounded-2xl bg-cream px-4 pr-10 text-sm font-extrabold text-ink outline-none ring-1 ring-ink/5 focus:ring-2 focus:ring-coral"
                    >
                      {banks.map((b) => (
                        <option key={b}>{b}</option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-ink/40" />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-extrabold uppercase tracking-[0.12em] text-ink/45">
                      Account name
                    </label>
                    <input
                      value={accountName}
                      onChange={(e) => setAccountName(e.target.value)}
                      placeholder="As written on your bank app"
                      className="min-h-12 w-full rounded-2xl bg-cream px-4 text-sm font-bold text-ink ring-1 ring-ink/5 outline-none placeholder:text-ink/35 focus:ring-2 focus:ring-coral"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-extrabold uppercase tracking-[0.12em] text-ink/45">
                      Account number
                    </label>
                    <input
                      value={accountNumber}
                      onChange={(e) =>
                        setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 10))
                      }
                      placeholder="10-digit NUBAN"
                      inputMode="numeric"
                      className="min-h-12 w-full rounded-2xl bg-cream px-4 font-mono text-sm font-bold text-ink ring-1 ring-ink/5 outline-none placeholder:text-ink/35 focus:ring-2 focus:ring-coral"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-extrabold uppercase tracking-[0.12em] text-ink/45">
                    Note{" "}
                    <span className="font-bold normal-case tracking-normal text-ink/35">
                      (optional)
                    </span>
                  </label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                    placeholder="Anything the team should know about this payout."
                    className="w-full resize-none rounded-2xl bg-cream px-4 py-3 text-sm font-bold text-ink ring-1 ring-ink/5 outline-none placeholder:text-ink/35 focus:ring-2 focus:ring-coral"
                  />
                </div>

                {error ? (
                  <div className="flex items-start gap-2 rounded-2xl bg-rose/10 p-3 text-xs font-bold text-ink ring-1 ring-rose/20">
                    <AlertCircle className="mt-0.5 size-4 shrink-0 text-coral" /> {error}
                  </div>
                ) : null}

                <div className="flex items-start gap-3 rounded-2xl bg-cream p-4 ring-1 ring-ink/5">
                  <ShieldCheck className="mt-0.5 size-5 shrink-0 text-coral" />
                  <div className="text-[11px] font-bold leading-relaxed text-ink/55">
                    Payouts are reviewed for compliance. Bank details must match your profile to
                    avoid rejection.
                  </div>
                </div>

                <Button
                  variant="primary"
                  size="lg"
                  className="w-full"
                  disabled={disabled}
                  onClick={() => void submit()}
                >
                  {submitting ? "Submitting…" : "Confirm payout request"}
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="rounded-[28px] bg-coral p-6 text-cream shadow-[0_8px_20px_-8px_var(--coral)] ring-1 ring-coral/30 sm:p-7">
              <div className="flex items-center gap-2">
                <Building2 className="size-5" />
                <h3 className="font-display text-xl font-extrabold">Payouts overview</h3>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-3">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-cream/60">
                    Available
                  </p>
                  <p className="mt-1 font-display text-xl font-extrabold">
                    {loading ? "—" : formatNaira(availableKobo)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-cream/60">
                    Pending
                  </p>
                  <p className="mt-1 font-display text-xl font-extrabold">
                    {formatNaira(pendingKobo)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-cream/60">
                    Paid
                  </p>
                  <p className="mt-1 font-display text-xl font-extrabold">
                    {formatNaira(paidKobo)}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] bg-paper p-6 ring-1 ring-ink/5">
              <h3 className="font-display text-lg font-extrabold text-ink">Payout history</h3>
              <p className="mt-1 text-xs font-bold text-ink/45">Your latest payout requests.</p>
              <div className="mt-5 overflow-hidden rounded-2xl ring-1 ring-ink/5">
                <table className="w-full text-left text-sm">
                  <thead className="bg-cream text-[10px] font-extrabold uppercase tracking-[0.12em] text-ink/45">
                    <tr>
                      <th className="px-3 py-2.5">Reference</th>
                      <th className="px-3 py-2.5 text-right">Amount</th>
                      <th className="px-3 py-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink/10">
                    {payouts.length === 0 ? (
                      <tr>
                        <td
                          colSpan={3}
                          className="px-3 py-8 text-center text-xs font-bold text-ink/45"
                        >
                          No payout requests yet.
                        </td>
                      </tr>
                    ) : (
                      payouts.map((p) => (
                        <tr key={p.id} className="hover:bg-cream/40">
                          <td className="px-3 py-2.5">
                            <p className="font-mono text-[10px] font-bold text-ink/70">
                              {p.id.slice(0, 8).toUpperCase()}
                            </p>
                            <p className="text-[10px] font-bold text-ink/45">
                              {p.bank} · {shortDateTime(p.createdAtMs)}
                            </p>
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-right font-display text-sm font-extrabold text-ink">
                            {formatNaira(p.amountKobo)}
                          </td>
                          <td className="px-3 py-2.5">
                            <span
                              className={cn(
                                "inline-flex rounded-full px-2 py-0.5 text-[10px] font-extrabold",
                                statusColor[p.status] ?? "bg-ink/10 text-ink",
                              )}
                            >
                              {statusLabel(p.status)}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}

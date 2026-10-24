import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Search, Copy, Check, FileDown, Ticket, Eye, X, Trophy, Share2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useMemo } from "react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";

import { DashboardAppShell } from "@/components/raffila/dashboard/app-shell";
import { Button } from "@/components/ui/button";
import { formatNaira, trackEvent } from "@/lib/raffila-data";
import { cn } from "@/lib/utils";
import { useAuthSession } from "@/hooks/useAuthSession";
import { useCompetitions, findCompetition, isCompetitionConcluded } from "@/hooks/useCompetitions";
import { db } from "@/lib/firebase";
import { ensureReferralCode } from "@/lib/referral-server";
import { ticketQrValue } from "@/lib/referral-core";

type EntryStatus = "Entered" | "Won" | "Lost" | "Completed";

type MockEntry = {
  id: string;
  competitionTitle: string;
  competitionSlug: string;
  competitionImage: string;
  competitionImageAlt: string;
  ticketCount: number;
  drawDate: string;
  ticketNumbers: string[];
  status: EntryStatus;
  isUserWinner?: boolean;
  winningTicketNumber?: string | null;
};

const statuses: Array<"All" | "Active" | "Completed" | "Won"> = [
  "All",
  "Active",
  "Completed",
  "Won",
];

const statusBadge: Record<string, string> = {
  Entered: "bg-mint/30 text-ink",
  Active: "bg-mint/30 text-ink",
  Won: "bg-[#D4AF37]/20 text-[#0A261B] ring-1 ring-[#D4AF37]/40 font-extrabold",
  Lost: "bg-ink/10 text-ink/70",
  Completed: "bg-ink/10 text-ink/70",
};

const initials = (name: string) =>
  name
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

type RawEntry = {
  entryId: string;
  competitionSlug: string;
  competitionTitle: string;
  competitionImage: string;
  quantity: number;
  ticketNumbers: string[];
  status: string;
};

export function DashboardEntriesPage() {
  const { user } = useAuthSession();
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "User";
  const [filter, setFilter] = useState<(typeof statuses)[number]>("All");
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toastId, setToastId] = useState<string | null>(null);
  const [ticketOpen, setTicketOpen] = useState<MockEntry | null>(null);
  const [rawEntries, setRawEntries] = useState<RawEntry[]>([]);
  const { competitions } = useCompetitions();
  const uid = user?.id?.startsWith("firebase_")
    ? user.id.slice("firebase_".length)
    : (user?.id ?? "");

  // The ticket QR doubles as this user's invite link, so scanning it opens
  // the competition with referral attribution.
  const [refCode, setRefCode] = useState<string | null>(null);
  const [inviteCopied, setInviteCopied] = useState(false);
  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    void ensureReferralCode({ data: { uid } })
      .then((res) => {
        if (!cancelled && res.ok) setRefCode(res.code);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [uid]);

  const inviteUrlFor = (slug: string, entryId: string) =>
    ticketQrValue({
      origin: typeof window !== "undefined" ? window.location.origin : "https://raffila.com",
      refCode,
      competitionSlug: slug,
      entryId,
    });

  const copyInviteLink = (slug: string, entryId: string) => {
    navigator.clipboard?.writeText(inviteUrlFor(slug, entryId)).catch(() => {});
    setInviteCopied(true);
    setTimeout(() => setInviteCopied(false), 1800);
  };

  useEffect(() => {
    trackEvent("my_entries_view", {});
  }, []);

  // Live entries written server-side on confirmed payment (Paystack or
  // referral). Clients can read their own subcollection but never write it.
  useEffect(() => {
    if (!uid) {
      setRawEntries([]);
      return;
    }
    const q = query(
      collection(db, "users", uid, "entries"),
      orderBy("createdAt", "desc"),
      limit(100),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setRawEntries(
          snap.docs.map((d) => {
            const v = d.data() as Record<string, unknown>;
            const nums = Array.isArray(v["ticketNumbers"]) ? (v["ticketNumbers"] as unknown[]) : [];
            return {
              entryId: String(v["entryId"] ?? d.id),
              competitionSlug: String(v["competitionSlug"] ?? ""),
              competitionTitle: String(v["competitionTitle"] ?? "Competition"),
              competitionImage: String(v["competitionImage"] ?? ""),
              quantity: Number(v["quantity"] ?? nums.length) || nums.length,
              ticketNumbers: nums.map((n) => String(n)),
              status: String(v["status"] ?? "CONFIRMED"),
            };
          }),
        );
      },
      () => setRawEntries([]),
    );
    return () => unsub();
  }, [uid]);

  const entries: MockEntry[] = useMemo<MockEntry[]>(
    () =>
      rawEntries.map((e) => {
        const comp = findCompetition(competitions, e.competitionSlug);
        const isConcluded = isCompetitionConcluded(comp);
        const winTkt = comp?.winnerTicketNumber || comp?.winningTicketNumber;
        const isUserWinner =
          e.status === "WON" ||
          (comp && comp.winnerUserId === uid) ||
          (Boolean(winTkt) && e.ticketNumbers.some((t) => String(t) === String(winTkt)));

        const status: EntryStatus = isUserWinner ? "Won" : isConcluded ? "Completed" : "Entered";

        return {
          id: e.entryId,
          competitionTitle: e.competitionTitle || comp?.title || "Competition",
          competitionSlug: e.competitionSlug,
          competitionImage: e.competitionImage || comp?.image || "",
          competitionImageAlt: `${e.competitionTitle || comp?.title} prize`,
          ticketCount: e.quantity,
          drawDate: comp?.drawDate ?? "—",
          ticketNumbers: e.ticketNumbers,
          status,
          isUserWinner,
          winningTicketNumber: winTkt ? String(winTkt) : null,
        };
      }),
    [rawEntries, competitions, uid],
  );

  const filtered = entries.filter((e) => {
    const isActive = e.status === "Entered";
    const matchesStatus =
      filter === "All" ||
      (filter === "Active" && isActive) ||
      (filter === "Completed" && (e.status === "Completed" || e.status === "Won")) ||
      (filter === "Won" && e.status === "Won");
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q || e.id.toLowerCase().includes(q) || e.competitionTitle.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const copyId = (id: string) => {
    navigator.clipboard?.writeText(id).catch(() => {});
    setCopiedId(id);
    setToastId(id);
    setTimeout(() => {
      setCopiedId(null);
      setToastId((t) => (t === id ? null : t));
    }, 1600);
  };

  return (
    <DashboardAppShell
      title="Entries"
      breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "My Entries" }]}
    >
      <div className="space-y-6">
        <div className="grid gap-3 rounded-[24px] bg-paper p-4 ring-1 ring-ink/5 sm:p-5 lg:grid-cols-3">
          <div className="rounded-2xl bg-cream/60 p-4 ring-1 ring-ink/5">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink/45">
              What did I pay for?
            </p>
            <p className="mt-1 text-sm font-extrabold text-ink">
              Every prize + receipt in one place
            </p>
          </div>
          <div className="rounded-2xl bg-cream/60 p-4 ring-1 ring-ink/5">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink/45">
              How many entries?
            </p>
            <p className="mt-1 text-sm font-extrabold text-ink">Ticket counts + numbers per draw</p>
          </div>
          <div className="rounded-2xl bg-cream/60 p-4 ring-1 ring-ink/5">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink/45">
              When is the draw?
            </p>
            <p className="mt-1 text-sm font-extrabold text-ink">
              Draw dates + results, one tap away
            </p>
          </div>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-[24px] bg-lemon/30 p-5 ring-1 ring-ink/5">
            <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-ink/45">
              Payment history
            </p>
            <p className="mt-1 text-sm font-bold text-ink/65">
              Simple receipts and status live with each entry. Export CSV anytime.
            </p>
          </div>
          <div className="rounded-[24px] bg-paper p-5 ring-1 ring-ink/5">
            <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-ink/45">
              Support
            </p>
            <p className="mt-1 text-sm font-bold text-ink/65">
              Need help with an entry?{" "}
              <Link to="/faq" className="font-extrabold text-coral underline underline-offset-2">
                Get help with this entry
              </Link>
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <p className="max-w-2xl text-sm leading-relaxed text-ink/60 -mt-3">
            All your competition tickets, their status, and ticket numbers.
          </p>
          <Button
            variant="outline"
            size="md"
            onClick={() => {
              const csv =
                "Entry ID,Competition,Ticket count,Draw date,Status,Ticket numbers\n" +
                entries
                  .map(
                    (e) =>
                      `${e.id},"${e.competitionTitle}",${e.ticketCount},${e.drawDate},${e.status},"${e.ticketNumbers.join(", ")}"`,
                  )
                  .join("\n");
              const blob = new Blob([csv], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "raffila-entries.csv";
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            <FileDown className="size-4" /> Export CSV
          </Button>
        </div>

        <div className="rounded-[24px] bg-white p-4 ring-1 ring-ink/5 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <label className="flex min-h-12 flex-1 items-center gap-3 rounded-full bg-cream px-4 text-sm font-bold text-ink/50 ring-1 ring-ink/5 focus-within:ring-2 focus-within:ring-coral/20 transition-all">
              <Search className="size-4 shrink-0 text-ink/45" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search entry ID, competition..."
                className="w-full bg-transparent text-ink outline-none placeholder:text-ink/40"
              />
            </label>
          </div>

          <div className="mt-4 inline-flex flex-wrap gap-1 rounded-2xl bg-cream p-1 ring-1 ring-ink/5">
            {statuses.map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={cn(
                  "rounded-xl px-4 py-2 text-xs font-extrabold transition-all duration-200",
                  filter === s
                    ? "bg-white text-ink shadow-sm ring-1 ring-ink/5"
                    : "text-ink/55 hover:text-ink hover:bg-white/50",
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {toastId && (
          <div className="fixed top-4 right-4 z-50 inline-flex items-center gap-2 rounded-full bg-mint/90 px-4 py-2.5 text-xs font-extrabold text-ink shadow-lg ring-1 ring-ink/5">
            <Check className="size-4" /> Entry ID copied
          </div>
        )}

        {entries.some((e) => e.status === "Won") && (
          <div className="rounded-[24px] bg-gradient-to-r from-[#0D2F24] via-[#144C39] to-[#0A261B] p-6 text-cream ring-1 ring-[#D4AF37]/40 shadow-xl">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[#D4AF37]/20 text-[#D4AF37]">
                  <Trophy className="size-7 text-[#D4AF37]" />
                </span>
                <div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#D4AF37]/20 px-3 py-1 text-xs font-extrabold text-[#D4AF37]">
                    🎉 WINNER VERIFIED
                  </span>
                  <h3 className="mt-1 font-display text-xl sm:text-2xl font-extrabold text-white">
                    Congratulations! You have a winning ticket!
                  </h3>
                  <p className="text-xs sm:text-sm text-cream/75">
                    Your winning ticket was selected and verified in the official prize draw. Click
                    below to view the draw replay or verify your prize claim.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  asChild
                  size="md"
                  className="bg-[#D4AF37] hover:bg-[#E5C158] text-[#0A261B] font-extrabold shadow-md"
                >
                  <Link to="/winners">🏆 View in Winners Circle</Link>
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-[24px] bg-white p-6 ring-1 ring-ink/5 sm:p-8">
          <div className="overflow-x-auto -mx-4 px-4">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="bg-cream text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink/45">
                <tr>
                  <th className="px-4 py-3">Entry ID</th>
                  <th className="px-4 py-3">Competition</th>
                  <th className="px-4 py-3 text-center">Tickets</th>
                  <th className="px-4 py-3">Draw date</th>
                  <th className="px-4 py-3">Ticket numbers</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/10">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="grid size-12 place-items-center rounded-2xl bg-coral/10">
                          <Ticket className="size-5 text-coral" />
                        </div>
                        <div>
                          <p className="text-sm font-extrabold text-ink">No entries found</p>
                          <p className="mt-1 text-xs font-bold text-ink/45">
                            {search || filter !== "All"
                              ? "Try a different search or filter"
                              : "Browse competitions to enter your first draw"}
                          </p>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((e) => (
                    <tr key={e.id} className="hover:bg-cream/40">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-ink/70">{e.id}</span>
                          <button
                            onClick={() => copyId(e.id)}
                            className={cn(
                              "grid size-6 place-items-center rounded-full transition-colors",
                              copiedId === e.id
                                ? "bg-mint/30 text-ink"
                                : "bg-cream text-ink/45 hover:text-coral",
                            )}
                            aria-label="Copy"
                          >
                            {copiedId === e.id ? (
                              <Check className="size-3" />
                            ) : (
                              <Copy className="size-3" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="size-11 shrink-0 overflow-hidden rounded-xl ring-1 ring-ink/10">
                            <img
                              src={e.competitionImage}
                              alt={`${e.competitionTitle} prize`}
                              loading="lazy"
                              decoding="async"
                              className="h-full w-full object-cover"
                            />
                          </div>
                          <span className="text-sm font-extrabold text-ink line-clamp-1 max-w-[220px]">
                            {e.competitionTitle}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center font-display font-extrabold text-ink">
                        {e.ticketCount}
                      </td>
                      <td className="px-4 py-3 text-xs font-bold text-ink/50">{e.drawDate}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1 max-w-[260px]">
                          {e.ticketNumbers.map((n) => (
                            <span
                              key={n}
                              className="inline-flex items-center rounded-full bg-cream px-2 py-0.5 font-mono text-[10px] font-bold text-ink/70 ring-1 ring-ink/5"
                            >
                              {n}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2.5 py-1 text-[10px] font-extrabold",
                            statusBadge[e.status],
                          )}
                        >
                          {e.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {e.status === "Won" && (
                            <Button
                              asChild
                              size="sm"
                              className="bg-[#D4AF37] hover:bg-[#E5C158] text-[#0A261B] font-extrabold text-xs"
                            >
                              <Link
                                to="/competitions/$slug/draw"
                                params={{ slug: e.competitionSlug }}
                              >
                                🎯 Draw
                              </Link>
                            </Button>
                          )}
                          {e.status === "Completed" && (
                            <Button asChild variant="outline" size="sm" className="text-xs">
                              <Link
                                to="/competitions/$slug/draw"
                                params={{ slug: e.competitionSlug }}
                              >
                                Draw
                              </Link>
                            </Button>
                          )}
                          <Button variant="outline" size="sm" onClick={() => setTicketOpen(e)}>
                            <Eye className="size-3.5" /> View ticket
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {ticketOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center"
          onClick={() => setTicketOpen(null)}
        >
          <div
            className="w-full max-w-md rounded-[28px] bg-white p-6 ring-1 ring-ink/5 sm:p-8 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-ink/45">
                  Entry ticket
                </p>
                <h2 className="mt-1 font-display text-2xl font-extrabold text-ink">
                  {ticketOpen.competitionTitle}
                </h2>
              </div>
              <button
                onClick={() => setTicketOpen(null)}
                className="grid size-10 shrink-0 place-items-center rounded-full bg-cream text-ink ring-1 ring-ink/5"
                aria-label="Close ticket details"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="mt-6 rounded-2xl bg-cream p-6 ring-1 ring-ink/5 flex flex-col items-center">
              {(() => {
                // The QR is a scannable invite URL for this competition:
                // anyone who scans it lands on /invite/{code}?comp={slug},
                // which records the referral and opens the draw. The entry id
                // rides along (?e=) so the code is also unique per purchase.
                const qrValue = inviteUrlFor(ticketOpen.competitionSlug, ticketOpen.id);
                return (
                  <div className="size-40 grid place-items-center rounded-2xl bg-white p-3 ring-1 ring-ink/10">
                    <QRCodeSVG
                      value={qrValue}
                      size={112}
                      bgColor="#ffffff"
                      fgColor="#172a23"
                      level="M"
                      title={`Entry ${ticketOpen.id}`}
                    />
                  </div>
                );
              })()}
              <p className="mt-4 font-mono text-xs font-bold text-ink/60">{ticketOpen.id}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => copyInviteLink(ticketOpen.competitionSlug, ticketOpen.id)}
              >
                {inviteCopied ? (
                  <>
                    <Check className="size-3.5" /> Invite link copied
                  </>
                ) : (
                  <>
                    <Share2 className="size-3.5" /> Copy invite link
                  </>
                )}
              </Button>
              <p className="mt-2 text-[11px] font-bold text-ink/45">
                Scanning this QR sends friends to this competition as your referral.
              </p>
            </div>

            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between rounded-2xl bg-cream px-4 py-3 ring-1 ring-ink/5">
                <span className="text-xs font-extrabold uppercase tracking-[0.12em] text-ink/45">
                  Tickets
                </span>
                <span className="font-display text-lg font-extrabold text-ink">
                  {ticketOpen.ticketCount}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-cream px-4 py-3 ring-1 ring-ink/5">
                <span className="text-xs font-extrabold uppercase tracking-[0.12em] text-ink/45">
                  Draw date
                </span>
                <span className="text-sm font-extrabold text-ink">{ticketOpen.drawDate}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-cream px-4 py-3 ring-1 ring-ink/5">
                <span className="text-xs font-extrabold uppercase tracking-[0.12em] text-ink/45">
                  Status
                </span>
                <span
                  className={cn(
                    "inline-flex rounded-full px-2.5 py-1 text-[10px] font-extrabold",
                    statusBadge[ticketOpen.status],
                  )}
                >
                  {ticketOpen.status.toUpperCase()}
                </span>
              </div>
            </div>

            <div className="mt-6">
              <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-ink/45 mb-2">
                Your ticket numbers
              </p>
              <div className="grid grid-cols-5 gap-2">
                {ticketOpen.ticketNumbers.map((n) => (
                  <div key={n} className="rounded-xl bg-lilac/20 p-2 text-center ring-1 ring-ink/5">
                    <p className="font-mono text-[11px] font-extrabold text-ink">{n}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 rounded-2xl bg-coral/10 p-4 ring-1 ring-coral/20">
              <div className="flex items-center gap-3">
                <div className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-coral/15 font-display text-sm font-extrabold text-coral">
                  {user?.avatarUrl ? (
                    <img src={user.avatarUrl} alt="" className="size-full object-cover" />
                  ) : (
                    initials(fullName)
                  )}
                </div>
                <div>
                  <p className="text-sm font-extrabold text-ink">{fullName}</p>
                  <p className="text-[11px] font-bold text-ink/45">@{user?.handle || "user"}</p>
                </div>
              </div>
            </div>

            <Button
              variant="primary"
              size="lg"
              className="mt-6 w-full"
              onClick={() => setTicketOpen(null)}
            >
              <Ticket className="size-4" /> Close ticket
            </Button>
          </div>
        </div>
      )}
    </DashboardAppShell>
  );
}

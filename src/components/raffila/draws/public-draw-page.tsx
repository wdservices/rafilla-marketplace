import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { Link, useParams } from "@tanstack/react-router";
import {
  ArrowLeft,
  CalendarDays,
  ShieldCheck,
  Ticket,
  Users,
  Trophy,
  ExternalLink,
  Sparkles,
  Lock,
  RotateCcw,
} from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  listenDrawRecord,
  fetchEligibleTickets,
  type DrawRecord,
  type EligibleTicket,
  type DrawStage,
} from "@/lib/draw-system";
import { useCompetitions, findCompetition } from "@/hooks/useCompetitions";
import { WheelOfFortune } from "./wheel-of-fortune";
import { DrawVerificationPanel } from "./draw-verification-panel";
import { WinnerCelebrationModal } from "./winner-celebration-modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import mercedesImage from "@/assets/raffila-mercedes.jpg";

interface PublicDrawPageProps {
  slug?: string;
}

export function PublicDrawPage({ slug: propSlug }: PublicDrawPageProps) {
  const params = useParams({ strict: false }) as { slug?: string; campaign?: string };
  const slug = propSlug || params.slug || params.campaign || "mercedes-benz-c-class";

  const { competitions } = useCompetitions();
  const catalogComp = useMemo(() => findCompetition(competitions, slug), [competitions, slug]);

  const [compData, setCompData] = useState<Record<string, unknown> | null>(null);
  const [tickets, setTickets] = useState<EligibleTicket[]>([]);
  const [drawRecord, setDrawRecord] = useState<DrawRecord | null>(null);
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [showCelebration, setShowCelebration] = useState(false);
  const [localSpinning, setLocalSpinning] = useState(false);
  // Replay of an already-finished draw: `replayStart` is the timestamp the
  // re-spin was kicked off with, and `replayCelebrates` controls whether the
  // winner modal fires when it lands.
  const [replayStart, setReplayStart] = useState<number | null>(null);
  const [replayCelebrates, setReplayCelebrates] = useState(false);
  const sawLiveSpinRef = useRef(false);
  const didAutoReplayRef = useRef(false);

  const startReplay = useCallback((celebrates: boolean) => {
    setReplayCelebrates(celebrates);
    setReplayStart(Date.now());
    setShowCelebration(false);
  }, []);

  // 1. Fetch competition document
  useEffect(() => {
    let cancelled = false;
    async function loadComp() {
      try {
        const snap = await getDoc(doc(db, "competitions", slug));
        if (snap.exists() && !cancelled) {
          setCompData(snap.data() as Record<string, unknown>);
        }
      } catch (err) {
        console.warn("Failed to load competition doc:", err);
      }
    }
    void loadComp();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // 2. Fetch real eligible tickets for the wheel
  useEffect(() => {
    let cancelled = false;
    async function loadTickets() {
      setTicketsLoading(true);
      try {
        const tkts = await fetchEligibleTickets(slug);
        if (!cancelled) {
          setTickets(tkts);
        }
      } catch (err) {
        console.warn("Failed to fetch eligible tickets:", err);
      } finally {
        if (!cancelled) setTicketsLoading(false);
      }
    }
    void loadTickets();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // 3. Real-time Firestore synchronization of Draw Record
  useEffect(() => {
    const unsub = listenDrawRecord(slug, (rec) => {
      setDrawRecord(rec);

      if (rec?.stage === "SPINNING") {
        sawLiveSpinRef.current = true;
        setLocalSpinning(true);
      } else if (rec?.stage === "REVEALED" || rec?.stage === "COMPLETED") {
        setLocalSpinning(false);
        if (!rec.winningTicketNumber) return;

        if (sawLiveSpinRef.current) {
          // We watched the live draw spin out — celebrate the result.
          setShowCelebration(true);
        } else if (!didAutoReplayRef.current) {
          // Arrived at an already-finished draw: replay it once instead of
          // blanketing the wheel with the celebration modal.
          didAutoReplayRef.current = true;
          startReplay(false);
        }
      }
    });

    return () => {
      unsub();
    };
  }, [slug, startReplay]);

  // Derived metadata
  const compTitle = String(
    compData?.["title"] ?? compData?.["assetName"] ?? catalogComp?.title ?? slug.replace(/-/g, " "),
  );
  const compImage = String(compData?.["image"] ?? catalogComp?.image ?? mercedesImage);
  const scheduledDrawDate = String(
    compData?.["drawDate"] ?? compData?.["closes"] ?? catalogComp?.drawDate ?? "Today",
  );

  const eligibleCount = drawRecord?.eligibleTicketCount || tickets.length;
  const participantCount =
    drawRecord?.eligibleParticipantCount ||
    new Set(tickets.map((t) => t.userId).filter(Boolean)).size;

  const currentStage: DrawStage = drawRecord?.stage || "READY";
  const isFinished = currentStage === "COMPLETED" || drawRecord?.status === "COMPLETED";
  const isReplaying = replayStart !== null;
  const isWheelSpinning = localSpinning || currentStage === "SPINNING" || isReplaying;

  // Handle spin finish on the public wheel
  const handleSpinComplete = useCallback(() => {
    setLocalSpinning(false);
    if (replayStart !== null) {
      const celebrates = replayCelebrates;
      setReplayStart(null);
      if (celebrates) setShowCelebration(true);
      return;
    }
    if (drawRecord?.winningTicketNumber) {
      setShowCelebration(true);
    }
  }, [replayStart, replayCelebrates, drawRecord]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#061D15] via-[#0A291E] to-[#04140D] text-[#F7F4EB]">
      {/* Top Navigation Bar */}
      <div className="border-b border-[#C5A059]/20 bg-[#061D15]/80 backdrop-blur-md sticky top-0 z-40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
          <Link
            to="/competitions/$slug"
            params={{ slug }}
            className="inline-flex items-center gap-2 text-xs font-bold text-white/70 hover:text-white transition-colors"
          >
            <ArrowLeft className="size-4" />
            Back to Competition
          </Link>

          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-xs font-bold text-[#D4AF37]">
              <span className="size-2 rounded-full bg-[#10B981] animate-ping" />
              Live Draw Channel
            </span>

            <Link
              to="/draw-verification/$slug"
              params={{ slug }}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-semibold hover:bg-white/10 transition-colors"
            >
              <ShieldCheck className="size-3.5 text-[#10B981]" />
              Verify Audit
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content Container */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Header Hero Section */}
        <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-full bg-[#D4AF37]/20 border border-[#D4AF37]/50 text-[#F3E5AB] text-xs font-extrabold uppercase tracking-wider">
                Official Prize Draw
              </span>
              <span className="text-white/40 text-xs">·</span>
              <span className="text-white/60 text-xs font-semibold flex items-center gap-1">
                <CalendarDays className="size-3.5 text-[#D4AF37]" />
                Scheduled: {scheduledDrawDate}
              </span>
            </div>

            <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#F7F4EB] tracking-tight">
              {compTitle}
            </h1>
          </div>

          {/* Quick Metrics Header Badges */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-black/40 border border-[#C5A059]/30">
              <Ticket className="size-4 text-[#D4AF37]" />
              <div>
                <span className="text-[10px] text-white/50 font-bold uppercase block leading-none">
                  Eligible Tickets
                </span>
                <span className="font-display text-base font-extrabold text-white tabular-nums">
                  {eligibleCount.toLocaleString("en-NG")}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-black/40 border border-[#C5A059]/30">
              <Users className="size-4 text-[#10B981]" />
              <div>
                <span className="text-[10px] text-white/50 font-bold uppercase block leading-none">
                  Participants
                </span>
                <span className="font-display text-base font-extrabold text-white tabular-nums">
                  {participantCount.toLocaleString("en-NG")}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* =========================================================================
            DESKTOP & MOBILE GRID:
            - Desktop: ~2/3 Wheel of Fortune on the left, ~1/3 Verification panel on the right.
            - Mobile: Wheel on top, Verification panel underneath.
            ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LEFT 2/3 COLUMN: LARGE WHEEL OF FORTUNE */}
          <div className="lg:col-span-8 flex flex-col items-center justify-center rounded-3xl bg-black/25 border border-[#C5A059]/25 p-6 sm:p-10 shadow-2xl relative overflow-hidden backdrop-blur-sm">
            {/* Ambient Background Radial Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-[480px] rounded-full bg-[#10B981]/10 blur-3xl pointer-events-none" />

            {/* Live Draw Status Banner */}
            <div className="w-full mb-6 flex items-center justify-between text-xs font-bold px-4 py-2.5 rounded-2xl bg-[#09261C] border border-[#C5A059]/30 shadow-inner">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "size-2.5 rounded-full",
                    isWheelSpinning
                      ? "bg-[#D4AF37] animate-ping"
                      : isFinished
                        ? "bg-[#10B981]"
                        : "bg-[#F3E5AB]",
                  )}
                />
                <span className="text-[#F3E5AB]">
                  {isReplaying
                    ? "Replay in progress · Rewinding the recorded draw"
                    : isWheelSpinning
                      ? "Wheel in motion · Live selection underway"
                      : isFinished
                        ? "Draw completed · Official winner confirmed"
                        : "Wheel standby · Waiting for draw broadcast"}
                </span>
              </div>

              {drawRecord?.verificationReference && (
                <span className="font-mono text-white/60 text-[11px] hidden sm:inline">
                  Ref: {drawRecord.verificationReference}
                </span>
              )}
            </div>

            {/* Large Prominent Wheel Component */}
            <WheelOfFortune
              tickets={tickets}
              winningTicketNumber={drawRecord?.winningTicketNumber ?? null}
              isSpinning={isWheelSpinning}
              spinStartTime={isReplaying ? replayStart : (drawRecord?.spinStartTime ?? null)}
              spinDurationMs={drawRecord?.spinDurationMs || 7500}
              onSpinComplete={handleSpinComplete}
              size="lg"
            />

            {/* Replay control: a finished draw can be re-watched on demand */}
            {isFinished && drawRecord?.winningTicketNumber && !isWheelSpinning && (
              <button
                type="button"
                onClick={() => startReplay(true)}
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#D4AF37] px-5 py-2.5 text-xs font-extrabold uppercase tracking-wider text-[#0A261B] shadow-lg transition-colors hover:bg-[#FFF]"
              >
                <RotateCcw className="size-4" />
                Replay the draw
              </button>
            )}

            {/* Post-draw Winner Card inside Wheel panel if completed */}
            {isFinished && drawRecord?.winningTicketNumber && (
              <div className="mt-8 w-full max-w-md rounded-2xl bg-gradient-to-r from-[#D4AF37]/20 via-[#10B981]/20 to-[#D4AF37]/20 border border-[#D4AF37]/50 p-4 text-center shadow-lg">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#D4AF37] block">
                  Official Winner
                </span>
                <p className="font-display text-xl font-extrabold text-white mt-0.5">
                  {drawRecord.winnerDisplayName}
                </p>
                <p className="font-mono text-sm font-bold text-[#F3E5AB] mt-1">
                  Winning Ticket #{drawRecord.winningTicketNumber}
                </p>
                <button
                  type="button"
                  onClick={() => setShowCelebration(true)}
                  className="mt-3 inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#D4AF37] text-[#0A261B] text-xs font-extrabold hover:bg-[#FFF] transition-colors shadow"
                >
                  <Trophy className="size-3.5" />
                  View Winner Celebration
                </button>
              </div>
            )}
          </div>

          {/* RIGHT 1/3 COLUMN: COMPACT DRAW VERIFICATION PANEL + PRIZE CARD */}
          <div className="lg:col-span-4 space-y-6">
            {/* Draw Verification Panel */}
            <DrawVerificationPanel
              record={drawRecord}
              stage={currentStage}
              eligibleTicketCount={eligibleCount}
              participantCount={participantCount}
              competitionSlug={slug}
            />

            {/* Prize Showcase Card */}
            <div className="rounded-3xl bg-[#09251B] border border-[#C5A059]/30 p-5 overflow-hidden shadow-lg">
              <div className="relative aspect-[16/10] rounded-2xl overflow-hidden border border-white/10 mb-4">
                <img src={compImage} alt={compTitle} className="size-full object-cover" />
                <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur text-[10px] font-bold text-white uppercase">
                  Grand Prize
                </div>
              </div>

              <h4 className="font-display text-base font-extrabold text-white leading-tight">
                {compTitle}
              </h4>
              <p className="text-xs text-white/60 mt-1">
                Verified delivery to the confirmed winning ticket holder anywhere in Nigeria.
              </p>

              <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs">
                <span className="text-white/50 flex items-center gap-1">
                  <Lock className="size-3 text-[#10B981]" />
                  100% Guaranteed Draw
                </span>
                <Link to="/competition-rules" className="text-[#D4AF37] font-bold hover:underline">
                  Rules
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Winner Reveal Modal */}
      <WinnerCelebrationModal
        isOpen={showCelebration}
        onClose={() => setShowCelebration(false)}
        competitionName={compTitle}
        competitionSlug={slug}
        prizeImage={compImage}
        winningTicketNumber={drawRecord?.winningTicketNumber || ""}
        winnerDisplayName={drawRecord?.winnerDisplayName || "Verified Participant"}
        drawId={drawRecord?.verificationReference || `RF-DRAW-${slug.slice(0, 8)}`}
        completedAt={drawRecord?.completedAt ?? null}
      />
    </div>
  );
}

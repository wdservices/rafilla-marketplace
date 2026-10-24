import React, { useEffect, useMemo, useRef, useState } from "react";
import { Volume2, VolumeX, Sparkles } from "lucide-react";
import type { EligibleTicket } from "@/lib/draw-system";
import {
  WHEEL_REST_ROTATION_DEG,
  wheelLandRotationDeg,
  wheelTargetRotationDeg,
} from "@/lib/wheel-geometry";
import { cn } from "@/lib/utils";

interface WheelOfFortuneProps {
  tickets: EligibleTicket[];
  winningTicketNumber?: string | null;
  isSpinning?: boolean;
  spinStartTime?: number | null;
  spinDurationMs?: number;
  onSpinComplete?: () => void;
  className?: string;
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
}

// Alternating luxury Rafilla palette for segments
const SEGMENT_COLORS = [
  "#0D2F24", // Rafilla Deep Forest
  "#144C39", // Rich Emerald
  "#0F382B", // Midnight Jade
  "#1A5C46", // Lush Pine
  "#164A38", // Deep Hunter
  "#20684F", // Velvet Mint
];

// Segment angle math (landing/rest rotations) lives in @/lib/wheel-geometry —
// see the WHEEL ANGLE CONVENTION note there. Segments are measured clockwise
// from 3 o'clock while the gold pointer is fixed at 12 o'clock (270°).

export function WheelOfFortune({
  tickets,
  winningTicketNumber,
  isSpinning = false,
  spinStartTime = null,
  spinDurationMs = 7500,
  onSpinComplete,
  className,
  size = "lg",
}: WheelOfFortuneProps) {
  const [rotationDeg, setRotationDeg] = useState(WHEEL_REST_ROTATION_DEG);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [pegtick, setPegtick] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const lastPegIndexRef = useRef<number>(-1);
  const animFrameRef = useRef<number | null>(null);
  const hasCompletedRef = useRef(false);
  const rotationDegRef = useRef(WHEEL_REST_ROTATION_DEG);
  const wasSpinningRef = useRef(false);
  const spinBaseRef = useRef(WHEEL_REST_ROTATION_DEG);

  useEffect(() => {
    rotationDegRef.current = rotationDeg;
  }, [rotationDeg]);

  // Scalable representation: if pool is large, display a balanced window of ~28 real tickets
  // that strictly includes the winning ticket and surrounding tickets from the real pool.
  const displayTickets = useMemo(() => {
    if (!tickets || tickets.length === 0) {
      // Fallback placeholder segments if pool is empty
      return Array.from({ length: 24 }).map((_, i) => ({
        id: `ph-${i}`,
        ticketNumber: String(100000 + i * 7),
        ticketCode: `TKT-${100000 + i * 7}`,
        entryId: `ENT-${i}`,
        userId: `usr-${i}`,
        userName: `Ticket #${100000 + i * 7}`,
        userHandle: `@participant_${i}`,
        userEmail: "",
        purchasedAt: "",
        status: "ACTIVE",
      }));
    }

    if (tickets.length <= 28) {
      return tickets;
    }

    // Large pool: pick a deterministic sample of 28 real tickets that guarantees
    // the winning ticket is present if one is preselected.
    const sampleSize = 28;
    const winNum = winningTicketNumber ? String(winningTicketNumber) : null;
    const winTicket = winNum ? tickets.find((t) => t.ticketNumber === winNum) : null;

    const step = Math.max(1, Math.floor(tickets.length / sampleSize));
    const sample: EligibleTicket[] = [];
    for (let i = 0; i < tickets.length && sample.length < sampleSize; i += step) {
      sample.push(tickets[i]!);
    }

    // Ensure winning ticket is in sample at index 0 or index 7
    if (winTicket && !sample.some((t) => t.ticketNumber === winTicket.ticketNumber)) {
      sample[7] = winTicket;
    }

    return sample;
  }, [tickets, winningTicketNumber]);

  const segmentCount = displayTickets.length;
  const segmentAngle = 360 / segmentCount;

  // Identify index of winning ticket in visible segments
  const winningSegmentIndex = useMemo(() => {
    if (!winningTicketNumber) return 0;
    const idx = displayTickets.findIndex(
      (t) => String(t.ticketNumber) === String(winningTicketNumber),
    );
    return idx >= 0 ? idx : 0;
  }, [displayTickets, winningTicketNumber]);

  // Subtle synthesized mechanical peg click sound (Web Audio API)
  const playPegClick = (pitch = 900) => {
    if (!soundEnabled) return;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") {
        void ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(pitch, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.015);

      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.015);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.015);
    } catch {
      // Audio autoplay policy fallback
    }
  };

  // Play peg tick visual twitch
  const triggerPegTick = () => {
    setPegtick(true);
    setTimeout(() => setPegtick(false), 80);
  };

  // ------------------------------------------------------------------------
  // See the WHEEL ANGLE CONVENTION note at the top of this file: segment
  // midpoints are measured clockwise from 3 o'clock, the pointer is fixed at
  // 12 o'clock (270°), so the landing rotation is 270 − midAngle.
  // ------------------------------------------------------------------------

  // Landing offset that parks the winning segment's CENTRE under the pointer.
  const landOffsetDeg = useMemo(
    () => wheelLandRotationDeg(winningSegmentIndex, segmentCount),
    [winningSegmentIndex, segmentCount],
  );

  // Total destination rotation is computed per spin from wherever the wheel
  // currently sits: 7 suspense revolutions that always end on landOffsetDeg.
  // Recomputing it here (rather than memoizing off landOffsetDeg alone) is what
  // lets a finished draw be replayed instead of sitting still.

  // Synchronized Animation / Physics loop
  useEffect(() => {
    if (!isSpinning) {
      wasSpinningRef.current = false;
      if (hasCompletedRef.current) {
        // A spin just finished: the wheel is already parked on the winning
        // segment (congruent to landOffsetDeg), so leave it alone — snapping
        // back to landOffsetDeg would visibly unwind the revolutions.
        return;
      }
      if (winningTicketNumber) {
        // If already completed or not spinning, stop firmly on winner
        setRotationDeg(landOffsetDeg);
      } else {
        // Idle: rest on a segment boundary line so the pointer never sits in
        // the middle of a ticket before the draw.
        setRotationDeg(WHEEL_REST_ROTATION_DEG);
      }
      return;
    }

    // Spin started: begin from wherever the wheel currently sits so a replay of
    // a completed draw picks up from the parked landing rotation.
    if (!wasSpinningRef.current) {
      spinBaseRef.current = rotationDegRef.current;
      wasSpinningRef.current = true;
    }
    const baseRotation = spinBaseRef.current;
    const targetRotation = wheelTargetRotationDeg(landOffsetDeg, 7, baseRotation);

    hasCompletedRef.current = false;
    const startMs = spinStartTime ?? Date.now();
    const duration = spinDurationMs || 7500;

    // Cubic-bezier deceleration easing (fast start, long smooth deceleration)
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3.2);

    const animate = () => {
      const now = Date.now();
      const elapsed = now - startMs;
      const progress = Math.min(1, Math.max(0, elapsed / duration));
      const eased = easeOutCubic(progress);

      // Interpolate from the spin's starting rotation so the wheel never jumps
      // at spin start, finishing exactly on the winning segment's centre.
      const currentAngle = baseRotation + eased * (targetRotation - baseRotation);
      setRotationDeg(currentAngle);

      // Track peg clicks as segments pass 12 o'clock
      const currentSegment = Math.floor((currentAngle % 360) / segmentAngle);
      if (currentSegment !== lastPegIndexRef.current) {
        lastPegIndexRef.current = currentSegment;
        playPegClick(progress > 0.8 ? 750 : 950);
        triggerPegTick();
      }

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        if (!hasCompletedRef.current) {
          hasCompletedRef.current = true;
          onSpinComplete?.();
        }
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [
    isSpinning,
    spinStartTime,
    spinDurationMs,
    landOffsetDeg,
    segmentAngle,
    winningTicketNumber,
    onSpinComplete,
  ]);

  // Dimension scaling
  const sizeClasses = {
    sm: "w-[300px] h-[300px] sm:w-[360px] sm:h-[360px]",
    md: "w-[360px] h-[360px] sm:w-[440px] sm:h-[440px]",
    lg: "w-[340px] h-[340px] sm:w-[460px] sm:h-[460px] md:w-[540px] md:h-[540px] lg:w-[580px] lg:h-[580px]",
  }[size];

  // SVG parameters
  const cx = 250;
  const cy = 250;
  const outerR = 236;
  const innerR = 74;

  return (
    <div
      className={cn("relative flex flex-col items-center justify-center select-none", className)}
    >
      {/* Sound toggle button */}
      <div className="absolute top-0 right-2 z-30">
        <button
          type="button"
          onClick={() => setSoundEnabled((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#082218]/90 text-[#F3E5AB] text-xs font-bold border border-[#C5A059]/40 hover:bg-[#0E3526] hover:border-[#C5A059] transition-all shadow-md backdrop-blur"
          title={soundEnabled ? "Mute wheel sounds" : "Enable wheel sounds"}
          aria-label={soundEnabled ? "Mute wheel sounds" : "Enable wheel sounds"}
        >
          {soundEnabled ? (
            <>
              <Volume2 className="size-3.5 text-[#D4AF37]" />
              <span className="hidden sm:inline">Sound ON</span>
            </>
          ) : (
            <>
              <VolumeX className="size-3.5 text-white/50" />
              <span className="hidden sm:inline text-white/60">Sound OFF</span>
            </>
          )}
        </button>
      </div>

      {/* Main Wheel Container */}
      <div className={cn("relative flex items-center justify-center aspect-square", sizeClasses)}>
        {/* Outer ambient glow and shadow ring */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#D4AF37]/20 via-transparent to-[#10B981]/15 blur-2xl pointer-events-none" />

        {/* Outer Bezel (stationary outer brass rim with metallic studs) */}
        <div className="absolute inset-0 rounded-full border-[10px] sm:border-[12px] border-[#07241A] shadow-[0_20px_50px_rgba(0,0,0,0.6),inset_0_2px_12px_rgba(212,175,55,0.4)] ring-2 ring-[#C5A059] bg-[#0A2D21]">
          {/* Decorative brass rivets around the outer rim */}
          {Array.from({ length: 24 }).map((_, i) => {
            const angle = (i * 360) / 24;
            const rad = (angle * Math.PI) / 180;
            const dist = 48.5; // percent from center
            const x = 50 + dist * Math.cos(rad);
            const y = 50 + dist * Math.sin(rad);
            return (
              <span
                key={i}
                className="absolute size-2 sm:size-2.5 rounded-full bg-gradient-to-b from-[#FFF2B2] via-[#D4AF37] to-[#8C6D1F] shadow-[0_1px_3px_rgba(0,0,0,0.8)] -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${x}%`, top: `${y}%` }}
                aria-hidden="true"
              />
            );
          })}
        </div>

        {/* Rotating SVG Wheel Canvas */}
        <div
          className="relative w-full h-full p-2.5 sm:p-3 flex items-center justify-center transition-transform will-change-transform"
          style={{
            transform: `rotate(${rotationDeg}deg)`,
          }}
        >
          <svg
            viewBox="0 0 500 500"
            className="w-full h-full drop-shadow-lg"
            aria-label="Wheel of Fortune"
          >
            <defs>
              {/* Radial gradient for realistic convex depth */}
              <radialGradient id="wheelGleam" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.08" />
                <stop offset="70%" stopColor="#FFFFFF" stopOpacity="0.02" />
                <stop offset="100%" stopColor="#000000" stopOpacity="0.4" />
              </radialGradient>
              {/* Gold gradient for segment dividers */}
              <linearGradient id="goldSeparator" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#F9F1D0" />
                <stop offset="50%" stopColor="#C5A059" />
                <stop offset="100%" stopColor="#7D5E1F" />
              </linearGradient>
            </defs>

            {/* Render Each Ticket Segment */}
            {displayTickets.map((ticket, i) => {
              const startAngle = (i * segmentAngle * Math.PI) / 180;
              const endAngle = ((i + 1) * segmentAngle * Math.PI) / 180;
              const midAngle = ((i + 0.5) * segmentAngle * Math.PI) / 180;
              const midAngleDeg = (i + 0.5) * segmentAngle;

              // Arc path coordinates
              const x1 = cx + outerR * Math.cos(startAngle);
              const y1 = cy + outerR * Math.sin(startAngle);
              const x2 = cx + outerR * Math.cos(endAngle);
              const y2 = cy + outerR * Math.sin(endAngle);

              const xi1 = cx + innerR * Math.cos(startAngle);
              const yi1 = cy + innerR * Math.sin(startAngle);
              const xi2 = cx + innerR * Math.cos(endAngle);
              const yi2 = cy + innerR * Math.sin(endAngle);

              const pathData = [
                `M ${xi1} ${yi1}`,
                `L ${x1} ${y1}`,
                `A ${outerR} ${outerR} 0 0 1 ${x2} ${y2}`,
                `L ${xi2} ${yi2}`,
                `A ${innerR} ${innerR} 0 0 0 ${xi1} ${yi1}`,
                "Z",
              ].join(" ");

              // Text coordinates along radius
              const textDist = outerR - 22;
              const textX = cx + textDist * Math.cos(midAngle);
              const textY = cy + textDist * Math.sin(midAngle);

              const isWinner =
                winningTicketNumber && String(ticket.ticketNumber) === String(winningTicketNumber);

              const color = isWinner ? "#19664C" : SEGMENT_COLORS[i % SEGMENT_COLORS.length]!;

              const shortName = ticket.userName ? ticket.userName.split(" ")[0] : "";

              return (
                <g key={ticket.id || i}>
                  {/* Segment Pie Slice */}
                  <path
                    d={pathData}
                    fill={color}
                    stroke="url(#goldSeparator)"
                    strokeWidth="1.2"
                    className="transition-colors"
                  />

                  {/* Highlighting sheen on winner segment */}
                  {isWinner && (
                    <path
                      d={pathData}
                      fill="#D4AF37"
                      fillOpacity="0.22"
                      stroke="#F3E5AB"
                      strokeWidth="2"
                    />
                  )}

                  {/* Rotated Ticket Number & Name */}
                  <g transform={`translate(${textX}, ${textY}) rotate(${midAngleDeg + 180})`}>
                    {/* Ticket Number (readable bold) */}
                    <text
                      x="0"
                      y="-2"
                      textAnchor="start"
                      fontSize={segmentCount > 24 ? "10" : "12"}
                      fontWeight="800"
                      fill="#F7F4EB"
                      fontFamily="ui-monospace, monospace"
                      letterSpacing="0.04em"
                    >
                      #{ticket.ticketNumber}
                    </text>

                    {/* Participant First Name */}
                    {shortName && (
                      <text
                        x="0"
                        y="10"
                        textAnchor="start"
                        fontSize={segmentCount > 24 ? "7.5" : "9"}
                        fontWeight="600"
                        fill="#D4AF37"
                        opacity="0.9"
                      >
                        {shortName}
                      </text>
                    )}
                  </g>
                </g>
              );
            })}

            {/* Subtle overlay gradient */}
            <circle cx={cx} cy={cy} r={outerR} fill="url(#wheelGleam)" pointerEvents="none" />
          </svg>
        </div>

        {/* =========================================================================
            RAFILLA LOGO IN THE CENTRE OF THE WHEEL (STATIONARY HUB)
            Requirements:
            - Exactly in the centre of the Wheel of Fortune.
            - Uses existing project asset (/Rafilla-logo.png).
            - Circular centre hub with premium dark-green background & gold border.
            - Logo remains visually stable and centred while outer wheel rotates!
            - The logo does NOT rotate with the segments.
            ========================================================================= */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none flex items-center justify-center size-[100px] sm:size-[125px] md:size-[140px] rounded-full"
          aria-hidden="true"
        >
          {/* Metallic Gold Bezel Ring */}
          <div className="absolute inset-0 rounded-full border-[3px] sm:border-[4px] border-[#D4AF37] shadow-[0_0_20px_rgba(212,175,55,0.45),0_10px_25px_rgba(0,0,0,0.8)] bg-gradient-to-br from-[#F5E6B5] via-[#C5A059] to-[#8C6D1F] p-[2px]" />

          {/* Deep Forest Green Hub Plaque */}
          <div className="relative size-[94px] sm:size-[118px] md:size-[132px] rounded-full bg-gradient-to-b from-[#134A35] via-[#09261B] to-[#04160E] border border-[#D4AF37]/40 shadow-inner flex flex-col items-center justify-center p-3 overflow-hidden">
            {/* Subtle radial inner glow */}
            <div className="absolute inset-0 rounded-full bg-radial from-[#10B981]/20 via-transparent to-black/60 pointer-events-none" />

            {/* Rafilla Logo Asset — stationary, crisp, preserved aspect ratio */}
            <img
              src="/Rafilla-logo.png"
              alt="Rafilla Logo"
              className="relative z-10 w-[64px] sm:w-[82px] md:w-[94px] h-[64px] sm:h-[82px] md:h-[94px] object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]"
              loading="eager"
            />
          </div>
        </div>

        {/* =========================================================================
            FIXED POINTER AT 12 O'CLOCK
            - Fixed at the top winning position.
            - Winning segment stops precisely under the pointer tip.
            ========================================================================= */}
        <div
          className={cn(
            "absolute -top-3 sm:-top-4 left-1/2 -translate-x-1/2 z-30 pointer-events-none flex flex-col items-center transition-transform duration-75",
            pegtick && "-translate-y-0.5 scale-95",
          )}
          aria-hidden="true"
        >
          {/* Pointer needle with metallic bevel and jewel apex */}
          <div className="relative flex flex-col items-center filter drop-shadow-[0_4px_10px_rgba(0,0,0,0.7)]">
            {/* Golden pivot knob with emerald center */}
            <div className="size-5 sm:size-6 rounded-full bg-gradient-to-br from-[#FFF5C0] via-[#D4AF37] to-[#7B591A] border border-[#FFF] flex items-center justify-center shadow-md">
              <span className="size-2 sm:size-2.5 rounded-full bg-[#10B981] shadow-inner" />
            </div>

            {/* Downward triangle indicator arrow pointing directly into winning segment */}
            <div
              className="w-0 h-0 -mt-1"
              style={{
                borderLeft: "11px solid transparent",
                borderRight: "11px solid transparent",
                borderTop: "24px solid #D4AF37",
                filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))",
              }}
            />
          </div>
        </div>
      </div>

      {/* Under-wheel Status & Selected Indicator */}
      <div className="mt-4 sm:mt-5 flex items-center gap-2 text-xs font-bold text-[#F3E5AB]">
        {isSpinning ? (
          <span className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#134E39]/80 border border-[#D4AF37]/50 text-white shadow-lg animate-pulse">
            <Sparkles className="size-3.5 text-[#D4AF37]" />
            Wheel in motion · Selecting winning ticket
          </span>
        ) : winningTicketNumber ? (
          <span className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#082218] border border-[#C5A059] text-[#F3E5AB] shadow-md font-mono">
            <span className="size-2 rounded-full bg-[#10B981]" />
            Stopped at winning ticket:{" "}
            <span className="text-white font-extrabold text-sm">#{winningTicketNumber}</span>
          </span>
        ) : (
          <span className="text-white/60 text-xs">
            {tickets.length.toLocaleString("en-NG")} eligible ticket chances ready
          </span>
        )}
      </div>
    </div>
  );
}

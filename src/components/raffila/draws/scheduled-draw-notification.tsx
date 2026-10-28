import React, { useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import {
  Sparkles,
  CalendarDays,
  Radio,
  Clock,
  CheckCircle2,
  AlertCircle,
  X,
  ArrowRight,
} from "lucide-react";
import { useCompetitions } from "@/hooks/useCompetitions";
import { parseCloseMs } from "@/lib/draw-system";
import { cn } from "@/lib/utils";

export function ScheduledDrawNotification() {
  const [mounted, setMounted] = useState(false);
  const { competitions } = useCompetitions();
  const location = useLocation();
  const [dismissedSlugs, setDismissedSlugs] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setMounted(true);
  }, []);

  // Do not show on private pages or on the draw page itself
  const pathname = location.pathname;
  const isExcludedPage =
    pathname.includes("/draw") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/partner");

  const todayComp = useMemo(() => {
    if (!competitions || competitions.length === 0) return null;

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10); // YYYY-MM-DD

    // 1. Look for competitions currently LIVE DRAW or DRAW_READY
    const liveComp = competitions.find(
      (c) =>
        ((c.status as string) === "DRAW_IN_PROGRESS" ||
          (c.status as string) === "DRAW_READY" ||
          (c.status as string) === "WINNER_SELECTED") &&
        !dismissedSlugs.has(c.slug),
    );
    if (liveComp) return liveComp;

    // 2. Look for competitions whose drawDate is today
    const drawToday = competitions.find((c) => {
      if (dismissedSlugs.has(c.slug)) return false;
      if (c.drawDate && c.drawDate.slice(0, 10) === todayStr) return true;
      const ms = parseCloseMs(c as unknown as Record<string, unknown>);
      if (ms > 0) {
        const d = new Date(ms).toISOString().slice(0, 10);
        return d === todayStr;
      }
      return false;
    });
    if (drawToday) return drawToday;

    // 3. If none explicitly dated today, look for the featured active competition
    // to showcase the Draw Day notification banner to visitors
    const featuredActive = competitions.find(
      (c) =>
        c.featured &&
        (c.status === "LIVE" || (c.status as string) === "DRAW_READY") &&
        !dismissedSlugs.has(c.slug),
    );
    if (featuredActive) return featuredActive;

    // 4. Any first live competition
    return competitions.find((c) => c.status === "LIVE" && !dismissedSlugs.has(c.slug)) ?? null;
  }, [competitions, dismissedSlugs]);

  if (!mounted || isExcludedPage || !todayComp) return null;

  const handleDismiss = () => {
    setDismissedSlugs((prev) => new Set([...prev, todayComp.slug]));
  };

  // Determine accurate status category:
  // - "live": Draw is currently in progress
  // - "starting_soon": DRAW_READY (pool locked)
  // - "completed": Completed today
  // - "postponed": CANCELLED or SUSPENDED
  // - "today": Scheduled for today
  const statusType: "live" | "starting_soon" | "completed" | "postponed" | "today" = (() => {
    if ((todayComp.status as string) === "DRAW_IN_PROGRESS") return "live";
    if ((todayComp.status as string) === "DRAW_READY") return "starting_soon";
    if (todayComp.status === "COMPLETED" || (todayComp.status as string) === "WINNER_SELECTED")
      return "completed";
    if (
      (todayComp.status as string) === "CANCELLED" ||
      (todayComp.status as string) === "SUSPENDED"
    )
      return "postponed";
    return "today";
  })();

  const formatDrawTime = (dateStr?: string) => {
    if (!dateStr) return "7:00 PM WAT";
    try {
      const d = new Date(dateStr);
      if (Number.isNaN(d.getTime())) return "7:00 PM WAT";
      return d.toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit", hour12: true });
    } catch {
      return "7:00 PM WAT";
    }
  };

  const drawTimeFormatted = formatDrawTime(todayComp.drawDate);

  const bannerDetails = {
    live: {
      badge: "DRAW LIVE NOW",
      badgeColor: "bg-red-500 text-white animate-pulse",
      title: "DRAW LIVE NOW",
      message: `${todayComp.title} — The live wheel is spinning right now!`,
      action: "WATCH LIVE DRAW",
      actionBg: "bg-red-500 text-white hover:bg-red-600",
    },
    starting_soon: {
      badge: "STARTING SOON",
      badgeColor: "bg-[#D4AF37] text-[#0A261B]",
      title: "DRAW STARTING SOON",
      message: `${todayComp.title} — Entries locked. Preparing live draw ceremony.`,
      action: "JOIN LIVE DRAW",
      actionBg: "bg-[#D4AF37] text-[#0A261B] hover:bg-[#FFF]",
    },
    completed: {
      badge: "DRAW COMPLETED",
      badgeColor: "bg-[#10B981] text-white",
      title: "DRAW COMPLETED",
      message: `${todayComp.title} — Winner announced. Check official verification record.`,
      action: "VIEW RESULTS",
      actionBg: "bg-[#10B981] text-white hover:bg-emerald-600",
    },
    postponed: {
      badge: "POSTPONED",
      badgeColor: "bg-white/20 text-white",
      title: "DRAW POSTPONED",
      message: `${todayComp.title} — The scheduled draw has been temporarily postponed.`,
      action: "VIEW DETAILS",
      actionBg: "bg-white/10 text-white hover:bg-white/20",
    },
    today: {
      badge: "DRAW DAY — TODAY",
      badgeColor: "bg-[#D4AF37] text-[#0A261B]",
      title: "DRAW DAY — TODAY",
      message: `${todayComp.title} — The scheduled draw takes place today at ${drawTimeFormatted}.`,
      action: "WATCH LIVE DRAW",
      actionBg: "bg-[#D4AF37] text-[#0A261B] hover:bg-[#FFF]",
    },
  }[statusType];

  return (
    <aside
      aria-label="Draw Notification"
      className="relative z-30 bg-gradient-to-r from-[#07241A] via-[#0E3A2B] to-[#07241A] border-b border-[#C5A059]/30 text-white px-4 py-2.5 sm:py-3 shadow-md transition-all"
    >
      <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
        {/* Left Info Cluster */}
        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 sm:gap-3 text-xs">
          <span
            className={cn(
              "px-2.5 py-0.5 rounded-full font-extrabold uppercase text-[10px] tracking-wider shrink-0",
              bannerDetails.badgeColor,
            )}
          >
            {bannerDetails.badge}
          </span>

          <span className="font-extrabold text-white text-xs sm:text-sm">{todayComp.title}</span>

          <span className="text-white/40 hidden sm:inline">·</span>

          <span className="text-white/80 text-[11px] sm:text-xs">
            {statusType === "today"
              ? `The scheduled draw takes place today at ${drawTimeFormatted}`
              : bannerDetails.message}
          </span>
        </div>

        {/* Right Action & Dismiss Cluster */}
        <div className="flex items-center gap-2 shrink-0">
          <Link
            to="/competitions/$slug/draw"
            params={{ slug: todayComp.slug }}
            className={cn(
              "inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full font-extrabold text-xs shadow-md transition-all",
              bannerDetails.actionBg,
            )}
          >
            {statusType === "live" && <Radio className="size-3 animate-ping" />}
            {bannerDetails.action}
            <ArrowRight className="size-3.5" />
          </Link>

          <button
            type="button"
            onClick={handleDismiss}
            className="size-7 rounded-full text-white/50 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors"
            title="Dismiss notification"
            aria-label="Dismiss notification"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}

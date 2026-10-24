const LAGOS_TZ = "Africa/Lagos";

/** Get the current hour in Lagos time (0-23). */
export function lagosHour(): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: LAGOS_TZ, hour: "numeric" }).format(new Date()),
  );
}

/** Time-of-day greeting based on Lagos clock. */
export function lagosGreeting(): string {
  const h = lagosHour();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/** Day key "YYYY-MM-DD" in Lagos timezone. */
export function lagosDayKey(iso: string | number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: LAGOS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

/** Short date "18 Jun" in Lagos timezone. */
export function lagosDateShort(iso: string | number): string {
  return new Date(iso).toLocaleDateString("en-NG", {
    day: "2-digit",
    month: "short",
    timeZone: LAGOS_TZ,
  });
}

/** Long date "18 June 2026" in Lagos timezone. */
export function lagosDateLong(iso: string | number): string {
  return new Date(iso).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: LAGOS_TZ,
  });
}

/** Date with year "18 Jun 2026" in Lagos timezone. */
export function lagosDateWithYear(iso: string | number): string {
  return new Date(iso).toLocaleDateString("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: LAGOS_TZ,
  });
}

/** Time "3:00 PM" in Lagos timezone. */
export function lagosTime(iso: string | number): string {
  return new Date(iso).toLocaleTimeString("en-NG", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: LAGOS_TZ,
  });
}

/** Combined "18 Jun, 3:00 PM GMT+1". */
export function lagosDateTime(iso: string | number): string {
  return `${lagosDateShort(iso)}, ${lagosTime(iso)} GMT+1`;
}

/** Audit stamp "08 Mar 2026, 3:00 PM GMT+1" — always carries the year. */
export function lagosDateTimeWithYear(iso: string | number): string {
  return `${lagosDateWithYear(iso)}, ${lagosTime(iso)} GMT+1`;
}

/** Day label with weekday: "Monday, 16 September 2026". */
export function lagosDayLabel(iso: string | number): string {
  return new Date(iso).toLocaleDateString("en-NG", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: LAGOS_TZ,
  });
}

/** Chart axis: "Mon 16" in Lagos timezone. */
export function lagosChartLabel(iso: Date): string {
  return iso.toLocaleDateString("en-NG", {
    weekday: "short",
    day: "numeric",
    timeZone: LAGOS_TZ,
  });
}

/** Build N consecutive day-labels ending today in Lagos time. */
export function lagosChartLabels(days: number): string[] {
  const now = new Date();
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(now.getTime() - (days - 1 - i) * 86_400_000);
    return lagosChartLabel(d);
  });
}

// ── Competition date display helpers ──────────────────────────────────

/** Strip "WAT" / "GMT+1" suffixes and trim. */
function stripTz(s: string): string {
  return s.replace(/\s*(WAT|GMT\+?1)\s*$/i, "").trim();
}

/** Try to parse any competition date string into a Date. Returns null if unparseable. */
function parseCompDate(raw: string): Date | null {
  const s = stripTz(raw);
  const d = new Date(s.includes("T") ? s : s.replace(".", "T"));
  return Number.isFinite(d.getTime()) ? d : null;
}

/** Format the "closes" field: "18 Oct 2026 · 9:00 PM" (12h, Lagos time). */
export function formatCloses(raw: string): string {
  const d = parseCompDate(raw);
  if (!d) return raw;
  const date = d.toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: LAGOS_TZ,
  });
  const tm = /^(\d{2}):(\d{2})/.exec(raw.replace(".", "T"));
  if (!tm) return date;
  const hh = Number(tm[1]);
  const ampm = hh >= 12 ? "PM" : "AM";
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${date} · ${h12}:${tm[2]} ${ampm}`;
}

/** Format the "drawDate" field: "Fri 3 Oct 2026 · 6:00 PM" (12h, Lagos time). */
export function formatDrawDate(raw: string): string {
  const d = parseCompDate(raw);
  if (!d) return raw;
  const date = d.toLocaleDateString("en-NG", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: LAGOS_TZ,
  });
  const tm = /^(\d{2}):(\d{2})/.exec(raw.replace(".", "T"));
  if (!tm) return date;
  const hh = Number(tm[1]);
  const ampm = hh >= 12 ? "PM" : "AM";
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${date} · ${h12}:${tm[2]} ${ampm}`;
}

/** Short date with year: "18 Oct 2026" (no time). */
export function formatClosesDateOnly(raw: string): string {
  const d = parseCompDate(raw);
  if (!d) return raw.split("·")[0] ?? raw;
  return d.toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: LAGOS_TZ,
  });
}

// ── Relative time ─────────────────────────────────────────────────────

/** Relative time "5m ago", "3h ago", etc. Falls back to "18 Jun". */
export function lagosRelativeTime(iso: string | number): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return lagosDateShort(iso);
}

/**
 * Pure referral helpers shared by the server functions (referral-server.ts),
 * the commission engine inside paystack-server.ts and the client UI.
 *
 * NO firebase imports here — this file is imported from client components
 * (entries QR, invite route) and must stay browser-safe.
 */

export const REFERRAL_MAX_LEVELS = 5;

export type ReferralRates = {
  l1: number;
  l2: number;
  l3: number;
  l4: number;
  l5: number;
};

/** Admin → Config → Referral rates defaults (percent of entry fee). */
export const DEFAULT_REFERRAL_RATES: ReferralRates = { l1: 10, l2: 5, l3: 3, l4: 2, l5: 1 };

const RATE_KEYS: Array<keyof ReferralRates> = ["l1", "l2", "l3", "l4", "l5"];

/**
 * Clamp admin-configured rates (platformSettings/raffila_config.referralRates)
 * into usable 0–100 numbers. Missing/invalid entries fall back to defaults.
 */
export function normalizeReferralRates(raw: unknown): ReferralRates {
  const rec = (raw ?? {}) as Record<string, unknown>;
  const out = { ...DEFAULT_REFERRAL_RATES };
  for (const key of RATE_KEYS) {
    const n = Number(rec[key]);
    if (Number.isFinite(n) && n >= 0) out[key] = Math.min(100, n);
  }
  return out;
}

/** Commission (kobo) an upline earns on a purchase at a rate. Always AVAILABLE. */
export function referralCommissionKobo(amountKobo: number, ratePct: number): number {
  if (!Number.isFinite(amountKobo) || amountKobo <= 0) return 0;
  if (!Number.isFinite(ratePct) || ratePct <= 0) return 0;
  return Math.round((amountKobo * Math.min(100, ratePct)) / 100);
}

/** Full 5-level split for an order total. Used by the engine and by tests. */
export function referralCommissionSplit(
  amountKobo: number,
  rates: ReferralRates,
): Array<{ level: number; ratePct: number; amountKobo: number }> {
  const out: Array<{ level: number; ratePct: number; amountKobo: number }> = [];
  RATE_KEYS.forEach((key, i) => {
    const ratePct = rates[key];
    const kobo = referralCommissionKobo(amountKobo, ratePct);
    if (kobo > 0) out.push({ level: i + 1, ratePct, amountKobo: kobo });
  });
  return out;
}

/**
 * Normalize a referral code (or a link slug a user typed/scanned) to the
 * canonical stored form: uppercase, A–Z 0–9 and single dashes, max 32 chars.
 * `/invite/tunmise-ade` and `/invite/TUNMISE-ADE` resolve to the same code.
 */
export function sanitizeReferralCode(raw: unknown): string {
  return String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32)
    .replace(/-+$/g, "");
}

/** Short random suffix used when a handle-derived code is already taken. */
export function randomReferralSuffix(): string {
  return Math.random().toString(36).slice(2, 6).toUpperCase().padEnd(4, "0").slice(0, 4);
}

/**
 * Candidate codes for a user, best-first: the bare handle when usable, then
 * handle-with-suffix variants. The server function claims the first free one
 * in a transaction (or returns the one already owned by this user).
 */
export function referralCodeCandidates(seed: string): string[] {
  const base = sanitizeReferralCode(seed).replace(/^-+|-+$/g, "");
  const out: string[] = [];
  if (base.length >= 3) out.push(base);
  const suffix = randomReferralSuffix();
  out.push(base.length >= 1 ? `${base}-${suffix}` : `USER-${suffix}`);
  return out;
}

/** Path for a referral invite link (callers prepend the origin). */
export function referralInvitePath(code: string): string {
  const clean = sanitizeReferralCode(code);
  return clean ? `/invite/${clean}` : "";
}

/** Absolute invite link for sharing (QR payload, copy buttons, share intents). */
export function referralInviteUrl(code: string, origin?: string): string {
  const base = (origin || "").replace(/\/+$/, "");
  return `${base}${referralInvitePath(code)}`;
}

/**
 * Ticket QR payload: a scannable URL that opens the competition through the
 * buyer's invite link, so scanning attributes the scanner as a referral.
 * Falls back to the plain competition URL when no code is available yet.
 */
export function ticketQrValue(input: {
  origin: string;
  refCode: string | null | undefined;
  competitionSlug: string;
  entryId?: string;
}): string {
  const origin = (input.origin || "").replace(/\/+$/, "");
  const slug = String(input.competitionSlug ?? "");
  const code = sanitizeReferralCode(input.refCode ?? "");
  const entry = String(input.entryId ?? "");
  if (code) {
    const qs = new URLSearchParams();
    if (slug) qs.set("comp", slug);
    if (entry) qs.set("e", entry);
    const search = qs.toString();
    return `${origin}/invite/${code}${search ? `?${search}` : ""}`;
  }
  return slug ? `${origin}/competitions/${slug}` : origin || "/";
}

/** Milliseconds from a Firestore Timestamp-ish value (0 when absent). */
export function tsToMs(v: unknown): number {
  if (!v) return 0;
  if (typeof v === "number") return v;
  const anyV = v as { toMillis?: () => number; seconds?: number };
  if (typeof anyV.toMillis === "function") return anyV.toMillis();
  if (typeof anyV.seconds === "number") return anyV.seconds * 1000;
  return 0;
}

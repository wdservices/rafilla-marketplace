import { sanitizeReferralCode } from "./referral-core";

/**
 * Client-side capture of referral attribution before a visitor has an account.
 *
 * Links (`?ref=CODE` query param or an /invite/$code page visit) stash the
 * code here; after Firebase registration/sign-in the stored code is sent to
 * the server once, which validates and persists `referredBy` on the user doc.
 */

const REF_KEY = "raffila:ref";
const REF_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

type StoredRef = { code: string; at: number };

function safeStorage(): Storage | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Persist a referral code from an invite link / ?ref= param. Idempotent. */
export function saveReferralCode(raw: unknown): boolean {
  const code = sanitizeReferralCode(raw);
  if (!code) return false;
  const storage = safeStorage();
  if (!storage) return false;
  try {
    const entry: StoredRef = { code, at: Date.now() };
    storage.setItem(REF_KEY, JSON.stringify(entry));
    return true;
  } catch {
    return false;
  }
}

/** Read the stored referral code (clears it when expired). */
export function readReferralCode(): string | null {
  const storage = safeStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(REF_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredRef>;
    const code = sanitizeReferralCode(parsed.code);
    const at = Number(parsed.at) || 0;
    if (!code || !at || Date.now() - at > REF_TTL_MS) {
      storage.removeItem(REF_KEY);
      return null;
    }
    return code;
  } catch {
    return null;
  }
}

export function clearReferralCode(): void {
  try {
    safeStorage()?.removeItem(REF_KEY);
  } catch {
    // ignore
  }
}

/** True when a captured code is waiting to be attributed. */
export function hasPendingReferral(): boolean {
  return readReferralCode() !== null;
}

/**
 * Scan the current URL for `?ref=` (or `?referral=`) and persist it.
 * Safe to run on every navigation; never throws.
 */
export function captureReferralFromLocation(search?: string): void {
  if (typeof window === "undefined") return;
  const qs = search ?? window.location.search;
  if (!qs) return;
  try {
    const params = new URLSearchParams(qs.startsWith("?") ? qs.slice(1) : qs);
    const code = params.get("ref") || params.get("referral");
    if (code) saveReferralCode(code);
  } catch {
    // ignore malformed search strings
  }
}

/**
 * Attribute the stored referral code to a freshly signed-in/registered user.
 * Fire-and-forget: attribution failures must never block auth flows.
 */
export function attributeStoredReferral(uid: string): void {
  if (!uid) return;
  const code = readReferralCode();
  if (!code) return;
  void (async () => {
    try {
      const { attributeReferral } = await import("./referral-server");
      const res = await attributeReferral({ data: { uid, code } });
      // Only drop the stored code once the server has seen it — invalid
      // codes are removed too so we stop retrying them forever.
      if (res.ok || res.reason === "invalid_code" || res.reason === "self_referral") {
        clearReferralCode();
      }
    } catch {
      // Keep the code for a later attempt (e.g. offline first try).
    }
  })();
}

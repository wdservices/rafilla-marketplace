import { createServerFn } from "@tanstack/react-start";

import {
  DEFAULT_REFERRAL_RATES,
  REFERRAL_MAX_LEVELS,
  normalizeReferralRates,
  referralCodeCandidates,
  sanitizeReferralCode,
  tsToMs,
} from "./referral-core";
import { defaultPayoutReason, normalizePayoutType, payoutAuditWrite } from "./payout-tracking";

/**
 * Server functions for the referral system: unique code registry, signup
 * attribution, invite resolution, dashboard reads and payout requests.
 *
 * Structural types for the Admin SDK pieces used below, declared locally on
 * purpose (same pattern as paystack-server.ts): importing firebase-admin here
 * would pull a Node-only package into the browser module graph because this
 * file IS imported by client components.
 */
type AdminDocSnapshot = {
  exists: boolean;
  data(): Record<string, unknown> | undefined;
  get(field: string): unknown;
};
type AdminQuerySnapshot = {
  empty: boolean;
  size: number;
  docs: Array<{ id: string; data(): Record<string, unknown> }>;
};
type AdminQuery = {
  where(field: string, op: string, value: unknown): AdminQuery;
  orderBy(field: string, dir?: "asc" | "desc"): AdminQuery;
  limit(n: number): AdminQuery;
  get(): Promise<AdminQuerySnapshot>;
};
type AdminDocRef = {
  id: string;
  get(): Promise<AdminDocSnapshot>;
  set(data: Record<string, unknown>, options?: { merge?: boolean }): Promise<unknown>;
  collection(name: string): AdminCollectionRef;
};
type AdminCollectionRef = {
  doc(id?: string): AdminDocRef;
  where(field: string, op: string, value: unknown): AdminQuery;
  orderBy(field: string, dir?: "asc" | "desc"): AdminQuery;
  limit(n: number): AdminQuery;
  get(): Promise<AdminQuerySnapshot>;
};
type AdminTransaction = {
  get(ref: AdminDocRef): Promise<AdminDocSnapshot>;
  set(ref: AdminDocRef, data: Record<string, unknown>, options?: { merge?: boolean }): unknown;
};
type AdminFirestore = {
  collection(name: string): AdminCollectionRef;
  runTransaction<T>(fn: (tx: AdminTransaction) => Promise<T>): Promise<T>;
};

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function str(v: unknown): string {
  return String(v ?? "").trim();
}

function displayNameOf(data: Record<string, unknown>): string {
  return (
    str(data["displayName"]) ||
    [str(data["firstName"]), str(data["lastName"])].filter(Boolean).join(" ") ||
    str(data["handle"]) ||
    "A Raffila member"
  );
}

function initialsOf(name: string, handle?: string): string {
  const src = name.trim() || (handle ?? "");
  const parts = src.split(/[\s-]+/).filter(Boolean);
  if (parts.length === 0) return "RF";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}

function serverTimestamp(FieldValue: { serverTimestamp(): unknown }): unknown {
  return FieldValue.serverTimestamp();
}

async function getDb(): Promise<{
  adminDb: AdminFirestore;
  FieldValue: { serverTimestamp(): unknown; increment(n: number): unknown };
}> {
  const { getAdminDb, FieldValue } = await import("./firebase-admin");
  return { adminDb: getAdminDb() as unknown as AdminFirestore, FieldValue };
}

/* ------------------------------------------------------------------ *
 * ensureReferralCode — idempotent per-user code creation
 * ------------------------------------------------------------------ */

export type EnsureReferralCodeInput = { uid: string };

export type EnsureReferralCodeResult = { ok: true; code: string } | { ok: false; error: string };

export const ensureReferralCode = createServerFn({ method: "POST" })
  .validator((input: EnsureReferralCodeInput) => input)
  .handler(async ({ data }): Promise<EnsureReferralCodeResult> => {
    const uid = str(data.uid);
    if (!uid) return { ok: false, error: "Sign in to get your referral link" };

    const { adminDb, FieldValue } = await getDb();
    const users = adminDb.collection("users");
    const registry = adminDb.collection("referralCodes");

    const userRef = users.doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) return { ok: false, error: "Account not found" };
    const user = userSnap.data() ?? {};

    const existing = sanitizeReferralCode(user["referralCode"]);
    if (existing) {
      const owned = await registry.doc(existing).get();
      if (owned.exists && str((owned.data() ?? {})["uid"]) === uid) {
        return { ok: true, code: existing };
      }
    }

    const seed = str(user["handle"]) || [str(user["firstName"]), str(user["lastName"])].join(" ");
    const candidates = referralCodeCandidates(seed);
    // Extra attempts with fresh random suffixes if the first batch is taken.
    for (let i = 0; i < 8 && candidates.length < 12; i++) {
      candidates.push(...referralCodeCandidates(seed).slice(1));
    }

    const claimed = await adminDb.runTransaction(async (tx) => {
      for (const raw of candidates) {
        const code = sanitizeReferralCode(raw);
        if (!code) continue;
        const codeRef = registry.doc(code);
        const snap = await tx.get(codeRef);
        const owner = snap.exists ? str((snap.data() ?? {})["uid"]) : "";
        if (owner && owner !== uid) continue;
        tx.set(
          codeRef,
          {
            uid,
            handle: str(user["handle"]),
            displayName: displayNameOf(user),
            createdAt: snap.exists ? (snap.data() ?? {})["createdAt"] : serverTimestamp(FieldValue),
            attributedCount: snap.exists ? ((snap.data() ?? {})["attributedCount"] ?? 0) : 0,
            opens: snap.exists ? ((snap.data() ?? {})["opens"] ?? 0) : 0,
          },
          { merge: true },
        );
        tx.set(
          userRef,
          { referralCode: code, updatedAt: serverTimestamp(FieldValue) },
          { merge: true },
        );
        return code;
      }
      return "";
    });

    if (!claimed) return { ok: false, error: "Could not allocate a referral code — retry" };
    return { ok: true, code: claimed };
  });

/* ------------------------------------------------------------------ *
 * attributeReferral — bind a new user to the referral chain
 * ------------------------------------------------------------------ */

export type AttributeReferralInput = { uid: string; code: string };

export type AttributeReferralResult = {
  ok: boolean;
  reason?: "no_code" | "invalid_code" | "self_referral" | "already_attributed" | "ok";
  referrerUid?: string;
};

export const attributeReferral = createServerFn({ method: "POST" })
  .validator((input: AttributeReferralInput) => input)
  .handler(async ({ data }): Promise<AttributeReferralResult> => {
    const uid = str(data.uid);
    const code = sanitizeReferralCode(data.code);
    if (!uid) return { ok: false, reason: "invalid_code" };
    if (!code) return { ok: false, reason: "no_code" };

    const { adminDb, FieldValue } = await getDb();
    const users = adminDb.collection("users");
    const registry = adminDb.collection("referralCodes");

    const outcome = await adminDb.runTransaction(async (tx) => {
      const codeSnap = await tx.get(registry.doc(code));
      if (!codeSnap.exists) return { ok: false as const, reason: "invalid_code" as const };
      const referrerUid = str((codeSnap.data() ?? {})["uid"]);
      if (!referrerUid) return { ok: false as const, reason: "invalid_code" as const };
      if (referrerUid === uid) return { ok: false as const, reason: "self_referral" as const };

      const userSnap = await tx.get(users.doc(uid));
      if (!userSnap.exists) return { ok: false as const, reason: "invalid_code" as const };
      const current = str((userSnap.data() ?? {})["referredBy"]);
      if (current) {
        return current === referrerUid
          ? ({ ok: true as const, reason: "already_attributed" as const, referrerUid } as const)
          : ({ ok: false as const, reason: "already_attributed" as const } as const);
      }

      const now = serverTimestamp(FieldValue);
      tx.set(
        users.doc(uid),
        { referredBy: referrerUid, referredByCode: code, referredAt: now, updatedAt: now },
        { merge: true },
      );
      tx.set(
        registry.doc(code),
        { attributedCount: (num((codeSnap.data() ?? {})["attributedCount"]) || 0) + 1 },
        { merge: true },
      );

      // Increment per-level network counters up the chain (direct referrer's
      // l1, their referrer's l2, …). Cycle-guarded, capped at 5 levels.
      const visited = new Set<string>([uid]);
      let cursor = referrerUid;
      for (let level = 1; level <= REFERRAL_MAX_LEVELS; level++) {
        if (!cursor || visited.has(cursor)) break;
        visited.add(cursor);
        const snap = await tx.get(users.doc(cursor));
        if (!snap.exists) break;
        const counts = ((snap.data() ?? {})["referralTreeCount"] ?? {}) as Record<string, unknown>;
        tx.set(
          users.doc(cursor),
          {
            referralTreeCount: { ...counts, [`l${level}`]: num(counts[`l${level}`]) + 1 },
            updatedAt: now,
          },
          { merge: true },
        );
        cursor = str((snap.data() ?? {})["referredBy"]);
      }

      return { ok: true as const, reason: "ok" as const, referrerUid } as const;
    });

    return outcome;
  });

/* ------------------------------------------------------------------ *
 * resolveInvite — public invite landing resolution (+ open counter)
 * ------------------------------------------------------------------ */

export type ResolveInviteInput = { code: string; slug?: string };

export type ResolveInviteResult = {
  ok: boolean;
  code: string;
  referrer: { name: string; handle: string; initials: string } | null;
  competition: {
    slug: string;
    title: string;
    image: string;
    entryPriceKobo: number;
    status: string;
    drawDate: string;
  } | null;
};

export const resolveInvite = createServerFn({ method: "POST" })
  .validator((input: ResolveInviteInput) => input)
  .handler(async ({ data }): Promise<ResolveInviteResult> => {
    const code = sanitizeReferralCode(data.code);
    const slug = str(data.slug);
    const empty: ResolveInviteResult = { ok: false, code, referrer: null, competition: null };
    if (!code) return empty;

    const { adminDb, FieldValue } = await getDb();
    const codeSnap = await adminDb
      .collection("referralCodes")
      .doc(code)
      .get()
      .catch(() => null);
    if (!codeSnap?.exists) return empty;
    const registryData = codeSnap.data() ?? {};
    const uid = str(registryData["uid"]);
    if (!uid) return empty;

    const userSnap = await adminDb
      .collection("users")
      .doc(uid)
      .get()
      .catch(() => null);
    const user = userSnap?.data() ?? {};

    // Open counters: registry doc + denormalized onto the referrer's own user
    // doc so their dashboard can show it live without extra reads.
    void adminDb
      .collection("referralCodes")
      .doc(code)
      .set({ opens: (num(registryData["opens"]) || 0) + 1 }, { merge: true })
      .catch(() => {});
    void adminDb
      .collection("users")
      .doc(uid)
      .set({ inviteOpens: (num(user["inviteOpens"]) || 0) + 1 }, { merge: true })
      .catch(() => {});

    const name = displayNameOf({ ...registryData, ...user });
    const handle = str(user["handle"]) || str(registryData["handle"]);
    const referrer = { name, handle, initials: initialsOf(name, handle) };

    let competition: ResolveInviteResult["competition"] = null;
    if (slug) {
      const compSnap = await adminDb
        .collection("competitions")
        .doc(slug)
        .get()
        .catch(() => null);
      if (compSnap?.exists) {
        const comp = compSnap.data() ?? {};
        const images = Array.isArray(comp["images"]) ? (comp["images"] as unknown[]) : [];
        competition = {
          slug,
          title: str(comp["title"]) || slug,
          image: str(comp["image"]) || str(images[0] ?? ""),
          entryPriceKobo: num(comp["entryPrice"]),
          status: str(comp["status"]) || "LIVE",
          drawDate: str(comp["drawDate"] ?? comp["drawAt"] ?? ""),
        };
      }
    }

    return { ok: true, code, referrer, competition };
  });

/* ------------------------------------------------------------------ *
 * getReferralDashboard — recruits + rates for the dashboard page
 * ------------------------------------------------------------------ */

export type GetReferralDashboardInput = { uid: string };

export type ReferralRecruit = {
  uid: string;
  name: string;
  handle: string;
  initials: string;
  joinedAtMs: number;
  directRecruits: number;
  level?: number;
};

export type GetReferralDashboardResult = {
  ok: boolean;
  code: string;
  inviteOpens: number;
  attributedCount: number;
  directRecruits: number;
  totalNetwork: number;
  treeCounts: { l1: number; l2: number; l3: number; l4: number; l5: number };
  earnedTotalKobo: number;
  availableKobo: number;
  pendingPayoutKobo: number;
  rates: typeof DEFAULT_REFERRAL_RATES;
  minPayoutKobo: number;
  recruits: ReferralRecruit[];
  recruitsByLevel?: { l1: ReferralRecruit[]; l2: ReferralRecruit[]; l3: ReferralRecruit[] };
  commissions: Array<{
    id: string;
    level: number;
    ratePct: number;
    amountKobo: number;
    status: string;
    reference: string;
    buyerName: string;
    competition: string;
    createdAtMs: number;
  }>;
  payouts: Array<{
    id: string;
    amountKobo: number;
    bank: string;
    accountNumber: string;
    accountName: string;
    status: string;
    createdAtMs: number;
    note: string;
  }>;
};

export const getReferralDashboard = createServerFn({ method: "POST" })
  .validator((input: GetReferralDashboardInput) => input)
  .handler(async ({ data }): Promise<GetReferralDashboardResult> => {
    const uid = str(data.uid);
    const empty: GetReferralDashboardResult = {
      ok: false,
      code: "",
      inviteOpens: 0,
      attributedCount: 0,
      directRecruits: 0,
      totalNetwork: 0,
      treeCounts: { l1: 0, l2: 0, l3: 0, l4: 0, l5: 0 },
      earnedTotalKobo: 0,
      availableKobo: 0,
      pendingPayoutKobo: 0,
      rates: DEFAULT_REFERRAL_RATES,
      minPayoutKobo: 5000_00,
      recruits: [],
      commissions: [],
      payouts: [],
    };
    if (!uid) return empty;

    const { adminDb } = await getDb();
    const userSnap = await adminDb
      .collection("users")
      .doc(uid)
      .get()
      .catch(() => null);
    if (!userSnap?.exists) return empty;
    const user = userSnap.data() ?? {};

    // Make sure the user has a code (idempotent; reuses the exported fn logic
    // inline so a missing code is created in the same dashboard load).
    let code = sanitizeReferralCode(user["referralCode"]);
    if (code) {
      const owned = await adminDb
        .collection("referralCodes")
        .doc(code)
        .get()
        .catch(() => null);
      if (!owned?.exists || str((owned.data() ?? {})["uid"]) !== uid) code = "";
    }
    if (!code) {
      const ensured = await ensureReferralCode({ data: { uid } }).catch(() => null);
      if (ensured?.ok) code = ensured.code;
    }

    const configSnap = await adminDb
      .collection("platformSettings")
      .doc("raffila_config")
      .get()
      .catch(() => null);
    const config = configSnap?.data() ?? {};
    const rates = normalizeReferralRates(config["referralRates"]);
    const minPayoutKobo = Math.round(
      num((config["thresholds"] as Record<string, unknown> | undefined)?.["minPayout"], 5000) * 100,
    );

    // 3-Level Recruits Tree (Level 1: 10%, Level 2: 6%, Level 3: 4%)
    const l1Recruits: ReferralRecruit[] = [];
    const recruitsSnap = await adminDb
      .collection("users")
      .where("referredBy", "==", uid)
      .limit(50)
      .get()
      .catch(() => null);
    for (const doc of recruitsSnap?.docs ?? []) {
      const v = doc.data();
      const name = displayNameOf(v);
      const handle = str(v["handle"]);
      const counts = (v["referralTreeCount"] ?? {}) as Record<string, unknown>;
      l1Recruits.push({
        uid: doc.id,
        name,
        handle,
        initials: initialsOf(name, handle),
        joinedAtMs: tsToMs(v["referredAt"] ?? v["createdAt"]),
        directRecruits: num(counts["l1"]),
        level: 1,
      });
    }
    l1Recruits.sort((a, b) => b.joinedAtMs - a.joinedAtMs);

    const l2Recruits: ReferralRecruit[] = [];
    const l1Uids = l1Recruits.map((r) => r.uid);
    if (l1Uids.length > 0) {
      for (let i = 0; i < l1Uids.length; i += 10) {
        const chunk = l1Uids.slice(i, i + 10);
        const snap = await adminDb
          .collection("users")
          .where("referredBy", "in", chunk)
          .limit(50)
          .get()
          .catch(() => null);
        for (const doc of snap?.docs ?? []) {
          const v = doc.data();
          const name = displayNameOf(v);
          const handle = str(v["handle"]);
          const counts = (v["referralTreeCount"] ?? {}) as Record<string, unknown>;
          l2Recruits.push({
            uid: doc.id,
            name,
            handle,
            initials: initialsOf(name, handle),
            joinedAtMs: tsToMs(v["referredAt"] ?? v["createdAt"]),
            directRecruits: num(counts["l1"]),
            level: 2,
          });
        }
      }
      l2Recruits.sort((a, b) => b.joinedAtMs - a.joinedAtMs);
    }

    const l3Recruits: ReferralRecruit[] = [];
    const l2Uids = l2Recruits.map((r) => r.uid);
    if (l2Uids.length > 0) {
      for (let i = 0; i < l2Uids.length; i += 10) {
        const chunk = l2Uids.slice(i, i + 10);
        const snap = await adminDb
          .collection("users")
          .where("referredBy", "in", chunk)
          .limit(50)
          .get()
          .catch(() => null);
        for (const doc of snap?.docs ?? []) {
          const v = doc.data();
          const name = displayNameOf(v);
          const handle = str(v["handle"]);
          const counts = (v["referralTreeCount"] ?? {}) as Record<string, unknown>;
          l3Recruits.push({
            uid: doc.id,
            name,
            handle,
            initials: initialsOf(name, handle),
            joinedAtMs: tsToMs(v["referredAt"] ?? v["createdAt"]),
            directRecruits: num(counts["l1"]),
            level: 3,
          });
        }
      }
      l3Recruits.sort((a, b) => b.joinedAtMs - a.joinedAtMs);
    }

    const recruits = l1Recruits;

    // Commission ledger (server-written, owner-readable subcollection).
    const commissions: GetReferralDashboardResult["commissions"] = [];
    const commSnap = await adminDb
      .collection("users")
      .doc(uid)
      .collection("referralCommissions")
      .orderBy("createdAt", "desc")
      .limit(25)
      .get()
      .catch(() => null);
    for (const doc of commSnap?.docs ?? []) {
      const v = doc.data();
      commissions.push({
        id: doc.id,
        level: num(v["level"], 1),
        ratePct: num(v["ratePct"]),
        amountKobo: num(v["amountKobo"]),
        status: str(v["status"]) || "AVAILABLE",
        reference: str(v["reference"]),
        buyerName: str(v["buyerName"]) || "A member",
        competition: str(v["competition"]),
        createdAtMs: tsToMs(v["createdAt"]),
      });
    }

    // Payout requests (no orderBy — equality + order would need a composite
    // index; sorted here instead).
    const payouts: GetReferralDashboardResult["payouts"] = [];
    let pendingPayoutKobo = 0;
    const payoutsSnap = await adminDb
      .collection("payouts")
      .where("userId", "==", uid)
      .limit(50)
      .get()
      .catch(() => null);
    for (const doc of payoutsSnap?.docs ?? []) {
      const v = doc.data();
      const status = str(v["status"]) || "PENDING";
      const amountKobo = num(v["amountKobo"]);
      if (status === "PENDING" || status === "UNDER_REVIEW" || status === "PROCESSING") {
        pendingPayoutKobo += amountKobo;
      }
      payouts.push({
        id: doc.id,
        amountKobo,
        bank: str(v["bank"]),
        accountNumber: str(v["accountNumber"]),
        accountName: str(v["accountName"]),
        status,
        createdAtMs: tsToMs(v["createdAt"]),
        note: str(v["note"]),
      });
    }
    payouts.sort((a, b) => b.createdAtMs - a.createdAtMs);

    const counts = (user["referralTreeCount"] ?? {}) as Record<string, unknown>;
    const treeCounts = {
      l1: num(counts["l1"]),
      l2: num(counts["l2"]),
      l3: num(counts["l3"]),
      l4: num(counts["l4"]),
      l5: num(counts["l5"]),
    };
    const totalNetwork =
      treeCounts.l1 + treeCounts.l2 + treeCounts.l3 + treeCounts.l4 + treeCounts.l5;

    const registrySnap = code
      ? await adminDb
          .collection("referralCodes")
          .doc(code)
          .get()
          .catch(() => null)
      : null;

    return {
      ok: true,
      code,
      inviteOpens: num(registrySnap?.data?.()?.["opens"] ?? user["inviteOpens"]),
      attributedCount: num(registrySnap?.data?.()?.["attributedCount"] ?? treeCounts.l1),
      directRecruits: treeCounts.l1,
      totalNetwork,
      treeCounts,
      earnedTotalKobo: num(user["referralEarnedTotalKobo"]),
      availableKobo: num(user["referralEarningsKobo"]),
      pendingPayoutKobo,
      rates,
      minPayoutKobo,
      recruits,
      recruitsByLevel: {
        l1: l1Recruits,
        l2: l2Recruits,
        l3: l3Recruits,
      },
      commissions,
      payouts: payouts.slice(0, 10),
    };
  });

/* ------------------------------------------------------------------ *
 * requestReferralPayout — reserve balance and create a payout request
 * ------------------------------------------------------------------ */

export type RequestReferralPayoutInput = {
  uid: string;
  bank: string;
  accountNumber: string;
  accountName: string;
  amountKobo: number;
  note?: string;
};

export type RequestReferralPayoutResult = {
  ok: true;
  id: string;
  amountKobo: number;
  availableKobo: number;
};

export const requestReferralPayout = createServerFn({ method: "POST" })
  .validator((input: RequestReferralPayoutInput) => input)
  .handler(async ({ data }): Promise<RequestReferralPayoutResult> => {
    const uid = str(data.uid);
    const bank = str(data.bank);
    const accountNumber = str(data.accountNumber).replace(/\D/g, "");
    const accountName = str(data.accountName);
    const note = str(data.note);
    const amountKobo = Math.round(num(data.amountKobo));

    if (!uid) throw new Error("Sign in to request a payout");
    if (!bank) throw new Error("Bank name is required");
    if (accountNumber.length < 10) throw new Error("Enter a valid 10-digit account number");
    if (!accountName) throw new Error("Account name is required");
    if (!Number.isInteger(amountKobo) || amountKobo <= 0) throw new Error("Enter a valid amount");

    const { adminDb, FieldValue } = await getDb();
    const users = adminDb.collection("users");
    const payouts = adminDb.collection("payouts");

    const configSnap = await adminDb
      .collection("platformSettings")
      .doc("raffila_config")
      .get()
      .catch(() => null);
    const thresholds = (configSnap?.data?.()?.["thresholds"] ?? {}) as Record<string, unknown>;
    const minPayoutKobo = Math.round(num(thresholds["minPayout"], 5000) * 100);
    if (amountKobo < minPayoutKobo) {
      throw new Error(`Minimum payout is ₦${(minPayoutKobo / 100).toLocaleString("en-NG")}`);
    }

    const userSnap = await users
      .doc(uid)
      .get()
      .catch(() => null);
    if (!userSnap?.exists) throw new Error("Account not found");
    const user = userSnap.data() ?? {};

    const id = payouts.doc().id;
    const now = serverTimestamp(FieldValue);
    const available = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(users.doc(uid));
      const balance = num((snap.data() ?? {})["referralEarningsKobo"]);
      if (balance < amountKobo) throw new Error("Insufficient referral earnings for this payout");
      tx.set(
        users.doc(uid),
        {
          referralEarningsKobo: balance - amountKobo,
          referralPendingPayoutKobo:
            num((snap.data() ?? {})["referralPendingPayoutKobo"]) + amountKobo,
          updatedAt: now,
        },
        { merge: true },
      );
      tx.set(payouts.doc(id), {
        type: "REFERRAL",
        userId: uid,
        userName: displayNameOf(user),
        userHandle: str(user["handle"]),
        userEmail: str(user["email"]),
        amountKobo,
        bank,
        accountNumber,
        accountName,
        note,
        status: "PENDING",
        createdAt: now,
        updatedAt: now,
      });
      return balance - amountKobo;
    });

    return { ok: true, id, amountKobo, availableKobo: available };
  });

/* ------------------------------------------------------------------ *
 * adminSetPayoutStatus — approve/pay/reject with balance reconciliation
 * ------------------------------------------------------------------ */

export type AdminSetPayoutStatusInput = {
  adminUid: string;
  payoutId: string;
  status: "PROCESSING" | "PAID" | "FAILED" | "REVERSED" | "REJECTED";
  /** What the payout is for — recorded on the payout record for the audit trail. */
  reason?: string;
  /** Bank transfer / Paystack reference once the money has actually moved. */
  paymentReference?: string;
};

export type AdminSetPayoutStatusResult = { ok: boolean; error?: string };

export const adminSetPayoutStatus = createServerFn({ method: "POST" })
  .validator((input: AdminSetPayoutStatusInput) => input)
  .handler(async ({ data }): Promise<AdminSetPayoutStatusResult> => {
    const adminUid = str(data.adminUid);
    const payoutId = str(data.payoutId);
    const status = str(data.status).toUpperCase();
    const allowed = new Set(["PROCESSING", "PAID", "FAILED", "REVERSED", "REJECTED"]);
    if (!adminUid || !payoutId || !allowed.has(status))
      return { ok: false, error: "Invalid request" };

    const { adminDb, FieldValue } = await getDb();
    const adminSnap = await adminDb
      .collection("users")
      .doc(adminUid)
      .get()
      .catch(() => null);
    const adminData = adminSnap?.exists ? (adminSnap.data() ?? {}) : {};
    if (!adminSnap?.exists || str(adminData["role"]) !== "admin") {
      return { ok: false, error: "Admin access required" };
    }
    const adminName =
      str(adminData["displayName"]) ||
      [str(adminData["firstName"]), str(adminData["lastName"])].filter(Boolean).join(" ") ||
      str(adminData["email"]);

    const payoutRef = adminDb.collection("payouts").doc(payoutId);
    const now = serverTimestamp(FieldValue);
    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(payoutRef);
      if (!snap.exists) throw new Error("Payout not found");
      const v = snap.data() ?? {};
      const prev = str(v["status"]);
      const amountKobo = num(v["amountKobo"]);
      const userId = str(v["userId"]);
      const settles =
        status === "PAID" || status === "FAILED" || status === "REJECTED" || status === "REVERSED";
      const wasOpen = prev === "PENDING" || prev === "UNDER_REVIEW" || prev === "PROCESSING";
      const refunds = status === "FAILED" || status === "REJECTED" || status === "REVERSED";
      // Refund when settling an open reservation with a failure/reject/reverse, or
      // when reversing an already-paid payout. Guard against refunding twice if an
      // admin settles a payout that was already refunded.
      const alreadyRefunded = prev === "FAILED" || prev === "REJECTED" || prev === "REVERSED";
      const shouldRefund = settles && refunds && userId && !alreadyRefunded;
      if (shouldRefund) {
        // Return the amount to the user's available balance.
        const userRef = adminDb.collection("users").doc(userId);
        const userSnap = await tx.get(userRef);
        const pending = num((userSnap.data() ?? {})["referralPendingPayoutKobo"]);
        tx.set(
          userRef,
          {
            referralEarningsKobo: num((userSnap.data() ?? {})["referralEarningsKobo"]) + amountKobo,
            referralPendingPayoutKobo: wasOpen ? Math.max(0, pending - amountKobo) : pending,
            updatedAt: now,
          },
          { merge: true },
        );
      } else if (settles && wasOpen && userId) {
        const userRef = adminDb.collection("users").doc(userId);
        const userSnap = await tx.get(userRef);
        const pending = num((userSnap.data() ?? {})["referralPendingPayoutKobo"]);
        tx.set(
          userRef,
          { referralPendingPayoutKobo: Math.max(0, pending - amountKobo), updatedAt: now },
          { merge: true },
        );
      }
      // Audit trail: who settled it, when, what it was for, and the payment
      // reference once the money has moved. `reason` is back-filled so a
      // payout can always answer "what was this paid for?".
      const audit = payoutAuditWrite({
        status,
        adminUid,
        adminName,
        reason:
          str(data.reason) ||
          str(v["reason"]) ||
          defaultPayoutReason(normalizePayoutType(v["type"])),
        paymentReference: str(data.paymentReference) || str(v["paymentReference"]),
      });
      tx.set(
        payoutRef,
        { status, updatedAt: now, reviewedAt: now, reviewedBy: adminUid, ...audit },
        { merge: true },
      );
    });
    return { ok: true };
  });

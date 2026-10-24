import { createServerFn } from "@tanstack/react-start";

import {
  REFERRAL_MAX_LEVELS,
  normalizeReferralRates,
  referralCommissionKobo,
} from "./referral-core";
import {
  broadcastIds,
  broadcastMailDoc,
  broadcastNotifDoc,
  directMailDoc,
  milestoneEmail,
  milestoneLabel,
  milestoneStage,
  normalizeMilestonePct,
  personalNotifDoc,
  purchaseReceiptEmail,
  receiptIds,
} from "./notify";

/**
 * Structural types for the pieces of the Admin SDK used below. Declared
 * locally on purpose: importing types from "firebase-admin/*" here would put
 * a Node-only package into the browser module graph (this file IS imported by
 * client components), which breaks the Vite client build.
 */
type AdminDocSnapshot = {
  exists: boolean;
  data(): Record<string, unknown> | undefined;
  get(field: string): unknown;
};
type AdminCollectionRef = {
  doc(id: string): AdminDocRef;
  add(data: Record<string, unknown>): void;
};
type AdminDocRef = {
  get(): Promise<AdminDocSnapshot>;
  collection(name: string): AdminCollectionRef;
  set(data: Record<string, unknown>, options?: { merge?: boolean }): void;
};
type AdminTransaction = {
  get(ref: AdminDocRef): Promise<AdminDocSnapshot>;
  set(ref: AdminDocRef, data: Record<string, unknown>, options?: { merge?: boolean }): void;
};
type AdminFirestore = {
  collection(name: string): AdminCollectionRef;
  runTransaction<T>(fn: (tx: AdminTransaction) => Promise<T>): Promise<T>;
};

const PAYSTACK_API_BASE = "https://api.paystack.co";

function getSecretKey(): string {
  const key = (typeof process !== "undefined" && process.env?.["PAYSTACK_SECRET_KEY"]) || "";
  return (key || "").trim();
}

/** Origin used for links inside server-generated notification emails. */
function notifyOrigin(): string {
  const env = (typeof process !== "undefined" && process.env?.["SITE_ORIGIN"]) || "";
  return env.trim() || "https://raffila.com";
}

type PaystackApiResponse<T> = {
  status: boolean;
  message: string;
  data: T;
};

async function paystackRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const secret = getSecretKey();
  if (!secret) {
    throw new Error(
      "PAYSTACK_SECRET_KEY is not set. Add it to .env (server only, no VITE_ prefix).",
    );
  }
  const res = await fetch(`${PAYSTACK_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const body = (await res.json().catch(() => null)) as PaystackApiResponse<T> | null;
  if (!res.ok || !body?.status) {
    throw new Error(body?.message || `Paystack request failed (${res.status})`);
  }
  return body.data;
}

export type InitializeInput = {
  email: string;
  amountKobo: number;
  reference: string;
  callbackUrl?: string;
  metadata?: Record<string, unknown>;
};

export type InitializeResult = {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
};

/**
 * Initialize a Paystack transaction and return the checkout URL.
 * Runs server-side so the secret key never reaches the browser.
 */
export const initializePaystackTransaction = createServerFn({ method: "POST" })
  .validator((input: InitializeInput) => input)
  .handler(async ({ data }): Promise<InitializeResult> => {
    const email = data.email?.trim().toLowerCase();
    if (!email || !email.includes("@")) throw new Error("A valid email is required");
    if (!Number.isInteger(data.amountKobo) || data.amountKobo < 10000) {
      // Paystack minimum practical floor: ₦100 (10,000 kobo)
      throw new Error("Minimum funding amount is ₦100");
    }
    if (!data.reference || data.reference.length < 4) {
      throw new Error("A valid payment reference is required");
    }

    const payload = await paystackRequest<{
      authorization_url: string;
      access_code: string;
      reference: string;
    }>("/transaction/initialize", {
      method: "POST",
      body: JSON.stringify({
        email,
        amount: data.amountKobo,
        reference: data.reference,
        callback_url: data.callbackUrl,
        metadata: {
          purpose: "wallet_funding",
          ...(data.metadata ?? {}),
        },
      }),
    });

    return {
      authorizationUrl: payload.authorization_url,
      accessCode: payload.access_code,
      reference: payload.reference,
    };
  });

export type VerifyResult = {
  ok: boolean;
  status: string;
  reference: string;
  amountKobo: number;
  paidAt: string | null;
  email: string | null;
  gatewayResponse: string | null;
};

export type TicketOrderLine = {
  competitionSlug: string;
  quantity: number;
};

export type IssuedTicketLine = {
  competitionSlug: string;
  competitionTitle: string;
  competitionImage: string;
  quantity: number;
  entryId: string;
  ticketNumbers: string[];
};

export type TicketConfirmResult =
  | {
      ok: true;
      items: IssuedTicketLine[];
      amountKobo: number;
      reference: string;
      alreadyConfirmed: boolean;
      paidAt: string | null;
    }
  | {
      ok: false;
      status: string;
      gatewayResponse: string | null;
    };

export const CART_MAX_ORDER_LINES = 20;
export const CART_MAX_QTY_PER_LINE = 50;

/** Default share of every entry fee that accrues to the community pool. */
export const DEFAULT_REWARD_POOL_PCT = 5;

/**
 * Clamp an admin-entered pool contribution percentage into a usable 0–100
 * number. Missing/invalid input falls back to the default rate.
 */
export function normalizeRewardPoolPct(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_REWARD_POOL_PCT;
  return Math.min(100, Math.max(0, n));
}

/** Kobo that accrues to the reward pool for an entry-fee amount at a rate. */
export function rewardPoolContributionKobo(amountKobo: number, pct: number): number {
  if (!Number.isFinite(amountKobo) || amountKobo <= 0) return 0;
  if (!Number.isFinite(pct) || pct <= 0) return 0;
  return Math.round((amountKobo * Math.min(100, pct)) / 100);
}

/**
 * Normalize order lines from Paystack metadata or client input. Accepts
 * `{ items: [...] }` (cart checkout) or a legacy single
 * `{ competitionSlug, quantity }` object. Merges duplicate slugs.
 */
export function normalizeOrderLines(input: unknown): TicketOrderLine[] {
  const container = input as { items?: unknown } | null;
  const raw = Array.isArray(container?.items) ? container.items : [input];
  const lines: TicketOrderLine[] = [];
  for (const it of raw) {
    const rec = it as Record<string, unknown>;
    const slug = String(rec?.["competitionSlug"] ?? "").trim();
    const qty = Math.floor(Number(rec?.["quantity"] ?? 0));
    if (!slug || !Number.isInteger(qty) || qty < 1 || qty > CART_MAX_QTY_PER_LINE) {
      throw new Error("Each order line needs a competition and 1–50 tickets");
    }
    const dupe = lines.find((l) => l.competitionSlug === slug);
    if (dupe) {
      dupe.quantity = Math.min(CART_MAX_QTY_PER_LINE, dupe.quantity + qty);
    } else {
      if (lines.length >= CART_MAX_ORDER_LINES) {
        throw new Error("Too many competitions in one order (max 20)");
      }
      lines.push({ competitionSlug: slug, quantity: qty });
    }
  }
  if (lines.length === 0) throw new Error("Your cart is empty");
  return lines;
}

const CLOSED_COMPETITION_STATUSES = new Set([
  "DRAW_READY",
  "DRAW-READY",
  "DRAW_IN_PROGRESS",
  "WINNER_SELECTED",
  "COMPLETED",
  "CLOSED",
  "CANCELLED",
  "SUSPENDED",
  "REFUND_REQUIRED",
]);

function randomTicketNumber(): string {
  return String(Math.floor(Math.random() * 900000) + 100000);
}

function generateEntryId(): string {
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase().padEnd(4, "0").slice(0, 4);
  const rand2 = Math.random().toString(36).slice(2, 6).toUpperCase().padEnd(4, "0").slice(0, 4);
  return `RF-2026-${rand}${rand2}`;
}

type ValidatedOrderLine = {
  slug: string;
  quantity: number;
  entryPriceKobo: number;
  title: string;
  image: string;
  competitionRef: AdminDocRef;
};

type IssueOrderArgs = {
  lines: TicketOrderLine[];
  uid: string;
  email: string;
  userName: string;
  userHandle: string;
  reference: string;
  kind: "paystack" | "referral";
  /** Verified Paystack amount. Ignored for referral (server prices rule). */
  paidKobo: number;
  paidAt: string | null;
};

/**
 * Shared issuance core: validates every line against live Firestore state
 * (open? priced? in stock?), allocates unique ticket numbers, then writes
 * tickets + user entries + counters + idempotency record in ONE transaction.
 * For referral orders it also debits referralEarningsKobo atomically, so a
 * balance can never be double-spent by double submission. The wallet is
 * never touched by any path here.
 */
async function issueOrderTickets(
  adminDb: AdminFirestore,
  args: IssueOrderArgs,
): Promise<{ items: IssuedTicketLine[]; expectedTotalKobo: number; alreadyConfirmed: boolean }> {
  // Server-only: dynamic import keeps firebase-admin out of the client bundle.
  const { FieldValue } = await import("./firebase-admin");
  const { lines, uid, email, userName, userHandle, reference, kind, paidKobo, paidAt } = args;
  const processedRef = adminDb.collection("processedPayments").doc(reference);

  const validated: ValidatedOrderLine[] = [];
  let expectedTotalKobo = 0;
  for (const line of lines) {
    const competitionRef = adminDb.collection("competitions").doc(line.competitionSlug);
    const snap = await competitionRef.get();
    if (!snap.exists) throw new Error(`Competition no longer exists (${line.competitionSlug})`);
    const comp = snap.data() ?? {};
    const compStatus = String(comp["status"] ?? "LIVE").toUpperCase();
    const closed =
      comp["entriesClosed"] === true ||
      comp["entriesPaused"] === true ||
      CLOSED_COMPETITION_STATUSES.has(compStatus);
    const title = String(comp["title"] ?? comp["assetName"] ?? line.competitionSlug);
    if (closed) throw new Error(`Entries are closed for ${title} — no charge was kept`);
    const entryPriceKobo = Number(comp["entryPrice"] ?? 0) || 0;
    if (entryPriceKobo <= 0) throw new Error(`${title} has no valid ticket price`);
    const soldSoFar = Number(comp["entriesSold"] ?? 0) || 0;
    const totalEntries = Number(comp["totalEntries"] ?? 0) || 0;
    if (totalEntries > 0 && soldSoFar + line.quantity > totalEntries) {
      throw new Error(`Not enough tickets remaining for ${title}`);
    }
    const images = Array.isArray(comp["images"]) ? (comp["images"] as unknown[]) : [];
    validated.push({
      slug: line.competitionSlug,
      quantity: line.quantity,
      entryPriceKobo,
      title,
      image: String(comp["image"] ?? images[0] ?? ""),
      competitionRef,
    });
    expectedTotalKobo += entryPriceKobo * line.quantity;
  }

  if (kind === "paystack" && paidKobo < expectedTotalKobo) {
    throw new Error(
      `Underpaid ticket order: received ${paidKobo} kobo, expected ${expectedTotalKobo} kobo`,
    );
  }
  const chargeKobo = kind === "paystack" ? paidKobo : expectedTotalKobo;

  // Unique ticket numbers per competition (doc id IS TKT-{number}).
  const allocations = new Map<string, string[]>();
  for (const line of validated) {
    const nums: string[] = [];
    const seen = new Set<string>();
    for (
      let attempt = 0;
      nums.length < line.quantity && attempt < line.quantity * 25 + 25;
      attempt++
    ) {
      const num = randomTicketNumber();
      if (seen.has(num)) continue;
      seen.add(num);
      const exists = await line.competitionRef.collection("tickets").doc(`TKT-${num}`).get();
      if (!exists.exists) nums.push(num);
    }
    if (nums.length < line.quantity) {
      throw new Error("Could not allocate unique ticket numbers — please retry");
    }
    allocations.set(line.slug, nums);
  }

  const now = FieldValue.serverTimestamp();
  let items: IssuedTicketLine[] = [];
  let alreadyConfirmed = false;

  await adminDb.runTransaction(async (tx) => {
    const recheck = await tx.get(processedRef);
    if (recheck.exists) {
      const prev = recheck.data() ?? {};
      items = (prev["items"] as IssuedTicketLine[]) ?? [];
      alreadyConfirmed = true;
      return;
    }
    // Reward pool: every qualifying entry fee contributes the admin-configured
    // percentage (Admin → Config → Reward pool, default 5%) to the community
    // pool, credited inside the same transaction as the idempotency record so
    // a retry can never double-credit it. Doc ids are inlined because this
    // file is imported by client components and must not pull in the client
    // Firebase modules that own those constants.
    const configSnap = await tx.get(adminDb.collection("platformSettings").doc("raffila_config"));
    const notifyCfg =
      (configSnap.data()?.["notifications"] as Record<string, unknown> | undefined) ?? {};
    const milestonePcts = normalizeMilestonePct(notifyCfg["milestonePct"]);
    const notifyEmail = notifyCfg["email"] !== false;
    const notifyInapp = notifyCfg["inapp"] !== false;
    const pct = normalizeRewardPoolPct(
      (configSnap.data()?.["rewardPool"] as Record<string, unknown> | undefined)?.[
        "contributionPct"
      ],
    );
    const contributionKobo = rewardPoolContributionKobo(expectedTotalKobo, pct);
    if (contributionKobo > 0) {
      tx.set(
        adminDb.collection("platformSettings").doc("rewardPool"),
        {
          totalKobo: FieldValue.increment(contributionKobo),
          contributionsCount: FieldValue.increment(1),
          lastContributionKobo: contributionKobo,
          lastReference: reference,
          updatedAt: now,
        },
        { merge: true },
      );
    }
    // Referral commissions: pay the up to 5 uplines in the SAME transaction
    // that issues the tickets, so a commission can never be missed, doubled,
    // or orphaned from the purchase that earned it. Rates come from Admin →
    // Config → Referral rates (default 10/5/3/2/1%); every commission is
    // immediately AVAILABLE. All purchases earn — including ones paid with
    // referral earnings — per product decision. Self-referral and cycles are
    // blocked by the visited-uid guard.
    if (expectedTotalKobo > 0) {
      const refRates = normalizeReferralRates(configSnap.data()?.["referralRates"]);
      const competitionNames = validated
        .map((v) => v.title)
        .join(", ")
        .slice(0, 200);
      const visited = new Set<string>([uid]);
      let cursor = uid;
      for (let level = 1; level <= REFERRAL_MAX_LEVELS; level++) {
        const chainSnap = await tx.get(adminDb.collection("users").doc(cursor));
        const upline = String((chainSnap.data() ?? {})["referredBy"] ?? "").trim();
        if (!upline || visited.has(upline)) break;
        visited.add(upline);
        const ratePct = refRates[`l${level}` as keyof typeof refRates];
        const commissionKobo = referralCommissionKobo(expectedTotalKobo, ratePct);
        if (commissionKobo > 0) {
          tx.set(
            adminDb
              .collection("users")
              .doc(upline)
              .collection("referralCommissions")
              .doc(`${reference}-L${level}`),
            {
              reference,
              buyerUid: uid,
              buyerName: userName || email || uid,
              level,
              ratePct,
              amountKobo: commissionKobo,
              status: "AVAILABLE",
              competition: competitionNames,
              createdAt: now,
            },
            { merge: true },
          );
          tx.set(
            adminDb.collection("users").doc(upline),
            {
              referralEarningsKobo: FieldValue.increment(commissionKobo),
              referralEarnedTotalKobo: FieldValue.increment(commissionKobo),
              updatedAt: now,
            },
            { merge: true },
          );
        }
        cursor = upline;
      }
    }
    if (kind === "referral") {
      const userRef = adminDb.collection("users").doc(uid);
      const userSnap = await tx.get(userRef);
      const balance = Number(userSnap.get("referralEarningsKobo") ?? 0) || 0;
      if (balance < expectedTotalKobo) {
        throw new Error("Insufficient referral earnings for this order");
      }
      tx.set(
        userRef,
        { referralEarningsKobo: balance - expectedTotalKobo, updatedAt: now },
        { merge: true },
      );
    }
    const built: IssuedTicketLine[] = [];
    for (const line of validated) {
      const entryId = generateEntryId();
      const ticketNumbers = allocations.get(line.slug) ?? [];
      for (const num of ticketNumbers) {
        tx.set(line.competitionRef.collection("tickets").doc(`TKT-${num}`), {
          ticketNumber: num,
          ticketCode: `TKT-${num}`,
          competitionSlug: line.slug,
          competitionId: line.slug,
          entryId,
          userId: uid,
          userName,
          userHandle,
          userEmail: email,
          purchasedAt: now,
          createdAt: now,
          status: "ACTIVE",
          paymentStatus: "CONFIRMED",
          paystackReference: kind === "paystack" ? reference : null,
          referralReference: kind === "referral" ? reference : null,
        });
      }
      tx.set(
        adminDb.collection("users").doc(uid).collection("entries").doc(entryId),
        {
          entryId,
          competitionSlug: line.slug,
          competitionTitle: line.title,
          competitionImage: line.image,
          quantity: line.quantity,
          ticketNumbers,
          amountKobo: line.entryPriceKobo * line.quantity,
          paystackReference: kind === "paystack" ? reference : null,
          referralReference: kind === "referral" ? reference : null,
          status: "CONFIRMED",
          createdAt: now,
        },
        { merge: true },
      );
      // Milestone claim: read the competition inside the same transaction so
      // concurrent purchases can never double-fire a threshold. The stage
      // stamp (highest milestone count reached) is written alongside the
      // increment; the broadcast docs use deterministic ids for the stage.
      const compSnap = await tx.get(line.competitionRef);
      const compData = compSnap.data() ?? {};
      const soldBefore = Number(compData["entriesSold"] ?? 0) || 0;
      const totalE = Number(compData["totalEntries"] ?? 0) || 0;
      const stageBefore = Number(compData["milestoneStage"] ?? 0) || 0;
      const soldAfter = soldBefore + line.quantity;
      const stageAfter = milestoneStage(soldAfter, totalE, milestonePcts);
      const newStage = stageAfter > stageBefore ? stageAfter : null;
      tx.set(
        line.competitionRef,
        {
          entriesSold: FieldValue.increment(line.quantity),
          ...(newStage ? { milestoneStage: newStage } : {}),
          updatedAt: now,
        },
        { merge: true },
      );
      if (newStage) {
        const ids = broadcastIds("milestone", line.slug, newStage);
        const label = milestoneLabel(newStage, soldAfter, totalE, milestonePcts);
        if (notifyInapp) {
          tx.set(
            adminDb.collection("notifications").doc(ids.notification),
            broadcastNotifDoc({
              category: "milestone",
              title: `${line.title} is filling fast`,
              body: label,
              href: `/competitions/${line.slug}`,
              createdAt: now,
            }),
          );
        }
        if (notifyEmail) {
          tx.set(
            adminDb.collection("mail").doc(ids.mail),
            broadcastMailDoc({
              kind: "milestone",
              message: milestoneEmail({
                title: line.title,
                slug: line.slug,
                label,
                origin: notifyOrigin(),
              }),
              createdAt: now,
            }),
          );
        }
      }
      built.push({
        competitionSlug: line.slug,
        competitionTitle: line.title,
        competitionImage: line.image,
        quantity: line.quantity,
        entryId,
        ticketNumbers,
      });
    }
    tx.set(processedRef, {
      kind: kind === "paystack" ? "ticket_purchase" : "referral_purchase",
      uid,
      items: built,
      amountKobo: chargeKobo,
      email,
      paidAt,
      createdAt: now,
    });
    items = built;
  });

  // Buyer receipt (in-app always; email when we have an address). Runs only on
  // the first confirmation — the idempotency record makes replays a no-op.
  if (!alreadyConfirmed) {
    try {
      const ids = receiptIds(reference);
      const totalTickets = items.reduce((n, i) => n + i.quantity, 0);
      const names = items.map((i) => i.competitionTitle).join(", ");
      await adminDb
        .collection("notifications")
        .doc(ids.notification)
        .set(
          personalNotifDoc({
            userId: uid,
            category: "receipt",
            title: `Tickets confirmed — ${totalTickets} ticket${totalTickets === 1 ? "" : "s"}`,
            body: `${names} — order ${reference}`,
            href: "/dashboard/entries",
            createdAt: now,
          }),
        );
      const to = email.trim();
      if (to) {
        const receiptItems = items.map((i) => ({
          title: i.competitionTitle,
          quantity: i.quantity,
          ticketNumbers: i.ticketNumbers,
          amountKobo:
            (validated.find((v) => v.slug === i.competitionSlug)?.entryPriceKobo ?? 0) * i.quantity,
        }));
        await adminDb
          .collection("mail")
          .doc(ids.mail)
          .set(
            directMailDoc({
              to,
              uid,
              kind: "receipt",
              message: purchaseReceiptEmail({
                buyerName: userName || to,
                reference,
                items: receiptItems,
                totalKobo: chargeKobo,
                paidWith: kind,
                origin: notifyOrigin(),
              }),
              createdAt: now,
            }),
          );
      }
    } catch {
      // Notification enqueue is best-effort; tickets are already issued.
    }
  }

  try {
    const via = kind === "paystack" ? "Paystack" : "referral earnings";
    const totalTickets = items.reduce((n, i) => n + i.quantity, 0);
    // Name the competitions in the summary so the audit table is searchable by
    // competition without opening the raw details blob.
    const names = items.map((i) => i.competitionTitle).join(", ");
    const nowIso = new Date().toISOString();
    // Written directly with the server credential (the client-side logActivity
    // uses the user's session, which cannot see every purchase). Fields the
    // admin UI reads must all be present or the row renders as "Unknown"/"Low".
    await adminDb.collection("activityLogs").add({
      eventType: "TICKET_PURCHASE",
      riskLevel: "low",
      actorId: uid,
      actorEmail: email,
      actorName: userName || email || uid,
      actorRole: "user",
      targetType: "cart_order",
      targetId: reference,
      summary: `Purchased ${totalTickets} ticket(s) for ${names || items.length + " competition(s)"} via ${via}`,
      details: { items, reference, totalTickets, amountKobo: chargeKobo },
      clientAt: nowIso,
      createdAt: now,
    });
  } catch {
    // Audit logging is best-effort; tickets are already secured above.
  }

  return { items, expectedTotalKobo, alreadyConfirmed };
}

/**
 * Verify a direct (cart or single) ticket payment and issue draw tickets in
 * one atomic, idempotent step. Money moves card/bank/USSD → Paystack
 * settlement; tickets move server → draw pool. The wallet is never touched.
 *
 * Expects initialize metadata: { items: [{competitionSlug, quantity}], uid }
 * (legacy single `{ competitionSlug, quantity, uid }` also accepted).
 */
export const confirmTicketPurchase = createServerFn({ method: "POST" })
  .validator((input: { reference: string }) => input)
  .handler(async ({ data }): Promise<TicketConfirmResult> => {
    const reference = (data.reference || "").trim();
    if (!reference) throw new Error("Transaction reference is required");

    const txn = await paystackRequest<{
      status: string;
      reference: string;
      amount: number;
      paid_at: string | null;
      gateway_response: string | null;
      customer?: { email?: string } | null;
      metadata?: Record<string, unknown> | null;
    }>(`/transaction/verify/${encodeURIComponent(reference)}`);

    if (txn.status !== "success") {
      return { ok: false, status: txn.status, gatewayResponse: txn.gateway_response ?? null };
    }

    const meta = txn.metadata ?? {};
    const lines = normalizeOrderLines(
      Array.isArray(meta["items"]) ? { items: meta["items"] } : meta,
    );
    const uid = String(meta["uid"] ?? "").trim();
    if (!uid) throw new Error("Payment is missing its buyer reference");

    const paidKobo = Math.round(txn.amount);
    if (!Number.isFinite(paidKobo) || paidKobo <= 0) {
      throw new Error("Paystack returned an invalid amount");
    }

    const { getAdminDb } = await import("./firebase-admin");
    const adminDb = getAdminDb();
    const processedRef = adminDb.collection("processedPayments").doc(reference);

    // Fast idempotency path before touching competition docs.
    const existing = await processedRef.get().catch(() => null);
    if (existing?.exists) {
      const prev = existing.data() ?? {};
      return {
        ok: true,
        items: (prev["items"] as IssuedTicketLine[]) ?? [],
        amountKobo: Number(prev["amountKobo"] ?? paidKobo) || paidKobo,
        reference,
        alreadyConfirmed: true,
        paidAt: txn.paid_at ?? null,
      };
    }

    const email = txn.customer?.email ?? String(meta["email"] ?? "");
    const userName = String(meta["userName"] ?? "Raffila Member");
    const userHandle = String(meta["userHandle"] ?? "");
    const { items, alreadyConfirmed } = await issueOrderTickets(adminDb, {
      lines,
      uid,
      email,
      userName,
      userHandle,
      reference,
      kind: "paystack",
      paidKobo,
      paidAt: txn.paid_at ?? null,
    });

    return {
      ok: true,
      items,
      amountKobo: paidKobo,
      reference,
      alreadyConfirmed,
      paidAt: txn.paid_at ?? null,
    };
  });

/**
 * Pay for an order with referral earnings: verifies the server-side balance,
 * debits it and issues tickets atomically. No Paystack, no wallet.
 */
export const confirmReferralPurchase = createServerFn({ method: "POST" })
  .validator((input: { items: TicketOrderLine[]; uid: string; reference: string }) => input)
  .handler(async ({ data }): Promise<TicketConfirmResult> => {
    const uid = (data.uid || "").trim();
    const reference = (data.reference || "").trim();
    if (!uid) throw new Error("Sign in to complete your purchase");
    if (!reference) throw new Error("Order reference is required");
    const lines = normalizeOrderLines({ items: data.items });

    const { getAdminDb } = await import("./firebase-admin");
    const adminDb = getAdminDb();

    const existing = await adminDb
      .collection("processedPayments")
      .doc(reference)
      .get()
      .catch(() => null);
    if (existing?.exists) {
      const prev = existing.data() ?? {};
      return {
        ok: true,
        items: (prev["items"] as IssuedTicketLine[]) ?? [],
        amountKobo: Number(prev["amountKobo"] ?? 0) || 0,
        reference,
        alreadyConfirmed: true,
        paidAt: null,
      };
    }

    const { items, expectedTotalKobo, alreadyConfirmed } = await issueOrderTickets(adminDb, {
      lines,
      uid,
      email: "",
      userName: "Raffila Member",
      userHandle: "",
      reference,
      kind: "referral",
      paidKobo: 0,
      paidAt: null,
    });

    return {
      ok: true,
      items,
      amountKobo: expectedTotalKobo,
      reference,
      alreadyConfirmed,
      paidAt: null,
    };
  });

export type ConfirmInput = {
  reference: string;
  uid: string;
};

export type ConfirmResult =
  | {
      ok: true;
      amountKobo: number;
      balanceAfterKobo: number | null;
      alreadyCredited: boolean;
      paidAt: string | null;
    }
  | {
      ok: false;
      status: string;
      gatewayResponse: string | null;
    };

/**
 * Verify a Paystack transaction and credit the user's wallet in one atomic,
 * idempotent step. Runs entirely server-side with the Admin SDK (clients are
 * blocked from writing balances by Firestore rules).
 *
 * Idempotency: `processedPayments/{reference}` is created inside the same
 * Firestore transaction as the credit, so refreshes/retries and Paystack
 * replays can never double-credit.
 */
export const confirmWalletFunding = createServerFn({ method: "POST" })
  .validator((input: ConfirmInput) => input)
  .handler(async ({ data }): Promise<ConfirmResult> => {
    const reference = (data.reference || "").trim();
    const uid = (data.uid || "").trim();
    if (!reference) throw new Error("Transaction reference is required");
    if (!uid) throw new Error("You must be signed in to complete wallet funding");

    const txn = await paystackRequest<{
      status: string;
      reference: string;
      amount: number;
      paid_at: string | null;
      gateway_response: string | null;
      customer?: { email?: string } | null;
    }>(`/transaction/verify/${encodeURIComponent(reference)}`);

    if (txn.status !== "success") {
      return { ok: false, status: txn.status, gatewayResponse: txn.gateway_response ?? null };
    }

    const amountKobo = Math.round(txn.amount);
    if (!Number.isFinite(amountKobo) || amountKobo <= 0) {
      throw new Error("Paystack returned an invalid amount");
    }

    // Server-only: dynamic import keeps firebase-admin out of the client bundle.
    const { getAdminDb, FieldValue } = await import("./firebase-admin");
    const adminDb = getAdminDb();

    const processedRef = adminDb.collection("processedPayments").doc(reference);
    const userRef = adminDb.collection("users").doc(uid);
    const ledgerRef = userRef.collection("walletTransactions").doc(reference);

    const outcome = await adminDb.runTransaction(async (tx) => {
      const processedSnap = await tx.get(processedRef);
      if (processedSnap.exists) {
        const prev = processedSnap.data();
        return {
          alreadyCredited: true,
          amountKobo: Number(prev?.["amountKobo"] ?? amountKobo) || amountKobo,
        };
      }

      const userSnap = await tx.get(userRef);
      const prevBalance = Number(userSnap.get("walletBalanceKobo") ?? 0) || 0;
      const nextBalance = prevBalance + amountKobo;
      const now = FieldValue.serverTimestamp();

      tx.set(userRef, { walletBalanceKobo: nextBalance, updatedAt: now }, { merge: true });
      tx.set(ledgerRef, {
        type: "Wallet credit",
        amountKobo,
        balanceAfterKobo: nextBalance,
        reference: txn.reference,
        provider: "paystack",
        email: txn.customer?.email ?? null,
        paidAt: txn.paid_at ?? null,
        createdAt: now,
      });
      tx.set(processedRef, {
        uid,
        amountKobo,
        email: txn.customer?.email ?? null,
        paidAt: txn.paid_at ?? null,
        createdAt: now,
      });

      return { alreadyCredited: false, amountKobo, balanceAfterKobo: nextBalance };
    });

    if (outcome.alreadyCredited) {
      // Re-read the balance so the client can display it.
      const userSnap = await userRef.get().catch(() => null);
      const balance = userSnap ? Number(userSnap.get("walletBalanceKobo") ?? 0) || 0 : 0;
      return {
        ok: true,
        amountKobo: outcome.amountKobo,
        balanceAfterKobo: balance,
        alreadyCredited: true,
        paidAt: txn.paid_at ?? null,
      };
    }

    return {
      ok: true,
      amountKobo: outcome.amountKobo,
      balanceAfterKobo: outcome.balanceAfterKobo ?? null,
      alreadyCredited: false,
      paidAt: txn.paid_at ?? null,
    };
  });

/**
 * Verify a transaction by reference. Only `success` counts as paid —
 * always gate wallet credit on `ok === true`.
 */
export const verifyPaystackTransaction = createServerFn({ method: "GET" })
  .validator((reference: string) => reference)
  .handler(async ({ data: reference }): Promise<VerifyResult> => {
    const ref = (reference || "").trim();
    if (!ref) throw new Error("Transaction reference is required");

    const txn = await paystackRequest<{
      status: string;
      reference: string;
      amount: number;
      paid_at: string | null;
      gateway_response: string | null;
      customer?: { email?: string } | null;
    }>(`/transaction/verify/${encodeURIComponent(ref)}`);

    const ok = txn.status === "success";
    return {
      ok,
      status: txn.status,
      reference: txn.reference,
      amountKobo: txn.amount,
      paidAt: txn.paid_at,
      email: txn.customer?.email ?? null,
      gatewayResponse: txn.gateway_response,
    };
  });

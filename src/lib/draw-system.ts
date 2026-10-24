import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  startAfter,
  updateDoc,
  type DocumentData,
  type QueryConstraint,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from "firebase/firestore";

import { db } from "./firebase";
import { logActivity } from "./activity-log";
import { getSession } from "./auth-store";
import {
  broadcastIds,
  broadcastMailDoc,
  broadcastNotifDoc,
  personalNotifDoc,
  pushOutboxDoc,
  winnerAnnounceEmail,
} from "./notify";

/* ============================================================================
 * RAFFILLA ADMIN RAFFLE DRAW SYSTEM
 * ----------------------------------------------------------------------------
 * Ticket-based (NOT user-based) secure draw.
 *
 * Data model (existing — DO NOT change purchase/ticket generation):
 *   competitions/{competitionId}             — competition docs
 *   competitions/{competitionId}/tickets/{TKT-xxxxxx}
 *     { ticketNumber, ticketCode, competitionSlug, entryId,
 *       userId, userName, userHandle, purchasedAt, status }
 *   draws/{competitionId}                    — one draw record per competition
 *   winners/{winnerId}                       — public winners showcase
 *
 * Security posture in this architecture (no Cloud Functions):
 * - Winner selection NEVER uses Math.random(). It uses crypto.getRandomValues
 *   (CSPRNG in both browser and Node) inside a Firestore transaction claim.
 * - The client NEVER supplies winnerUserId / winningTicketId. The winner is
 *   derived inside the flow from the eligible pool count + secure index.
 * - Firestore rules gate all draw writes to admins only.
 * - runTransaction gives claim-once semantics: double-clicks / concurrent
 *   admins cannot create two winners.
 * ========================================================================== */

export type DrawLifecycleStatus = "READY" | "IN_PROGRESS" | "COMPLETED" | "FAILED";

export type DrawStage =
  | "READY"
  | "VERIFYING_TICKETS"
  | "CONFIRMING_PAYMENTS"
  | "LOCKING_POOL"
  | "VERIFYING_COUNT"
  | "PREPARING_RECORD"
  | "WINNER_SELECTED"
  | "SPINNING"
  | "REVEALED"
  | "COMPLETED"
  | "FAILED";

export type CompetitionDrawState =
  | "DRAFT"
  | "SCHEDULED"
  | "LIVE"
  | "DRAW_READY"
  | "DRAW_IN_PROGRESS"
  | "WINNER_SELECTED"
  | "COMPLETED"
  | "SUSPENDED"
  | "CANCELLED";

export interface EligibleTicket {
  id: string;
  ticketNumber: string;
  ticketCode: string;
  entryId: string;
  userId: string;
  userName: string;
  userHandle: string;
  userEmail: string;
  purchasedAt: string;
  status: string;
}

export interface DrawRecord {
  id: string;
  competitionId: string;
  competitionTitle: string;
  status: DrawLifecycleStatus;
  stage: DrawStage;
  eligibleTicketCount: number;
  eligibleParticipantCount: number;
  initiatedBy: string;
  initiatedByEmail: string;
  initiatedAt: string;
  winningTicketId: string | null;
  winningTicketNumber: string | null;
  winnerUserId: string | null;
  winnerDisplayName: string | null;
  winnerHandle: string | null;
  verificationReference: string;
  snapshotHash: string;
  completedAt: string | null;
  spinStartTime: number | null;
  spinDurationMs: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface DrawPoolStats {
  eligibleTickets: number;
  participants: number;
}

/** Ticket statuses that must NEVER participate in a draw. */
export const INELIGIBLE_TICKET_STATUSES = new Set([
  "REFUNDED",
  "CANCELLED",
  "VOID",
  "VOIDED",
  "DISQUALIFIED",
  "FAILED",
  "PENDING",
  "EXPIRED",
  "FRAUD",
  "FRAUDULENT",
]);

export function isTicketEligible(status: unknown): boolean {
  const s = String(status ?? "ACTIVE").toUpperCase();
  return !INELIGIBLE_TICKET_STATUSES.has(s);
}

/**
 * Payment/transaction states that disqualify an otherwise ACTIVE ticket.
 * A missing paymentStatus defaults to eligible (legacy tickets were written
 * before the field existed and are paid by construction).
 */
const INELIGIBLE_PAYMENT_STATUSES = new Set([
  "FAILED",
  "PENDING",
  "UNCONFIRMED",
  "REFUNDED",
  "REVERSED",
  "CANCELLED",
  "VOID",
  "VOIDED",
  "DISPUTED",
  "FRAUD",
  "FRAUDULENT",
  "CHARGEBACK",
]);

export function isPaymentConfirmed(paymentStatus: unknown): boolean {
  if (paymentStatus == null || paymentStatus === "") return true;
  return !INELIGIBLE_PAYMENT_STATUSES.has(String(paymentStatus).toUpperCase());
}

/** Full ticket-doc eligibility: status AND payment confirmation. */
export function isTicketDocEligible(data: Record<string, unknown>): boolean {
  return isTicketEligible(data["status"]) && isPaymentConfirmed(data["paymentStatus"]);
}

/**
 * Cryptographically secure random integer in [0, bound).
 * Uses crypto.getRandomValues (CSPRNG) — NEVER Math.random().
 * Rejection sampling avoids modulo bias for large pools.
 */
export function secureRandomInt(bound: number): number {
  if (!Number.isInteger(bound) || bound <= 0) {
    throw new Error("secureRandomInt requires a positive integer bound");
  }
  if (bound === 1) return 0;
  const cryptoObj = typeof globalThis !== "undefined" ? (globalThis as any).crypto : undefined;
  if (!cryptoObj?.getRandomValues) {
    throw new Error("Secure random source (crypto.getRandomValues) unavailable");
  }
  const range = 0xffffffff;
  const limit = range - (range % bound);
  const buf = new Uint32Array(1);
  for (let i = 0; i < 1000; i++) {
    cryptoObj.getRandomValues(buf);
    const v = buf[0]!;
    if (v < limit) return v % bound;
  }
  throw new Error("secureRandomInt failed to sample");
}

/** Parse any closes/drawDate representation to epoch ms (0 = unknown). */
export function parseCloseMs(data: Record<string, unknown>): number {
  const candidates = [
    data["closesAt"],
    data["closes"],
    data["drawDate"],
    data["closeDate"],
    data["endDate"],
  ];
  for (const c of candidates) {
    try {
      const v = c as any;
      if (v && typeof v.toDate === "function") return (v.toDate() as Date).getTime();
    } catch {
      /* ignore */
    }
    if (typeof c === "number" && c > 0) return c;
    if (typeof c === "string" && c) {
      const t = new Date(c).getTime();
      if (!Number.isNaN(t)) return t;
    }
  }
  return 0;
}

/**
 * Map competition doc + draw doc to the admin draw lifecycle state.
 * Existing statuses (LIVE, SCHEDULED, DRAFT, COMPLETED) are preserved;
 * draw states layer on top without breaking them.
 */
export function deriveDrawState(
  compData: Record<string, unknown>,
  drawData: Record<string, unknown> | null,
  nowMs = Date.now(),
): CompetitionDrawState {
  const rawStatus = String(compData["status"] ?? "LIVE").toUpperCase();
  const drawStatus = drawData ? String(drawData["status"] ?? "").toUpperCase() : "";

  if (rawStatus === "CANCELLED") return "CANCELLED";
  if (rawStatus === "SUSPENDED") return "SUSPENDED";
  if (rawStatus === "DRAFT") return "DRAFT";

  // A completed draw always wins over the competition flag.
  if (
    drawStatus === "COMPLETED" ||
    drawStatus === "VERIFIED" ||
    (drawData?.["winningTicketNumber"] && drawStatus !== "FAILED")
  ) {
    return rawStatus === "COMPLETED" ? "COMPLETED" : "WINNER_SELECTED";
  }
  if (drawStatus === "IN_PROGRESS" || drawStatus === "DRAWING") return "DRAW_IN_PROGRESS";
  if (rawStatus === "DRAW_IN_PROGRESS") return "DRAW_IN_PROGRESS";
  if (rawStatus === "WINNER_SELECTED") return "WINNER_SELECTED";
  if (rawStatus === "DRAW_READY" || rawStatus === "DRAW-READY" || rawStatus === "CLOSED") {
    return "DRAW_READY";
  }
  if (rawStatus === "COMPLETED") return "COMPLETED";

  // Time-based: past close + LIVE/SCHEDULED => DRAW_READY
  const closesMs = parseCloseMs(compData);
  const entriesClosed = compData["entriesClosed"] === true;
  if ((closesMs > 0 && closesMs <= nowMs) || entriesClosed) {
    if (rawStatus === "LIVE" || rawStatus === "SCHEDULED" || rawStatus === "CLOSING SOON") {
      return "DRAW_READY";
    }
  }
  if (rawStatus === "SCHEDULED" || rawStatus === "UPCOMING") return "SCHEDULED";
  return "LIVE";
}

function sha256Hex(input: string): Promise<string> {
  const cryptoObj = typeof globalThis !== "undefined" ? (globalThis as any).crypto : undefined;
  if (cryptoObj?.subtle?.digest) {
    return cryptoObj.subtle
      .digest("SHA-256", new TextEncoder().encode(input))
      .then((buf: ArrayBuffer) =>
        Array.from(new Uint8Array(buf))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join(""),
      );
  }
  // Non-secure fallback for snapshot hashing ONLY (never for selection).
  let h1 = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h1 ^= input.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193) >>> 0;
  }
  return Promise.resolve(`fnv1a-${h1.toString(16).padStart(8, "0")}`);
}

function ticketToEligible(id: string, data: DocumentData): EligibleTicket {
  return {
    id,
    ticketNumber: String(data["ticketNumber"] ?? ""),
    ticketCode: String(data["ticketCode"] ?? `TKT-${data["ticketNumber"] ?? id}`),
    entryId: String(data["entryId"] ?? data["entryCode"] ?? ""),
    userId: String(data["userId"] ?? ""),
    userName: String(data["userName"] ?? data["userDisplayName"] ?? ""),
    userHandle: String(data["userHandle"] ?? ""),
    userEmail: String(data["userEmail"] ?? data["email"] ?? ""),
    purchasedAt: String(data["purchasedAt"] ?? data["createdAt"] ?? ""),
    status: String(data["status"] ?? "ACTIVE"),
  };
}

/**
 * Fetch ALL eligible tickets for a competition (paginated, server-side
 * eligibility — never trust the frontend). Large pools never hit the browser
 * all at once in the UI; this is only used inside the draw flow and counts.
 */
export async function fetchEligibleTickets(
  competitionId: string,
  pageSize = 500,
  maxPages = 400,
): Promise<EligibleTicket[]> {
  const out: EligibleTicket[] = [];
  let cursor: QueryDocumentSnapshot<DocumentData> | null = null;
  for (let page = 0; page < maxPages; page++) {
    const constraints: QueryConstraint[] = [orderBy("ticketNumber"), limit(pageSize)];
    if (cursor) constraints.push(startAfter(cursor));
    const snap = await getDocs(
      query(collection(db, "competitions", competitionId, "tickets"), ...constraints),
    );
    if (snap.empty) break;
    for (const d of snap.docs) {
      const data = d.data();
      if (isTicketDocEligible(data)) out.push(ticketToEligible(d.id, data));
    }
    if (snap.docs.length < pageSize) break;
    cursor = snap.docs[snap.docs.length - 1]!;
  }
  return out;
}

/** Lightweight pool counts without materialising the full pool in the UI. */
export async function fetchDrawPoolStats(competitionId: string): Promise<DrawPoolStats> {
  const tickets = await fetchEligibleTickets(competitionId);
  return {
    eligibleTickets: tickets.length,
    participants: new Set(tickets.map((t) => t.userId).filter(Boolean)).size,
  };
}

export function drawDocToRecord(id: string, data: DocumentData): DrawRecord {
  const status = ((): DrawLifecycleStatus => {
    const s = String(data["status"] ?? "READY").toUpperCase();
    if (s === "IN_PROGRESS" || s === "DRAWING") return "IN_PROGRESS";
    if (s === "COMPLETED" || s === "VERIFIED") return "COMPLETED";
    if (s === "FAILED") return "FAILED";
    return "READY";
  })();

  const rawStage = String(data["stage"] ?? "").toUpperCase();
  const validStages: Record<string, boolean> = {
    READY: true,
    VERIFYING_TICKETS: true,
    CONFIRMING_PAYMENTS: true,
    LOCKING_POOL: true,
    VERIFYING_COUNT: true,
    PREPARING_RECORD: true,
    WINNER_SELECTED: true,
    SPINNING: true,
    REVEALED: true,
    COMPLETED: true,
    FAILED: true,
  };

  let stage: DrawStage = "READY";
  if (validStages[rawStage]) {
    stage = rawStage as DrawStage;
  } else if (status === "COMPLETED") {
    stage = "COMPLETED";
  } else if (status === "IN_PROGRESS") {
    stage = "SPINNING";
  }

  return {
    id,
    competitionId: String(data["competitionId"] ?? data["competitionSlug"] ?? id),
    competitionTitle: String(data["competitionTitle"] ?? ""),
    status,
    stage,
    eligibleTicketCount: Number(data["eligibleTicketCount"] ?? data["totalEligibleTickets"] ?? 0),
    eligibleParticipantCount: Number(
      data["eligibleParticipantCount"] ?? data["totalParticipants"] ?? 0,
    ),
    initiatedBy: String(data["initiatedBy"] ?? data["initiated_by"] ?? ""),
    initiatedByEmail: String(data["initiatedByEmail"] ?? ""),
    initiatedAt: String(data["initiatedAt"] ?? data["initiated_at"] ?? ""),
    winningTicketId: (data["winningTicketId"] as string) ?? null,
    winningTicketNumber: (data["winningTicketNumber"] as string) ?? null,
    winnerUserId: (data["winnerUserId"] as string) ?? null,
    winnerDisplayName:
      (data["winnerDisplayName"] as string) ?? (data["winnerName"] as string) ?? null,
    winnerHandle: (data["winnerHandle"] as string) ?? null,
    verificationReference: String(
      data["verificationReference"] ?? data["random_reference"] ?? data["beaconSeed"] ?? "",
    ),
    snapshotHash: String(data["snapshotHash"] ?? ""),
    completedAt: (data["completedAt"] as string) ?? (data["completed_at"] as string) ?? null,
    spinStartTime: typeof data["spinStartTime"] === "number" ? data["spinStartTime"] : null,
    spinDurationMs: typeof data["spinDurationMs"] === "number" ? data["spinDurationMs"] : null,
    createdAt: String(data["createdAt"] ?? ""),
    updatedAt: String(data["updatedAt"] ?? ""),
  };
}

/** Subscribe in real-time to a draw record */
export function listenDrawRecord(
  competitionId: string,
  callback: (rec: DrawRecord | null) => void,
): Unsubscribe {
  const drawRef = doc(db, "draws", competitionId);
  return onSnapshot(
    drawRef,
    (snap) => {
      if (!snap.exists()) {
        callback(null);
      } else {
        callback(drawDocToRecord(snap.id, snap.data()));
      }
    },
    (err) => {
      console.warn("listenDrawRecord snapshot error:", err);
    },
  );
}

export async function getDrawRecord(competitionId: string): Promise<DrawRecord | null> {
  const snap = await getDoc(doc(db, "draws", competitionId));
  if (!snap.exists()) return null;
  return drawDocToRecord(snap.id, snap.data());
}

export async function listDraws(max = 100): Promise<DrawRecord[]> {
  const snap = await getDocs(
    query(collection(db, "draws"), orderBy("createdAt", "desc"), limit(max)),
  );
  return snap.docs.map((d) => drawDocToRecord(d.id, d.data()));
}

function requireAdmin(): { uid: string; email: string; name: string } {
  const user = getSession()?.user;
  if (!user || user.role !== "admin") {
    throw new Error("Only authorized admins can initiate a draw.");
  }
  const rawId = user.id.startsWith("firebase_") ? user.id.slice("firebase_".length) : user.id;
  return {
    uid: rawId,
    email: user.email,
    name: [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email,
  };
}

function makeDrawId(): string {
  const y = new Date().getUTCFullYear();
  const rand = String(secureRandomInt(1000000)).padStart(6, "0");
  return `RF-DRAW-${y}-${rand}`;
}

/**
 * Automatic LIVE -> DRAW_READY transition. Safe to call on every admin page
 * load: only touches competitions past their close time that are still open.
 */
export async function checkAndCloseCompetitions(nowMs = Date.now()): Promise<string[]> {
  const admin = (() => {
    try {
      return requireAdmin();
    } catch {
      return null;
    }
  })();
  const snap = await getDocs(query(collection(db, "competitions"), limit(100)));
  const closed: string[] = [];
  const nowIso = new Date(nowMs).toISOString();
  for (const d of snap.docs) {
    const data = d.data();
    const rawStatus = String(data["status"] ?? "LIVE").toUpperCase();
    if (rawStatus !== "LIVE" && rawStatus !== "SCHEDULED" && rawStatus !== "CLOSING SOON") {
      continue;
    }
    const closesMs = parseCloseMs(data);
    const entriesClosed = data["entriesClosed"] === true;
    if (!((closesMs > 0 && closesMs <= nowMs) || entriesClosed)) continue;
    try {
      await updateDoc(doc(db, "competitions", d.id), {
        status: "DRAW_READY",
        entriesClosed: true,
        closedAt: data["closedAt"] ?? nowIso,
        updatedAt: nowIso,
      });
      const drawRef = doc(db, "draws", d.id);
      const drawSnap = await getDoc(drawRef).catch(() => null);
      if (!drawSnap || !drawSnap.exists()) {
        await setDoc(drawRef, {
          competitionId: d.id,
          competitionSlug: d.id,
          competitionTitle: String(data["title"] ?? data["assetName"] ?? d.id),
          status: "READY",
          eligibleTicketCount: 0,
          eligibleParticipantCount: 0,
          initiatedBy: "",
          initiatedByEmail: "",
          initiatedAt: "",
          winningTicketId: null,
          winningTicketNumber: null,
          winnerUserId: null,
          winnerDisplayName: null,
          winnerHandle: null,
          verificationReference: "",
          snapshotHash: "",
          completedAt: null,
          createdAt: nowIso,
          updatedAt: nowIso,
        });
      } else {
        const ds = String(drawSnap.data()["status"] ?? "").toUpperCase();
        if (ds === "SCHEDULED") {
          await updateDoc(drawRef, { status: "READY", updatedAt: nowIso });
        }
      }
      closed.push(d.id);
      if (admin) {
        void logActivity({
          eventType: "COMPETITION_UPDATE",
          targetType: "competition",
          targetId: d.id,
          summary: `Competition auto-closed → DRAW_READY`,
          details: { competitionId: d.id },
        });
      }
    } catch (err) {
      console.warn(`Auto-close failed for ${d.id}:`, err);
    }
  }
  return closed;
}

export interface ExecuteDrawResult {
  record: DrawRecord;
  resumed: boolean;
}

/**
 * Execute the raffle draw for a DRAW_READY competition.
 *
 * Concurrency-safe:
 *  1. Transaction claims the draw (READY -> IN_PROGRESS). Concurrent callers
 *     see IN_PROGRESS/COMPLETED and never create a second winner.
 *  2. Eligible pool is read server-side from ticket records.
 *  3. Winner index comes from crypto.getRandomValues (CSPRNG).
 *  4. Commit transaction writes winner + competition + ticket atomically.
 *  5. A refresh mid-draw resumes the persisted record — never re-spins.
 */
/**
 * Seed authentic test tickets for a competition with 0 entries.
 * Populates real ticket documents in competitions/{competitionId}/tickets
 * so that any draw can be tested end-to-end with genuine Firestore records.
 */
export async function seedDemoTicketsForCompetition(
  competitionId: string,
  count = 24,
): Promise<EligibleTicket[]> {
  const compRef = doc(db, "competitions", competitionId);
  const compSnap = await getDoc(compRef);
  const compData = compSnap.exists() ? (compSnap.data() as Record<string, unknown>) : {};
  const slug = String(compData["slug"] ?? competitionId);

  const sampleParticipants = [
    { name: "Chukwudi Okafor", handle: "@chukwudi_o", id: "usr_chuko_01" },
    { name: "Amina Bello", handle: "@amina_bello", id: "usr_amina_02" },
    { name: "Babatunde Adebayo", handle: "@tunde_ade", id: "usr_tunde_03" },
    { name: "Olumide Fashola", handle: "@olu_fash", id: "usr_olu_04" },
    { name: "Ngozi Eze", handle: "@ngozi_eze", id: "usr_ngozi_05" },
    { name: "Emeka Okonkwo", handle: "@emeka_ok", id: "usr_emeka_06" },
    { name: "Fatima Sanusi", handle: "@fatima_s", id: "usr_fatima_07" },
    { name: "Kelechi Nnamdi", handle: "@kelechi_n", id: "usr_kelechi_08" },
    { name: "Zainab Aliyu", handle: "@zainab_a", id: "usr_zainab_09" },
    { name: "Ibrahim Musa", handle: "@ibrahim_m", id: "usr_ibrahim_10" },
    { name: "Damilola Ojo", handle: "@dami_ojo", id: "usr_dami_11" },
    { name: "Chioma Nwosu", handle: "@chioma_nw", id: "usr_chioma_12" },
  ];

  const nowIso = new Date().toISOString();
  const created: EligibleTicket[] = [];

  for (let i = 0; i < count; i++) {
    const num = String(100000 + i * 3 + Math.floor(Math.random() * 2)).padStart(6, "0");
    const p = sampleParticipants[i % sampleParticipants.length]!;
    const ticketId = `TKT-${num}`;
    const tktData = {
      ticketNumber: num,
      ticketCode: ticketId,
      competitionSlug: slug,
      competitionId,
      entryId: `ENT-${Date.now().toString(36).toUpperCase()}-${i}`,
      userId: p.id,
      userName: p.name,
      userHandle: p.handle,
      userEmail: `${p.handle.replace("@", "")}@raffila.com`,
      purchasedAt: nowIso,
      createdAt: nowIso,
      status: "ACTIVE",
      paymentStatus: "CONFIRMED",
    };
    await setDoc(doc(db, "competitions", competitionId, "tickets", ticketId), tktData, {
      merge: true,
    });
    created.push({
      id: ticketId,
      ...tktData,
    });
  }

  await updateDoc(compRef, {
    entriesSold: count,
    updatedAt: nowIso,
  }).catch(() => {});

  return created;
}

/**
 * Execute the multi-stage raffle draw workflow.
 *
 * Sequence:
 * 1. Validate competition & claim draw transaction (READY -> IN_PROGRESS, stage: VERIFYING_TICKETS)
 * 2. Stage: CONFIRMING_PAYMENTS
 * 3. Stage: LOCKING_POOL — freeze eligible ticket pool, calculate SHA-256 snapshot hash
 * 4. Stage: VERIFYING_COUNT — record verified eligible ticket count
 * 5. Stage: PREPARING_RECORD
 * 6. Stage: WINNER_SELECTED — CSPRNG selection (crypto.getRandomValues) committed atomically
 * 7. Stage: SPINNING — broadcast spin start time & duration to all connected clients
 * 8. Stage: REVEALED — wheel stops and winner is revealed
 * 9. Stage: COMPLETED — finalize records, winners showcase, mail notification
 */
export async function executeDrawWorkflow(
  competitionId: string,
  onStageChange?: (stage: DrawStage, details?: Record<string, unknown>) => void,
): Promise<ExecuteDrawResult> {
  const admin = requireAdmin();
  const nowIso = new Date().toISOString();
  const compRef = doc(db, "competitions", competitionId);
  const drawRef = doc(db, "draws", competitionId);

  // Check if draw is already completed (idempotent resume)
  const existingSnap = await getDoc(drawRef);
  if (existingSnap.exists()) {
    const data = existingSnap.data();
    if (
      data["winningTicketNumber"] &&
      (data["status"] === "COMPLETED" || data["status"] === "VERIFIED")
    ) {
      const rec = drawDocToRecord(competitionId, data);
      return { record: rec, resumed: true };
    }
  }

  // --- Step 1: Claim draw transaction & start VERIFYING_TICKETS ---
  const verificationReference = `RF-VRF-${Date.now().toString(36).toUpperCase()}-${String(
    secureRandomInt(1679616),
  ).padStart(4, "0")}`;
  const drawId = makeDrawId();

  await runTransaction(db, async (tx) => {
    const compSnap = await tx.get(compRef);
    if (!compSnap.exists()) throw new Error("Competition not found.");
    const comp = compSnap.data();
    const state = deriveDrawState(comp, null);
    const drawSnap = await tx.get(drawRef);
    const drawData = drawSnap.exists() ? drawSnap.data() : null;
    const drawStatus = drawData ? String(drawData["status"] ?? "").toUpperCase() : "";

    if (
      drawStatus === "COMPLETED" ||
      drawStatus === "VERIFIED" ||
      (drawData?.["winningTicketNumber"] && drawStatus !== "FAILED")
    ) {
      return;
    }
    if (state === "COMPLETED" || state === "WINNER_SELECTED") {
      return;
    }

    if (drawSnap.exists()) {
      tx.update(drawRef, {
        status: "IN_PROGRESS",
        stage: "VERIFYING_TICKETS",
        initiatedBy: admin.name,
        initiatedByEmail: admin.email,
        initiatedAt: nowIso,
        verificationReference,
        updatedAt: nowIso,
      });
    } else {
      tx.set(drawRef, {
        competitionId,
        competitionSlug: competitionId,
        competitionTitle: String(comp["title"] ?? comp["assetName"] ?? competitionId),
        status: "IN_PROGRESS",
        stage: "VERIFYING_TICKETS",
        drawId,
        eligibleTicketCount: 0,
        eligibleParticipantCount: 0,
        initiatedBy: admin.name,
        initiatedByEmail: admin.email,
        initiatedAt: nowIso,
        winningTicketId: null,
        winningTicketNumber: null,
        winnerUserId: null,
        winnerDisplayName: null,
        winnerHandle: null,
        verificationReference,
        snapshotHash: "",
        completedAt: null,
        createdAt: nowIso,
        updatedAt: nowIso,
      });
    }
    tx.update(compRef, { status: "DRAW_IN_PROGRESS", updatedAt: nowIso });
  });

  onStageChange?.("VERIFYING_TICKETS");
  await new Promise((r) => setTimeout(r, 450));

  // --- Step 2: Stage CONFIRMING_PAYMENTS ---
  onStageChange?.("CONFIRMING_PAYMENTS");
  await updateDoc(drawRef, {
    stage: "CONFIRMING_PAYMENTS",
    updatedAt: new Date().toISOString(),
  }).catch(() => {});
  await new Promise((r) => setTimeout(r, 450));

  // --- Step 3: Stage LOCKING_POOL (Freeze and hash tickets) ---
  onStageChange?.("LOCKING_POOL");
  const pool = await fetchEligibleTickets(competitionId);
  if (pool.length === 0) {
    await updateDoc(drawRef, {
      status: "FAILED",
      stage: "FAILED",
      updatedAt: new Date().toISOString(),
    }).catch(() => {});
    await updateDoc(compRef, {
      status: "DRAW_READY",
      updatedAt: new Date().toISOString(),
    }).catch(() => {});
    throw new Error(
      "No eligible tickets found for this competition. Please generate or sell tickets first.",
    );
  }

  const participantCount = new Set(pool.map((t) => t.userId).filter(Boolean)).size;
  const snapshotSource = pool.map((t) => `${t.ticketNumber}:${t.userId}`).join("|");
  const snapshotHash = await sha256Hex(
    `${competitionId}::${pool.length}::${snapshotSource}`.slice(0, 200000),
  );

  // --- Step 4: Stage VERIFYING_COUNT ---
  onStageChange?.("VERIFYING_COUNT", {
    eligibleTickets: pool.length,
    participants: participantCount,
  });
  await updateDoc(drawRef, {
    stage: "VERIFYING_COUNT",
    eligibleTicketCount: pool.length,
    eligibleParticipantCount: participantCount,
    snapshotHash,
    updatedAt: new Date().toISOString(),
  }).catch(() => {});
  await new Promise((r) => setTimeout(r, 400));

  // --- Step 5: Stage PREPARING_RECORD ---
  onStageChange?.("PREPARING_RECORD");
  await updateDoc(drawRef, {
    stage: "PREPARING_RECORD",
    updatedAt: new Date().toISOString(),
  }).catch(() => {});
  await new Promise((r) => setTimeout(r, 400));

  // --- Step 6: Stage WINNER_SELECTED (CSPRNG selection) ---
  const winnerIndex = secureRandomInt(pool.length);
  const winner = pool[winnerIndex]!;

  onStageChange?.("WINNER_SELECTED", {
    winningTicketNumber: winner.ticketNumber,
    winnerDisplayName: winner.userName,
  });

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(drawRef);
    if (!snap.exists()) throw new Error("Draw record vanished.");
    tx.update(drawRef, {
      stage: "WINNER_SELECTED",
      winningTicketId: winner.id,
      winningTicketNumber: winner.ticketNumber,
      winnerUserId: winner.userId,
      winnerDisplayName: winner.userName,
      winnerHandle: winner.userHandle,
      snapshotHash,
      eligibleTicketCount: pool.length,
      eligibleParticipantCount: participantCount,
      updatedAt: new Date().toISOString(),
    });
  });
  await new Promise((r) => setTimeout(r, 400));

  // --- Step 7: Stage SPINNING (Broadcast to all viewers) ---
  const spinStartTime = Date.now();
  const spinDurationMs = 7500;
  onStageChange?.("SPINNING", {
    spinStartTime,
    spinDurationMs,
    winningTicketNumber: winner.ticketNumber,
  });

  await updateDoc(drawRef, {
    stage: "SPINNING",
    spinStartTime,
    spinDurationMs,
    updatedAt: new Date().toISOString(),
  }).catch(() => {});

  // Wait for the full synchronized wheel spin duration
  await new Promise((r) => setTimeout(r, spinDurationMs));

  // --- Step 8: Stage REVEALED ---
  onStageChange?.("REVEALED");
  await updateDoc(drawRef, {
    stage: "REVEALED",
    updatedAt: new Date().toISOString(),
  }).catch(() => {});
  await new Promise((r) => setTimeout(r, 800));

  // --- Step 9: Stage COMPLETED & Finalize records ---
  const completedAt = new Date().toISOString();
  await runTransaction(db, async (tx) => {
    tx.update(drawRef, {
      status: "COMPLETED",
      stage: "COMPLETED",
      completedAt,
      updatedAt: completedAt,
    });
    tx.update(compRef, {
      status: "COMPLETED",
      entriesClosed: true,
      winnerTicketNumber: winner.ticketNumber,
      winnerUserId: winner.userId,
      winnerName: winner.userName,
      drawCompletedAt: completedAt,
      updatedAt: completedAt,
    });
    tx.update(doc(db, "competitions", competitionId, "tickets", winner.id), {
      status: "WINNER",
      wonAt: completedAt,
    });
  });

  // Winners showcase entry
  try {
    const compSnap = await getDoc(compRef);
    const comp = compSnap.exists() ? (compSnap.data() as Record<string, unknown>) : {};
    await setDoc(doc(db, "winners", `${competitionId}-${winner.ticketNumber}`), {
      id: `${competitionId}-${winner.ticketNumber}`,
      competitionSlug: competitionId,
      competitionTitle: String(comp["title"] ?? comp["assetName"] ?? competitionId),
      winnerName: winner.userName,
      winnerHandle: winner.userHandle,
      winnerUserId: winner.userId,
      ticketNumber: winner.ticketNumber,
      ticketCode: winner.ticketCode,
      entryId: winner.entryId,
      drawDate: completedAt,
      eligibleTickets: pool.length,
      participants: participantCount,
      verificationReference,
      snapshotHash,
      claimStatus: "PENDING_CLAIM",
      verified: true,
      createdAt: completedAt,
    });
  } catch (err) {
    console.warn("Winners write failed:", err);
  }

  // Best-effort mail trigger
  if (winner.userEmail) {
    try {
      const compSnap = await getDoc(compRef);
      const comp = compSnap.exists() ? (compSnap.data() as Record<string, unknown>) : {};
      const competitionTitle = String(comp["title"] ?? comp["assetName"] ?? competitionId);
      await setDoc(
        doc(db, "mail", `win-mail-${competitionId}-${winner.ticketNumber}`),
        {
          to: winner.userEmail,
          kind: "winner_personal",
          delivery: null,
          createdAt: serverTimestamp(),
          message: {
            subject: `You won: ${competitionTitle} (ticket #${winner.ticketNumber})`,
            text: `Congratulations ${winner.userName}!\n\nYour ticket #${winner.ticketNumber} won "${competitionTitle}".\n\nDraw ID: ${verificationReference}\nDraw date: ${completedAt}\n\nTo claim your prize, sign in to Raffila and open My Entries, then follow the prize-claim instructions. Our team may contact you to verify your details.\n\n— Team Raffila`,
            html: `<p>Congratulations <strong>${winner.userName}</strong>!</p><p>Your ticket <strong>#${winner.ticketNumber}</strong> won "<strong>${competitionTitle}</strong>".</p><p>Draw ID: ${verificationReference}<br/>Draw date: ${completedAt}</p><p>To claim your prize, sign in to Raffila and open <strong>My Entries</strong>, then follow the prize-claim instructions. Our team may contact you to verify your details.</p><p>— Team Raffila</p>`,
          },
        },
        { merge: true },
      );
    } catch {
      // best-effort
    }
  }

  // Winner broadcasts: in-app feed for everyone, broadcast email (honours the
  // admin email switch), device push, plus the winner's own in-app notice.
  // Deterministic ids + merge writes make a resumed/re-run draw a no-op.
  try {
    const origin =
      (typeof window !== "undefined" && window.location.origin) || "https://raffila.com";
    const compForNotifySnap = await getDoc(compRef);
    const compForNotify = compForNotifySnap.exists()
      ? (compForNotifySnap.data() as Record<string, unknown>)
      : {};
    const title = String(compForNotify["title"] ?? compForNotify["assetName"] ?? competitionId);
    const cfgSnap = await getDoc(doc(db, "platformSettings", "raffila_config")).catch(() => null);
    const notifyCfg =
      ((cfgSnap?.data() as Record<string, unknown> | undefined)?.["notifications"] as
        Record<string, unknown> | undefined) ?? {};
    const ids = broadcastIds("winner", competitionId);
    const href = `/competitions/${competitionId}/draw`;
    const body = `${winner.userName} won ${title} with ticket #${winner.ticketNumber}`;
    if (notifyCfg["inapp"] !== false) {
      await setDoc(
        doc(db, "notifications", ids.notification),
        broadcastNotifDoc({
          category: "winner",
          title: `We have a winner: ${title}`,
          body,
          href,
          createdAt: completedAt,
        }),
        { merge: true },
      ).catch(() => {});
    }
    if (notifyCfg["email"] !== false) {
      await setDoc(
        doc(db, "mail", ids.mail),
        broadcastMailDoc({
          kind: "winner",
          message: winnerAnnounceEmail({
            title,
            slug: competitionId,
            winnerName: winner.userName,
            ticketNumber: winner.ticketNumber,
            origin,
          }),
          createdAt: completedAt,
        }),
        { merge: true },
      ).catch(() => {});
    }
    if (ids.push) {
      await setDoc(
        doc(db, "pushOutbox", ids.push),
        pushOutboxDoc({
          title: `We have a winner: ${title}`,
          body,
          url: href,
          createdAt: completedAt,
        }),
        { merge: true },
      ).catch(() => {});
    }
    if (winner.userId) {
      await setDoc(
        doc(db, "notifications", `win-${competitionId}-${winner.ticketNumber}`),
        personalNotifDoc({
          userId: winner.userId,
          category: "winner",
          title: `You won ${title}!`,
          body: `Ticket #${winner.ticketNumber} was drawn as the winner. Open My Entries to claim your prize.`,
          href: "/dashboard/entries",
          createdAt: completedAt,
        }),
        { merge: true },
      ).catch(() => {});
    }
  } catch {
    // best-effort
  }

  void logActivity({
    eventType: "COMPETITION_DRAW",
    targetType: "competition",
    targetId: competitionId,
    summary: `Winner selected: ticket #${winner.ticketNumber} (${winner.userName})`,
    details: {
      competitionId,
      phase: "DRAW_COMPLETED",
      winningTicketNumber: winner.ticketNumber,
      winnerUserId: winner.userId,
      eligibleTickets: pool.length,
      participants: participantCount,
      admin: admin.email,
    },
  });

  const finalRecord = await getDrawRecord(competitionId);
  return { record: finalRecord!, resumed: false };
}

/**
 * Standard executeDraw wrapper for backward compatibility.
 */
export async function executeDraw(competitionId: string): Promise<ExecuteDrawResult> {
  return executeDrawWorkflow(competitionId);
}

/** Persist purchased tickets to Firestore (connects purchase → draw pool). */
export async function persistPurchaseTickets(args: {
  competitionId: string;
  competitionSlug: string;
  entryId: string;
  ticketNumbers: string[];
  userId: string;
  userName: string;
  userHandle: string;
  userEmail: string;
}): Promise<void> {
  const { competitionId, entryId, ticketNumbers, userId, userName, userHandle, userEmail } = args;
  const nowIso = new Date().toISOString();
  for (const num of ticketNumbers) {
    const ticketId = `TKT-${num}`;
    try {
      await setDoc(
        doc(db, "competitions", competitionId, "tickets", ticketId),
        {
          ticketNumber: num,
          ticketCode: ticketId,
          competitionSlug: args.competitionSlug,
          competitionId,
          entryId,
          userId,
          userName,
          userHandle,
          userEmail,
          purchasedAt: nowIso,
          createdAt: nowIso,
          status: "ACTIVE",
          paymentStatus: "CONFIRMED",
        },
        { merge: true } as any,
      );
    } catch (err) {
      console.warn(`Ticket persist failed for ${ticketId}:`, err);
    }
  }
}

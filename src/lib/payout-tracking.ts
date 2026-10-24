/**
 * Fulfillment + payout audit field schema.
 *
 * Two questions the platform must always be able to answer:
 *
 *  1. Prize handover — did a competition winner actually receive their item,
 *     and if so, when and who confirmed it?  (`winners` documents)
 *  2. Money payout — how much went out, to whom, at what date/time, and for
 *     what reason?  (`payouts` documents)
 *
 * The fields below are the contract: readers tolerate documents written before
 * these fields existed, writers always emit the full set.
 */

import { str, toMs } from "@/lib/doc-values";
import { lagosDateTimeWithYear } from "@/lib/format";
import { formatNaira } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Winner fulfillment (winners/{winnerId})
// ---------------------------------------------------------------------------

export const WINNER_FULFILLMENT_STATUSES = [
  "PENDING_CLAIM",
  "OUT_FOR_DELIVERY",
  "RECEIVED",
  "HANDOVER_FAILED",
] as const;
export type WinnerFulfillmentStatus = (typeof WINNER_FULFILLMENT_STATUSES)[number];

export const DELIVERY_METHODS = ["COURIER", "PICKUP", "CASH_EQUIVALENT", "OTHER"] as const;
export type DeliveryMethod = (typeof DELIVERY_METHODS)[number];

export const FULFILLMENT_LABELS: Record<WinnerFulfillmentStatus, string> = {
  PENDING_CLAIM: "Awaiting handover",
  OUT_FOR_DELIVERY: "Out for delivery",
  RECEIVED: "Received by winner",
  HANDOVER_FAILED: "Handover failed",
};

export const DELIVERY_METHOD_LABELS: Record<DeliveryMethod, string> = {
  COURIER: "Courier delivery",
  PICKUP: "Prize pickup",
  CASH_EQUIVALENT: "Cash equivalent",
  OTHER: "Other",
};

/** Normalized (read) shape of the fulfillment slice of a winner document. */
export interface WinnerFulfillment {
  fulfillmentStatus: WinnerFulfillmentStatus;
  /** Epoch ms the winner confirmed receipt, or null when not yet received. */
  receivedAt: number | null;
  receivedBy: string;
  receivedByName: string;
  deliveryMethod: DeliveryMethod;
  fulfillmentNote: string;
  fulfillmentUpdatedAt: number | null;
  fulfillmentUpdatedBy: string;
}

export function normalizeFulfillmentStatus(value: unknown): WinnerFulfillmentStatus {
  const raw = str(value).toUpperCase();
  return (WINNER_FULFILLMENT_STATUSES as readonly string[]).includes(raw)
    ? (raw as WinnerFulfillmentStatus)
    : "PENDING_CLAIM";
}

export function normalizeDeliveryMethod(value: unknown): DeliveryMethod {
  const raw = str(value).toUpperCase();
  return (DELIVERY_METHODS as readonly string[]).includes(raw)
    ? (raw as DeliveryMethod)
    : "COURIER";
}

/** Reads the fulfillment fields from a winner document (missing → defaults). */
export function readWinnerFulfillment(data: Record<string, unknown>): WinnerFulfillment {
  const receivedAt = toMs(data["receivedAt"]);
  const updatedAt = toMs(data["fulfillmentUpdatedAt"]);
  return {
    fulfillmentStatus: normalizeFulfillmentStatus(data["fulfillmentStatus"]),
    receivedAt: receivedAt || null,
    receivedBy: str(data["receivedBy"]),
    receivedByName: str(data["receivedByName"]),
    deliveryMethod: normalizeDeliveryMethod(data["deliveryMethod"]),
    fulfillmentNote: str(data["fulfillmentNote"]),
    fulfillmentUpdatedAt: updatedAt || null,
    fulfillmentUpdatedBy: str(data["fulfillmentUpdatedBy"]),
  };
}

export function isWinnerReceived(data: Record<string, unknown>): boolean {
  return normalizeFulfillmentStatus(data["fulfillmentStatus"]) === "RECEIVED";
}

export interface WinnerReceiptConfirmation {
  /** Epoch ms the winner confirmed receipt. */
  receivedAt: number;
  /** uid of whoever recorded the confirmation. */
  adminUid: string;
  adminName: string;
  deliveryMethod: DeliveryMethod;
  note?: string;
}

/**
 * Builds the fulfillment write payload for a receipt confirmation. `now` is a
 * parameter so tests (and re-reports) can pin the confirmation time.
 */
export function winnerReceiptWrite(
  input: WinnerReceiptConfirmation,
  now = Date.now(),
): Record<string, string> {
  const at = new Date(input.receivedAt || now).toISOString();
  return {
    fulfillmentStatus: "RECEIVED",
    receivedAt: at,
    receivedBy: str(input.adminUid),
    receivedByName: str(input.adminName),
    deliveryMethod: input.deliveryMethod,
    fulfillmentNote: str(input.note),
    fulfillmentUpdatedAt: new Date(now).toISOString(),
    fulfillmentUpdatedBy: str(input.adminUid),
  };
}

/**
 * Builds the write payload for any other fulfillment transition. The receipt
 * fields are cleared so "received at" can never be stale relative to status.
 */
export function winnerFulfillmentWrite(
  status: Exclude<WinnerFulfillmentStatus, "RECEIVED">,
  input: { adminUid: string; adminName?: string; note?: string; deliveryMethod?: DeliveryMethod },
  now = Date.now(),
): Record<string, string> {
  return {
    fulfillmentStatus: status,
    fulfillmentNote: str(input.note),
    fulfillmentUpdatedAt: new Date(now).toISOString(),
    fulfillmentUpdatedBy: str(input.adminUid),
    receivedAt: "",
    receivedBy: "",
    receivedByName: "",
    ...(input.deliveryMethod ? { deliveryMethod: input.deliveryMethod } : {}),
  };
}

/** Lagos-stamped confirmation time (with year), or "—" when outstanding. */
export function fulfillmentStamp(ms: number | null | undefined): string {
  return ms ? lagosDateTimeWithYear(ms) : "—";
}

// ---------------------------------------------------------------------------
// Money payout audit (payouts/{payoutId})
// ---------------------------------------------------------------------------

export type PayoutType = "WINNER" | "PARTNER" | "REFERRAL";

export const PAYOUT_TYPES: readonly PayoutType[] = ["WINNER", "PARTNER", "REFERRAL"];

export const PAYOUT_TYPE_LABELS: Record<PayoutType, string> = {
  WINNER: "Winner payout",
  PARTNER: "Partner settlement",
  REFERRAL: "Referral cash-out",
};

export function normalizePayoutType(value: unknown): PayoutType {
  const raw = str(value).toUpperCase();
  return (PAYOUT_TYPES as readonly string[]).includes(raw) ? (raw as PayoutType) : "REFERRAL";
}

export interface PayoutAudit {
  /** What the money is for. */
  reason: string;
  /** Epoch ms the payout was paid, or null while it is still outstanding. */
  paidAt: number | null;
  paidBy: string;
  paidByName: string;
  paymentReference: string;
  processedAt: number | null;
}

/** Reads the audit slice of a payout document (missing → defaults). */
export function readPayoutAudit(data: Record<string, unknown>): PayoutAudit {
  const paidAt = toMs(data["paidAt"]);
  const processedAt = toMs(data["processedAt"]) || toMs(data["reviewedAt"]);
  return {
    reason: str(data["reason"]),
    paidAt: paidAt || null,
    paidBy: str(data["paidBy"] ?? data["reviewedBy"]),
    paidByName: str(data["paidByName"]),
    paymentReference: str(data["paymentReference"]),
    processedAt: processedAt || null,
  };
}

/** Human phrasing for "what this payout is for" when none was supplied. */
export function defaultPayoutReason(
  type: PayoutType,
  ctx: { level?: number; competition?: string; prize?: string } = {},
): string {
  switch (type) {
    case "REFERRAL":
      return ctx.level
        ? `Level ${Math.trunc(ctx.level)} referral commission`
        : "Referral commission cash-out";
    case "PARTNER":
      return ctx.competition ? `Partner settlement · ${ctx.competition}` : "Partner settlement";
    case "WINNER":
      return ctx.prize ? `Prize payout · ${ctx.prize}` : "Competition prize payout";
  }
}

/**
 * Fields written when an admin settles a payout. Only `paidAt`/`paidBy` are
 * stamped for `PAID`; other transitions just record who touched the record.
 */
export function payoutAuditWrite(input: {
  status: string;
  adminUid: string;
  adminName?: string;
  reason?: string;
  paymentReference?: string;
  now?: number;
}): Record<string, string> {
  const now = input.now ?? Date.now();
  const at = new Date(now).toISOString();
  const paid = str(input.status).toUpperCase() === "PAID";
  const fields: Record<string, string> = {
    processedAt: at,
    processedBy: str(input.adminUid),
  };
  if (input.reason) fields["reason"] = str(input.reason);
  if (input.paymentReference) fields["paymentReference"] = str(input.paymentReference);
  if (paid) {
    fields["paidAt"] = at;
    fields["paidBy"] = str(input.adminUid);
    if (input.adminName) fields["paidByName"] = str(input.adminName);
  }
  return fields;
}

/** One-line receipt summary: amount → recipient · date · reason. */
export function payoutReceiptLine(p: {
  amountKobo: number;
  recipient: string;
  paidAt: number | null;
  reason: string;
}): string {
  const when = p.paidAt ? lagosDateTimeWithYear(p.paidAt) : "not yet paid";
  const parts = [formatNaira(p.amountKobo), p.recipient, when];
  if (p.reason) parts.push(p.reason);
  return parts.join(" · ");
}

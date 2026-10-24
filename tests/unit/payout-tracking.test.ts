import { describe, expect, it } from "vitest";

import {
  DELIVERY_METHOD_LABELS,
  FULFILLMENT_LABELS,
  PAYOUT_TYPE_LABELS,
  defaultPayoutReason,
  fulfillmentStamp,
  isWinnerReceived,
  normalizeDeliveryMethod,
  normalizeFulfillmentStatus,
  normalizePayoutType,
  payoutAuditWrite,
  payoutReceiptLine,
  readPayoutAudit,
  readWinnerFulfillment,
  winnerFulfillmentWrite,
  winnerReceiptWrite,
} from "@/lib/payout-tracking";
import { formatNaira } from "@/lib/utils";

const NOW = Date.parse("2026-03-10T12:00:00Z");
const RECEIVED_AT = Date.parse("2026-03-08T15:30:00Z");

describe("winner fulfillment fields", () => {
  it("defaults a legacy winner document to awaiting handover", () => {
    const f = readWinnerFulfillment({ claimStatus: "DISBURSED", verified: true });
    expect(f.fulfillmentStatus).toBe("PENDING_CLAIM");
    expect(f.receivedAt).toBeNull();
    expect(f.receivedByName).toBe("");
    expect(f.fulfillmentUpdatedAt).toBeNull();
    expect(isWinnerReceived({})).toBe(false);
  });

  it("normalizes unknown and lowercase status values", () => {
    expect(normalizeFulfillmentStatus("DISBURSED")).toBe("PENDING_CLAIM");
    expect(normalizeFulfillmentStatus("received")).toBe("RECEIVED");
    expect(normalizeFulfillmentStatus(undefined)).toBe("PENDING_CLAIM");
    expect(normalizeDeliveryMethod("pickup")).toBe("PICKUP");
    expect(normalizeDeliveryMethod("drone")).toBe("COURIER");
  });

  it("reads ISO and Timestamp-like receipt values into epoch millis", () => {
    const fromIso = readWinnerFulfillment({
      fulfillmentStatus: "RECEIVED",
      receivedAt: "2026-03-08T15:30:00Z",
      receivedByName: "Aisha Olamide",
      deliveryMethod: "PICKUP",
      fulfillmentUpdatedAt: { toDate: () => new Date(NOW) },
    });
    expect(fromIso.receivedAt).toBe(RECEIVED_AT);
    expect(fromIso.fulfillmentUpdatedAt).toBe(NOW);
    expect(fromIso.receivedByName).toBe("Aisha Olamide");
    expect(fromIso.deliveryMethod).toBe("PICKUP");
    expect(isWinnerReceived({ fulfillmentStatus: "RECEIVED" })).toBe(true);
  });

  it("stamps the full receipt confirmation payload", () => {
    const out = winnerReceiptWrite(
      {
        receivedAt: RECEIVED_AT,
        adminUid: "adm_aisha_ola_001",
        adminName: "Aisha Olamide",
        deliveryMethod: "COURIER",
        note: "ID verified at the office",
      },
      NOW,
    );
    expect(out).toMatchObject({
      fulfillmentStatus: "RECEIVED",
      receivedAt: new Date(RECEIVED_AT).toISOString(),
      receivedBy: "adm_aisha_ola_001",
      receivedByName: "Aisha Olamide",
      deliveryMethod: "COURIER",
      fulfillmentNote: "ID verified at the office",
      fulfillmentUpdatedAt: new Date(NOW).toISOString(),
      fulfillmentUpdatedBy: "adm_aisha_ola_001",
    });
  });

  it("clears the receipt stamp on any other transition", () => {
    const out = winnerFulfillmentWrite(
      "OUT_FOR_DELIVERY",
      { adminUid: "adm_1", note: "courier dispatched" },
      NOW,
    );
    expect(out["fulfillmentStatus"]).toBe("OUT_FOR_DELIVERY");
    expect(out["receivedAt"]).toBe("");
    expect(out["receivedBy"]).toBe("");
    expect(out["receivedByName"]).toBe("");
    expect(out["fulfillmentNote"]).toBe("courier dispatched");
    expect(out["fulfillmentUpdatedAt"]).toBe(new Date(NOW).toISOString());
    expect("deliveryMethod" in out).toBe(false);
  });

  it("formats the confirmation stamp or a dash when outstanding", () => {
    expect(fulfillmentStamp(null)).toBe("—");
    expect(fulfillmentStamp(0)).toBe("—");
    expect(fulfillmentStamp(RECEIVED_AT)).toMatch(/2026/);
    expect(fulfillmentStamp(RECEIVED_AT)).toMatch(/GMT\+1/);
    expect(FULFILLMENT_LABELS.RECEIVED).toBe("Received by winner");
    expect(DELIVERY_METHOD_LABELS.PICKUP).toBe("Prize pickup");
  });
});

describe("payout audit fields", () => {
  it("reads paid/processed audit data from a payout document", () => {
    const audit = readPayoutAudit({
      reason: "Level 1 referral commission",
      paidAt: "2026-03-08T15:30:00Z",
      paidBy: "adm_1",
      paidByName: "Aisha Olamide",
      paymentReference: "TRF-1",
      processedAt: { toDate: () => new Date(NOW) },
    });
    expect(audit.reason).toBe("Level 1 referral commission");
    expect(audit.paidAt).toBe(RECEIVED_AT);
    expect(audit.paidByName).toBe("Aisha Olamide");
    expect(audit.paymentReference).toBe("TRF-1");
    expect(audit.processedAt).toBe(NOW);
  });

  it("defaults missing audit fields instead of throwing", () => {
    const audit = readPayoutAudit({});
    expect(audit.reason).toBe("");
    expect(audit.paidAt).toBeNull();
    expect(audit.paidBy).toBe("");
    expect(audit.paymentReference).toBe("");
    expect(normalizePayoutType("nonsense")).toBe("REFERRAL");
    expect(PAYOUT_TYPE_LABELS.REFERRAL).toBe("Referral cash-out");
  });

  it("phrases the reason from the payout type and context", () => {
    expect(defaultPayoutReason("REFERRAL", { level: 3 })).toBe("Level 3 referral commission");
    expect(defaultPayoutReason("REFERRAL")).toBe("Referral commission cash-out");
    expect(defaultPayoutReason("PARTNER", { competition: "PS5 Draw" })).toBe(
      "Partner settlement · PS5 Draw",
    );
    expect(defaultPayoutReason("WINNER", { prize: "iPhone" })).toBe("Prize payout · iPhone");
  });

  it("stamps paid settlements with time, actor and reference", () => {
    const paid = payoutAuditWrite({
      status: "PAID",
      adminUid: "adm_1",
      adminName: "Aisha Olamide",
      reason: "Prize payout · iPhone",
      paymentReference: "TRF-9",
      now: NOW,
    });
    expect(paid).toMatchObject({
      reason: "Prize payout · iPhone",
      paymentReference: "TRF-9",
      paidAt: new Date(NOW).toISOString(),
      paidBy: "adm_1",
      paidByName: "Aisha Olamide",
      processedAt: new Date(NOW).toISOString(),
    });

    const processing = payoutAuditWrite({
      status: "PROCESSING",
      adminUid: "adm_1",
      reason: "Partner settlement",
      now: NOW,
    });
    expect(processing["processedAt"]).toBe(new Date(NOW).toISOString());
    expect(processing["reason"]).toBe("Partner settlement");
    expect("paidAt" in processing).toBe(false);
    expect("paymentReference" in processing).toBe(false);
  });

  it("builds a one-line receipt summary", () => {
    const line = payoutReceiptLine({
      amountKobo: 1250000,
      recipient: "Emeka Nwosu",
      paidAt: RECEIVED_AT,
      reason: "Level 1 referral commission",
    });
    expect(line).toContain(formatNaira(1250000));
    expect(line).toContain("Emeka Nwosu");
    expect(line).toContain("Level 1 referral commission");
    expect(line).toMatch(/2026/);

    const unpaid = payoutReceiptLine({
      amountKobo: 0,
      recipient: "Chioma Okeke",
      paidAt: null,
      reason: "",
    });
    expect(unpaid).toContain("not yet paid");
  });
});

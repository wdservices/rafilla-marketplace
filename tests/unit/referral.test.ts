import { describe, expect, it } from "vitest";

import {
  DEFAULT_REFERRAL_RATES,
  normalizeReferralRates,
  referralCodeCandidates,
  referralCommissionKobo,
  referralCommissionSplit,
  referralInviteUrl,
  sanitizeReferralCode,
  ticketQrValue,
  tsToMs,
} from "@/lib/referral-core";

describe("sanitizeReferralCode", () => {
  it("uppercases and keeps handle-style slugs intact", () => {
    expect(sanitizeReferralCode("tunmise-ade")).toBe("TUNMISE-ADE");
    expect(sanitizeReferralCode("TUNMISE-ADE")).toBe("TUNMISE-ADE");
  });

  it("replaces spaces and invalid characters with dashes", () => {
    expect(sanitizeReferralCode("  gospel ononwi ")).toBe("GOSPEL-ONONWI");
    expect(sanitizeReferralCode("user@ref!")).toBe("USER-REF");
  });

  it("collapses dashes, trims edges and caps length at 32", () => {
    expect(sanitizeReferralCode("--abc---def--")).toBe("ABC-DEF");
    expect(sanitizeReferralCode("x".repeat(50))).toHaveLength(32);
    expect(sanitizeReferralCode("")).toBe("");
    expect(sanitizeReferralCode(null)).toBe("");
  });
});

describe("referralCommissionKobo", () => {
  it("rounds percent-of-amount to whole kobo", () => {
    expect(referralCommissionKobo(100_000, 10)).toBe(10_000);
    expect(referralCommissionKobo(9_999, 10)).toBe(1_000); // 999.9 → 1000
  });

  it("returns 0 for non-positive amounts or rates", () => {
    expect(referralCommissionKobo(0, 10)).toBe(0);
    expect(referralCommissionKobo(-5, 10)).toBe(0);
    expect(referralCommissionKobo(1000, 0)).toBe(0);
    expect(referralCommissionKobo(Number.NaN, 10)).toBe(0);
  });
});

describe("referralCommissionSplit", () => {
  it("splits a ₦10,000 order across the 5 default levels", () => {
    // ₦10,000 = 1,000,000 kobo → 10/5/3/2/1%
    const split = referralCommissionSplit(1_000_000, DEFAULT_REFERRAL_RATES);
    expect(split.map((s) => s.level)).toEqual([1, 2, 3, 4, 5]);
    expect(split.map((s) => s.amountKobo)).toEqual([100_000, 50_000, 30_000, 20_000, 10_000]);
    expect(split[0]!.ratePct).toBe(10);
  });

  it("skips levels whose rate is zero", () => {
    const rates = { l1: 10, l2: 0, l3: 3, l4: 0, l5: 1 };
    const split = referralCommissionSplit(100_000, rates);
    expect(split.map((s) => s.level)).toEqual([1, 3, 5]);
  });
});

describe("normalizeReferralRates", () => {
  it("falls back to defaults for missing or invalid config", () => {
    expect(normalizeReferralRates(undefined)).toEqual(DEFAULT_REFERRAL_RATES);
    expect(normalizeReferralRates({ l1: "junk", l2: -5, l3: 200 })).toEqual({
      l1: DEFAULT_REFERRAL_RATES.l1,
      l2: DEFAULT_REFERRAL_RATES.l2,
      l3: 100,
      l4: DEFAULT_REFERRAL_RATES.l4,
      l5: DEFAULT_REFERRAL_RATES.l5,
    });
  });

  it("accepts admin-configured numbers", () => {
    expect(normalizeReferralRates({ l1: 12, l2: 6, l3: 4, l4: 2, l5: 1 })).toEqual({
      l1: 12,
      l2: 6,
      l3: 4,
      l4: 2,
      l5: 1,
    });
  });
});

describe("referralCodeCandidates", () => {
  it("offers the bare handle first when it is long enough", () => {
    expect(referralCodeCandidates("tunmise-ade")[0]).toBe("TUNMISE-ADE");
    expect(referralCodeCandidates("gospel")[0]).toBe("GOSPEL");
  });

  it("always appends a 4-char suffix variant", () => {
    const [, suffixed] = referralCodeCandidates("gospel");
    expect(suffixed).toMatch(/^GOSPEL-[A-Z0-9]{4}$/);
  });

  it("forces a suffix for very short seeds", () => {
    const [first] = referralCodeCandidates("ab");
    expect(first).toMatch(/^AB-[A-Z0-9]{4}$/);
  });
});

describe("ticketQrValue", () => {
  it("builds the invite URL with comp and entry params", () => {
    expect(
      ticketQrValue({
        origin: "https://raffila.com",
        refCode: "GOSPEL",
        competitionSlug: "iphone-17-pro",
        entryId: "RF-2026-ABC",
      }),
    ).toBe("https://raffila.com/invite/GOSPEL?comp=iphone-17-pro&e=RF-2026-ABC");
  });

  it("falls back to the competition URL when no code exists", () => {
    expect(
      ticketQrValue({
        origin: "https://raffila.com/",
        refCode: null,
        competitionSlug: "iphone-17-pro",
        entryId: "RF-2026-ABC",
      }),
    ).toBe("https://raffila.com/competitions/iphone-17-pro");
  });
});

describe("referralInviteUrl", () => {
  it("joins origin and invite path without duplicate slashes", () => {
    expect(referralInviteUrl("tunmise-ade", "https://raffila.com/")).toBe(
      "https://raffila.com/invite/TUNMISE-ADE",
    );
  });
});

describe("tsToMs", () => {
  it("reads Firestore-style timestamps", () => {
    expect(tsToMs({ toMillis: () => 1234 })).toBe(1234);
    expect(tsToMs({ seconds: 2 })).toBe(2000);
    expect(tsToMs(null)).toBe(0);
  });
});

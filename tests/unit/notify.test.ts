import { describe, expect, it } from "vitest";

import {
  DEFAULT_MILESTONE_PCT,
  FALLBACK_MILESTONE_STEP,
  broadcastIds,
  broadcastMailDoc,
  broadcastNotifDoc,
  chunkArray,
  directMailDoc,
  drawReminderEmail,
  escapeHtml,
  milestoneEmail,
  milestoneLabel,
  milestoneStage,
  normalizeMilestonePct,
  personalNotifDoc,
  purchaseReceiptEmail,
  pushOutboxDoc,
  receiptIds,
  welcomeEmail,
  welcomeIds,
  winnerAnnounceEmail,
} from "@/lib/notify";

describe("normalizeMilestonePct", () => {
  it("accepts a comma/space separated string and sorts + dedupes", () => {
    expect(normalizeMilestonePct("90, 25 50,25")).toEqual([25, 50, 90]);
  });

  it("accepts arrays, numbers, and drops out-of-range values", () => {
    expect(normalizeMilestonePct([75, 0, 101, 75, "50"])).toEqual([50, 75]);
    expect(normalizeMilestonePct(40)).toEqual([40]);
  });

  it("falls back to the default list for junk input", () => {
    expect(normalizeMilestonePct(undefined)).toEqual([...DEFAULT_MILESTONE_PCT]);
    expect(normalizeMilestonePct("abc")).toEqual([...DEFAULT_MILESTONE_PCT]);
    expect(normalizeMilestonePct([])).toEqual([...DEFAULT_MILESTONE_PCT]);
  });
});

describe("milestoneStage / milestoneLabel", () => {
  const pcts = [25, 50, 75, 90];

  it("counts crossed thresholds against the entry target", () => {
    expect(milestoneStage(0, 1000, pcts)).toBe(0);
    expect(milestoneStage(249, 1000, pcts)).toBe(0);
    expect(milestoneStage(250, 1000, pcts)).toBe(1);
    expect(milestoneStage(900, 1000, pcts)).toBe(4);
    expect(milestoneStage(1000, 1000, pcts)).toBe(4);
  });

  it("uses the fallback step when no target is configured", () => {
    expect(milestoneStage(FALLBACK_MILESTONE_STEP - 1, 0, pcts)).toBe(0);
    expect(milestoneStage(FALLBACK_MILESTONE_STEP, 0, pcts)).toBe(1);
    expect(milestoneStage(FALLBACK_MILESTONE_STEP * 2 + 10, 0, pcts)).toBe(2);
  });

  it("labels the highest crossed milestone with counts", () => {
    expect(milestoneLabel(2, 500, 1000, pcts)).toBe("50% sold — 500 of 1,000 entries");
    expect(milestoneLabel(1, 75, 100, pcts)).toBe("25% sold — 75 of 100 entries");
  });

  it("labels fallback-step milestones without a target", () => {
    expect(milestoneLabel(2, 120, 0, pcts)).toBe(
      `120 entries sold — ${(FALLBACK_MILESTONE_STEP * 2).toLocaleString("en-NG")} milestone reached`,
    );
  });
});

describe("escapeHtml", () => {
  it("escapes markup in interpolated values", () => {
    expect(escapeHtml(`<b>&"'</b>`)).toBe("&lt;b&gt;&amp;&quot;&#39;&lt;/b&gt;");
    expect(escapeHtml(undefined)).toBe("");
  });
});

describe("email templates", () => {
  const origin = "https://raffila.com";

  it("welcome email greets the new member and links to competitions", () => {
    const mail = welcomeEmail({ firstName: "Ada", origin });
    expect(mail.subject).toContain("Welcome to Raffila");
    expect(mail.text).toContain("Hi Ada,");
    expect(mail.text).toContain(`${origin}/competitions`);
    expect(mail.html).toContain(`${origin}/competitions`);
  });

  it("purchase receipt lists tickets, total, and reference", () => {
    const mail = purchaseReceiptEmail({
      buyerName: "Ada",
      reference: "RF-REF-123",
      items: [
        {
          title: "Lagos Getaway",
          quantity: 2,
          ticketNumbers: ["111111", "222222"],
          amountKobo: 50000,
        },
      ],
      totalKobo: 50000,
      paidWith: "paystack",
      origin,
    });
    expect(mail.subject).toContain("2 tickets");
    expect(mail.text).toContain("#111111");
    expect(mail.text).toContain("RF-REF-123");
    expect(mail.text).toContain("₦500");
    expect(mail.html).toContain("Lagos Getaway");
  });

  it("milestone email carries the label and competition link", () => {
    const mail = milestoneEmail({
      title: "Lagos Getaway",
      slug: "lagos-getaway",
      label: "50% sold — 500 of 1,000 entries",
      origin,
    });
    expect(mail.subject).toContain("Filling fast: Lagos Getaway");
    expect(mail.text).toContain("50% sold");
    expect(mail.html).toContain(`${origin}/competitions/lagos-getaway`);
  });

  it("draw reminder email links to the live draw page", () => {
    const mail = drawReminderEmail({
      title: "Lagos Getaway",
      slug: "lagos-getaway",
      whenLabel: "Monday, 7:00 PM GMT+1",
      origin,
    });
    expect(mail.subject).toContain("Draw time");
    expect(mail.html).toContain(`${origin}/competitions/lagos-getaway/draw`);
  });

  it("winner announcement names the winner and ticket", () => {
    const mail = winnerAnnounceEmail({
      title: "Lagos Getaway",
      slug: "lagos-getaway",
      winnerName: "Ada",
      ticketNumber: "111111",
      origin,
    });
    expect(mail.subject).toContain("We have a winner");
    expect(mail.text).toContain("Ada");
    expect(mail.text).toContain("#111111");
    expect(mail.html).toContain(`${origin}/competitions/lagos-getaway/draw`);
  });
});

describe("doc builders and ids", () => {
  it("personal notification ids are deterministic per category + key", () => {
    expect(welcomeIds("uid1")).toEqual({ mail: "welcome-uid1", notification: "welcome-uid1" });
    expect(receiptIds("RF-REF-1")).toEqual({
      mail: "rcpt-RF-REF-1",
      notification: "rcpt-RF-REF-1",
    });
  });

  it("broadcast ids are deterministic; milestones carry the stage, push only for draw/winner", () => {
    expect(broadcastIds("milestone", "lagos", 2)).toEqual({
      notification: "bc-milestone-lagos-2",
      mail: "mail-milestone-lagos-2",
    });
    expect(broadcastIds("draw", "lagos")).toEqual({
      notification: "bc-draw-lagos",
      mail: "mail-draw-lagos",
      push: "push-draw-lagos",
    });
    expect(broadcastIds("winner", "lagos").push).toBe("push-winner-lagos");
  });

  it("personal vs broadcast notification docs differ only by audience", () => {
    const personal = personalNotifDoc({
      userId: "u1",
      category: "receipt",
      title: "T",
      body: "B",
      href: "/x",
      createdAt: "t",
    });
    expect(personal.userId).toBe("u1");
    const broadcast = broadcastNotifDoc({
      category: "winner",
      title: "T",
      body: "B",
      href: "/x",
      createdAt: "t",
    });
    expect(broadcast.userId).toBe("");
  });

  it("mail docs carry target address or the broadcast audience", () => {
    const direct = directMailDoc({
      to: "ada@example.com",
      uid: "u1",
      kind: "receipt",
      message: { subject: "s", text: "t", html: "<p>h</p>" },
      createdAt: "t",
    });
    expect(direct.to).toBe("ada@example.com");
    expect(direct.audience).toBeUndefined();

    const broadcast = broadcastMailDoc({
      kind: "winner",
      message: { subject: "s", text: "t", html: "<p>h</p>" },
      createdAt: "t",
    });
    expect(broadcast.audience).toBe("all");
    expect(broadcast.to).toBe("All users");
  });

  it("push outbox docs start pending", () => {
    const doc = pushOutboxDoc({ title: "Hi", body: "B", url: "/x", createdAt: "t" });
    expect(doc.status).toBe("pending");
    expect(doc.url).toBe("/x");
  });

  it("chunkArray splits evenly and keeps remainders", () => {
    expect(chunkArray([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunkArray([], 3)).toEqual([]);
  });
});

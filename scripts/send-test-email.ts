import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  drawReminderEmail,
  milestoneEmail,
  purchaseReceiptEmail,
  welcomeEmail,
  winnerAnnounceEmail,
} from "../src/lib/notify";

/**
 * Queues ONE real email into the Firestore `mail` collection, then runs the
 * exact same worker the /api/notify-tick cron runs — so the message travels
 * the full production path (queue → claim → Resend → delivery stamp).
 *
 *   npx vite-node scripts/send-test-email.ts spellz49@gmail.com welcome
 *   kinds: welcome | receipt | milestone | draw | winner
 */

const envPath = join(process.cwd(), ".env");
try {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    if (k && !process.env[k]) process.env[k] = t.slice(i + 1);
  }
} catch {
  // no .env — env must already be provided by the shell
}

const to = (process.argv[2] || "").trim();
const kind = (process.argv[3] || "welcome").trim().toLowerCase();
if (!to.includes("@")) {
  console.error(
    "Usage: npx vite-node scripts/send-test-email.ts <email> [welcome|receipt|milestone|draw|winner]",
  );
  process.exit(1);
}

const origin = "https://raffila.com";
const messages: Record<string, { subject: string; text: string; html: string }> = {
  welcome: welcomeEmail({ firstName: "Spellz", origin }),
  receipt: purchaseReceiptEmail({
    buyerName: "Spellz",
    reference: "RF-REF-TEST01",
    items: [
      {
        title: "Lagos 2-Bed Apartment Giveaway",
        quantity: 3,
        ticketNumbers: ["482917", "105834", "776201"],
        amountKobo: 75000,
      },
      { title: "iPhone 17 Pro Draw", quantity: 1, ticketNumbers: ["930165"], amountKobo: 25000 },
    ],
    totalKobo: 100000,
    paidWith: "paystack",
    origin,
  }),
  milestone: milestoneEmail({
    title: "Lagos 2-Bed Apartment Giveaway",
    slug: "lagos-2bed-apartment",
    label: "50% sold — 1,500 of 3,000 entries",
    origin,
  }),
  draw: drawReminderEmail({
    title: "Lagos 2-Bed Apartment Giveaway",
    slug: "lagos-2bed-apartment",
    whenLabel: "Monday, 7:00 PM GMT+1",
    origin,
  }),
  winner: winnerAnnounceEmail({
    title: "Lagos 2-Bed Apartment Giveaway",
    slug: "lagos-2bed-apartment",
    winnerName: "Chidi Okafor",
    ticketNumber: "482917",
    origin,
  }),
};

const message = messages[kind];
if (!message) {
  console.error(`Unknown kind "${kind}". Use: ${Object.keys(messages).join(" | ")}`);
  process.exit(1);
}

const { getAdminDb, FieldValue } = await import("../src/lib/firebase-admin");
const { runNotifyTick } = await import("../src/lib/notify-worker");

const adminDb = getAdminDb();
const docId = `test-${kind}-${Date.now()}`;
await adminDb
  .collection("mail")
  .doc(docId)
  .set({
    to,
    kind: `test_${kind}`,
    message,
    delivery: null,
    createdAt: FieldValue.serverTimestamp(),
  });

console.log(`Queued ${docId} → ${to}`);

const report = await runNotifyTick({ origin });
console.log(JSON.stringify(report, null, 2));

if (report.email.sent >= 1) {
  console.log(`\nSENT ✓  "${message.subject}" → ${to}`);
} else if (!report.email.apiKeySet) {
  console.error("\nNOT SENT — RESEND_API_KEY is empty/missing in .env");
  process.exit(2);
} else {
  console.error("\nNOT SENT — check the delivery state on the mail doc / report.errors above");
  process.exit(3);
}

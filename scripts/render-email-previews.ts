import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  drawReminderEmail,
  milestoneEmail,
  purchaseReceiptEmail,
  welcomeEmail,
  winnerAnnounceEmail,
} from "../src/lib/notify";

/**
 * Renders every notification email template to static HTML so the copy and
 * branding can be eyeballed in a browser without sending anything.
 * Run: npx vite-node scripts/render-email-previews.ts
 * Output: <system temp>/rafilla-email-previews/*.html
 */

const origin = "https://raffila.com";
const outDir = join(tmpdir(), "rafilla-email-previews");
mkdirSync(outDir, { recursive: true });

const files: { name: string; subject: string; html: string; text: string }[] = [
  {
    name: "1-welcome.html",
    ...welcomeEmail({ firstName: "Ada", origin }),
  },
  {
    name: "2-ticket-receipt.html",
    ...purchaseReceiptEmail({
      buyerName: "Ada",
      reference: "RF-REF-K3M9X2",
      items: [
        {
          title: "Lagos 2-Bed Apartment Giveaway",
          quantity: 3,
          ticketNumbers: ["482917", "105834", "776201"],
          amountKobo: 75000,
        },
        {
          title: "iPhone 17 Pro Draw",
          quantity: 1,
          ticketNumbers: ["930165"],
          amountKobo: 25000,
        },
      ],
      totalKobo: 100000,
      paidWith: "paystack",
      origin,
    }),
  },
  {
    name: "3-milestone.html",
    ...milestoneEmail({
      title: "Lagos 2-Bed Apartment Giveaway",
      slug: "lagos-2bed-apartment",
      label: "50% sold — 1,500 of 3,000 entries",
      origin,
    }),
  },
  {
    name: "4-draw-reminder.html",
    ...drawReminderEmail({
      title: "Lagos 2-Bed Apartment Giveaway",
      slug: "lagos-2bed-apartment",
      whenLabel: "Monday, 7:00 PM GMT+1",
      origin,
    }),
  },
  {
    name: "5-winner.html",
    ...winnerAnnounceEmail({
      title: "Lagos 2-Bed Apartment Giveaway",
      slug: "lagos-2bed-apartment",
      winnerName: "Chidi Okafor",
      ticketNumber: "482917",
      origin,
    }),
  },
];

const index = [
  "<!doctype html><meta charset='utf-8'><title>Raffila email previews</title>",
  "<body style='font-family:Georgia,serif;background:#F6F2EC;padding:32px;'>",
  "<h1>Raffila email previews</h1><ul>",
  ...files.map((f) => `<li><a href='${f.name}'>${f.name}</a> — ${f.subject}</li>`),
  "</ul></body>",
].join("\n");

for (const f of files) {
  writeFileSync(join(outDir, f.name), f.html, "utf8");
}
writeFileSync(join(outDir, "index.html"), index, "utf8");

console.log(`Preview folder: ${outDir}`);
for (const f of files) console.log(`  ${f.name}  —  ${f.subject}`);

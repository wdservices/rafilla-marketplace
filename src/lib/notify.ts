import { formatNaira } from "./utils";

export type NotifyCategory = "welcome" | "receipt" | "milestone" | "draw" | "winner" | "system";

export const DEFAULT_MILESTONE_PCT = [25, 50, 75, 90];
export const FALLBACK_MILESTONE_STEP = 50;

export function normalizeMilestonePct(raw: unknown): number[] {
  const list: number[] = [];
  if (Array.isArray(raw)) {
    for (const v of raw) {
      const n = Math.round(Number(v));
      if (Number.isFinite(n) && n >= 1 && n <= 100) list.push(n);
    }
  } else if (typeof raw === "string") {
    for (const part of raw.split(/[,\s]+/)) {
      const n = Math.round(Number(part));
      if (Number.isFinite(n) && n >= 1 && n <= 100) list.push(n);
    }
  } else if (typeof raw === "number") {
    const n = Math.round(raw);
    if (n >= 1 && n <= 100) list.push(n);
  }
  const unique = Array.from(new Set(list)).sort((a, b) => a - b);
  return unique.length > 0 ? unique : [...DEFAULT_MILESTONE_PCT];
}

/** How many milestones a competition has crossed for the current sold count. */
export function milestoneStage(
  entriesSold: number,
  totalEntries: number,
  pctList: number[],
): number {
  const sold = Math.max(0, Math.floor(entriesSold));
  if (totalEntries > 0) {
    const pct = (sold / totalEntries) * 100;
    return pctList.filter((p) => pct >= p).length;
  }
  return Math.floor(sold / FALLBACK_MILESTONE_STEP);
}

/** Human line for the highest crossed milestone, e.g. "50% sold — 500 of 1,000 entries". */
export function milestoneLabel(
  stage: number,
  entriesSold: number,
  totalEntries: number,
  pctList: number[],
): string {
  if (totalEntries > 0) {
    const idx = Math.min(stage, pctList.length) - 1;
    const pct = idx >= 0 ? pctList[idx] : 0;
    return `${pct}% sold — ${entriesSold.toLocaleString("en-NG")} of ${totalEntries.toLocaleString("en-NG")} entries`;
  }
  const step = Math.max(1, stage) * FALLBACK_MILESTONE_STEP;
  return `${entriesSold.toLocaleString("en-NG")} entries sold — ${step.toLocaleString("en-NG")} milestone reached`;
}

export function escapeHtml(input: unknown): string {
  return String(input ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface MailMessage {
  subject: string;
  text: string;
  html: string;
}

const BRANDING_FOOTER =
  "You are receiving this email because you have a Raffila account. Manage your email preferences from the notification bell in your dashboard.";

function shell(title: string, bodyHtml: string): string {
  return [
    "<!doctype html><html><head>",
    `<meta charset="utf-8"><title>${escapeHtml(title)}</title>`,
    "</head><body style=\"margin:0;background:#F6F2EC;font-family:Georgia,'Times New Roman',serif;\">",
    '<div style="max-width:560px;margin:0 auto;padding:28px 20px 40px;">',
    '<div style="font-size:22px;font-weight:800;letter-spacing:-0.5px;color:#0E1021;padding-bottom:18px;border-bottom:2px solid #0E1021;">Raffila</div>',
    `<div style="background:#FFFFFF;border-radius:18px;padding:26px 24px;margin-top:20px;box-shadow:0 10px 30px -24px rgba(14,16,33,.5);"><div style="font-size:15px;line-height:1.65;color:#1C1E2E;">`,
    bodyHtml,
    "</div></div>",
    `<div style="font-size:11px;line-height:1.6;color:#7A7C8C;padding-top:18px;">${BRANDING_FOOTER}</div>`,
    "</div></body></html>",
  ].join("");
}

function button(href: string, label: string): string {
  return `<p style="margin:22px 0 6px;"><a href="${escapeHtml(href)}" style="display:inline-block;background:#F06A5D;color:#FFFFFF;text-decoration:none;font-weight:800;font-size:14px;padding:12px 26px;border-radius:999px;">${escapeHtml(label)}</a></p>`;
}

export function welcomeEmail(args: { firstName: string; origin: string }): MailMessage {
  const name = escapeHtml(args.firstName || "there");
  const competitions = `${args.origin}/competitions`;
  const subject = "Welcome to Raffila — your first prize draw awaits";
  const text = [
    `Hi ${args.firstName || "there"},`,
    "",
    "Welcome to Raffila! You can now enter premium prize competitions with publicly verifiable, provably fair draws.",
    "",
    "Browse open competitions and enter:",
    competitions,
    "",
    "Fair draws. Real prizes.",
    "- Team Raffila",
  ].join("\n");
  const html = shell(
    subject,
    `<p>Hi ${name},</p>
     <p>Welcome to Raffila! You can now enter premium prize competitions with publicly verifiable, provably fair draws.</p>
     ${button(competitions, "Browse competitions")}
     <p style="font-size:13px;color:#7A7C8C;">Fair draws. Real prizes. — Team Raffila</p>`,
  );
  return { subject, text, html };
}

export interface ReceiptLine {
  title: string;
  quantity: number;
  ticketNumbers: string[];
  amountKobo: number;
}

export function purchaseReceiptEmail(args: {
  buyerName: string;
  reference: string;
  items: ReceiptLine[];
  totalKobo: number;
  paidWith: "paystack" | "referral";
  origin: string;
}): MailMessage {
  const name = escapeHtml(args.buyerName || "there");
  const rows = args.items
    .map((item) => {
      const tickets = item.ticketNumbers.map((n) => `#${n}`).join(", ") || "—";
      return `<tr><td style="padding:8px 10px;border-bottom:1px solid #EFEAE2;">${escapeHtml(item.title)}</td><td style="padding:8px 10px;border-bottom:1px solid #EFEAE2;text-align:center;">${item.quantity}</td><td style="padding:8px 10px;border-bottom:1px solid #EFEAE2;font-family:ui-monospace,monospace;font-size:12px;">${escapeHtml(tickets)}</td><td style="padding:8px 10px;border-bottom:1px solid #EFEAE2;text-align:right;">${formatNaira(item.amountKobo)}</td></tr>`;
    })
    .join("");
  const totalTickets = args.items.reduce((n, i) => n + i.quantity, 0);
  const entriesUrl = `${args.origin}/dashboard/entries`;
  const subject = `Your Raffila tickets confirmed — ${totalTickets} ticket${totalTickets === 1 ? "" : "s"}`;
  const textLines = [
    `Hi ${args.buyerName || "there"},`,
    "",
    "Your payment is confirmed and your ticket numbers are below:",
    "",
    ...args.items.map(
      (i) =>
        `• ${i.title} — ${i.quantity} ticket(s): ${i.ticketNumbers.map((n) => `#${n}`).join(", ") || "—"}`,
    ),
    "",
    `Total paid: ${formatNaira(args.totalKobo)}`,
    `Order reference: ${args.reference}`,
    "",
    "View your entries anytime:",
    entriesUrl,
  ];
  const text = textLines.join("\n");
  const html = shell(
    subject,
    `<p>Hi ${name},</p>
     <p>Your payment is confirmed and your ticket numbers are reserved:</p>
     <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-size:13px;margin-top:8px;">
       <tr style="background:#F6F2EC;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#7A7C8C;">
         <th style="padding:8px 10px;text-align:left;">Competition</th>
         <th style="padding:8px 10px;">Qty</th>
         <th style="padding:8px 10px;">Tickets</th>
         <th style="padding:8px 10px;text-align:right;">Paid</th>
       </tr>
       ${rows}
     </table>
     <p style="margin-top:16px;"><strong>Total paid:</strong> ${formatNaira(args.totalKobo)}<br/>
     <strong>Reference:</strong> ${escapeHtml(args.reference)}</p>
     ${button(entriesUrl, "View my entries")}`,
  );
  return { subject, text, html };
}

export function milestoneEmail(args: {
  title: string;
  slug: string;
  label: string;
  origin: string;
}): MailMessage {
  const url = `${args.origin}/competitions/${encodeURIComponent(args.slug)}`;
  const subject = `Filling fast: ${args.title} — ${args.label}`;
  const text = [
    "Good news from Raffila:",
    "",
    `${args.title} is filling fast.`,
    `Status: ${args.label}`,
    "",
    "Secure your entries before the pool closes:",
    url,
    "",
    "- Team Raffila",
  ].join("\n");
  const html = shell(
    subject,
    `<p>Good news from Raffila:</p>
     <p style="font-size:17px;font-weight:800;color:#0E1021;">${escapeHtml(args.title)} is filling fast.</p>
     <p style="background:#F6F2EC;border-radius:12px;padding:12px 16px;font-weight:700;">${escapeHtml(args.label)}</p>
     <p>Entries are moving quickly — secure yours before the pool closes.</p>
     ${button(url, "Enter now")}`,
  );
  return { subject, text, html };
}

export function drawReminderEmail(args: {
  title: string;
  slug: string;
  whenLabel: string;
  origin: string;
}): MailMessage {
  const url = `${args.origin}/competitions/${encodeURIComponent(args.slug)}/draw`;
  const subject = `Draw time: ${args.title} — ${args.whenLabel}`;
  const text = [
    "It is draw time on Raffila.",
    "",
    `${args.title}: ${args.whenLabel}`,
    "",
    "Watch the live draw and the verification record:",
    url,
    "",
    "- Team Raffila",
  ].join("\n");
  const html = shell(
    subject,
    `<p>It is draw time on Raffila.</p>
     <p style="font-size:17px;font-weight:800;color:#0E1021;">${escapeHtml(args.title)}</p>
     <p style="background:#F6F2EC;border-radius:12px;padding:12px 16px;font-weight:700;">${escapeHtml(args.whenLabel)}</p>
     ${button(url, "Watch the live draw")}`,
  );
  return { subject, text, html };
}

export function winnerAnnounceEmail(args: {
  title: string;
  slug: string;
  winnerName: string;
  ticketNumber: string;
  origin: string;
}): MailMessage {
  const url = `${args.origin}/competitions/${encodeURIComponent(args.slug)}/draw`;
  const subject = `We have a winner: ${args.title}`;
  const text = [
    "The draw is complete and the results are in:",
    "",
    `${args.title}`,
    `Winner: ${args.winnerName} (ticket #${args.ticketNumber})`,
    "",
    "See the full draw and verification record:",
    url,
    "",
    "- Team Raffila",
  ].join("\n");
  const html = shell(
    subject,
    `<p>The draw is complete and the results are in:</p>
     <p style="font-size:17px;font-weight:800;color:#0E1021;">${escapeHtml(args.title)}</p>
     <p style="background:#F6F2EC;border-radius:12px;padding:12px 16px;">🏆 <strong>${escapeHtml(args.winnerName)}</strong> won with ticket <strong>#${escapeHtml(args.ticketNumber)}</strong></p>
     ${button(url, "View draw & verification")}`,
  );
  return { subject, text, html };
}

// ---- Firestore doc builders (pure objects; caller supplies createdAt) ----

// NOTE: these are `type` aliases (not `interface`) on purpose — alias types get
// an implicit index signature, so the objects pass this repo's
// `Record<string, unknown>` params (exactOptionalPropertyTypes is also on).

export type UserNotificationDoc = {
  userId: string;
  category: NotifyCategory;
  title: string;
  body: string;
  href: string;
  createdAt: unknown;
  readAt?: unknown;
};

export function personalNotificationIds(category: NotifyCategory, key: string): string {
  return `${category}-${key}`;
}

export function broadcastIds(
  category: "milestone" | "draw" | "winner",
  slug: string,
  stage?: number,
): {
  notification: string;
  mail: string;
  push?: string;
} {
  const suffix = category === "milestone" ? `${slug}-${stage ?? 0}` : slug;
  return {
    notification: `bc-${category}-${suffix}`,
    mail: `mail-${category}-${suffix}`,
    ...(category === "milestone" ? {} : { push: `push-${category}-${slug}` }),
  };
}

export function welcomeIds(uid: string): { mail: string; notification: string } {
  return { mail: `welcome-${uid}`, notification: `welcome-${uid}` };
}

export function receiptIds(reference: string): { mail: string; notification: string } {
  return { mail: `rcpt-${reference}`, notification: `rcpt-${reference}` };
}

export function personalNotifDoc(args: {
  userId: string;
  category: NotifyCategory;
  title: string;
  body: string;
  href: string;
  createdAt: unknown;
}): UserNotificationDoc {
  return {
    userId: args.userId,
    category: args.category,
    title: args.title,
    body: args.body,
    href: args.href,
    createdAt: args.createdAt,
  };
}

export function broadcastNotifDoc(args: {
  category: NotifyCategory;
  title: string;
  body: string;
  href: string;
  createdAt: unknown;
}): UserNotificationDoc {
  return { ...personalNotifDoc({ ...args, userId: "" }) };
}

export type MailDoc = {
  to?: string | undefined;
  uid?: string | undefined;
  kind: string;
  audience?: "all" | undefined;
  message: MailMessage;
  createdAt: unknown;
  delivery?: null | undefined;
};

export function directMailDoc(args: {
  to: string;
  uid?: string;
  kind: string;
  message: MailMessage;
  createdAt: unknown;
}): MailDoc {
  return {
    to: args.to,
    uid: args.uid,
    kind: args.kind,
    message: args.message,
    createdAt: args.createdAt,
    delivery: null,
  };
}

export function broadcastMailDoc(args: {
  kind: string;
  message: MailMessage;
  createdAt: unknown;
}): MailDoc {
  return {
    kind: args.kind,
    audience: "all",
    to: "All users",
    message: args.message,
    createdAt: args.createdAt,
    delivery: null,
  };
}

export type PushOutboxDoc = {
  status: string;
  title: string;
  body: string;
  url: string;
  sent?: number | undefined;
  failed?: number | undefined;
  cursor?: string | undefined;
  lastError?: string | undefined;
  createdAt: unknown;
  sentAt?: unknown;
};

export function pushOutboxDoc(args: {
  title: string;
  body: string;
  url: string;
  createdAt: unknown;
}): PushOutboxDoc {
  return {
    status: "pending",
    title: args.title,
    body: args.body,
    url: args.url,
    createdAt: args.createdAt,
  };
}

export function chunkArray<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

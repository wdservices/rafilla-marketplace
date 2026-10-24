import {
  DEFAULT_MILESTONE_PCT,
  broadcastIds,
  broadcastMailDoc,
  broadcastNotifDoc,
  chunkArray,
  pushOutboxDoc,
} from "./notify";

/**
 * SERVER ONLY — notification worker driven by /api/notify-tick (cPanel cron).
 * Drains the Firestore `mail` queue through Resend, fans out web-push from the
 * `pushOutbox` to stored subscriptions, and fires draw-time reminders.
 *
 * Never import this from client code (it pulls in web-push + Admin SDK paths).
 * The route that owns it must dynamically import this module inside its handler.
 */

const RESEND_URL = "https://api.resend.com/emails";
const EMAIL_BATCH = 25;
const PUSH_CONCURRENCY = 10;
const PUSH_SUB_CHUNK = 100;
const DEFAULT_DRAW_REMINDER_MIN = 60;
const DRAW_PAST_GRACE_MS = 10 * 60 * 1000;

export interface TickReport {
  ok: boolean;
  now: string;
  durationMs: number;
  email: {
    apiKeySet: boolean;
    from: string;
    processed: number;
    sent: number;
    failed: number;
    broadcastRecipients: number;
  };
  push: { vapidSet: boolean; processed: number; sent: number; failed: number; pruned: number };
  draw: { scanned: number; fired: number };
  errors: string[];
}

function validEmail(value: unknown): value is string {
  if (typeof value !== "string") return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function toMs(value: unknown): number {
  try {
    const v = value as { toDate?: () => Date };
    if (v && typeof v.toDate === "function") return v.toDate().getTime();
  } catch {
    // ignore
  }
  if (typeof value === "number" && value > 0) return value;
  if (typeof value === "string" && value) {
    const t = new Date(value).getTime();
    if (!Number.isNaN(t)) return t;
  }
  return 0;
}

/** Server copy of draw-system.parseCloseMs (draw-system pulls client Firebase). */
export function readCloseMs(data: Record<string, unknown>): number {
  const candidates = [
    data["closesAt"],
    data["closes"],
    data["drawDate"],
    data["closeDate"],
    data["endDate"],
  ];
  for (const c of candidates) {
    try {
      const v = c as { toDate?: () => Date };
      if (v && typeof v.toDate === "function") return v.toDate().getTime();
    } catch {
      // ignore
    }
    if (typeof c === "number" && c > 0) return c;
    if (typeof c === "string" && c) {
      const t = new Date(c).getTime();
      if (!Number.isNaN(t)) return t;
    }
  }
  return 0;
}

interface NotifyConfig {
  emailEnabled: boolean;
  inappEnabled: boolean;
  drawReminderMin: number;
  milestonePct: number[];
}

async function readNotifyConfig(adminDb: FirebaseFirestore.Firestore): Promise<NotifyConfig> {
  const snap = await adminDb.collection("platformSettings").doc("raffila_config").get();
  const notifs = (snap.data() ?? {})["notifications"] as Record<string, unknown> | undefined;
  const pctRaw = notifs?.["milestonePct"];
  const pct =
    Array.isArray(pctRaw) && pctRaw.length > 0
      ? (pctRaw as unknown[])
          .map((n) => Number(n))
          .filter((n) => Number.isFinite(n) && n >= 1 && n <= 100)
      : [...DEFAULT_MILESTONE_PCT];
  const reminder = Number(notifs?.["drawReminderMin"] ?? DEFAULT_DRAW_REMINDER_MIN);
  return {
    emailEnabled: notifs?.["email"] !== false,
    inappEnabled: notifs?.["inapp"] !== false,
    drawReminderMin:
      Number.isFinite(reminder) && reminder > 0 ? reminder : DEFAULT_DRAW_REMINDER_MIN,
    milestonePct: pct.length > 0 ? pct : [...DEFAULT_MILESTONE_PCT],
  };
}

async function resendSendBatch(
  apiKey: string,
  from: string,
  replyTo: string,
  to: string[],
  message: { subject: string; text: string; html: string },
): Promise<void> {
  const payload = to.map((addr) => ({
    from,
    ...(replyTo ? { reply_to: replyTo } : {}),
    to: [addr],
    subject: message.subject,
    text: message.text,
    html: message.html,
  }));
  let resp: Response;
  try {
    resp = await fetch(RESEND_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload.length === 1 ? payload[0] : payload),
    });
  } catch (err) {
    const cause = (err as { cause?: { code?: string } }).cause;
    throw new Error(cause?.code ? `fetch failed (${cause.code})` : "fetch failed");
  }
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`Resend ${resp.status}: ${body.slice(0, 300)}`);
  }
}

interface MailDocData {
  to?: unknown;
  uid?: unknown;
  kind?: unknown;
  audience?: unknown;
  message?: { subject?: unknown; text?: unknown; html?: unknown };
}

function mailMessageOf(data: MailDocData): { subject: string; text: string; html: string } | null {
  const msg = data.message;
  if (!msg || typeof msg.subject !== "string") return null;
  return {
    subject: msg.subject,
    text: typeof msg.text === "string" ? msg.text : "",
    html: typeof msg.html === "string" ? msg.html : "",
  };
}

const STALE_SENDING_MS = 5 * 60 * 1000;

function isRetryableMailError(msg: string): boolean {
  if (msg.startsWith("fetch")) return true; // network blip
  if (/^Resend 5\d\d:/.test(msg)) return true; // provider outage
  if (/^Resend 401:/.test(msg)) return true; // bad/rotated API key — fixable
  // Unverified sender (403 validation_error) — self-heals after DNS setup.
  if (msg.includes('"statusCode":403') && msg.includes("validation_error")) return true;
  return false;
}

async function drainMail(
  adminDb: FirebaseFirestore.Firestore,
  cfg: NotifyConfig,
  report: TickReport,
  deadline: number,
): Promise<void> {
  const apiKey = (process.env["RESEND_API_KEY"] || "").trim();
  const from = (process.env["RESEND_FROM"] || "").trim() || "Raffila <onboarding@resend.dev>";
  const replyTo = (process.env["RESEND_REPLY_TO"] || "").trim() || "support@raffila.com";
  report.email.from = from;
  if (!apiKey) return;
  if (!cfg.emailEnabled) return;

  const { FieldValue } = await import("./firebase-admin");
  const freshSnap = await adminDb.collection("mail").where("delivery", "==", null).limit(40).get();
  const candidates = freshSnap.docs.slice();

  const stuckSnap = await adminDb
    .collection("mail")
    .where("delivery.state", "==", "sending")
    .limit(15)
    .get();
  const freshIds = new Set(freshSnap.docs.map((d) => d.id));
  const nowMs = Date.now();
  for (const d of stuckSnap.docs) {
    if (freshIds.has(d.id)) continue;
    const at = toMs((d.data()["delivery"] as Record<string, unknown> | undefined)?.["at"]);
    if (at === 0 || nowMs - at > STALE_SENDING_MS) candidates.push(d);
  }

  for (const d of candidates) {
    if (Date.now() > deadline) return;
    report.email.processed += 1;
    const data = d.data() as MailDocData & {
      broadcastProgress?: { cursor?: unknown; sent?: unknown };
      delivery?: { attempts?: unknown } | null;
    };
    const message = mailMessageOf(data);
    if (!message) {
      await d.ref
        .set(
          {
            delivery: {
              state: "error",
              error: "Malformed mail doc",
              at: FieldValue.serverTimestamp(),
            },
          },
          { merge: true },
        )
        .catch(() => {});
      continue;
    }

    const isFresh = freshIds.has(d.id);
    if (isFresh) {
      const claim = await adminDb.runTransaction(async (tx) => {
        const fresh = await tx.get(d.ref);
        if (fresh.data()?.["delivery"]) return false;
        tx.update(d.ref, {
          delivery: { state: "sending", at: FieldValue.serverTimestamp(), provider: "resend" },
        });
        return true;
      });
      if (!claim) continue;
    }

    try {
      if (data.audience === "all") {
        const { sent } = await sendBroadcastEmails(
          adminDb,
          apiKey,
          from,
          replyTo,
          message,
          report,
          deadline,
          d.ref,
          data,
        );
        report.email.broadcastRecipients += sent;
        report.email.sent += sent;
        await d.ref.set(
          {
            delivery: {
              state: "sent",
              at: FieldValue.serverTimestamp(),
              provider: "resend",
              recipients: sent,
            },
          },
          { merge: true },
        );
      } else {
        const to = typeof data.to === "string" ? data.to.trim() : "";
        if (!validEmail(to)) throw new Error("Recipient email missing or invalid");
        await resendSendBatch(apiKey, from, replyTo, [to], message);
        report.email.sent += 1;
        await d.ref.set(
          { delivery: { state: "sent", at: FieldValue.serverTimestamp(), provider: "resend" } },
          { merge: true },
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (isRetryableMailError(msg)) {
        // Keep the claim: the stale-resume path retries after
        // STALE_SENDING_MS (this write also refreshes that window, pacing
        // retries at ~one per 5 minutes). attempts/lastError are for
        // inspection only.
        const attempts = Number(data.delivery?.attempts ?? 0) + 1;
        await d.ref
          .set(
            {
              delivery: {
                state: "sending",
                at: FieldValue.serverTimestamp(),
                provider: "resend",
                attempts,
                lastError: msg.slice(0, 300),
              },
            },
            { merge: true },
          )
          .catch(() => {});
        continue;
      }
      report.email.failed += 1;
      await d.ref
        .set(
          {
            delivery: {
              state: "error",
              at: FieldValue.serverTimestamp(),
              provider: "resend",
              error: msg.slice(0, 500),
            },
          },
          { merge: true },
        )
        .catch(() => {});
    }
  }
}

async function sendBroadcastEmails(
  adminDb: FirebaseFirestore.Firestore,
  apiKey: string,
  from: string,
  replyTo: string,
  message: { subject: string; text: string; html: string },
  report: TickReport,
  deadline: number,
  mailRef: FirebaseFirestore.DocumentReference,
  data: MailDocData & { broadcastProgress?: { cursor?: unknown; sent?: unknown } },
): Promise<{ sent: number }> {
  const { FieldValue, FieldPath } = await import("./firebase-admin");
  const progress = data.broadcastProgress;
  let cursor = typeof progress?.["cursor"] === "string" ? (progress["cursor"] as string) : "";
  let sent = Number(progress?.["sent"] ?? 0) || 0;

  const base = adminDb.collection("users").orderBy(FieldPath.documentId()).limit(200);
  let query: FirebaseFirestore.Query = cursor ? base.startAfter(cursor) : base;

  for (;;) {
    if (Date.now() > deadline) break;
    const snap = await query.get();
    if (snap.empty) break;
    const recipients: string[] = [];
    for (const u of snap.docs) {
      const v = u.data() as Record<string, unknown>;
      if (!validEmail(v["email"])) continue;
      const prefs = v["notifPrefs"] as Record<string, unknown> | undefined;
      if (prefs && prefs["email"] === false) continue;
      recipients.push(String(v["email"]).trim());
    }
    for (const batch of chunkArray(recipients, EMAIL_BATCH)) {
      if (Date.now() > deadline) break;
      try {
        await resendSendBatch(apiKey, from, replyTo, batch, message);
        sent += batch.length;
      } catch (err) {
        report.email.failed += 1;
        report.errors.push(`broadcast: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    const lastId = snap.docs[snap.docs.length - 1]?.id;
    if (!lastId) break;
    cursor = lastId;
    await mailRef
      .set(
        {
          broadcastProgress: { cursor, sent },
          delivery: { state: "sending", at: FieldValue.serverTimestamp() },
        },
        { merge: true },
      )
      .catch(() => {});
    if (snap.docs.length < 200) break;
    query = base.startAfter(cursor);
  }
  return { sent };
}

async function drainPushOutbox(
  adminDb: FirebaseFirestore.Firestore,
  report: TickReport,
  deadline: number,
): Promise<void> {
  const pub = (process.env["VAPID_PUBLIC_KEY"] || "").trim();
  const priv = (process.env["VAPID_PRIVATE_KEY"] || "").trim();
  const subject = (process.env["VAPID_SUBJECT"] || "").trim() || "mailto:admin@raffila.com";
  report.push.vapidSet = !!(pub && priv);
  if (!report.push.vapidSet) return;

  const webpush = (await import("web-push")).default;
  webpush.setVapidDetails(subject, pub, priv);

  const { FieldValue, FieldPath } = await import("./firebase-admin");
  const outboxSnap = await adminDb
    .collection("pushOutbox")
    .where("status", "in", ["pending", "sending"])
    .limit(8)
    .get();

  for (const box of outboxSnap.docs) {
    if (Date.now() > deadline) return;
    const claim = await adminDb.runTransaction(async (tx) => {
      const fresh = await tx.get(box.ref);
      const status = String(fresh.data()?.["status"] ?? "");
      if (status !== "pending" && status !== "sending") return null;
      if (status === "pending") tx.update(box.ref, { status: "sending" });
      return fresh.data() as Record<string, unknown>;
    });
    if (!claim) continue;
    report.push.processed += 1;

    const payload = JSON.stringify({
      title: String(claim["title"] ?? "Raffila"),
      body: String(claim["body"] ?? ""),
      url: String(claim["url"] ?? "/"),
    });
    let cursor = String(claim["cursor"] ?? "");
    let sent = Number(claim["sent"] ?? 0) || 0;
    let failed = Number(claim["failed"] ?? 0) || 0;
    let pruned = 0;
    let done = false;

    const subsBase = adminDb
      .collection("pushSubscriptions")
      .orderBy(FieldPath.documentId())
      .limit(PUSH_SUB_CHUNK);

    while (Date.now() <= deadline) {
      const query: FirebaseFirestore.Query = cursor ? subsBase.startAfter(cursor) : subsBase;
      const subs = await query.get();
      if (subs.empty) {
        done = true;
        break;
      }
      for (const group of chunkArray(subs.docs, PUSH_CONCURRENCY)) {
        await Promise.allSettled(
          group.map(async (subDoc) => {
            const s = subDoc.data() as Record<string, unknown>;
            const endpoint = String(s["endpoint"] ?? "");
            const keys = (s["keys"] ?? {}) as { p256dh?: unknown; auth?: unknown };
            if (!endpoint || !keys["p256dh"] || !keys["auth"]) {
              await subDoc.ref.delete().catch(() => {});
              pruned += 1;
              return "pruned" as const;
            }
            try {
              await webpush.sendNotification(
                { endpoint, keys: { p256dh: String(keys["p256dh"]), auth: String(keys["auth"]) } },
                payload,
                { TTL: 86400 },
              );
              sent += 1;
              return "sent" as const;
            } catch (err) {
              const status = (err as { statusCode?: number })?.statusCode ?? 0;
              if (status === 404 || status === 410 || status === 401 || status === 403) {
                await subDoc.ref.delete().catch(() => {});
                pruned += 1;
                return "pruned" as const;
              }
              failed += 1;
              return "failed" as const;
            }
          }),
        );
      }
      const lastDoc = subs.docs[subs.docs.length - 1];
      if (!lastDoc) {
        done = true;
        break;
      }
      cursor = lastDoc.id;
      await box.ref.set({ cursor, sent, failed }, { merge: true }).catch(() => {});
      if (subs.docs.length < PUSH_SUB_CHUNK) {
        done = true;
        break;
      }
    }

    report.push.sent += sent;
    report.push.failed += failed;
    report.push.pruned += pruned;
    if (done) {
      await box.ref.set(
        { status: "sent", sentAt: FieldValue.serverTimestamp(), sent, failed, cursor: "" },
        { merge: true },
      );
    }
  }
}

const TERMINAL_DRAW_STATUS = new Set(["CANCELLED", "DRAFT", "COMPLETED", "SUSPENDED"]);

async function scanDrawReminders(
  adminDb: FirebaseFirestore.Firestore,
  cfg: NotifyConfig,
  report: TickReport,
  origin: string,
  nowMs: number,
  deadline: number,
): Promise<void> {
  const { FieldPath, FieldValue } = await import("./firebase-admin");

  // Firestore `== null` only matches docs that literally contain null, never
  // docs missing the field — so page over competitions and filter in code.
  const PAGE = 200;
  const candidates: FirebaseFirestore.QueryDocumentSnapshot[] = [];
  let cursorId: string | null = null;
  for (;;) {
    if (Date.now() > deadline) break;
    let q: FirebaseFirestore.Query = adminDb
      .collection("competitions")
      .orderBy(FieldPath.documentId())
      .limit(PAGE);
    if (cursorId) q = q.startAfter(cursorId);
    const page = await q.get();
    for (const d of page.docs) {
      const data = d.data() as Record<string, unknown>;
      if (data["drawNotifiedAt"]) continue;
      candidates.push(d);
    }
    if (page.docs.length < PAGE) break;
    const last = page.docs[page.docs.length - 1];
    if (!last) break;
    cursorId = last.id;
  }
  const snap = { docs: candidates };
  report.draw.scanned = snap.docs.length;

  const leadMs = cfg.drawReminderMin * 60 * 1000;
  for (const d of snap.docs) {
    const data = d.data() as Record<string, unknown>;
    const status = String(data["status"] ?? "").toUpperCase();
    const terminal = TERMINAL_DRAW_STATUS.has(status) || status === "WINNER_SELECTED";
    const closeMs = readCloseMs(data);
    const stampOnly = terminal || closeMs <= 0 || nowMs > closeMs + DRAW_PAST_GRACE_MS;
    const due = !stampOnly && nowMs >= closeMs - leadMs;
    if (!stampOnly && !due) continue;

    const claim = await adminDb.runTransaction(async (tx) => {
      const fresh = await tx.get(d.ref);
      if (fresh.data()?.["drawNotifiedAt"]) return false;
      tx.update(d.ref, { drawNotifiedAt: FieldValue.serverTimestamp() });
      return true;
    });
    if (!claim) continue;
    if (!due) continue;

    const slug = d.id;
    const title = String(data["title"] ?? data["assetName"] ?? slug);
    const whenLabel = new Date(closeMs).toLocaleString("en-NG", {
      timeZone: "Africa/Lagos",
      weekday: "long",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      month: "short",
      day: "numeric",
    });
    const href = `/competitions/${encodeURIComponent(slug)}/draw`;
    const createdAt = FieldValue.serverTimestamp();
    const ids = broadcastIds("draw", slug);

    try {
      if (cfg.inappEnabled) {
        await adminDb
          .collection("notifications")
          .doc(ids.notification)
          .set(
            broadcastNotifDoc({
              category: "draw",
              title: "Draw time is here",
              body: `${title} — live draw at ${whenLabel}.`,
              href,
              createdAt,
            }),
            { merge: false },
          );
      }
    } catch (err) {
      report.errors.push(`draw notif ${slug}: ${err instanceof Error ? err.message : String(err)}`);
    }

    try {
      await adminDb
        .collection("pushOutbox")
        .doc(String(ids.push))
        .set(
          pushOutboxDoc({
            title: "Draw time is here",
            body: `${title} — the live draw is starting at ${whenLabel}.`,
            url: href,
            createdAt,
          }),
          { merge: false },
        );
    } catch (err) {
      report.errors.push(`draw push ${slug}: ${err instanceof Error ? err.message : String(err)}`);
    }

    if (cfg.emailEnabled) {
      try {
        const { drawReminderEmail } = await import("./notify");
        const originUrl = origin;
        await adminDb
          .collection("mail")
          .doc(String(ids.mail))
          .set(
            broadcastMailDoc({
              kind: "draw_broadcast",
              message: drawReminderEmail({ title, slug, whenLabel, origin: originUrl }),
              createdAt,
            }),
            { merge: false },
          );
      } catch (err) {
        report.errors.push(
          `draw mail ${slug}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    report.draw.fired += 1;
  }
}

export async function runNotifyTick(opts: {
  origin: string;
  budgetMs?: number;
  nowMs?: number;
}): Promise<TickReport> {
  const started = Date.now();
  const deadline = started + (opts.budgetMs ?? 22000);
  const nowMs = opts.nowMs ?? started;
  const report: TickReport = {
    ok: true,
    now: new Date(nowMs).toISOString(),
    durationMs: 0,
    email: { apiKeySet: false, from: "", processed: 0, sent: 0, failed: 0, broadcastRecipients: 0 },
    push: { vapidSet: false, processed: 0, sent: 0, failed: 0, pruned: 0 },
    draw: { scanned: 0, fired: 0 },
    errors: [],
  };

  try {
    const { getAdminDb } = await import("./firebase-admin");
    const adminDb = getAdminDb();
    report.email.apiKeySet = !!(process.env["RESEND_API_KEY"] || "").trim();

    const cfg = await readNotifyConfig(adminDb);

    try {
      await drainMail(adminDb, cfg, report, deadline);
    } catch (err) {
      report.errors.push(`mail: ${err instanceof Error ? err.message : String(err)}`);
    }
    try {
      await drainPushOutbox(adminDb, report, deadline);
    } catch (err) {
      report.errors.push(`push: ${err instanceof Error ? err.message : String(err)}`);
    }
    try {
      await scanDrawReminders(adminDb, cfg, report, opts.origin, nowMs, deadline);
    } catch (err) {
      report.errors.push(`draw: ${err instanceof Error ? err.message : String(err)}`);
    }
  } catch (err) {
    report.ok = false;
    report.errors.push(`init: ${err instanceof Error ? err.message : String(err)}`);
  }

  report.durationMs = Date.now() - started;
  return report;
}

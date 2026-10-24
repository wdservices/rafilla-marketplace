import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import { db } from "./firebase";
import { getSession } from "./auth-store";
import { getEmailDocKey, normalizeEmail } from "./user-validation";

export const ACTIVITY_EVENTS = [
  "AUTH_LOGIN",
  "AUTH_REGISTER",
  "AUTH_LOGOUT",
  "AUTH_PASSWORD_CHANGE",
  "AUTH_PASSWORD_RESET",
  "AUTH_2FA_ENABLE",
  "AUTH_2FA_DISABLE",
  "ADMIN_INVITE",
  "TICKET_PURCHASE",
  "TICKET_REFUND",
  "PAYOUT_INITIATE",
  "PAYOUT_COMPLETE",
  "PAYOUT_FAIL",
  "PAYOUT_REVERSE",
  "WALLET_FUND",
  "WALLET_ADJUST",
  "CONFIG_CHANGE",
  "USER_CREATE",
  "USER_UPDATE",
  "USER_SUSPEND",
  "USER_ACTIVATE",
  "USER_DELETE",
  "PARTNER_APPROVE",
  "PARTNER_REJECT",
  "PARTNER_INVITE",
  "COMPETITION_CREATE",
  "COMPETITION_UPDATE",
  "COMPETITION_DRAW",
  "COMPETITION_CANCEL",
  "COMPETITION_DELETE",
  "NOTIFICATION_SEND",
  "REFERRAL_PAY",
  "FRAUD_FLAG",
  "FRAUD_RESOLVE",
] as const;

export type ActivityEventType = (typeof ACTIVITY_EVENTS)[number];
export type ActivityRisk = "low" | "medium" | "high" | "critical";

const RISK_BY_EVENT: Record<ActivityEventType, ActivityRisk> = {
  AUTH_LOGIN: "low",
  AUTH_REGISTER: "low",
  AUTH_LOGOUT: "low",
  AUTH_PASSWORD_CHANGE: "medium",
  AUTH_PASSWORD_RESET: "medium",
  AUTH_2FA_ENABLE: "medium",
  AUTH_2FA_DISABLE: "high",
  ADMIN_INVITE: "medium",
  TICKET_PURCHASE: "medium",
  TICKET_REFUND: "medium",
  PAYOUT_INITIATE: "high",
  PAYOUT_COMPLETE: "high",
  PAYOUT_FAIL: "high",
  PAYOUT_REVERSE: "critical",
  WALLET_FUND: "medium",
  WALLET_ADJUST: "high",
  CONFIG_CHANGE: "high",
  USER_CREATE: "medium",
  USER_UPDATE: "low",
  USER_SUSPEND: "high",
  USER_ACTIVATE: "medium",
  USER_DELETE: "critical",
  PARTNER_APPROVE: "medium",
  PARTNER_REJECT: "medium",
  PARTNER_INVITE: "low",
  COMPETITION_CREATE: "medium",
  COMPETITION_UPDATE: "medium",
  COMPETITION_DRAW: "high",
  COMPETITION_CANCEL: "critical",
  COMPETITION_DELETE: "critical",
  NOTIFICATION_SEND: "low",
  REFERRAL_PAY: "medium",
  FRAUD_FLAG: "high",
  FRAUD_RESOLVE: "medium",
};

export interface ActivityActor {
  id?: string;
  email?: string;
  name?: string;
  role?: string;
}

export interface LogActivityInput {
  eventType: ActivityEventType;
  /** Overrides the signed-in session user. */
  actor?: ActivityActor;
  targetType?: string;
  targetId?: string;
  /** Short human-readable line, e.g. "Funded wallet with ₦25,000". */
  summary?: string;
  /** Extra structured context (amounts, refs, changed fields…). */
  details?: Record<string, unknown>;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  riskLevel?: ActivityRisk;
}

/** Strip the local `firebase_` session prefix so rules can match raw Auth UIDs. */
function normalizeActorId(id?: string): string {
  if (!id) return "anonymous";
  return id.startsWith("firebase_") ? id.slice("firebase_".length) : id;
}

/**
 * Append an activity record to the `activityLogs` Firestore collection.
 * Never throws — logging must never break the user flow.
 */
export async function logActivity(input: LogActivityInput): Promise<void> {
  try {
    const sessionUser = getSession()?.user;
    const actorId = normalizeActorId(input.actor?.id ?? sessionUser?.id);
    const email = input.actor?.email ?? sessionUser?.email ?? "";
    const name =
      input.actor?.name ??
      [sessionUser?.firstName, sessionUser?.lastName].filter(Boolean).join(" ") ??
      "";
    const role = input.actor?.role ?? sessionUser?.role ?? "anonymous";

    await addDoc(collection(db, "activityLogs"), {
      eventType: input.eventType,
      riskLevel: input.riskLevel ?? RISK_BY_EVENT[input.eventType] ?? "low",
      actorId,
      actorEmail: email,
      actorName: name || sessionUser?.handle || email.split("@")[0] || "anonymous",
      actorRole: role,
      targetType: input.targetType ?? "",
      targetId: input.targetId ?? "",
      summary: input.summary ?? "",
      details: input.details ?? {},
      oldValue: input.oldValue ?? null,
      newValue: input.newValue ?? null,
      clientAt: new Date().toISOString(),
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn("Activity log write failed:", err);
  }
}

/**
 * Admin invites let an existing admin grant access to an email that has no
 * Raffila account yet. The invite is stored in Firestore (`adminInvites`)
 * and consumed automatically on that email's first sign-in/registration.
 */
export function adminInviteKey(email: string): string {
  return getEmailDocKey(normalizeEmail(email));
}

export async function sendAdminInvite(
  email: string,
  invitedBy: { id?: string; email?: string; name?: string },
): Promise<{ emailed: boolean }> {
  const clean = normalizeEmail(email);
  if (!clean || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
    throw new Error("Enter a valid email address.");
  }
  await setDoc(doc(db, "adminInvites", adminInviteKey(clean)), {
    email: clean,
    invitedBy: invitedBy.email || "",
    invitedById: invitedBy.id || "",
    createdAt: serverTimestamp(),
  });
  await logActivity({
    eventType: "ADMIN_INVITE",
    actor: invitedBy,
    targetType: "admin_invite",
    targetId: clean,
    summary: `Invited ${clean} as administrator`,
  });

  const origin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "https://raffila.com";
  const inviter = invitedBy.name || invitedBy.email || "A Raffila administrator";

  // Primary path: EmailJS (client-side, no Firebase billing needed).
  const emailState = await sendInviteEmailViaEmailJS({
    to: clean,
    inviter,
    origin,
  });
  const emailed = emailState === "sent";

  // Backup path: mail queue for the Trigger Email extension / a future
  // Cloud Function. Only used when EmailJS is configured but failed.
  if (emailState === "failed") {
    try {
      await addDoc(collection(db, "mail"), {
        to: clean,
        delivery: null,
        createdAt: serverTimestamp(),
        message: {
          subject: "You're invited to administer Raffila",
          text: `${inviter} has invited you to become an administrator on Raffila.\n\nTo accept:\n1. Go to ${origin}/auth\n2. Sign in or create your account with this exact email address (${clean})\n3. You will land directly on the admin dashboard with full access.\n\nIf you weren't expecting this, you can safely ignore it — nothing changes until you sign in.`,
          html: `<p>${inviter} has invited you to become an <strong>administrator</strong> on Raffila.</p><ol><li>Go to <a href="${origin}/auth">${origin}/auth</a></li><li>Sign in or create your account with this exact email address (<strong>${clean}</strong>)</li><li>You will land directly on the admin dashboard with full access.</li></ol><p>If you weren't expecting this, you can safely ignore it — nothing changes until you sign in.</p>`,
        },
      });
    } catch (err) {
      console.warn("Invite email not queued:", err);
    }
  }
  return { emailed };
}

/**
 * Send the admin invitation through EmailJS (free tier, no backend needed).
 * Returns "sent" | "failed" | "skipped" (keys not configured).
 */
async function sendInviteEmailViaEmailJS(opts: {
  to: string;
  inviter: string;
  origin: string;
}): Promise<"sent" | "failed" | "skipped"> {
  try {
    const env =
      typeof import.meta !== "undefined"
        ? ((import.meta as any).env as Record<string, string | undefined>)
        : undefined;
    const publicKey = env?.["VITE_EMAILJS_PUBLIC_KEY"];
    const serviceId = env?.["VITE_EMAILJS_SERVICE_ID"];
    const templateId = env?.["VITE_EMAILJS_TEMPLATE_ID"];
    if (!publicKey || !serviceId || !templateId) return "skipped";
    const { default: emailjs } = await import("@emailjs/browser");
    await emailjs.send(
      serviceId,
      templateId,
      {
        email: opts.to,
        to_email: opts.to,
        inviter: opts.inviter,
        signin_url: `${opts.origin}/auth`,
        app_name: "Raffila",
      },
      { publicKey },
    );
    return "sent";
  } catch (err) {
    console.warn("EmailJS send failed:", err);
    return "failed";
  }
}

export async function cancelAdminInvite(email: string): Promise<void> {
  const clean = normalizeEmail(email);
  await deleteDoc(doc(db, "adminInvites", adminInviteKey(clean)));
  await logActivity({
    eventType: "ADMIN_INVITE",
    targetType: "admin_invite",
    targetId: clean,
    summary: `Cancelled admin invite for ${clean}`,
  });
}

/**
 * If `email` has a pending admin invite, apply admin rights to `uid`,
 * consume the invite, and log it. Returns true when applied. Never throws.
 */
export async function consumeAdminInvite(email: string, uid: string): Promise<boolean> {
  try {
    const clean = normalizeEmail(email);
    if (!clean || !uid) return false;
    const ref = doc(db, "adminInvites", adminInviteKey(clean));
    const snap = await getDoc(ref);
    if (!snap.exists()) return false;
    const data = snap.data() as Record<string, unknown>;
    if ((data["email"] as string) !== clean) return false;
    await setDoc(
      doc(db, "users", uid),
      { role: "admin", isAdmin: true, verified: true, email: clean },
      { merge: true },
    );
    await deleteDoc(ref).catch(() => {});
    await logActivity({
      eventType: "ADMIN_INVITE",
      actor: { id: uid, email: clean },
      targetType: "user",
      targetId: uid,
      summary: `Accepted admin invite (${clean})`,
    });
    return true;
  } catch (err) {
    console.warn("Admin invite check failed:", err);
    return false;
  }
}

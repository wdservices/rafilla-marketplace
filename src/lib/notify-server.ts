import { createServerFn } from "@tanstack/react-start";

import { welcomeEmail } from "./notify";

/** Origin used for links inside server-generated emails. */
export function serverOrigin(): string {
  const env = typeof process !== "undefined" ? (process.env["SITE_ORIGIN"] || "").trim() : "";
  return env || "https://raffila.com";
}

function sanitizeOrigin(origin: string): string {
  try {
    const u = new URL(origin);
    if (u.protocol === "http:" || u.protocol === "https:") return u.origin;
  } catch {
    // fall through
  }
  return "";
}

export const queueWelcomeEmail = createServerFn({ method: "POST" })
  .validator((input: { uid: string; email: string; firstName?: string; origin?: string }) => input)
  .handler(async ({ data }): Promise<{ queued: boolean }> => {
    const uid = (data.uid || "").trim();
    const email = (data.email || "").trim();
    if (!uid || !email) return { queued: false };

    const { getAdminDb, FieldValue } = await import("./firebase-admin");
    const adminDb = getAdminDb();
    const { welcomeIds } = await import("./notify");
    const ids = welcomeIds(uid);

    const mailRef = adminDb.collection("mail").doc(ids.mail);
    const existing = await mailRef.get().catch(() => null);
    if (existing?.exists) return { queued: false };

    const createdAt = FieldValue.serverTimestamp();
    const origin = sanitizeOrigin(data.origin || "") || serverOrigin();
    const message = welcomeEmail({ firstName: data.firstName || "", origin });
    await mailRef.set({ uid, kind: "welcome", message, createdAt, delivery: null });
    await adminDb
      .collection("notifications")
      .doc(ids.notification)
      .set({
        userId: uid,
        category: "welcome",
        title: "Welcome to Raffila",
        body: "Your account is ready — browse open competitions and enter your first draw.",
        href: "/competitions",
        createdAt,
      })
      .catch(() => {});
    return { queued: true };
  });

export const getVapidPublicKey = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ key: string }> => {
    const key = (process.env["VAPID_PUBLIC_KEY"] || "").trim();
    return { key };
  },
);

export const registerPushDevice = createServerFn({ method: "POST" })
  .validator((input: { uid: string; subscription: PushSubscriptionJSON }) => input)
  .handler(async ({ data }): Promise<{ ok: boolean; error?: string }> => {
    const uid = (data.uid || "").trim();
    const sub = data.subscription;
    if (!uid) return { ok: false, error: "Missing user reference" };
    if (!sub?.endpoint || !sub.keys?.["p256dh"] || !sub.keys?.["auth"]) {
      return { ok: false, error: "Invalid push subscription" };
    }

    const { getAdminDb, FieldValue } = await import("./firebase-admin");
    const adminDb = getAdminDb();
    const docId = Buffer.from(sub.endpoint, "utf8").toString("base64url").slice(0, 1200);
    const now = FieldValue.serverTimestamp();
    await adminDb
      .collection("pushSubscriptions")
      .doc(docId)
      .set({
        userId: uid,
        endpoint: sub.endpoint,
        expirationTime: sub.expirationTime ?? null,
        keys: { p256dh: sub.keys["p256dh"], auth: sub.keys["auth"] },
        createdAt: now,
        updatedAt: now,
      });
    return { ok: true };
  });

export const unregisterPushDevice = createServerFn({ method: "POST" })
  .validator((input: { uid: string; endpoint: string }) => input)
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    const endpoint = (data.endpoint || "").trim();
    if (!endpoint) return { ok: false };
    const { getAdminDb } = await import("./firebase-admin");
    const adminDb = getAdminDb();
    const docId = Buffer.from(endpoint, "utf8").toString("base64url").slice(0, 1200);
    await adminDb
      .collection("pushSubscriptions")
      .doc(docId)
      .delete()
      .catch(() => {});
    return { ok: true };
  });

import { getVapidPublicKey, registerPushDevice, unregisterPushDevice } from "@/lib/notify-server";

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

export function pushPermission(): NotificationPermission | "unsupported" {
  if (!pushSupported()) return "unsupported";
  return Notification.permission;
}

export async function ensureServiceWorker(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

export async function isPushEnabled(): Promise<boolean> {
  if (!pushSupported() || Notification.permission !== "granted") return false;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    return Boolean(sub);
  } catch {
    return false;
  }
}

export async function enablePush(uid: string): Promise<{ ok: boolean; error?: string }> {
  if (!pushSupported()) {
    return { ok: false, error: "This browser does not support device notifications." };
  }
  const perm = await Notification.requestPermission();
  if (perm !== "granted") {
    return { ok: false, error: "Notification permission was denied." };
  }
  try {
    const reg = await ensureServiceWorker();
    const { key } = await getVapidPublicKey();
    if (!key) return { ok: false, error: "Notifications are not configured on the server." };
    const existing = await reg.pushManager.getSubscription();
    const sub =
      existing ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      }));
    await registerPushDevice({ data: { uid, subscription: sub.toJSON() } });
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not enable notifications.",
    };
  }
}

export async function disablePush(uid: string): Promise<{ ok: boolean; error?: string }> {
  if (!pushSupported()) return { ok: true };
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await unregisterPushDevice({ data: { uid, endpoint: sub.endpoint } });
      await sub.unsubscribe();
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not disable notifications.",
    };
  }
}

import { collection, doc, onSnapshot, query, updateDoc, where } from "firebase/firestore";

import { db } from "./firebase";
import { toMs } from "./doc-values";

export interface UserNotification {
  id: string;
  userId: string;
  category: string;
  title: string;
  body: string;
  href: string;
  createdAtMs: number;
  read: boolean;
}

function broadcastReadKey(uid: string): string {
  return `raffila:notif-read:${uid}`;
}

function readBroadcastIds(uid: string): Set<string> {
  try {
    const raw = window.localStorage.getItem(broadcastReadKey(uid));
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function writeBroadcastIds(uid: string, ids: Set<string>) {
  try {
    window.localStorage.setItem(broadcastReadKey(uid), JSON.stringify(Array.from(ids).slice(-500)));
  } catch {
    // storage unavailable — counts degrade gracefully
  }
}

export function markBroadcastRead(uid: string, id: string) {
  const ids = readBroadcastIds(uid);
  ids.add(id);
  writeBroadcastIds(uid, ids);
}

function toNotif(
  id: string,
  raw: Record<string, unknown>,
  readIds: Set<string>,
): UserNotification | null {
  const userId = typeof raw["userId"] === "string" ? (raw["userId"] as string) : "";
  const title = typeof raw["title"] === "string" ? (raw["title"] as string) : "";
  if (!title) return null;
  const readAt = raw["readAt"];
  const isBroadcast = userId === "";
  return {
    id,
    userId,
    category: typeof raw["category"] === "string" ? (raw["category"] as string) : "system",
    title,
    body: typeof raw["body"] === "string" ? (raw["body"] as string) : "",
    href: typeof raw["href"] === "string" ? (raw["href"] as string) : "/",
    createdAtMs: toMs(raw["createdAt"]),
    read: isBroadcast ? readIds.has(id) : Boolean(readAt),
  };
}

const MAX_ITEMS = 60;

export function listenUserNotifications(
  uid: string,
  cb: (items: UserNotification[]) => void,
): () => void {
  const readIds = readBroadcastIds(uid);
  let personal: UserNotification[] = [];
  let broadcast: UserNotification[] = [];

  const emit = () => {
    const merged = [...personal, ...broadcast].sort((a, b) => b.createdAtMs - a.createdAtMs);
    cb(merged.slice(0, MAX_ITEMS));
  };

  const personalQ = query(collection(db, "notifications"), where("userId", "==", uid));
  const broadcastQ = query(collection(db, "notifications"), where("userId", "==", ""));

  const stopPersonal = onSnapshot(
    personalQ,
    (snap) => {
      personal = snap.docs
        .map((d) => toNotif(d.id, d.data() as Record<string, unknown>, readIds))
        .filter((n): n is UserNotification => n !== null);
      emit();
    },
    () => {
      // permission errors degrade to broadcast-only feed
      personal = [];
      emit();
    },
  );
  const stopBroadcast = onSnapshot(
    broadcastQ,
    (snap) => {
      broadcast = snap.docs
        .map((d) => toNotif(d.id, d.data() as Record<string, unknown>, readIds))
        .filter((n): n is UserNotification => n !== null);
      emit();
    },
    () => {
      broadcast = [];
      emit();
    },
  );

  return () => {
    stopPersonal();
    stopBroadcast();
  };
}

export async function markNotificationRead(uid: string, n: UserNotification): Promise<void> {
  if (n.read) return;
  if (n.userId === "") {
    markBroadcastRead(uid, n.id);
    return;
  }
  try {
    await updateDoc(doc(db, "notifications", n.id), { readAt: new Date().toISOString() });
  } catch {
    // best-effort
  }
}

export async function markAllNotificationsRead(
  uid: string,
  items: UserNotification[],
): Promise<void> {
  const ids = readBroadcastIds(uid);
  const updates: Promise<void>[] = [];
  for (const n of items) {
    if (n.read) continue;
    if (n.userId === "") {
      ids.add(n.id);
    } else {
      updates.push(
        updateDoc(doc(db, "notifications", n.id), { readAt: new Date().toISOString() }).catch(
          () => {},
        ),
      );
    }
  }
  writeBroadcastIds(uid, ids);
  await Promise.allSettled(updates);
}

export interface NotifPrefs {
  email: boolean;
  inapp: boolean;
}

export const DEFAULT_NOTIF_PREFS: NotifPrefs = { email: true, inapp: true };

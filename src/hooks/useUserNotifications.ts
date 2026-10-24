import { useCallback, useEffect, useMemo, useState } from "react";

import {
  listenUserNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type UserNotification,
} from "@/lib/user-notifications";

export function useUserNotifications(uid: string | null | undefined) {
  const [items, setItems] = useState<UserNotification[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!uid) {
      setItems([]);
      setReady(true);
      return;
    }
    setReady(false);
    const stop = listenUserNotifications(uid, (next) => {
      setItems(next);
      setReady(true);
    });
    return stop;
  }, [uid]);

  const unreadCount = useMemo(() => items.filter((n) => !n.read).length, [items]);

  const markRead = useCallback(
    (n: UserNotification) => {
      if (!uid || n.read) return;
      markNotificationRead(uid, n);
      setItems((prev) => prev.map((it) => (it.id === n.id ? { ...it, read: true } : it)));
    },
    [uid],
  );

  const markAll = useCallback(() => {
    if (!uid || items.every((n) => n.read)) return;
    void markAllNotificationsRead(uid, items);
    setItems((prev) => prev.map((it) => ({ ...it, read: true })));
  }, [uid, items]);

  return { items, unreadCount, ready, markRead, markAll };
}

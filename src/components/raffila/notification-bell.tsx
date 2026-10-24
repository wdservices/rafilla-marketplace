import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Bell,
  CheckCheck,
  Gift,
  Inbox,
  Mail,
  MailOpen,
  Radio,
  Receipt,
  Sparkles,
  TrendingUp,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { toast } from "sonner";

import { useAuthSession } from "@/hooks/useAuthSession";
import { useUserNotifications } from "@/hooks/useUserNotifications";
import { db } from "@/lib/firebase";
import { lagosRelativeTime } from "@/lib/format";
import { disablePush, enablePush, isPushEnabled, pushSupported } from "@/lib/push";
import type { NotifPrefs } from "@/lib/user-notifications";
import { cn } from "@/lib/utils";

const CATEGORY_ICON: Record<string, LucideIcon> = {
  welcome: Sparkles,
  receipt: Receipt,
  milestone: TrendingUp,
  draw: Radio,
  winner: Trophy,
  system: Inbox,
};

const CATEGORY_ACCENT: Record<string, string> = {
  welcome: "bg-mint/15 text-emerald-700",
  receipt: "bg-coral/10 text-coral",
  milestone: "bg-amber-100 text-amber-700",
  draw: "bg-sky-100 text-sky-700",
  winner: "bg-violet-100 text-violet-700",
  system: "bg-ink/10 text-ink/70",
};

function sessionIdToUid(id: string | undefined | null): string | null {
  if (!id) return null;
  return id.startsWith("firebase_") ? id.replace("firebase_", "") : id;
}

function ToggleChip({
  label,
  on,
  busy,
  onToggle,
}: {
  label: string;
  on: boolean;
  busy: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={busy}
      aria-pressed={on}
      className={cn(
        "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 transition-colors disabled:opacity-60",
        on
          ? "bg-mint/20 text-emerald-800 ring-mint/60 hover:bg-mint/30"
          : "bg-ink/5 text-ink/50 ring-ink/15 hover:bg-ink/10",
      )}
    >
      <span className={cn("size-1.5 rounded-full", on ? "bg-emerald-600" : "bg-ink/30")} />
      {label}
    </button>
  );
}

/**
 * In-app notification feed with unread badge, per-user email/in-app prefs, and
 * a web-push opt-in. Rendered by every signed-in surface (site header, both
 * dashboard shells, partner shell).
 */
export function NotificationBell({ className }: { className?: string }) {
  const { user } = useAuthSession();
  const uid = useMemo(() => sessionIdToUid(user?.id), [user?.id]);
  const { items, markRead } = useUserNotifications(uid);
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState<NotifPrefs | null>(null);
  const [pushOn, setPushOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      doc(db, "users", uid),
      (snap) => {
        const raw = (snap.data() as Record<string, unknown> | undefined)?.["notifPrefs"];
        const p = (raw ?? {}) as Partial<NotifPrefs>;
        setPrefs({ email: p.email !== false, inapp: p.inapp !== false });
      },
      () => setPrefs({ email: true, inapp: true }),
    );
  }, [uid]);

  useEffect(() => {
    if (!open) return;
    void isPushEnabled().then(setPushOn);
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const visible = prefs?.inapp === false ? items.filter((n) => n.userId !== "") : items;
  const unreadCount = visible.filter((n) => !n.read).length;

  const setPref = async (key: "email" | "inapp", value: boolean) => {
    if (!uid) return;
    setPrefs((p) => (p ? { ...p, [key]: value } : p));
    try {
      await updateDoc(doc(db, "users", uid), { [`notifPrefs.${key}`]: value });
    } catch {
      setPrefs((p) => (p ? { ...p, [key]: !value } : p));
      toast.error("Could not save your preference.");
    }
  };

  const togglePush = async () => {
    if (!uid || busy) return;
    setBusy(true);
    try {
      if (pushOn) {
        const res = await disablePush(uid);
        if (res.ok) {
          setPushOn(false);
          toast.success("Device notifications turned off.");
        } else {
          toast.error(res.error ?? "Could not turn off notifications.");
        }
      } else {
        const res = await enablePush(uid);
        if (res.ok) {
          setPushOn(true);
          toast.success("Device notifications on — draw alerts will reach this device.");
        } else {
          toast.error(res.error ?? "Could not enable notifications.");
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const openItem = (n: (typeof visible)[number]) => {
    markRead(n);
    setOpen(false);
    if (n.href) void navigate({ to: n.href as never });
  };

  if (!uid) return null;

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
        data-testid="notification-bell"
        className={cn(
          "relative grid size-10 shrink-0 place-items-center rounded-full bg-white text-ink ring-1 transition-colors",
          open ? "ring-coral/50" : "ring-ink/10 hover:ring-coral/40",
        )}
      >
        <Bell className="size-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-coral px-1 py-0.5 font-display text-[10px] font-extrabold leading-none text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          data-testid="notification-panel"
          className="absolute right-0 top-full z-50 mt-2 w-[min(92vw,380px)] overflow-hidden rounded-3xl bg-white text-ink shadow-2xl ring-1 ring-ink/10"
        >
          <div className="flex items-center justify-between border-b border-ink/10 px-4 py-3">
            <p className="font-display text-sm font-extrabold">Notifications</p>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  for (const n of visible) markRead(n);
                }}
                className="flex items-center gap-1 text-[11px] font-bold text-coral hover:underline"
              >
                <CheckCheck className="size-3.5" /> Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[55vh] overflow-y-auto">
            {visible.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <Gift className="mx-auto mb-3 size-8 text-ink/25" />
                <p className="font-display text-sm font-extrabold text-ink/70">Nothing here yet</p>
                <p className="mt-1 text-xs text-ink/50">
                  Receipts, draw alerts and winner news will land here.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-ink/5">
                {visible.map((n) => {
                  const Icon = CATEGORY_ICON[n.category] ?? Inbox;
                  const accent = CATEGORY_ACCENT[n.category] ?? CATEGORY_ACCENT["system"] ?? "";
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => openItem(n)}
                        className={cn(
                          "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-ink/[0.03]",
                          !n.read && "bg-coral/[0.04]",
                        )}
                      >
                        <span
                          className={cn(
                            "mt-0.5 grid size-8 shrink-0 place-items-center rounded-full",
                            accent,
                          )}
                        >
                          <Icon className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="truncate font-display text-[13px] font-extrabold">
                              {n.title}
                            </span>
                            {!n.read && (
                              <span className="size-1.5 shrink-0 rounded-full bg-coral" />
                            )}
                          </span>
                          <span className="mt-0.5 block text-xs leading-snug text-ink/60 line-clamp-2">
                            {n.body}
                          </span>
                          <span className="mt-1 block text-[10px] font-bold uppercase tracking-wide text-ink/40">
                            {lagosRelativeTime(n.createdAtMs)}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="border-t border-ink/10 bg-cream/60 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wide text-ink/45">
                Send me
              </span>
              <ToggleChip
                label="Email"
                on={prefs?.email !== false}
                busy={busy}
                onToggle={() => void setPref("email", !(prefs?.email !== false))}
              />
              <ToggleChip
                label="In-app"
                on={prefs?.inapp !== false}
                busy={busy}
                onToggle={() => void setPref("inapp", !(prefs?.inapp !== false))}
              />
              {pushSupported() && (
                <ToggleChip
                  label="Device push"
                  on={pushOn}
                  busy={busy}
                  onToggle={() => void togglePush()}
                />
              )}
            </div>
            <p className="mt-2 flex items-center gap-1 text-[10px] text-ink/45">
              {pushOn ? (
                <>
                  <MailOpen className="size-3" /> Draw & winner alerts on this device.
                </>
              ) : (
                <>
                  <Mail className="size-3" /> Device push fires for draws and winners only.
                </>
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

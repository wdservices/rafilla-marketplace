import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useAuthActions } from "@/hooks/useAuthSession";
import { fetchFeatureFlags, NAV_FEATURE_KEY } from "@/lib/platform-config";
import {
  LayoutDashboard,
  Trophy,
  Wallet,
  Ticket,
  ReceiptText,
  Users,
  UserCircle2,
  ShieldCheck,
  LogOut,
  Menu,
  X,
  Home,
  User,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { CartButton } from "@/components/raffila/cart/cart-button";
import { NotificationBell } from "@/components/raffila/notification-bell";
import { cn } from "@/lib/utils";

type NavItem = {
  label: string;
  icon: ReactNode;
  to: string;
  key: string;
};

const desktopNavItems: NavItem[] = [
  {
    label: "Overview",
    icon: <LayoutDashboard className="size-5" />,
    to: "/dashboard",
    key: "Overview",
  },
  {
    label: "Competitions",
    icon: <Trophy className="size-5" />,
    to: "/competitions",
    key: "Competitions",
  },
  {
    label: "Entries",
    icon: <Ticket className="size-5" />,
    to: "/dashboard/entries",
    key: "Entries",
  },
  {
    label: "Transactions",
    icon: <ReceiptText className="size-5" />,
    to: "/dashboard/transactions",
    key: "Transactions",
  },
  {
    label: "Referrals",
    icon: <Users className="size-5" />,
    to: "/dashboard/referrals",
    key: "Referrals",
  },
  {
    label: "Profile",
    icon: <UserCircle2 className="size-5" />,
    to: "/dashboard/profile",
    key: "Profile",
  },
];

const bottomNavItems: NavItem[] = [
  {
    label: "Home",
    icon: <Home className="size-5" />,
    to: "/dashboard",
    key: "Overview",
  },
  {
    label: "Competitions",
    icon: <Trophy className="size-5" />,
    to: "/competitions",
    key: "Competitions",
  },
  {
    label: "Entries",
    icon: <Ticket className="size-5" />,
    to: "/dashboard/entries",
    key: "Entries",
  },
  {
    label: "Account",
    icon: <User className="size-5" />,
    to: "/dashboard/profile",
    key: "Profile",
  },
];

export function DashboardShell({
  children,
  activeNav,
}: {
  children: ReactNode;
  activeNav?: string;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { signOut } = useAuthActions();
  const [features, setFeatures] = useState<Record<string, boolean> | null>(null);

  // Same kill-switch as DashboardAppShell: Admin → Settings → Feature availability.
  useEffect(() => {
    let cancelled = false;
    fetchFeatureFlags()
      .then((f) => {
        if (!cancelled) setFeatures(f);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const gateItems = useCallback(
    (items: NavItem[]) =>
      items.filter((item) => {
        const key = NAV_FEATURE_KEY[item.label];
        if (!key) return true;
        if (!features) return true;
        return features[key] !== false;
      }),
    [features],
  );
  const visibleDesktopItems = useMemo(() => gateItems(desktopNavItems), [gateItems]);
  const visibleBottomItems = useMemo(() => gateItems(bottomNavItems), [gateItems]);

  const handleLogout = () => signOut({ to: "/auth" });

  const activeKey = activeNav ?? "";

  return (
    <div className="min-h-screen bg-paper/60">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden w-[268px] flex-col border-r border-ink/5 bg-white lg:flex",
          "rounded-r-[32px] ring-1 ring-ink/5 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.25)]",
        )}
      >
        <div className="flex items-center gap-3 p-6 pb-5">
          <img
            src="/Raffila-logo.png"
            alt=""
            className="size-11 shrink-0 rounded-2xl shadow-sm"
            width={44}
            height={44}
          />
          <div>
            <span className="block font-display text-xl font-extrabold tracking-tight text-ink leading-tight">
              Raffila
            </span>
            <span className="block text-[11px] font-bold text-ink/45">Dashboard</span>
          </div>
        </div>

        <div className="px-3.5 pb-4">
          <div className="flex items-center gap-3 rounded-2xl bg-cream/60 p-3 ring-1 ring-ink/5">
            <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-coral text-white shadow-[0_8px_18px_-10px_var(--coral)] font-display text-sm font-extrabold">
              TA
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-extrabold text-ink leading-tight">
                Tunmise Adebayo
              </p>
              <p className="truncate text-[11px] font-bold text-ink/45 leading-snug">
                t***@********
              </p>
              <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-coral/10 px-2 py-0.5 text-[10px] font-extrabold text-coral">
                <ShieldCheck className="size-3" /> Verified
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {visibleDesktopItems.map((item) => {
            const isActive = activeKey === item.key;
            return (
              <Link
                key={item.key}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-extrabold transition-all",
                  isActive
                    ? "bg-coral text-white shadow-[0_8px_24px_-10px_var(--coral)] ring-1 ring-coral/30"
                    : "text-ink/70 hover:bg-ink/5 hover:text-ink",
                )}
              >
                <span
                  className={cn(
                    "grid size-8 place-items-center rounded-xl transition-colors",
                    isActive ? "bg-white/15 text-white" : "bg-coral/10 text-coral",
                  )}
                >
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3.5 space-y-2">
          <button
            onClick={handleLogout}
            aria-label="Log out of dashboard"
            className="flex w-full items-center justify-center gap-2 rounded-full bg-coral px-3 py-2.5 text-sm font-extrabold text-white shadow-sm transition-colors hover:bg-coral/90"
          >
            <LogOut className="size-4" />
            Log out / Exit
          </button>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-extrabold text-ink/70 transition-colors hover:bg-ink/5 hover:text-ink"
          >
            <LogOut className="size-4 text-coral" />
            Log out
          </button>
        </div>
      </aside>

      <div
        className={cn(
          "fixed inset-0 z-50 bg-ink/40 lg:hidden",
          mobileMenuOpen ? "block" : "hidden",
        )}
        onClick={() => setMobileMenuOpen(false)}
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-80 rounded-r-[32px] bg-white ring-1 ring-ink/5 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.25)] transition-transform lg:hidden",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between p-6 pb-4">
          <div className="flex items-center gap-3">
            <img
              src="/Raffila-logo.png"
              alt=""
              className="size-10 shrink-0 rounded-2xl shadow-sm"
              width={40}
              height={40}
            />
            <div>
              <span className="block font-display text-lg font-extrabold tracking-tight text-ink leading-tight">
                Raffila
              </span>
              <span className="block text-[11px] font-bold text-ink/45">Dashboard</span>
            </div>
          </div>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="grid size-10 place-items-center rounded-2xl bg-cream/70 text-ink ring-1 ring-ink/5"
            aria-label="Close menu"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="px-4 pb-4">
          <div className="flex items-center gap-3 rounded-2xl bg-cream/60 p-3 ring-1 ring-ink/5">
            <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-coral text-white shadow-[0_8px_18px_-10px_var(--coral)] font-display text-sm font-extrabold">
              TA
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-extrabold text-ink leading-tight">
                Tunmise Adebayo
              </p>
              <p className="truncate text-[11px] font-bold text-ink/45 leading-snug">
                t***@********
              </p>
              <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-coral/10 px-2 py-0.5 text-[10px] font-extrabold text-coral">
                <ShieldCheck className="size-3" /> Verified
              </p>
            </div>
          </div>
        </div>

        <nav className="space-y-1 px-3 pb-4">
          {visibleDesktopItems.map((item) => {
            const isActive = activeKey === item.key;
            return (
              <Link
                key={item.key}
                to={item.to}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-extrabold transition-all",
                  isActive
                    ? "bg-coral text-white shadow-[0_8px_24px_-10px_var(--coral)] ring-1 ring-coral/30"
                    : "text-ink/70 hover:bg-ink/5 hover:text-ink",
                )}
              >
                <span
                  className={cn(
                    "grid size-8 place-items-center rounded-xl transition-colors",
                    isActive ? "bg-white/15 text-white" : "bg-coral/10 text-coral",
                  )}
                >
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
          <button
            onClick={() => {
              setMobileMenuOpen(false);
              handleLogout();
            }}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-coral px-3.5 py-2.5 text-sm font-extrabold text-white shadow-sm transition-colors hover:bg-coral/90"
          >
            <LogOut className="size-4" />
            Log out / Exit
          </button>
        </nav>
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-ink/5 bg-white/80 px-4 py-3.5 backdrop-blur lg:hidden sm:px-6">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="grid size-10 place-items-center rounded-2xl bg-cream/70 text-ink ring-1 ring-ink/5"
            aria-label="Open menu"
          >
            <Menu className="size-5" />
          </button>
          <div className="flex items-center gap-2">
            <img
              src="/Raffila-logo.png"
              alt=""
              className="size-9 shrink-0 rounded-2xl shadow-sm"
              width={36}
              height={36}
            />
            <div className="hidden xs:block">
              <span className="block font-display text-base font-extrabold tracking-tight text-ink leading-none">
                Raffila
              </span>
              <span className="block text-[10px] font-bold text-ink/45">Dashboard</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <CartButton />
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="rounded-full bg-coral px-3 py-2 text-xs font-extrabold text-white hover:bg-coral/90"
          >
            <LogOut className="size-3.5" /> Exit
          </Button>
          <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-coral text-white font-display text-sm font-extrabold shadow-[0_8px_18px_-10px_var(--coral)]">
            TA
          </div>
        </div>
      </header>

      <main className="min-w-0 overflow-x-hidden lg:ml-[268px] min-h-screen pt-5 pb-28 px-4 sm:px-6 lg:px-8 lg:pt-8">
        {/* Desktop counterpart of the mobile header's cart button. */}
        <div className="mb-4 hidden items-center justify-end gap-2 lg:flex">
          <NotificationBell />
          <CartButton />
        </div>
        <div className="mb-4 flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            className="rounded-full border-coral/20 bg-white px-4 py-2 text-xs font-extrabold text-coral hover:bg-coral hover:text-white"
          >
            <LogOut className="size-3.5" /> Exit / Log out
          </Button>
        </div>
        <div className="mx-auto w-full max-w-full min-w-0">{children}</div>
      </main>

      <nav className="fixed inset-x-0 bottom-3 z-40 mx-auto w-[calc(100%-24px)] max-w-md rounded-[28px] bg-white ring-1 ring-ink/5 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.35)] lg:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-5 px-1.5 pb-1.5 pt-2">
          {visibleBottomItems.map((item) => {
            const isActive = activeKey === item.key;
            return (
              <Link
                key={item.key}
                to={item.to}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-2xl px-1 py-2 text-[10px] font-extrabold transition-colors",
                  isActive ? "text-coral" : "text-ink/50 hover:text-ink",
                )}
              >
                <span
                  className={cn(
                    "grid size-9 place-items-center rounded-xl transition-colors",
                    isActive ? "bg-coral/10 text-coral" : "text-ink/50",
                  )}
                >
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

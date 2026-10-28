import {
  LayoutGrid,
  Users,
  Handshake,
  Trophy,
  Medal,
  Ticket,
  Banknote,
  BarChart3,
  Settings2,
  SlidersHorizontal,
  ClipboardList,
  ShieldAlert,
  Bell,
  Menu,
  X,
  Search,
  ExternalLink,
  LogOut,
  FileDown,
  PhoneCall,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";

import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useAuthActions, useAuthSession, initialsOf } from "@/hooks/useAuthSession";

export type AdminNavKey =
  | "dashboard"
  | "users"
  | "partners"
  | "competitions"
  | "entries"
  | "winners"
  | "payouts"
  | "reports"
  | "config"
  | "settings"
  | "audit-logs"
  | "fraud"
  | "notifications";

const OPS_GROUP: Array<{
  key: AdminNavKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { key: "dashboard", label: "Dashboard", icon: LayoutGrid },
  { key: "users", label: "Users", icon: Users },
  { key: "partners", label: "Partners", icon: Handshake },
  { key: "competitions", label: "Competitions", icon: Trophy },
  { key: "entries", label: "Entries", icon: Ticket },
  { key: "winners", label: "Winners", icon: Medal },
  { key: "payouts", label: "Payouts", icon: Banknote },
  { key: "reports", label: "Reports", icon: BarChart3 },
];

const CONFIG_GROUP: Array<{
  key: AdminNavKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { key: "config", label: "Config", icon: Settings2 },
  { key: "settings", label: "Settings", icon: SlidersHorizontal },
  { key: "audit-logs", label: "Audit logs", icon: ClipboardList },
  { key: "fraud", label: "Fraud queue", icon: ShieldAlert },
  { key: "notifications", label: "Notifications", icon: Bell },
];

const navRoute: Record<AdminNavKey, string> = {
  dashboard: "/admin",
  users: "/admin/users",
  partners: "/admin/partners",
  competitions: "/admin/competitions",
  entries: "/admin/entries",
  winners: "/admin/winners",
  payouts: "/admin/payouts",
  reports: "/admin/reports",
  config: "/admin/config",
  settings: "/admin/settings",
  "audit-logs": "/admin/audit-logs",
  fraud: "/admin/fraud",
  notifications: "/admin/notifications",
};

interface AdminShellProps {
  children: React.ReactNode;
  title?: string;
  activeNav: AdminNavKey;
}

interface NavGroupProps {
  label: string;
  items: typeof OPS_GROUP;
  activeNav: AdminNavKey;
  onNavigate?: () => void;
}

function NavGroup({ label, items, activeNav, onNavigate }: NavGroupProps) {
  return (
    <div className="space-y-1">
      <p className="px-3.5 pt-1 pb-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-cream/35">
        {label}
      </p>
      <div className="space-y-0.5">
        {items.map(({ key, label: itemLabel, icon: Icon }) => {
          const active = key === activeNav;
          return (
            <Link
              key={key}
              to={navRoute[key]}
              onClick={onNavigate}
              className={cn(
                "group flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-bold transition-all duration-200",
                active
                  ? "bg-white text-ink shadow-[0_1px_0_rgba(255,255,255,0.08)_inset,0_6px_20px_-8px_rgba(0,0,0,0.4)]"
                  : "text-cream/70 hover:bg-white/10 hover:text-cream",
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon
                className={cn(
                  "size-4.5 shrink-0",
                  active ? "text-coral" : "text-cream/55 group-hover:text-cream/85",
                )}
              />
              <span className="tracking-tight">{itemLabel}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function AdminBell() {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [{ fetchAdminNotifications, getReadIds, getDismissedIds }] = await Promise.all([
          import("@/lib/admin-notifications"),
        ]);
        const data = await fetchAdminNotifications();
        if (cancelled) return;
        const read = getReadIds();
        const dismissed = getDismissedIds();
        setUnread(data.inapp.filter((n) => !read.has(n.id) && !dismissed.has(n.id)).length);
      } catch {
        if (!cancelled) setUnread(0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Link
      to="/admin/notifications"
      aria-label="Admin notifications"
      className="relative grid size-11 place-items-center rounded-full bg-white text-ink ring-1 ring-ink/10 transition-colors hover:ring-coral/30"
    >
      <Bell className="size-4.5" />
      {unread > 0 ? (
        <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-coral px-1 text-[10px] font-extrabold leading-5 text-white ring-2 ring-white">
          {unread > 99 ? "99+" : unread}
        </span>
      ) : (
        <span
          className="absolute right-3 top-3 size-2 rounded-full bg-ink/20 ring-2 ring-white"
          aria-hidden="true"
        />
      )}
    </Link>
  );
}

export function AdminShell({ children, title, activeNav }: AdminShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useAuthSession();
  const { signOut } = useAuthActions();

  const monogram = user?.avatarMonogram ?? (user ? initialsOf(user) : "AA");
  const fullName = user ? `${user.firstName} ${user.lastName}` : "Admin Aisha";
  const roleBadge = user?.role === "admin" ? "Super Admin" : "Staff";
  const runLogout = () => signOut({ to: "/auth" });
  const closeMobile = () => setMobileOpen(false);

  return (
    <div className="flex h-screen overflow-hidden bg-cream/40">
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col transition-transform duration-300 lg:static lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ backgroundColor: "oklch(0.22 0.04 162)" }}
      >
        <div className="flex items-center gap-3.5 px-5 pt-7 pb-5">
          <img
            src="/Raffila-logo.png"
            alt=""
            className="size-10 shrink-0 rounded-2xl shadow-[0_4px_14px_-4px_rgba(0,0,0,0.5)]"
            width={40}
            height={40}
          />
          <div>
            <p className="font-display text-lg font-extrabold leading-tight text-cream tracking-tight">
              Raffila Admin
            </p>
            <p className="text-[10px] font-bold text-cream/45">Super admin console</p>
          </div>
        </div>

        <div className="px-5 pb-5">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-cream/50">
            Super admin
          </p>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label="Admin navigation">
          <NavGroup
            label="Operations"
            items={OPS_GROUP}
            activeNav={activeNav}
            onNavigate={closeMobile}
          />
          <div className="my-4 mx-2 h-px bg-white/8" />
          <NavGroup
            label="Platform configuration"
            items={CONFIG_GROUP}
            activeNav={activeNav}
            onNavigate={closeMobile}
          />
        </nav>

        <div className="border-t border-white/10 px-3 py-4 space-y-1">
          <a
            href="/docs/RAFILLA_MASTER_OPERATIONS_MANUAL.docx"
            download="RAFILLA_MASTER_OPERATIONS_MANUAL.docx"
            onClick={closeMobile}
            className="flex items-center gap-3 rounded-2xl bg-white/10 px-3.5 py-2.5 text-xs font-extrabold text-cream transition-colors hover:bg-white/20"
            title="Download full operational procedures and credentials (.docx)"
          >
            <FileDown className="size-4 shrink-0 text-amber-400" />
            <span className="truncate">Operations Manual (.docx)</span>
          </a>
          <a
            href="/"
            onClick={closeMobile}
            className="flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-bold text-cream/65 transition-colors hover:bg-white/10 hover:text-cream"
          >
            <ExternalLink className="size-4.5 text-cream/50" />
            Back to site
          </a>
          <button
            onClick={() => {
              closeMobile();
              runLogout();
            }}
            className="flex w-full items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-bold text-coral/90 transition-colors hover:bg-coral/15 hover:text-coral"
          >
            <LogOut className="size-4.5 text-coral/80" />
            Log out
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-ink/50 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-ink/8 bg-white px-5 py-4">
          <Button
            variant="outline"
            size="icon"
            className="size-10 lg:hidden rounded-xl"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? "Close admin menu" : "Open admin menu"}
          >
            {mobileOpen ? <X className="size-4.5" /> : <Menu className="size-4.5" />}
          </Button>

          <div className="hidden items-center gap-2.5 lg:flex">
            <img
              src="/Raffila-logo.png"
              alt=""
              className="size-9 shrink-0 rounded-2xl shadow-sm ring-1 ring-ink/8"
              width={36}
              height={36}
            />
            {title && (
              <p className="font-display text-xl font-extrabold text-ink tracking-tight">{title}</p>
            )}
          </div>

          <div className="flex-1 max-w-md ml-auto">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink/40" />
              <Input
                placeholder="Search users, partners, competitions…"
                className="h-11 rounded-full border-0 bg-cream/60 ring-1 ring-ink/10 pl-11 pr-4 text-sm font-bold text-ink placeholder:text-ink/40 focus-visible:ring-coral focus-visible:ring-2 focus-visible:bg-white"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="/docs/RAFILLA_MASTER_OPERATIONS_MANUAL.docx"
              download="RAFILLA_MASTER_OPERATIONS_MANUAL.docx"
              className="hidden sm:inline-flex items-center gap-2 rounded-full border border-ink/10 bg-cream/70 px-3.5 py-2 text-xs font-extrabold text-ink transition-all hover:bg-white hover:border-ink/20 hover:shadow-xs"
              title="Download Complete Raffila Operations & Technical Manual (DOCX)"
            >
              <FileDown className="size-3.5 text-coral" />
              <span>Manual (.docx)</span>
            </a>

            <AdminBell />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-11 lg:hidden rounded-full">
                  <Avatar className="size-9 ring-2 ring-coral/60 overflow-hidden">
                    <AvatarImage src={user?.avatarUrl} alt="" />
                    <AvatarFallback className="bg-coral text-ink font-extrabold">
                      {monogram}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-60 rounded-[24px] bg-white p-2 ring-1 ring-ink/10 shadow-lg"
              >
                <DropdownMenuLabel className="rounded-2xl bg-cream/60 px-3.5 py-3">
                  <p className="font-extrabold text-ink">{fullName}</p>
                  <Badge className="mt-1 rounded-full bg-coral px-2.5 py-0 text-[9px] font-extrabold uppercase tracking-wider text-ink ring-0">
                    {roleBadge}
                  </Badge>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-ink/8" />
                <DropdownMenuItem className="rounded-xl cursor-pointer px-3 py-2 text-sm font-bold text-ink/70 focus:bg-lilac/20 focus:text-ink">
                  <ExternalLink className="mr-2 size-4" />
                  Back to site
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    runLogout();
                  }}
                  className="rounded-xl cursor-pointer px-3 py-2 text-sm font-bold text-coral focus:bg-coral/15"
                >
                  <LogOut className="mr-2 size-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6 lg:px-7 lg:py-7 pb-24 sm:pb-28">
          {children}
        </div>
      </div>
    </div>
  );
}

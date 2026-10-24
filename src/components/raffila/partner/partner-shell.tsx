import { useState, useEffect, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LayoutDashboard,
  ListOrdered,
  Upload,
  BarChart3,
  Landmark,
  UserCircle2,
  Menu,
  Search,
  LogOut,
  Gem,
  Car,
  Award,
  Sparkles,
  ShieldCheck,
  Building2,
  Clock,
  ChevronDown,
} from "lucide-react";
import { useAuthSession, useAuthActions } from "@/hooks/useAuthSession";
import { NotificationBell } from "@/components/raffila/notification-bell";
import { partnerStore } from "@/lib/partner-store";
import type { PartnerProfile } from "@/types/partner";

export type PartnerNavKey =
  "overview" | "listings" | "submit" | "analytics" | "settlements" | "profile";

interface NavItem {
  key: PartnerNavKey;
  label: string;
  icon: ReactNode;
  path: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    key: "overview",
    label: "Overview",
    icon: <LayoutDashboard className="w-5 h-5" />,
    path: "/partner",
  },
  {
    key: "listings",
    label: "My Competitions",
    icon: <ListOrdered className="w-5 h-5" />,
    path: "/partner/listings",
  },
  {
    key: "submit",
    label: "My Assets",
    icon: <Upload className="w-5 h-5" />,
    path: "/partner/submit",
  },
  {
    key: "settlements",
    label: "Settlements & Payouts",
    icon: <Landmark className="w-5 h-5" />,
    path: "/partner/settlements",
  },
  {
    key: "analytics",
    label: "Revenue Analytics",
    icon: <BarChart3 className="w-5 h-5" />,
    path: "/partner/analytics",
  },
  {
    key: "profile",
    label: "Business Profile",
    icon: <UserCircle2 className="w-5 h-5" />,
    path: "/partner/profile",
  },
];

interface PartnerShellProps {
  children: ReactNode;
  title: string;
  activeNav: PartnerNavKey;
  activePartnerId?: string;
  onPartnerChange?: (partnerId: string) => void;
}

export function PartnerShell({ children, title, activeNav }: PartnerShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { session } = useAuthSession();
  const { signOut } = useAuthActions();

  const [partners, setPartners] = useState<PartnerProfile[]>(partnerStore.getPartners());
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>(() => {
    if (session?.user?.partnerId) return session.user.partnerId;
    return "partner_abc_motors";
  });

  useEffect(() => {
    const unsub = partnerStore.subscribe(() => {
      setPartners(partnerStore.getPartners());
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (session?.user?.partnerId) {
      setSelectedPartnerId(session.user.partnerId);
    }
  }, [session?.user?.partnerId]);

  const activePartner: PartnerProfile = partnerStore.getPartnerById(selectedPartnerId) ||
    partners[0] || {
      id: "partner_abc_motors",
      businessName: session?.user?.businessName || "",
      businessType: "Automotive",
      cacNumber: "RC-1849204",
      address: "Victoria Island",
      city: "Lagos",
      state: "Lagos",
      country: "Nigeria",
      companyEmail: session?.user?.email || "",
      companyPhone: "+234 803 111 2233",
      description: "Verified Partner",
      authorizedRepresentative: {
        fullName: `${session?.user?.firstName || ""} ${session?.user?.lastName || ""}`.trim(),
        position: "Managing Director",
        email: session?.user?.email || "",
        phone: "+234 803 111 2233",
      },
      documents: {},
      verificationStatus: "APPROVED",
      createdAt: "",
      updatedAt: "",
    };

  const isApproved = activePartner.verificationStatus === "APPROVED";

  const BrandBlock = () => (
    <div className="p-4">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-coral flex items-center justify-center text-white shrink-0 border-4 border-paper shadow-sm font-display font-extrabold text-base">
          {activePartner.logoInitials || activePartner.businessName.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display text-ink text-base font-extrabold leading-tight truncate">
            {activePartner.businessName}
          </p>
          {isApproved ? (
            <Badge className="rounded-full bg-mint/40 border-mint text-ink text-[10px] font-bold mt-1">
              <ShieldCheck className="w-3 h-3 mr-1 text-mint-700" /> Verified Partner
            </Badge>
          ) : (
            <Badge className="rounded-full bg-lemon/40 border-lemon text-ink text-[10px] font-bold mt-1">
              <Clock className="w-3 h-3 mr-1" /> Pending Review
            </Badge>
          )}
        </div>
      </div>

      {/* Partner Switcher for multi-partner testing */}
      <div className="mt-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl bg-paper/60 hover:bg-paper border border-ink/10 text-xs font-bold text-ink/75 transition"
            >
              <span className="truncate">Switch Partner View</span>
              <ChevronDown className="size-3.5 text-ink/40 ml-1 shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64 rounded-2xl p-1.5 shadow-lg">
            <DropdownMenuLabel className="text-[10px] font-extrabold uppercase tracking-wider text-ink/40">
              Demo Partner Accounts
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {partners.map((p) => (
              <DropdownMenuItem
                key={p.id}
                onClick={() => setSelectedPartnerId(p.id)}
                className={`rounded-xl font-bold text-xs py-2 cursor-pointer flex items-center justify-between ${
                  p.id === activePartner.id ? "bg-lilac/30 text-ink" : "text-ink/80"
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate">{p.businessName}</p>
                  <p className="text-[10px] text-ink/45 font-medium">{p.businessType}</p>
                </div>
                <Badge
                  className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                    p.verificationStatus === "APPROVED"
                      ? "bg-mint/30 text-ink"
                      : "bg-lemon/35 text-ink"
                  }`}
                >
                  {p.verificationStatus}
                </Badge>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );

  const NavList = ({ onNavigate }: { onNavigate?: () => void }) => (
    <nav className="flex flex-col gap-1 px-3 py-2" aria-label="Partner navigation">
      {NAV_ITEMS.map((item) => {
        const isActive =
          item.key === activeNav ||
          (item.key === "overview" &&
            (location.pathname === "/partner" || location.pathname === "/partner/"));
        return (
          <Link
            key={item.key}
            to={item.path}
            onClick={() => onNavigate?.()}
            className={`group flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-sm font-body transition-all ${
              isActive
                ? "bg-coral text-white shadow-md shadow-coral/20 font-bold"
                : "text-ink/75 hover:bg-coral/15 hover:text-ink font-semibold"
            }`}
            aria-current={isActive ? "page" : undefined}
          >
            <span
              className={`${isActive ? "text-white" : "text-ink/60 group-hover:text-coral"} transition`}
            >
              {item.icon}
            </span>
            <span className="truncate">{item.label}</span>
            {item.key === "submit" && !isActive && (
              <Sparkles className="w-3.5 h-3.5 text-coral ml-auto shrink-0" />
            )}
          </Link>
        );
      })}
    </nav>
  );

  const handleSignOut = () => {
    signOut();
    navigate({ to: "/auth" });
  };

  return (
    <div className="min-h-screen bg-paper text-ink flex">
      <aside className="hidden lg:flex lg:flex-col w-[272px] shrink-0 bg-cream border-r border-ink/10 min-h-screen">
        <BrandBlock />
        <Separator className="bg-ink/5" />
        <div className="mt-3 flex-1">
          <NavList />
        </div>
        <Separator className="bg-ink/5" />
        <div className="p-4 space-y-3">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-coral/15 via-lemon/20 to-mint/20 border border-coral/20">
            <div className="flex items-center gap-2 mb-1.5">
              <Gem className="w-4 h-4 text-coral" />
              <p className="font-display text-ink text-sm font-bold">Partner Perks</p>
            </div>
            <p className="text-[11px] font-body text-ink/70 leading-snug">
              Top 3 partners this quarter win a spot on the homepage featured carousel.
            </p>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-paper border border-ink/10">
            <Avatar className="w-10 h-10">
              <AvatarFallback className="bg-mint/40 text-ink font-display font-bold">
                {activePartner.authorizedRepresentative.fullName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="font-body text-sm font-semibold text-ink truncate">
                {activePartner.authorizedRepresentative.fullName}
              </p>
              <p className="text-[11px] text-ink/50 truncate">
                {activePartner.authorizedRepresentative.email}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSignOut}
              className="rounded-full text-ink/50 hover:text-coral hover:bg-coral/10"
              aria-label="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex min-w-0 flex-col min-h-screen overflow-x-hidden pb-24 sm:pb-28">
        <header className="sticky top-0 z-30 bg-paper/90 backdrop-blur border-b border-ink/10 px-4 sm:px-6 py-3 flex items-center gap-2 sm:gap-3 overflow-x-hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden rounded-full"
                aria-label="Open partner menu"
              >
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[300px] p-0 bg-cream border-r border-ink/10">
              <BrandBlock />
              <Separator className="bg-ink/5" />
              <NavList onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>

          <Link to="/partner" className="flex min-w-0 items-center gap-1.5 shrink-0 sm:gap-2">
            <img
              src="/Raffila-logo.png"
              alt=""
              className="size-8 shrink-0 rounded-xl shadow-sm"
              width={32}
              height={32}
            />
            <span className="font-display text-ink text-base hidden sm:block sm:text-lg">
              Raffila
            </span>
            <Badge
              variant="outline"
              className="hidden shrink-0 rounded-full border-coral/30 bg-coral/10 text-coral text-[10px] sm:inline-flex"
            >
              Partner
            </Badge>
          </Link>

          <div className="min-w-0 flex-1 font-display text-ink text-base sm:text-xl truncate ml-1">
            <span className="text-ink/30 mx-1 hidden sm:inline sm:mx-2">/</span>
            <span className="truncate">{title}</span>
          </div>

          <div className="flex shrink-0 items-center gap-1 sm:gap-3 ml-auto">
            <div className="hidden md:block relative w-64 lg:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink/40" />
              <Input
                className="pl-9 rounded-full bg-cream/60 border-ink/10 focus:border-coral focus:ring-0 text-sm"
                placeholder="Search listings, entries..."
              />
            </div>
            <NotificationBell className="shrink-0" />
            <Avatar className="w-9 h-9 shrink-0 lg:hidden">
              <AvatarFallback className="bg-mint/40 text-ink font-display font-bold text-xs">
                MA
              </AvatarFallback>
            </Avatar>
          </div>
        </header>

        <div className="flex-1 min-w-0 p-4 sm:p-6 lg:p-7 overflow-x-hidden">
          <div className="mx-auto w-full max-w-full min-w-0">{children}</div>
        </div>
      </div>
    </div>
  );
}

import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  Filter,
  Grid2X2,
  Home,
  Instagram,
  LayoutList,
  Mail,
  MapPin,
  MoreHorizontal,
  Phone,
  PlayCircle,
  Search,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  Ticket,
  Trophy,
  WalletCards,
  X,
  Award,
  Globe,
  Check,
  Copy,
  ExternalLink,
  Handshake,
  CheckCircle2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { toast } from "sonner";
import { partnerStore } from "@/lib/partner-store";

import { CompetitionCard, QuantityStepper } from "@/components/raffila/competition-card";
import { WinnerCard } from "@/components/raffila/winner-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { TicketPurchaseModal } from "@/components/raffila/purchase";
import { WinnersPagePolished } from "@/components/raffila/draws";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Progress } from "@/components/ui/progress";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  categories,
  partners,
  formatNaira,
  getProgress,
  getEntriesRemaining,
  faqs,
  competitionFaqs,
  winnerCards,
  type Competition,
  applySort,
  type SortKey,
  BROWSE_BY_NEED,
  TRUST_SIGNALS,
  BUDGET_FILTERS,
  matchesBudget,
  trackEvent,
} from "@/lib/raffila-data";
import { useCompetitions, findCompetition, isCompetitionConcluded } from "@/hooks/useCompetitions";
import { useWinners } from "@/hooks/useWinners";
import { useRewardPool } from "@/hooks/useRewardPool";
import {
  HeroFeaturedCarousel,
  FeaturedCategoryDots,
  useFeaturedCarousel,
} from "@/components/raffila/hero-carousel";
import { cn, formatNaira as formatNairaKobo } from "@/lib/utils";
import { useCountdownDays } from "@/hooks/useCountdown";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * Homepage "Live competitions" shelf. Renders at most three cards from
 * whatever the DB currently holds (indexes are never assumed present — with
 * fewer than three competitions the shelf shrinks, and with none it hides
 * instead of crashing on an undefined entry).
 */
function LiveCompetitionsSection({
  competitions,
  onEnterDraw,
}: {
  competitions: Competition[];
  onEnterDraw?: (slug: string, qty: number) => void;
}) {
  if (competitions.length === 0) return null;
  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <SectionHeading
        eyebrow="Curated for you"
        title="Live competitions"
        linkLabel="See all competitions"
        linkTo="/competitions"
      />
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink/60">
        A mix of affordable everyday prizes and aspirational premium prizes. Entry price, entries
        remaining, closing date and verified partner are always visible.
      </p>
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        {competitions.slice(0, 3).map((c, i) =>
          i === 2 ? (
            <div key={c.slug} className="hidden lg:block">
              <CompetitionCard
                competition={c}
                {...(onEnterDraw ? { onEnterDraw: (qty: number) => onEnterDraw(c.slug, qty) } : {})}
              />
            </div>
          ) : (
            <CompetitionCard
              key={c.slug}
              competition={c}
              {...(onEnterDraw ? { onEnterDraw: (qty: number) => onEnterDraw(c.slug, qty) } : {})}
            />
          ),
        )}
      </div>
    </section>
  );
}

export function HomePage() {
  const { competitions, activeCompetitions } = useCompetitions();
  const { winners } = useWinners();
  const rewardPool = useRewardPool();
  const carousel = useFeaturedCarousel();
  const [modalSlug, setModalSlug] = useState<string | null>(null);
  const [modalQty, setModalQty] = useState<number>(1);
  const openPurchase = (slug: string, qty: number) => {
    setModalQty(qty);
    setModalSlug(slug);
  };
  return (
    <div>
      <section className="mx-auto max-w-7xl px-4 pb-8 pt-8 sm:px-6 sm:pt-12 lg:px-8 lg:pb-12">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(300px,420px)] lg:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone="coral">
                <span className="size-2 rounded-full bg-coral" /> Featured prize
              </Pill>
              <Pill>
                <BadgeCheck className="size-3.5 text-mint" /> Verifiable draw
              </Pill>
            </div>
            <h1 className="raf-rise mt-5 max-w-3xl font-display text-4xl font-extrabold leading-[1.04] tracking-tight text-ink sm:text-5xl lg:text-6xl">
              Big opportunities.
              <br />
              Affordable entries. <span className="text-coral">Transparent draws.</span>
            </h1>
            <div className="mt-5 max-w-xl">
              <p className="text-base leading-relaxed text-ink/65 sm:text-lg">
                What can you win? Can you afford to enter? Is Raffila trustworthy? Start with the
                prize — no wallet needed to browse.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Button asChild variant="primary" size="lg" className="min-h-12 text-base">
                  <Link
                    to="/competitions"
                    onClick={() => trackEvent("competition_card_click", { source: "hero" })}
                  >
                    Explore Competitions <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <span className="inline-flex items-center gap-2 text-xs font-extrabold text-ink/50">
                  <span className="grid size-8 place-items-center rounded-full bg-mint/40 text-ink">
                    ₦
                  </span>{" "}
                  Built for Africa
                </span>
              </div>
            </div>
          </div>
          <HeroRewardPoolCard
            liveCount={activeCompetitions.length}
            contributionPct={rewardPool.contributionPct}
            totalKobo={rewardPool.totalKobo}
          />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(280px,0.95fr)]">
          <div className="min-w-0">
            <HeroFeaturedCarousel controller={carousel} showDots={false} />
            <div className="mt-4 lg:hidden">
              <FeaturedCategoryDots controller={carousel} />
            </div>
          </div>
          <div className="hidden lg:flex lg:h-full lg:flex-col lg:gap-4">
            <div className="flex flex-1 flex-col rounded-[28px] bg-paper p-6 ring-1 ring-ink/5">
              <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-ink/45">
                Why Raffila
              </p>
              <div className="mt-5 grid flex-1 content-between gap-4 sm:grid-cols-2">
                <TrustItem
                  icon={<ShieldCheck />}
                  title="Clear by design"
                  text="Prize, entry price, and availability are always visible."
                />
                <TrustItem
                  icon={<BadgeCheck />}
                  title="Fair at the core"
                  text="Draw verification is part of the experience, not an afterthought."
                />
                <TrustItem
                  icon={<WalletCards />}
                  title="Secure payments"
                  text="Your wallet and purchase history stay easy to follow."
                />
                <TrustItem
                  icon={<Sparkles />}
                  title="Premium prizes"
                  text="Curated assets worth making room for in your life."
                />
              </div>
            </div>
            <div className="rounded-[28px] bg-lilac/20 p-6 ring-1 ring-ink/5">
              <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-ink/45">
                How it works
              </p>
              <ol className="mt-4 space-y-3.5">
                {[
                  {
                    title: "Pick a prize",
                    text: "Browse live campaigns — no wallet needed.",
                  },
                  {
                    title: "Buy entries",
                    text: "Clear pricing, pay securely.",
                  },
                  {
                    title: "Watch the draw",
                    text: "Audited, publicly verifiable results.",
                  },
                ].map((step, index) => (
                  <li key={step.title} className="flex gap-3">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-paper font-display text-xs font-extrabold text-coral ring-1 ring-ink/10">
                      {index + 1}
                    </span>
                    <div>
                      <p className="text-sm font-extrabold text-ink">{step.title}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-ink/55">{step.text}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <Button asChild variant="outline" size="sm" className="mt-5 w-full">
                <Link to="/how-it-works">
                  See the full guide <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            </div>
            <div className="rounded-[28px] bg-paper p-6 ring-1 ring-ink/5">
              <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-ink/45">
                Categories
              </p>
              <div className="mt-3">
                <FeaturedCategoryDots controller={carousel} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <PopularUnder1000 competitions={activeCompetitions} onEnterDraw={openPurchase} />

      <TrustStrip />

      <LiveCompetitionsSection competitions={activeCompetitions} onEnterDraw={openPurchase} />

      <BrowseByNeed competitions={activeCompetitions} />

      <HowItWorksPreview />

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <div className="rounded-[28px] bg-paper p-6 ring-1 ring-ink/5 sm:p-8 lg:flex lg:items-center lg:justify-between lg:p-10">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-ink/45">
              For asset owners
            </p>
            <h2 className="mt-2 max-w-lg font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
              Have a premium asset to list?
            </h2>
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-ink/60">
              Partner with Raffila and put your product in front of people looking for something
              extraordinary.
            </p>
          </div>
          <Button asChild variant="dark" size="lg" className="mt-6 lg:mt-0">
            <Link to="/become-a-partner">
              Become a partner <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-ink/45">
              Winners circle
            </p>
            <h2 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
              Recent winners
            </h2>
            <p className="mt-2 text-base text-ink/60">Congratulations to our verified winners</p>
          </div>
          <Button asChild variant="outline" size="md" className="mt-4 sm:mt-0">
            <Link to="/winners">
              View all winners <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {winners.slice(0, 3).map((winner) => (
            <WinnerCard key={winner.id} winner={winner} />
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <div className="text-center">
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-ink/45">
            Quick answers
          </p>
          <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            Frequently asked questions
          </h2>
          <p className="mt-3 text-base text-ink/60">Quick answers before you enter</p>
        </div>
        <div className="mt-10 space-y-3">
          {faqs.slice(0, 5).map((faq, index) => (
            <FAQAccordionItem key={faq.q} faq={faq} defaultOpen={index === 0} />
          ))}
        </div>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild variant="ghost" size="md">
            <Link to="/faq">
              See all FAQs <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <div className="rounded-[28px] bg-ink p-8 text-cream sm:p-10 lg:p-12">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              Your next big win could start today
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-cream/70 sm:text-lg">
              A few taps to enter, a fair verified draw, a life-changing prize.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center">
              <Button
                asChild
                variant="primary"
                size="lg"
                className="bg-coral text-paper hover:bg-coral/90 shadow-[0_8px_20px_-8px_var(--coral)]"
              >
                <Link to="/auth" search={{ tab: "register" } as any}>
                  CREATE ACCOUNT <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="border-cream/30 bg-cream text-ink hover:bg-cream/90 shadow-[0_8px_20px_-8px_rgba(255,252,245,0.4)]"
              >
                <Link to="/competitions">
                  Browse competitions <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="ghost"
                size="lg"
                className="bg-transparent text-cream hover:bg-cream/10 hover:text-cream border border-cream/20"
              >
                <Link to="/auth" search={{ tab: "login" } as any}>
                  Log in
                </Link>
              </Button>
            </div>
            <p className="mt-4 text-xs font-bold text-cream/50">
              New here? Create account in under 2 minutes — no payment needed to start.
            </p>
          </div>
        </div>
      </section>
      <TicketPurchaseModal
        open={!!modalSlug}
        onClose={() => setModalSlug(null)}
        competitionSlug={modalSlug ?? ""}
        initialQuantity={modalQty}
      />
    </div>
  );
}

function FAQAccordionItem({
  faq,
  defaultOpen = false,
}: {
  faq: { q: string; a: string };
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="group rounded-[22px] bg-paper p-5 ring-1 ring-ink/5">
      <button
        onClick={() => setOpen((current) => !current)}
        className="flex w-full cursor-pointer items-center justify-between gap-4 text-left"
        aria-expanded={open}
      >
        <span className="font-display text-lg font-extrabold text-ink">{faq.q}</span>
        <ChevronDown
          className={`size-5 shrink-0 text-coral transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      <div
        className={`grid overflow-hidden transition-all duration-200 ${open ? "mt-4 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
      >
        <div className="min-h-0">
          <p className="max-w-2xl text-sm leading-relaxed text-ink/60">{faq.a}</p>
        </div>
      </div>
    </div>
  );
}

type StatusKey = "all" | "live" | "starting-soon" | "ending-soon" | "completed";

export type CompetitionsFilterState = {
  query: string;
  category: string;
  budget: string;
  sort: SortKey;
  status: StatusKey;
  priceMinKobo: number;
  priceMaxKobo: number;
  partners: string[];
  view: "grid" | "list";
  page: number;
};

const priceMinBoundKobo = 100 * 100;
const priceMaxBoundKobo = 100_000 * 100;
const pageSize = 8;

/** Small uppercase caption used to title each filter group consistently. */
function FilterGroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-ink/45">{children}</p>
  );
}

/** A labelled block of filter controls. */
function FilterGroup({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("min-w-0 space-y-2.5", className)}>
      <FilterGroupLabel>{label}</FilterGroupLabel>
      {children}
    </div>
  );
}

export function CompetitionsFilterBar({
  state,
  setState,
  totalCount,
  filteredCount,
}: {
  state: CompetitionsFilterState;
  setState: React.Dispatch<React.SetStateAction<CompetitionsFilterState>>;
  totalCount: number;
  filteredCount: number;
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const activeCount = useMemo(() => {
    let n = 0;
    if (state.query.trim()) n++;
    if (state.category !== "All") n++;
    if ((state as any).budget && (state as any).budget !== "all") n++;
    if (state.status !== "all") n++;
    if (state.partners.length > 0) n++;
    if (state.priceMinKobo !== priceMinBoundKobo || state.priceMaxKobo !== priceMaxBoundKobo) n++;
    return n;
  }, [state]);
  const clearAll = () =>
    setState({
      query: "",
      category: "All",
      budget: "all",
      sort: "ending-soon",
      status: "all",
      priceMinKobo: priceMinBoundKobo,
      priceMaxKobo: priceMaxBoundKobo,
      partners: [],
      view: state.view,
      page: 1,
    });
  return (
    <div className="mt-8 space-y-5 rounded-[28px] bg-paper p-4 ring-1 ring-ink/5 sm:p-6">
      <label className="flex min-h-12 items-center gap-3 rounded-full bg-cream px-4 shadow-sm ring-1 ring-ink/5 focus-within:ring-2 focus-within:ring-coral/60">
        <Search className="size-4 shrink-0 text-ink/40" />
        <span className="sr-only">Search competitions</span>
        <input
          value={state.query}
          onChange={(event) => setState((s) => ({ ...s, query: event.target.value, page: 1 }))}
          placeholder="Search competitions, prizes, partners…"
          className="w-full bg-transparent py-3 text-sm font-bold text-ink outline-none placeholder:text-ink/40"
        />
        {state.query && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => setState((s) => ({ ...s, query: "", page: 1 }))}
            className="grid size-6 place-items-center rounded-full bg-ink/10 text-ink/50 hover:bg-ink/20"
          >
            <X className="size-3.5" />
          </button>
        )}
      </label>

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-6">
        <FilterGroup label="Category" className="flex-1">
          {/* Scrolls on narrow screens, wraps on desktop so no chip is ever cut off. */}
          <div className="relative -mx-4 overflow-x-auto px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:overflow-visible lg:px-0">
            <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-paper to-transparent lg:hidden" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-paper to-transparent lg:hidden" />
            <div className="flex shrink-0 items-center gap-2 py-1 lg:flex-wrap">
              {categories.map((cat) => {
                const active = state.category === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      trackEvent("category_click", { category: cat });
                      setState((s) => ({ ...s, category: cat, page: 1 }));
                    }}
                    className={cn(
                      "shrink-0 rounded-full px-4 py-2 text-xs font-extrabold transition-transform hover:-translate-y-px",
                      active
                        ? "bg-ink text-cream"
                        : "bg-paper text-ink ring-1 ring-ink/10 hover:bg-lilac/15",
                    )}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>
        </FilterGroup>

        <div className="grid shrink-0 gap-5 sm:grid-cols-2 lg:gap-4">
          <FilterGroup label="Sort by">
            <Select
              value={state.sort}
              onValueChange={(v) => setState((s) => ({ ...s, sort: v as SortKey, page: 1 }))}
            >
              <SelectTrigger className="h-11 w-full rounded-full border-0 bg-lilac/20 px-4 text-xs font-extrabold text-ink ring-1 ring-ink/10 focus:ring-coral/60 sm:w-[170px]">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-0 bg-paper p-1 font-body shadow-lg ring-1 ring-ink/10">
                <SelectItem value="ending-soon" className="rounded-xl text-xs font-bold">
                  Closing soon
                </SelectItem>
                <SelectItem value="newest" className="rounded-xl text-xs font-bold">
                  New
                </SelectItem>
                <SelectItem value="price-asc" className="rounded-xl text-xs font-bold">
                  Price
                </SelectItem>
                <SelectItem value="price-desc" className="rounded-xl text-xs font-bold">
                  Price: High to low
                </SelectItem>
                <SelectItem value="most-entries" className="rounded-xl text-xs font-bold">
                  Popular
                </SelectItem>
                <SelectItem value="featured-first" className="rounded-xl text-xs font-bold">
                  Featured first
                </SelectItem>
              </SelectContent>
            </Select>
          </FilterGroup>

          <FilterGroup label="Status">
            <Select
              value={state.status}
              onValueChange={(v) => setState((s) => ({ ...s, status: v as StatusKey, page: 1 }))}
            >
              <SelectTrigger className="h-11 w-full rounded-full border-0 bg-mint/25 px-4 text-xs font-extrabold text-ink ring-1 ring-ink/10 focus:ring-coral/60 sm:w-[170px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-0 bg-paper p-1 font-body shadow-lg ring-1 ring-ink/10">
                <SelectItem value="all" className="rounded-xl text-xs font-bold">
                  All active
                </SelectItem>
                <SelectItem value="live" className="rounded-xl text-xs font-bold">
                  Live now
                </SelectItem>
                <SelectItem value="starting-soon" className="rounded-xl text-xs font-bold">
                  Starting soon
                </SelectItem>
                <SelectItem value="ending-soon" className="rounded-xl text-xs font-bold">
                  Ending soon (≤7d)
                </SelectItem>
              </SelectContent>
            </Select>
          </FilterGroup>
        </div>
      </div>

      <Separator className="bg-ink/10" />

      <FilterGroup label="Budget — what can you afford?">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setState((s) => ({ ...s, budget: "all", page: 1 }))}
            className={cn(
              "shrink-0 rounded-full px-4 py-2 text-xs font-extrabold ring-1 transition-colors",
              state.budget === "all"
                ? "bg-ink text-cream ring-ink"
                : "bg-cream text-ink ring-ink/10 hover:bg-lemon/40",
            )}
          >
            All prices
          </button>
          {BUDGET_FILTERS.map((b) => {
            const active = state.budget === b.id;
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => {
                  trackEvent("budget_filter_use", { budget: b.id });
                  setState((s) => ({ ...s, budget: b.id, page: 1 }));
                }}
                className={cn(
                  "shrink-0 rounded-full px-4 py-2 text-xs font-extrabold ring-1 transition-colors",
                  active
                    ? "bg-coral text-paper ring-coral shadow-[0_8px_20px_-8px_var(--coral)]"
                    : "bg-cream text-ink ring-ink/10 hover:bg-lemon/40",
                )}
              >
                {b.label}
              </button>
            );
          })}
        </div>
      </FilterGroup>

      <Separator className="bg-ink/10" />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          aria-expanded={showAdvanced}
          className="inline-flex items-center gap-2 self-start rounded-full bg-cream px-4 py-2.5 text-xs font-extrabold text-ink/70 ring-1 ring-ink/10 transition-colors hover:bg-lilac/20 hover:text-ink"
        >
          <Filter className="size-4 text-coral" />
          {showAdvanced ? "Hide advanced filters" : "Show advanced filters"}
        </button>
        <div className="inline-flex items-center gap-1.5 rounded-full bg-cream p-1 ring-1 ring-ink/10">
          <button
            type="button"
            onClick={() => setState((s) => ({ ...s, view: "grid" }))}
            aria-label="Grid view"
            className={cn(
              "grid size-9 place-items-center rounded-full transition-colors",
              state.view === "grid"
                ? "bg-coral text-paper shadow-sm"
                : "text-ink/55 hover:bg-paper",
            )}
          >
            <Grid2X2 className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setState((s) => ({ ...s, view: "list" }))}
            aria-label="List view"
            className={cn(
              "grid size-9 place-items-center rounded-full transition-colors",
              state.view === "list"
                ? "bg-coral text-paper shadow-sm"
                : "text-ink/55 hover:bg-paper",
            )}
          >
            <LayoutList className="size-4" />
          </button>
        </div>
      </div>
      {showAdvanced && (
        <div className="space-y-5 rounded-[22px] bg-cream/60 p-4 ring-1 ring-ink/5 sm:p-5">
          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-ink/45">
                  Entry price range
                </p>
                <div className="flex items-center gap-2 text-xs font-bold">
                  <span className="rounded-full bg-lilac/30 px-3 py-1 text-ink">
                    {formatNaira(state.priceMinKobo)}
                  </span>
                  <span className="text-ink/40">—</span>
                  <span className="rounded-full bg-lemon/40 px-3 py-1 text-ink">
                    {formatNaira(state.priceMaxKobo)}
                  </span>
                </div>
              </div>
              <div className="px-2">
                <Slider
                  min={priceMinBoundKobo}
                  max={priceMaxBoundKobo}
                  step={100 * 100}
                  value={[state.priceMinKobo, state.priceMaxKobo]}
                  onValueChange={([min = priceMinBoundKobo, max = priceMaxBoundKobo]) =>
                    setState((s) => ({
                      ...s,
                      priceMinKobo: min,
                      priceMaxKobo: max,
                      page: 1,
                    }))
                  }
                  className="[&_[role=slider]]:h-5 [&_[role=slider]]:w-5 [&_[role=slider]]:border-coral [&_[role=slider]]:bg-paper [&_[role=slider]]:shadow [&_[type=range]]:h-2"
                />
              </div>
              <div className="flex items-center justify-between text-[11px] font-bold text-ink/40">
                <span>{formatNaira(priceMinBoundKobo)}</span>
                <span>{formatNaira(priceMaxBoundKobo)}</span>
              </div>
            </div>
            <div className="space-y-3">
              <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-ink/45">
                Partners
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {partners.map((partner) => (
                  <label
                    key={partner}
                    className="flex items-center gap-2.5 rounded-full bg-paper px-3 py-2 text-xs font-bold text-ink ring-1 ring-ink/10 cursor-pointer hover:bg-lilac/15"
                  >
                    <Checkbox
                      checked={state.partners.includes(partner)}
                      onCheckedChange={(checked) =>
                        setState((s) => {
                          const set = new Set(s.partners);
                          if (checked) set.add(partner);
                          else set.delete(partner);
                          return { ...s, partners: Array.from(set), page: 1 };
                        })
                      }
                      className="border-coral/50 data-[state=checked]:bg-coral data-[state=checked]:text-paper data-[state=checked]:border-coral"
                    />
                    {partner}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className="h-7 rounded-full border-coral/20 bg-coral/10 px-3 text-[11px] font-extrabold text-coral"
          >
            Showing {filteredCount} of {totalCount} competitions
          </Badge>
          {activeCount > 0 && (
            <>
              {state.category !== "All" && (
                <button
                  type="button"
                  onClick={() => setState((s) => ({ ...s, category: "All", page: 1 }))}
                  className="inline-flex items-center gap-1.5 rounded-full bg-sky/15 px-3 py-1 text-[11px] font-extrabold text-ink ring-1 ring-ink/10 hover:bg-sky/25"
                >
                  ✕ {state.category}
                </button>
              )}
              {state.budget !== "all" && (
                <button
                  type="button"
                  onClick={() => setState((s) => ({ ...s, budget: "all", page: 1 }))}
                  className="inline-flex items-center gap-1.5 rounded-full bg-coral/15 px-3 py-1 text-[11px] font-extrabold text-ink ring-1 ring-coral/25 hover:bg-coral/25"
                >
                  ✕ {BUDGET_FILTERS.find((b) => b.id === state.budget)?.label ?? state.budget}
                </button>
              )}
              {state.status !== "all" && (
                <button
                  type="button"
                  onClick={() => setState((s) => ({ ...s, status: "all", page: 1 }))}
                  className="inline-flex items-center gap-1.5 rounded-full bg-mint/25 px-3 py-1 text-[11px] font-extrabold text-ink ring-1 ring-ink/10 hover:bg-mint/40"
                >
                  ✕{" "}
                  {
                    {
                      live: "Live now",
                      "starting-soon": "Starting soon",
                      "ending-soon": "Ending soon",
                      completed: "Completed",
                      all: "All",
                    }[state.status]
                  }
                </button>
              )}
              {state.partners.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() =>
                    setState((s) => ({
                      ...s,
                      partners: s.partners.filter((x) => x !== p),
                      page: 1,
                    }))
                  }
                  className="inline-flex items-center gap-1.5 rounded-full bg-lemon/30 px-3 py-1 text-[11px] font-extrabold text-ink ring-1 ring-ink/10 hover:bg-lemon/50"
                >
                  ✕ {p}
                </button>
              ))}
              {activeCount > 0 && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="inline-flex items-center gap-1.5 rounded-full bg-paper px-3 py-1 text-[11px] font-extrabold text-ink/65 ring-1 ring-ink/10 hover:bg-cream hover:text-ink"
                >
                  Clear all
                </button>
              )}
            </>
          )}
        </div>
        <span className="hidden items-center gap-1.5 text-xs font-extrabold text-ink/50 sm:inline-flex">
          <Clock3 className="size-3.5" /> Updated for preview
        </span>
      </div>
    </div>
  );
}

export function CompetitionsPage() {
  const { activeCompetitions } = useCompetitions();
  const [state, setState] = useState<CompetitionsFilterState>({
    query: "",
    category: "All",
    budget: "all",
    sort: "ending-soon",
    status: "all",
    priceMinKobo: priceMinBoundKobo,
    priceMaxKobo: priceMaxBoundKobo,
    partners: [],
    page: 1,
    view: "grid",
  });
  const [modalSlug, setModalSlug] = useState<string | null>(null);
  const [modalQty, setModalQty] = useState<number>(1);
  const filtered = useMemo(() => {
    const q = state.query.trim().toLowerCase();
    const list = activeCompetitions.filter((c) => {
      if (state.category !== "All" && c.category !== state.category) return false;
      if (!matchesBudget(c.entryPrice, (state.budget as any) ?? "all")) return false;
      if (q) {
        const hay =
          `${c.title} ${c.description} ${c.partner} ${c.category} ${c.specs.join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (c.entryPrice < state.priceMinKobo || c.entryPrice > state.priceMaxKobo) return false;
      if (state.partners.length > 0 && !state.partners.includes(c.partner)) return false;
      switch (state.status) {
        case "live":
          if (c.status !== "LIVE") return false;
          break;
        case "starting-soon":
          if (c.status !== "UPCOMING") return false;
          break;
        case "ending-soon":
          if (c.daysUntilClose > 7) return false;
          break;
      }
      return true;
    });
    return applySort(list, state.sort);
  }, [state, activeCompetitions]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(state.page, totalPages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-14">
      <PageIntro
        eyebrow="The marketplace"
        title="Choose your next possibility."
        text="Premium prizes, straightforward entries, and a competition journey you can actually follow."
      />
      <CompetitionsFilterBar
        state={state}
        setState={setState}
        totalCount={activeCompetitions.length}
        filteredCount={filtered.length}
      />
      {filtered.length === 0 ? (
        <div className="mt-10">
          <Card className="overflow-hidden rounded-[28px] border-0 bg-paper p-8 text-center shadow-sm ring-1 ring-ink/5 sm:p-12">
            <div className="mx-auto grid size-16 place-items-center rounded-3xl bg-lemon/40 text-coral">
              <Search className="size-7" />
            </div>
            <h2 className="mt-6 font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
              No competitions match your filters
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-ink/60">
              Try removing a category, widening the entry-price range, or clearing a partner filter.
            </p>
            <div className="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row">
              <Button
                variant="primary"
                size="md"
                onClick={() =>
                  setState((s) => ({
                    ...s,
                    query: "",
                    category: "All",
                    budget: "all",
                    status: "all",
                    partners: [],
                    priceMinKobo: priceMinBoundKobo,
                    priceMaxKobo: priceMaxBoundKobo,
                    page: 1,
                  }))
                }
              >
                Clear filters
              </Button>
              <Button asChild variant="outline" size="md">
                <Link to="/competitions">Reset page</Link>
              </Button>
            </div>
          </Card>
        </div>
      ) : (
        <>
          <div
            className={cn(
              "mt-8 gap-4",
              state.view === "grid"
                ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
                : "flex flex-col",
            )}
          >
            {paged.map((competition) => (
              <CompetitionCard
                key={competition.slug}
                competition={competition}
                variant={state.view}
                onEnterDraw={(qty) => {
                  setModalQty(qty);
                  setModalSlug(competition.slug);
                }}
              />
            ))}
          </div>
          {totalPages > 1 && (
            <div className="mt-10">
              <Pagination>
                <PaginationContent className="gap-1">
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      size="sm"
                      onClick={(event) => {
                        event.preventDefault();
                        setState((s) => ({ ...s, page: Math.max(1, s.page - 1) }));
                      }}
                      className={cn(
                        "h-10 rounded-full text-xs font-extrabold",
                        safePage <= 1 ? "pointer-events-none opacity-40" : "",
                      )}
                    />
                  </PaginationItem>
                  {Array.from({ length: totalPages }).map((_, i) => {
                    const page = i + 1;
                    const show =
                      page === 1 || page === totalPages || Math.abs(page - safePage) <= 1;
                    const needsEllipsisBefore = i > 0 && page === 2 && Math.abs(1 - safePage) > 1;
                    const needsEllipsisAfter =
                      page === totalPages - 1 && Math.abs(totalPages - safePage) > 1;
                    return (
                      <div key={page} className="contents">
                        {needsEllipsisBefore && (
                          <PaginationItem>
                            <PaginationEllipsis />
                          </PaginationItem>
                        )}
                        {show && (
                          <PaginationItem>
                            <PaginationLink
                              href="#"
                              size="sm"
                              isActive={page === safePage}
                              onClick={(event) => {
                                event.preventDefault();
                                setState((s) => ({ ...s, page }));
                              }}
                              className="h-10 w-10 rounded-full text-xs font-extrabold"
                            >
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        )}
                        {needsEllipsisAfter && (
                          <PaginationItem>
                            <PaginationEllipsis />
                          </PaginationItem>
                        )}
                      </div>
                    );
                  })}
                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      size="sm"
                      onClick={(event) => {
                        event.preventDefault();
                        setState((s) => ({ ...s, page: Math.min(totalPages, s.page + 1) }));
                      }}
                      className={cn(
                        "h-10 rounded-full text-xs font-extrabold",
                        safePage >= totalPages ? "pointer-events-none opacity-40" : "",
                      )}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </>
      )}
      <TicketPurchaseModal
        open={!!modalSlug}
        onClose={() => setModalSlug(null)}
        competitionSlug={modalSlug ?? ""}
        initialQuantity={modalQty}
      />
    </div>
  );
}

function CountdownUnit({
  value,
  label,
  accent,
}: {
  value: number;
  label: string;
  accent?: boolean;
}) {
  const str = value.toString().padStart(2, "0");
  return (
    <div className="grid place-items-center">
      <div
        className={`rounded-2xl px-3 py-2 ring-1 ring-ink/10 ${
          accent ? "bg-coral/10 ring-coral/20 min-w-[72px]" : "bg-paper min-w-[56px]"
        }`}
      >
        <span
          className={`font-display font-extrabold text-ink tabular-nums ${
            accent ? "text-2xl" : "text-lg"
          }`}
        >
          {str}
        </span>
      </div>
      <span className="mt-1.5 text-[10px] font-extrabold uppercase tracking-wider text-ink/45">
        {label}
      </span>
    </div>
  );
}

function LiveCountdownPill({ competition }: { competition: Competition }) {
  const { d, h, m, s } = useCountdownDays(Math.max(1, competition.daysUntilClose));
  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-coral/15 px-3 py-1.5 ring-1 ring-coral/25">
      <span className="relative flex size-2 items-center justify-center">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-coral/60 opacity-70" />
        <span className="relative inline-flex size-2 rounded-full bg-coral" />
      </span>
      <span className="text-[11px] font-extrabold text-ink">
        Live · {d}d {h.toString().padStart(2, "0")}:{m.toString().padStart(2, "0")}:
        {s.toString().padStart(2, "0")}
      </span>
    </div>
  );
}

export function CompetitionDetailPage() {
  const { slug } = useParams({ from: "/competitions/$slug" });
  const { competitions, loading } = useCompetitions();
  const [modalOpen, setModalOpen] = useState(false);
  const heroRef = useRef<HTMLDivElement | null>(null);
  const [showStickyBar, setShowStickyBar] = useState(false);
  const competition = findCompetition(competitions, slug);
  const [qty, setQty] = useState<number>(1);
  const isConcluded = isCompetitionConcluded(competition);
  const cd = useCountdownDays(Math.max(1, competition?.daysUntilClose ?? 1));
  const related = useMemo(() => {
    return competitions
      .filter((c) => c.slug !== competition?.slug && !isCompetitionConcluded(c))
      .sort(() => Math.random() - 0.5)
      .slice(0, 4);
  }, [competitions, competition?.slug]);
  const partnerCompetitions = useMemo(
    () =>
      competitions
        .filter(
          (c) =>
            c.partner === competition?.partner &&
            c.slug !== competition?.slug &&
            !isCompetitionConcluded(c),
        )
        .slice(0, 3),
    [competitions, competition?.partner, competition?.slug],
  );

  const assignedPartner = useMemo(() => {
    // Staff-created competitions display as Rafilla's own — never attach them
    // to a placeholder partner account from the store.
    if (!competition?.partner || competition.partner === "Raffila") return null;
    const partners = partnerStore.getAllPartners();
    return (
      partners.find(
        (p) =>
          p.businessName.toLowerCase().includes(competition.partner.toLowerCase()) ||
          competition.partner.toLowerCase().includes(p.businessName.toLowerCase()),
      ) || null
    );
  }, [competition?.partner]);

  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) setShowStickyBar(true);
          else setShowStickyBar(false);
        });
      },
      { root: null, threshold: 0, rootMargin: "-80px 0px 0px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [slug]);

  if (!competition && loading)
    return (
      <div className="mx-auto max-w-7xl px-4 py-24 text-center sm:px-6">
        <p className="font-display text-2xl font-extrabold text-ink">Loading competition…</p>
      </div>
    );

  if (!competition)
    return (
      <MissingPage
        title="Competition unavailable"
        text="This competition may have moved or is not available in the current preview."
      />
    );

  const progress = getProgress(competition);
  const ticketsLeft = Math.max(0, competition.totalEntries - competition.entriesSold);
  const maxQty = Math.max(1, Math.min(50, ticketsLeft));
  const safeQty = Math.max(1, Math.min(maxQty, qty));
  const totalKobo = competition.entryPrice * safeQty;
  const chancePct = competition.totalEntries > 0 ? (safeQty / competition.totalEntries) * 100 : 0;
  const chanceLabel =
    safeQty <= 1
      ? "Buy more tickets to improve your odds"
      : chancePct >= 10
        ? `${chancePct.toFixed(1)}% chance of winning`
        : `${safeQty.toLocaleString("en-NG")}× better chance than 1 ticket`;
  const initials = competition.partner
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("");

  return (
    <>
      <div
        className={cn(
          "sticky top-[64px] z-40 w-full border-b border-ink/10 bg-cream/95 backdrop-blur transition-all duration-300",
          showStickyBar
            ? "translate-y-0 opacity-100"
            : "-translate-y-2 opacity-0 pointer-events-none",
        )}
      >
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:px-8">
          <div className="min-w-0 flex-1 lg:pr-4">
            <p className="truncate font-display text-sm font-extrabold text-ink sm:text-base">
              {competition.title}
            </p>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <LiveCountdownPill competition={competition} />
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-raf-green">
                <BadgeCheck className="size-3" /> {chanceLabel}
              </span>
            </div>
          </div>
          <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
            <div className="hidden text-right sm:block lg:block">
              <p className="text-[10px] font-bold uppercase tracking-wider text-ink/40">
                {`${safeQty} ticket${safeQty === 1 ? "" : "s"} · Total`}
              </p>
              <p className="font-display text-xl font-extrabold text-ink tabular-nums">
                {formatNaira(totalKobo)}
              </p>
            </div>
            {isConcluded ? (
              <Button
                asChild
                size="sm"
                className="bg-[#0A261B] hover:bg-[#133E2B] text-cream font-extrabold"
              >
                <Link to="/competitions/$slug/draw" params={{ slug: competition.slug }}>
                  🎯 Watch Draw Replay
                </Link>
              </Button>
            ) : (
              <>
                <QuantityStepper value={safeQty} onChange={setQty} min={1} max={maxQty} size="sm" />
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setModalOpen(true)}
                  className="shrink-0 shadow-[0_12px_28px_-12px_var(--coral)]"
                  disabled={ticketsLeft === 0}
                >
                  <Ticket className="size-3.5" /> Enter draw
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-14">
        <Breadcrumb className="whitespace-nowrap">
          <BreadcrumbList className="overflow-hidden">
            <BreadcrumbItem className="shrink-0">
              <BreadcrumbLink asChild>
                <Link to="/" className="text-xs font-bold text-ink/55 hover:text-ink">
                  <Home className="mr-1 inline size-3.5" />
                  Home
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator>
              <ChevronRight className="size-3.5 text-ink/35" />
            </BreadcrumbSeparator>
            <BreadcrumbItem className="shrink-0">
              <BreadcrumbLink asChild>
                <Link to="/competitions" className="text-xs font-bold text-ink/55 hover:text-ink">
                  Competitions
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator>
              <ChevronRight className="size-3.5 text-ink/35" />
            </BreadcrumbSeparator>
            <BreadcrumbItem className="shrink-0">
              <span className="text-xs font-bold text-ink/55">{competition.category}</span>
            </BreadcrumbItem>
            <BreadcrumbSeparator>
              <ChevronRight className="size-3.5 text-ink/35" />
            </BreadcrumbSeparator>
            <BreadcrumbItem className="min-w-0 max-w-[180px] sm:max-w-[320px]">
              <BreadcrumbPage className="block truncate whitespace-nowrap overflow-hidden text-ellipsis text-xs font-extrabold text-ink">
                {competition.title}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {isConcluded && (
          <div className="mt-6 rounded-[24px] bg-gradient-to-r from-[#0D2F24] via-[#144C39] to-[#0A261B] p-5 text-cream ring-1 ring-[#D4AF37]/30 shadow-lg">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#D4AF37]/20 text-[#D4AF37]">
                  <Trophy className="size-6 text-[#D4AF37]" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#D4AF37]/20 px-2.5 py-0.5 text-[11px] font-extrabold text-[#D4AF37]">
                      DRAW CONCLUDED
                    </span>
                    <span className="text-xs font-mono font-bold text-cream/70">
                      Ticket #
                      {competition.winnerTicketNumber || competition.winningTicketNumber || "—"}
                    </span>
                  </div>
                  <p className="mt-1 font-display text-base sm:text-lg font-extrabold text-white">
                    Winner: {competition.winnerDisplayName || "Verified Winner"}
                  </p>
                  <p className="text-xs text-cream/75">
                    This draw has concluded and results are publicly verifiable. No new entries can
                    be purchased.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  asChild
                  size="sm"
                  className="bg-[#D4AF37] hover:bg-[#E5C158] text-[#0A261B] font-extrabold"
                >
                  <Link to="/competitions/$slug/draw" params={{ slug: competition.slug }}>
                    🎯 Watch Draw Experience
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="border-cream/30 text-cream hover:bg-cream/10 font-bold"
                >
                  <Link to="/winners">🏆 Winners Circle</Link>
                </Button>
              </div>
            </div>
          </div>
        )}

        <div
          ref={heroRef}
          className="mt-6 grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-start lg:gap-8"
        >
          <div className="overflow-hidden rounded-[28px] bg-lilac/30 p-2 ring-1 ring-ink/5 sm:p-3">
            <img
              src={competition.image}
              alt={`${competition.title} prize`}
              width={1200}
              height={760}
              className="aspect-[4/3] w-full rounded-[22px] object-contain"
            />
          </div>
          <div className="rounded-[28px] bg-paper p-5 ring-1 ring-ink/5 sm:p-6 lg:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <Pill {...(competition.accent === "coral" ? { tone: "coral" } : {})}>
                {competition.category}
              </Pill>
              <Badge className="h-6 rounded-full bg-mint/30 px-3 text-[11px] font-extrabold text-ink ring-0">
                {competition.status}
              </Badge>
              <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-cream px-3 py-1 text-[11px] font-extrabold text-ink ring-1 ring-ink/10 shadow-xs">
                <Handshake className="size-3.5 text-coral" />
                In Partnership with{" "}
                <span className="text-coral font-black">
                  {assignedPartner?.businessName || competition.partner}
                </span>
                <BadgeCheck className="size-3.5 text-mint-700" />
              </span>
            </div>
            <h1 className="mt-5 font-display text-4xl font-extrabold leading-tight tracking-tight text-ink sm:text-5xl">
              {competition.title}
            </h1>
            <p className="mt-3 text-base leading-relaxed text-ink/60">{competition.description}</p>
            <div className="mt-7 border-y border-ink/10 py-5">
              <p className="text-xs font-bold text-ink/45">Entry price</p>
              <p className="mt-1 break-words font-display text-xl font-extrabold text-ink sm:text-2xl">
                {formatNaira(competition.entryPrice)}
              </p>
            </div>
            <div className="mt-6">
              <div className="flex items-center justify-between text-sm font-bold">
                <span className="text-ink/55">Sales progress</span>
              </div>
              <Progress value={progress} className="mt-2 h-3 bg-ink/10 [&>div]:bg-coral" />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 xs:grid-cols-2">
              <div className="rounded-2xl bg-cream p-3 ring-1 ring-ink/5">
                <div className="text-[10px] font-extrabold uppercase tracking-wide text-ink/45">
                  Ends in
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <CountdownUnit value={cd.d} label="days" accent />
                  <CountdownUnit value={cd.h} label="hrs" />
                  <CountdownUnit value={cd.m} label="min" />
                  <CountdownUnit value={cd.s} label="sec" />
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl bg-lemon/30 p-3 ring-1 ring-ink/5">
                <CalendarDays className="size-5 text-coral shrink-0" />
                <div className="min-w-0">
                  <p className="truncate text-[10px] font-extrabold uppercase tracking-wide text-ink/45">
                    Closes
                  </p>
                  <p className="truncate text-xs font-extrabold text-ink">{competition.closes}</p>
                </div>
              </div>
            </div>
            <div className="mt-6 space-y-4">
              {isConcluded ? (
                <div className="space-y-4">
                  <div className="rounded-2xl bg-[#0D2F24]/10 p-5 ring-1 ring-[#0D2F24]/20">
                    <div className="flex items-center gap-3">
                      <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#D4AF37]/20 text-[#0A261B]">
                        <Trophy className="size-6 text-[#D4AF37]" />
                      </span>
                      <div>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-extrabold text-emerald-800">
                          DRAW CONCLUDED
                        </span>
                        <p className="mt-1 font-display text-base font-extrabold text-ink">
                          Winner: {competition.winnerDisplayName || "Verified Winner"}
                        </p>
                        <p className="font-mono text-xs font-bold text-ink/70">
                          Winning Ticket: #
                          {competition.winnerTicketNumber || competition.winningTicketNumber || "—"}
                        </p>
                      </div>
                    </div>
                  </div>
                  <Button
                    asChild
                    size="lg"
                    className="min-h-12 w-full text-base bg-[#0A261B] hover:bg-[#133E2B] text-cream font-extrabold shadow-lg"
                  >
                    <Link to="/competitions/$slug/draw" params={{ slug: competition.slug }}>
                      🎯 Watch Draw Replay &amp; Wheel of Fortune <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                  <div className="grid grid-cols-2 gap-2">
                    <Button asChild variant="outline" size="sm" className="w-full">
                      <Link to="/winners">🏆 Winners Circle</Link>
                    </Button>
                    <Button asChild variant="outline" size="sm" className="w-full">
                      <Link to="/draw-verification/$slug" params={{ slug: competition.slug }}>
                        🔍 Verification
                      </Link>
                    </Button>
                  </div>
                  <p className="text-center text-xs font-bold text-ink/50">
                    Entries permanently closed. Draw verified on blockchain snapshot.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-3 rounded-2xl bg-cream p-4 ring-1 ring-ink/5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-[10px] font-extrabold uppercase tracking-wider text-ink/40">
                        Your tickets
                      </p>
                      <p className="mt-1 font-display text-sm font-extrabold text-ink">
                        {`${safeQty} × ${formatNaira(competition.entryPrice)} entr${safeQty === 1 ? "y" : "ies"}`}
                      </p>
                    </div>
                    <QuantityStepper
                      value={safeQty}
                      onChange={setQty}
                      min={1}
                      max={maxQty}
                      size="md"
                    />
                    <div className="text-left sm:text-right">
                      <p className="text-[10px] font-extrabold uppercase tracking-wider text-ink/40">
                        Total
                      </p>
                      <p className="break-words font-display text-2xl font-extrabold text-ink tabular-nums">
                        {formatNaira(totalKobo)}
                      </p>
                    </div>
                  </div>
                  <div className="rounded-2xl bg-raf-lime/25 px-4 py-3 ring-1 ring-raf-lime/40">
                    <p className="text-[12px] font-extrabold text-ink">
                      <Ticket className="mr-1 inline size-4 text-raf-green" /> {chanceLabel}
                      {safeQty > 1 && (
                        <span className="ml-2 font-bold text-ink/55">
                          (buy more tickets to improve your odds)
                        </span>
                      )}
                    </p>
                  </div>
                  {(competition.status as string) === "DRAW_READY" ||
                  (competition.status as string) === "DRAW_IN_PROGRESS" ? (
                    <Button
                      asChild
                      size="lg"
                      className="min-h-12 w-full text-base bg-gradient-to-r from-[#D4AF37] to-[#E5C158] hover:from-[#E5C158] hover:to-[#D4AF37] text-[#0A261B] font-extrabold shadow-lg"
                    >
                      <Link to="/competitions/$slug/draw" params={{ slug: competition.slug }}>
                        🎯 Watch Live Draw on Wheel of Fortune <ArrowRight className="size-4" />
                      </Link>
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      size="lg"
                      className="min-h-12 w-full text-base shadow-[0_12px_28px_-12px_var(--coral)]"
                      onClick={() => setModalOpen(true)}
                      disabled={ticketsLeft === 0}
                    >
                      <Ticket className="size-4" />
                      {`Enter for ${formatNaira(totalKobo)} · ${safeQty} ticket${safeQty === 1 ? "" : "s"}`}{" "}
                      <ArrowRight className="size-4" />
                    </Button>
                  )}
                  <p className="text-center text-xs font-bold text-ink/60">
                    Closes {competition.closes} · Draw {competition.drawDate}
                  </p>
                  <p className="text-center text-xs font-bold text-ink/45">
                    Tickets reserved for 5 minutes · Wallet &amp; Referrals only · Limit {maxQty}{" "}
                    tickets per draw ·{" "}
                    <Link
                      to="/faq"
                      className="font-extrabold text-coral underline underline-offset-2"
                    >
                      Get help with this entry
                    </Link>
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Trust at point of payment (PDF §5): summary + trust panels */}
        <div className="mt-8 grid gap-3 lg:grid-cols-3">
          <div className="rounded-[22px] bg-paper p-5 ring-1 ring-ink/5">
            <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.14em] text-ink/45">
              <BadgeCheck className="size-4 text-mint" /> Prize verified
            </p>
            <p className="mt-2 text-sm font-bold leading-relaxed text-ink/70">
              {competition.prizeCondition}. Partner {competition.partner} verified.{" "}
              {competition.warranty ? `${competition.warranty}. ` : ""}Serial {competition.serialNo}
              .
            </p>
            <Link
              to="/trust-safety"
              className="mt-2 inline-flex items-center gap-1 text-xs font-extrabold text-coral hover:underline"
            >
              How we verify <ArrowRight className="size-3.5" />
            </Link>
          </div>
          <div className="rounded-[22px] bg-paper p-5 ring-1 ring-ink/5">
            <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.14em] text-ink/45">
              <ShieldCheck className="size-4 text-coral" /> How the draw works
            </p>
            <p className="mt-2 text-sm font-bold leading-relaxed text-ink/70">
              Entries freeze at close. Winner picked by verifiable draw and published publicly.
              Draw: {competition.drawDate}.
            </p>
            <Link
              to="/draw-verification/$campaign"
              params={{ campaign: competition.slug }}
              className="mt-2 inline-flex items-center gap-1 text-xs font-extrabold text-coral hover:underline"
            >
              Verify a draw <ArrowRight className="size-3.5" />
            </Link>
          </div>
          <div className="rounded-[22px] bg-paper p-5 ring-1 ring-ink/5">
            <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.14em] text-ink/45">
              <Award className="size-4 text-raf-gold" /> What happens if I win?
            </p>
            <p className="mt-2 text-sm font-bold leading-relaxed text-ink/70">
              We contact you within 48 hours, verify your account, and arrange delivery or
              collection. See prize condition, delivery and FAQs below.
            </p>
            <Link
              to="/winners"
              className="mt-2 inline-flex items-center gap-1 text-xs font-extrabold text-coral hover:underline"
            >
              See real winners <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>

        {/* Partner Info Card (Requirement 31) */}
        {assignedPartner && (
          <div className="mt-8 rounded-[28px] border border-ink/10 bg-white p-6 shadow-xs sm:p-7">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-4">
                <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-paper border border-ink/10 font-display text-xl font-extrabold text-coral shadow-inner">
                  {assignedPartner.businessName.slice(0, 2).toUpperCase()}
                </div>
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-ink/40">
                      Sourced &amp; Consigned By
                    </span>
                    <Badge className="bg-mint/40 text-ink border-mint text-[10px] font-extrabold rounded-full px-2.5 py-0.5 shadow-none">
                      <CheckCircle2 className="size-3 mr-1 text-mint-700 inline" /> Verified
                      Enterprise Partner
                    </Badge>
                  </div>
                  <h3 className="font-display text-xl font-extrabold text-ink">
                    {assignedPartner.businessName}
                  </h3>
                  <p className="flex items-center gap-1.5 text-xs font-medium text-ink/65">
                    <MapPin className="size-3.5 text-coral shrink-0" />
                    {assignedPartner.address || "Lagos, Nigeria"}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <a
                  href={`mailto:${assignedPartner.companyEmail || "partner@raffila.ng"}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-paper px-4 py-2 text-xs font-bold text-ink hover:bg-white transition"
                >
                  <Mail className="size-3.5 text-coral" /> Contact Partner
                </a>
                <a
                  href="https://raffila.com"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-paper px-4 py-2 text-xs font-bold text-ink hover:bg-white transition"
                >
                  <Globe className="size-3.5 text-coral" /> Partner Website
                </a>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-ink/10 flex items-center gap-2.5 text-xs font-bold text-ink/70 bg-paper/60 rounded-xl px-4 py-3">
              <ShieldCheck className="size-4 text-mint-700 shrink-0" />
              <span>
                <strong className="text-ink font-extrabold">Custody &amp; Escrow Guarantee:</strong>{" "}
                All assets verified and held in escrow/custody prior to draw.
              </span>
            </div>
          </div>
        )}

        <div className="mt-10 grid gap-3 grid-cols-1 xs:grid-cols-2 lg:grid-cols-4">
          <Card className="rounded-2xl border-0 bg-paper p-5 shadow-sm ring-1 ring-ink/5">
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-xl bg-mint/30 text-ink">
                <ShieldCheck className="size-4" />
              </span>
              <span className="inline-flex h-6 items-center rounded-full bg-mint/25 px-2 text-[10px] font-extrabold text-ink">
                Verified
              </span>
            </div>
            <h3 className="mt-4 font-display text-base font-extrabold text-ink">
              Verified draw by Raffila
            </h3>
            <p className="mt-1 text-xs font-bold leading-relaxed text-ink/55">
              Secure HMAC_DRBG algorithm, published seed &amp; frozen entry set.
            </p>
            <Link
              to="/draw-verification/$campaign"
              params={{ campaign: competition.slug }}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-extrabold text-coral hover:underline"
            >
              Draw verification <ExternalLink className="size-3.5" />
            </Link>
          </Card>
          <Card className="rounded-2xl border-0 bg-paper p-5 shadow-sm ring-1 ring-ink/5">
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-xl bg-sky/20 text-ink">
                <ShieldAlert className="size-4" />
              </span>
              <span className="inline-flex h-6 items-center rounded-full bg-sky/20 px-2 text-[10px] font-extrabold text-ink">
                Insured
              </span>
            </div>
            <h3 className="mt-4 font-display text-base font-extrabold text-ink">
              Insured prize value
            </h3>
            <p className="mt-1 text-xs font-bold leading-relaxed text-ink/55">
              {formatNaira(competition.prizeValueKobo)} policy backed A+ rated insurance.
            </p>
            <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-extrabold text-ink/65">
              <Award className="size-3.5 text-sky" /> A+ rated Leadway Assurance
            </span>
          </Card>
          <Card className="rounded-2xl border-0 bg-paper p-5 shadow-sm ring-1 ring-ink/5">
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-xl bg-lemon/40 text-ink">
                <CalendarDays className="size-4" />
              </span>
              <span className="inline-flex h-6 items-center rounded-full bg-lemon/40 px-2 text-[10px] font-extrabold text-ink">
                Draw date
              </span>
            </div>
            <h3 className="mt-4 font-display text-base font-extrabold text-ink">
              Draw date &amp; time
            </h3>
            <p className="mt-1 text-xs font-bold leading-relaxed text-ink/55">
              {competition.drawDate}
            </p>
            <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-extrabold text-ink/65">
              <PlayCircle className="size-3.5 text-lemon" /> Live stream link published
            </span>
          </Card>
          <Card className="rounded-2xl border-0 bg-paper p-5 shadow-sm ring-1 ring-ink/5">
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-xl bg-lilac/30 text-ink">
                <Award className="size-4" />
              </span>
              <span className="inline-flex h-6 items-center rounded-full bg-lilac/25 px-2 text-[10px] font-extrabold text-ink">
                Prize
              </span>
            </div>
            <h3 className="mt-4 font-display text-base font-extrabold text-ink">Prize condition</h3>
            <p className="mt-1 text-xs font-bold leading-relaxed text-ink/55">
              {competition.prizeCondition}. {competition.warranty}.
            </p>
            <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-extrabold text-ink/65">
              <Shield className="size-3.5 text-lilac" /> All prizes 100% verified sourced
            </span>
          </Card>
        </div>
        <section className="mt-10">
          <Tabs defaultValue="description" className="w-full">
            <div className="mb-5 overflow-x-auto rounded-full bg-cream px-2 py-2 ring-1 ring-ink/5 scrollbar-none">
              <TabsList className="h-auto w-max min-w-full gap-1 bg-transparent p-0">
                {(
                  [
                    ["description", "Description"],
                    ["specs", "Prize specs"],
                    ["tickets", "Ticket info"],
                    ["rules", "Rules"],
                    ["faqs", "FAQs"],
                    ["partner", "About the partner"],
                  ] as const
                ).map(([value, label]) => (
                  <TabsTrigger
                    key={value}
                    value={value}
                    className="h-9 rounded-full px-3.5 text-xs font-extrabold data-[state=active]:bg-coral data-[state=active]:text-paper data-[state=active]:shadow-[0_6px_16px_-6px_var(--coral)]"
                  >
                    {label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            <TabsContent value="description">
              <div className="rounded-[28px] bg-paper p-6 ring-1 ring-ink/5 sm:p-8">
                <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-ink/45">
                  Full description
                </p>
                <h2 className="mt-2 font-display text-2xl font-extrabold text-ink">
                  The complete story of this prize
                </h2>
                <div className="mt-6 space-y-4 text-sm leading-relaxed text-ink/65">
                  <p>{competition.description}</p>
                  <p>
                    Every Raffila competition is curated to deliver a genuinely life-changing prize
                    that you would be proud to own. This listing has been through our full diligence
                    process: authenticity checks, partner verification, insurance confirmation, and
                    a handover plan that is reviewed before the draw ever takes place.
                  </p>
                  <p>
                    For this specific competition, the prize has been physically inspected where
                    applicable, photographed in our own studio, and all supporting documentation
                    (certificates, warranties, proof of ownership) is held safely with our legal
                    partners until the winner claim is complete.
                  </p>
                  <p>
                    Entering is simple: you buy tickets at the published price, every ticket gets a
                    unique entry number, and once the competition closes the full eligible set is
                    frozen, published, and the draw algorithm runs with full public transparency so
                    anyone — you included — can independently verify that the result was fair.
                  </p>
                  <p>
                    If you win, our dedicated winners concierge will walk you through every step: ID
                    verification, optional public announcement, prize handover logistics, and any
                    documentation or registration required to make the prize truly yours.
                  </p>
                </div>
                <div className="mt-8">
                  <h3 className="font-display text-lg font-extrabold text-ink">
                    Why winners love this prize
                  </h3>
                  <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                    {[
                      "Authenticity verified before the draw",
                      "Insurance-backed prize value policy",
                      "Dedicated winner concierge team",
                      "Flexible delivery / collection options",
                      "Full documentation transfer included",
                      "No hidden winner fees or charges",
                      "Published verification record post-draw",
                    ].map((point) => (
                      <li
                        key={point}
                        className="flex items-start gap-2 rounded-xl bg-cream px-3 py-2 text-xs font-bold text-ink/70 ring-1 ring-ink/5"
                      >
                        <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-mint/40 text-[10px] text-ink">
                          ✓
                        </span>
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="specs">
              <div className="rounded-[28px] bg-paper p-6 ring-1 ring-ink/5 sm:p-8">
                <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-ink/45">
                  Prize specifications
                </p>
                <h2 className="mt-2 font-display text-2xl font-extrabold text-ink">
                  Everything you need to know
                </h2>
                <div className="mt-6 grid gap-px overflow-hidden rounded-2xl bg-ink/10 ring-1 ring-ink/10 grid-cols-1 sm:grid-cols-2">
                  {[
                    ["Category", competition.category],
                    ["Condition", competition.prizeCondition],
                    ["Make / Brand", competition.make],
                    ["Model", competition.model],
                    ["Year", competition.year.toString()],
                    ["Serial No.", competition.serialNo],
                    ["Market value", formatNaira(competition.marketValueKobo)],
                    ["Dimensions", competition.dimensions],
                    ["Color", competition.color],
                    ["Warranty info", competition.warranty],
                    ["Inclusions", competition.inclusions.join(", ")],
                    ["Exclusions", competition.exclusions.join(", ")],
                  ].map(([k, v]) => (
                    <div
                      key={k}
                      className="flex items-start justify-between gap-4 bg-paper px-4 py-3 sm:flex-col"
                    >
                      <div className="w-28 shrink-0 text-[10px] font-extrabold uppercase tracking-wide text-ink/45 sm:w-full">
                        {k}
                      </div>
                      <div className="text-right text-xs font-bold leading-relaxed text-ink sm:text-left">
                        {v}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>
            <TabsContent value="tickets">
              <div className="rounded-[28px] bg-paper p-6 ring-1 ring-ink/5 sm:p-8">
                <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-ink/45">
                  Tickets &amp; draw
                </p>
                <h2 className="mt-2 font-display text-2xl font-extrabold text-ink">
                  How entries and the draw work
                </h2>
                <div className="mt-6 grid gap-4 grid-cols-1 sm:grid-cols-2">
                  {[
                    ["Ticket price", formatNaira(competition.entryPrice)],
                    ["Max tickets per user", competition.maxTicketsPerUser.toString()],
                    ["Sold", `${progress}%`],
                    ["Availability", `${progress}% sold`],
                    ["Draw happens", competition.drawDate],
                    ["Draw method", "Cryptographic HMAC_DRBG (publicly verifiable)"],
                    ["Results published", "Email + SMS + Draw verification page"],
                    ["Claim window", "14 calendar days from draw date"],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-2xl bg-cream px-4 py-3 ring-1 ring-ink/5">
                      <p className="text-[10px] font-extrabold uppercase tracking-wide text-ink/45">
                        {k}
                      </p>
                      <p className="mt-1 text-sm font-extrabold text-ink">{v}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-6 rounded-2xl bg-lilac/25 p-5 ring-1 ring-ink/5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-extrabold text-ink/55">Entries progress</p>
                      <p className="mt-1 font-display text-lg font-extrabold text-ink">
                        {progress}% sold
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-extrabold text-coral">
                        {100 - progress}% remaining
                      </p>
                    </div>
                  </div>
                  <Progress
                    value={progress}
                    className="mt-3 h-3 bg-paper ring-1 ring-ink/10 [&>div]:bg-coral"
                  />
                </div>
              </div>
            </TabsContent>
            <TabsContent value="rules">
              <div className="rounded-[28px] bg-paper p-6 ring-1 ring-ink/5 sm:p-8">
                <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-ink/45">
                  Competition rules summary
                </p>
                <h2 className="mt-2 font-display text-2xl font-extrabold text-ink">
                  The 12 rules that matter
                </h2>
                <ol className="mt-6 space-y-3">
                  {[
                    "Organized by Raffila under the standard Competition Rules framework.",
                    "You must be 18+, a verified account holder, and resident in Nigeria to win.",
                    "Entry purchase is final once the Wallet debit completes; no refund unless the competition is cancelled by Raffila.",
                    `Maximum ${competition.maxTicketsPerUser} tickets per verified account for this competition.`,
                    "Tickets are tied to the purchasing account and cannot be transferred or gifted to another account.",
                    "The competition closes strictly at the published date/time; any pending transactions that fail to confirm in time will be refunded.",
                    "After close, all eligible entries are frozen and a cryptographic seed is published before the draw runs.",
                    "Winners are selected by HMAC_DRBG; top 3 winning numbers are each drawn, with automatic redraw only for ineligible entries.",
                    "Winners are contacted by registered email/SMS within 48 hours; full name is published only after explicit written consent.",
                    "Winner claim window is 14 calendar days; failure to complete KYC/claim triggers a verified redraw.",
                    "Prizes are delivered/handled as described in the Prize specs tab; cash alternative is not offered unless specifically stated.",
                    "Final decisions on eligibility, draws, and claims rest with Raffila; see Competition Rules page for full binding terms.",
                  ].map((rule, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-3 rounded-2xl bg-cream px-4 py-3 ring-1 ring-ink/5"
                    >
                      <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-coral text-xs font-extrabold text-paper">
                        {i + 1}
                      </span>
                      <p className="text-xs font-bold leading-relaxed text-ink/70">{rule}</p>
                    </li>
                  ))}
                </ol>
                <div className="mt-6 rounded-2xl bg-lemon/35 p-4 ring-1 ring-ink/5">
                  <Link
                    to="/competition-rules"
                    className="inline-flex items-center gap-2 text-sm font-extrabold text-ink underline decoration-coral decoration-2 underline-offset-4"
                  >
                    Read all full competition rules <ArrowRight className="size-4" />
                  </Link>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="faqs">
              <div className="rounded-[28px] bg-paper p-6 ring-1 ring-ink/5 sm:p-8">
                <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-ink/45">
                  FAQs — tickets, draw, claims
                </p>
                <h2 className="mt-2 font-display text-2xl font-extrabold text-ink">
                  Quick answers before you enter
                </h2>
                <Accordion type="single" collapsible className="mt-6 w-full">
                  {competitionFaqs.map((faq, i) => (
                    <AccordionItem
                      key={faq.q}
                      value={`faq-${i}`}
                      className="mb-3 border-0 rounded-2xl bg-cream ring-1 ring-ink/5 px-4 first:mt-0 data-[state=open]:bg-paper"
                    >
                      <AccordionTrigger className="py-4 text-left">
                        <span className="pr-4 text-sm font-extrabold text-ink">{faq.q}</span>
                      </AccordionTrigger>
                      <AccordionContent className="text-sm leading-relaxed text-ink/65 pb-4 pr-8">
                        {faq.a}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            </TabsContent>
            <TabsContent value="partner">
              <div className="rounded-[28px] bg-paper p-6 ring-1 ring-ink/5 sm:p-8">
                <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-ink/45">
                  About the prize partner
                </p>
                <div className="mt-3 flex flex-col items-start gap-4 border-y border-ink/10 py-6 sm:flex-row sm:items-center">
                  <div className="grid size-20 place-items-center rounded-3xl bg-lilac/35 font-display text-3xl font-extrabold text-ink ring-1 ring-ink/10">
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h2 className="font-display text-2xl font-extrabold text-ink">
                        {competition.partner}
                      </h2>
                      <Badge className="h-5 rounded-full bg-mint/30 px-2 text-[10px] font-extrabold text-ink ring-0">
                        <BadgeCheck className="mr-1 size-3" /> Approved
                      </Badge>
                    </div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-ink/60">
                        <MapPin className="size-3.5 text-coral" /> Lagos, Nigeria
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-ink/60">
                        <Phone className="size-3.5 text-coral" /> +234 800 000 0000
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-ink/60">
                        <Mail className="size-3.5 text-coral" /> hello@
                        {competition.partner
                          .toLowerCase()
                          .replace(/\s+/g, "")
                          .replace(/[^a-z]/g, "")}
                        .com
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-ink/60">
                        <Globe className="size-3.5 text-coral" /> www.
                        {competition.partner
                          .toLowerCase()
                          .replace(/\s+/g, "")
                          .replace(/[^a-z]/g, "")}
                        .com
                      </span>
                    </div>
                    <Button asChild variant="outline" size="sm" className="mt-4">
                      <Link to="/competitions">
                        View partner listings <ArrowUpRight className="size-3.5" />
                      </Link>
                    </Button>
                  </div>
                </div>
                <p className="mt-6 text-sm leading-relaxed text-ink/65">
                  {competition.partner} is a fully vetted Raffila prize partner. Every listed asset
                  passes authenticity, ownership, and insurance checks before any entries go on
                  sale, and the partner has committed to a documented handover process in the event
                  of a win.
                </p>
                {partnerCompetitions.length > 0 && (
                  <>
                    <h3 className="mt-8 font-display text-xl font-extrabold text-ink">
                      Recent from this partner
                    </h3>
                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      {partnerCompetitions.map((c) => (
                        <Card
                          key={c.slug}
                          className="group overflow-hidden rounded-2xl border-0 bg-paper ring-1 ring-ink/5"
                        >
                          <Link
                            to="/competitions/$slug"
                            params={{ slug: c.slug }}
                            className="block"
                          >
                            <CardContent className="p-3">
                              <img
                                src={c.image}
                                alt={`${c.title} prize`}
                                loading="lazy"
                                decoding="async"
                                className="aspect-[4/3] w-full rounded-xl object-contain"
                              />
                              <div className="mt-3 px-1">
                                <p className="truncate font-display text-sm font-extrabold text-ink group-hover:text-coral">
                                  {c.title}
                                </p>
                                <div className="mt-1 flex items-center justify-between text-[11px] font-bold">
                                  <span className="text-ink/55">{c.category}</span>
                                  <span className="text-ink">{formatNaira(c.entryPrice)}</span>
                                </div>
                              </div>
                            </CardContent>
                          </Link>
                        </Card>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </section>
        <section className="mt-14">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-ink/45">
                More where this came from
              </p>
              <h3 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
                You may also like
              </h3>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link to="/competitions">
                Browse all <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </div>
          <div className="mt-5 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((c) => (
              <CompetitionCard key={c.slug} competition={c} />
            ))}
          </div>
        </section>
        <section className="mt-14">
          <div className="rounded-[28px] bg-cream p-6 ring-1 ring-ink/10 sm:p-10">
            <div className="mx-auto max-w-2xl text-center">
              <span className="inline-flex items-center gap-2 rounded-full bg-coral/15 px-3 py-1 text-[11px] font-extrabold text-ink ring-1 ring-coral/25">
                <Sparkles className="size-3.5 text-coral" /> Only a few tickets left
              </span>
              <h3 className="mt-4 font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-ink sm:text-5xl">
                Feeling lucky?
              </h3>
              <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-ink/65 sm:text-base">
                Every ticket gets you one step closer to the draw.
              </p>
              <Button
                variant="primary"
                size="lg"
                onClick={() => setModalOpen(true)}
                className="mt-7 min-w-[220px] shadow-[0_12px_28px_-10px_var(--coral)]"
              >
                <Ticket className="size-4" /> Enter draw
              </Button>
            </div>
          </div>
        </section>
      </div>
      <TicketPurchaseModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        competitionSlug={competition.slug}
        initialQuantity={safeQty}
      />
    </>
  );
}

export function HowItWorksPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-14">
      <PageIntro
        eyebrow="Simple by design"
        title="A clear path from prize to draw."
        text="Raffila is built to make the important details easy to see, understand, and revisit."
      />
      <div className="mt-10 grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {[
          "Create your account",
          "Fund your Raffila Wallet",
          "Choose a competition",
          "Purchase your entries",
          "Watch the draw",
          "Be the winner",
        ].map((step, index) => (
          <div key={step} className="rounded-[22px] bg-paper p-5 ring-1 ring-ink/5">
            <span className="font-display text-4xl font-extrabold text-coral">{index + 1}</span>
            <h2 className="mt-5 font-display text-xl font-extrabold tracking-tight text-ink">
              {step}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink/55">
              {step === "Create your account"
                ? "Sign up in under two minutes with your name, email, phone number."
                : step === "Fund your Raffila Wallet"
                  ? "Add funds securely and see your balance instantly."
                  : step === "Choose a competition"
                    ? "Pick a prize you love and view clear entry details."
                    : step === "Purchase your entries"
                      ? "Choose your tickets, confirm, and get your entry IDs."
                      : step === "Watch the draw"
                        ? "Follow the verified live draw with full transparency."
                        : "If you win, we contact you directly and support your prize claim end-to-end."}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-8 rounded-[28px] bg-lilac/30 p-6 ring-1 ring-ink/5 sm:p-8">
        <div className="flex max-w-2xl items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-paper text-coral">
            <ShieldCheck className="size-5" />
          </span>
          <div>
            <h2 className="font-display text-2xl font-extrabold text-ink">
              Trust belongs in the product.
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink/60">
              Competition status, entry availability, and draw information should never be hidden
              behind guesswork. That is the standard Raffila is designed around.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function WinnersPage() {
  return <WinnersPagePolished />;
}

function _LegacyWinnersPage_Unused() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-14">
      <PageIntro
        eyebrow="Celebrate the journey"
        title="Winners, with the details that matter."
        text="Approved winner announcements will appear here as competitions are completed and claims are verified."
      />
      <div className="mt-10 rounded-[28px] bg-paper p-8 text-center ring-1 ring-ink/5 sm:p-12">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-lemon/50 text-coral">
          <Sparkles className="size-6" />
        </span>
        <h2 className="mt-5 font-display text-2xl font-extrabold text-ink">
          The first winner stories are on their way.
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink/55">
          When a winner is approved for publication, we’ll share the prize, competition, and draw
          verification details here.
        </p>
        <Button asChild variant="primary" size="md" className="mt-6">
          <Link to="/competitions">
            Explore competitions <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

export function PartnerPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-14">
      <PageIntro
        eyebrow="For asset owners"
        title="Put a premium asset in the spotlight."
        text="Raffila gives approved partners a clear way to submit, monitor, and grow campaigns around exceptional products and experiences."
      />
      <div className="mt-10 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {[
          {
            icon: <Ticket />,
            title: "Submit an asset",
            text: "Share the product, supporting details, images, and documentation for review.",
          },
          {
            icon: <Sparkles />,
            title: "Build a campaign",
            text: "Approved listings are shaped into a clear competition journey for entrants.",
          },
          {
            icon: <BadgeCheck />,
            title: "Track performance",
            text: "Monitor entries, campaign progress, and settlement information from your portal.",
          },
        ].map((item) => (
          <div key={item.title} className="rounded-[22px] bg-paper p-6 ring-1 ring-ink/5">
            <span className="grid size-11 place-items-center rounded-2xl bg-lilac/40 text-coral">
              {item.icon}
            </span>
            <h2 className="mt-5 font-display text-xl font-extrabold text-ink">{item.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink/55">{item.text}</p>
          </div>
        ))}
      </div>
      <div className="mt-8 flex flex-col gap-5 rounded-[28px] bg-ink p-6 text-cream sm:p-8 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-cream/50">
            Partner applications
          </p>
          <h2 className="mt-2 font-display text-3xl font-extrabold">
            Bring your asset to Raffila.
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-cream/65">
            Partner onboarding will open with profile capture, asset review, and administrator
            approval.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild variant="primary" size="lg">
            <Link to="/partner-signup">
              Fill Partner Application Form <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="lg"
            className="border-cream/20 text-cream hover:bg-cream/10"
          >
            <Link to="/contact">Contact Team</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

export function AboutPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-14">
      <PageIntro
        eyebrow="About Raffila"
        title="A better way to discover what’s next."
        text="Raffila is an African prize marketplace designed around premium products, transparent journeys, and fair chances."
      />
      <div className="mt-10 grid gap-6 grid-cols-1 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[28px] bg-paper p-6 ring-1 ring-ink/5 sm:p-8 lg:col-span-2">
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-ink/45">
            Our principles
          </p>
          <ul className="mt-5 space-y-4">
            {[
              "Transparency over noise",
              "Secure money movement",
              "Respect for every entrant",
              "Premium, approved prizes",
            ].map((principle) => (
              <li
                key={principle}
                className="flex items-center gap-3 font-display text-lg font-extrabold text-ink"
              >
                <span className="grid size-7 place-items-center rounded-full bg-paper text-sm text-coral">
                  ✓
                </span>
                {principle}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export function FAQPage() {
  const faqs = [
    {
      q: "What is Raffila?",
      a: "Raffila is a platform for premium prize competitions. You choose a competition, purchase entries, and follow the journey to the draw.",
    },
    {
      q: "How do I enter a competition?",
      a: "Create an account, fund your Raffila Wallet when wallet funding is available, choose a competition, and purchase entries.",
    },
    {
      q: "How are winners selected?",
      a: "After a competition closes, eligible entries are frozen and the draw is conducted through a secure, verifiable process.",
    },
    {
      q: "Can I withdraw my Raffila Wallet balance?",
      a: "The standard Raffila Wallet is spend-only. It is designed for funding competition entries, not cash withdrawals.",
    },
    {
      q: "What are referral earnings?",
      a: "Referral earnings are separate from the spend-only wallet. Eligible earnings may be used for entries or requested as a cash payout, subject to the applicable review process.",
    },
  ];
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 lg:py-14">
      <PageIntro
        eyebrow="Need to know"
        title="Frequently asked questions."
        text="The essentials, without the fine-print fog."
      />
      <div className="mt-10 space-y-3">
        {faqs.map((faq) => (
          <details key={faq.q} className="group rounded-[22px] bg-paper p-5 ring-1 ring-ink/5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-lg font-extrabold text-ink">
              <span>{faq.q}</span>
              <ChevronDown className="size-5 shrink-0 text-coral transition-transform group-open:rotate-180" />
            </summary>
            <p className="max-w-2xl pt-4 text-sm leading-relaxed text-ink/60">{faq.a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}

function ContactInfoCard({
  icon,
  title,
  value,
  href,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  href?: string;
  tone?: "coral" | "lemon" | "mint" | "lilac";
}) {
  const base =
    "rounded-[22px] bg-paper p-5 ring-1 ring-ink/5 transition-transform hover:-translate-y-0.5";
  const toneBg = {
    coral: "bg-coral/15",
    lemon: "bg-lemon/40",
    mint: "bg-mint/25",
    lilac: "bg-lilac/30",
  };
  const wrapper = href ? "a" : "div";
  const Comp = wrapper as React.ElementType;
  return (
    <Comp {...(href ? { href } : {})} className={base}>
      <span
        className={`inline-flex size-11 items-center justify-center rounded-2xl ${toneBg[tone ?? "coral"]} text-coral`}
      >
        {icon}
      </span>
      <h3 className="mt-4 font-display text-lg font-extrabold text-ink">{title}</h3>
      <p className="mt-1 text-sm font-bold text-ink/55">{value}</p>
    </Comp>
  );
}

type ContactCategory = "general" | "support" | "partner" | "press" | "prize-claim" | "bug-report";

type ContactFormState = {
  fullName: string;
  email: string;
  subject: string;
  category: ContactCategory | "";
  message: string;
};

type FormErrors = Partial<Record<keyof ContactFormState, string>>;

function generateRef(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function validateEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

function validateForm(state: ContactFormState): FormErrors {
  const errors: FormErrors = {};
  if (!state.fullName.trim() || state.fullName.trim().length < 2)
    errors.fullName = "Please enter your full name (min 2 chars).";
  if (!state.email.trim() || !validateEmail(state.email))
    errors.email = "Please enter a valid email address.";
  if (!state.subject.trim() || state.subject.trim().length < 3)
    errors.subject = "Please add a subject (min 3 chars).";
  if (!state.category) errors.category = "Please select a category.";
  if (state.message.trim().length < 20) errors.message = "Message must be at least 20 characters.";
  if (state.message.length > 2000) errors.message = "Message cannot exceed 2000 characters.";
  return errors;
}

export function ContactPage() {
  const [form, setForm] = useState<ContactFormState>({
    fullName: "",
    email: "",
    subject: "",
    category: "",
    message: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Partial<Record<keyof ContactFormState, boolean>>>({});
  const [captchaChecked, setCaptchaChecked] = useState(false);
  const [captchaVerifying, setCaptchaVerifying] = useState(false);
  const [captchaVerified, setCaptchaVerified] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successRef, setSuccessRef] = useState<string | null>(null);
  const [showCopy, setShowCopy] = useState(false);

  const update = <K extends keyof ContactFormState>(key: K, value: ContactFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (touched[key]) setErrors(validateForm({ ...form, [key]: value }));
  };

  const blur = <K extends keyof ContactFormState>(key: K) => {
    setTouched((prev) => ({ ...prev, [key]: true }));
    setErrors(validateForm(form));
  };

  const onCaptchaToggle = () => {
    if (captchaVerifying) return;
    if (captchaVerified) {
      setCaptchaChecked(false);
      setCaptchaVerified(false);
      return;
    }
    setCaptchaChecked(true);
    setCaptchaVerifying(true);
    setTimeout(() => {
      setCaptchaVerifying(false);
      setCaptchaVerified(true);
    }, 1200);
  };

  const resetForm = () => {
    setForm({ fullName: "", email: "", subject: "", category: "", message: "" });
    setErrors({});
    setTouched({});
    setCaptchaChecked(false);
    setCaptchaVerified(false);
    setSuccessRef(null);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const allTouched: Record<keyof ContactFormState, boolean> = {
      fullName: true,
      email: true,
      subject: true,
      category: true,
      message: true,
    };
    setTouched(allTouched);
    const foundErrors = validateForm(form);
    setErrors(foundErrors);
    if (Object.keys(foundErrors).length > 0) return;
    if (!captchaVerified) {
      toast.error("Please verify you're not a robot.", {
        style: {
          background: "var(--color-paper)",
          border: "1px solid var(--color-coral)",
          color: "var(--color-ink)",
          borderRadius: "9999px",
        },
      });
      return;
    }
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 1200));
    const ref = generateRef();
    setSuccessRef(ref);
    setSubmitting(false);
    toast.success(`Message sent! Ref: CT-${ref}. We'll reply within 48h.`, {
      style: {
        background: "var(--color-paper)",
        border: "1px solid var(--color-mint)",
        color: "var(--color-ink)",
        borderRadius: "9999px",
      },
    });
  };

  const copyRef = async () => {
    if (!successRef) return;
    try {
      await navigator.clipboard.writeText(`CT-${successRef}`);
      setShowCopy(true);
      setTimeout(() => setShowCopy(false), 1800);
    } catch {
      /* ignore clipboard copy failure */
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-14">
      <PageIntro
        eyebrow="Let’s talk"
        title="Questions, partnerships, or support."
        text="Tell us what you need and the Raffila team will point you in the right direction."
      />

      <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-start">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <ContactInfoCard
              icon={<Mail className="size-5" />}
              title="Email support"
              value="support@raffila.com"
              href="mailto:support@raffila.com"
              tone="coral"
            />
            <ContactInfoCard
              icon={<Mail className="size-5" />}
              title="Helpdesk"
              value="helpdesk@raffila.com"
              href="mailto:helpdesk@raffila.com"
              tone="mint"
            />
            <ContactInfoCard
              icon={<Phone className="size-5" />}
              title="Phone support"
              value="+234 800 RAFFILA"
              href="tel:+2348007233452"
              tone="lemon"
            />
            <ContactInfoCard
              icon={<MapPin className="size-5" />}
              title="HQ — Lagos, NG"
              value="Victoria Island, Lagos"
              tone="lilac"
            />
            <ContactInfoCard
              icon={<Clock3 className="size-5" />}
              title="Support hours"
              value="Mon–Sat · 9am–7pm WAT"
              tone="coral"
            />
          </div>

          <div className="rounded-[28px] bg-ink p-6 text-cream ring-1 ring-ink/5 sm:p-8">
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-cream/50">
              Stay in the loop
            </p>
            <h3 className="mt-2 font-display text-2xl font-extrabold">Follow our community</h3>
            <p className="mt-2 text-sm leading-relaxed text-cream/65">
              Winner announcements, new prize drops, and behind-the-scenes content.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <a
                href="https://instagram.com"
                className="inline-flex items-center gap-1.5 rounded-full bg-cream/10 px-4 py-2 text-xs font-extrabold text-cream ring-1 ring-cream/15 transition-colors hover:bg-cream/20"
              >
                <Instagram className="size-3.5" /> @raffila
              </a>
              <a
                href="mailto:support@raffila.com"
                className="inline-flex items-center gap-1.5 rounded-full bg-cream px-4 py-2 text-xs font-extrabold text-ink transition-colors hover:bg-cream/90"
              >
                <Mail className="size-3.5" /> Newsletter
              </a>
            </div>
          </div>
        </div>

        <div className="rounded-[28px] bg-paper p-6 ring-1 ring-ink/5 sm:p-8">
          {successRef ? (
            <div className="text-center py-4">
              <div className="mx-auto grid size-20 place-items-center rounded-full bg-mint/25 text-ink">
                <BadgeCheck className="size-10 text-mint" />
              </div>
              <h2 className="mt-6 font-display text-3xl font-extrabold text-ink">
                Thanks, we got it! 🎉
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-ink/60">
                Your message has been received. Our team will reply within 48 hours.
              </p>

              <div className="mt-7 inline-flex w-full max-w-md flex-col items-stretch gap-3 rounded-[22px] bg-cream p-5 ring-1 ring-ink/5">
                <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-ink/45">
                  Your reference
                </p>
                <div className="flex items-center gap-3">
                  <p className="font-mono text-lg font-extrabold tracking-wider text-ink">
                    CT-{successRef}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={copyRef}
                    className="ml-auto shrink-0"
                  >
                    {showCopy ? (
                      <>
                        <Check className="size-3.5" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="size-3.5" /> Copy ref
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button variant="primary" size="lg" onClick={resetForm}>
                  Send another message
                </Button>
                <Button asChild variant="ghost" size="lg">
                  <Link to="/">
                    <ArrowRight className="size-4 rotate-180" /> Back to home
                  </Link>
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={onSubmit} noValidate className="space-y-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-2xl font-extrabold text-ink">
                    Send us a message
                  </h2>
                  <p className="mt-1 text-sm font-bold text-ink/55">
                    All fields are required unless stated otherwise.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="c-name" className="text-xs font-extrabold text-ink/70">
                    Full name
                  </Label>
                  <Input
                    id="c-name"
                    type="text"
                    value={form.fullName}
                    onChange={(e) => update("fullName", e.target.value)}
                    onBlur={() => blur("fullName")}
                    placeholder="Adaeze Okafor"
                    className={cn(
                      "h-12 rounded-full border-0 bg-cream px-4 text-sm font-bold text-ink ring-1 focus-visible:ring-2 placeholder:text-ink/40 shadow-none",
                      errors.fullName
                        ? "ring-coral/60 focus-visible:ring-coral"
                        : "ring-ink/10 focus-visible:ring-coral/60",
                    )}
                  />
                  {errors.fullName && (
                    <p className="text-xs font-bold text-coral">{errors.fullName}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="c-email" className="text-xs font-extrabold text-ink/70">
                    Email
                  </Label>
                  <Input
                    id="c-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => update("email", e.target.value)}
                    onBlur={() => blur("email")}
                    placeholder="adaeze@example.com"
                    className={cn(
                      "h-12 rounded-full border-0 bg-cream px-4 text-sm font-bold text-ink ring-1 focus-visible:ring-2 placeholder:text-ink/40 shadow-none",
                      errors.email
                        ? "ring-coral/60 focus-visible:ring-coral"
                        : "ring-ink/10 focus-visible:ring-coral/60",
                    )}
                  />
                  {errors.email && <p className="text-xs font-bold text-coral">{errors.email}</p>}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="c-subject" className="text-xs font-extrabold text-ink/70">
                  Subject
                </Label>
                <Input
                  id="c-subject"
                  type="text"
                  value={form.subject}
                  onChange={(e) => update("subject", e.target.value)}
                  onBlur={() => blur("subject")}
                  placeholder="How to enter my first competition?"
                  className={cn(
                    "h-12 rounded-full border-0 bg-cream px-4 text-sm font-bold text-ink ring-1 focus-visible:ring-2 placeholder:text-ink/40 shadow-none",
                    errors.subject
                      ? "ring-coral/60 focus-visible:ring-coral"
                      : "ring-ink/10 focus-visible:ring-coral/60",
                  )}
                />
                {errors.subject && <p className="text-xs font-bold text-coral">{errors.subject}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="c-category" className="text-xs font-extrabold text-ink/70">
                  Category
                </Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => {
                    update("category", v as ContactCategory);
                  }}
                  onOpenChange={() => setTouched((p) => ({ ...p, category: true }))}
                >
                  <SelectTrigger
                    id="c-category"
                    className={cn(
                      "h-12 rounded-full border-0 bg-cream px-4 text-sm font-bold text-ink ring-1 focus:ring-2 shadow-none",
                      errors.category
                        ? "ring-coral/60 focus:ring-coral"
                        : "ring-ink/10 focus:ring-coral/60",
                    )}
                  >
                    <SelectValue placeholder="Select a category…" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-0 bg-paper p-1 font-body shadow-lg ring-1 ring-ink/10">
                    <SelectItem value="general" className="rounded-xl text-sm font-bold">
                      General enquiry
                    </SelectItem>
                    <SelectItem value="support" className="rounded-xl text-sm font-bold">
                      Support (login / wallet / entries)
                    </SelectItem>
                    <SelectItem value="partner" className="rounded-xl text-sm font-bold">
                      Partner inquiry
                    </SelectItem>
                    <SelectItem value="press" className="rounded-xl text-sm font-bold">
                      Press / Media
                    </SelectItem>
                    <SelectItem value="prize-claim" className="rounded-xl text-sm font-bold">
                      Prize claim
                    </SelectItem>
                    <SelectItem value="bug-report" className="rounded-xl text-sm font-bold">
                      Report a bug
                    </SelectItem>
                  </SelectContent>
                </Select>
                {errors.category && (
                  <p className="text-xs font-bold text-coral">{errors.category}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="c-message" className="text-xs font-extrabold text-ink/70">
                    Message
                  </Label>
                  <span
                    className={cn(
                      "text-[11px] font-extrabold",
                      form.message.length > 1900 ? "text-coral" : "text-ink/40",
                    )}
                  >
                    {form.message.length} / 2000
                  </span>
                </div>
                <Textarea
                  id="c-message"
                  rows={7}
                  maxLength={2000}
                  value={form.message}
                  onChange={(e) => update("message", e.target.value)}
                  onBlur={() => blur("message")}
                  placeholder="Tell us what you need — include any relevant details, dates, or competition IDs to help us respond faster."
                  style={{ minHeight: 200 }}
                  className={cn(
                    "rounded-[22px] border-0 bg-cream px-4 py-3 text-sm font-bold text-ink ring-1 focus-visible:ring-2 placeholder:text-ink/40 resize-y shadow-none",
                    errors.message
                      ? "ring-coral/60 focus-visible:ring-coral"
                      : "ring-ink/10 focus-visible:ring-coral/60",
                  )}
                />
                {errors.message && <p className="text-xs font-bold text-coral">{errors.message}</p>}
              </div>

              <div className="space-y-1.5">
                <div
                  onClick={onCaptchaToggle}
                  className={cn(
                    "inline-flex w-full max-w-sm cursor-pointer items-center gap-3 rounded-2xl bg-paper px-4 py-3 ring-1 transition-colors",
                    captchaVerified ? "ring-mint/50 bg-mint/15" : "ring-ink/15 hover:bg-cream",
                  )}
                >
                  <div
                    className={cn(
                      "grid size-8 shrink-0 place-items-center rounded-lg border-2 transition-all",
                      captchaVerified
                        ? "border-mint bg-mint text-ink"
                        : captchaVerifying
                          ? "border-ink/25 bg-cream text-ink/55"
                          : "border-ink/25 bg-paper",
                    )}
                  >
                    {captchaVerified ? (
                      <Check className="size-4" />
                    ) : captchaVerifying ? (
                      <svg
                        className="size-4 animate-spin text-coral"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                        />
                      </svg>
                    ) : (
                      <Checkbox
                        checked={captchaChecked}
                        onCheckedChange={() => {}}
                        className="border-transparent bg-transparent shadow-none data-[state=checked]:bg-transparent"
                      />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-ink">
                      {captchaVerified ? (
                        <span className="inline-flex items-center gap-1.5 text-ink">
                          <BadgeCheck className="size-4 text-mint" /> Verified
                        </span>
                      ) : captchaVerifying ? (
                        "Verifying…"
                      ) : (
                        "I'm not a robot"
                      )}
                    </p>
                    <p className="text-[11px] font-bold text-ink/40">
                      Privacy · Terms · reCAPTCHA stub
                    </p>
                  </div>
                  <span className="font-display text-2xl font-extrabold text-coral/60">🔒</span>
                </div>
              </div>

              <Separator className="bg-ink/10" />

              <Button
                type="submit"
                variant="primary"
                size="lg"
                disabled={submitting}
                className="w-full"
              >
                {submitting ? (
                  <>
                    <svg
                      className="size-4 animate-spin"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                      />
                    </svg>
                    Sending…
                  </>
                ) : (
                  <>
                    <Mail className="size-4" /> Send message
                  </>
                )}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export function DrawVerificationPage() {
  const { campaign } = useParams({ from: "/draw-verification/$campaign" });
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 lg:py-14">
      <PageIntro
        eyebrow="Public verification"
        title="Follow the draw record."
        text={`Verification information for ${campaign.replaceAll("-", " ")} will appear here once the competition has closed and the result is approved for publication.`}
      />
      <div className="mt-10 rounded-[28px] bg-paper p-6 ring-1 ring-ink/5 sm:p-8">
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            ["Campaign", campaign.replaceAll("-", " ")],
            ["Status", "Awaiting draw"],
            ["Algorithm", "Published with draw record"],
            ["Entry pool", "Available after close"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl bg-cream p-4">
              <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-ink/45">
                {label}
              </p>
              <p className="mt-2 font-display text-lg font-extrabold capitalize text-ink">
                {value}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-6 flex items-start gap-3 rounded-2xl bg-mint/25 p-4">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-ink" />
          <p className="text-sm font-bold leading-relaxed text-ink/65">
            Raffila’s verification surface is designed to publish the relevant draw data without
            exposing private entrant information.
          </p>
        </div>
      </div>
    </div>
  );
}

export function AuthPreviewPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-12 sm:px-6 lg:py-20">
      <div className="rounded-[28px] bg-paper p-6 text-center ring-1 ring-ink/5 sm:p-10">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-lilac font-display text-2xl font-extrabold text-ink">
          R
        </span>
        <h1 className="mt-5 font-display text-3xl font-extrabold text-ink">Join Raffila</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink/60">
          Secure account access, email and phone verification, and profile completion will be
          connected in the next Cloud-backed phase.
        </p>
        <Button asChild variant="dark" size="lg" className="mt-6">
          <Link to="/competitions">Browse competitions</Link>
        </Button>
      </div>
    </div>
  );
}

function PopularUnder1000({
  competitions,
  onEnterDraw,
}: {
  competitions: Competition[];
  onEnterDraw?: (slug: string, qty: number) => void;
}) {
  const affordable = competitions.filter((c) => c.entryPrice <= 1000 * 100).slice(0, 6);
  useEffect(() => {
    if (affordable.length > 0) trackEvent("popular_under_1000_view", { count: affordable.length });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (affordable.length === 0) return null;
  return (
    <section
      className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12"
      aria-label="Popular under 1000 naira"
    >
      <SectionHeading
        eyebrow="Affordable discovery"
        title="Popular Under ₦1,000"
        linkLabel="See all competitions"
        linkTo="/competitions"
      />
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink/60">
        Lowest-cost opportunities, visible immediately. No wallet needed to browse.
      </p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {affordable.map((c) => (
          <CompetitionCard
            key={c.slug}
            competition={c}
            {...(onEnterDraw ? { onEnterDraw: (qty: number) => onEnterDraw(c.slug, qty) } : {})}
          />
        ))}
      </div>
    </section>
  );
}

function TrustStrip() {
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8" aria-label="Why trust Raffila">
      <div className="grid grid-cols-2 gap-3 rounded-[28px] bg-paper p-4 ring-1 ring-ink/5 sm:p-6 lg:grid-cols-4">
        {TRUST_SIGNALS.map((s) => (
          <div
            key={s.id}
            className="flex items-center gap-2.5 rounded-2xl bg-cream/60 px-4 py-3 ring-1 ring-ink/5"
          >
            <BadgeCheck className="size-5 shrink-0 text-mint" aria-hidden />
            <span className="text-xs font-extrabold text-ink sm:text-sm">{s.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function BrowseByNeed({ competitions }: { competitions: Competition[] }) {
  const countFor = (id: string): number => {
    if (id === "under-1000") return competitions.filter((c) => c.entryPrice <= 1000 * 100).length;
    if (id === "premium") return competitions.filter((c) => c.entryPrice > 5000 * 100).length;
    const col = BROWSE_BY_NEED.find((b) => b.id === id);
    const cat = (col?.filter as { category?: string })?.category;
    if (!cat) return 0;
    return competitions.filter((c) => c.category === cat).length;
  };
  return (
    <section
      className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12"
      aria-label="Browse by need"
    >
      <SectionHeading
        eyebrow="Start with your goal"
        title="Browse by need"
        linkLabel="See all competitions"
        linkTo="/competitions"
      />
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink/60">
        Formal categories filter the prize. Collections start from what you want to achieve.
      </p>
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {BROWSE_BY_NEED.map((col) => (
          <Link
            key={col.id}
            to="/competitions"
            onClick={() => trackEvent("category_click", { collection: col.id })}
            className="group rounded-[22px] bg-paper p-5 ring-1 ring-ink/5 transition-transform hover:-translate-y-0.5"
          >
            <p className="font-display text-base font-extrabold leading-tight text-ink sm:text-lg">
              {col.title}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-ink/55">{col.text}</p>
            <p className="mt-3 inline-flex items-center gap-1 text-xs font-extrabold text-coral">
              {countFor(col.id)} available <ArrowRight className="size-3.5" />
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}

function HowItWorksPreview() {
  return (
    <section className="bg-lilac/20">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <SectionHeading
          eyebrow="No mystery steps"
          title="How Raffila works"
          linkLabel="See the full guide"
          linkTo="/how-it-works"
        />
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[
            { title: "Choose a prize", desc: "Browse first — no money asked up front." },
            { title: "Choose entries", desc: "Price and total shown clearly before payment." },
            {
              title: "Create account",
              desc: "Phone/OTP prominently, email/Google also available.",
            },
            {
              title: "Pay securely",
              desc: "Direct payment and/or wallet, subject to provider review.",
            },
            {
              title: "Get confirmation",
              desc: "Entry numbers and draw date shown immediately.",
            },
            {
              title: "Follow result",
              desc: "Simple My Entries screen + verifiable draw result.",
            },
          ].map((step, index) => (
            <div key={step.title} className="rounded-[20px] bg-paper p-4 ring-1 ring-ink/5">
              <span className="font-display text-2xl font-extrabold text-coral">{index + 1}</span>
              <p className="mt-3 text-sm font-extrabold leading-snug text-ink tracking-tight">
                {step.title}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-ink/50">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SectionHeading({
  eyebrow,
  title,
  linkLabel,
  linkTo,
}: {
  eyebrow: string;
  title: string;
  linkLabel: string;
  linkTo: "/competitions" | "/how-it-works";
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-ink/45">{eyebrow}</p>
        <h2 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
          {title}
        </h2>
      </div>
      <Link
        to={linkTo}
        className="hidden items-center gap-1 text-sm font-extrabold text-ink/60 hover:text-ink sm:inline-flex"
      >
        {linkLabel} <ArrowRight className="size-4" />
      </Link>
    </div>
  );
}
function PageIntro({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return (
    <header className="max-w-3xl">
      <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-coral">{eyebrow}</p>
      <h1 className="mt-3 font-display text-3xl font-extrabold leading-tight tracking-tight text-ink sm:text-4xl lg:text-5xl">
        {title}
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink/60 sm:text-lg">{text}</p>
    </header>
  );
}
function Pill({ children, tone }: { children: React.ReactNode; tone?: "coral" }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-paper px-3 py-1.5 text-xs font-extrabold text-ink ring-1 ring-ink/10 ${tone === "coral" ? "text-coral" : ""}`}
    >
      {children}
    </span>
  );
}
/**
 * Hero rewards-pool panel. Live balance from Firestore (via HomePage's
 * useRewardPool subscription) plus the live-competition count, rendered in the
 * premium dark-green/gold treatment used across draw surfaces.
 */
function HeroRewardPoolCard({
  totalKobo,
  contributionPct,
  liveCount,
}: {
  totalKobo: number;
  contributionPct: number;
  liveCount: number;
}) {
  return (
    <div className="raf-rise relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#144C39] via-[#0D2F24] to-[#0A261B] p-6 text-cream ring-1 ring-[#D4AF37]/30 shadow-[0_20px_50px_-20px_rgba(10,38,27,0.5)] sm:p-8">
      <div className="pointer-events-none absolute -right-16 -top-16 size-52 rounded-full bg-[#D4AF37]/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-12 size-56 rounded-full bg-[#10B981]/10 blur-3xl" />
      <div className="relative">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-cream/55">
          Raffila Rewards Pool
        </p>
        <p className="mt-3 font-display text-[clamp(2.25rem,5vw,3.25rem)] font-extrabold leading-none tracking-tight tabular-nums text-cream">
          {formatNaira(totalKobo)}
        </p>
        <p className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-cream/65">
          <span className="size-2 rounded-full bg-[#D4AF37] animate-pulse" />
          Growing live · waiting to be won
        </p>
        <div className="mt-6 grid grid-cols-3 gap-3 border-t border-cream/10 pt-5">
          <div>
            <p className="font-display text-xl font-extrabold tabular-nums text-cream">
              {liveCount}
            </p>
            <p className="mt-0.5 text-[11px] font-bold text-cream/50">Live campaigns</p>
          </div>
          <div>
            <p className="font-display text-xl font-extrabold tabular-nums text-cream">
              {contributionPct}%
            </p>
            <p className="mt-0.5 text-[11px] font-bold text-cream/50">Of revenue funds pool</p>
          </div>
          <div>
            <p className="font-display text-xl font-extrabold text-cream">Shared</p>
            <p className="mt-0.5 text-[11px] font-bold text-cream/50">With participants</p>
          </div>
        </div>
        <Button
          asChild
          size="lg"
          className="mt-6 w-full bg-gradient-to-r from-[#D4AF37] to-[#E5C158] hover:from-[#E5C158] hover:to-[#D4AF37] text-[#0A261B] font-extrabold shadow-lg"
        >
          <Link
            to="/competitions"
            onClick={() => trackEvent("competition_card_click", { source: "hero_reward_pool" })}
          >
            Enter a campaign <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
function TrustItem({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div>
      <span className="text-coral [&>svg]:size-5">{icon}</span>
      <h3 className="mt-2 font-display text-base font-extrabold text-ink">{title}</h3>
      <p className="mt-1 text-xs leading-relaxed text-ink/55">{text}</p>
    </div>
  );
}
function MissingPage({ title, text }: { title: string; text: string }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <CircleHelp className="mx-auto size-10 text-coral" />
      <h1 className="mt-5 font-display text-3xl font-extrabold text-ink">{title}</h1>
      <p className="mt-3 text-sm leading-relaxed text-ink/60">{text}</p>
      <Button asChild variant="dark" size="md" className="mt-6">
        <Link to="/competitions">Back to competitions</Link>
      </Button>
    </div>
  );
}

function LegalBanner() {
  return (
    <div className="mb-8 rounded-[22px] bg-coral px-5 py-4 text-cream shadow-[0_8px_20px_-8px_var(--coral)] ring-1 ring-coral/30">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-cream/90" />
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-cream/80">Notice</p>
          <p className="mt-1 text-sm font-bold leading-relaxed">
            This document is pending legal review. For the final binding version contact
            legal@raffila.com.
          </p>
        </div>
      </div>
    </div>
  );
}

function LegalSection({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-baseline gap-3">
        <span className="font-display text-3xl font-extrabold text-coral">{number}</span>
        <h2 className="font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
          {title}
        </h2>
      </div>
      <div className="mt-5 pl-12 sm:pl-14">{children}</div>
    </section>
  );
}

export function TrustSafetyPage() {
  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 lg:px-8 lg:py-14">
      <PageIntro
        eyebrow="Trust & Safety"
        title="How Raffila keeps prizes, payments and draws trustworthy"
        text="Plain-English explanations plus the public verification record. Trust signals also appear beside every competition decision — not only on legal pages."
      />
      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <div className="rounded-[28px] bg-paper p-6 ring-1 ring-ink/5 sm:p-8">
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-ink/45">
            Prize verification
          </p>
          <h2 className="mt-2 font-display text-2xl font-extrabold text-ink">
            How Raffila checks prizes and partners
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-ink/65">
            Every prize is inspected, documented with serial numbers and condition, and consigned by
            a verified enterprise partner before entries open. Custody and escrow guarantees apply
            where stated on the competition page.
          </p>
          <Button asChild variant="outline" size="md" className="mt-4 min-h-11">
            <Link to="/become-a-partner">For asset owners — become a partner</Link>
          </Button>
        </div>
        <div className="rounded-[28px] bg-paper p-6 ring-1 ring-ink/5 sm:p-8">
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-ink/45">
            Payment security
          </p>
          <h2 className="mt-2 font-display text-2xl font-extrabold text-ink">
            How payments and records are handled
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-ink/65">
            The Raffila Wallet is spend-only and non-withdrawable — designed for entries, not cash
            storage. Referral earnings are separate and may be used for entries or requested as
            payout subject to review. Card, bank transfer and USSD unlock only after
            payment-provider review. Every transaction keeps a receipt in My Entries.
          </p>
          <Button asChild variant="outline" size="md" className="mt-4 min-h-11">
            <Link to="/dashboard/entries">View My Entries</Link>
          </Button>
        </div>
        <div className="rounded-[28px] bg-paper p-6 ring-1 ring-ink/5 sm:p-8">
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-ink/45">
            Draw verification
          </p>
          <h2 className="mt-2 font-display text-2xl font-extrabold text-ink">
            Plain-English verifiable draws
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-ink/65">
            When a competition closes, entries freeze. A secure, verifiable process picks the winner
            and the full public record is published so anyone can check it — no hidden steps.
          </p>
          <Button asChild variant="outline" size="md" className="mt-4 min-h-11">
            <Link to="/draw-verification/$campaign" params={{ campaign: "example" }}>
              Open draw verification
            </Link>
          </Button>
        </div>
        <div className="rounded-[28px] bg-paper p-6 ring-1 ring-ink/5 sm:p-8">
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-ink/45">
            Winner fulfilment
          </p>
          <h2 className="mt-2 font-display text-2xl font-extrabold text-ink">
            How winners are contacted and prizes delivered
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-ink/65">
            Winners are contacted within 48 hours on the account email and phone, complete
            verification, then choose delivery or collection as stated in the prize details.
          </p>
          <Button asChild variant="outline" size="md" className="mt-4 min-h-11">
            <Link to="/winners">See real winners</Link>
          </Button>
        </div>
      </div>
      <div className="mt-8 rounded-[28px] bg-lemon/40 p-6 ring-1 ring-ink/5 sm:p-8">
        <h2 className="font-display text-xl font-extrabold text-ink">Responsible participation</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink/65">
          Raffila shows the closing date, total cost and clear status. We avoid artificial scarcity,
          flashing urgency and repeated buy-more prompts. You can set a voluntary weekly spending
          alert from your account.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Button asChild variant="dark" size="md" className="min-h-11">
            <Link to="/competition-rules">Read competition rules</Link>
          </Button>
          <Button asChild variant="outline" size="md" className="min-h-11">
            <Link to="/faq">Get support</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

export function TermsAndConditionsPage() {
  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 lg:px-8 lg:py-14">
      <PageIntro
        eyebrow="Legal"
        title="Terms and Conditions"
        text="The agreement that covers your use of Raffila, competition entries, draws, wallet, referrals, and related services."
      />
      <div className="mt-8">
        <LegalBanner />
        <div className="space-y-10 text-sm leading-relaxed text-ink/70 sm:text-[15px]">
          <LegalSection number="1" title="Acceptance of Terms">
            <div className="space-y-4">
              <p>
                Welcome to Raffila ("we", "us", "our" or "Raffila"). These Terms and Conditions
                ("Terms") are a binding legal agreement between you ("you", "your", the user, or the
                "Participant") and Raffila, a company organized under the laws of the Federal
                Republic of Nigeria with registered office in Lagos, Nigeria.
              </p>
              <p>
                By accessing or using the Raffila website located at{" "}
                <span className="font-bold text-ink">raffila.com</span> (the "Site"), creating an
                account on the Platform, purchasing a competition entry, funding your wallet,
                participating in the referral or using any of our services (collectively, the
                "Services"), you confirm that you have read, understood, and unconditionally agree
                to be bound by these Terms, our{" "}
                <Link
                  to="/privacy-policy"
                  className="font-bold text-coral underline underline-offset-2 hover:text-ink"
                >
                  Privacy Policy
                </Link>
                , and our{" "}
                <Link
                  to="/competition-rules"
                  className="font-bold text-coral underline underline-offset-2 hover:text-ink"
                >
                  Competition Rules
                </Link>{" "}
                (together, the "Agreement").
              </p>
              <p>
                If you do not agree to any part of this Agreement, you must immediately stop using
                the Services and close your access to the Site and all Raffila Services.
              </p>
              <p>
                These Terms are effective as of the date you first create an account or first use of
                the Services ("Effective Date).
              </p>
            </div>
          </LegalSection>
          <LegalSection number="2" title="Eligibility & Age Verification">
            <div className="space-y-4">
              <ol className="list-decimal space-y-3 pl-5 marker:list-inside marker:text-coral">
                <li>
                  <span className="font-bold text-ink">Age requirement.</span> You must be at least
                  eighteen (18) years of age on the date you create an account, enter a competition,
                  or use the Services. By using the Services, you represent and warrant that you are
                  of legal age to form a binding contract in Nigeria.
                </li>
                <li>
                  <span className="font-bold text-ink">Residency and jurisdiction.</span> Prize
                  competitions are open only to individuals who are lawfully resident in the Federal
                  Republic of Nigeria and physically present in Nigeria at the time of account
                  creation and prize draw. Employees, officers, directors of Raffila, its
                  affiliates, prize partners, advertising, and promotional agencies, and immediate
                  family members (spouse, parent, sibling, child, grandparent, grandchild and
                  household members of each) are not eligible to enter competitions or win prizes.
                </li>
                <li>
                  <span className="font-bold text-ink">Account verification.</span> Before you may
                  withdraw any referral commission, or claim a prize, you must successfully complete
                  our identity and account verification ("KYC") including, but not limited to, a
                  verified email address via one-time passcode (OTP), a verified phone number, a
                  Bank Verification Number (BVN) check, a valid government-issued photo
                  identification (National ID, Permanent Voters Card, Drivers Licence or
                  International Passport), and proof of address not older than three (3) months. We
                  reserve the right to request additional documentation in our sole discretion.
                </li>
                <li>
                  <span className="font-bold text-ink">Prohibited persons.</span> Individuals or
                  entities whose activity appears on any sanctions lists administered by the
                  Nigerian Government, the Central Bank of Nigeria, OFAC, the United Nations, or the
                  European Union, or who have been previously banned, suspended, or terminated from
                  Raffila may not use the Services.
                </li>
              </ol>
            </div>
          </LegalSection>
          <LegalSection number="3" title="Competition Rules & Play">
            <div className="space-y-4">
              <p>
                All competitions and prize draws hosted on the Raffila Platform are governed by
                these Terms and by the standalone{" "}
                <Link
                  to="/competition-rules"
                  className="font-bold text-coral underline underline-offset-2 hover:text-ink"
                >
                  Competition Rules
                </Link>{" "}
                which are expressly incorporated by reference into these Terms. In the event of a
                conflict between these Terms and the Competition Rules for a specific draw, the
                Competition Rules shall prevail for that draw.
              </p>
              <ol className="list-decimal space-y-3 pl-5 marker:text-coral">
                <li>
                  <span className="font-bold text-ink">No purchase necessary exemptions.</span> Free
                  alternative entry routes, where required by applicable Nigerian law, are described
                  on request by writing to freeentry@raffila.com with proof of Nigerian residency
                  and a handwritten entry statement. No-purchase entries receive the same
                  probability weight as paid entries in the same draw.
                </li>
                <li>
                  <span className="font-bold text-ink">Ticket format.</span> Every successful entry
                  generates one (1) or more unique ticket identifiers in the format{" "}
                  <span className="font-mono text-ink">RF-YYYY-XXXXXXXX</span>. Ticket identifiers
                  are stored on our systems and associated with your verified account.
                </li>
                <li>
                  <span className="font-bold text-ink">Multiple entries per draw.</span> You may
                  enter a single competition with multiple tickets (up to the per-account
                  per-competition cap published on the competition detail page). Multiple entries
                  proportionally improve your odds as published.
                </li>
                <li>
                  <span className="font-bold text-ink">Independent probability.</span> Odds of
                  winning are calculated as the number of tickets you hold in a closed draw divided
                  by the total number of tickets sold in that draw.
                </li>
              </ol>
            </div>
          </LegalSection>
          <LegalSection number="4" title="Entry Purchase, Payments & Wallet">
            <div className="space-y-4">
              <ol className="list-decimal space-y-3 pl-5 marker:text-coral">
                <li>
                  <span className="font-bold text-ink">Currency and denomination.</span> All prices
                  on the Raffila Platform are stated in Nigerian Naira (₦). Financial values within
                  our systems are stored in kobo (₦ x 100) to eliminate rounding errors. Final
                  prices shown in the purchase UI are inclusive of all applicable taxes and platform
                  fees unless expressly stated otherwise.
                </li>
                <li>
                  <span className="font-bold text-ink">Payment providers.</span> Wallet funding is
                  processed by licensed payment processors including Paystack and Flutterwave (the
                  "Processors"). You agree to be bound by each respective Processor's terms,
                  cardholder, and payment acceptance policies in addition to these Terms.
                </li>
                <li>
                  <span className="font-bold text-ink">Wallet nature (spend-only).</span> Your
                  Raffila Wallet is a pre-funded spend-only instrument used exclusively for the
                  purchase of competition entries. It is not a bank account, not insured by the
                  Nigeria Deposit Insurance Corporation (NDIC), and does not accrue interest. You
                  may not withdraw Wallet balances to an external bank account. Only Referral
                  Commissions (defined in Section 6 below) are withdrawable per the payout
                  procedures set out on the Referral dashboard.
                </li>
                <li>
                  <span className="font-bold text-ink">Payment sources for entry.</span>{" "}
                  Competitions entries may be paid from (a) your Raffila Wallet balance or (b) your
                  available Referral Commission balance. Split payments between Wallet and Referrals
                  are not supported. You may top up the Wallet using the Processor integrations at
                  any time.
                </li>
                <li>
                  <span className="font-bold text-ink">Finality of purchase.</span> Once a
                  competition entry purchase is completed and a ticket identifier (RF-YYYY-XXXXXXXX)
                  is issued to your account, the purchase is final and non-refundable except in the
                  specific cancellation scenarios set out in Section 10 of the Competition Rules or
                  if required by applicable Nigerian law.
                </li>
                <li>
                  <span className="font-bold text-ink">Chargebacks and reversals.</span> You agree
                  not to initiate any chargeback, reversal, or dispute with your card issuer or
                  Processor without first contacting Raffila support at support@raffila.com and
                  allowing thirty (30) days for resolution. An unresolved chargeback in your favour
                  after good-faith resolution will cause your account to be permanently suspended
                  and any prizes or pending commissions forfeited.
                </li>
                <li>
                  <span className="font-bold text-ink">Reservation.</span> Entry selections in the
                  purchase flow are reserved for a rolling five (5) minute window while you complete
                  checkout. If checkout does not complete within this window, the reserved tickets
                  are released back to inventory.
                </li>
              </ol>
            </div>
          </LegalSection>
          <LegalSection number="5" title="Draws, Winners & Prize Claims">
            <div className="space-y-4">
              <ol className="list-decimal space-y-3 pl-5 marker:text-coral">
                <li>
                  <span className="font-bold text-ink">Draw timing.</span> Each competition closes
                  automatically on the published end date and time stated on its competition page or
                  when the published inventory of tickets for that draw is one hundred percent
                  (100%) sold, whichever comes first. Late entries after close are not accepted.
                </li>
                <li>
                  <span className="font-bold text-ink">Random selection algorithm.</span> Winner
                  selection uses a cryptographically secure, independently verifiable HMAC_DRBG
                  (Hash-based Message Authentication Code Deterministic Random Bit Generator) seeded
                  with an independently published public seed combined with the frozen, ordered list
                  of all ticket entries at close. The algorithm, the seed commitment, and the frozen
                  entry set are published on the Draw Verification page at{" "}
                  <Link
                    to="/draw-verification/$campaign"
                    params={{ campaign: "example" }}
                    className="font-bold text-coral underline underline-offset-2"
                  >
                    /draw-verification
                  </Link>{" "}
                  for every competition so that any third party may independently reproduce the
                  winning ticket selection.
                </li>
                <li>
                  <span className="font-bold text-ink">Prize insurance.</span> Where applicable,
                  physical prize values are backed by a prize-indemnity insurance policy
                  underwritten by an A-rated Nigerian insurer for the stated prize value, ensuring
                  the prize is available for delivery to a valid winner.
                </li>
                <li>
                  <span className="font-bold text-ink">Winner notification.</span> The verified
                  winner is contacted within forty-eight (48) hours of the draw by email to the
                  registered address and SMS to the verified phone number on the account. The
                  winner's first name, last initial, and state of residence may be published
                  publicly in the Winners Gallery on the Site. A winner's full legal name and
                  likeness are published only after separate written consent in line with our{" "}
                  <Link
                    to="/privacy-policy"
                    className="font-bold text-coral underline underline-offset-2 hover:text-ink"
                  >
                    Privacy Policy
                  </Link>
                  .
                </li>
                <li>
                  <span className="font-bold text-ink">Claim window and KYC.</span> Winners have
                  fourteen (14) calendar days from draw date ("Claim Window") to complete all
                  required prize claim steps including KYC level-2 verification, signed prize
                  acceptance, and any applicable affidavit of eligibility.
                </li>
                <li>
                  <span className="font-bold text-ink">Unclaimed prizes and redraw.</span> If a
                  winner does not complete the claim within the 14-day window or fails KYC
                  verification, the prize is declared unclaimed and a verified redraw will be
                  conducted from the remaining eligible entries in the same original frozen entry
                  set using the same HMAC_DRBG procedure with a fresh published seed.
                </li>
                <li>
                  <span className="font-bold text-ink">Prize delivery.</span> Physical prizes are
                  delivered to a verifiable Nigerian address. Physical prizes are delivered to a
                  verifiable Nigerian address of the winner's choice within Lagos, Abuja, or Port
                  Harcourt within 45 calendar days of accepted claim, or as otherwise specified in
                  the prize description. Cash alternatives are not offered unless expressly stated
                  on the competition page.
                </li>
              </ol>
            </div>
          </LegalSection>
          <LegalSection number="6" title="Referral Program">
            <div className="space-y-4">
              <p>
                Raffila operates a multi-level referral commission program ("Referral Program") that
                rewards verified account holders ("Referrers") for introducing new verified account
                holders ("Referees") who subsequently purchase paid competition entries on the
                Platform.
              </p>
              <ol className="list-decimal space-y-3 pl-5 marker:text-coral">
                <li>
                  <span className="font-bold text-ink">Commission structure.</span> Commissions are
                  earned on up to five (5) descending levels of your referral network (Level 1
                  through Level 5) using the published tiered percentage schedule applied to the net
                  entry price (after taxes and processor fees actually paid by the referred entrant
                  on a successful ticketed competition purchased.
                </li>
                <li>
                  <span className="font-bold text-ink">Qualifying activity.</span> Commissions
                  become earned only when a referee completes (a) email OTP verification, (b) a paid
                  competition entry, and (c) a successful payment processor settlement. Refunds,
                  reversals, or cancelled draws reduce the corresponding commissions in the same
                  calendar month that they occur.
                </li>
                <li>
                  <span className="font-bold text-ink">Commission balance.</span> Earned referral
                  commissions accrue in a separate Referral balance from Wallet. The Referral
                  balance is withdrawable (not the Wallet which is spend-only). Withdrawals are paid
                  to a verified Nigerian bank account under the same verified account holder's name
                  only and are subject to minimum withdrawal thresholds, and a completed payout
                  schedule published on the Referrals dashboard.
                </li>
                <li>
                  <span className="font-bold text-ink">Self-referrals and fraud.</span> Referring
                  yourself, creating duplicate accounts, fabricated accounts, sham payments, or
                  accounts that do not meet KYC will disqualify all commissions forfeit all earned
                  balances, and result in account termination.
                </li>
                <li>
                  <span className="font-bold text-ink">Program changes.</span> Raffila reserves the
                  right to modify the commission percentages, tier structure, thresholds, or
                  discontinue the Referral Program at any time with thirty (30) calendar days prior
                  written email notice to active Referrers.
                </li>
              </ol>
            </div>
          </LegalSection>
          <LegalSection number="7" title="Account Responsibilities">
            <div className="space-y-4">
              <ol className="list-decimal space-y-3 pl-5 marker:text-coral">
                <li>
                  <span className="font-bold text-ink">Account credentials.</span> You are solely
                  responsible for maintaining the confidentiality of your account email, password,
                  one-time passcodes, authenticator app codes, and any other account credentials.
                  You agree to notify Raffila immediately of any unauthorized use or suspected
                  breach.
                </li>
                <li>
                  <span className="font-bold text-ink">One account per person.</span> You may
                  maintain only one (1) active verified Raffila account per individual natural
                  person. Multiple accounts, account sharing, or selling access to an account is a
                  material breach and will result in termination, forfeiture of entries and
                  balances.
                </li>
                <li>
                  <span className="font-bold text-ink">Accurate information.</span> You warrant that
                  all registration, KYC, and profile information you provide is true, accurate,
                  current, and complete and you will update it within 14 days of any material
                  change.
                </li>
                <li>
                  <span className="font-bold text-ink">Prohibited conduct.</span> You will not, and
                  will not assist or enable any third party to: (a) reverse engineer, decompile,
                  disassemble, scrape, bot, or automate access to the Platform; (b) use the Services
                  for money laundering, terrorist financing, fraud, or any unlawful purpose under
                  Nigerian law; (c) circumvent age, eligibility, entry limits, or geographic
                  restrictions using VPN, proxy, or similar technology; (d) impersonate any person
                  or entity; (e) interfere with the draw, entry integrity, or the security or
                  integrity of the Platform.
                </li>
                <li>
                  <span className="font-bold text-ink">Suspension and termination.</span> We may, in
                  our sole discretion and without prior notice, immediately suspend, limit, or
                  terminate your account and forfeit any or all entries, wallet, or referral
                  balances if we reasonably suspect a breach of this Section 7, applicable law, or
                  the integrity of a competition.
                </li>
              </ol>
            </div>
          </LegalSection>
          <LegalSection number="8" title="Disclaimers & Limitation of Liability">
            <div className="space-y-4">
              <p>
                TO THE FULLEST EXTENT PERMITTED BY NIGERIAN LAW, THE SERVICES, THE SITE, ALL
                COMPETITIONS, DRAWS, PRIZES, WALLET, AND REFERRAL PROGRAM ARE PROVIDED BY RAFILLA ON
                AN "AS IS" AND "AS AVAILABLE" BASIS. RAFILLA, ITS DIRECTORS, OFFICERS, EMPLOYEES,
                PARTNERS, INSURERS, AND AGENTS MAKE NO WARRANTIES, EXPRESS OR IMPLIED, STATUTORY OR
                OTHERWISE, INCLUDING WITHOUT LIMITATION WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
                PARTICULAR PURPOSE, TITLE, QUIET ENJOYMENT, OR NON-INFRINGEMENT.
              </p>
              <ol className="list-decimal space-y-3 pl-5 marker:text-coral">
                <li>
                  <span className="font-bold text-ink">Service interruptions.</span> Raffila does
                  not warrant uninterrupted, error-free, secure, virus-free operation of the
                  Services, or that any defect will be corrected. Your access may be suspended for
                  scheduled maintenance, emergency security patches, or force majeure without prior
                  notice.
                </li>
                <li>
                  <span className="font-bold text-ink">No guarantee of win.</span> Nothing in this
                  Agreement is a promise, guarantee, or warranty that you will win any prize or earn
                  any referral commission. All competitions are games of chance conditioned on the
                  verifiable HMAC_DRBG draw and you accept the outcome in Section 5.2.
                </li>
                <li>
                  <span className="font-bold text-ink">Limitation of liability.</span> TO THE
                  MAXIMUM EXTENT PERMITTED BY NIGERIAN LAW, RAFILLA SHALL NOT BE LIABLE TO YOU OR TO
                  ANY THIRD PARTY FOR (A) ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL,
                  EXEMPLARY OR PUNITIVE DAMAGES, OR (B) ANY LOSS OF PROFITS, REVENUE, GOODWILL,
                  DATA, OR USE, ARISING OUT OF OR IN CONNECTION WITH THE SERVICES, WHETHER IN
                  CONTRACT, TORT (INCLUDING NEGLIGENCE), OR OTHERWISE, EVEN IF ADVISED OF THE
                  POSSIBILITY OF SUCH DAMAGES. OUR TOTAL AGGREGATE LIABILITY UNDER THIS AGREEMENT
                  FOR ALL CLAIMS IN A CALENDAR YEAR SHALL NOT EXCEED THE LOWER OF (I) THE TOTAL
                  AMOUNT YOU ACTUALLY PAID TO RAFILLA IN THE TWELVE (12) CALENDAR MONTHS PRECEDING
                  THE CLAIM, OR (II) ONE MILLION FIVE HUNDRED THOUSAND NAIRA (₦1,500,000).
                </li>
                <li>
                  <span className="font-bold text-ink">Force majeure.</span> Neither party is liable
                  for failure or delay in performing its obligations under this Agreement to the
                  extent caused by acts of God, war, terrorism, civil unrest, pandemic, government
                  order, utility outage, payment processor outage, or Internet infrastructure
                  failure beyond the reasonable control of the party affected.
                </li>
              </ol>
            </div>
          </LegalSection>
          <LegalSection number="9" title="Dispute Resolution & Governing Law (Nigeria)">
            <div className="space-y-4">
              <ol className="list-decimal space-y-3 pl-5 marker:text-coral">
                <li>
                  <span className="font-bold text-ink">Governing law.</span> This Agreement and any
                  claim, dispute or controversy arising out of or relating to this Agreement, the
                  Services, competitions, or your relationship with Raffila shall be governed by and
                  construed exclusively under the laws of the Federal Republic of Nigeria, without
                  regard to conflict of laws principles.
                </li>
                <li>
                  <span className="font-bold text-ink">Amicable resolution first.</span> Before
                  commencing any formal proceeding, you and we agree to first attempt in good faith
                  to resolve any dispute through direct negotiation for a period of thirty (30)
                  calendar days from the date written notice of dispute is delivered. Our notice
                  address for disputes is legal@raffila.com.
                </li>
                <li>
                  <span className="font-bold text-ink">Mediation.</span> If the dispute is not
                  resolved within 30 days, either party may submit the matter to non-binding
                  mediation administered by the Lagos Multi-Door Courthouse (LMDC) before a single
                  neutral mediator with costs shared equally by the parties.
                </li>
                <li>
                  <span className="font-bold text-ink">Courts of competent jurisdiction.</span>{" "}
                  Subject to subsections 2 and 3 above, you irrevocably submit to the exclusive
                  jurisdiction of the courts of Lagos State, Nigeria for any action arising from or
                  related to this Agreement, and waive any objection to venue or forum non
                  conveniens.
                </li>
                <li>
                  <span className="font-bold text-ink">Consumer protection notice.</span> Nothing in
                  this Section 9 excludes or limits any mandatory rights you may have as a consumer
                  under the Federal Competition and Consumer Protection Act 2018 or the Nigerian
                  Data Protection Regulation 2019 (NDPR) that cannot be excluded or limited by
                  contract.
                </li>
              </ol>
            </div>
          </LegalSection>
          <LegalSection number="10" title="Amendments">
            <div className="space-y-4">
              <ol className="list-decimal space-y-3 pl-5 marker:text-coral">
                <li>
                  <span className="font-bold text-ink">Right to modify.</span> Raffila may update,
                  amend, or modify these Terms, the Privacy Policy, or the Competition Rules from
                  time to time in our sole discretion. Material changes (as determined by us in good
                  faith) will be communicated to you by email to your registered address at least
                  fourteen (14) calendar days before they take effect. Non-material changes take
                  effect immediately upon posting on the Site.
                </li>
                <li>
                  <span className="font-bold text-ink">Deemed acceptance.</span> Your continued use
                  of the Services after the effective date of posted amendments constitutes your
                  acceptance of the amended Terms. If you do not accept an amendment, your sole and
                  exclusive remedy is to close your account and stop using the Services.
                </li>
                <li>
                  <span className="font-bold text-ink">Open competitions grandfathered.</span> For
                  open and purchased entries in competitions already opened at the time of
                  amendment, the version of Competition Rules in effect at the time the entry was
                  purchased shall govern that draw specifically unless otherwise required by
                  Nigerian law.
                </li>
              </ol>
            </div>
          </LegalSection>
          <LegalSection number="11" title="Contact">
            <div className="space-y-4">
              <p>
                If you have questions, complaints, or legal notices about these Terms, please
                contact Raffila through any of the following channels:
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-paper p-4 ring-1 ring-ink/5">
                  <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-ink/45">
                    Legal correspondence
                  </p>
                  <p className="mt-2 font-bold text-ink">legal@raffila.com</p>
                </div>
                <div className="rounded-2xl bg-paper p-4 ring-1 ring-ink/5">
                  <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-ink/45">
                    Customer support
                  </p>
                  <p className="mt-2 font-bold text-ink">support@raffila.com</p>
                </div>
                <div className="rounded-2xl bg-paper p-4 ring-1 ring-ink/5">
                  <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-ink/45">
                    Helpdesk
                  </p>
                  <p className="mt-2 font-bold text-ink">helpdesk@raffila.com</p>
                </div>
                <div className="rounded-2xl bg-paper p-4 ring-1 ring-ink/5">
                  <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-ink/45">
                    Registered address
                  </p>
                  <p className="mt-2 font-bold text-ink">Lagos, Nigeria</p>
                </div>
                <div className="rounded-2xl bg-paper p-4 ring-1 ring-ink/5">
                  <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-ink/45">
                    Response timeline
                  </p>
                  <p className="mt-2 font-bold text-ink">Within 5 business days</p>
                </div>
              </div>
              <p className="pt-2 text-xs font-bold text-ink/55">
                Dated: 2026-09-07. Last updated at time of account creation or latest email
                notification of material amendment.
              </p>
            </div>
          </LegalSection>
        </div>
      </div>
    </div>
  );
}

export function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 lg:px-8 lg:py-14">
      <PageIntro
        eyebrow="Legal"
        title="Privacy Policy"
        text="How Raffila collects, uses, shares, and protects personal information for competition entrants, account holders, and website visitors, in accordance with the NDPR 2019."
      />
      <div className="mt-8">
        <LegalBanner />
        <div className="space-y-10 text-sm leading-relaxed text-ink/70 sm:text-[15px]">
          <LegalSection number="1" title="Information We Collect">
            <div className="space-y-4">
              <p>
                Raffila ("Raffila", "we", "us" or "our") is the Data Controller responsible for the
                personal information described in this Privacy Policy. Our processing is conducted
                in accordance with the Nigerian Data Protection Regulation 2019 ("NDPR") and
                applicable supplementary guidance issued by the Nigeria Data Protection Commission
                (NDPC).
              </p>
              <p>
                We collect only the information reasonably necessary to operate the Services,
                lawfully run prize competitions, process payments, pay referral commissions, deliver
                prizes, meet our KYC, anti-money laundering ("AML"), and
                counter-financing-of-terrorism ("CFT") obligations and for the other purposes
                described in this Policy.
              </p>
              <ol className="list-decimal space-y-3 pl-5 marker:text-coral">
                <li>
                  <span className="font-bold text-ink">Account and registration data.</span> When
                  you create a Raffila account we collect your first name, last name, email address,
                  Nigerian mobile phone number, chosen password (stored only as a cryptographic
                  hash), date of birth, state of residence, and referral code (if any).
                </li>
                <li>
                  <span className="font-bold text-ink">Verification, KYC and identity data.</span>{" "}
                  When you apply to withdraw referral commissions, claim a prize, or when we
                  otherwise require enhanced verification, we collect your Bank Verification Number
                  (BVN), a scan or photograph of a valid government-issued photo ID (PVC, NIN slip,
                  Driver Licence, Passport), a selfie or liveness photo, proof of residential
                  address not older than 3 months (utility bill, bank statement, rent receipt), and
                  your Nigerian bank account details (bank name, account number, account name) for
                  payout purposes.
                </li>
                <li>
                  <span className="font-bold text-ink">Transaction, wallet and payment data.</span>{" "}
                  When you fund your Wallet, purchase competition entries, earn referral
                  commissions, or request a payout, we collect transaction identifiers (including
                  ticket IDs in the format RF-YYYY-XXXXXXXX), amounts, timestamps, payment processor
                  references, the payment method used (card, bank transfer, USSD via Paystack or
                  Flutterwave), last-4 of card numbers, and the status of each transaction. We do
                  not store full card numbers or CVV — these are handled exclusively by our licensed
                  PCI-DSS compliant payment Processors.
                </li>
                <li>
                  <span className="font-bold text-ink">Competition and draw records.</span> We
                  retain a permanent record of every ticket purchased (ticket ID, draw ID, purchase
                  timestamp, quantity, entry price paid, source account debited) together with the
                  published HMAC_DRBG draw input and output for each competition you enter, in order
                  to resolve disputes and for independent audit.
                </li>
                <li>
                  <span className="font-bold text-ink">Device, location and technical data.</span>{" "}
                  We automatically collect IP address, approximate geo-location derived from IP
                  (city/state level only), device make and model, operating system version, browser
                  type and user agent string, screen resolution, referring URL, exit URL, pages
                  visited, timestamps of visits, and general clickstream activity.
                </li>
                <li>
                  <span className="font-bold text-ink">
                    Marketing and communications preferences.
                  </span>{" "}
                  We collect your opt-in consents, opt-out records, and email/SMS bounce/open/click
                  metadata used to deliver lawful competition, referral and prize notifications and
                  (only where consent is given) marketing communications.
                </li>
                <li>
                  <span className="font-bold text-ink">Correspondence and support.</span> We collect
                  the content, attachments, and metadata of emails, support tickets, social media
                  messages, chat transcripts, and telephone calls that you send to or receive from
                  our support, legal, compliance, or anti-fraud teams.
                </li>
              </ol>
            </div>
          </LegalSection>
          <LegalSection number="2" title="How We Use Information">
            <div className="space-y-4">
              <p>
                We process each category of personal data only for one or more of the following
                purposes, relying on one or more of the lawful bases under the NDPR (contract
                performance, legitimate interests, legal obligation, consent, and protection of
                vital interests as applicable):
              </p>
              <ol className="list-decimal space-y-3 pl-5 marker:text-coral">
                <li>
                  <span className="font-bold text-ink">Contract performance.</span> Creating and
                  administering your Raffila account, verifying your identity so that prizes and
                  referral commissions can lawfully be paid to you, issuing RF ticket identifiers,
                  debiting your Wallet or Referral balance in exchange for entries, conducting
                  draws, selecting winners, contacting winners, arranging prize delivery, and paying
                  referral commissions to your bank account.
                </li>
                <li>
                  <span className="font-bold text-ink">Legal obligation.</span> Complying with the
                  NDPR, CAMA, the CBN AML/CFT Regulations, the EFCC Act, tax reporting and
                  withholding obligations, Nigerian sanctions law, valid court orders, subpoenas,
                  lawful requests from Nigerian regulators, and our KYC and enhanced due diligence
                  duties (including BVN verification and sanctions screening).
                </li>
                <li>
                  <span className="font-bold text-ink">Legitimate interests.</span> Operating and
                  improving the Site and Services; preventing, detecting and investigating fraud,
                  collusion, bot activity, ticket manipulation, VPN circumvention of
                  geo-restrictions, money laundering, and other conduct which breaches the{" "}
                  <Link
                    to="/terms-and-conditions"
                    className="font-bold text-coral underline underline-offset-2 hover:text-ink"
                  >
                    Terms and Conditions
                  </Link>
                  ; enforcing our rights under our agreements; ensuring network and information
                  security; conducting product analytics; sending required administrative and
                  lifecycle notices (draw reminders, claim window alerts, account security alerts).
                  Where we rely on legitimate interests, we conduct an internal balancing test and
                  you may object as described in Section 6.
                </li>
                <li>
                  <span className="font-bold text-ink">Consent.</span> Where consent is required by
                  applicable law — including for electronic direct marketing messages under the
                  NDPR, the use of non-essential cookies, or the public release of a winner's full
                  legal name and photographic likeness — we will only process after we have obtained
                  your specific, freely given, informed, unambiguous, and revocable opt-in consent,
                  which you may withdraw at any time.
                </li>
                <li>
                  <span className="font-bold text-ink">
                    Prize announcements and winners gallery.
                  </span>{" "}
                  We publish first name, last initial and state of residence of verified winners in
                  the public Winners Gallery (
                  <Link
                    to="/winners"
                    className="font-bold text-coral underline underline-offset-2 hover:text-ink"
                  >
                    /winners
                  </Link>
                  ) and across our marketing on the legitimate-interest basis described above, in
                  order to evidence fair operation of the draws. A winner's full legal name, photo,
                  and testimonial are published only with separate written consent.
                </li>
              </ol>
            </div>
          </LegalSection>
          <LegalSection number="3" title="Sharing & Disclosure">
            <div className="space-y-4">
              <p>
                We do not sell your personal information. We share data only with the categories of
                recipients listed below, always subject to appropriate safeguards (contractual data
                processing clauses, NDPR-compliant processor terms, confidentiality obligations, and
                technical and organizational security measures):
              </p>
              <ol className="list-decimal space-y-3 pl-5 marker:text-coral">
                <li>
                  <span className="font-bold text-ink">Payment processors.</span> Paystack and
                  Flutterwave, to process Wallet funding, payment authorisation, fraud screening,
                  bank settlement and payouts. Payment processors operate under their own PCI-DSS
                  certification and privacy notices.
                </li>
                <li>
                  <span className="font-bold text-ink">
                    Identity and KYC verification providers.
                  </span>{" "}
                  Licensed Nigerian identity verification service providers and BVN verification
                  endpoints to validate government IDs, proof of address, liveness, sanctions
                  screening, and BVN match.
                </li>
                <li>
                  <span className="font-bold text-ink">Prize partners and insurers.</span> The
                  partner that supplied a prize (where named on the competition page) and the
                  prize-indemnity insurer(s), solely to the extent needed to deliver the prize,
                  validate the insurance claim, or perform a required pre-delivery identity check on
                  the winner.
                </li>
                <li>
                  <span className="font-bold text-ink">Logistics and delivery partners.</span>{" "}
                  Licensed courier or logistics companies to deliver physical prizes to a winner's
                  nominated Nigerian address; only the minimum data needed for last-mile delivery is
                  shared (name, phone, delivery address, prize description).
                </li>
                <li>
                  <span className="font-bold text-ink">Anti-fraud and cybersecurity vendors.</span>{" "}
                  Device fingerprinting, bot detection, and analytics providers to detect and
                  prevent collusion, botnet entries, card testing, account takeover and account
                  abuse.
                </li>
                <li>
                  <span className="font-bold text-ink">Professional advisors.</span> External
                  auditors, solicitors, barristers, notaries public, accountants, tax advisors and
                  insurers in the course of providing professional services to Raffila, bound by
                  professional secrecy obligations.
                </li>
                <li>
                  <span className="font-bold text-ink">Regulators and law enforcement.</span> The
                  Nigeria Data Protection Commission (NDPC), Central Bank of Nigeria (CBN), Economic
                  and Financial Crimes Commission (EFCC), Independent Corrupt Practices Commission
                  (ICPC), Nigerian Police Force, Federal Inland Revenue Service (FIRS), courts, and
                  any other Nigerian regulator or competent law-enforcement body, in response to a
                  valid, lawful, and specific written request, subpoena or court order.
                </li>
                <li>
                  <span className="font-bold text-ink">Corporate transactions.</span> In the event
                  of a merger, acquisition, business combination, financing, reorganisation, or sale
                  of all or substantially all of the assets of Raffila, your personal data may be
                  transferred to the successor entity subject to the same or more protective privacy
                  terms.
                </li>
              </ol>
              <p>
                We maintain a publicly accessible Register of Data Processing Activities available
                on written request to privacy@raffila.com that describes, for each processing
                operation, the categories of data subject, personal data, processing purpose, lawful
                basis, recipient categories, retention periods, and applicable safeguards.
              </p>
            </div>
          </LegalSection>
          <LegalSection number="4" title="Cookies & Analytics">
            <div className="space-y-4">
              <ol className="list-decimal space-y-3 pl-5 marker:text-coral">
                <li>
                  <span className="font-bold text-ink">What cookies are.</span> Cookies are small
                  text files that a website stores on your browser or device. We use cookies and
                  similar technologies (pixels, local storage, session storage) together with your
                  explicit cookie preferences (managed via the Cookie Preferences banner) as
                  required by the NDPR.
                </li>
                <li>
                  <span className="font-bold text-ink">
                    Strictly necessary cookies — always on.
                  </span>{" "}
                  These cookies are required for basic operation of the Site and Services and
                  include session authentication tokens, CSRF tokens, purchase-flow reservation
                  timers (5-minute entry hold), load-balancer affinity identifiers, and
                  cookie-consent choice persistence. These cannot be switched off because the Site
                  would not function.
                </li>
                <li>
                  <span className="font-bold text-ink">Analytics cookies (opt-in only).</span> With
                  your consent, we run privacy-preserving first-party product analytics to help us
                  understand how visitors use the Site so we can improve it. We use aggregated,
                  pseudonymised page-view and click-event data; no raw personal identifiers are
                  exported out of Nigeria without your further consent.
                </li>
                <li>
                  <span className="font-bold text-ink">Marketing cookies (opt-in only).</span> With
                  your explicit opt-in we may use social media remarketing pixels on Meta/Instagram
                  and similar platforms to serve relevant Raffila advertisements to people who have
                  visited the Site. These are deactivated unless you opt in.
                </li>
                <li>
                  <span className="font-bold text-ink">Managing preferences.</span> You can change
                  your cookie preferences at any time by clicking "Cookie preferences" in the footer
                  of the Site or by writing to privacy@raffila.com. Most browsers also enable you to
                  block or delete cookies via browser settings; note that doing so may affect the
                  functionality of the Services.
                </li>
              </ol>
            </div>
          </LegalSection>
          <LegalSection number="5" title="Data Retention & Security">
            <div className="space-y-4">
              <ol className="list-decimal space-y-3 pl-5 marker:text-coral">
                <li>
                  <span className="font-bold text-ink">Retention by category.</span> We retain
                  personal data only for as long as reasonably necessary to fulfil the purpose for
                  which it was collected and to meet our legal, accounting, tax, audit and
                  dispute-resolution obligations: (a) Account registration data — retained for the
                  life of the account plus 7 years after closure; (b) KYC and identity documents —
                  retained for 7 years after the last transaction on the account, in line with CBN
                  AML/CFT record-keeping rules; (c) Transaction records including ticket IDs, draw
                  inputs and outputs — permanently retained for independent draw audit and disputes;
                  (d) Payment processor references — retained for 7 years after settlement; (e)
                  Support correspondence — retained for 6 years after closure of the ticket; (f)
                  Marketing opt-out registers — retained indefinitely in order to continue honouring
                  opt-outs; (g) Raw server logs — retained for 12 months, then aggregated and
                  anonymised.
                </li>
                <li>
                  <span className="font-bold text-ink">Secure disposal.</span> Where personal data
                  is no longer required we securely delete, destroy, or irreversibly anonymise it
                  (overwriting, cryptographic shredding, or certified physical destruction), keeping
                  an audit record of the disposal.
                </li>
                <li>
                  <span className="font-bold text-ink">
                    Technical and organizational security measures.
                  </span>{" "}
                  We implement the following minimum measures: (a) TLS 1.3+ encryption for all
                  traffic in transit; (b) AES-256 encryption at rest for identity documents, BVN,
                  and bank account details; (c) multi-factor authentication (time-based one-time
                  passwords) required on all internal administrative accounts and available as a
                  user option at{" "}
                  <Link
                    to="/dashboard/security"
                    className="font-bold text-coral underline underline-offset-2 hover:text-ink"
                  >
                    Dashboard → Security
                  </Link>
                  ; (d) password hashing using Argon2id with a minimum 16 MiB memory cost; (e)
                  role-based access controls and principle of least privilege for staff; (f)
                  quarterly vulnerability scanning and annual penetration testing by an independent
                  NDPC-recognised firm; (g) written Information Security Management System (ISMS);
                  (h) staff NDPR training at onboarding and annually thereafter; (i) device
                  management and endpoint protection on all internal endpoints.
                </li>
                <li>
                  <span className="font-bold text-ink">Data breach notification.</span> In the event
                  of a personal data breach that is likely to result in a risk to the rights and
                  freedoms of natural persons, we will: (a) record the breach in our internal breach
                  register; (b) notify the NDPC without undue delay and, where feasible, not later
                  than 72 hours after becoming aware of it; and (c) communicate the breach to
                  affected data subjects without undue delay where the risk is high, unless we have
                  put in place subsequent technical and organisational measures that render the risk
                  no longer high, or where the communication would involve disproportionate effort
                  (in which case a public notice or similar measure will be used instead).
                </li>
              </ol>
            </div>
          </LegalSection>
          <LegalSection number="6" title="Your Rights & Choices">
            <div className="space-y-4">
              <p>
                As a data subject under the NDPR 2019, you have the following rights in respect of
                your personal data. We will respond to verified requests within 28 calendar days
                (extendable by a further 56 calendar days where the request is complex or
                high-volume, in which case we will notify you of the extension within the first 28
                days and explain the reason for delay). We do not charge for a first request per
                calendar year; further manifestly unfounded or excessive requests may attract a
                reasonable administrative fee based on cost.
              </p>
              <ol className="list-decimal space-y-3 pl-5 marker:text-coral">
                <li>
                  <span className="font-bold text-ink">Right of access.</span> You may request
                  confirmation of whether we are processing personal data relating to you, a copy of
                  that data in a structured, commonly used and machine-readable format (JSON or
                  CSV), and a description of the processing.
                </li>
                <li>
                  <span className="font-bold text-ink">Right to rectification.</span> You have the
                  right to have inaccurate or incomplete personal data corrected without undue
                  delay. You can update most profile information directly on{" "}
                  <Link
                    to="/dashboard/profile"
                    className="font-bold text-coral underline underline-offset-2 hover:text-ink"
                  >
                    Dashboard → Profile
                  </Link>
                  .
                </li>
                <li>
                  <span className="font-bold text-ink">
                    Right to erasure ("right to be forgotten").
                  </span>{" "}
                  You may request deletion of personal data in the circumstances set out in the
                  NDPR, for example where processing is no longer necessary, consent is withdrawn
                  and no other lawful basis applies, or the processing is unlawful. Exclusions apply
                  where retention is required by Nigerian law (e.g. 7-year AML records).
                </li>
                <li>
                  <span className="font-bold text-ink">Right to restrict processing.</span> You may
                  request suspension of processing where the accuracy of the data is contested, the
                  processing is unlawful, or we no longer need the data but you require it for the
                  establishment, exercise or defence of legal claims.
                </li>
                <li>
                  <span className="font-bold text-ink">Right to data portability.</span> Where
                  processing is based on consent or on a contract and is carried out by automated
                  means, you may receive your personal data in a machine-readable format or have it
                  transmitted directly to another controller where technically feasible.
                </li>
                <li>
                  <span className="font-bold text-ink">Right to object.</span> You may object at any
                  time to processing based on our legitimate interests (including direct marketing)
                  on grounds relating to your particular situation. We will cease processing unless
                  we demonstrate compelling legitimate grounds for the processing which override
                  your interests, rights and freedoms, or we need the processing for the
                  establishment, exercise or defence of legal claims.
                </li>
                <li>
                  <span className="font-bold text-ink">Right to withdraw consent.</span> Where we
                  have relied on your consent to process personal data, you may withdraw that
                  consent at any time. Withdrawal does not affect the lawfulness of processing
                  carried out before withdrawal.
                </li>
                <li>
                  <span className="font-bold text-ink">Right to lodge a complaint.</span> If you
                  believe that our processing of your personal data infringes the NDPR, you may
                  lodge a complaint with the Nigeria Data Protection Commission (NDPC) at
                  ndpc.gov.ng or by writing to the Data Protection Officer at privacy@raffila.com
                  who will acknowledge the complaint within 7 business days.
                </li>
                <li>
                  <span className="font-bold text-ink">
                    Automated decision-making and profiling.
                  </span>{" "}
                  We carry out limited automated decision-making and profiling for anti-fraud,
                  sanctions screening, and credit-risk evaluation of referral payout requests. Where
                  a decision based solely on automated processing produces a legal or similarly
                  significant effect concerning you, you have the right to obtain human
                  intervention, to express your point of view, to contest the decision, and to be
                  given the reasons for it.
                </li>
              </ol>
              <p>
                To exercise any of these rights, please email privacy@raffila.com from the email
                address registered to your account, include your full name and registered phone
                number, and clearly describe the right you wish to exercise. We may request
                additional verifying identity documentation before complying to protect against
                unauthorised access.
              </p>
            </div>
          </LegalSection>
          <LegalSection number="7" title="International Transfers">
            <div className="space-y-4">
              <ol className="list-decimal space-y-3 pl-5 marker:text-coral">
                <li>
                  <span className="font-bold text-ink">General rule.</span> As a general matter,
                  Raffila stores the primary copy of all personal data collected from Nigerian data
                  subjects on servers physically located within the Federal Republic of Nigeria,
                  operated by an NDPC-registered infrastructure provider.
                </li>
                <li>
                  <span className="font-bold text-ink">Permitted transfers with safeguards.</span>{" "}
                  Where it is necessary to transfer personal data outside of Nigeria to a
                  sub-processor for purposes described in this Policy — for example, to a global
                  cloud provider's disaster-recovery region, or to a licensed identity-verification
                  provider — the transfer will be made only where one of the following NDPR
                  conditions is met: (a) the recipient country is the subject of an NDPC adequacy
                  decision; (b) we have executed binding Standard Data Protection Clauses (SDPCs)
                  approved by the NDPC with the recipient; (c) the recipient has Binding Corporate
                  Rules approved by the NDPC; or (d) we have obtained your explicit, informed,
                  written consent to the specific transfer after clearly informing you of the
                  possible risks of the transfer in the absence of an adequacy decision and
                  appropriate safeguards.
                </li>
                <li>
                  <span className="font-bold text-ink">Sub-processor register.</span> A current list
                  of our non-Nigerian sub-processors and the safeguards applied to transfers is
                  maintained in our Register of Data Processing Activities and is available on
                  written request to privacy@raffila.com.
                </li>
              </ol>
            </div>
          </LegalSection>
          <LegalSection number="8" title="Children">
            <div className="space-y-4">
              <p>
                Raffila prize competitions are age-gated and are not directed at, and are not open
                to, children or minors under the age of 18. We do not knowingly collect, solicit, or
                process personal data from any person under 18.
              </p>
              <p>
                If we learn that we have inadvertently collected personal information from a child
                under 18 — including, for example, where a minor fraudulently misrepresents age
                during registration — we will, upon becoming aware: (a) immediately disable the
                account; (b) remove any ticket entries from draws; (c) refund any Wallet balance to
                the source payment instrument; (d) permanently delete or irreversibly anonymise all
                personal data relating to that minor from our systems and those of our processors;
                and (e) retain only a minimal record of the account identifier and deletion date on
                a restricted blacklist to prevent re-registration.
              </p>
              <p>
                If you are a parent, guardian or educator and believe a child under 18 has provided
                personal data to Raffila without your consent, please notify us immediately at
                privacy@raffila.com with the subject line
                <span className="font-mono font-bold text-ink"> "MINOR DATA REPORT"</span> and we
                will respond within 5 business days.
              </p>
            </div>
          </LegalSection>
          <LegalSection number="9" title="Changes to this Policy">
            <div className="space-y-4">
              <ol className="list-decimal space-y-3 pl-5 marker:text-coral">
                <li>
                  <span className="font-bold text-ink">Version control.</span> This Privacy Policy
                  is version-controlled and the "Last updated" date appears at the end of this
                  Policy. Any new version supersedes all prior versions upon its effective date.
                </li>
                <li>
                  <span className="font-bold text-ink">Material changes.</span> If we make changes
                  that, in our good-faith determination, materially alter your rights, our
                  obligations, or the scope of processing described in this Policy, we will: (a)
                  send you written notice of the changes by email to your registered address at
                  least thirty (30) calendar days before the new policy becomes effective; and (b)
                  publish a notice on the Site for the same period; and (c) where a change is based
                  on a new or expanded purpose that relies on consent, we will separately request
                  your explicit opt-in before the new processing begins.
                </li>
                <li>
                  <span className="font-bold text-ink">Open-entry grandfathering.</span> For entries
                  already purchased in open competitions at the time of a material change, the
                  Privacy Policy version in effect at the time the entry was paid for will continue
                  to apply to that specific draw's record-keeping and winner processing unless you
                  explicitly accept the newer version.
                </li>
              </ol>
            </div>
          </LegalSection>
          <LegalSection number="10" title="Contact">
            <div className="space-y-4">
              <p>
                For questions about this Privacy Policy, the exercise of your NDPR rights,
                data-subject access requests, a copy of our Data Processing Register, or to report a
                suspected personal data breach, please contact our Data Protection Officer ("DPO")
                and compliance team:
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-paper p-4 ring-1 ring-ink/5">
                  <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-ink/45">
                    Data Protection Officer
                  </p>
                  <p className="mt-2 font-bold text-ink">privacy@raffila.com</p>
                </div>
                <div className="rounded-2xl bg-paper p-4 ring-1 ring-ink/5">
                  <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-ink/45">
                    Postal / registered address
                  </p>
                  <p className="mt-2 font-bold text-ink">Raffila · Lagos, Nigeria</p>
                </div>
                <div className="rounded-2xl bg-paper p-4 ring-1 ring-ink/5">
                  <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-ink/45">
                    Breach hotline (urgent)
                  </p>
                  <p className="mt-2 font-bold text-ink">dpo-breach@raffila.com</p>
                </div>
                <div className="rounded-2xl bg-paper p-4 ring-1 ring-ink/5">
                  <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-ink/45">
                    Supervisory authority
                  </p>
                  <p className="mt-2 font-bold text-ink">
                    Nigeria Data Protection Commission (NDPC)
                  </p>
                </div>
              </div>
              <p className="pt-2 text-xs font-bold text-ink/55">
                Last updated: 2026-09-07. Effective for all users registering on or after this date;
                earlier versions retained in our version archive at privacy@raffila.com on request.
              </p>
            </div>
          </LegalSection>
        </div>
      </div>
    </div>
  );
}

export function CompetitionRulesPage() {
  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 lg:px-8 lg:py-14">
      <PageIntro
        eyebrow="Legal"
        title="Competition Rules"
        text="The specific, binding rules that govern every Raffila prize draw: entry, draws, winners, prizes, refunds and final decisions."
      />
      <div className="mt-8">
        <LegalBanner />
        <div className="space-y-10 text-sm leading-relaxed text-ink/70 sm:text-[15px]">
          <LegalSection number="1" title="Organizer & Scope">
            <div className="space-y-4">
              <ol className="list-decimal space-y-3 pl-5 marker:text-coral">
                <li>
                  <span className="font-bold text-ink">Organizer.</span> Every prize competition
                  ("Competition", "draw" or "campaign") hosted on raffila.com is organized and
                  promoted by Raffila ("Organizer", "Raffila", "we" or "us"), a company organized
                  under the laws of the Federal Republic of Nigeria.
                </li>
                <li>
                  <span className="font-bold text-ink">Scope and incorporation.</span> These
                  Official Competition Rules ("Rules") apply to every Competition hosted on the
                  Raffila Platform, in addition to (and in the event of conflict taking priority
                  over) the general{" "}
                  <Link
                    to="/terms-and-conditions"
                    className="font-bold text-coral underline underline-offset-2 hover:text-ink"
                  >
                    Terms and Conditions
                  </Link>{" "}
                  and{" "}
                  <Link
                    to="/privacy-policy"
                    className="font-bold text-coral underline underline-offset-2 hover:text-ink"
                  >
                    Privacy Policy
                  </Link>
                  , which are incorporated by reference. Where a specific Competition has additional
                  rules published on its competition detail page (e.g. age restrictions, residency
                  carve-outs, bespoke delivery terms, a draw delay clause due to inventory close
                  timing), those specific rules also apply and take priority for that single
                  Competition only.
                </li>
                <li>
                  <span className="font-bold text-ink">Free entry route.</span> Where required by
                  applicable Nigerian law, a free, no-purchase-necessary entry channel is available
                  on written request to{" "}
                  <span className="font-bold text-ink">freeentry@raffila.com</span> with valid proof
                  of Nigerian residency and a legible handwritten entry statement. Free entries are
                  assigned the same ticket format (RF-YYYY-XXXXXXXX) and equal probability weight
                  per entry as paid entries in the same draw.
                </li>
              </ol>
            </div>
          </LegalSection>
          <LegalSection number="2" title="Eligibility">
            <div className="space-y-4">
              <ol className="list-decimal space-y-3 pl-5 marker:text-coral">
                <li>
                  <span className="font-bold text-ink">Age.</span> All entrants must be a minimum of
                  eighteen (18) years of age on the date the ticket entry is purchased or submitted.
                </li>
                <li>
                  <span className="font-bold text-ink">Residency and presence.</span> Entries are
                  only valid from individuals who are both (a) ordinarily resident in the Federal
                  Republic of Nigeria, and (b) physically present in Nigeria at the moment the entry
                  is purchased or submitted. We may use IP geo-location, device time-zone, SIM
                  country, BVN match, KYC documentation, or a combination, to verify presence and
                  residency.
                </li>
                <li>
                  <span className="font-bold text-ink">Verified account.</span> A ticket entry is
                  only valid when associated with a verified Raffila account (successfully email OTP
                  verified and phone number verified at a minimum). Winners must also complete full
                  KYC level-2 verification (BVN, valid ID, proof of address) before a prize will be
                  released.
                </li>
                <li>
                  <span className="font-bold text-ink">Excluded persons.</span> The following
                  persons are not eligible to enter any Competition or win any Prize: (a) employees,
                  officers, directors and contractors of Raffila and its affiliated companies; (b)
                  employees, officers and directors of any prize Partner that has contributed a
                  prize to the Competition and members of their immediate household; (c) Raffila
                  advertising, promotional, software, legal, compliance and audit agencies and
                  members of their immediate household; (d) immediate family members (spouse,
                  domestic partner, parent, stepparent, grandparent, sibling, half-sibling, child,
                  stepchild, grandchild, legal ward) of any person in categories (a), (b) or (c)
                  above; (e) individuals previously banned, suspended or terminated from Raffila;
                  (f) individuals on any applicable sanctions list.
                </li>
                <li>
                  <span className="font-bold text-ink">One natural person, one account.</span> No
                  individual natural person may hold more than one (1) verified Raffila account
                  across all email addresses, phone numbers or device identities.
                </li>
              </ol>
            </div>
          </LegalSection>
          <LegalSection number="3" title="Entry">
            <div className="space-y-4">
              <ol className="list-decimal space-y-3 pl-5 marker:text-coral">
                <li>
                  <span className="font-bold text-ink">How to enter.</span> Entries may be purchased
                  through the Raffila website only. Each entry is paid either from the entrant's
                  pre-funded Raffila Wallet balance or from the entrant's accrued Referral
                  Commission balance. Split payments between sources are not supported.
                </li>
                <li>
                  <span className="font-bold text-ink">Ticket issuance.</span> Once a purchase is
                  complete and successfully debited from the selected source, Raffila will
                  electronically issue one or more unique ticket identifiers in the format{" "}
                  <span className="font-mono text-ink">RF-YYYY-XXXXXXXX</span>. Ticket numbers are
                  irrevocably associated with the verified account and cannot be sold, transferred,
                  gifted, pledged, or assigned to any other person or account. Proof of purchase or
                  a screen capture does not constitute a valid ticket in the absence of a
                  corresponding RF ticket identifier recorded in our systems.
                </li>
                <li>
                  <span className="font-bold text-ink">Reservation window.</span> When a user
                  initiates the purchase flow, the selected number of entries is reserved from
                  general inventory for a rolling five (5) minute window. If the purchase is not
                  completed within this window the reserved tickets are released back to inventory
                  and may be purchased by another entrant.
                </li>
                <li>
                  <span className="font-bold text-ink">Entry confirmation.</span> Entrants will
                  receive an in-app purchase confirmation, a transaction ledger entry in the Wallet
                  / Transactions page and a summary email after a successful purchase. Entrants are
                  solely responsible for verifying that their intended quantity of tickets has been
                  correctly credited; discrepancies must be reported to support@raffila.com within
                  24 hours.
                </li>
                <li>
                  <span className="font-bold text-ink">No agent or third-party entries.</span>{" "}
                  Entries submitted by any third party on behalf of another, via bot, macro, script,
                  automated service, proxy, virtual private network designed to circumvent
                  geo-restriction, VPN, paid click farm, sweepstakes club, syndicate or similar
                  means are void and will be disqualified.
                </li>
              </ol>
            </div>
          </LegalSection>
          <LegalSection number="4" title="Ticket Pricing & Limits">
            <div className="space-y-4">
              <ol className="list-decimal space-y-3 pl-5 marker:text-coral">
                <li>
                  <span className="font-bold text-ink">Entry price.</span> All prices are
                  denominated in Nigerian Naira (₦) inclusive of all platform fees and applicable
                  taxes unless otherwise stated on the Competition page. Prices within our backend
                  systems are stored in integer kobo (₦ × 100) to avoid rounding drift.
                </li>
                <li>
                  <span className="font-bold text-ink">Per-account per-competition cap.</span>{" "}
                  Unless otherwise expressly stated on a specific Competition's detail page, a
                  single verified account may purchase a maximum of fifty (50) ticket entries per
                  individual Competition draw. The applicable numeric cap (including any lower cap
                  for a specific draw) is published on the Competition detail page and enforced at
                  checkout.
                </li>
                <li>
                  <span className="font-bold text-ink">Inventory cap.</span> Each Competition has a
                  fixed, published total ticket inventory ("Total Entries"). The inventory figure is
                  displayed on every Competition card and detail page in the format "X LEFT | OUT OF
                  Y". No further entries are accepted once the total inventory of tickets for a draw
                  has been fully sold (i.e. "SOLD OUT" state), regardless of any remaining
                  per-account quota.
                </li>
                <li>
                  <span className="font-bold text-ink">Odds calculation.</span> The probability of
                  winning any single prize is equal to the number of valid RF ticket identifiers
                  held by an entrant divided by the total number of valid ticket identifiers sold in
                  that specific draw. Odds are illustrated on the detail page and improve
                  proportionally with the number of entries purchased.
                </li>
              </ol>
            </div>
          </LegalSection>
          <LegalSection number="5" title="Competition Period">
            <div className="space-y-4">
              <ol className="list-decimal space-y-3 pl-5 marker:text-coral">
                <li>
                  <span className="font-bold text-ink">Open period.</span> Each Competition opens at
                  the published start date/time (UTC+1 / WAT) and closes at the first to occur of:
                  (a) the published end date/time shown on the Competition detail page, or (b) the
                  point in time at which 100% of the total ticket inventory is sold and confirmed
                  paid.
                </li>
                <li>
                  <span className="font-bold text-ink">Live countdown.</span> An on-page countdown
                  timer displays the remaining time. The timer is indicative; authoritative close
                  time is the server timestamp applied to the last accepted entry.
                </li>
                <li>
                  <span className="font-bold text-ink">Late entries.</span> No entries are accepted
                  after the Competition is closed. Late or unsuccessful transactions — including but
                  not limited to transactions that fail verification or are declined by the payment
                  processor after the close — are not counted and any associated monies are reversed
                  back to the user's source account.
                </li>
                <li>
                  <span className="font-bold text-ink">Extension or early close.</span> Raffila
                  reserves the right in its sole discretion (i) to extend the close date of any
                  Competition if, for example, insufficient entries have been sold, or (ii) to close
                  a Competition early upon a confirmed SOLD OUT state, or (iii) to pause a
                  Competition temporarily for security, fraud investigation, technical emergency or
                  regulatory inquiry. All valid ticket entries purchased before such pause, early
                  close or extension continue to hold their probability weight unchanged.
                </li>
              </ol>
            </div>
          </LegalSection>
          <LegalSection number="6" title="Draw Procedure & Verification">
            <div className="space-y-4">
              <ol className="list-decimal space-y-3 pl-5 marker:text-coral">
                <li>
                  <span className="font-bold text-ink">Timing of draw.</span> The official draw
                  ("Draw") for a Competition takes place within seventy-two (72) hours of that
                  Competition's close. For draws marketed as "Live draws", the Draw will be
                  conducted and streamed or published within the advertised live session window as
                  described on the Competition page.
                </li>
                <li>
                  <span className="font-bold text-ink">Draw algorithm.</span> The winning ticket
                  identifier is selected by a cryptographically secure, publicly verifiable
                  deterministic random draw using the{" "}
                  <span className="font-mono font-bold text-ink">HMAC_DRBG</span> (Hash-based
                  Message Authentication Code Deterministic Random Bit Generator) algorithm over
                  SHA-256.
                </li>
                <li>
                  <span className="font-bold text-ink">Published inputs.</span> Prior to the Draw,
                  Raffila publishes and commits to the following inputs on the Draw Verification
                  page for the competition: (a) a public pre-commitment seed (a high-entropy
                  hex-encoded random value); (b) a public external entropy beacon value (for
                  example, the closing hash of a future publicly verifiable Nigerian Exchange or
                  Bitcoin block hash published after close and known not to be manipulable by
                  Raffila); (c) the full ordered, frozen, immutable list of every valid RF ticket
                  identifier and corresponding anonymized account index in the draw; (d) the exact
                  HMAC_DRBG construction and derivation path that will be applied.
                </li>
                <li>
                  <span className="font-bold text-ink">Independent reproducibility.</span> All
                  inputs are published such that any independent third party can reproduce the exact
                  winning ticket identifier offline without access to Raffila's systems. The
                  methodology, sample code and input schema are described on{" "}
                  <Link
                    to="/draw-verification/$campaign"
                    params={{ campaign: "example" }}
                    className="font-bold text-coral underline underline-offset-2"
                  >
                    /draw-verification
                  </Link>
                  .
                </li>
                <li>
                  <span className="font-bold text-ink">Single prize and multi-prize draws.</span>{" "}
                  For Competitions with more than one prize tier, the same algorithm is applied
                  iteratively using the same seed commitment but a per-prize counter increment to
                  derive an ordered list of winners; winners are selected sequentially from the
                  highest prize tier down and a single ticket is not drawn twice for the same draw.
                </li>
                <li>
                  <span className="font-bold text-ink">Quorum.</span> No minimum number of ticket
                  sales is required for a valid draw. The Draw is conducted regardless of the
                  percentage sold. If a Competition is cancelled, Rule 10 governs refunds.
                </li>
              </ol>
            </div>
          </LegalSection>
          <LegalSection number="7" title="Winner Selection & Notification">
            <div className="space-y-4">
              <ol className="list-decimal space-y-3 pl-5 marker:text-coral">
                <li>
                  <span className="font-bold text-ink">Winning ticket.</span> The holder of the RF
                  ticket identifier selected by the verified HMAC_DRBG procedure in Rule 6 is the
                  "Provisional Winner" of the corresponding prize for that draw, subject to
                  completing the eligibility, KYC and claim steps set out in these Rules.
                </li>
                <li>
                  <span className="font-bold text-ink">Notification.</span> Raffila will contact the
                  Provisional Winner within forty-eight (48) hours of the Draw by: (a) in-app banner
                  and notification; (b) e-mail to the registered e-mail address on the account; and
                  (c) SMS to the verified Nigerian mobile telephone number on the account. Raffila
                  is not responsible for failure of delivery, spam folder filtering, or changed
                  contact details.
                </li>
                <li>
                  <span className="font-bold text-ink">Public winners announcement.</span> Following
                  Draw confirmation, the Provisional Winner's first name, last initial and Nigerian
                  state of residence may be published in the{" "}
                  <Link
                    to="/winners"
                    className="font-bold text-coral underline underline-offset-2 hover:text-ink"
                  >
                    Winners Gallery
                  </Link>{" "}
                  and/or across Raffila social media channels. The Winner's full legal name,
                  photograph, likeness or testimonial are only published after Raffila has received
                  that Winner's separate written consent.
                </li>
                <li>
                  <span className="font-bold text-ink">Unclaimed prizes and redraw.</span> A
                  Provisional Winner who does not respond to claim notification within fourteen (14)
                  calendar days from the Draw date, or who fails or refuses to complete KYC level-2
                  verification and required signed documents within that period, or who is
                  disqualified under Rule 2 or 9, forfeits all rights to the prize. In such event,
                  the prize will be declared unclaimed and Raffila will conduct a Verified Redraw
                  using the remaining frozen entries from the same original draw with a fresh public
                  seed and the same HMAC_DRBG procedure to select a Replacement Winner. The Redraw
                  procedure is repeatable until a valid, claimable, verified Winner is produced.
                </li>
              </ol>
            </div>
          </LegalSection>
          <LegalSection number="8" title="Prizes, Claims & Delivery">
            <div className="space-y-4">
              <ol className="list-decimal space-y-3 pl-5 marker:text-coral">
                <li>
                  <span className="font-bold text-ink">Description.</span> Prizes are described on
                  each Competition detail page alongside photographs, key specifications and, where
                  applicable, a stated insurance-backed prize value. Any accessories, upgrades,
                  add-ons, or consumables not expressly listed are excluded.
                </li>
                <li>
                  <span className="font-bold text-ink">Insurance.</span> Physical prizes over the
                  insured threshold are backed by a prize-indemnity insurance policy with an A-rated
                  Nigerian insurer for the stated value, ensuring that the Organizer has the funds
                  on hand to acquire or deliver the prize to the verified winner.
                </li>
                <li>
                  <span className="font-bold text-ink">Required claim steps.</span> Within the
                  14-day Claim Window the verified Winner must: (a) confirm acceptance of the prize
                  in writing; (b) complete KYC level-2 verification including BVN, valid government
                  ID, proof of address, and liveness check; (c) where requested, sign and return a
                  Prize Acceptance Form, Affidavit of Eligibility, Liability Release and (where
                  consent is separately given) a Publicity Release; and (d) provide a valid delivery
                  address and contact phone number for physical prizes or bank details for any
                  cash-equivalent prize.
                </li>
                <li>
                  <span className="font-bold text-ink">
                    No cash alternative, no substitution, no transfer.
                  </span>{" "}
                  Unless expressly stated on the Competition page, prizes are not exchangeable for
                  cash, cannot be substituted for another prize by the Winner, and cannot be sold,
                  transferred, gifted or assigned to any third party. Raffila reserves the right in
                  its sole discretion (but is not obliged) to substitute a prize of equal or greater
                  value where the original prize becomes unavailable due to circumstances outside
                  Raffila's reasonable control.
                </li>
                <li>
                  <span className="font-bold text-ink">Delivery.</span> Physical prizes are
                  delivered to a valid Nigerian residential address nominated by the verified
                  Winner. Delivery within Lagos, Abuja or Port Harcourt metro areas is attempted
                  within forty-five (45) calendar days of verified, signed, accepted claim. Delivery
                  outside these areas may require Winner collection at a partnered logistics depot
                  or additional delivery coordination. The Winner is responsible for ensuring
                  someone aged 18 or older is available to take receipt. Title and risk of loss
                  passes to the Winner upon signed delivery.
                </li>
                <li>
                  <span className="font-bold text-ink">Taxes and duties.</span> The Winner is solely
                  responsible for any and all income taxes, value added tax, withholding tax, stamp
                  duties, import duties, licence fees, vehicle registration, insurance, running
                  costs and any other charges or liabilities that arise from or in connection with
                  the prize, whether at the federal, state or local government level in Nigeria.
                  Raffila may, where required by law, deduct applicable withholding tax from any
                  cash prize or cash component before payment.
                </li>
              </ol>
            </div>
          </LegalSection>
          <LegalSection number="9" title="Conduct & Cheating">
            <div className="space-y-4">
              <ol className="list-decimal space-y-3 pl-5 marker:text-coral">
                <li>
                  <span className="font-bold text-ink">General standards.</span> Every entrant must
                  use the Platform lawfully, honestly and fairly and must not act in a manner that,
                  in Raffila's reasonable determination, undermines the integrity of a Competition
                  or of Raffila generally.
                </li>
                <li>
                  <span className="font-bold text-ink">
                    Disqualifying conduct (non-exhaustive).
                  </span>{" "}
                  Any of the following acts, at Raffila's sole reasonable determination, will result
                  in disqualification of the relevant entry or entries, forfeiture of any prize
                  right, and permanent suspension or termination of the account:
                  <ul className="mt-2 list-disc space-y-2 pl-6 marker:text-coral">
                    <li>
                      Providing false, inaccurate, incomplete, stolen or impersonated registration
                      or KYC information (including impersonation of another person, "jumpering"
                      another person's BVN, or using a deceased individual's identity).
                    </li>
                    <li>
                      Owning, operating or controlling more than one Raffila account, directly or
                      through nominees, family members, associates or shell accounts.
                    </li>
                    <li>
                      Purchasing entries with stolen payment credentials, laundered funds,
                      card-testing, chargeback abuse or any unlawful payment method.
                    </li>
                    <li>
                      Using bots, macros, scripts, scraping, automation, click farms, VPNs, proxies,
                      multi-accounting, colluding with other entrants, ring-fencing a competition by
                      a coordinated syndicate or any other method to circumvent entry caps,
                      inventory protections, geo-restrictions or the intended random character of
                      the draw.
                    </li>
                    <li>
                      Attempting to or actually interfering with the Draw algorithm, seed
                      publication, frozen entry set publication, verification page, cloud
                      infrastructure, application code, payment gateway, user account, or network
                      systems of Raffila or its Processors (including denial-of-service,
                      account-takeover, credential stuffing, XSS, SQLi, phishing, malware, insider
                      collusion, or any other attack).
                    </li>
                    <li>
                      Harassing, threatening, abusing, coercing or bribing any Raffila employee,
                      contractor, partner, other entrant, or any member of a winner's household.
                    </li>
                    <li>
                      Failure to cooperate with a reasonable anti-fraud, KYC, or source-of-funds
                      request, including sanctions screening.
                    </li>
                  </ul>
                </li>
                <li>
                  <span className="font-bold text-ink">Forfeiture.</span> Where an entrant is
                  disqualified: (a) any entries submitted by that entrant are void and are excluded
                  from the current Draw and all future Draws; (b) any Wallet balance derived from
                  fraud or unlawful sources is seized or reversed; (c) any accrued Referral
                  commissions are forfeited; (d) if a winner or provisional winner is disqualified
                  before prize delivery, Rule 7.4 (Unclaimed prizes and redraw) applies, as if the
                  winner had not responded within the Claim Window.
                </li>
              </ol>
            </div>
          </LegalSection>
          <LegalSection number="10" title="Refunds">
            <div className="space-y-4">
              <p>
                Entry purchases are generally final. A refund of a purchased entry (or entries) will
                only be made by Raffila in the following limited circumstances:
              </p>
              <ol className="list-decimal space-y-3 pl-5 marker:text-coral">
                <li>
                  <span className="font-bold text-ink">Competition cancelled by Raffila.</span> If
                  Raffila cancels a Competition before the Draw for any reason (including, without
                  limitation, regulatory order, force majeure, failure of the prize Partner to
                  perform, material technical failure that prevents a verifiable Draw, or
                  insufficient entries where Raffila elects not to exercise its extension option
                  under Rule 5.4), every paid ticket entrant will receive a full refund of the entry
                  price paid, credited back to the same source (Wallet or Referral balance) from
                  which the purchase was debited, within ten (10) business days of cancellation. No
                  additional interest, compensation or damages are payable beyond the entry price.
                </li>
                <li>
                  <span className="font-bold text-ink">Duplicate or erroneous entries.</span> Where
                  the Platform demonstrably and materially debits an incorrect amount, quantity or
                  Competition through an error originating in our software (excluding user error),
                  Raffila will at its option either (a) correct the error by applying the debit to
                  the intended Competition/quantity and refund any overcharge, or (b) fully refund
                  the transaction on written request made within 24 hours of the debit.
                </li>
                <li>
                  <span className="font-bold text-ink">Prohibited minor account.</span> Where an
                  account is opened by a person under 18 and this is confirmed by KYC, the Wallet
                  balance (if any) is refunded to the original payment source and the account is
                  closed. No other refund applies.
                </li>
                <li>
                  <span className="font-bold text-ink">Change of mind.</span> Change of mind,
                  voluntary withdrawal from a Competition after ticket issuance, and buyer's remorse
                  are not grounds for refund. Tickets are non-refundable once the RF ticket
                  identifier has been issued and the draw is open and live.
                </li>
                <li>
                  <span className="font-bold text-ink">Refunds to third parties.</span> Refunds are
                  issued only to the Raffila account and original payment source that made the
                  purchase. Refunds to anyone other than the purchasing account holder are never
                  made.
                </li>
              </ol>
            </div>
          </LegalSection>
          <LegalSection number="11" title="Liability">
            <div className="space-y-4">
              <ol className="list-decimal space-y-3 pl-5 marker:text-coral">
                <li>
                  <span className="font-bold text-ink">Organizer's undertakings.</span> Raffila
                  undertakes to run Competitions with reasonable skill and care, in accordance with
                  these Rules and the verified HMAC_DRBG procedure described in Rule 6, and to
                  deliver stated prizes to verified Winners as described in Rule 8.
                </li>
                <li>
                  <span className="font-bold text-ink">No warranties beyond the express.</span> Save
                  to the extent such exclusion is prohibited by the Nigerian Consumer Protection Act
                  2018 or other applicable mandatory law, Raffila excludes all warranties,
                  conditions, representations and terms (express, implied, collateral, statutory or
                  otherwise) with respect to the prize, including warranties of quality,
                  merchantability, fitness for a particular purpose, durability, title and
                  non-infringement. Any such warranty that cannot be excluded is limited in duration
                  to the shortest period permitted by law.
                </li>
                <li>
                  <span className="font-bold text-ink">
                    Indirect and consequential loss excluded.
                  </span>{" "}
                  In no event will Raffila, its directors, officers, employees, insurers, Processors
                  or prize Partners be liable for any indirect, incidental, special, consequential,
                  punitive or exemplary loss or damage, any loss of profit, loss of revenue, loss of
                  opportunity, loss of goodwill, loss of data, or business interruption, however
                  caused, whether in contract, tort (including negligence) or otherwise, arising out
                  of or in connection with these Rules or a Competition, even if Raffila has been
                  advised of the possibility of such loss.
                </li>
                <li>
                  <span className="font-bold text-ink">Aggregate cap.</span> Raffila's total
                  aggregate liability in contract, tort or otherwise for all losses arising out of
                  or in connection with any one Competition under these Rules is limited in all
                  cases to the lower of (a) the stated insured value of the prize for that
                  Competition, or (b) the total entry fees actually received by Raffila for that
                  Competition.
                </li>
                <li>
                  <span className="font-bold text-ink">Force majeure.</span> Raffila is not liable
                  for any failure, delay, disruption or contamination resulting from acts of God,
                  war, terrorism, riot, civil disorder, pandemic, epidemic, government ban or order,
                  strike, labour disruption, utility failure, internet backbone failure,
                  cloud-provider outage, Processor outage, hacking, malware, failure of any
                  third-party systems, or any other cause beyond Raffila's reasonable control. In
                  such an event Raffila may at its discretion cancel a Competition and issue a full
                  refund per Rule 10.1, or postpone the Draw to a date within 14 days of resolution
                  of the force majeure event.
                </li>
              </ol>
            </div>
          </LegalSection>
          <LegalSection number="12" title="Final Decisions">
            <div className="space-y-4">
              <ol className="list-decimal space-y-3 pl-5 marker:text-coral">
                <li>
                  <span className="font-bold text-ink">Finality of Organizer decisions.</span> All
                  decisions of Raffila (acting through its compliance and competitions team) in
                  relation to the interpretation, application and enforcement of these Rules, the
                  eligibility of any entrant, the validity of any entry, the conduct of the Draw,
                  the identity of the Winner, the handling of a redraw, the validity of a prize
                  claim, the operation of any refund, and any decision taken in the exercise of a
                  discretion under these Rules, are final and binding on every entrant, Winner and
                  claimant, and no correspondence, negotiation or appeal will be entered into except
                  at the Organizer's absolute discretion.
                </li>
                <li>
                  <span className="font-bold text-ink">Headings and construction.</span> Headings
                  are for convenience only and do not affect the construction of these Rules. Words
                  in the singular include the plural and vice versa; references to any gender
                  include all genders; references to any statute or regulation include any
                  modification, consolidation or re-enactment of it for the time being in force.
                </li>
                <li>
                  <span className="font-bold text-ink">Severability.</span> If any provision (or
                  part of any provision) of these Rules is or becomes illegal, invalid, or
                  unenforceable in any respect under the law of any jurisdiction, that provision or
                  part-provision is to that extent severed and deemed not to have formed part of
                  these Rules in that jurisdiction, without affecting the legality, validity or
                  enforceability of the remaining provisions.
                </li>
                <li>
                  <span className="font-bold text-ink">Governing law and jurisdiction.</span> These
                  Rules are governed by and construed in accordance with the laws of the Federal
                  Republic of Nigeria. Subject to the mandatory consumer-protection rights that
                  cannot be excluded, the courts of Lagos State, Nigeria have exclusive jurisdiction
                  over any dispute, claim or matter arising out of or relating to these Rules or any
                  Competition.
                </li>
                <li>
                  <span className="font-bold text-ink">Contact for rule interpretation.</span>{" "}
                  Written requests for the Organizer's interpretation of these Rules or notice of a
                  formal dispute must be sent by email to{" "}
                  <span className="font-bold text-ink">legal@raffila.com</span> stating the sender's
                  full name, registered account email, draw reference, ticket identifiers concerned
                  and the specific Rule(s) in issue. Formal dispute notices are acknowledged in
                  writing within five (5) business days.
                </li>
                <li>
                  <span className="font-bold text-ink">Rules version and effective date.</span>{" "}
                  These Official Competition Rules are version 1.0, effective and last updated on{" "}
                  <span className="font-bold text-ink">2026-09-07</span>. A Competition is governed
                  by the version of the Rules that was in effect on the date a specific paid or free
                  entry into that Competition was submitted, unless a later version is required by a
                  mandatory change in Nigerian law, in which case the later mandatory version
                  applies to the extent so required.
                </li>
              </ol>
              <div className="mt-6 rounded-2xl bg-paper p-5 ring-1 ring-ink/5">
                <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-coral">
                  Quick reference
                </p>
                <p className="mt-3 font-bold text-ink">
                  If you only remember six things, remember these:
                </p>
                <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[13px] font-bold marker:text-coral">
                  <li>18+, Nigeria, verified account only.</li>
                  <li>Max 50 tickets per draw per account (or lower cap on the page).</li>
                  <li>Tickets RF-YYYY-XXXXXXXX, non-transferable, final once issued.</li>
                  <li>Draw closes at SOLD OUT or date, whichever comes first.</li>
                  <li>HMAC_DRBG verified win selection; 48h notification, 14-day claim window.</li>
                  <li>Cancelled comp = full refund; change of mind = no refund.</li>
                </ul>
                <p className="mt-4 text-[12px] font-bold text-ink/55">
                  The <span className="text-coral">full Rules</span> above prevail over this
                  quick-reference summary in all cases.
                </p>
              </div>
            </div>
          </LegalSection>
        </div>
      </div>
    </div>
  );
}

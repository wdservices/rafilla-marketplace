import mercedesImage from "@/assets/raffila-mercedes.jpg";
import techBundleImage from "@/assets/raffila-tech-bundle.jpg";
import apartmentImage from "@/assets/raffila-apartment.jpg";

export type CompetitionStatus = "LIVE" | "CLOSING SOON" | "UPCOMING" | "COMPLETED";

export type Competition = {
  slug: string;
  title: string;
  category: string;
  partner: string;
  description: string;
  prizeValueKobo: number;
  entryPrice: number;
  totalEntries: number;
  entriesSold: number;
  closes: string;
  daysUntilClose: number;
  status: CompetitionStatus;
  featured?: boolean;
  image: string;
  imageAlt: string;
  accent: "coral" | "sky" | "lemon" | "mint" | "lilac";
  specs: string[];
  drawDate: string;
  prizeCondition: string;
  warranty: string;
  make: string;
  model: string;
  year: number | string;
  serialNo: string;
  dimensions: string;
  color: string;
  inclusions: string[];
  exclusions: string[];
  maxTicketsPerUser: number;
  marketValueKobo: number;
  winningTicketId?: string | null;
  winningTicketNumber?: string | null;
  winnerUserId?: string | null;
  winnerDisplayName?: string | null;
  winnerHandle?: string | null;
  winnerTicketNumber?: string | null;
};

export const categories = [
  "All",
  "Vehicles",
  "Homes & Property",
  "Electronics",
  "Furniture & Appliances",
  "Education",
  "Cash & Business",
  "Travel & Experiences",
  "Fashion & Luxury",
  "Lifestyle",
  "Collectibles",
  "Food",
];

/** Legacy category names mapped to final taxonomy (for Firestore migration). */
export const LEGACY_CATEGORY_MAP: Record<string, string> = {
  Homes: "Homes & Property",
  Fashion: "Fashion & Luxury",
  Jewelry: "Fashion & Luxury",
  "Business grants": "Cash & Business",
  Auto: "Vehicles",
  Tech: "Electronics",
  Property: "Homes & Property",
  Home: "Home & Living",
  Experience: "Travel & Experiences",
};

/**
 * Normalise any stored category (old admin free-text or current taxonomy) to
 * the public-facing taxonomy. Shared by the competition feed and the admin
 * form so a competition's stored category always matches the public filter.
 */
export function normalizeCategory(raw: string): string {
  const key = raw.trim().toLowerCase();
  const map: Record<string, string> = {};
  for (const [k, v] of Object.entries(LEGACY_CATEGORY_MAP)) map[k.toLowerCase()] = v;
  map["auto"] = "Vehicles";
  return map[key] ?? raw.trim();
}

/** Budget navigation — separate from category (PDF §3). Amounts in kobo. */
export const BUDGET_FILTERS = [
  { id: "under-500", label: "Under ₦500", maxKobo: 500 * 100 },
  { id: "under-1000", label: "Under ₦1,000", maxKobo: 1000 * 100 },
  { id: "under-2500", label: "Under ₦2,500", maxKobo: 2500 * 100 },
  { id: "under-5000", label: "Under ₦5,000", maxKobo: 5000 * 100 },
  { id: "premium", label: "Premium", minKobo: 5000 * 100 },
] as const;

export type BudgetFilterId = (typeof BUDGET_FILTERS)[number]["id"];

export function matchesBudget(entryPriceKobo: number, budget: BudgetFilterId | "all"): boolean {
  if (budget === "all") return true;
  const f = BUDGET_FILTERS.find((b) => b.id === budget);
  if (!f) return true;
  if (f.id === "premium") return entryPriceKobo > 5000 * 100;
  return entryPriceKobo <= (f as { maxKobo: number }).maxKobo;
}

/** Homepage human collections — Browse by Need (PDF §10). */
export const BROWSE_BY_NEED = [
  {
    id: "under-1000",
    title: "Popular Under ₦1,000",
    text: "Affordable entries anyone can try",
    filter: { budget: "under-1000" as BudgetFilterId },
  },
  {
    id: "education",
    title: "Education Opportunities",
    text: "School fees, certifications, study support",
    filter: { category: "Education" },
  },
  {
    id: "home",
    title: "Upgrade My Home",
    text: "Furniture, appliances, power solutions",
    filter: { category: "Furniture & Appliances" },
  },
  {
    id: "business",
    title: "Start or Grow a Business",
    text: "Equipment & support, subject to review",
    filter: { category: "Cash & Business" },
  },
  {
    id: "cars",
    title: "Cars & Mobility",
    text: "Cars, motorcycles and mobility",
    filter: { category: "Vehicles" },
  },
  {
    id: "tech",
    title: "Phones & Technology",
    text: "Phones, laptops and electronics",
    filter: { category: "Electronics" },
  },
  {
    id: "travel",
    title: "Travel & Experiences",
    text: "Trips and experiences",
    filter: { category: "Travel & Experiences" },
  },
  {
    id: "premium",
    title: "Premium Lifestyle",
    text: "Higher-value aspirational prizes",
    filter: { budget: "premium" as BudgetFilterId },
  },
];

/** Trust strip items (PDF §2 hero trust). */
export const TRUST_SIGNALS = [
  { id: "verified", label: "Verified prizes" },
  { id: "secure", label: "Secure payments" },
  { id: "transparent", label: "Transparent entries" },
  { id: "verifiable", label: "Verifiable draws" },
];

/** Payment methods shown before commit (PDF §7). Direct methods gated by provider review. */
export const PAYMENT_METHODS = [
  { id: "wallet", label: "Raffila Wallet", note: "Spend-only. Not withdrawable.", available: true },
  { id: "card", label: "Card", note: "Subject to payment provider review", available: false },
  {
    id: "bank",
    label: "Bank transfer",
    note: "Subject to payment provider review",
    available: false,
  },
  { id: "ussd", label: "USSD", note: "Subject to payment provider review", available: false },
  { id: "referral", label: "Referral earnings", note: "May be used for entries", available: true },
];

/** Analytics events to instrument (PDF §15). */
export const ANALYTICS_EVENTS = [
  "registration_start",
  "registration_complete",
  "otp_fail",
  "category_click",
  "budget_filter_use",
  "popular_under_1000_view",
  "popular_under_1000_click",
  "competition_card_click",
  "entry_qty_change",
  "add_to_cart",
  "checkout_start",
  "payment_success",
  "payment_fail",
  "support_open",
  "my_entries_view",
  "invite_view",
] as const;

export function trackEvent(
  name: (typeof ANALYTICS_EVENTS)[number],
  details?: Record<string, unknown>,
) {
  try {
    if (typeof window !== "undefined") {
      (window as any).__raffilaAnalytics = (window as any).__raffilaAnalytics || [];
      (window as any).__raffilaAnalytics.push({ name, details, at: new Date().toISOString() });
      import("./activity-log")
        .then(({ logActivity }) =>
          logActivity({
            eventType: "CONFIG_CHANGE",
            targetType: "analytics",
            targetId: name,
            summary: `Analytics: ${name}`,
            details: details ?? {},
          }),
        )
        .catch(() => {});
    }
  } catch {
    // never break UX for analytics
  }
}

/** Entries remaining helper (PDF §4 card facts). */
export const getEntriesRemaining = (c: Competition) => Math.max(0, c.totalEntries - c.entriesSold);

/** Chronology guard: draw must be after close (PDF §5 P0). */
export function isDrawChronologyValid(closesRaw: string, drawRaw: string): boolean {
  const c = new Date(closesRaw).getTime();
  const d = new Date(drawRaw).getTime();
  if (Number.isNaN(c) || Number.isNaN(d)) return true; // unparseable display strings pass through
  return d > c;
}

export const partners = [
  "Lekki Luxury Autos",
  "Nova Electronics",
  "Abeokuta Homes",
  "Lagos Jewels Co.",
  "Abuja Fashion Hub",
];

export const prizeTiers = ["Bronze", "Silver", "Gold", "Platinum", "Diamond"];

const mk = (n: number) => n * 100;

/**
 * There is no hardcoded competition catalogue any more: competitions live only
 * in Firestore and are read through getLiveCompetitions(). Nothing in this
 * module may reintroduce fixture competitions, or deleted documents would
 * reappear in the UI after a refresh.
 */
export const REWARD_POOL = {
  totalKobo: mk(0),
  label: "Current reward pool",
  seasonLabel: "Community reward pool",
  tagline: "Live · Funded by entries",
  totalParticipants: 0,
  rank: 0,
};

export const formatNaira = (amountKobo: number) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(Math.round(amountKobo / 100));

export const getProgress = (competition: Competition) =>
  Math.min(100, Math.round((competition.entriesSold / competition.totalEntries) * 100));

export type SortKey =
  "ending-soon" | "newest" | "price-asc" | "price-desc" | "most-entries" | "featured-first";

export function applySort(list: Competition[], sort: SortKey): Competition[] {
  const copy = [...list];
  switch (sort) {
    case "ending-soon":
      return copy.sort((a, b) => a.daysUntilClose - b.daysUntilClose);
    case "newest":
      return copy.reverse();
    case "price-asc":
      return copy.sort((a, b) => a.entryPrice - b.entryPrice);
    case "price-desc":
      return copy.sort((a, b) => b.entryPrice - a.entryPrice);
    case "most-entries":
      return copy.sort((a, b) => b.entriesSold - a.entriesSold);
    case "featured-first":
      return copy.sort((a, b) => Number(!!b.featured) - Number(!!a.featured));
    default:
      return copy;
  }
}

export const faqs = [
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
  {
    q: "Is my account secure?",
    a: "Raffila uses standard authentication and account security practices, with email and phone verification during onboarding.",
  },
  {
    q: "What happens if a competition is cancelled?",
    a: "If a competition does not proceed, entry amounts are refunded back to the Raffila Wallet in line with the competition rules.",
  },
];

export type WinnerCard = {
  id: string;
  competitionSlug?: string;
  winnerName: string;
  prize: string;
  competition: string;
  drawDate: string;
  location: string;
  amount: string;
  verified: boolean;
  image: string;
  imageAlt: string;
};

export const competitionFaqs = [
  {
    q: "How many tickets can I buy for one competition?",
    a: "Each competition has a per-user maximum ticket limit displayed in the Ticket Info tab. This keeps the draws fair and prevents single parties from dominating.",
  },
  {
    q: "When exactly does the draw happen and can I watch it live?",
    a: "Draws take place on the date and time published for the competition. We provide a live stream link for all draws and publish the verification record on the Draw Verification page.",
  },
  {
    q: "What happens if I win? How will I be contacted?",
    a: "Winners are contacted via the email and phone on their account within 48 hours of the verified draw. We publish first name + last initial publicly until the full winner consent is received.",
  },
  {
    q: "How long do I have to claim my prize?",
    a: "The claim window is 14 calendar days from the draw date. If a winner does not respond or complete verification, we perform a redraw per the Competition Rules.",
  },
  {
    q: "Can I buy tickets for someone else as a gift?",
    a: "Tickets are tied to the Raffila account that purchased them. To gift, the recipient must have their own verified Raffila account and you can transfer wallet funds to them to enter.",
  },
  {
    q: "Are there any hidden fees on top of the ticket price?",
    a: "No. The displayed ticket price is inclusive of all platform fees. Winners are not required to pay anything to receive a prize (tax registration, where applicable, is separate).",
  },
  {
    q: "How do you make sure the draw is fair and not rigged?",
    a: "All eligible entries are frozen at close. A cryptographically secure process (HMAC_DRBG) with a published seed produces the result, and the full record is posted to our public Draw Verification page.",
  },
  {
    q: "If the competition doesn't sell enough tickets, will it still take place?",
    a: "Raffila runs every published draw regardless of tickets sold. If for any rare reason a draw is cancelled, ticket prices are refunded in full to the Raffila wallet.",
  },
];

export const winnerCards: WinnerCard[] = [
  {
    id: "winner-1",
    winnerName: "Adebayo O.",
    prize: "Mercedes-Benz C-Class 2025",
    competition: "Executive Sedan Draw",
    drawDate: "28 Feb 2026",
    location: "Lagos, Nigeria",
    amount: "₦12,000,000",
    verified: true,
    image: mercedesImage,
    imageAlt: "Silver Mercedes-Benz C-Class sedan",
  },
  {
    id: "winner-2",
    winnerName: "Chiamaka N.",
    prize: "Nova X1 Bundle",
    competition: "Tech Bundle Launch",
    drawDate: "14 Feb 2026",
    location: "Abuja, Nigeria",
    amount: "₦1,950,000",
    verified: true,
    image: techBundleImage,
    imageAlt: "Flagship smartphone and connected tech bundle",
  },
  {
    id: "winner-3",
    winnerName: "Ifeanyi K.",
    prize: "Luxury 2-Bed Apartment",
    competition: "City Living Raffle",
    drawDate: "02 Feb 2026",
    location: "Port Harcourt, Nigeria",
    amount: "₦38,000,000",
    verified: true,
    image: apartmentImage,
    imageAlt: "Bright contemporary apartment lounge",
  },
];

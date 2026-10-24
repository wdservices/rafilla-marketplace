import { useEffect, useMemo, useState } from "react";
import {
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  collection,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
} from "firebase/firestore";
import { useNavigate } from "@tanstack/react-router";
import {
  Search,
  Plus,
  MoreHorizontal,
  LayoutGrid,
  List,
  Trophy,
  Eye as EyeIcon,
  CheckCircle2,
  Sparkles,
  X,
  Upload,
  CalendarDays,
  Ticket,
  Gift,
  AlertCircle,
  ChevronRight,
  Check,
  Building2,
  Clock,
  Pencil,
  PlayCircle,
  RotateCcw,
  Copy,
  Pause,
  Share2,
  Download,
  UserRound,
  Eye,
  Filter,
  TrendingUp,
  Target,
  Dices,
  History,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { AdminDrawControlRoom } from "./admin-draw-control-room";
import { slugifyTitle } from "@/lib/competitions-feed";

import mercedesImage from "@/assets/raffila-mercedes.jpg";
import techBundleImage from "@/assets/raffila-tech-bundle.jpg";
import apartmentImage from "@/assets/raffila-apartment.jpg";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { AdminShell } from "@/components/raffila/admin/admin-shell";
import { AssetUploader } from "@/components/raffila/admin/asset-uploader";
import { cn, formatNaira } from "@/lib/utils";
import { db } from "@/lib/firebase";
import { logActivity } from "@/lib/activity-log";
import { partnerStore } from "@/lib/partner-store";
import {
  checkAndCloseCompetitions,
  deriveDrawState,
  executeDraw,
  fetchDrawPoolStats,
  getDrawRecord,
  listDraws,
  type DrawPoolStats,
  type DrawRecord,
} from "@/lib/draw-system";
import { Handshake } from "lucide-react";

type CompStatus =
  | "DRAFT"
  | "SCHEDULED"
  | "LIVE"
  | "DRAW_READY"
  | "DRAW_IN_PROGRESS"
  | "WINNER_SELECTED"
  | "COMPLETED"
  | "CANCELLED";

interface MockComp {
  /** Firestore document ID — the only correct target for writes/deletes. */
  docId: string;
  id: string;
  name: string;
  slug: string;
  category: string;
  status: CompStatus;
  entriesSold: number;
  totalEntries: number;
  ticketPrice: number;
  image: string;
  partner: string;
  drawDate: string;
  /** Full ISO draw timestamp when the DB has one (used by the edit form). */
  drawDateIso?: string;
  condition: "new" | "likenew" | "refurbished" | "used" | undefined;
  marketValue: number | undefined;
  description: string;
  featured: boolean;
  publicResults: boolean;
  startDate: string;
  liveDelay: number;
  maxPerUser: number;
  entriesPaused: boolean;
  entriesClosed: boolean;
}

const IMAGES = [mercedesImage, techBundleImage, apartmentImage];
const PARTNERS = [
  "Lux Wheels Ltd",
  "TechHome NG",
  "Adebayo Homes",
  "Lekki Luxury Autos",
  "Abuja Tech Hub",
];
/**
 * Admin category choices. These MUST match the public filter taxonomy in
 * raffila-data.ts — the form stores the display name verbatim so a competition
 * saved here is immediately findable under the same category publicly.
 */
const CATEGORIES = [
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

/**
 * Date/time input whose ENTIRE surface opens the native picker. By default a
 * `datetime-local` input only opens the calendar from its tiny trailing icon,
 * so clicking anywhere else just selects a text segment. `showPicker()` makes
 * the whole field a single, obvious target.
 *
 * Typing still works: Escape closes the picker and leaves the segments focused.
 */
export function DateTimeField({
  value,
  onChange,
  label,
  id,
}: {
  value: string;
  onChange: (next: string) => void;
  label: string;
  id: string;
}) {
  return (
    <div className="relative">
      <Input
        id={id}
        type="datetime-local"
        aria-label={label}
        title={`${label} — click anywhere to open the date and time picker`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => {
          const el = e.currentTarget;
          // Not supported on every browser, and throws if the picker is already
          // open — either way the field stays focusable and typeable.
          if (typeof el.showPicker === "function") {
            try {
              el.showPicker();
            } catch {
              /* already showing / unsupported */
            }
          }
        }}
        className="datetime-field h-12 rounded-2xl border-0 bg-white pl-4 text-sm font-bold text-ink ring-1 ring-ink/10 transition-shadow focus-visible:ring-coral"
      />
      {/* App-styled icon; the native indicator remains underneath as a
          transparent fallback strip for browsers without showPicker(). */}
      <CalendarDays
        aria-hidden="true"
        className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-ink/45 transition-colors peer-focus:text-coral"
      />
    </div>
  );
}

const statusTone: Record<CompStatus, string> = {
  DRAFT: "bg-ink/10 text-ink",
  SCHEDULED: "bg-sky/25 text-ink",
  LIVE: "bg-mint/35 text-ink",
  DRAW_READY: "bg-lemon/50 text-ink",
  DRAW_IN_PROGRESS: "bg-lilac/40 text-ink",
  WINNER_SELECTED: "bg-mint/50 text-ink",
  COMPLETED: "bg-coral/20 text-coral",
  CANCELLED: "bg-ink/15 text-ink/60",
};

const STEP_LABELS = [
  "Basics",
  "Prize",
  "Entry config",
  "Schedule",
  "Visibility",
  "Review & Publish",
] as const;
type Step = (typeof STEP_LABELS)[number];

/**
 * Publishing statuses an operator can pick. Only LIVE / SCHEDULED / UPCOMING /
 * COMPLETED reach the public site — docToCompetition() filters DRAFT and
 * CANCELLED out of public feeds, so a draft is invisible everywhere.
 */
const PUBLISH_STATUSES: Array<{ value: CompStatus; label: string; hint: string }> = [
  { value: "LIVE", label: "Live now", hint: "Public and open for entries immediately." },
  { value: "SCHEDULED", label: "Scheduled", hint: "Public now; entries open at the start date." },
  { value: "DRAFT", label: "Draft", hint: "Saved but completely hidden from the public site." },
  { value: "COMPLETED", label: "Completed", hint: "Public, but entries are closed." },
];

type FormState = {
  id?: string;
  name: string;
  slug: string;
  category: string;
  description: string;
  assetName: string;
  assets: string[];
  marketValue: string;
  condition: string;
  partner: string;
  assignedPartnerId: string;
  partnerAssetId: string;
  partnerRevenueSharePct: number;
  ticketPrice: string;
  totalEntries: string;
  maxPerUser: string;
  startDate: string;
  drawDate: string;
  liveDelay: string;
  featured: boolean;
  publicResults: boolean;
  status: CompStatus;
};

function emptyForm(): FormState {
  return {
    name: "",
    slug: "",
    category: CATEGORIES[0]!,
    description: "",
    assetName: "",
    assets: [],
    marketValue: "12000000",
    condition: "new",
    partner: PARTNERS[0]!.toLowerCase().replace(/[^a-z]/g, ""),
    assignedPartnerId: "partner_abc_motors",
    partnerAssetId: "asset_toyota_lc300",
    partnerRevenueSharePct: 85,
    ticketPrice: "10000",
    totalEntries: "5000",
    maxPerUser: "200",
    startDate: "2026-04-01T09:00",
    drawDate: "2026-06-18T21:00",
    liveDelay: "60",
    featured: true,
    publicResults: true,
    status: "LIVE",
  };
}

function compToForm(c: MockComp): FormState {
  return {
    id: c.id,
    name: c.name,
    slug: c.slug,
    category: c.category.toLowerCase(),
    description: c.description ?? "",
    assetName: c.name,
    assets: [c.image],
    marketValue: String(c.marketValue ? Math.round(c.marketValue / 100) : 12000000),
    condition: c.condition ?? "new",
    partner: c.partner.toLowerCase().replace(/[^a-z]/g, ""),
    assignedPartnerId: "partner_abc_motors",
    partnerAssetId: "",
    partnerRevenueSharePct: 85,
    ticketPrice: String(c.ticketPrice / 100),
    totalEntries: String(c.totalEntries),
    maxPerUser: String(c.maxPerUser ?? 200),
    startDate: c.startDate || "2026-04-01T09:00",
    // DB stores a full ISO timestamp; don't append T21:00 to one that has it.
    drawDate: c.drawDateIso
      ? c.drawDateIso.replace(" ", "T").slice(0, 16)
      : c.drawDate
        ? `${c.drawDate}T21:00`
        : "2026-06-18T21:00",
    liveDelay: String(c.liveDelay ?? 60),
    featured: !!c.featured,
    publicResults: !!c.publicResults,
    status: c.status,
  };
}

type EntriesFilter = "all" | "paid" | "won" | "pending";

export function AdminCompetitionsPage() {
  const [tab, setTab] = useState<
    "live" | "scheduled" | "draft" | "draw-ready" | "completed" | "all"
  >("live");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [search, setSearch] = useState("");

  const [modalMode, setModalMode] = useState<"new" | "edit" | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [stepIdx, setStepIdx] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [entriesFor, setEntriesFor] = useState<string | null>(null);
  const [entriesFilter, setEntriesFilter] = useState<EntriesFilter>("all");
  const [entriesSearch, setEntriesSearch] = useState("");
  const [entriesPage, setEntriesPage] = useState(1);
  const PAGE_SIZE = 10;

  // ---- Live draw lifecycle state (Firestore-backed, merged over catalogue) ----
  // Keyed by real Firestore document ID. The list is rendered straight from
  // this map, so what you see is exactly what the database contains.
  const [dbCompData, setDbCompData] = useState<Record<string, Record<string, unknown>>>({});
  // Locally hides a row until the refetch confirms the delete landed.
  const [deletedSlugs, setDeletedSlugs] = useState<Set<string>>(new Set());
  const [drawRecords, setDrawRecords] = useState<Record<string, DrawRecord>>({});
  const [drawHistory, setDrawHistory] = useState<DrawRecord[]>([]);
  const [drawRefreshKey, setDrawRefreshKey] = useState(0);

  // Draw flow UI state
  const [drawTarget, setDrawTarget] = useState<MockComp | null>(null);
  const [drawStats, setDrawStats] = useState<DrawPoolStats | null>(null);
  const [drawStatsLoading, setDrawStatsLoading] = useState(false);
  const [drawPhase, setDrawPhase] = useState<"confirm" | "drawing" | "result" | null>(null);
  const [drawResult, setDrawResult] = useState<DrawRecord | null>(null);
  const [drawError, setDrawError] = useState<string | null>(null);
  const [resultFor, setResultFor] = useState<DrawRecord | null>(null);
  const [controlRoomComp, setControlRoomComp] = useState<MockComp | null>(null);

  // Delete competition state
  const [deleteTarget, setDeleteTarget] = useState<MockComp | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Cancel competition state
  const [cancelTarget, setCancelTarget] = useState<MockComp | null>(null);
  const [cancelling, setCancelling] = useState(false);

  // Analytics state (real Firestore-backed stats per competition)
  const [analyticsFor, setAnalyticsFor] = useState<MockComp | null>(null);
  const [analyticsData, setAnalyticsData] = useState<{
    entriesSold: number;
    totalEntries: number;
    revenueKobo: number;
    eligibleTickets: number;
    participants: number;
    progressPct: number;
  } | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const navigate = useNavigate();

  const refreshDrawState = async () => {
    try {
      // Auto-close past-close competitions (LIVE -> DRAW_READY) on every load.
      await checkAndCloseCompetitions().catch(() => {});
      const compSnap = await getDocs(query(collection(db, "competitions"), limit(100)));
      const compData: Record<string, Record<string, unknown>> = {};
      compSnap.docs.forEach((d) => {
        compData[d.id] = d.data() as Record<string, unknown>;
      });
      setDbCompData(compData);
      const draws = await listDraws(100).catch(() => [] as DrawRecord[]);
      const byComp: Record<string, DrawRecord> = {};
      draws.forEach((r) => {
        byComp[r.competitionId] = r;
      });
      setDrawRecords(byComp);
      setDrawHistory(draws);
    } catch (err) {
      console.warn("Draw state refresh failed:", err);
    }
  };

  useEffect(() => {
    void refreshDrawState();
    const t = setInterval(() => void refreshDrawState(), 60000);
    return () => clearInterval(t);
  }, [drawRefreshKey]);

  /** Rows are built purely from Firestore documents. There is no static
   * catalogue to merge in, so a competition exists if and only if its
   * document exists — deleting a document really does remove the row, and a
   * page reload cannot resurrect it. */
  const mergedComps: MockComp[] = useMemo(() => {
    const out: MockComp[] = [];
    Object.entries(dbCompData).forEach(([docId, data], i) => {
      if (deletedSlugs.has(docId)) return;
      const slug = String(data["slug"] ?? docId);
      const draw = drawRecords[slug] ?? drawRecords[docId] ?? null;
      const state = deriveDrawState(data, draw as any);
      const raw = String(data["status"] ?? "DRAFT").toUpperCase();
      const mapped: MockComp["status"] = (
        state === "DRAW_READY" ||
        state === "DRAW_IN_PROGRESS" ||
        state === "WINNER_SELECTED" ||
        state === "COMPLETED"
          ? state
          : ["LIVE", "SCHEDULED", "DRAFT", "COMPLETED", "CANCELLED"].includes(raw)
            ? raw
            : "DRAFT"
      ) as MockComp["status"];
      const images = Array.isArray(data["images"]) ? (data["images"] as string[]) : [];
      out.push({
        // Firestore's real document ID: every mutation (delete/cancel/draw)
        // must target this, not the slug field.
        docId,
        id: `RF-C-${docId.slice(0, 8).toUpperCase()}`,
        name: String(data["title"] ?? data["assetName"] ?? docId),
        slug,
        category: String(data["category"] ?? "General"),
        status: mapped,
        entriesSold: Number(data["entriesSold"] ?? 0),
        totalEntries: Number(data["totalEntries"] ?? 0),
        ticketPrice: Number(data["entryPrice"] ?? 0),
        image: String(data["image"] ?? images[0] ?? IMAGES[i % IMAGES.length]!),
        partner: String(data["partner"] ?? "Raffila"),
        drawDate: String(data["drawDate"] ?? ""),
        condition: (["new", "likenew", "refurbished", "used"] as const).find(
          (c) => c === data["condition"],
        ),
        marketValue: Number(data["marketValueKobo"] ?? data["prizeValueKobo"] ?? 0) || undefined,
        description: String(data["description"] ?? ""),
        featured: data["featured"] === true,
        publicResults: data["publicResults"] === true,
        startDate: String(data["startDate"] ?? ""),
        drawDateIso: String(data["drawDate"] ?? ""),
        liveDelay: Number(data["liveDelay"] ?? 60),
        maxPerUser: Number(data["maxPerUser"] ?? 200),
        entriesPaused: data["entriesPaused"] === true,
        entriesClosed: data["entriesClosed"] === true,
      });
    });
    return out;
  }, [dbCompData, drawRecords, deletedSlugs]);

  const drawReadyCount = useMemo(
    () => mergedComps.filter((c) => c.status === "DRAW_READY").length,
    [mergedComps],
  );

  const statusMap = useMemo(
    () =>
      ({
        live: "LIVE",
        scheduled: "SCHEDULED",
        draft: "DRAFT",
        "draw-ready": "DRAW_READY",
        completed: "COMPLETED",
        all: "all",
      }) as Record<string, CompStatus | "all">,
    [],
  );

  const filtered = useMemo(() => {
    const list =
      tab === "completed"
        ? mergedComps.filter((c) => c.status === "COMPLETED" || c.status === "WINNER_SELECTED")
        : mergedComps;
    return list.filter((c) => {
      const s = search.toLowerCase();
      if (
        s &&
        !c.name.toLowerCase().includes(s) &&
        !c.slug.includes(s) &&
        !c.partner.toLowerCase().includes(s)
      )
        return false;
      const st = statusMap[tab];
      if (st === "all") return true;
      return c.status === st;
    });
  }, [tab, search, mergedComps, statusMap]);

  const [liveTicketRows, setLiveTicketRows] = useState<any[]>([]);
  const [liveTicketsLoading, setLiveTicketsLoading] = useState(false);

  useEffect(() => {
    if (!entriesFor) {
      setLiveTicketRows([]);
      return;
    }
    const comp = mergedComps.find((c) => c.id === entriesFor);
    if (!comp) return;
    let cancelled = false;
    (async () => {
      setLiveTicketsLoading(true);
      try {
        // Real ticket records, grouped by purchase (entryId) for the table.
        const snap = await getDocs(
          query(
            collection(db, "competitions", comp.docId, "tickets"),
            orderBy("purchasedAt", "desc"),
            limit(500),
          ),
        ).catch(() => null);
        if (cancelled) return;
        if (!snap || snap.empty) {
          setLiveTicketRows([]);
          return;
        }
        const byEntry = new Map<string, any[]>();
        snap.docs.forEach((d) => {
          const t = d.data() as Record<string, unknown>;
          const key = String(t["entryId"] || d.id);
          if (!byEntry.has(key)) byEntry.set(key, []);
          byEntry.get(key)!.push({ id: d.id, ...t });
        });
        setLiveTicketRows(
          Array.from(byEntry.entries()).map(([entryId, tickets]) => {
            const first = tickets[0] as Record<string, unknown>;
            const name = String(first["userName"] || "Raffila Member");
            const status = tickets.some((t: any) => String(t.status).toUpperCase() === "WINNER")
              ? "Won"
              : tickets.some(
                    (t: any) =>
                      !["ACTIVE", "CONFIRMED", "PAID"].includes(String(t.status).toUpperCase()),
                  )
                ? "Pending"
                : "Paid";
            return {
              id: entryId,
              name,
              handle: String(first["userHandle"] || ""),
              monogram: name
                .split(" ")
                .map((w: string) => w[0])
                .join("")
                .slice(0, 2)
                .toUpperCase(),
              tickets: tickets.length,
              ticketNumbers: tickets.map((t: any) => String(t.ticketNumber)),
              amount: tickets.length * comp.ticketPrice,
              entered: String(first["purchasedAt"] || "")
                .slice(0, 16)
                .replace("T", " "),
              status,
            };
          }),
        );
      } catch (err) {
        console.warn("Live tickets load failed:", err);
        if (!cancelled) setLiveTicketRows([]);
      } finally {
        if (!cancelled) setLiveTicketsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [entriesFor, mergedComps]);

  const entriesSource = useMemo(() => {
    const comp = mergedComps.find((c) => c.id === entriesFor);
    if (!comp) return { comp: null, rows: [] as any[] };
    // Prefer live Firestore ticket records; fall back to an empty set
    // (never mock rows) when the pool has no persisted tickets yet.
    return { comp, rows: liveTicketRows };
  }, [entriesFor, mergedComps, liveTicketRows]);

  const visibleEntries = useMemo(() => {
    let rows = entriesSource.rows;
    if (entriesFilter !== "all") {
      const map: Record<EntriesFilter, string> = {
        all: "",
        paid: "Paid",
        won: "Won",
        pending: "Pending",
      };
      rows = rows.filter((r) => r.status === map[entriesFilter]);
    }
    if (entriesSearch) {
      const s = entriesSearch.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.name.toLowerCase().includes(s) ||
          r.handle.toLowerCase().includes(s) ||
          r.id.toLowerCase().includes(s),
      );
    }
    return rows.slice(0, entriesPage * PAGE_SIZE);
  }, [entriesSource.rows, entriesFilter, entriesSearch, entriesPage]);

  function openNew() {
    setForm(emptyForm());
    setStepIdx(0);
    setSubmitted(false);
    setEditId(null);
    setModalMode("new");
  }
  function openEdit(comp: MockComp) {
    setForm(compToForm(comp));
    setStepIdx(0);
    setSubmitted(false);
    setEditId(comp.docId);
    setModalMode("edit");
  }
  function closeModal() {
    setModalMode(null);
    setTimeout(() => {
      setStepIdx(0);
      setSubmitted(false);
      setEditId(null);
      setForm(emptyForm());
    }, 220);
  }

  async function submitDraft(statusOverride?: CompStatus) {
    setSubmitting(true);
    try {
      const { validateCompetitionDates } = await import("@/lib/competitions-feed");
      const dateError = validateCompetitionDates({
        closes: (form as any).closes ?? (form as any).endDate ?? (form as any).closeDate,
        drawDate: form.drawDate,
      });
      // Note: admin form historically stores close in startDate/drawDate fields;
      // enforce only when both parse, never block drafts on unparseable strings.
      if (dateError) {
        const { toast } = await import("sonner");
        toast.error(dateError);
        setSubmitting(false);
        return;
      }
      const status = statusOverride ?? form.status;
      const baseSlug = slugifyTitle(form.name) || `comp-${Date.now().toString(36)}`;
      // Create: slug is the Firestore doc ID — never overwrite an existing
      // competition, so suffix until we find a free one. Edit: keep the
      // stored slug untouched (the doc ID is editId).
      let compId = form.slug || baseSlug;
      if (modalMode !== "edit") {
        for (let i = 2; i <= 50; i++) {
          const existing = await getDoc(doc(db, "competitions", compId));
          if (!existing.exists()) break;
          compId = i === 2 ? `${baseSlug}-2` : `${baseSlug}-${i}`;
        }
      }
      const imageData = form.assets.length > 0 ? form.assets[0] : "";

      const payload = {
        slug: compId,
        title: form.name,
        category: form.category,
        partner: form.partner,
        description: form.description,
        // Single canonical name is the competition title; assetName is kept
        // in sync for legacy read fallbacks only (no admin UI for it).
        assetName: form.name || form.assetName,
        image: imageData,
        images: form.assets,
        marketValueKobo: Math.round(Number(form.marketValue) * 100),
        condition: form.condition,
        entryPrice: Math.round(Number(form.ticketPrice) * 100),
        totalEntries: Number(form.totalEntries),
        maxPerUser: Number(form.maxPerUser),
        startDate: form.startDate,
        drawDate: form.drawDate,
        liveDelay: Number(form.liveDelay),
        featured: form.featured,
        publicResults: form.publicResults,
        status,
        partnerId: form.assignedPartnerId,
        partnerAssetId: form.partnerAssetId,
        partnerRevenueSharePct: form.partnerRevenueSharePct,
        updatedAt: serverTimestamp(),
      };
      if (modalMode === "edit") {
        // Edit must never reset sales counters or creation metadata.
        // setDoc+merge (not updateDoc) preserves existing fields.
        // Writes target the real document ID (editId) — writing to the slug
        // would create a second phantom document whenever they differ.
        await setDoc(doc(db, "competitions", editId || compId), payload, { merge: true });
      } else {
        await setDoc(doc(db, "competitions", compId), {
          ...payload,
          entriesSold: 0,
          entriesClosed: false,
          entriesPaused: false,
          createdAt: serverTimestamp(),
        });
      }

      // Register competition in Partner Store for live partner revenue tracking
      try {
        partnerStore.createCompetition({
          partnerId: form.assignedPartnerId,
          competitionId: compId,
          title: form.name || form.assetName || "Prize Competition",
          entryPriceKobo: Math.round(Number(form.ticketPrice) * 100),
          totalEntries: Number(form.totalEntries),
          partnerPercentage: form.partnerRevenueSharePct,
          rafillaPercentage: 100 - form.partnerRevenueSharePct,
        });
      } catch (e) {
        console.warn("Could not register in partnerStore:", e);
      }

      setSubmitting(false);
      setForm((f) => ({ ...f, status }));
      setSubmitted(true);
      setDrawRefreshKey((k) => k + 1);
      toast.success(`${modalMode === "edit" ? "Competition updated" : "Competition created"}`, {
        description: `${form.name || "Untitled competition"} · saved as ${status} · ${compId}`,
      });
    } catch (err) {
      setSubmitting(false);
      toast.error("Failed to save competition", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  /** Create a real DRAFT copy of a competition in Firestore. */
  async function duplicateCompetition(comp: MockComp) {
    const base = `${comp.slug}-copy`;
    let slug = base;
    try {
      const existing = await getDoc(doc(db, "competitions", slug));
      if (existing.exists()) slug = `${base}-${Date.now().toString(36)}`;
      const src = await getDoc(doc(db, "competitions", comp.docId));
      const srcData = src.exists() ? (src.data() as Record<string, unknown>) : {};
      const nowIso = new Date().toISOString();
      await setDoc(doc(db, "competitions", slug), {
        ...srcData,
        slug,
        title: `${String(srcData["title"] ?? comp.name)} (Copy)`,
        status: "DRAFT",
        entriesSold: 0,
        entriesClosed: false,
        entriesPaused: false,
        winnerTicketNumber: null,
        winnerUserId: null,
        winnerName: null,
        drawCompletedAt: null,
        closedAt: null,
        duplicatedFrom: comp.slug,
        createdAt: serverTimestamp(),
        updatedAt: nowIso,
      });
      await logActivity({
        eventType: "COMPETITION_CREATE",
        targetType: "competition",
        targetId: slug,
        summary: `Duplicated "${comp.name}" to draft (${slug})`,
        details: { sourceSlug: comp.slug, newSlug: slug },
      });
      setDrawRefreshKey((k) => k + 1);
      toast.success("Competition duplicated", {
        description: `Copy of ${comp.name} created in DRAFT.`,
      });
    } catch (err) {
      toast.error("Duplicate failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  /** Reopen a closed (winnerless) competition so it accepts tickets again.
   * Used for draw simulations: reopen → seed/buy tickets → set close time → draw. */
  async function reopenCompetition(comp: MockComp) {
    try {
      await updateDoc(doc(db, "competitions", comp.docId), {
        status: "LIVE",
        entriesClosed: false,
        entriesPaused: false,
        closedAt: null,
        updatedAt: serverTimestamp(),
      });
      await logActivity({
        eventType: "COMPETITION_UPDATE",
        targetType: "competition",
        targetId: comp.slug,
        summary: `Reopened entries for "${comp.name}" (DRAW SIMULATION)`,
        details: { slug: comp.slug },
      });
      setDrawRefreshKey((k) => k + 1);
      toast.success("Entries reopened", {
        description: `${comp.name} is LIVE and accepting tickets again.`,
      });
    } catch (err) {
      toast.error("Reopen failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  /** Pause or resume ticket sales without touching the draw lifecycle. */
  async function togglePauseCompetition(comp: MockComp) {
    const pausing = !comp.entriesPaused;
    try {
      await updateDoc(doc(db, "competitions", comp.docId), {
        entriesPaused: pausing,
        updatedAt: serverTimestamp(),
      });
      await logActivity({
        eventType: "COMPETITION_UPDATE",
        targetType: "competition",
        targetId: comp.slug,
        summary: pausing
          ? `Paused entries for "${comp.name}"`
          : `Resumed entries for "${comp.name}"`,
        details: { slug: comp.slug, entriesPaused: pausing },
      });
      setDrawRefreshKey((k) => k + 1);
      toast.success(pausing ? "Entries paused" : "Entries resumed", {
        description: pausing
          ? `${comp.name} is no longer accepting tickets.`
          : `${comp.name} is accepting tickets again.`,
      });
    } catch (err) {
      toast.error(pausing ? "Pause failed" : "Resume failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  /** Load real performance stats and open the analytics dialog. */
  async function openAnalytics(comp: MockComp) {
    setAnalyticsFor(comp);
    setAnalyticsData(null);
    setAnalyticsLoading(true);
    try {
      const stats = await fetchDrawPoolStats(comp.slug).catch(() => ({
        eligibleTickets: comp.entriesSold,
        participants: 0,
      }));
      const progressPct =
        comp.totalEntries > 0
          ? Math.min(100, Math.round((comp.entriesSold / comp.totalEntries) * 100))
          : 0;
      setAnalyticsData({
        entriesSold: comp.entriesSold,
        totalEntries: comp.totalEntries,
        revenueKobo: comp.entriesSold * comp.ticketPrice,
        eligibleTickets: stats.eligibleTickets,
        participants: stats.participants,
        progressPct,
      });
    } finally {
      setAnalyticsLoading(false);
    }
  }

  /** Cancel a competition after confirmation (blocked once a winner exists). */
  async function confirmCancel() {
    if (!cancelTarget || cancelling) return;
    const target = cancelTarget;
    setCancelling(true);
    try {
      await updateDoc(doc(db, "competitions", target.docId), {
        status: "CANCELLED",
        entriesClosed: true,
        updatedAt: serverTimestamp(),
      });
      await logActivity({
        eventType: "COMPETITION_CANCEL",
        targetType: "competition",
        targetId: target.slug,
        summary: `Cancelled competition "${target.name}" (no auto-refunds)`,
        details: { slug: target.slug },
      });
      setCancelTarget(null);
      setDrawRefreshKey((k) => k + 1);
      toast.warning("Competition cancelled", {
        description: `${target.name} moved to CANCELLED · no refunds auto-issued.`,
      });
    } catch (err) {
      toast.error("Cancel failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setCancelling(false);
    }
  }

  /** One-click publish for a draft/scheduled competition. */
  async function publishCompetition(comp: MockComp) {
    try {
      await updateDoc(doc(db, "competitions", comp.docId), {
        status: "LIVE",
        updatedAt: serverTimestamp(),
      });
      await logActivity({
        eventType: "COMPETITION_UPDATE",
        targetType: "competition",
        targetId: comp.slug,
        summary: `Published "${comp.name}"`,
        details: { slug: comp.slug, from: comp.status, to: "LIVE" },
      });
      setDrawRefreshKey((k) => k + 1);
      toast.success("Competition published", {
        description: `${comp.name} is now live and visible on raffila.com.`,
      });
    } catch (err) {
      toast.error("Publish failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  function performAction(comp: MockComp, action: string) {
    switch (action) {
      case "view":
        // Drafts and cancelled competitions are filtered out of every public
        // feed, so navigating would just dead-end on "Competition unavailable".
        if (comp.status === "DRAFT" || comp.status === "CANCELLED") {
          toast.warning("Not published yet", {
            description: `"${comp.name}" is ${comp.status} and hidden from the public site. Use Publish now, or set a status in Edit competition.`,
          });
          return;
        }
        void navigate({
          to: "/competitions/$slug",
          params: { slug: comp.slug },
        });
        break;
      case "publish":
        void publishCompetition(comp);
        break;
      case "edit":
        openEdit(comp);
        break;
      case "duplicate":
        void duplicateCompetition(comp);
        break;
      case "pause":
        void togglePauseCompetition(comp);
        break;
      case "reopen":
        void reopenCompetition(comp);
        break;
      case "cancel":
        setCancelTarget(comp);
        break;
      case "analytics":
        void openAnalytics(comp);
        break;
      case "share":
        if (typeof navigator !== "undefined" && navigator.clipboard) {
          void navigator.clipboard.writeText(`https://raffila.com/competitions/${comp.slug}`);
        }
        toast.success("Public link copied", {
          description: `raffila.com/competitions/${comp.slug}`,
        });
        break;
      default:
        break;
    }
  }

  // ---------------- Raffle draw flow (ticket-based, server-committed) ----------------
  async function openDrawConfirm(comp: MockComp) {
    setDrawTarget(comp);
    setDrawError(null);
    setDrawResult(null);
    setDrawStats(null);
    setDrawPhase("confirm");
    setDrawStatsLoading(true);
    try {
      const stats = await fetchDrawPoolStats(comp.slug);
      setDrawStats(stats);
    } catch (err) {
      console.warn("Draw pool stats failed:", err);
      setDrawStats({ eligibleTickets: comp.entriesSold, participants: 0 });
    } finally {
      setDrawStatsLoading(false);
    }
  }

  async function confirmDraw() {
    if (!drawTarget) return;
    setDrawPhase("drawing");
    setDrawError(null);
    // Minimum presentation beat so the ceremony reads as a real draw;
    // the winner is committed by executeDraw before the reveal.
    const startedAt = Date.now();
    try {
      const { record, resumed } = await executeDraw(drawTarget.slug);
      const elapsed = Date.now() - startedAt;
      if (elapsed < 3500) await new Promise((r) => setTimeout(r, 3500 - elapsed));
      setDrawResult(record);
      setDrawPhase("result");
      setDrawRefreshKey((k) => k + 1);
      toast.success(resumed ? "Existing draw result loaded" : "Winner selected", {
        description: `Ticket #${record.winningTicketNumber} · ${record.winnerDisplayName}`,
      });
    } catch (err) {
      setDrawError(err instanceof Error ? err.message : "Draw failed. Please try again.");
      setDrawPhase("confirm");
    }
  }

  function closeDrawFlow() {
    setDrawPhase(null);
    setDrawTarget(null);
    setDrawStats(null);
    setDrawResult(null);
    setDrawError(null);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      // Target the real document ID. Using the slug field silently no-ops
      // whenever a doc's ID differs from its slug (and deleteDoc on a missing
      // doc reports success), which is what made deletes look like they worked.
      await deleteDoc(doc(db, "competitions", deleteTarget.docId));
      setDeletedSlugs((prev) => new Set(prev).add(deleteTarget.docId));
      await logActivity({
        eventType: "COMPETITION_DELETE",
        targetType: "competition",
        targetId: deleteTarget.slug,
        summary: `Deleted competition "${deleteTarget.name}"`,
        details: {
          name: deleteTarget.name,
          slug: deleteTarget.slug,
          status: deleteTarget.status,
          partner: deleteTarget.partner,
        },
      });
      toast.success("Competition deleted", {
        description: `${deleteTarget.name} has been permanently removed.`,
      });
      setDeleteTarget(null);
      // Re-read from Firestore so the list reflects DB truth immediately
      // (not just the optimistic local hide, and not on next reload).
      await refreshDrawState();
    } catch (err) {
      toast.error("Failed to delete competition", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setDeleting(false);
    }
  }

  async function openDrawResult(comp: MockComp) {
    try {
      const rec = drawRecords[comp.slug] ?? (await getDrawRecord(comp.slug));
      if (!rec || !rec.winningTicketNumber) {
        toast.error("No draw result yet", {
          description: `${comp.name} has no completed draw record.`,
        });
        return;
      }
      setDrawRecords((m) => ({ ...m, [comp.slug]: rec }));
      setResultFor(rec);
    } catch (err) {
      toast.error("Could not load draw result", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return (
    <AdminShell activeNav="competitions" title="Competitions">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-coral">
            Admin · Competitions
          </p>
          <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">
            Competitions
          </h1>
          <p className="mt-2 max-w-2xl text-base font-bold text-ink/60">
            Create, schedule, draw, and manage prize competitions across the Raffila platform.
          </p>
        </div>
        <Button variant="primary" onClick={openNew}>
          <Plus className="size-4" /> New competition
        </Button>
      </header>

      <Card className="rounded-[28px] border-0 bg-paper p-0 ring-1 ring-ink/5 shadow-none">
        <CardContent className="space-y-4 p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <Tabs
              value={tab}
              onValueChange={(v) => setTab(v as any)}
              className="w-full sm:w-auto overflow-x-auto scrollbar-none"
            >
              <TabsList className="rounded-full bg-cream p-1 w-max sm:w-auto">
                {[
                  { v: "live", l: "Live" },
                  { v: "scheduled", l: "Scheduled" },
                  { v: "draft", l: "Draft" },
                  { v: "draw-ready", l: "Draw Ready", badge: drawReadyCount },
                  { v: "completed", l: "Completed" },
                  { v: "all", l: "All" },
                ].map((t) => (
                  <TabsTrigger
                    key={t.v}
                    value={t.v}
                    className="rounded-full px-4 py-1.5 text-xs font-extrabold data-[state=active]:bg-white data-[state=active]:text-ink data-[state=active]:shadow-sm data-[state=inactive]:text-ink/60"
                  >
                    {t.l}
                    {typeof (t as any).badge === "number" && (t as any).badge > 0 && (
                      <span className="ml-1.5 inline-grid min-size-5 place-items-center rounded-full bg-coral px-1.5 py-0.5 text-[10px] font-extrabold tabular-nums text-white">
                        {(t as any).badge}
                      </span>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
              <div className="relative w-full sm:w-60">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink/40" />
                <Input
                  placeholder="Search competition, partner, id…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-10 w-full rounded-full border-0 bg-white pl-9 pr-4 text-xs font-bold text-ink placeholder:text-ink/40 ring-1 ring-ink/10 focus-visible:ring-coral"
                />
              </div>
              <div className="flex items-center rounded-full bg-cream p-0.5 ring-1 ring-ink/10">
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "size-9 rounded-full",
                    view === "grid" && "bg-white text-ink shadow-sm",
                  )}
                  onClick={() => setView("grid")}
                >
                  <LayoutGrid className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "size-9 rounded-full",
                    view === "list" && "bg-white text-ink shadow-sm",
                  )}
                  onClick={() => setView("list")}
                >
                  <List className="size-4" />
                </Button>
              </div>
            </div>
          </div>

          {view === "grid" ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((c) => {
                const pct = Math.min(100, Math.round((c.entriesSold / c.totalEntries) * 100));
                const rec = drawRecords[c.slug] ?? null;
                const isDrawReady = c.status === "DRAW_READY";
                const isDrawing = c.status === "DRAW_IN_PROGRESS";
                const hasWinner =
                  c.status === "WINNER_SELECTED" ||
                  (c.status === "COMPLETED" && rec?.winningTicketNumber);
                const canPause =
                  c.status === "LIVE" || c.status === "SCHEDULED" || !!c.entriesPaused;
                const canReopen =
                  !hasWinner &&
                  c.status !== "DRAW_IN_PROGRESS" &&
                  c.status !== "CANCELLED" &&
                  (c.status === "DRAW_READY" || !!c.entriesClosed);
                const canCancel =
                  !hasWinner && c.status !== "COMPLETED" && c.status !== "CANCELLED";
                return (
                  <Card
                    key={c.id}
                    className={cn(
                      "group rounded-[26px] border-0 bg-white p-0 ring-1 shadow-[0_2px_14px_-10px_rgba(0,0,0,0.15)] overflow-hidden",
                      isDrawReady ? "ring-2 ring-lemon/70" : "ring-ink/10",
                    )}
                  >
                    <div className="relative aspect-[16/10] overflow-hidden bg-cream">
                      <img
                        src={c.image}
                        alt={`${c.name} prize`}
                        className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="absolute left-3 top-3 flex items-center gap-1.5">
                        <Badge
                          className={cn(
                            "rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider ring-0",
                            statusTone[c.status],
                          )}
                        >
                          {c.status}
                        </Badge>
                        <Badge className="rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-extrabold text-ink ring-0 backdrop-blur">
                          {c.category}
                        </Badge>
                        {c.entriesPaused && (
                          <Badge className="rounded-full bg-ink px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-white ring-0">
                            Paused
                          </Badge>
                        )}
                      </div>
                      <div className="absolute right-3 top-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 rounded-full bg-white/95 backdrop-blur text-ink ring-1 ring-ink/10 hover:bg-white"
                            >
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="w-52 rounded-[22px] bg-white p-1.5 ring-1 ring-ink/10 shadow-[0_20px_60px_-25px_rgba(0,0,0,0.25)]"
                          >
                            <DropdownMenuLabel className="rounded-xl px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-ink/45">
                              {c.id}
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="rounded-xl cursor-pointer px-3 py-2 text-sm font-bold text-ink/80 focus:bg-sky/20 focus:text-ink"
                              onClick={() => performAction(c, "view")}
                            >
                              <EyeIcon className="mr-2 size-4" />
                              View on site
                            </DropdownMenuItem>
                            {(c.status === "DRAFT" || c.status === "SCHEDULED") && (
                              <DropdownMenuItem
                                className="rounded-xl cursor-pointer px-3 py-2 text-sm font-bold text-ink/80 focus:bg-mint/25 focus:text-ink"
                                onClick={() => performAction(c, "publish")}
                              >
                                <Upload className="mr-2 size-4" />
                                Publish now
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              className="rounded-xl cursor-pointer px-3 py-2 text-sm font-bold text-ink/80 focus:bg-coral/15 focus:text-ink"
                              onClick={() => performAction(c, "edit")}
                            >
                              <Pencil className="mr-2 size-4" />
                              Edit competition
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="rounded-xl cursor-pointer px-3 py-2 text-sm font-bold text-ink/80 focus:bg-mint/25 focus:text-ink"
                              onClick={() => setEntriesFor(c.id)}
                            >
                              <Ticket className="mr-2 size-4" />
                              Manage entries
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="rounded-xl cursor-pointer px-3 py-2 text-sm font-bold text-ink/80 focus:bg-lemon/40 focus:text-ink"
                              onClick={() => performAction(c, "duplicate")}
                            >
                              <Copy className="mr-2 size-4" />
                              Duplicate
                            </DropdownMenuItem>
                            {canReopen && (
                              <DropdownMenuItem
                                className="rounded-xl cursor-pointer px-3 py-2 text-sm font-bold text-ink/80 focus:bg-mint/25 focus:text-ink"
                                onClick={() => performAction(c, "reopen")}
                              >
                                <RotateCcw className="mr-2 size-4" />
                                Reopen entries
                              </DropdownMenuItem>
                            )}
                            {canPause && (
                              <DropdownMenuItem
                                className="rounded-xl cursor-pointer px-3 py-2 text-sm font-bold text-ink/80 focus:bg-cream focus:text-ink"
                                onClick={() => performAction(c, "pause")}
                              >
                                {c.entriesPaused ? (
                                  <PlayCircle className="mr-2 size-4" />
                                ) : (
                                  <Pause className="mr-2 size-4" />
                                )}
                                {c.entriesPaused ? "Resume entries" : "Pause entries"}
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              className="rounded-xl cursor-pointer px-3 py-2 text-sm font-bold text-ink/80 focus:bg-lilac/25 focus:text-ink"
                              onClick={() => performAction(c, "analytics")}
                            >
                              <TrendingUp className="mr-2 size-4" />
                              View analytics
                            </DropdownMenuItem>
                            {isDrawReady && (
                              <DropdownMenuItem
                                className="rounded-xl cursor-pointer px-3 py-2 text-sm font-bold text-ink/80 focus:bg-lemon/40 focus:text-ink"
                                onClick={() => void openDrawConfirm(c)}
                              >
                                <Target className="mr-2 size-4" />
                                View draw details
                              </DropdownMenuItem>
                            )}
                            {hasWinner && (
                              <DropdownMenuItem
                                className="rounded-xl cursor-pointer px-3 py-2 text-sm font-bold text-ink/80 focus:bg-mint/25 focus:text-ink"
                                onClick={() => void openDrawResult(c)}
                              >
                                <Trophy className="mr-2 size-4" />
                                View draw result
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              className="rounded-xl cursor-pointer px-3 py-2 text-sm font-bold text-ink/80 focus:bg-coral/15 focus:text-ink"
                              onClick={() => performAction(c, "share")}
                            >
                              <Share2 className="mr-2 size-4" />
                              Copy public link
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {canCancel && (
                              <DropdownMenuItem
                                className="rounded-xl cursor-pointer px-3 py-2 text-sm font-bold text-ink/80 focus:bg-coral/15 focus:text-ink"
                                onClick={() => performAction(c, "cancel")}
                              >
                                <AlertCircle className="mr-2 size-4" />
                                Cancel competition
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              className="rounded-xl cursor-pointer px-3 py-2 text-sm font-bold text-coral focus:bg-coral/15"
                              onClick={() => setDeleteTarget(c)}
                            >
                              <Trash2 className="mr-2 size-4" />
                              Delete competition
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                    <CardContent className="p-5 space-y-3.5">
                      <h3 className="font-display text-[17px] font-extrabold leading-tight text-ink min-h-[2.5rem] line-clamp-2">
                        {c.name}
                      </h3>

                      {isDrawReady ? (
                        <>
                          <div className="rounded-2xl bg-lemon/20 p-3.5 ring-1 ring-lemon/40">
                            <p className="text-[10px] font-extrabold uppercase tracking-wider text-ink/55">
                              Draw closed · {c.drawDate || "entries closed"}
                            </p>
                            <div className="mt-2 grid grid-cols-2 gap-2">
                              <div>
                                <p className="text-[10px] font-extrabold uppercase tracking-wider text-ink/45">
                                  Eligible tickets
                                </p>
                                <p className="font-display text-xl font-extrabold tabular-nums text-ink">
                                  {(rec?.eligibleTicketCount || c.entriesSold).toLocaleString(
                                    "en-NG",
                                  )}
                                </p>
                              </div>
                              <div>
                                <p className="text-[10px] font-extrabold uppercase tracking-wider text-ink/45">
                                  Participants
                                </p>
                                <p className="font-display text-xl font-extrabold tabular-nums text-ink">
                                  {(rec?.eligibleParticipantCount || 0).toLocaleString("en-NG")}
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => void openDrawConfirm(c)}
                            >
                              <Target className="size-3.5" />
                              Start Draw
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setEntriesFor(c.id)}>
                              <Ticket className="size-3.5" />
                              Manage entries
                            </Button>
                          </div>
                        </>
                      ) : isDrawing ? (
                        <>
                          <div className="rounded-2xl bg-lilac/20 p-3.5 ring-1 ring-lilac/30">
                            <p className="flex items-center gap-2 text-xs font-extrabold text-ink">
                              <Dices className="size-4 animate-pulse text-ink" />
                              Drawing… winner being selected
                            </p>
                            <p className="mt-1 text-[11px] font-bold text-ink/55">
                              {(rec?.eligibleTicketCount || c.entriesSold).toLocaleString("en-NG")}{" "}
                              eligible tickets · do not close this page
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => void openDrawResult(c)}
                            >
                              <Eye className="size-3.5" />
                              View draw
                            </Button>
                          </div>
                        </>
                      ) : hasWinner ? (
                        <>
                          <div className="rounded-2xl bg-mint/20 p-3.5 ring-1 ring-mint/40">
                            <p className="text-[10px] font-extrabold uppercase tracking-wider text-ink/55">
                              Winning ticket
                            </p>
                            <p className="font-display text-2xl font-extrabold tabular-nums text-ink">
                              #{rec?.winningTicketNumber ?? "—"}
                            </p>
                            <p className="mt-1 text-xs font-extrabold text-ink/70">
                              Winner · {rec?.winnerDisplayName ?? "—"}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => void openDrawResult(c)}
                            >
                              <Trophy className="size-3.5" />
                              View draw result
                            </Button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center justify-between text-[11px] font-extrabold">
                            <span className="inline-flex items-center gap-1 text-ink/60">
                              <CalendarDays className="size-3" />
                              Draw {c.drawDate}
                            </span>
                            <span className="text-ink whitespace-nowrap">
                              {formatNaira(c.ticketPrice)}
                            </span>
                          </div>
                          <div>
                            <div className="mb-1.5 flex items-center justify-between text-[11px] font-extrabold text-ink/60">
                              <span>Entries</span>
                              <span>
                                {c.entriesSold.toLocaleString("en-NG")} /{" "}
                                {c.totalEntries.toLocaleString("en-NG")} · {pct}%
                              </span>
                            </div>
                            <Progress
                              value={pct}
                              className="h-2 rounded-full bg-cream [&>div]:bg-coral [&>div]:rounded-full"
                            />
                          </div>
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => performAction(c, "edit")}
                            >
                              <Pencil className="size-3.5" />
                              Edit
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setEntriesFor(c.id)}>
                              <Ticket className="size-3.5" />
                              Manage entries
                            </Button>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="overflow-x-auto -mx-2 px-2">
              <Table>
                <TableHeader className="[&_tr]:border-ink/10">
                  <TableRow>
                    <TableHead className="py-3 font-extrabold text-ink/65">Competition</TableHead>
                    <TableHead className="py-3 font-extrabold text-ink/65">Category</TableHead>
                    <TableHead className="py-3 font-extrabold text-ink/65">Partner</TableHead>
                    <TableHead className="py-3 text-right font-extrabold text-ink/65">
                      Entries %
                    </TableHead>
                    <TableHead className="py-3 text-right font-extrabold text-ink/65">
                      Ticket
                    </TableHead>
                    <TableHead className="py-3 font-extrabold text-ink/65">Status</TableHead>
                    <TableHead className="py-3 font-extrabold text-ink/65">Draw date</TableHead>
                    <TableHead className="py-3 text-right font-extrabold text-ink/65">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="[&_tr]:border-ink/10">
                  {filtered.map((c) => {
                    const pct = Math.min(100, Math.round((c.entriesSold / c.totalEntries) * 100));
                    const rec = drawRecords[c.slug] ?? null;
                    const isDrawReady = c.status === "DRAW_READY";
                    const hasWinner =
                      c.status === "WINNER_SELECTED" ||
                      (c.status === "COMPLETED" && rec?.winningTicketNumber);
                    return (
                      <TableRow key={c.id} className="hover:bg-sky/8">
                        <TableCell className="py-3">
                          <div className="flex items-center gap-3">
                            <img
                              src={c.image}
                              alt=""
                              aria-hidden
                              className="size-11 rounded-2xl object-cover ring-2 ring-white"
                            />
                            <div className="min-w-0 max-w-[280px]">
                              <p className="truncate text-sm font-extrabold text-ink">{c.name}</p>
                              <p className="truncate text-[11px] font-bold text-ink/50">
                                {c.id} · {c.partner}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-3 text-xs font-bold text-ink/70">
                          {c.category}
                        </TableCell>
                        <TableCell className="py-3 text-xs font-bold text-ink/70">
                          {c.partner}
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="flex items-center justify-end gap-2">
                            <div className="h-2 w-28 overflow-hidden rounded-full bg-cream">
                              <div className="h-full bg-coral" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="w-10 text-right text-[11px] font-extrabold text-ink/65">
                              {pct}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="py-3 text-right whitespace-nowrap text-xs font-extrabold text-ink">
                          {formatNaira(c.ticketPrice)}
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="flex items-center gap-1.5">
                            <Badge
                              className={cn(
                                "rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ring-0",
                                statusTone[c.status],
                              )}
                            >
                              {c.status}
                            </Badge>
                            {c.entriesPaused && (
                              <Badge className="rounded-full bg-ink px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white ring-0">
                                Paused
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-3 whitespace-nowrap text-xs font-bold text-ink/65">
                          {c.drawDate}
                        </TableCell>
                        <TableCell className="py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 text-ink/70 hover:bg-coral/10 hover:text-coral"
                              onClick={() => performAction(c, "view")}
                            >
                              <EyeIcon className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 text-ink/70 hover:bg-coral/10 hover:text-coral"
                              onClick={() => performAction(c, "edit")}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 text-ink/70 hover:bg-mint/20 hover:text-ink"
                              onClick={() => setEntriesFor(c.id)}
                            >
                              <Ticket className="size-4" />
                            </Button>
                            {isDrawReady && (
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => void openDrawConfirm(c)}
                              >
                                <Target className="size-3.5" />
                                Start Draw
                              </Button>
                            )}
                            {hasWinner && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => void openDrawResult(c)}
                              >
                                <Trophy className="size-3.5" />
                                Result
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 text-ink/70 hover:bg-coral/10 hover:text-coral"
                              onClick={() => setDeleteTarget(c)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ---------------- Draw history (immutable audit records) ---------------- */}
      <Card className="mt-6 rounded-[28px] border-0 bg-paper p-0 ring-1 ring-ink/5 shadow-none">
        <CardContent className="space-y-4 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-2xl bg-ink/10">
                <History className="size-4.5 text-ink" />
              </span>
              <div>
                <h2 className="font-display text-xl font-extrabold text-ink">Draw history</h2>
                <p className="text-xs font-bold text-ink/55">
                  Immutable record of every completed draw · {drawHistory.length} draw
                  {drawHistory.length === 1 ? "" : "s"}
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setDrawRefreshKey((k) => k + 1)}>
              Refresh
            </Button>
          </div>
          {drawHistory.length === 0 ? (
            <p className="rounded-2xl bg-white px-4 py-6 text-center text-xs font-bold text-ink/50 ring-1 ring-ink/10">
              No draws yet. Closed competitions will appear under Draw Ready.
            </p>
          ) : (
            <div className="overflow-x-auto -mx-2 px-2">
              <Table>
                <TableHeader className="[&_tr]:border-ink/10">
                  <TableRow>
                    <TableHead className="py-3 font-extrabold text-ink/65">Draw ID</TableHead>
                    <TableHead className="py-3 font-extrabold text-ink/65">Competition</TableHead>
                    <TableHead className="py-3 text-right font-extrabold text-ink/65">
                      Tickets
                    </TableHead>
                    <TableHead className="py-3 text-right font-extrabold text-ink/65">
                      Winning ticket
                    </TableHead>
                    <TableHead className="py-3 font-extrabold text-ink/65">Winner</TableHead>
                    <TableHead className="py-3 font-extrabold text-ink/65">Status</TableHead>
                    <TableHead className="py-3 text-right font-extrabold text-ink/65">
                      Details
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="[&_tr]:border-ink/10">
                  {drawHistory.slice(0, 20).map((r) => (
                    <TableRow key={r.id} className="hover:bg-sky/8">
                      <TableCell className="py-3 font-mono text-[11px] font-extrabold text-ink">
                        {r.verificationReference || r.id}
                      </TableCell>
                      <TableCell className="py-3 text-xs font-extrabold text-ink">
                        {r.competitionTitle || r.competitionId}
                      </TableCell>
                      <TableCell className="py-3 text-right text-xs font-extrabold tabular-nums text-ink">
                        {r.eligibleTicketCount.toLocaleString("en-NG")}
                      </TableCell>
                      <TableCell className="py-3 text-right font-display text-sm font-extrabold tabular-nums text-ink">
                        {r.winningTicketNumber ? `#${r.winningTicketNumber}` : "—"}
                      </TableCell>
                      <TableCell className="py-3 text-xs font-bold text-ink/70">
                        {r.winnerDisplayName ?? "—"}
                      </TableCell>
                      <TableCell className="py-3">
                        <Badge
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ring-0",
                            r.status === "COMPLETED"
                              ? "bg-mint/40 text-ink"
                              : r.status === "IN_PROGRESS"
                                ? "bg-lilac/40 text-ink"
                                : r.status === "FAILED"
                                  ? "bg-coral/20 text-coral"
                                  : "bg-lemon/50 text-ink",
                          )}
                        >
                          {r.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-3 text-right">
                        <Button variant="ghost" size="sm" onClick={() => setResultFor(r)}>
                          <Eye className="size-3.5" /> View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ---------------- Pre-draw confirmation ---------------- */}
      <Dialog
        open={drawPhase === "confirm" && !!drawTarget}
        onOpenChange={(v) => !v && closeDrawFlow()}
      >
        <DialogContent className="rounded-[28px] bg-white p-6 sm:max-w-md max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 font-display text-2xl font-extrabold text-ink">
              <span className="grid size-10 place-items-center rounded-2xl bg-lemon/40">
                <Target className="size-5 text-ink" />
              </span>
              Start Draw Confirmation
            </DialogTitle>
            <DialogDescription className="text-sm font-bold text-ink/60">
              {drawTarget?.name}
            </DialogDescription>
          </DialogHeader>

          {/* Prize Image */}
          {drawTarget?.image && (
            <div className="relative aspect-[16/9] w-full rounded-2xl overflow-hidden ring-1 ring-ink/10 mt-2">
              <img
                src={drawTarget.image}
                alt={drawTarget.name}
                className="size-full object-cover"
              />
            </div>
          )}

          {/* Scheduled draw date & time */}
          <div className="mt-3 flex items-center justify-between px-3.5 py-2.5 rounded-2xl bg-cream/60 ring-1 ring-ink/10 text-xs font-bold text-ink/70">
            <span className="flex items-center gap-1.5">
              <Clock className="size-3.5 text-coral" />
              Scheduled Draw Time:
            </span>
            <span className="font-extrabold text-ink">{drawTarget?.drawDate || "Today"}</span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-cream/60 p-3.5 ring-1 ring-ink/10">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-ink/45">
                Eligible tickets
              </p>
              <p className="font-display text-2xl font-extrabold tabular-nums text-ink">
                {drawStatsLoading ? "…" : (drawStats?.eligibleTickets ?? 0).toLocaleString("en-NG")}
              </p>
            </div>
            <div className="rounded-2xl bg-cream/60 p-3.5 ring-1 ring-ink/10">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-ink/45">
                Participants
              </p>
              <p className="font-display text-2xl font-extrabold tabular-nums text-ink">
                {drawStatsLoading ? "…" : (drawStats?.participants ?? 0).toLocaleString("en-NG")}
              </p>
            </div>
          </div>

          <div className="mt-3 rounded-2xl bg-sky/15 p-4 text-xs font-bold leading-relaxed text-ink/70 ring-1 ring-sky/20">
            Every eligible ticket number participates individually — a member with 10 tickets has 10
            independent chances. After confirmation, the Admin Draw Control Room opens where you can
            view the Draw Engine diagnostics and live Public Wheel preview.
          </div>

          {drawError && (
            <p className="mt-3 rounded-2xl bg-coral/15 p-3 text-xs font-extrabold text-coral ring-1 ring-coral/30">
              {drawError}
            </p>
          )}

          <DialogFooter className="mt-5 flex gap-2">
            <Button variant="outline" onClick={closeDrawFlow} className="flex-1">
              Cancel
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              disabled={drawStatsLoading}
              onClick={() => {
                if (drawTarget) {
                  setControlRoomComp(drawTarget);
                  closeDrawFlow();
                }
              }}
            >
              <Dices className="size-4" /> Open Control Room
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------------- Admin Draw Control Room ---------------- */}
      {controlRoomComp && (
        <AdminDrawControlRoom
          isOpen={!!controlRoomComp}
          onClose={() => {
            setControlRoomComp(null);
            void refreshDrawState();
          }}
          competition={controlRoomComp}
          onSuccess={() => {
            void refreshDrawState();
          }}
        />
      )}

      {/* ---------------- Draw ceremony (presentation only) ---------------- */}
      <Dialog open={drawPhase === "drawing"}>
        <DialogContent className="rounded-[28px] bg-white p-8 text-center sm:max-w-md [&>button]:hidden">
          <div className="mx-auto grid size-20 place-items-center rounded-full bg-lilac/25">
            <Dices className="size-10 animate-spin text-ink [animation-duration:2.5s]" />
          </div>
          <h3 className="mt-5 font-display text-2xl font-extrabold text-ink">Drawing…</h3>
          <p className="mt-2 text-sm font-bold text-ink/60">
            {drawTarget?.name} · selecting from{" "}
            {(drawStats?.eligibleTickets ?? 0).toLocaleString("en-NG")} eligible tickets. The result
            is being committed securely.
          </p>
        </DialogContent>
      </Dialog>

      {/* ---------------- Winner reveal (from persisted record) ---------------- */}
      <Dialog
        open={drawPhase === "result" && !!drawResult}
        onOpenChange={(v) => !v && closeDrawFlow()}
      >
        <DialogContent className="rounded-[28px] bg-white p-8 text-center sm:max-w-md">
          <div className="mx-auto grid size-20 place-items-center rounded-full bg-mint/30">
            <Trophy className="size-10 text-ink" />
          </div>
          <p className="mt-4 text-xs font-extrabold uppercase tracking-[0.16em] text-coral">
            🎉 Congratulations
          </p>
          <h3 className="mt-1 font-display text-3xl font-extrabold text-ink">
            {drawResult?.winnerDisplayName}
          </h3>
          <div className="mx-auto mt-4 max-w-xs space-y-2 rounded-2xl bg-cream/60 p-4 text-left ring-1 ring-ink/10">
            <div className="flex items-center justify-between text-xs font-bold text-ink/60">
              <span>Winning ticket</span>
              <span className="font-display text-lg font-extrabold tabular-nums text-ink">
                #{drawResult?.winningTicketNumber}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs font-bold text-ink/60">
              <span>Draw ID</span>
              <span className="font-mono font-extrabold text-ink">
                {drawResult?.verificationReference || drawResult?.id}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs font-bold text-ink/60">
              <span>Eligible tickets</span>
              <span className="font-extrabold tabular-nums text-ink">
                {(drawResult?.eligibleTicketCount ?? 0).toLocaleString("en-NG")}
              </span>
            </div>
          </div>
          <div className="mt-5 grid gap-2">
            <Button
              variant="primary"
              onClick={() => {
                if (drawResult) setResultFor(drawResult);
                closeDrawFlow();
              }}
            >
              View draw details
            </Button>
            <Button variant="outline" onClick={closeDrawFlow}>
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ---------------- Draw result details (admin) ---------------- */}
      <Dialog open={!!resultFor} onOpenChange={(v) => !v && setResultFor(null)}>
        <DialogContent className="rounded-[28px] bg-white p-6 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl font-extrabold text-ink">
              Draw result
            </DialogTitle>
            <DialogDescription className="text-sm font-bold text-ink/60">
              {resultFor?.competitionTitle} · immutable audit record
            </DialogDescription>
          </DialogHeader>
          {resultFor && (
            <div className="mt-4 grid grid-cols-2 gap-3 text-left">
              {[
                ["Draw ID", resultFor.verificationReference || resultFor.id],
                ["Status", resultFor.status],
                ["Eligible tickets", resultFor.eligibleTicketCount.toLocaleString("en-NG")],
                ["Participants", resultFor.eligibleParticipantCount.toLocaleString("en-NG")],
                ["Winning ticket", `#${resultFor.winningTicketNumber ?? "—"}`],
                ["Winner", resultFor.winnerDisplayName ?? "—"],
                ["Initiated by", resultFor.initiatedBy || "—"],
                [
                  "Completed",
                  resultFor.completedAt
                    ? new Date(resultFor.completedAt).toLocaleString("en-NG")
                    : "—",
                ],
              ].map(([k, v]) => (
                <div key={k} className="rounded-2xl bg-cream/60 p-3.5 ring-1 ring-ink/10">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-ink/45">
                    {k}
                  </p>
                  <p className="mt-0.5 break-words text-sm font-extrabold text-ink">{v}</p>
                </div>
              ))}
              <div className="col-span-2 rounded-2xl bg-sky/15 p-3.5 ring-1 ring-sky/20">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-ink/45">
                  Snapshot hash
                </p>
                <p className="mt-0.5 break-all font-mono text-[11px] font-bold text-ink/70">
                  {resultFor.snapshotHash || "—"}
                </p>
              </div>
            </div>
          )}
          <DialogFooter className="mt-5">
            <Button variant="outline" onClick={() => setResultFor(null)} className="w-full">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------------- Cancel competition confirmation ---------------- */}
      <Dialog
        open={!!cancelTarget}
        onOpenChange={(v) => !v && !cancelling && setCancelTarget(null)}
      >
        <DialogContent className="rounded-[28px] bg-white p-6 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 font-display text-2xl font-extrabold text-ink">
              <span className="grid size-10 place-items-center rounded-2xl bg-coral/20">
                <AlertCircle className="size-5 text-coral" />
              </span>
              Cancel competition
            </DialogTitle>
            <DialogDescription className="text-sm font-bold text-ink/60">
              Entries close immediately and the competition leaves every sales tab.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 rounded-2xl bg-coral/10 p-4 ring-1 ring-coral/20">
            <p className="text-sm font-extrabold text-ink">{cancelTarget?.name}</p>
            <p className="mt-1 text-xs font-bold text-ink/60">
              {cancelTarget?.slug} · {(cancelTarget?.entriesSold ?? 0).toLocaleString("en-NG")}{" "}
              tickets sold
            </p>
          </div>
          <p className="mt-3 text-xs font-bold leading-relaxed text-ink/60">
            No refunds are issued automatically — handle payouts separately. This action is logged
            for audit purposes. Cancelled competitions can no longer be drawn.
          </p>
          <DialogFooter className="mt-5 flex gap-2">
            <Button
              variant="outline"
              onClick={() => setCancelTarget(null)}
              disabled={cancelling}
              className="flex-1"
            >
              Keep competition
            </Button>
            <Button
              variant="primary"
              className="flex-1 bg-coral hover:bg-coral/90"
              disabled={cancelling}
              onClick={() => void confirmCancel()}
            >
              {cancelling ? "Cancelling…" : "Cancel competition"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------------- Competition analytics ---------------- */}
      <Dialog
        open={!!analyticsFor}
        onOpenChange={(v) => !v && !analyticsLoading && setAnalyticsFor(null)}
      >
        <DialogContent className="rounded-[28px] bg-white p-6 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 font-display text-2xl font-extrabold text-ink">
              <span className="grid size-10 place-items-center rounded-2xl bg-lilac/25">
                <TrendingUp className="size-5 text-ink" />
              </span>
              Analytics
            </DialogTitle>
            <DialogDescription className="text-sm font-bold text-ink/60">
              {analyticsFor?.name} · live Firestore figures
            </DialogDescription>
          </DialogHeader>
          {analyticsLoading || !analyticsData ? (
            <p className="mt-4 rounded-2xl bg-cream/60 px-4 py-8 text-center text-sm font-bold text-ink/55 ring-1 ring-ink/10">
              Loading performance snapshot…
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-cream/60 p-3.5 ring-1 ring-ink/10">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-ink/45">
                    Entries sold
                  </p>
                  <p className="font-display text-2xl font-extrabold tabular-nums text-ink">
                    {analyticsData.entriesSold.toLocaleString("en-NG")}
                    <span className="text-sm text-ink/50">
                      {" "}
                      / {analyticsData.totalEntries.toLocaleString("en-NG")}
                    </span>
                  </p>
                </div>
                <div className="rounded-2xl bg-cream/60 p-3.5 ring-1 ring-ink/10">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-ink/45">
                    Revenue
                  </p>
                  <p className="font-display text-2xl font-extrabold tabular-nums text-ink">
                    {formatNaira(analyticsData.revenueKobo)}
                  </p>
                </div>
                <div className="rounded-2xl bg-cream/60 p-3.5 ring-1 ring-ink/10">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-ink/45">
                    Eligible tickets
                  </p>
                  <p className="font-display text-2xl font-extrabold tabular-nums text-ink">
                    {analyticsData.eligibleTickets.toLocaleString("en-NG")}
                  </p>
                </div>
                <div className="rounded-2xl bg-cream/60 p-3.5 ring-1 ring-ink/10">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-ink/45">
                    Participants
                  </p>
                  <p className="font-display text-2xl font-extrabold tabular-nums text-ink">
                    {analyticsData.participants.toLocaleString("en-NG")}
                  </p>
                </div>
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between text-[11px] font-extrabold text-ink/60">
                  <span>Sales progress</span>
                  <span>{analyticsData.progressPct}%</span>
                </div>
                <Progress value={analyticsData.progressPct} />
              </div>
              <p className="text-xs font-bold text-ink/55">
                Status · {analyticsFor?.status} · {analyticsFor?.partner}
              </p>
            </div>
          )}
          <DialogFooter className="mt-5">
            <Button variant="outline" onClick={() => setAnalyticsFor(null)} className="flex-1">
              Close
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              onClick={() => {
                if (analyticsFor) setEntriesFor(analyticsFor.id);
                setAnalyticsFor(null);
              }}
            >
              <Ticket className="size-4" /> Manage entries
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------------- Delete competition confirmation ---------------- */}
      <Dialog open={!!deleteTarget} onOpenChange={(v) => !v && !deleting && setDeleteTarget(null)}>
        <DialogContent className="rounded-[28px] bg-white p-6 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 font-display text-2xl font-extrabold text-ink">
              <span className="grid size-10 place-items-center rounded-2xl bg-coral/20">
                <Trash2 className="size-5 text-coral" />
              </span>
              Delete competition
            </DialogTitle>
            <DialogDescription className="text-sm font-bold text-ink/60">
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 rounded-2xl bg-coral/10 p-4 ring-1 ring-coral/20">
            <p className="text-sm font-extrabold text-ink">{deleteTarget?.name}</p>
            <p className="mt-1 text-xs font-bold text-ink/60">
              {deleteTarget?.slug} · {deleteTarget?.status} · {deleteTarget?.partner}
            </p>
          </div>
          <p className="mt-3 text-xs font-bold leading-relaxed text-ink/60">
            The competition document will be permanently removed from Firestore. Any associated
            ticket records under this competition will become orphaned. This action is logged for
            audit purposes.
          </p>
          <DialogFooter className="mt-5 flex gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              className="flex-1 bg-coral hover:bg-coral/90"
              disabled={deleting}
              onClick={() => void confirmDelete()}
            >
              {deleting ? (
                <>
                  <Sparkles className="size-4 animate-pulse" /> Deleting…
                </>
              ) : (
                <>
                  <Trash2 className="size-4" /> Delete permanently
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={modalMode !== null} onOpenChange={(v) => !v && closeModal()}>
        <DialogContent className="rounded-[28px] bg-white p-0 shadow-[0_40px_120px_-40px_rgba(0,0,0,0.25)] sm:max-w-3xl max-h-[94vh] overflow-hidden flex flex-col">
          <DialogHeader className="border-b border-ink/10 px-6 py-5">
            <DialogTitle className="flex items-center justify-between gap-3 font-display text-2xl font-extrabold text-ink">
              <span className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-2xl bg-coral/20">
                  <Trophy className="size-4.5 text-coral" />
                </span>
                {modalMode === "edit" ? "Edit competition" : "New competition"}
              </span>
              <button
                className="grid size-9 place-items-center rounded-full bg-cream/60 text-ink/60 ring-1 ring-ink/10 hover:bg-white hover:text-ink"
                onClick={closeModal}
              >
                <X className="size-4" />
              </button>
            </DialogTitle>
            <DialogDescription className="mt-1 text-sm font-bold text-ink/55">
              Step {stepIdx + 1} of {STEP_LABELS.length} · {STEP_LABELS[stepIdx]}
            </DialogDescription>
          </DialogHeader>

          {submitted ? (
            <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-10 text-center">
              <div className="grid size-20 place-items-center rounded-full bg-mint/35">
                <CheckCircle2 className="size-10 text-ink" />
              </div>
              <h3 className="mt-5 font-display text-2xl font-extrabold text-ink">
                {modalMode === "edit" ? "Competition updated" : "Competition created"}
              </h3>
              <p className="mt-2 max-w-md text-sm font-bold text-ink/60">
                {modalMode === "edit"
                  ? "Edits saved. Asset review, schedule, and draw settings remain live adjustable."
                  : form.status === "DRAFT"
                    ? "Saved as a draft — it is hidden from the public site until you publish it."
                    : "Competition created and published. It is now visible on raffila.com."}
              </p>
              <div className="mt-6 grid w-full max-w-md grid-cols-2 gap-3 text-left">
                <Card className="rounded-2xl border-0 bg-cream/60 p-0 ring-1 ring-ink/10">
                  <CardContent className="p-4">
                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-ink/45">
                      Competition ID
                    </p>
                    <p className="mt-1 text-sm font-extrabold text-ink">
                      {form.id ?? "RF-C-00134"}
                    </p>
                  </CardContent>
                </Card>
                <Card className="rounded-2xl border-0 bg-cream/60 p-0 ring-1 ring-ink/10">
                  <CardContent className="p-4">
                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-ink/45">
                      Status
                    </p>
                    <Badge className="mt-1 rounded-full bg-ink/10 px-2 py-0.5 text-[10px] font-extrabold uppercase ring-0 text-ink">
                      {form.status ?? "Draft"}
                    </Badge>
                  </CardContent>
                </Card>
              </div>
              <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                {form.status !== "DRAFT" && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      const slug = form.slug || slugifyTitle(form.name);
                      closeModal();
                      void navigate({ to: "/competitions/$slug", params: { slug } });
                    }}
                  >
                    <EyeIcon className="size-4" /> View on site
                  </Button>
                )}
                <Button variant="primary" onClick={closeModal}>
                  <Sparkles className="size-4" /> Done
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="px-6 pt-4">
                <div className="flex items-center gap-1.5 overflow-x-auto py-2">
                  {STEP_LABELS.map((s, i) => (
                    <div key={s} className="flex shrink-0 items-center gap-1.5">
                      <div
                        className={cn(
                          "grid size-8 place-items-center rounded-full text-[11px] font-extrabold ring-1",
                          i < stepIdx
                            ? "bg-mint/35 text-ink ring-mint/40"
                            : i === stepIdx
                              ? "bg-coral text-white ring-coral/50 shadow-[0_10px_24px_-16px_var(--coral)]"
                              : "bg-cream/50 text-ink/55 ring-ink/10",
                        )}
                      >
                        {i < stepIdx ? <Check className="size-3.5" /> : i + 1}
                      </div>
                      <span
                        className={cn(
                          "whitespace-nowrap text-[10px] font-extrabold uppercase tracking-wider",
                          i <= stepIdx ? "text-ink" : "text-ink/40",
                        )}
                      >
                        {s}
                      </span>
                      {i < STEP_LABELS.length - 1 && (
                        <ChevronRight className="mx-0.5 size-3 text-ink/30" />
                      )}
                    </div>
                  ))}
                </div>
                <Separator className="mt-2" />
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                {stepIdx === 0 && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2 space-y-2">
                      <Label className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-ink/50">
                        Competition name
                      </Label>
                      <Input
                        placeholder="e.g. 2026 Mercedes-Benz C-Class Grand Prize"
                        value={form.name}
                        onChange={(e) => {
                          const name = e.target.value;
                          setForm((f) => ({
                            ...f,
                            name,
                            // The URL slug is derived from the name in the
                            // background — admins never edit it directly. On
                            // edit the slug is the Firestore doc ID and must
                            // never change (checkout/draws key off it).
                            slug: modalMode === "edit" ? f.slug : slugifyTitle(name),
                          }));
                        }}
                        className="h-12 rounded-2xl border-0 bg-white px-4 text-sm font-bold text-ink placeholder:text-ink/40 ring-1 ring-ink/10 focus-visible:ring-coral"
                      />
                      {modalMode !== "edit" && form.slug && (
                        <p className="text-[11px] font-bold text-ink/45">
                          URL: /competitions/{form.slug}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-ink/50">
                        Category
                      </Label>
                      <Select
                        value={form.category}
                        onValueChange={(v) => setForm({ ...form, category: v })}
                      >
                        <SelectTrigger className="h-12 rounded-2xl bg-white px-4 text-sm font-extrabold text-ink ring-1 ring-ink/10 focus:ring-coral">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-[22px] bg-white p-1 ring-1 ring-ink/10">
                          {CATEGORIES.map((c) => (
                            <SelectItem key={c} value={c} className="rounded-xl font-bold">
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="sm:col-span-2 space-y-2">
                      <Label className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-ink/50">
                        Description
                      </Label>
                      <Textarea
                        rows={4}
                        placeholder="Rich description shown on the competition landing page…"
                        value={form.description}
                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                        className="rounded-2xl border-0 bg-white p-4 text-sm font-bold text-ink placeholder:text-ink/40 ring-1 ring-ink/10 focus-visible:ring-coral"
                      />
                    </div>
                  </div>
                )}

                {stepIdx === 1 && (
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <AssetUploader
                        value={form.assets}
                        onChange={(next) => setForm({ ...form, assets: next })}
                        max={12}
                        label="Prize asset images"
                        hint="Upload from device via Cloudinary, drag/drop, or paste direct public image URLs."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-ink/50">
                        Market value (₦)
                      </Label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-extrabold text-ink/55">
                          ₦
                        </span>
                        <Input
                          type="number"
                          value={form.marketValue}
                          onChange={(e) => setForm({ ...form, marketValue: e.target.value })}
                          placeholder="12,000,000"
                          className="h-12 rounded-2xl border-0 bg-white pl-8 pr-4 text-base font-extrabold text-ink placeholder:text-ink/40 ring-1 ring-ink/10 focus-visible:ring-coral"
                        />
                      </div>
                      <p className="text-[11px] font-bold text-ink/55">
                        {formatNaira(parseInt(form.marketValue || "0", 10) * 100)} suggested retail
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-ink/50">
                        Asset condition
                      </Label>
                      <Select
                        value={form.condition}
                        onValueChange={(v) => setForm({ ...form, condition: v })}
                      >
                        <SelectTrigger className="h-12 rounded-2xl bg-white px-4 text-sm font-extrabold text-ink ring-1 ring-ink/10 focus:ring-coral">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-[22px] bg-white p-1 ring-1 ring-ink/10">
                          <SelectItem value="new" className="rounded-xl font-bold">
                            Brand new
                          </SelectItem>
                          <SelectItem value="likenew" className="rounded-xl font-bold">
                            Like new
                          </SelectItem>
                          <SelectItem value="refurbished" className="rounded-xl font-bold">
                            Certified refurbished
                          </SelectItem>
                          <SelectItem value="used" className="rounded-xl font-bold">
                            Used / verified
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {/* Partner Assignment Section */}
                    <div className="sm:col-span-2 p-5 rounded-2xl bg-paper/60 border border-ink/10 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Handshake className="size-4 text-coral" />
                          <h4 className="text-xs font-extrabold uppercase tracking-wider text-ink">
                            Partner Assignment & Revenue Split
                          </h4>
                        </div>
                        <Badge className="bg-coral/10 text-coral text-[10px] font-bold border-0">
                          {form.partnerRevenueSharePct}% Partner Share
                        </Badge>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Assigned Partner */}
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-extrabold uppercase tracking-wider text-ink/50">
                            Assigned Partner
                          </Label>
                          <Select
                            value={form.assignedPartnerId}
                            onValueChange={(val) => {
                              const p = partnerStore.getPartner(val);
                              setForm({
                                ...form,
                                assignedPartnerId: val,
                                partner: p?.businessName || val,
                                partnerRevenueSharePct: p?.defaultRevenueSplitPercent || 85,
                              });
                            }}
                          >
                            <SelectTrigger className="h-11 rounded-xl bg-white px-3 text-xs font-bold text-ink ring-1 ring-ink/10">
                              <SelectValue placeholder="Select approved partner" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl bg-white">
                              {partnerStore
                                .getAllPartners()
                                .filter((p) => p.verificationStatus === "APPROVED")
                                .map((p) => (
                                  <SelectItem key={p.id} value={p.id} className="text-xs font-bold">
                                    {p.businessName} ({p.defaultRevenueSplitPercent || 85}% default)
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Partner Prize Asset */}
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-extrabold uppercase tracking-wider text-ink/50">
                            Partner Prize Asset
                          </Label>
                          <Select
                            value={form.partnerAssetId}
                            onValueChange={(val) => {
                              const asset = partnerStore
                                .getPartnerAssets(form.assignedPartnerId)
                                .find((a) => a.id === val);
                              if (asset) {
                                setForm({
                                  ...form,
                                  partnerAssetId: val,
                                  assetName: asset.name,
                                  marketValue: String(Math.round(asset.declaredValueKobo / 100)),
                                  condition: asset.condition || "new",
                                });
                              } else {
                                setForm({ ...form, partnerAssetId: val });
                              }
                            }}
                          >
                            <SelectTrigger className="h-11 rounded-xl bg-white px-3 text-xs font-bold text-ink ring-1 ring-ink/10">
                              <SelectValue placeholder="Select partner asset" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl bg-white">
                              {partnerStore.getPartnerAssets(form.assignedPartnerId).map((a) => (
                                <SelectItem key={a.id} value={a.id} className="text-xs font-bold">
                                  {a.name} · {formatNaira(a.declaredValueKobo)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Partner Revenue Share % */}
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-extrabold uppercase tracking-wider text-ink/50">
                            Partner Revenue Share %
                          </Label>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min={1}
                              max={99}
                              value={form.partnerRevenueSharePct}
                              onChange={(e) =>
                                setForm({
                                  ...form,
                                  partnerRevenueSharePct: Number(e.target.value) || 85,
                                })
                              }
                              className="h-11 rounded-xl bg-white text-xs font-extrabold"
                            />
                            <span className="text-xs font-extrabold text-ink">%</span>
                          </div>
                        </div>

                        {/* Platform Fee Share */}
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-extrabold uppercase tracking-wider text-ink/50">
                            Raffila Platform Fee %
                          </Label>
                          <div className="h-11 rounded-xl bg-white border border-ink/10 flex items-center px-3 text-xs font-extrabold text-coral">
                            {100 - (form.partnerRevenueSharePct || 85)}% Platform Retained
                          </div>
                        </div>
                      </div>

                      {/* Auto-calculate estimated partner payout upon target sellout */}
                      <div className="p-3.5 rounded-xl bg-white border border-ink/10 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-ink/60 font-medium">
                            Projected Target Gross (100% Sellout):
                          </span>
                          <span className="font-extrabold text-ink">
                            {formatNaira(
                              parseInt(form.ticketPrice || "0", 10) *
                                parseInt(form.totalEntries || "0", 10) *
                                100,
                            )}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-mint-800 font-extrabold">
                            Estimated Partner Payout ({form.partnerRevenueSharePct}%):
                          </span>
                          <span className="font-extrabold text-mint-700 text-sm">
                            {formatNaira(
                              Math.round(
                                parseInt(form.ticketPrice || "0", 10) *
                                  parseInt(form.totalEntries || "0", 10) *
                                  100 *
                                  ((form.partnerRevenueSharePct || 85) / 100),
                              ),
                            )}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs pt-1 border-t border-ink/5">
                          <span className="text-ink/60 font-medium">
                            Estimated Raffila Fee ({100 - (form.partnerRevenueSharePct || 85)}%):
                          </span>
                          <span className="font-bold text-coral">
                            {formatNaira(
                              Math.round(
                                parseInt(form.ticketPrice || "0", 10) *
                                  parseInt(form.totalEntries || "0", 10) *
                                  100 *
                                  ((100 - (form.partnerRevenueSharePct || 85)) / 100),
                              ),
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {stepIdx === 2 && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-ink/50">
                        Ticket price (₦)
                      </Label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-extrabold text-ink/55">
                          ₦
                        </span>
                        <Input
                          type="number"
                          value={form.ticketPrice}
                          onChange={(e) => setForm({ ...form, ticketPrice: e.target.value })}
                          className="h-12 rounded-2xl border-0 bg-white pl-8 pr-4 text-base font-extrabold text-ink placeholder:text-ink/40 ring-1 ring-ink/10 focus-visible:ring-coral"
                        />
                      </div>
                      <p className="text-[11px] font-bold text-ink/55">
                        {formatNaira(parseInt(form.ticketPrice || "0", 10) * 100)} per entry
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-ink/50">
                        Max total entries
                      </Label>
                      <Input
                        type="number"
                        value={form.totalEntries}
                        onChange={(e) => setForm({ ...form, totalEntries: e.target.value })}
                        className="h-12 rounded-2xl border-0 bg-white px-4 text-base font-extrabold text-ink ring-1 ring-ink/10 focus-visible:ring-coral"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-ink/50">
                        Max entries per user
                      </Label>
                      <Input
                        type="number"
                        value={form.maxPerUser}
                        onChange={(e) => setForm({ ...form, maxPerUser: e.target.value })}
                        className="h-12 rounded-2xl border-0 bg-white px-4 text-base font-extrabold text-ink ring-1 ring-ink/10 focus-visible:ring-coral"
                      />
                    </div>
                  </div>
                )}

                {stepIdx === 3 && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-ink/50">
                        Start date
                      </Label>
                      <DateTimeField
                        id="competition-start-date"
                        label="Start date"
                        value={form.startDate}
                        onChange={(next) => setForm({ ...form, startDate: next })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-ink/50">
                        Draw date
                      </Label>
                      <DateTimeField
                        id="competition-draw-date"
                        label="Draw date"
                        value={form.drawDate}
                        onChange={(next) => setForm({ ...form, drawDate: next })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-ink/50">
                        Live push delay (mins)
                      </Label>
                      <Input
                        type="number"
                        value={form.liveDelay}
                        onChange={(e) => setForm({ ...form, liveDelay: e.target.value })}
                        className="h-12 rounded-2xl border-0 bg-white px-4 text-base font-extrabold text-ink ring-1 ring-ink/10 focus-visible:ring-coral"
                      />
                    </div>
                  </div>
                )}

                {stepIdx === 4 && (
                  <div className="space-y-3">
                    <div className="space-y-2 rounded-2xl bg-white p-4 ring-1 ring-ink/10">
                      <Label className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-ink/50">
                        Publish status
                      </Label>
                      <div className="flex flex-wrap gap-2">
                        {PUBLISH_STATUSES.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setForm({ ...form, status: opt.value })}
                            className={cn(
                              "rounded-full px-4 py-2 text-xs font-extrabold capitalize ring-1 transition-colors",
                              form.status === opt.value
                                ? "bg-ink text-paper ring-ink"
                                : "bg-cream text-ink ring-ink/10 hover:bg-lilac/15",
                            )}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                      <p className="text-[11px] font-bold text-ink/50">
                        {PUBLISH_STATUSES.find((o) => o.value === form.status)?.hint ??
                          "Choose whether this competition is public."}
                      </p>
                      {form.status === "DRAFT" && (
                        <p className="rounded-xl bg-lemon/30 px-3 py-2 text-[11px] font-extrabold text-ink">
                          Drafts are hidden from the public site. “View on site” will show
                          “Competition unavailable” until you publish.
                        </p>
                      )}
                    </div>
                    <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-4 ring-1 ring-ink/10">
                      <div>
                        <p className="text-sm font-extrabold text-ink">Featured competition</p>
                        <p className="text-xs font-bold text-ink/55">
                          Pin to the top of the home page and featured carousel.
                        </p>
                      </div>
                      <Switch
                        checked={form.featured}
                        onCheckedChange={(v) => setForm({ ...form, featured: !!v })}
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-4 ring-1 ring-ink/10">
                      <div>
                        <p className="text-sm font-extrabold text-ink">Public results</p>
                        <p className="text-xs font-bold text-ink/55">
                          Publish draw results and winner identity publicly.
                        </p>
                      </div>
                      <Switch
                        checked={form.publicResults}
                        onCheckedChange={(v) => setForm({ ...form, publicResults: !!v })}
                      />
                    </div>
                  </div>
                )}

                {stepIdx === 5 && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {[
                      {
                        k: "Basics",
                        title: form.name || "Untitled",
                        sub: `${CATEGORIES.find((c) => c.toLowerCase() === form.category) ?? form.category} · slug: ${form.slug || "auto"}`,
                      },
                      {
                        k: "Asset",
                        title: `${formatNaira(parseInt(form.marketValue || "0", 10) * 100)} · ${({ new: "Brand new", likenew: "Like new", refurbished: "Refurbished", used: "Used" } as any)[form.condition] || "Brand new"}`,
                        sub: `${form.assets.length} uploaded · ${PARTNERS.find((p) => p.toLowerCase().replace(/[^a-z]/g, "") === form.partner) ?? PARTNERS[0]}`,
                      },
                      {
                        k: "Entry config",
                        title: `${formatNaira(parseInt(form.ticketPrice || "0", 10) * 100)} per ticket`,
                        sub: `${form.totalEntries} total · ${form.maxPerUser} max per user`,
                      },
                      {
                        k: "Schedule",
                        title: `Draw · ${form.drawDate.replace("T", " ")}`,
                        sub: `Start ${form.startDate.replace("T", " ")} · delay ${form.liveDelay}m · ${form.featured ? "featured" : "not featured"} · ${form.publicResults ? "public" : "private"} results`,
                      },
                      {
                        k: "Visibility",
                        title: form.status === "DRAFT" ? "Draft — hidden from site" : form.status,
                        sub:
                          form.status === "DRAFT"
                            ? "Will NOT appear on raffila.com. Choose Live now or Scheduled to publish."
                            : `Public on raffila.com · ${form.publicResults ? "public" : "private"} results`,
                      },
                    ].map((s) => (
                      <Card
                        key={s.k}
                        className="rounded-2xl border-0 bg-white p-0 ring-1 ring-ink/10"
                      >
                        <CardContent className="space-y-2 p-4">
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] font-extrabold uppercase tracking-wider text-ink/45">
                              {s.k}
                            </p>
                            <Badge className="rounded-full bg-mint/35 px-2 py-0.5 text-[9px] font-extrabold ring-0 text-ink">
                              OK
                            </Badge>
                          </div>
                          <p className="text-sm font-extrabold text-ink">{s.title}</p>
                          <p className="text-[11px] font-bold text-ink/55">{s.sub}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              <DialogFooter className="flex-wrap border-t border-ink/10 px-6 py-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    if (stepIdx === 0) closeModal();
                    else setStepIdx(stepIdx - 1);
                  }}
                  disabled={submitting}
                >
                  {stepIdx === 0 ? "Cancel" : "Back"}
                </Button>
                <div className="flex-1" />
                <Button
                  variant="ghost"
                  onClick={() => {
                    setForm((f) => ({ ...f, status: "DRAFT" }));
                    void submitDraft("DRAFT");
                  }}
                  disabled={submitting}
                >
                  Save as draft
                </Button>
                {stepIdx < STEP_LABELS.length - 1 ? (
                  <Button
                    variant="primary"
                    onClick={() => setStepIdx(stepIdx + 1)}
                    disabled={submitting}
                  >
                    Continue <ChevronRight className="size-4" />
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    onClick={() => void submitDraft()}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <Sparkles className="size-4 animate-pulse" />{" "}
                        {modalMode === "edit" ? "Saving…" : "Creating…"}
                      </>
                    ) : (
                      <>
                        <Sparkles className="size-4" />
                        {modalMode === "edit" ? "Save changes" : "Create competition"}
                      </>
                    )}
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!entriesFor} onOpenChange={(v) => !v && setEntriesFor(null)}>
        <DialogContent className="rounded-[28px] bg-white p-0 shadow-[0_40px_120px_-40px_rgba(0,0,0,0.25)] sm:max-w-5xl max-h-[92vh] overflow-hidden flex flex-col">
          <DialogHeader className="border-b border-ink/10 px-6 py-5">
            <DialogTitle className="flex items-center justify-between gap-3 font-display text-2xl font-extrabold text-ink">
              <span className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-2xl bg-mint/30">
                  <Ticket className="size-5 text-ink" />
                </span>
                {entriesSource.comp?.name ?? "Entries"} · manage
              </span>
              <button
                className="grid size-9 place-items-center rounded-full bg-cream/60 text-ink/60 ring-1 ring-ink/10 hover:bg-white hover:text-ink"
                onClick={() => setEntriesFor(null)}
              >
                <X className="size-4" />
              </button>
            </DialogTitle>
            <DialogDescription className="mt-1 text-sm font-bold text-ink/55">
              {entriesSource.comp
                ? `${entriesSource.rows.length.toLocaleString("en-NG")} total entries · ${formatNaira(entriesSource.comp.ticketPrice)} each`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 border-b border-ink/10 px-6 py-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[240px] flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink/40" />
                <Input
                  placeholder="Search name, handle, entry id…"
                  value={entriesSearch}
                  onChange={(e) => {
                    setEntriesSearch(e.target.value);
                    setEntriesPage(1);
                  }}
                  className="h-11 rounded-full border-0 bg-white pl-9 pr-4 text-sm font-bold text-ink placeholder:text-ink/40 ring-1 ring-ink/10 focus-visible:ring-coral"
                />
              </div>
              <Tabs
                value={entriesFilter}
                onValueChange={(v) => {
                  setEntriesFilter(v as any);
                  setEntriesPage(1);
                }}
                className="w-auto"
              >
                <TabsList className="rounded-full bg-cream p-1">
                  {[
                    { v: "all", l: "All" },
                    { v: "paid", l: "Paid" },
                    { v: "won", l: "Won" },
                    { v: "pending", l: "Pending" },
                  ].map((t) => (
                    <TabsTrigger
                      key={t.v}
                      value={t.v}
                      className="rounded-full px-4 py-1.5 text-xs font-extrabold data-[state=active]:bg-white data-[state=active]:text-ink data-[state=active]:shadow-sm data-[state=inactive]:text-ink/60"
                    >
                      {t.l}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              <div className="ml-auto flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    toast.success("Export queued", {
                      description: "Entries CSV will download shortly.",
                    })
                  }
                >
                  <Download className="size-3.5" /> Export CSV
                </Button>
                <Button variant="ghost" size="sm">
                  <Filter className="size-3.5" /> More filters
                </Button>
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
            <Table>
              <TableHeader className="[&_tr]:border-ink/10 bg-cream/60 [&_tr_th]:bg-transparent">
                <TableRow>
                  <TableHead className="rounded-l-2xl py-3 font-extrabold text-ink/65">
                    Entry
                  </TableHead>
                  <TableHead className="py-3 font-extrabold text-ink/65">Player</TableHead>
                  <TableHead className="py-3 text-right font-extrabold text-ink/65">
                    Tickets
                  </TableHead>
                  <TableHead className="py-3 text-right font-extrabold text-ink/65">
                    Amount
                  </TableHead>
                  <TableHead className="py-3 font-extrabold text-ink/65">Entered</TableHead>
                  <TableHead className="py-3 font-extrabold text-ink/65">Status</TableHead>
                  <TableHead className="rounded-r-2xl py-3 text-right font-extrabold text-ink/65">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="[&_tr]:border-ink/10">
                {visibleEntries.map((r) => (
                  <TableRow key={r.id} className="hover:bg-sky/8">
                    <TableCell className="py-3">
                      <div className="min-w-0 max-w-[200px]">
                        <p className="truncate text-xs font-extrabold text-ink">{r.id}</p>
                        <p className="truncate text-[11px] font-bold text-ink/50">
                          {entriesSource.comp?.id ?? ""}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="size-9 ring-2 ring-white">
                          <AvatarFallback className="bg-coral/15 text-coral font-extrabold">
                            {r.monogram}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 max-w-[240px]">
                          <p className="truncate text-sm font-extrabold text-ink">{r.name}</p>
                          <p className="truncate text-[11px] font-bold text-ink/50">{r.handle}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-3 text-right text-sm font-extrabold text-ink">
                      {r.tickets.toLocaleString("en-NG")}
                    </TableCell>
                    <TableCell className="py-3 text-right whitespace-nowrap text-sm font-extrabold text-ink">
                      {formatNaira(r.amount)}
                    </TableCell>
                    <TableCell className="py-3 whitespace-nowrap text-xs font-bold text-ink/60">
                      {r.entered}
                    </TableCell>
                    <TableCell className="py-3">
                      <Badge
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ring-0",
                          r.status === "Paid" && "bg-mint/35 text-ink",
                          r.status === "Pending" && "bg-lemon/40 text-ink",
                          r.status === "Won" && "bg-coral/20 text-coral",
                          r.status === "Refunded" && "bg-ink/10 text-ink",
                        )}
                      >
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-ink/70 hover:bg-sky/15 hover:text-ink"
                          onClick={() => toast.info("Opening entry", { description: r.id })}
                        >
                          <Eye className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-ink/70 hover:bg-coral/10 hover:text-coral"
                          onClick={() => {
                            if (typeof navigator !== "undefined" && navigator.clipboard)
                              void navigator.clipboard.writeText(r.id);
                            toast.success("Entry ID copied", { description: r.id });
                          }}
                        >
                          <Copy className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-ink/70 hover:bg-mint/20 hover:text-ink"
                          onClick={() => toast.info("Opening player", { description: r.name })}
                        >
                          <UserRound className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {visibleEntries.length === 0 ? (
              <div className="py-16 text-center text-sm font-bold text-ink/50">
                No entries match this filter.
              </div>
            ) : null}
          </div>
          <DialogFooter className="flex-wrap border-t border-ink/10 px-6 py-4">
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-ink/50">
              Showing {visibleEntries.length.toLocaleString("en-NG")}
            </div>
            <div className="flex-1" />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEntriesPage((p) => Math.max(1, p - 1))}
              disabled={entriesPage === 1}
            >
              Previous
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setEntriesPage((p) => p + 1)}
              disabled={visibleEntries.length < entriesPage * PAGE_SIZE}
            >
              Load more
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}

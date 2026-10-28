import { useMemo, useState } from "react";
import {
  ArrowUpDown,
  Download,
  Flame,
  MessageSquare,
  PhoneCall,
  Snowflake,
  Sun,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  computeLeadScore,
  downloadCSV,
  type CRMActivity,
  type CRMLead,
  type LeadStatus,
} from "@/lib/crm-service";
import {
  EmptyState,
  LeadAvatar,
  LeadStatusPill,
  Panel,
  ScorePill,
  SearchField,
  formatDate,
  formatNairaFull,
  relativeTime,
  selectClass,
} from "./crm-ui";

type SortKey = "score" | "spend" | "tickets" | "recent";

const STATUS_OPTIONS: LeadStatus[] = [
  "new",
  "contacted",
  "qualified",
  "hot",
  "warm",
  "converted",
  "lost",
  "unresponsive",
];

export function LeadsPanel({
  leads,
  activities,
  onOpenLead,
  onLogCall,
}: {
  leads: CRMLead[];
  activities: CRMActivity[];
  onOpenLead: (lead: CRMLead) => void;
  onLogCall: (lead: CRMLead) => void;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [band, setBand] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("score");

  const scored = useMemo(
    () => leads.map((lead) => ({ lead, score: computeLeadScore(lead, activities) })),
    [leads, activities],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = scored.filter(({ lead, score }) => {
      const matchesQuery =
        !q ||
        lead.name.toLowerCase().includes(q) ||
        lead.email.toLowerCase().includes(q) ||
        lead.phone.includes(q) ||
        lead.location.toLowerCase().includes(q);
      const matchesStatus = status === "all" || lead.status === status;
      const matchesBand = band === "all" || score.band === band;
      return matchesQuery && matchesStatus && matchesBand;
    });

    rows.sort((a, b) => {
      switch (sort) {
        case "spend":
          return b.lead.totalSpent - a.lead.totalSpent;
        case "tickets":
          return b.lead.ticketsBought - a.lead.ticketsBought;
        case "recent": {
          const at = a.lead.lastContacted ? new Date(a.lead.lastContacted).getTime() : 0;
          const bt = b.lead.lastContacted ? new Date(b.lead.lastContacted).getTime() : 0;
          return bt - at;
        }
        default:
          return b.score.score - a.score.score;
      }
    });
    return rows;
  }, [scored, query, status, band, sort]);

  const exportCsv = () => {
    const rows = filtered.map(({ lead, score }) => [
      lead.name,
      lead.phone,
      lead.email,
      lead.location,
      lead.status,
      score.score,
      score.band,
      lead.ticketsBought,
      lead.totalSpent,
      lead.lastContacted ? formatDate(lead.lastContacted) : "Never",
      lead.assignedTo || "Unassigned",
    ]);
    const count = downloadCSV(
      "raffila-crm-leads",
      [
        "Name",
        "Phone",
        "Email",
        "Location",
        "Status",
        "Lead score",
        "Score band",
        "Tickets",
        "Lifetime spend (NGN)",
        "Last contacted",
        "Assigned to",
      ],
      rows,
    );
    if (count) toast.success(`Exported ${count} leads to CSV`);
    else toast.error("Nothing to export");
  };

  const counts = useMemo(() => {
    const hot = scored.filter((s) => s.score.band === "hot").length;
    const warm = scored.filter((s) => s.score.band === "warm").length;
    const cold = scored.filter((s) => s.score.band === "cold").length;
    return { hot, warm, cold };
  }, [scored]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <BandTile
          tone="hot"
          label="Hot"
          count={counts.hot}
          hint="Score 70+ — call today"
          icon={<Flame className="h-4 w-4" />}
          active={band === "hot"}
          onClick={() => setBand(band === "hot" ? "all" : "hot")}
        />
        <BandTile
          tone="warm"
          label="Warm"
          count={counts.warm}
          hint="Score 40–69 — nurture"
          icon={<Sun className="h-4 w-4" />}
          active={band === "warm"}
          onClick={() => setBand(band === "warm" ? "all" : "warm")}
        />
        <BandTile
          tone="cold"
          label="Cold"
          count={counts.cold}
          hint="Score under 40 — low intent"
          icon={<Snowflake className="h-4 w-4" />}
          active={band === "cold"}
          onClick={() => setBand(band === "cold" ? "all" : "cold")}
        />
      </div>

      <Panel className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder="Search by name, email, phone or location…"
            className="min-w-[240px] flex-1"
          />

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className={`${selectClass} h-10`}
          >
            <option value="all">All statuses ({leads.length})</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s} ({leads.filter((l) => l.status === s).length})
              </option>
            ))}
          </select>

          <select
            value={band}
            onChange={(e) => setBand(e.target.value)}
            className={`${selectClass} h-10`}
          >
            <option value="all">All score bands</option>
            <option value="hot">Hot</option>
            <option value="warm">Warm</option>
            <option value="cold">Cold</option>
          </select>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className={`${selectClass} h-10`}
          >
            <option value="score">Sort: lead score</option>
            <option value="spend">Sort: lifetime spend</option>
            <option value="tickets">Sort: tickets bought</option>
            <option value="recent">Sort: last contacted</option>
          </select>

          <Button
            variant="outline"
            onClick={exportCsv}
            className="h-10 gap-1.5 text-xs font-bold"
          >
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 pt-2">
          <p className="text-[11px] font-bold text-stone-600">
            Showing <span className="text-stone-900">{filtered.length}</span> of {leads.length} leads
          </p>
          {(query || status !== "all" || band !== "all") && (
            <button
              onClick={() => {
                setQuery("");
                setStatus("all");
                setBand("all");
              }}
              className="text-[11px] font-extrabold text-emerald-800 hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      </Panel>

      <Panel className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left">
            <thead className="border-b border-stone-200 bg-stone-50">
              <tr className="text-[10px] font-extrabold uppercase tracking-wider text-stone-500">
                <th className="px-4 py-3">Contact</th>
                <th className="px-3 py-3">Score</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Purchases</th>
                <th className="px-3 py-3">Last contact</th>
                <th className="px-3 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState
                      icon={<Users className="h-5 w-5" />}
                      title="No leads match those filters"
                      body="Try a different search term or clear the filters to see the full directory."
                    />
                  </td>
                </tr>
              ) : (
                filtered.map(({ lead, score }) => (
                  <tr
                    key={lead.id}
                    onClick={() => onOpenLead(lead)}
                    className="cursor-pointer transition hover:bg-emerald-50/40"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <LeadAvatar name={lead.name} band={score.band} />
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-extrabold text-stone-900">
                            {lead.name}
                          </p>
                          <p className="truncate font-mono text-[11px] font-semibold text-stone-500">
                            {lead.phone}
                            {lead.email ? ` • ${lead.email}` : ""}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <ScorePill score={score.score} band={score.band} />
                    </td>
                    <td className="px-3 py-3">
                      <LeadStatusPill status={lead.status} />
                    </td>
                    <td className="px-3 py-3">
                      <p className="text-[13px] font-extrabold text-stone-900">
                        {lead.ticketsBought}{" "}
                        <span className="text-[11px] font-semibold text-stone-500">tickets</span>
                      </p>
                      <p className="text-[11px] font-bold text-emerald-800">
                        {formatNairaFull(lead.totalSpent)}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      {lead.lastContacted ? (
                        <>
                          <p className="text-[12px] font-bold text-stone-800">
                            {relativeTime(lead.lastContacted)}
                          </p>
                          <p className="text-[10px] font-semibold text-stone-400">
                            {formatDate(lead.lastContacted)}
                          </p>
                        </>
                      ) : (
                        <span className="text-[11px] font-bold text-amber-700">Never contacted</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <a
                          href={`https://wa.me/${lead.phone.replace(/[^0-9]/g, "")}`}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 bg-white text-emerald-700 transition hover:bg-emerald-50"
                          aria-label="WhatsApp"
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                        </a>
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onLogCall(lead);
                          }}
                          className="h-8 gap-1.5 bg-emerald-800 text-[11px] font-bold text-white hover:bg-emerald-900"
                        >
                          <PhoneCall className="h-3 w-3" /> Log call
                        </Button>
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-500">
                          <ArrowUpDown className="h-3 w-3" />
                        </span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      <p className="px-1 text-[11px] font-medium text-stone-500">
        Tip: click any row to open the full contact record — timeline, notes, deals and tasks.
      </p>
    </div>
  );
}

function BandTile({
  tone,
  label,
  count,
  hint,
  icon,
  active,
  onClick,
}: {
  tone: "hot" | "warm" | "cold";
  label: string;
  count: number;
  hint: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  const styles = {
    hot: "bg-orange-50 text-orange-800 ring-orange-200",
    warm: "bg-amber-50 text-amber-800 ring-amber-200",
    cold: "bg-sky-50 text-sky-800 ring-sky-200",
  }[tone];
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-between rounded-2xl border bg-white p-4 text-left transition ${
        active
          ? "border-emerald-400 ring-2 ring-emerald-200"
          : "border-stone-200/90 hover:border-emerald-300"
      }`}
    >
      <div>
        <p className="text-[11px] font-extrabold uppercase tracking-wider text-stone-500">{label}</p>
        <p className="mt-1 text-2xl font-extrabold leading-none text-stone-900">{count}</p>
        <p className="mt-1 text-[11px] font-semibold text-stone-500">{hint}</p>
      </div>
      <span className={`flex h-10 w-10 items-center justify-center rounded-xl ring-1 ${styles}`}>
        {icon}
      </span>
    </button>
  );
}

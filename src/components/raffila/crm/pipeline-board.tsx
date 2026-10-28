import { useMemo, useState } from "react";
import {
  Building2,
  CalendarDays,
  ChevronDown,
  Plus,
  Target,
  Trash2,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createCRMDeal,
  deleteCRMDeal,
  updateCRMDeal,
  DEAL_STAGES,
  STAGE_PROBABILITY,
  type CRMDeal,
  type CRMLead,
  type DealStage,
  type StaffMember,
} from "@/lib/crm-service";
import {
  EmptyState,
  Panel,
  formatDate,
  formatNaira,
  formatNairaFull,
  inputClass,
  selectClass,
} from "./crm-ui";

export function PipelineBoard({
  deals,
  leads,
  session,
  onOpenLead,
}: {
  deals: CRMDeal[];
  leads: CRMLead[];
  session: StaffMember;
  onOpenLead: (leadId: string) => void;
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<DealStage | null>(null);
  const [isNewOpen, setIsNewOpen] = useState(false);

  const [title, setTitle] = useState("");
  const [leadId, setLeadId] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [value, setValue] = useState("");
  const [stage, setStage] = useState<DealStage>("new");
  const [closeDate, setCloseDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const byStage = useMemo(() => {
    const map = new Map<DealStage, CRMDeal[]>();
    DEAL_STAGES.forEach((s) => map.set(s.id, []));
    deals.forEach((d) => {
      const list = map.get(d.stage) ?? [];
      list.push(d);
      map.set(d.stage, list);
    });
    return map;
  }, [deals]);

  const openDeals = deals.filter((d) => d.stage !== "won" && d.stage !== "lost");
  const pipelineValue = openDeals.reduce((sum, d) => sum + d.value, 0);
  const weighted = openDeals.reduce((sum, d) => sum + (d.value * d.probability) / 100, 0);
  const wonValue = deals.filter((d) => d.stage === "won").reduce((sum, d) => sum + d.value, 0);

  const move = async (deal: CRMDeal, next: DealStage) => {
    if (deal.stage === next) return;
    const previous = deal.stage;
    const res = await updateCRMDeal(deal.id, { stage: next });
    if (res.success) toast.success(`${deal.title} → ${next}`);
    else toast.error(res.error || `Could not move deal from ${previous}`);
  };

  const resetForm = () => {
    setTitle("");
    setLeadId("");
    setContactName("");
    setContactPhone("");
    setContactEmail("");
    setValue("");
    setStage("new");
    setCloseDate("");
    setNotes("");
  };

  const handleCreate = async () => {
    if (!title.trim() || !contactName.trim()) {
      toast.error("A deal needs a name and a contact");
      return;
    }
    setSaving(true);
    const res = await createCRMDeal({
      title: title.trim(),
      contactName: contactName.trim(),
      ...(leadId ? { leadId } : {}),
      ...(contactEmail.trim() ? { contactEmail: contactEmail.trim() } : {}),
      ...(contactPhone.trim() ? { contactPhone: contactPhone.trim() } : {}),
      value: Number(value.replace(/[^0-9.]/g, "")) || 0,
      stage,
      ...(closeDate ? { expectedCloseDate: new Date(closeDate).toISOString() } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
      ownerName: session.name,
      ownerId: session.id,
    });
    setSaving(false);
    if (res.id) {
      setIsNewOpen(false);
      resetForm();
      toast.success("Deal added to the pipeline");
    } else {
      toast.error(res.error || "Could not create the deal");
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Panel className="flex items-center justify-between p-4">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-stone-500">
              Open pipeline
            </p>
            <p className="mt-1 text-2xl font-extrabold text-stone-900">{formatNaira(pipelineValue)}</p>
            <p className="text-[11px] font-semibold text-stone-500">
              {openDeals.length} active deal{openDeals.length === 1 ? "" : "s"}
            </p>
          </div>
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100">
            <Target className="h-5 w-5" />
          </span>
        </Panel>

        <Panel className="flex items-center justify-between p-4">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-stone-500">
              Weighted forecast
            </p>
            <p className="mt-1 text-2xl font-extrabold text-stone-900">{formatNaira(weighted)}</p>
            <p className="text-[11px] font-semibold text-stone-500">Probability adjusted</p>
          </div>
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700 ring-1 ring-amber-100">
            <TrendingUp className="h-5 w-5" />
          </span>
        </Panel>

        <Panel className="flex items-center justify-between p-4">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-stone-500">
              Won revenue
            </p>
            <p className="mt-1 text-2xl font-extrabold text-emerald-800">{formatNaira(wonValue)}</p>
            <p className="text-[11px] font-semibold text-stone-500">
              {deals.filter((d) => d.stage === "won").length} closed deal
              {deals.filter((d) => d.stage === "won").length === 1 ? "" : "s"}
            </p>
          </div>
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
            <Trophy className="h-5 w-5" />
          </span>
        </Panel>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-extrabold tracking-tight text-stone-900">Deal pipeline</h2>
          <p className="text-xs font-medium text-stone-500">
            Drag a card between stages — totals and forecasts update instantly.
          </p>
        </div>
        <Button
          onClick={() => setIsNewOpen(true)}
          className="h-9 gap-1.5 bg-emerald-800 text-xs font-bold text-white hover:bg-emerald-900"
        >
          <Plus className="h-4 w-4" /> New deal
        </Button>
      </div>

      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-3">
        {DEAL_STAGES.map((column) => {
          const columnDeals = byStage.get(column.id) ?? [];
          const total = columnDeals.reduce((sum, d) => sum + d.value, 0);
          const isOver = dragOver === column.id;
          return (
            <div
              key={column.id}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(column.id);
              }}
              onDragLeave={() => setDragOver((prev) => (prev === column.id ? null : prev))}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/plain") || draggingId;
                const deal = deals.find((d) => d.id === id);
                setDraggingId(null);
                setDragOver(null);
                if (deal) void move(deal, column.id);
              }}
              className={`flex w-[272px] shrink-0 flex-col rounded-2xl border bg-stone-50/80 transition ${
                isOver
                  ? "border-emerald-400 bg-emerald-50/70 ring-2 ring-emerald-200"
                  : "border-stone-200"
              }`}
            >
              <div className={`rounded-t-2xl border-t-4 bg-white px-3 py-2.5 ${column.accent}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${column.dot}`} />
                    <span className="text-xs font-extrabold text-stone-900">{column.label}</span>
                    <span className="rounded-full bg-stone-100 px-1.5 py-0.5 text-[10px] font-bold text-stone-600">
                      {columnDeals.length}
                    </span>
                  </div>
                  <span className="text-[10px] font-extrabold text-stone-500">{formatNaira(total)}</span>
                </div>
                <p className="mt-0.5 text-[10px] font-semibold text-stone-400">{column.hint}</p>
              </div>

              <div className="flex-1 space-y-2 p-2">
                {columnDeals.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-stone-200 px-3 py-6 text-center text-[11px] font-semibold text-stone-400">
                    Drop a deal here
                  </div>
                ) : (
                  columnDeals.map((deal) => (
                    <article
                      key={deal.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", deal.id);
                        setDraggingId(deal.id);
                      }}
                      onDragEnd={() => {
                        setDraggingId(null);
                        setDragOver(null);
                      }}
                      className={`group cursor-grab rounded-xl border border-stone-200 bg-white p-3 shadow-sm transition active:cursor-grabbing ${
                        draggingId === deal.id ? "opacity-50" : "hover:border-emerald-300 hover:shadow-md"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-extrabold leading-snug text-stone-900">
                          {deal.title}
                        </p>
                        <button
                          onClick={async () => {
                            const ok = await deleteCRMDeal(deal.id);
                            if (ok) toast.success("Deal deleted");
                            else toast.error("Could not delete deal");
                          }}
                          className="rounded p-1 text-stone-300 opacity-0 transition group-hover:opacity-100 hover:bg-rose-50 hover:text-rose-600"
                          aria-label="Delete deal"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>

                      <button
                        onClick={() => deal.leadId && onOpenLead(deal.leadId)}
                        className={`mt-1 flex items-center gap-1 text-[11px] font-bold ${
                          deal.leadId
                            ? "text-emerald-800 hover:underline"
                            : "text-stone-500"
                        }`}
                      >
                        <Building2 className="h-3 w-3" />
                        {deal.contactName}
                      </button>

                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-sm font-extrabold text-stone-900">
                          {formatNairaFull(deal.value)}
                        </span>
                        <span className="rounded-full bg-stone-100 px-1.5 py-0.5 text-[10px] font-extrabold text-stone-600">
                          {deal.probability}%
                        </span>
                      </div>

                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-stone-100">
                        <div
                          className={`h-full rounded-full ${
                            deal.stage === "won"
                              ? "bg-emerald-500"
                              : deal.stage === "lost"
                                ? "bg-rose-400"
                                : "bg-indigo-500"
                          }`}
                          style={{ width: `${Math.max(4, deal.probability)}%` }}
                        />
                      </div>

                      <div className="mt-2 flex items-center justify-between">
                        <span className="flex items-center gap-1 text-[10px] font-semibold text-stone-500">
                          <CalendarDays className="h-3 w-3" />
                          {deal.expectedCloseDate ? formatDate(deal.expectedCloseDate) : "No date"}
                        </span>
                        <div className="relative">
                          <select
                            value={deal.stage}
                            onChange={(e) => void move(deal, e.target.value as DealStage)}
                            className="h-6 cursor-pointer appearance-none rounded-md border border-stone-200 bg-stone-50 pl-2 pr-5 text-[10px] font-bold text-stone-700 outline-none"
                            aria-label="Change stage"
                          >
                            {DEAL_STAGES.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.label}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-1 top-1/2 h-3 w-3 -translate-y-1/2 text-stone-500" />
                        </div>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {deals.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<TrendingUp className="h-5 w-5" />}
            title="Your pipeline is empty"
            body="Create a deal from a lead, or hit “New deal” to track a live opportunity by value and stage."
            action={
              <Button
                onClick={() => setIsNewOpen(true)}
                className="h-9 gap-1.5 bg-emerald-800 text-xs font-bold text-white hover:bg-emerald-900"
              >
                <Plus className="h-4 w-4" /> New deal
              </Button>
            }
          />
        </Panel>
      ) : null}

      <Dialog open={isNewOpen} onOpenChange={setIsNewOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto border-stone-200 bg-white sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-stone-900">New deal</DialogTitle>
            <DialogDescription className="text-xs font-medium text-stone-500">
              Track a real opportunity. Value feeds the weighted forecast on Reports.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-[11px] font-extrabold uppercase tracking-wider text-stone-600">
                Deal name *
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Corporate bundle — 50 tickets"
                className={inputClass}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-extrabold uppercase tracking-wider text-stone-600">
                Link an existing lead
              </label>
              <select
                value={leadId}
                onChange={(e) => {
                  const id = e.target.value;
                  setLeadId(id);
                  const found = leads.find((l) => l.id === id);
                  if (found) {
                    setContactName(found.name);
                    setContactPhone(found.phone);
                    setContactEmail(found.email);
                    if (!title) setTitle(`${found.name} — Raffila entry bundle`);
                  }
                }}
                className={`${selectClass} h-10 w-full`}
              >
                <option value="">Not linked</option>
                {leads.slice(0, 200).map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} — {l.phone}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-[11px] font-extrabold uppercase tracking-wider text-stone-600">
                  Contact name *
                </label>
                <input
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Babatunde Adeleke"
                  className={inputClass}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-extrabold uppercase tracking-wider text-stone-600">
                  Phone
                </label>
                <input
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="+234 803 000 0000"
                  className={`${inputClass} font-mono`}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <label className="text-[11px] font-extrabold uppercase tracking-wider text-stone-600">
                  Value (₦)
                </label>
                <input
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  inputMode="numeric"
                  placeholder="250000"
                  className={inputClass}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-extrabold uppercase tracking-wider text-stone-600">
                  Stage
                </label>
                <select
                  value={stage}
                  onChange={(e) => setStage(e.target.value as DealStage)}
                  className={`${selectClass} h-9 w-full`}
                >
                  {DEAL_STAGES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label} ({STAGE_PROBABILITY[s.id]}%)
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-extrabold uppercase tracking-wider text-stone-600">
                  Expected close
                </label>
                <input
                  type="date"
                  value={closeDate}
                  onChange={(e) => setCloseDate(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-extrabold uppercase tracking-wider text-stone-600">
                Notes
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="What has to happen to close this?"
                className={`${inputClass} h-auto py-2`}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsNewOpen(false)} className="h-9 text-xs">
              Cancel
            </Button>
            <Button
              onClick={() => void handleCreate()}
              disabled={saving}
              className="h-9 gap-1.5 bg-emerald-800 text-xs font-bold text-white hover:bg-emerald-900"
            >
              <Plus className="h-3.5 w-3.5" />
              {saving ? "Saving…" : "Create deal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

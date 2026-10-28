import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock,
  Mail,
  MapPin,
  MessageSquare,
  PhoneCall,
  Plus,
  StickyNote,
  Target,
  Trash2,
  TrendingUp,
  Trophy,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  assignCRMLead,
  createCRMDeal,
  createCRMNote,
  createCRMTask,
  deleteCRMNote,
  deleteCRMTask,
  updateCRMDeal,
  updateCRMTask,
  updateCRMLeadStatus,
  DEAL_STAGES,
  computeLeadScore,
  type CRMActivity,
  type CRMDeal,
  type CRMLead,
  type CRMNote,
  type CRMTask,
  type DealStage,
  type LeadStatus,
  type StaffMember,
} from "@/lib/crm-service";
import {
  EmptyState,
  LeadAvatar,
  LeadStatusPill,
  OutcomePill,
  Panel,
  PriorityPill,
  ScorePill,
  StagePill,
  dueLabel,
  formatDateTime,
  formatNaira,
  formatNairaFull,
  inputClass,
  relativeTime,
  selectClass,
  textareaClass,
} from "./crm-ui";

const LEAD_STATUSES: LeadStatus[] = [
  "new",
  "contacted",
  "qualified",
  "hot",
  "warm",
  "converted",
  "lost",
  "unresponsive",
];

type Tab = "timeline" | "notes" | "deals" | "tasks";

export function LeadDetailSheet({
  lead,
  open,
  onOpenChange,
  activities,
  notes,
  deals,
  tasks,
  session,
  onLogCall,
}: {
  lead: CRMLead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activities: CRMActivity[];
  notes: CRMNote[];
  deals: CRMDeal[];
  tasks: CRMTask[];
  session: StaffMember;
  onLogCall: (lead: CRMLead) => void;
}) {
  const [tab, setTab] = useState<Tab>("timeline");
  const [noteBody, setNoteBody] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDue, setTaskDue] = useState("");
  const [savingTask, setSavingTask] = useState(false);
  const [dealTitle, setDealTitle] = useState("");
  const [dealValue, setDealValue] = useState("");
  const [dealStage, setDealStage] = useState<DealStage>("new");
  const [savingDeal, setSavingDeal] = useState(false);
  const [status, setStatus] = useState<LeadStatus>("new");

  useEffect(() => {
    if (lead) setStatus(lead.status);
    setTab("timeline");
    setNoteBody("");
    setTaskTitle("");
    setTaskDue("");
    setDealTitle("");
    setDealValue("");
    setDealStage("new");
  }, [lead]);

  const leadCalls = useMemo(() => {
    if (!lead) return [];
    return activities.filter(
      (a) =>
        (lead.id && a.leadId === lead.id) ||
        (lead.phone && a.clientPhone === lead.phone) ||
        (lead.email && a.clientEmail === lead.email),
    );
  }, [activities, lead]);

  const leadNotes = useMemo(
    () => (lead ? notes.filter((n) => n.leadId === lead.id) : []),
    [notes, lead],
  );
  const leadDeals = useMemo(
    () =>
      lead
        ? deals.filter((d) => d.leadId === lead.id || d.contactPhone === lead.phone)
        : [],
    [deals, lead],
  );
  const leadTasks = useMemo(
    () =>
      lead
        ? tasks.filter((t) => t.leadId === lead.id || t.contactName === lead.name)
        : [],
    [tasks, lead],
  );

  const score = lead ? computeLeadScore(lead, activities) : null;

  const timeline = useMemo(() => {
    type Entry = {
      id: string;
      at: string;
      icon: React.ReactNode;
      title: string;
      body?: string | undefined;
      meta?: React.ReactNode | undefined;
    };
    const entries: Entry[] = [];
    leadCalls.forEach((c) =>
      entries.push({
        id: `call-${c.id}`,
        at: c.createdAt,
        icon: <PhoneCall className="h-3.5 w-3.5" />,
        title: `Call • ${c.callDuration}`,
        body: c.notes,
        meta: <OutcomePill outcome={c.outcome} />,
      }),
    );
    leadNotes.forEach((n) =>
      entries.push({
        id: `note-${n.id}`,
        at: n.createdAt,
        icon: <StickyNote className="h-3.5 w-3.5" />,
        title: `Note by ${n.authorName}`,
        body: n.body,
      }),
    );
    leadDeals.forEach((d) =>
      entries.push({
        id: `deal-${d.id}`,
        at: d.updatedAt || d.createdAt,
        icon: <TrendingUp className="h-3.5 w-3.5" />,
        title: `Deal • ${d.title}`,
        body: `${formatNairaFull(d.value)} • ${d.probability}% weighted`,
        meta: <StagePill stage={d.stage} />,
      }),
    );
    leadTasks.forEach((t) =>
      entries.push({
        id: `task-${t.id}`,
        at: t.completedAt || t.createdAt,
        icon: t.status === "done" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />,
        title: `Task • ${t.title}`,
        body: t.description,
        meta: <PriorityPill priority={t.priority} />,
      }),
    );
    return entries
      .filter((e) => e.at)
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [leadCalls, leadNotes, leadDeals, leadTasks]);

  if (!lead) return null;

  const openDealValue = leadDeals
    .filter((d) => d.stage !== "won" && d.stage !== "lost")
    .reduce((sum, d) => sum + d.value, 0);

  const changeStatus = async (next: LeadStatus) => {
    setStatus(next);
    const res = await updateCRMLeadStatus(lead.id, next);
    if (res.success) toast.success(`Status updated to ${next}`);
    else toast.error(res.error || "Could not update status");
  };

  const saveNote = async () => {
    if (!noteBody.trim()) return;
    setSavingNote(true);
    const res = await createCRMNote({
      leadId: lead.id,
      contactName: lead.name,
      body: noteBody.trim(),
      authorName: session.name,
      authorId: session.id,
    });
    setSavingNote(false);
    if (res.id) {
      setNoteBody("");
      toast.success("Note added to the timeline");
    } else {
      toast.error(res.error || "Could not save note");
    }
  };

  const saveTask = async () => {
    if (!taskTitle.trim() || !taskDue) {
      toast.error("Add a title and a due date");
      return;
    }
    setSavingTask(true);
    const res = await createCRMTask({
      title: taskTitle.trim(),
      leadId: lead.id,
      contactName: lead.name,
      dueDate: new Date(taskDue).toISOString(),
      priority: "medium",
      ownerName: session.name,
      ownerId: session.id,
    });
    setSavingTask(false);
    if (res.id) {
      setTaskTitle("");
      setTaskDue("");
      toast.success("Follow-up task created");
    } else {
      toast.error(res.error || "Could not create task");
    }
  };

  const saveDeal = async () => {
    if (!dealTitle.trim()) {
      toast.error("Give the deal a name");
      return;
    }
    setSavingDeal(true);
    const res = await createCRMDeal({
      title: dealTitle.trim(),
      leadId: lead.id,
      contactName: lead.name,
      contactEmail: lead.email,
      contactPhone: lead.phone,
      value: Number(dealValue.replace(/[^0-9.]/g, "")) || 0,
      stage: dealStage,
      ownerName: session.name,
      ownerId: session.id,
    });
    setSavingDeal(false);
    if (res.id) {
      setDealTitle("");
      setDealValue("");
      setDealStage("new");
      toast.success("Deal added to the pipeline");
    } else {
      toast.error(res.error || "Could not create deal");
    }
  };

  const tabs: Array<{ id: Tab; label: string; count?: number }> = [
    { id: "timeline", label: "Timeline", count: timeline.length },
    { id: "notes", label: "Notes", count: leadNotes.length },
    { id: "deals", label: "Deals", count: leadDeals.length },
    { id: "tasks", label: "Tasks", count: leadTasks.filter((t) => t.status === "open").length },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto border-l border-stone-200 bg-[#F7F7F4] p-0 sm:max-w-xl"
      >
        <SheetHeader className="border-b border-stone-200 bg-white px-5 py-4 text-left">
          <div className="flex items-start gap-3">
            <LeadAvatar name={lead.name} size="lg" band={score?.band} />
            <div className="min-w-0 flex-1">
              <SheetTitle className="truncate text-lg font-extrabold text-stone-900">
                {lead.name}
              </SheetTitle>
              <SheetDescription className="mt-0.5 flex flex-wrap items-center gap-2 text-xs font-semibold text-stone-500">
                <LeadStatusPill status={status} />
                {score ? <ScorePill score={score.score} band={score.band} /> : null}
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {lead.location}
                </span>
              </SheetDescription>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <a
              href={`tel:${lead.phone.replace(/\s+/g, "")}`}
              className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-bold text-stone-800 transition hover:border-emerald-300 hover:bg-emerald-50"
            >
              <PhoneCall className="h-4 w-4 text-emerald-700" />
              <span className="truncate font-mono">{lead.phone}</span>
            </a>
            <a
              href={
                lead.email
                  ? `mailto:${lead.email}`
                  : `https://wa.me/${lead.phone.replace(/[^0-9]/g, "")}`
              }
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-bold text-stone-800 transition hover:border-emerald-300 hover:bg-emerald-50"
            >
              {lead.email ? (
                <Mail className="h-4 w-4 text-emerald-700" />
              ) : (
                <MessageSquare className="h-4 w-4 text-emerald-700" />
              )}
              <span className="truncate">{lead.email || "WhatsApp"}</span>
            </a>
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => onLogCall(lead)}
              className="h-8 gap-1.5 bg-emerald-800 text-xs font-bold text-white hover:bg-emerald-900"
            >
              <PhoneCall className="h-3.5 w-3.5" /> Log call
            </Button>
            <select
              value={status}
              onChange={(e) => void changeStatus(e.target.value as LeadStatus)}
              className={`${selectClass} h-8`}
            >
              {LEAD_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <a
              href={`https://wa.me/${lead.phone.replace(/[^0-9]/g, "")}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-stone-200 bg-white px-2.5 text-[11px] font-bold text-stone-700 transition hover:bg-stone-50"
            >
              <MessageSquare className="h-3.5 w-3.5 text-emerald-700" /> WhatsApp
            </a>
          </div>
        </SheetHeader>

        <div className="space-y-4 px-5 py-4">
          <div className="grid grid-cols-2 gap-2">
            <MiniStat
              icon={<Trophy className="h-3.5 w-3.5" />}
              label="Tickets"
              value={String(lead.ticketsBought)}
            />
            <MiniStat
              icon={<TrendingUp className="h-3.5 w-3.5" />}
              label="Lifetime"
              value={formatNaira(lead.totalSpent)}
            />
            <MiniStat
              icon={<PhoneCall className="h-3.5 w-3.5" />}
              label="Calls"
              value={String(leadCalls.length)}
            />
            <MiniStat
              icon={<Target className="h-3.5 w-3.5" />}
              label="Open deals"
              value={openDealValue ? formatNaira(openDealValue) : "—"}
            />
          </div>

          {score && score.reasons.length ? (
            <Panel className="p-3">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-stone-500">
                Why this score
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {score.reasons.map((r) => (
                  <span
                    key={r}
                    className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-bold text-stone-700 ring-1 ring-stone-200"
                  >
                    {r}
                  </span>
                ))}
              </div>
            </Panel>
          ) : null}

          <div className="flex gap-1 rounded-xl border border-stone-200 bg-white p-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 rounded-lg px-2 py-1.5 text-[11px] font-extrabold transition ${
                  tab === t.id
                    ? "bg-emerald-800 text-white shadow-sm"
                    : "text-stone-600 hover:bg-stone-100"
                }`}
              >
                {t.label}
                {typeof t.count === "number" ? (
                  <span className={tab === t.id ? "ml-1 opacity-80" : "ml-1 text-stone-400"}>
                    {t.count}
                  </span>
                ) : null}
              </button>
            ))}
          </div>

          {tab === "timeline" ? (
            <Panel className="overflow-hidden">
              {timeline.length === 0 ? (
                <EmptyState
                  icon={<Clock className="h-5 w-5" />}
                  title="No history yet"
                  body="Log a call or add a note — everything shows up here in order."
                />
              ) : (
                <ol className="divide-y divide-stone-100">
                  {timeline.map((entry) => (
                    <li key={entry.id} className="flex gap-3 px-4 py-3">
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-stone-100 text-stone-600">
                        {entry.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs font-extrabold text-stone-900">{entry.title}</p>
                          <span className="text-[10px] font-semibold text-stone-400">
                            {formatDateTime(entry.at)}
                          </span>
                        </div>
                        {entry.body ? (
                          <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-stone-600">
                            {entry.body}
                          </p>
                        ) : null}
                        {entry.meta ? <div className="mt-1.5">{entry.meta}</div> : null}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </Panel>
          ) : null}

          {tab === "notes" ? (
            <div className="space-y-3">
              <Panel className="p-3">
                <textarea
                  rows={3}
                  value={noteBody}
                  onChange={(e) => setNoteBody(e.target.value)}
                  placeholder="Log what you learned: budget, prize preference, objections, best time to call…"
                  className={textareaClass}
                />
                <div className="mt-2 flex justify-end">
                  <Button
                    size="sm"
                    onClick={() => void saveNote()}
                    disabled={savingNote || !noteBody.trim()}
                    className="h-8 gap-1.5 bg-emerald-800 text-xs font-bold text-white hover:bg-emerald-900"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {savingNote ? "Saving…" : "Add note"}
                  </Button>
                </div>
              </Panel>

              {leadNotes.length === 0 ? (
                <Panel>
                  <EmptyState
                    icon={<StickyNote className="h-5 w-5" />}
                    title="No notes on this lead"
                    body="Notes are shared with the whole team and appear in the timeline."
                  />
                </Panel>
              ) : (
                <div className="space-y-2">
                  {leadNotes.map((note) => (
                    <Panel key={note.id} className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[11px] font-extrabold text-stone-900">
                          {note.authorName}
                          <span className="ml-2 font-semibold text-stone-400">
                            {relativeTime(note.createdAt)}
                          </span>
                        </p>
                        <button
                          onClick={async () => {
                            const ok = await deleteCRMNote(note.id);
                            if (ok) toast.success("Note deleted");
                          }}
                          className="rounded p-1 text-stone-400 transition hover:bg-rose-50 hover:text-rose-600"
                          aria-label="Delete note"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-stone-700">
                        {note.body}
                      </p>
                    </Panel>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {tab === "deals" ? (
            <div className="space-y-3">
              <Panel className="space-y-2 p-3">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-stone-500">
                  New deal for {lead.name.split(" ")[0]}
                </p>
                <input
                  value={dealTitle}
                  onChange={(e) => setDealTitle(e.target.value)}
                  placeholder="e.g. 20-ticket bundle — flagship draw"
                  className={inputClass}
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={dealValue}
                    onChange={(e) => setDealValue(e.target.value)}
                    placeholder="Value (₦)"
                    inputMode="numeric"
                    className={inputClass}
                  />
                  <select
                    value={dealStage}
                    onChange={(e) => setDealStage(e.target.value as DealStage)}
                    className={`${selectClass} w-full`}
                  >
                    {DEAL_STAGES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={() => void saveDeal()}
                    disabled={savingDeal || !dealTitle.trim()}
                    className="h-8 gap-1.5 bg-emerald-800 text-xs font-bold text-white hover:bg-emerald-900"
                  >
                    <Building2 className="h-3.5 w-3.5" />
                    {savingDeal ? "Saving…" : "Add deal"}
                  </Button>
                </div>
              </Panel>

              {leadDeals.length === 0 ? (
                <Panel>
                  <EmptyState
                    icon={<TrendingUp className="h-5 w-5" />}
                    title="No deals yet"
                    body="Create a deal to track value and stage for this contact."
                  />
                </Panel>
              ) : (
                <div className="space-y-2">
                  {leadDeals.map((deal) => (
                    <Panel key={deal.id} className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-extrabold text-stone-900">{deal.title}</p>
                          <p className="mt-0.5 text-[11px] font-semibold text-stone-500">
                            {formatNairaFull(deal.value)} • updated {relativeTime(deal.updatedAt)}
                          </p>
                        </div>
                        <StagePill stage={deal.stage} />
                      </div>
                      <select
                        value={deal.stage}
                        onChange={async (e) => {
                          const stage = e.target.value as DealStage;
                          const res = await updateCRMDeal(deal.id, { stage });
                          if (res.success) toast.success(`Moved to ${stage}`);
                        }}
                        className={`${selectClass} mt-2 h-8 w-full`}
                      >
                        {DEAL_STAGES.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </Panel>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {tab === "tasks" ? (
            <div className="space-y-3">
              <Panel className="space-y-2 p-3">
                <input
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="Follow-up task, e.g. Call back about payment"
                  className={inputClass}
                />
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={taskDue}
                    onChange={(e) => setTaskDue(e.target.value)}
                    className={inputClass}
                  />
                  <Button
                    size="sm"
                    onClick={() => void saveTask()}
                    disabled={savingTask || !taskTitle.trim() || !taskDue}
                    className="h-9 shrink-0 gap-1.5 bg-emerald-800 text-xs font-bold text-white hover:bg-emerald-900"
                  >
                    <CalendarClock className="h-3.5 w-3.5" />
                    {savingTask ? "Saving…" : "Add task"}
                  </Button>
                </div>
              </Panel>

              {leadTasks.length === 0 ? (
                <Panel>
                  <EmptyState
                    icon={<ClipboardList className="h-5 w-5" />}
                    title="No tasks for this lead"
                    body="Set a follow-up so nothing slips through the cracks."
                  />
                </Panel>
              ) : (
                <div className="space-y-2">
                  {leadTasks.map((task) => {
                    const due = dueLabel(task.dueDate);
                    return (
                      <Panel key={task.id} className="flex items-start gap-2 p-3">
                        <button
                          onClick={async () => {
                            await updateCRMTask(task.id, {
                              status: task.status === "done" ? "open" : "done",
                            });
                          }}
                          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                            task.status === "done"
                              ? "border-emerald-600 bg-emerald-600 text-white"
                              : "border-stone-300 bg-white"
                          }`}
                          aria-label="Toggle task"
                        >
                          {task.status === "done" ? <CheckCircle2 className="h-3 w-3" /> : null}
                        </button>
                        <div className="min-w-0 flex-1">
                          <p
                            className={`text-xs font-bold ${
                              task.status === "done"
                                ? "text-stone-400 line-through"
                                : "text-stone-900"
                            }`}
                          >
                            {task.title}
                          </p>
                          <p className={`text-[10px] ${due.tone}`}>{due.label}</p>
                        </div>
                        <button
                          onClick={async () => {
                            await deleteCRMTask(task.id);
                            toast.success("Task removed");
                          }}
                          className="rounded p-1 text-stone-400 transition hover:bg-rose-50 hover:text-rose-600"
                          aria-label="Delete task"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </Panel>
                    );
                  })}
                </div>
              )}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2">
            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-stone-500">
              <UserRound className="h-3.5 w-3.5" /> Owner
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-extrabold text-stone-800">
                {lead.assignedTo || "Unassigned"}
              </span>
              {!lead.assignedTo ? (
                <button
                  onClick={async () => {
                    const ok = await assignCRMLead(lead.id, session.name);
                    if (ok) toast.success(`Assigned to ${session.name}`);
                    else toast.error("Could not assign this lead");
                  }}
                  className="rounded-md bg-emerald-800 px-2 py-1 text-[10px] font-extrabold text-white transition hover:bg-emerald-900"
                >
                  Assign to me
                </button>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
              Source • joined
            </span>
            <span className="text-[11px] font-extrabold text-stone-800">
              <span className="capitalize">{lead.source || "organic"}</span> •{" "}
              {formatDateTime(lead.joinedAt)}
            </span>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function MiniStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white px-2.5 py-2">
      <div className="flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-wider text-stone-500">
        <span className="text-emerald-700">{icon}</span>
        {label}
      </div>
      <p className="mt-0.5 truncate text-sm font-extrabold text-stone-900">{value}</p>
    </div>
  );
}

import { useMemo, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  Circle,
  ClipboardList,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  createCRMTask,
  deleteCRMTask,
  updateCRMTask,
  type CRMLead,
  type CRMTask,
  type StaffMember,
  type TaskPriority,
} from "@/lib/crm-service";
import {
  EmptyState,
  Panel,
  PriorityPill,
  dueLabel,
  formatDate,
  inputClass,
  relativeTime,
  selectClass,
} from "./crm-ui";

type Filter = "open" | "today" | "overdue" | "done";

export function TasksPanel({
  tasks,
  leads,
  session,
}: {
  tasks: CRMTask[];
  leads: CRMLead[];
  session: StaffMember;
}) {
  const [filter, setFilter] = useState<Filter>("open");
  const [title, setTitle] = useState("");
  const [leadId, setLeadId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [saving, setSaving] = useState(false);

  const counts = useMemo(() => {
    const now = Date.now();
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = startOfDay.getTime() + 86400000;
    const open = tasks.filter((t) => t.status === "open");
    return {
      open: open.length,
      today: open.filter((t) => {
        const d = new Date(t.dueDate).getTime();
        return !Number.isNaN(d) && d >= startOfDay.getTime() && d < endOfDay;
      }).length,
      overdue: open.filter((t) => {
        const d = new Date(t.dueDate).getTime();
        return !Number.isNaN(d) && d < startOfDay.getTime() && d <= now;
      }).length,
      done: tasks.filter((t) => t.status === "done").length,
    };
  }, [tasks]);

  const visible = useMemo(() => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = startOfDay.getTime() + 86400000;
    return tasks.filter((t) => {
      if (filter === "done") return t.status === "done";
      if (t.status !== "open") return false;
      const d = new Date(t.dueDate).getTime();
      if (filter === "today") return !Number.isNaN(d) && d >= startOfDay.getTime() && d < endOfDay;
      if (filter === "overdue") return !Number.isNaN(d) && d < startOfDay.getTime();
      return true;
    });
  }, [tasks, filter]);

  const grouped = useMemo(() => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfWeek = startOfDay.getTime() + 7 * 86400000;
    const groups = {
      overdue: { key: "overdue", label: "Overdue", items: [] as CRMTask[] },
      today: { key: "today", label: "Today", items: [] as CRMTask[] },
      week: { key: "week", label: "This week", items: [] as CRMTask[] },
      later: { key: "later", label: "Later", items: [] as CRMTask[] },
      done: { key: "done", label: "Completed", items: [] as CRMTask[] },
    };
    visible.forEach((t) => {
      if (t.status === "done") {
        groups.done.items.push(t);
        return;
      }
      const d = new Date(t.dueDate).getTime();
      if (Number.isNaN(d)) groups.later.items.push(t);
      else if (d < startOfDay.getTime()) groups.overdue.items.push(t);
      else if (d < startOfDay.getTime() + 86400000) groups.today.items.push(t);
      else if (d < endOfWeek) groups.week.items.push(t);
      else groups.later.items.push(t);
    });
    return Object.values(groups).filter((g) => g.items.length > 0);
  }, [visible]);

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error("Give the task a title");
      return;
    }
    if (!dueDate) {
      toast.error("Pick a due date");
      return;
    }
    setSaving(true);
    const lead = leads.find((l) => l.id === leadId);
    const res = await createCRMTask({
      title: title.trim(),
      ...(lead ? { leadId: lead.id, contactName: lead.name } : {}),
      dueDate: new Date(dueDate).toISOString(),
      priority,
      ownerName: session.name,
      ownerId: session.id,
    });
    setSaving(false);
    if (res.id) {
      setTitle("");
      setLeadId("");
      setDueDate("");
      setPriority("medium");
      toast.success("Task added");
    } else {
      toast.error(res.error || "Could not create the task");
    }
  };

  const chips: Array<{ id: Filter; label: string; count: number; tone: string }> = [
    { id: "open", label: "All open", count: counts.open, tone: "bg-emerald-800" },
    { id: "today", label: "Due today", count: counts.today, tone: "bg-amber-500" },
    { id: "overdue", label: "Overdue", count: counts.overdue, tone: "bg-rose-600" },
    { id: "done", label: "Completed", count: counts.done, tone: "bg-stone-600" },
  ];

  return (
    <div className="space-y-4">
      <Panel className="p-4">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[220px] flex-1">
            <label className="mb-1 block text-[11px] font-extrabold uppercase tracking-wider text-stone-600">
              New task / reminder
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Call back about payment link"
              className={`${inputClass} h-10`}
            />
          </div>
          <div className="w-[190px]">
            <label className="mb-1 block text-[11px] font-extrabold uppercase tracking-wider text-stone-600">
              Related lead
            </label>
            <select
              value={leadId}
              onChange={(e) => setLeadId(e.target.value)}
              className={`${selectClass} h-10 w-full`}
            >
              <option value="">Standalone task</option>
              {leads.slice(0, 200).map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
          <div className="w-[150px]">
            <label className="mb-1 block text-[11px] font-extrabold uppercase tracking-wider text-stone-600">
              Due
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={`${inputClass} h-10`}
            />
          </div>
          <div className="w-[120px]">
            <label className="mb-1 block text-[11px] font-extrabold uppercase tracking-wider text-stone-600">
              Priority
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
              className={`${selectClass} h-10 w-full`}
            >
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <Button
            onClick={() => void handleCreate()}
            disabled={saving}
            className="h-10 gap-1.5 bg-emerald-800 text-xs font-bold text-white hover:bg-emerald-900"
          >
            <Plus className="h-4 w-4" />
            {saving ? "Adding…" : "Add task"}
          </Button>
        </div>
      </Panel>

      <div className="flex flex-wrap gap-2">
        {chips.map((chip) => (
          <button
            key={chip.id}
            onClick={() => setFilter(chip.id)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-extrabold transition ${
              filter === chip.id
                ? `${chip.tone} text-white shadow-sm`
                : "border border-stone-200 bg-white text-stone-700 hover:bg-stone-50"
            }`}
          >
            {chip.label}
            <span
              className={`rounded-full px-1.5 text-[10px] ${
                filter === chip.id ? "bg-white/20" : "bg-stone-100 text-stone-600"
              }`}
            >
              {chip.count}
            </span>
          </button>
        ))}
      </div>

      {grouped.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<ClipboardList className="h-5 w-5" />}
            title={filter === "done" ? "Nothing completed yet" : "You're all caught up"}
            body="Follow-up tasks keep leads warm. Add one above, or log a call with a follow-up date and the task is created automatically."
          />
        </Panel>
      ) : (
        <div className="space-y-3">
          {grouped.map((group) => (
            <div key={group.key}>
              <p className="mb-1.5 flex items-center gap-2 px-1 text-[11px] font-extrabold uppercase tracking-wider text-stone-500">
                {group.label}
                <span className="rounded-full bg-stone-200 px-1.5 text-[10px] text-stone-700">
                  {group.items.length}
                </span>
              </p>
              <Panel className="divide-y divide-stone-100">
                {group.items.map((task) => {
                  const due = dueLabel(task.dueDate);
                  const done = task.status === "done";
                  return (
                    <div
                      key={task.id}
                      className="flex items-start gap-3 px-4 py-3 transition hover:bg-stone-50/70"
                    >
                      <button
                        onClick={async () => {
                          const res = await updateCRMTask(task.id, {
                            status: done ? "open" : "done",
                          });
                          if (res.success) {
                            toast.success(done ? "Task reopened" : "Task completed");
                          }
                        }}
                        className="mt-0.5 shrink-0 text-stone-400 transition hover:text-emerald-700"
                        aria-label={done ? "Reopen task" : "Complete task"}
                      >
                        {done ? (
                          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                        ) : (
                          <Circle className="h-5 w-5" />
                        )}
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p
                            className={`text-[13px] font-bold ${
                              done ? "text-stone-400 line-through" : "text-stone-900"
                            }`}
                          >
                            {task.title}
                          </p>
                          <PriorityPill priority={task.priority} />
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold">
                          <span className={`inline-flex items-center gap-1 ${due.tone}`}>
                            <CalendarClock className="h-3 w-3" />
                            {due.label}
                          </span>
                          {task.contactName ? (
                            <span className="text-stone-600">{task.contactName}</span>
                          ) : null}
                          <span className="text-stone-400">
                            created {relativeTime(task.createdAt)}
                          </span>
                          {task.dueDate ? (
                            <span className="text-stone-400">{formatDate(task.dueDate)}</span>
                          ) : null}
                        </div>
                      </div>

                      <button
                        onClick={async () => {
                          const ok = await deleteCRMTask(task.id);
                          if (ok) toast.success("Task deleted");
                        }}
                        className="rounded p-1.5 text-stone-400 transition hover:bg-rose-50 hover:text-rose-600"
                        aria-label="Delete task"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </Panel>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

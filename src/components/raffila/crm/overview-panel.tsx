import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Flame,
  PhoneCall,
  Target,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DEAL_STAGES,
  computeLeadScore,
  type CRMActivity,
  type CRMDeal,
  type CRMLead,
  type CRMTask,
  type StaffMember,
} from "@/lib/crm-service";
import {
  EmptyState,
  LeadAvatar,
  LeadStatusPill,
  OutcomePill,
  Panel,
  PanelHeader,
  ScorePill,
  StatCard,
  dueLabel,
  formatNaira,
  relativeTime,
} from "./crm-ui";

export function OverviewPanel({
  leads,
  activities,
  deals,
  tasks,
  session,
  onOpenLead,
  onLogCall,
  onNavigate,
}: {
  leads: CRMLead[];
  activities: CRMActivity[];
  deals: CRMDeal[];
  tasks: CRMTask[];
  session: StaffMember;
  onOpenLead: (lead: CRMLead) => void;
  onLogCall: () => void;
  onNavigate: (tab: "leads" | "pipeline" | "tasks" | "reports" | "activity") => void;
}) {
  const scored = useMemo(
    () =>
      leads
        .map((lead) => ({ lead, score: computeLeadScore(lead, activities) }))
        .sort((a, b) => b.score.score - a.score.score),
    [leads, activities],
  );

  const openDeals = deals.filter((d) => d.stage !== "won" && d.stage !== "lost");
  const pipelineValue = openDeals.reduce((s, d) => s + d.value, 0);
  const weighted = openDeals.reduce((s, d) => s + (d.value * d.probability) / 100, 0);
  const wonValue = deals.filter((d) => d.stage === "won").reduce((s, d) => s + d.value, 0);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const callsToday = activities.filter(
    (a) => new Date(a.createdAt).getTime() >= startOfToday.getTime(),
  ).length;
  const openTasks = tasks.filter((t) => t.status === "open");
  const dueToday = openTasks.filter((t) => {
    const d = new Date(t.dueDate).getTime();
    return !Number.isNaN(d) && d < startOfToday.getTime() + 86400000;
  });
  const overdue = openTasks.filter((t) => {
    const d = new Date(t.dueDate).getTime();
    return !Number.isNaN(d) && d < startOfToday.getTime();
  });

  const series = useMemo(() => {
    const days: Array<{ label: string; calls: number; conversions: number }> = [];
    for (let i = 13; i >= 0; i -= 1) {
      const day = new Date();
      day.setHours(0, 0, 0, 0);
      day.setDate(day.getDate() - i);
      const next = new Date(day.getTime() + 86400000);
      const dayCalls = activities.filter((a) => {
        const t = new Date(a.createdAt).getTime();
        return t >= day.getTime() && t < next.getTime();
      });
      days.push({
        label: day.toLocaleDateString("en-NG", { month: "short", day: "numeric" }),
        calls: dayCalls.length,
        conversions: dayCalls.filter((c) => c.outcome === "converted").length,
      });
    }
    return days;
  }, [activities]);

  const stageTotals = DEAL_STAGES.map((stage) => {
    const items = deals.filter((d) => d.stage === stage.id);
    return {
      ...stage,
      count: items.length,
      value: items.reduce((s, d) => s + d.value, 0),
    };
  });
  const maxStageValue = Math.max(1, ...stageTotals.map((s) => s.value));

  const hotLeads = scored.filter((s) => s.score.band === "hot").slice(0, 6);
  const recent = activities.slice(0, 6);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Open pipeline"
          value={formatNaira(pipelineValue)}
          hint={`${openDeals.length} live deals • ${formatNaira(weighted)} weighted`}
          icon={<Target className="h-4 w-4" />}
          tone="indigo"
        />
        <StatCard
          label="Hot prospects"
          value={String(scored.filter((s) => s.score.band === "hot").length)}
          hint={`${leads.length} total leads in directory`}
          icon={<Flame className="h-4 w-4" />}
          tone="rose"
        />
        <StatCard
          label="Calls today"
          value={String(callsToday)}
          hint={`${activities.length} logged all-time`}
          icon={<PhoneCall className="h-4 w-4" />}
          tone="emerald"
        />
        <StatCard
          label="Tasks to action"
          value={String(dueToday.length)}
          hint={
            overdue.length
              ? `${overdue.length} overdue — don't lose these`
              : "Nothing overdue, nice work"
          }
          icon={<CalendarClock className="h-4 w-4" />}
          tone={overdue.length ? "rose" : "amber"}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Panel className="xl:col-span-2">
          <PanelHeader
            title="Call activity — last 14 days"
            subtitle="Every logged call and conversion across the team"
            icon={<TrendingUp className="h-4 w-4" />}
            action={
              <Button
                onClick={onLogCall}
                size="sm"
                className="h-8 gap-1.5 bg-emerald-800 text-xs font-bold text-white hover:bg-emerald-900"
              >
                <PhoneCall className="h-3.5 w-3.5" /> Log call
              </Button>
            }
          />
          <div className="h-[220px] px-2 py-3">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="callsFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#047857" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#047857" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="convFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: "#78716c", fontWeight: 600 }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 10, fill: "#78716c", fontWeight: 600 }}
                  tickLine={false}
                  axisLine={false}
                  width={32}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid #e7e5e4",
                    fontSize: 11,
                    fontWeight: 600,
                    boxShadow: "0 12px 32px -16px rgba(16,24,40,0.35)",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="calls"
                  name="Calls"
                  stroke="#047857"
                  strokeWidth={2.5}
                  fill="url(#callsFill)"
                />
                <Area
                  type="monotone"
                  dataKey="conversions"
                  name="Conversions"
                  stroke="#d97706"
                  strokeWidth={2}
                  fill="url(#convFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            title="Pipeline by stage"
            subtitle={`${formatNaira(wonValue)} won to date`}
            icon={<Trophy className="h-4 w-4" />}
            action={
              <button
                onClick={() => onNavigate("pipeline")}
                className="flex items-center gap-1 text-[11px] font-extrabold text-emerald-800 hover:underline"
              >
                Board <ArrowRight className="h-3 w-3" />
              </button>
            }
          />
          <div className="space-y-2.5 px-4 py-4">
            {stageTotals.map((stage) => (
              <div key={stage.id}>
                <div className="mb-1 flex items-center justify-between text-[11px] font-bold">
                  <span className="flex items-center gap-1.5 text-stone-700">
                    <span className={`h-1.5 w-1.5 rounded-full ${stage.dot}`} />
                    {stage.label}
                    <span className="text-stone-400">({stage.count})</span>
                  </span>
                  <span className="text-stone-800">{formatNaira(stage.value)}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-stone-100">
                  <div
                    className={`h-full rounded-full ${stage.dot}`}
                    style={{ width: `${Math.max(3, (stage.value / maxStageValue) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Panel className="xl:col-span-2">
          <PanelHeader
            title="Hot prospects — call these first"
            subtitle="Ranked by spend, ticket history, recency and call engagement"
            icon={<Flame className="h-4 w-4" />}
            action={
              <button
                onClick={() => onNavigate("leads")}
                className="flex items-center gap-1 text-[11px] font-extrabold text-emerald-800 hover:underline"
              >
                All leads <ArrowRight className="h-3 w-3" />
              </button>
            }
          />
          {hotLeads.length === 0 ? (
            <EmptyState
              icon={<Users className="h-5 w-5" />}
              title="No hot prospects yet"
              body="Log calls and qualify leads — scores update automatically as engagement builds."
            />
          ) : (
            <ul className="divide-y divide-stone-100">
              {hotLeads.map(({ lead, score }) => (
                <li key={lead.id}>
                  <button
                    onClick={() => onOpenLead(lead)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-emerald-50/50"
                  >
                    <LeadAvatar name={lead.name} band={score.band} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-[13px] font-extrabold text-stone-900">
                          {lead.name}
                        </p>
                        <LeadStatusPill status={lead.status} />
                        <ScorePill score={score.score} band={score.band} />
                      </div>
                      <p className="mt-0.5 truncate text-[11px] font-semibold text-stone-500">
                        {lead.ticketsBought} tickets • {formatNaira(lead.totalSpent)} lifetime •{" "}
                        {lead.lastContacted
                          ? `last contact ${relativeTime(lead.lastContacted)}`
                          : "never contacted"}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-stone-300" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel>
          <PanelHeader
            title="Follow-ups"
            subtitle={`${openTasks.length} open task${openTasks.length === 1 ? "" : "s"}`}
            icon={<CheckCircle2 className="h-4 w-4" />}
            action={
              <button
                onClick={() => onNavigate("tasks")}
                className="flex items-center gap-1 text-[11px] font-extrabold text-emerald-800 hover:underline"
              >
                Board <ArrowRight className="h-3 w-3" />
              </button>
            }
          />
          {openTasks.length === 0 ? (
            <EmptyState
              icon={<CalendarClock className="h-5 w-5" />}
              title="No follow-ups scheduled"
              body="Log a call with a follow-up date and a task appears here."
            />
          ) : (
            <ul className="divide-y divide-stone-100">
              {openTasks.slice(0, 6).map((task) => {
                const due = dueLabel(task.dueDate);
                return (
                  <li key={task.id} className="flex items-start gap-2 px-4 py-2.5">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-stone-900">{task.title}</p>
                      <p className={`text-[10px] ${due.tone}`}>
                        {due.label}
                        {task.contactName ? ` • ${task.contactName}` : ""}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      <Panel>
        <PanelHeader
          title="Latest team activity"
          subtitle="Calls logged across the CRM"
          icon={<PhoneCall className="h-4 w-4" />}
          action={
            <button
              onClick={() => onNavigate("activity")}
              className="flex items-center gap-1 text-[11px] font-extrabold text-emerald-800 hover:underline"
            >
              Full log <ArrowRight className="h-3 w-3" />
            </button>
          }
        />
        {recent.length === 0 ? (
          <EmptyState
            icon={<PhoneCall className="h-5 w-5" />}
            title="No calls logged yet"
            body="Your activity feed starts with the first call you record."
            action={
              <Button
                onClick={onLogCall}
                className="h-9 gap-1.5 bg-emerald-800 text-xs font-bold text-white hover:bg-emerald-900"
              >
                <PhoneCall className="h-3.5 w-3.5" /> Log your first call
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-stone-100">
            {recent.map((activity) => (
              <li key={activity.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                  <PhoneCall className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-stone-900">
                    {activity.clientName}
                    <span className="ml-2 font-semibold text-stone-500">{activity.callDuration}</span>
                  </p>
                  <p className="truncate text-[11px] text-stone-500">
                    {activity.staffName} • {relativeTime(activity.createdAt)}
                  </p>
                </div>
                <OutcomePill outcome={activity.outcome} />
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download, PhoneCall, Target, TrendingUp, Trophy, Users } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DEAL_STAGES,
  computeLeadScore,
  downloadCSV,
  type CRMActivity,
  type CRMDeal,
  type CRMLead,
  type CRMTask,
  type LeadStatus,
} from "@/lib/crm-service";
import {
  Panel,
  PanelHeader,
  StatCard,
  formatDate,
  formatNaira,
  formatNairaFull,
  selectClass,
} from "./crm-ui";

const STATUS_ORDER: LeadStatus[] = [
  "new",
  "contacted",
  "qualified",
  "hot",
  "warm",
  "converted",
  "lost",
  "unresponsive",
];

export function ReportsPanel({
  leads,
  activities,
  deals,
  tasks,
}: {
  leads: CRMLead[];
  activities: CRMActivity[];
  deals: CRMDeal[];
  tasks: CRMTask[];
}) {
  const [range, setRange] = useState<7 | 30 | 90>(30);

  const from = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (range - 1));
    return d;
  }, [range]);

  const inRange = useMemo(
    () => activities.filter((a) => new Date(a.createdAt).getTime() >= from.getTime()),
    [activities, from],
  );

  const conversions = inRange.filter((a) => a.outcome === "converted").length;
  const conversionRate = inRange.length ? Math.round((conversions / inRange.length) * 100) : 0;
  const talkTime = inRange.reduce((s, a) => s + (a.durationMinutes || 0), 0);
  const wonDeals = deals.filter((d) => d.stage === "won");
  const wonValue = wonDeals.reduce((s, d) => s + d.value, 0);
  const avgDeal = wonDeals.length ? Math.round(wonValue / wonDeals.length) : 0;

  const series = useMemo(() => {
    const buckets =
      range <= 30
        ? range
        : 13; // weekly buckets over 90 days
    const out: Array<{ label: string; calls: number; conversions: number }> = [];
    if (range <= 30) {
      for (let i = range - 1; i >= 0; i -= 1) {
        const day = new Date();
        day.setHours(0, 0, 0, 0);
        day.setDate(day.getDate() - i);
        const next = new Date(day.getTime() + 86400000);
        const hits = activities.filter((a) => {
          const t = new Date(a.createdAt).getTime();
          return t >= day.getTime() && t < next.getTime();
        });
        out.push({
          label: day.toLocaleDateString("en-NG", { month: "short", day: "numeric" }),
          calls: hits.length,
          conversions: hits.filter((h) => h.outcome === "converted").length,
        });
      }
    } else {
      const bucketDays = Math.ceil(range / buckets);
      for (let i = 0; i < buckets; i += 1) {
        const start = new Date(from.getTime() + i * bucketDays * 86400000);
        const end = new Date(from.getTime() + (i + 1) * bucketDays * 86400000);
        const hits = activities.filter((a) => {
          const t = new Date(a.createdAt).getTime();
          return t >= start.getTime() && t < end.getTime();
        });
        out.push({
          label: start.toLocaleDateString("en-NG", { month: "short", day: "numeric" }),
          calls: hits.length,
          conversions: hits.filter((h) => h.outcome === "converted").length,
        });
      }
    }
    return out;
  }, [activities, range, from]);

  const repStats = useMemo(() => {
    const map = new Map<
      string,
      { name: string; calls: number; conversions: number; minutes: number; followUps: number }
    >();
    inRange.forEach((a) => {
      const key = a.staffName || "Unassigned";
      const entry =
        map.get(key) ??
        { name: key, calls: 0, conversions: 0, minutes: 0, followUps: 0 };
      entry.calls += 1;
      entry.minutes += a.durationMinutes || 0;
      if (a.outcome === "converted") entry.conversions += 1;
      if (a.outcome === "follow_up") entry.followUps += 1;
      map.set(key, entry);
    });
    return Array.from(map.values()).sort((a, b) => b.conversions - a.conversions || b.calls - a.calls);
  }, [inRange]);

  const outcomeSplit = useMemo(() => {
    const options = ["converted", "interested", "follow_up", "no_answer", "not_interested"];
    return options.map((option) => {
      const count = inRange.filter((a) => a.outcome === option).length;
      return {
        option,
        count,
        pct: inRange.length ? Math.round((count / inRange.length) * 100) : 0,
        color:
          option === "converted"
            ? "bg-emerald-500"
            : option === "interested"
              ? "bg-blue-500"
              : option === "follow_up"
                ? "bg-amber-500"
                : option === "no_answer"
                  ? "bg-stone-400"
                  : "bg-rose-500",
      };
    });
  }, [inRange]);

  const statusSplit = useMemo(
    () =>
      STATUS_ORDER.map((status) => ({
        status,
        count: leads.filter((l) => l.status === status).length,
      })).filter((s) => s.count > 0),
    [leads],
  );

  const scoring = useMemo(
    () => leads.map((lead) => computeLeadScore(lead, activities)),
    [leads, activities],
  );
  const hotCount = scoring.filter((s) => s.band === "hot").length;
  const warmCount = scoring.filter((s) => s.band === "warm").length;

  const pipelineByStage = DEAL_STAGES.map((stage) => {
    const items = deals.filter((d) => d.stage === stage.id);
    return { ...stage, count: items.length, value: items.reduce((s, d) => s + d.value, 0) };
  });

  const exportReport = () => {
    const count = downloadCSV(
      "raffila-crm-report",
      ["Metric", "Value"],
      [
        ["Range", `Last ${range} days`],
        ["Calls logged", inRange.length],
        ["Conversions", conversions],
        ["Conversion rate", `${conversionRate}%`],
        ["Talk time (minutes)", talkTime],
        ["Won revenue (NGN)", wonValue],
        ["Average won deal (NGN)", avgDeal],
        ["Total leads", leads.length],
        ["Hot leads", hotCount],
        ["Warm leads", warmCount],
        ["Open tasks", tasks.filter((t) => t.status === "open").length],
        ["Completed tasks", tasks.filter((t) => t.status === "done").length],
        [],
        ["Rep", "Calls", "Conversions", "Follow-ups", "Minutes"],
        ...repStats.map((r) => [r.name, r.calls, r.conversions, r.followUps, r.minutes]),
      ],
    );
    if (count) toast.success("Report exported");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-extrabold tracking-tight text-stone-900">
            Performance report
          </h2>
          <p className="text-xs font-medium text-stone-500">
            Live metrics from {formatDate(from.toISOString())} to today.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={range}
            onChange={(e) => setRange(Number(e.target.value) as 7 | 30 | 90)}
            className={`${selectClass} h-9`}
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <Button variant="outline" onClick={exportReport} className="h-9 gap-1.5 text-xs font-bold">
            <Download className="h-3.5 w-3.5" /> Export
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Calls logged"
          value={String(inRange.length)}
          hint={`${conversions} conversions`}
          icon={<PhoneCall className="h-4 w-4" />}
        />
        <StatCard
          label="Conversion rate"
          value={`${conversionRate}%`}
          hint="Converted calls ÷ total calls"
          icon={<Target className="h-4 w-4" />}
          tone="emerald"
        />
        <StatCard
          label="Won revenue"
          value={formatNaira(wonValue)}
          hint={`${wonDeals.length} deal${wonDeals.length === 1 ? "" : "s"} • avg ${formatNaira(avgDeal)}`}
          icon={<Trophy className="h-4 w-4" />}
          tone="amber"
        />
        <StatCard
          label="Talk time"
          value={talkTime >= 60 ? `${Math.floor(talkTime / 60)}h ${talkTime % 60}m` : `${talkTime}m`}
          hint={`${repStats.length} rep${repStats.length === 1 ? "" : "s"} active`}
          icon={<TrendingUp className="h-4 w-4" />}
          tone="indigo"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Panel className="xl:col-span-2">
          <PanelHeader
            title={`Calls vs conversions — last ${range} days`}
            subtitle="Daily volume with converted calls highlighted"
            icon={<TrendingUp className="h-4 w-4" />}
          />
          <div className="h-[240px] px-2 py-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
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
                  }}
                />
                <Bar dataKey="calls" name="Calls" fill="#a7f3d0" radius={[4, 4, 0, 0]} />
                <Bar dataKey="conversions" name="Conversions" fill="#047857" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            title="Call outcomes"
            subtitle="Where conversations land"
            icon={<Target className="h-4 w-4" />}
          />
          <div className="space-y-3 px-4 py-4">
            {outcomeSplit.map((row) => (
              <div key={row.option}>
                <div className="mb-1 flex items-center justify-between text-[11px] font-bold">
                  <span className="capitalize text-stone-700">{row.option.replace(/_/g, " ")}</span>
                  <span className="text-stone-800">
                    {row.count} <span className="text-stone-400">({row.pct}%)</span>
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-stone-100">
                  <div
                    className={`h-full rounded-full ${row.color}`}
                    style={{ width: `${Math.max(2, row.pct)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel>
          <PanelHeader
            title="Rep leaderboard"
            subtitle="Ranked by conversions in the selected range"
            icon={<Trophy className="h-4 w-4" />}
          />
          {repStats.length === 0 ? (
            <p className="px-4 py-8 text-center text-xs font-semibold text-stone-500">
              No calls logged in this range yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-left text-xs">
                <thead className="bg-stone-50 text-[10px] font-extrabold uppercase tracking-wider text-stone-500">
                  <tr>
                    <th className="px-4 py-2">#</th>
                    <th className="px-3 py-2">Rep</th>
                    <th className="px-3 py-2 text-right">Calls</th>
                    <th className="px-3 py-2 text-right">Conv.</th>
                    <th className="px-3 py-2 text-right">Rate</th>
                    <th className="px-4 py-2 text-right">Minutes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {repStats.map((rep, index) => (
                    <tr key={rep.name} className="hover:bg-stone-50/60">
                      <td className="px-4 py-2.5 font-extrabold text-stone-400">{index + 1}</td>
                      <td className="px-3 py-2.5 font-extrabold text-stone-900">{rep.name}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-stone-700">{rep.calls}</td>
                      <td className="px-3 py-2.5 text-right font-extrabold text-emerald-800">
                        {rep.conversions}
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold text-stone-700">
                        {rep.calls ? Math.round((rep.conversions / rep.calls) * 100) : 0}%
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold text-stone-700">
                        {rep.minutes}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel>
          <PanelHeader
            title="Lead quality mix"
            subtitle={`${leads.length} leads • ${hotCount} hot • ${warmCount} warm`}
            icon={<Users className="h-4 w-4" />}
          />
          <div className="space-y-2.5 px-4 py-4">
            {statusSplit.map((row) => (
              <div key={row.status} className="flex items-center gap-2">
                <span className="w-24 shrink-0 text-[11px] font-extrabold capitalize text-stone-700">
                  {row.status}
                </span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-stone-100">
                  <div
                    className="h-full rounded-full bg-emerald-700"
                    style={{ width: `${Math.max(3, (row.count / Math.max(1, leads.length)) * 100)}%` }}
                  />
                </div>
                <span className="w-8 shrink-0 text-right text-[11px] font-extrabold text-stone-800">
                  {row.count}
                </span>
              </div>
            ))}
            {statusSplit.length === 0 ? (
              <p className="py-6 text-center text-xs font-semibold text-stone-500">
                No leads in the directory yet.
              </p>
            ) : null}
          </div>
        </Panel>
      </div>

      <Panel>
        <PanelHeader
          title="Pipeline snapshot"
          subtitle="Open and closed value by stage"
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-xs">
            <thead className="bg-stone-50 text-[10px] font-extrabold uppercase tracking-wider text-stone-500">
              <tr>
                <th className="px-4 py-2">Stage</th>
                <th className="px-3 py-2 text-right">Deals</th>
                <th className="px-3 py-2 text-right">Value</th>
                <th className="px-4 py-2 text-right">Weighted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {pipelineByStage.map((stage) => (
                <tr key={stage.id} className="hover:bg-stone-50/60">
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-2 font-extrabold text-stone-900">
                      <span className={`h-1.5 w-1.5 rounded-full ${stage.dot}`} />
                      {stage.label}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right font-bold text-stone-700">{stage.count}</td>
                  <td className="px-3 py-2.5 text-right font-bold text-stone-800">
                    {formatNairaFull(stage.value)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-extrabold text-emerald-800">
                    {formatNairaFull(
                      Math.round(
                        (stage.value *
                          (stage.id === "won"
                            ? 100
                            : stage.id === "lost"
                              ? 0
                              : stage.id === "new"
                                ? 10
                                : stage.id === "qualified"
                                  ? 30
                                  : stage.id === "proposal"
                                    ? 50
                                    : 75)) /
                          100,
                      ),
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

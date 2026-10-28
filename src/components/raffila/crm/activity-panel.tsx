import { useMemo, useState } from "react";
import { Clock, Download, MessageSquare, Phone, PhoneCall, Timer, User } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { downloadCSV, type CRMActivity, type StaffMember } from "@/lib/crm-service";
import {
  EmptyState,
  OutcomePill,
  Panel,
  SearchField,
  StatCard,
  formatDateTime,
  relativeTime,
  selectClass,
} from "./crm-ui";

export function ActivityPanel({
  activities,
  session,
}: {
  activities: CRMActivity[];
  session: StaffMember;
}) {
  const [query, setQuery] = useState("");
  const [outcome, setOutcome] = useState("all");
  const [mine, setMine] = useState(false);

  const myActivities = useMemo(
    () =>
      activities.filter((a) =>
        session.key ? a.staffKey === session.key : a.staffName === session.name,
      ),
    [activities, session],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = mine ? myActivities : activities;
    return base.filter((log) => {
      const matchesQuery =
        !q ||
        log.clientName.toLowerCase().includes(q) ||
        log.clientPhone.includes(q) ||
        (log.clientEmail ? log.clientEmail.toLowerCase().includes(q) : false) ||
        log.notes.toLowerCase().includes(q) ||
        log.staffName.toLowerCase().includes(q);
      const matchesOutcome = outcome === "all" || log.outcome === outcome;
      return matchesQuery && matchesOutcome;
    });
  }, [activities, myActivities, mine, query, outcome]);

  const conversions = (mine ? myActivities : activities).filter(
    (a) => a.outcome === "converted",
  ).length;
  const followUps = (mine ? myActivities : activities).filter(
    (a) => a.outcome === "follow_up",
  ).length;
  const totalMinutes = (mine ? myActivities : activities).reduce(
    (sum, a) => sum + (a.durationMinutes || 0),
    0,
  );

  const exportCsv = () => {
    const count = downloadCSV(
      "raffila-crm-calls",
      ["Date", "Rep", "Client", "Phone", "Email", "Duration", "Type", "Outcome", "Notes", "Follow-up"],
      filtered.map((log) => [
        formatDateTime(log.createdAt),
        log.staffName,
        log.clientName,
        log.clientPhone,
        log.clientEmail || "",
        log.callDuration,
        log.callType.replace(/_/g, " "),
        log.outcome,
        log.notes,
        log.followUpDate ? formatDateTime(log.followUpDate) : "",
      ]),
    );
    if (count) toast.success(`Exported ${count} call records`);
    else toast.error("Nothing to export");
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={mine ? "My calls" : "Total calls"}
          value={String(mine ? myActivities.length : activities.length)}
          hint="All call types"
          icon={<PhoneCall className="h-4 w-4" />}
        />
        <StatCard
          label="Conversions"
          value={String(conversions)}
          hint="Ticket purchases closed"
          icon={<User className="h-4 w-4" />}
          tone="emerald"
        />
        <StatCard
          label="Follow-ups logged"
          value={String(followUps)}
          hint="Tasks created automatically"
          icon={<Clock className="h-4 w-4" />}
          tone="amber"
        />
        <StatCard
          label="Talk time"
          value={`${totalMinutes}m`}
          hint="Total logged duration"
          icon={<Timer className="h-4 w-4" />}
          tone="indigo"
        />
      </div>

      <Panel className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder="Search client, phone, notes or rep…"
            className="min-w-[240px] flex-1"
          />
          <select
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            className={`${selectClass} h-10`}
          >
            <option value="all">All outcomes</option>
            <option value="converted">Converted</option>
            <option value="interested">Interested</option>
            <option value="follow_up">Follow up</option>
            <option value="no_answer">No answer</option>
            <option value="not_interested">Not interested</option>
          </select>
          <button
            onClick={() => setMine((v) => !v)}
            className={`h-10 rounded-lg px-3 text-xs font-extrabold transition ${
              mine
                ? "bg-emerald-800 text-white shadow-sm"
                : "border border-stone-200 bg-white text-stone-700 hover:bg-stone-50"
            }`}
          >
            My calls only
          </button>
          <Button variant="outline" onClick={exportCsv} className="h-10 gap-1.5 text-xs font-bold">
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
        </div>
        <p className="mt-2 border-t border-stone-100 pt-2 text-[11px] font-bold text-stone-600">
          Showing <span className="text-stone-900">{filtered.length}</span> call
          {filtered.length === 1 ? "" : "s"}
          {mine ? " logged by you" : " across the team"}
        </p>
      </Panel>

      {filtered.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<PhoneCall className="h-5 w-5" />}
            title="No calls match this view"
            body="Log a call from the Leads tab, or clear the filters to see the full history."
          />
        </Panel>
      ) : (
        <div className="space-y-2">
          {filtered.map((log) => (
            <Panel key={log.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                    <PhoneCall className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-[13px] font-extrabold text-stone-900">{log.clientName}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold">
                      <a
                        href={`tel:${log.clientPhone.replace(/\s+/g, "")}`}
                        className="inline-flex items-center gap-1 font-mono text-emerald-800 hover:underline"
                      >
                        <Phone className="h-3 w-3" />
                        {log.clientPhone}
                      </a>
                      <a
                        href={`https://wa.me/${log.clientPhone.replace(/[^0-9]/g, "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-stone-500 hover:text-emerald-800"
                      >
                        <MessageSquare className="h-3 w-3" /> WhatsApp
                      </a>
                      <span className="inline-flex items-center gap-1 text-stone-500">
                        <Timer className="h-3 w-3" /> {log.callDuration}
                      </span>
                      <span className="capitalize text-stone-500">
                        {log.callType.replace(/_/g, " ")}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <OutcomePill outcome={log.outcome} />
                  <span className="text-[10px] font-bold text-stone-400">
                    {relativeTime(log.createdAt)}
                  </span>
                </div>
              </div>

              <p className="mt-2 whitespace-pre-line rounded-xl bg-stone-50 px-3 py-2 text-xs leading-relaxed text-stone-700 ring-1 ring-stone-100">
                {log.notes}
              </p>

              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px] font-bold text-stone-500">
                <span>
                  By <span className="text-stone-800">{log.staffName}</span> •{" "}
                  {formatDateTime(log.createdAt)}
                </span>
                {log.followUpDate ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-amber-800 ring-1 ring-amber-200">
                    <Clock className="h-3 w-3" /> Follow up {formatDateTime(log.followUpDate)}
                  </span>
                ) : null}
              </div>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  BarChart3,
  BookOpen,
  CheckCircle2,
  CheckSquare,
  ExternalLink,
  FileText,
  Flame,
  LayoutDashboard,
  LogOut,
  PhoneCall,
  Plus,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  clearStaffSession,
  fetchMyStaffAssignment,
  getCurrentStaffSession,
  invalidateLeadMetrics,
  subscribeCRMActivities,
  subscribeCRMCompetitions,
  subscribeCRMDeals,
  subscribeCRMNotes,
  subscribeCRMTasks,
  subscribeCRMTemplates,
  subscribeRealtimeCRMLeads,
  type CRMActivity,
  type CRMCompetition,
  type CRMDeal,
  type CRMLead,
  type CRMNote,
  type CRMTask,
  type CRMTemplate,
  type StaffMember,
} from "@/lib/crm-service";
import { useAuthActions, useAuthSession } from "@/hooks/useAuthSession";

import { ActivityPanel } from "./activity-panel";
import { LeadDetailSheet } from "./lead-detail-sheet";
import { LeadsPanel } from "./leads-panel";
import { LogCallDialog } from "./log-call-dialog";
import { OverviewPanel } from "./overview-panel";
import { PipelineBoard } from "./pipeline-board";
import { ReportsPanel } from "./reports-panel";
import { TasksPanel } from "./tasks-panel";
import { TemplatesPanel } from "./templates-panel";
import { EmptyState, LeadAvatar, Panel, formatNaira } from "./crm-ui";

type Tab =
  | "overview"
  | "leads"
  | "pipeline"
  | "tasks"
  | "activity"
  | "templates"
  | "reports"
  | "playbook";

const TABS: Array<{ id: Tab; label: string; short: string; icon: React.ReactNode }> = [
  { id: "overview", label: "Overview", short: "Home", icon: <LayoutDashboard className="h-3.5 w-3.5" /> },
  { id: "leads", label: "Leads", short: "Leads", icon: <Users className="h-3.5 w-3.5" /> },
  { id: "pipeline", label: "Pipeline", short: "Pipeline", icon: <TrendingUp className="h-3.5 w-3.5" /> },
  { id: "tasks", label: "Tasks", short: "Tasks", icon: <CheckSquare className="h-3.5 w-3.5" /> },
  { id: "activity", label: "Calls", short: "Calls", icon: <PhoneCall className="h-3.5 w-3.5" /> },
  { id: "templates", label: "Templates", short: "Templates", icon: <FileText className="h-3.5 w-3.5" /> },
  { id: "reports", label: "Reports", short: "Reports", icon: <BarChart3 className="h-3.5 w-3.5" /> },
  { id: "playbook", label: "Playbook", short: "Playbook", icon: <BookOpen className="h-3.5 w-3.5" /> },
];

export function SalesCRM() {
  const actions = useAuthActions();
  const { user, role } = useAuthSession();
  const [assignedSession, setAssignedSession] = useState<StaffMember | null>(() =>
    getCurrentStaffSession(),
  );

  const session = useMemo<StaffMember | null>(() => {
    if (!user) return null;
    if (role !== "staff" && role !== "admin") return null;

    const nameFromAuth =
      [user.firstName, user.lastName].filter(Boolean).join(" ") ||
      user.email.split("@")[0] ||
      "Staff";
    return {
      id: assignedSession?.id || user.id,
      key: assignedSession?.key || "",
      name: assignedSession?.name || nameFromAuth,
      email: user.email,
      role: role === "admin" ? "Administrator" : "Sales Representative",
      status: assignedSession?.status || "active",
      createdAt: assignedSession?.createdAt || new Date().toISOString(),
      ...(assignedSession?.lastLoginAt ? { lastLoginAt: assignedSession.lastLoginAt } : {}),
    };
  }, [assignedSession, user, role]);

  useEffect(() => {
    if (!user || role !== "staff") return;
    const uid = user.id.replace(/^firebase_/, "");
    let cancelled = false;
    void fetchMyStaffAssignment(uid).then((assignment) => {
      if (!cancelled && assignment) setAssignedSession(assignment);
    });
    return () => {
      cancelled = true;
    };
  }, [user, role]);

  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [leads, setLeads] = useState<CRMLead[]>([]);
  const [activities, setActivities] = useState<CRMActivity[]>([]);
  const [deals, setDeals] = useState<CRMDeal[]>([]);
  const [tasks, setTasks] = useState<CRMTask[]>([]);
  const [notes, setNotes] = useState<CRMNote[]>([]);
  const [templates, setTemplates] = useState<CRMTemplate[]>([]);
  const [competitions, setCompetitions] = useState<CRMCompetition[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const [logCallOpen, setLogCallOpen] = useState(false);
  const [logCallLead, setLogCallLead] = useState<CRMLead | null>(null);
  const [sheetLead, setSheetLead] = useState<CRMLead | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    if (!session) return;

    const unsubActivities = subscribeCRMActivities((rows) => setActivities(rows));
    const unsubLeads = subscribeRealtimeCRMLeads((rows) => {
      setLeads(rows);
      setLoadingLeads(false);
    });
    const unsubDeals = subscribeCRMDeals((rows) => setDeals(rows));
    const unsubTasks = subscribeCRMTasks((rows) => setTasks(rows));
    const unsubNotes = subscribeCRMNotes((rows) => setNotes(rows));
    const unsubTemplates = subscribeCRMTemplates((rows) => setTemplates(rows));
    const unsubCompetitions = subscribeCRMCompetitions((rows) => setCompetitions(rows));

    return () => {
      unsubActivities();
      unsubLeads();
      unsubDeals();
      unsubTasks();
      unsubNotes();
      unsubTemplates();
      unsubCompetitions();
    };
  }, [session, refreshKey]);

  const openLead = (lead: CRMLead) => {
    setSheetLead(lead);
    setSheetOpen(true);
  };

  const openLeadById = (leadId: string) => {
    const found = leads.find((l) => l.id === leadId);
    if (found) openLead(found);
    else toast.info("That lead is no longer in your directory");
  };

  const openLogCall = (lead?: CRMLead) => {
    setLogCallLead(lead ?? null);
    setLogCallOpen(true);
  };

  const handleLogout = () => {
    clearStaffSession();
    setAssignedSession(null);
    toast.info("Signed out of the CRM");
    actions.signOut({ to: "/staff" });
  };

  const overdueCount = useMemo(() => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    return tasks.filter(
      (t) =>
        t.status === "open" &&
        t.dueDate &&
        new Date(t.dueDate).getTime() < startOfDay.getTime(),
    ).length;
  }, [tasks]);

  const counts = useMemo(
    () => ({
      leads: leads.length,
      pipeline: deals.filter((d) => d.stage !== "won" && d.stage !== "lost").length,
      tasks: tasks.filter((t) => t.status === "open").length,
      calls: activities.length,
      templates: templates.length,
    }),
    [leads, deals, tasks, activities, templates],
  );

  if (!session) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#F7F7F4] p-4 text-stone-800">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-800 text-lg font-black text-white shadow-sm">
          R
        </div>
        <p className="text-sm font-bold text-stone-700">Loading your CRM workspace…</p>
        <Link to="/staff" className="text-xs font-bold text-emerald-800 underline">
          Sign in with a staff account
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#F5F6F2] text-stone-900">
      <header className="sticky top-0 z-40 border-b border-stone-200 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link to="/" className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-800 text-sm font-black text-white shadow-sm">
                R
              </span>
              <span className="hidden text-base font-extrabold tracking-tight text-stone-900 sm:block">
                Raffila
              </span>
            </Link>
            <span className="hidden h-6 w-px bg-stone-200 sm:block" />
            <div className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-[11px] font-extrabold text-emerald-900 ring-1 ring-emerald-200">
              <PhoneCall className="h-3.5 w-3.5 text-emerald-700" />
              Sales CRM
            </div>
            {role === "admin" ? (
              <span className="hidden items-center gap-1 rounded-lg bg-indigo-50 px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide text-indigo-800 ring-1 ring-indigo-200 sm:flex">
                <ShieldCheck className="h-3 w-3" /> Admin view
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => {
                invalidateLeadMetrics();
                setRefreshKey((k) => k + 1);
                toast.success("Re-syncing live data");
              }}
              title="Refresh live data"
              variant="outline"
              className="h-9 gap-1.5 border-stone-200 bg-white text-xs font-bold text-stone-700"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sync</span>
            </Button>
            <Button
              onClick={() => openLogCall()}
              className="h-9 gap-1.5 bg-emerald-800 text-xs font-bold text-white shadow-sm hover:bg-emerald-900"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Log call</span>
            </Button>

            <div className="hidden items-center gap-2 rounded-xl border border-stone-200 bg-white px-2 py-1.5 md:flex">
              <LeadAvatar name={session.name} size="sm" />
              <div className="min-w-0">
                <p className="max-w-[150px] truncate text-[11px] font-extrabold leading-tight text-stone-900">
                  {session.name}
                </p>
                <p className="max-w-[150px] truncate text-[10px] font-semibold leading-tight text-stone-500">
                  {session.role}
                </p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="flex h-9 items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-2.5 text-[11px] font-bold text-stone-700 transition hover:bg-stone-50"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Sign out</span>
            </button>
          </div>
        </div>

        <nav className="mx-auto max-w-[1400px] px-2 sm:px-4">
          <div className="flex gap-1 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {TABS.map((tab) => {
              const active = activeTab === tab.id;
              const badge =
                tab.id === "tasks"
                  ? overdueCount || null
                  : tab.id === "pipeline"
                    ? counts.pipeline || null
                    : tab.id === "leads"
                      ? counts.leads || null
                      : null;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-extrabold transition ${
                    active
                      ? "bg-emerald-800 text-white shadow-sm"
                      : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
                  }`}
                >
                  {tab.icon}
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.short}</span>
                  {badge ? (
                    <span
                      className={`rounded-full px-1.5 text-[10px] font-extrabold ${
                        active
                          ? "bg-white/20 text-white"
                          : tab.id === "tasks" && overdueCount
                            ? "bg-rose-100 text-rose-700"
                            : "bg-stone-100 text-stone-600"
                      }`}
                    >
                      {badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-5 sm:px-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-stone-900 sm:text-2xl">
              {activeTab === "overview"
                ? `Good to see you, ${session.name.split(" ")[0]}`
                : TABS.find((t) => t.id === activeTab)?.label}
            </h1>
            <p className="mt-0.5 text-xs font-semibold text-stone-500">
              {activeTab === "overview"
                ? "Everything happening across your leads, deals and follow-ups."
                : activeTab === "leads"
                  ? "Your live customer directory — scored, searchable and ready to call."
                  : activeTab === "pipeline"
                    ? "Move deals through the funnel and keep the forecast honest."
                    : activeTab === "tasks"
                      ? "Follow-ups and reminders so nothing goes cold."
                      : activeTab === "activity"
                        ? "Every call logged by the team, with outcomes and next steps."
                        : activeTab === "templates"
                          ? "Reusable email, WhatsApp and call scripts with merge tags."
                          : activeTab === "reports"
                            ? "Conversion, revenue and rep performance at a glance."
                            : "Competition facts and objection handling for confident calls."}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {counts.calls === 0 ? (
              <span className="hidden items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-extrabold text-amber-800 ring-1 ring-amber-200 sm:flex">
                <Flame className="h-3 w-3" /> Get your first call logged
              </span>
            ) : null}
            <Link
              to="/competitions"
              target="_blank"
              className="hidden h-9 items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 text-[11px] font-bold text-stone-700 shadow-sm transition hover:bg-stone-50 sm:flex"
            >
              <ExternalLink className="h-3.5 w-3.5 text-emerald-700" />
              Live competitions
            </Link>
          </div>
        </div>

        {activeTab === "overview" ? (
          <OverviewPanel
            leads={leads}
            activities={activities}
            deals={deals}
            tasks={tasks}
            session={session}
            onOpenLead={openLead}
            onLogCall={() => openLogCall()}
            onNavigate={(tab) => setActiveTab(tab)}
          />
        ) : null}

        {activeTab === "leads" ? (
          loadingLeads ? (
            <Panel className="p-10 text-center">
              <span className="text-sm font-bold text-stone-500">Loading the lead directory…</span>
            </Panel>
          ) : (
            <LeadsPanel
              leads={leads}
              activities={activities}
              onOpenLead={openLead}
              onLogCall={(lead) => openLogCall(lead)}
            />
          )
        ) : null}

        {activeTab === "pipeline" ? (
          <PipelineBoard
            deals={deals}
            leads={leads}
            session={session}
            onOpenLead={(id) => {
              openLeadById(id);
            }}
          />
        ) : null}

        {activeTab === "tasks" ? <TasksPanel tasks={tasks} leads={leads} session={session} /> : null}

        {activeTab === "activity" ? (
          <ActivityPanel activities={activities} session={session} />
        ) : null}

        {activeTab === "templates" ? (
          <TemplatesPanel
            templates={templates}
            leads={leads}
            competitions={competitions}
            session={session}
          />
        ) : null}

        {activeTab === "reports" ? (
          <ReportsPanel leads={leads} activities={activities} deals={deals} tasks={tasks} />
        ) : null}

        {activeTab === "playbook" ? <Playbook competitions={competitions} /> : null}
      </main>

      <footer className="mt-auto border-t border-stone-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-2 text-[10px] font-semibold text-stone-500">
          <span>Raffila Sales CRM • signed in as {session.email}</span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Live data • {counts.leads} leads • {counts.calls} calls •{" "}
            {competitions.filter((c) => c.status === "LIVE" || c.status === "CLOSING SOON").length}{" "}
            competitions
          </span>
        </div>
      </footer>

      <LeadDetailSheet
        lead={sheetLead}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        activities={activities}
        notes={notes}
        deals={deals}
        tasks={tasks}
        session={session}
        onLogCall={(lead) => {
          setSheetOpen(false);
          openLogCall(lead);
        }}
      />

      <LogCallDialog
        open={logCallOpen}
        onOpenChange={setLogCallOpen}
        leads={leads}
        session={session}
        initialLead={logCallLead}
        onSaved={(activity) =>
          setActivities((prev) =>
            prev.some((a) => a.id === activity.id) ? prev : [activity, ...prev],
          )
        }
      />
    </div>
  );
}

function Playbook({ competitions }: { competitions: CRMCompetition[] }) {
  const active = competitions.filter((c) => c.status === "LIVE" || c.status === "CLOSING SOON");
  const ordered = (active.length ? active : competitions).slice(0, 4);

  const dateLabel = (iso: string) => {
    if (!iso) return "";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
  };

  const talkingPoints = ordered.map((c) => {
    const price = c.entryPriceKobo > 0 ? formatNaira(Math.round(c.entryPriceKobo / 100)) : "—";
    const remaining = c.totalEntries > 0 ? Math.max(0, c.totalEntries - c.entriesSold) : 0;
    const closes = dateLabel(c.closesAt);
    const facts = [
      `${price} per entry`,
      remaining > 0
        ? `${remaining.toLocaleString("en-NG")} of ${c.totalEntries.toLocaleString("en-NG")} entries left`
        : null,
      closes ? `closes ${closes}` : null,
      c.maxPerUser > 0 ? `${c.maxPerUser} tickets max per account` : null,
    ]
      .filter(Boolean)
      .join(" • ");
    return {
      id: c.id,
      title: c.title,
      value: c.prizeValueKobo > 0 ? formatNaira(Math.round(c.prizeValueKobo / 100)) : c.status,
      body: `${facts}. SHA-256 commit published before entries close, so the draw seed is locked in advance.`,
    };
  });

  const entryPrices = active.map((c) => c.entryPriceKobo).filter((k) => k > 0);
  const fromPrice = entryPrices.length
    ? formatNaira(Math.round(Math.min(...entryPrices) / 100))
    : "the published ticket price";

  const objections = [
    {
      q: "“How do I know the draw is fair?”",
      a: "Every draw publishes a SHA-256 commit before tickets are issued, so the seed is fixed in advance. Customers can verify the hash on the draw-verification page — nothing is edited afterwards.",
    },
    {
      q: "“How will I receive my prize?”",
      a: "Physical prizes are handed over at an official ceremony in Lagos with legal deed transfer. Cash prizes are paid instantly to a verified Nigerian bank account.",
    },
    {
      q: "“Is this a scam?”",
      a: "Raffila is a registered Nigerian business with public winner showcases, named past winners and verifiable draw records. Invite them to check the winners page while you're on the call.",
    },
    {
      q: "“I never win anything.”",
      a: "Odds are capped per competition, so entry volume directly controls your probability. Buying a bundle improves your position without the pool ballooning behind you.",
    },
    {
      q: "“It's too expensive.”",
      a: `The cheapest live entry right now is ${fromPrice} — less than a data bundle. Anchor to the prize value, then let them choose the entry size that feels comfortable.`,
    },
  ];

  const flow = [
    "Open with their name and reference their last competition or purchase.",
    "Ask one discovery question: what prize would change things for them this year?",
    "Match the competition to that answer. Quote the entry price, not the prize price.",
    "Handle one objection, then ask for a small commitment — a single entry.",
    "Confirm the next step out loud and log the call with a follow-up date.",
  ];

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Panel className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-stone-100 px-5 py-4">
          <Trophy className="h-4 w-4 text-emerald-700" />
          <div>
            <h2 className="text-[15px] font-extrabold text-stone-900">
              Live competitions — talking points
            </h2>
            <p className="text-xs font-medium text-stone-500">
              {active.length
                ? `${active.length} live competition${active.length === 1 ? "" : "s"} pulled from your catalogue — facts you can quote with confidence.`
                : "No live competition in the catalogue yet."}
            </p>
          </div>
        </div>
        {talkingPoints.length === 0 ? (
          <EmptyState
            icon={<Trophy className="h-5 w-5" />}
            title="Nothing published to talk about"
            body="Publish a competition from the admin Competitions page — this playbook updates automatically with its real prize, price and close date."
          />
        ) : (
          <div className="space-y-3 p-4">
            {talkingPoints.map((point) => (
              <div
                key={point.id}
                className="rounded-xl border border-stone-200 bg-stone-50/70 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[13px] font-extrabold text-stone-900">{point.title}</p>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-emerald-900">
                    {point.value}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-stone-600">{point.body}</p>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-stone-100 px-5 py-4">
          <CheckCircle2 className="h-4 w-4 text-emerald-700" />
          <div>
            <h2 className="text-[15px] font-extrabold text-stone-900">The 60-second call flow</h2>
            <p className="text-xs font-medium text-stone-500">Same structure, every conversation.</p>
          </div>
        </div>
        <ol className="divide-y divide-stone-100">
          {flow.map((step, index) => (
            <li key={step} className="flex gap-3 px-4 py-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-800 text-[11px] font-extrabold text-white">
                {index + 1}
              </span>
              <p className="text-xs leading-relaxed text-stone-700">{step}</p>
            </li>
          ))}
        </ol>
      </Panel>

      <Panel className="overflow-hidden xl:col-span-2">
        <div className="flex items-center gap-2 border-b border-stone-100 px-5 py-4">
          <BookOpen className="h-4 w-4 text-emerald-700" />
          <div>
            <h2 className="text-[15px] font-extrabold text-stone-900">Objections & responses</h2>
            <p className="text-xs font-medium text-stone-500">
              Acknowledge, answer, then move the conversation forward.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 p-4 lg:grid-cols-2">
          {objections.map((item) => (
            <div key={item.q} className="rounded-xl border border-stone-200 bg-white p-3">
              <p className="text-xs font-extrabold text-stone-900">{item.q}</p>
              <p className="mt-1 text-xs leading-relaxed text-stone-600">{item.a}</p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

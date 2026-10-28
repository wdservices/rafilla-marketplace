import { useState, useEffect, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import {
  PhoneCall,
  Phone,
  PhoneForwarded,
  MessageSquare,
  CheckCircle2,
  Clock,
  Timer,
  LogOut,
  Plus,
  Search,
  ExternalLink,
  Flame,
  Send,
  AlertCircle,
  X,
  Filter,
  Radio,
  Trophy,
  User,
  Users,
  Check,
  Calendar,
  Download,
  FileSpreadsheet,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getCurrentStaffSession,
  validateStaffLogin,
  clearStaffSession,
  saveCallToCRMActivities,
  subscribeCRMActivities,
  subscribeRealtimeCRMLeads,
  updateCRMLeadStatus,
  exportLeadsToCSV,
  StaffMember,
  CRMLead,
  CRMActivity,
  LeadStatus,
  CallType,
  CallOutcome,
} from "@/lib/crm-service";

export function SalesCRM() {
  const [session, setSession] = useState<StaffMember | null>(() => getCurrentStaffSession());
  const [accessKeyInput, setAccessKeyInput] = useState("");
  const [loginError, setLoginError] = useState("");

  // Real-time Firestore State
  const [callActivities, setCallActivities] = useState<CRMActivity[]>([]);
  const [leads, setLeads] = useState<CRMLead[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [firestoreConnected, setFirestoreConnected] = useState(false);

  const [activeTab, setActiveTab] = useState<"logs" | "leads" | "pitch">("leads");

  // Search & Filter state for Leads (Real-time querying)
  const [leadSearchQuery, setLeadSearchQuery] = useState("");
  const [leadStatusFilter, setLeadStatusFilter] = useState<string>("all");

  // Search & Filter state for Call Logs
  const [callLogSearch, setCallLogSearch] = useState("");
  const [callOutcomeFilter, setCallOutcomeFilter] = useState<string>("all");

  // Log Call Modal state
  const [isLogCallOpen, setIsLogCallOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<CRMLead | null>(null);
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [callDuration, setCallDuration] = useState("5 mins");
  const [durationMinutes, setDurationMinutes] = useState(5);
  const [callType, setCallType] = useState<CallType>("outbound_pitch");
  const [outcome, setOutcome] = useState<CallOutcome>("interested");
  const [notes, setNotes] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [isSavingCall, setIsSavingCall] = useState(false);

  // Subscribe to real-time Firestore collections
  useEffect(() => {
    if (!session) return;

    // 1. Subscribe to crm_activities collection in Firestore
    const unsubActivities = subscribeCRMActivities(
      (activities) => {
        setCallActivities(activities);
        setFirestoreConnected(true);
      },
      (err) => {
        console.warn("Activities sync notice:", err);
      },
    );

    // 2. Subscribe to users collection (real-time CRM leads) in Firestore
    const unsubLeads = subscribeRealtimeCRMLeads(
      (realtimeLeads) => {
        setLeads(realtimeLeads);
        setLoadingLeads(false);
        setFirestoreConnected(true);
      },
      (err) => {
        console.warn("Leads sync notice:", err);
        setLoadingLeads(false);
      },
    );

    return () => {
      unsubActivities();
      unsubLeads();
    };
  }, [session]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    const res = validateStaffLogin(accessKeyInput);
    if (!res.success || !res.staff) {
      setLoginError(res.error || "Login failed");
      return;
    }
    setSession(res.staff);
    toast.success(`Welcome back, ${res.staff.name}!`);
  };

  const handleLogout = () => {
    clearStaffSession();
    setSession(null);
    setAccessKeyInput("");
    toast.info("Logged out from Sales CRM");
    window.location.href = "/staff?role=sales";
  };

  const openLogCallForLead = (lead: CRMLead) => {
    setSelectedLead(lead);
    setClientName(lead.name);
    setClientPhone(lead.phone);
    setClientEmail(lead.email || "");
    setCallDuration("5 mins");
    setDurationMinutes(5);
    setCallType("outbound_pitch");
    setOutcome("interested");
    setNotes("");
    setFollowUpDate("");
    setIsLogCallOpen(true);
  };

  const openNewLogCall = () => {
    setSelectedLead(null);
    setClientName("");
    setClientPhone("");
    setClientEmail("");
    setCallDuration("5 mins");
    setDurationMinutes(5);
    setCallType("outbound_pitch");
    setOutcome("interested");
    setNotes("");
    setFollowUpDate("");
    setIsLogCallOpen(true);
  };

  const handleQuickDuration = (minutes: number) => {
    setDurationMinutes(minutes);
    setCallDuration(`${minutes} min${minutes > 1 ? "s" : ""}`);
  };

  const handleSaveCallLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    if (!clientName.trim() || !clientPhone.trim() || !notes.trim()) {
      toast.error("Please fill in client name, phone number, and call notes");
      return;
    }

    setIsSavingCall(true);
    try {
      // Save directly to the 'crm_activities' collection in Firestore
      const newActivity = await saveCallToCRMActivities({
        leadId: selectedLead?.id,
        clientName: clientName.trim(),
        clientPhone: clientPhone.trim(),
        clientEmail: clientEmail.trim() || undefined,
        callDuration: callDuration.trim() || `${durationMinutes} mins`,
        durationMinutes,
        outcome,
        notes: notes.trim(),
        callType,
        followUpDate: followUpDate || undefined,
        staffKey: session.key,
        staffName: session.name,
      });

      // Optimistically update list in case listener takes a moment
      setCallActivities((prev) => {
        if (prev.some((a) => a.id === newActivity.id)) return prev;
        return [newActivity, ...prev];
      });

      setIsLogCallOpen(false);
      toast.success("Call activity saved to Firestore!", {
        description: `Logged ${callDuration} call (${outcome}) for ${clientName}`,
      });
    } catch (err) {
      console.error("Error saving call activity to Firestore:", err);
      toast.error("Failed to save call record", {
        description: err instanceof Error ? err.message : "Please check your network connection",
      });
    } finally {
      setIsSavingCall(false);
    }
  };

  // Real-time Firestore Filtering for Leads
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const q = leadSearchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        lead.name.toLowerCase().includes(q) ||
        lead.email.toLowerCase().includes(q) ||
        lead.phone.includes(q) ||
        lead.location.toLowerCase().includes(q);

      const matchesStatus = leadStatusFilter === "all" || lead.status === leadStatusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [leads, leadSearchQuery, leadStatusFilter]);

  // Filtering for Call Activities
  const filteredActivities = useMemo(() => {
    return callActivities.filter((log) => {
      const q = callLogSearch.trim().toLowerCase();
      const matchesSearch =
        !q ||
        log.clientName.toLowerCase().includes(q) ||
        log.clientPhone.includes(q) ||
        (log.clientEmail && log.clientEmail.toLowerCase().includes(q)) ||
        log.notes.toLowerCase().includes(q) ||
        log.staffName.toLowerCase().includes(q);

      const matchesOutcome = callOutcomeFilter === "all" || log.outcome === callOutcomeFilter;

      return matchesSearch && matchesOutcome;
    });
  }, [callActivities, callLogSearch, callOutcomeFilter]);

  // If not logged in as staff
  if (!session) {
    return (
      <div className="min-h-screen bg-linear-to-b from-stone-950 via-[#0e1d15] to-stone-950 text-stone-100 flex flex-col justify-center items-center p-4">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-2">
            <Link to="/" className="inline-flex items-center gap-2 group mb-2">
              <span className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-black text-xl group-hover:scale-105 transition-transform">
                R
              </span>
              <span className="font-extrabold text-2xl tracking-tight text-white">Raffila</span>
            </Link>
            <div className="inline-block px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-mono">
              SALES & OUTREACH CRM PORTAL
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Staff Sign In</h1>
            <p className="text-xs text-stone-400 max-w-xs mx-auto">
              Access the sales outreach dashboard, client leads, and call tracking system.
            </p>
          </div>

          <div className="bg-stone-900/90 border border-stone-800 rounded-2xl p-6 shadow-xl backdrop-blur-md space-y-4">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-stone-300">Staff Access Key</label>
                <Input
                  required
                  value={accessKeyInput}
                  onChange={(e) => setAccessKeyInput(e.target.value.toUpperCase())}
                  placeholder="RAF-SALES-XXXX-XXXX"
                  className="font-mono bg-stone-950/80 border-stone-700 text-stone-100 placeholder:text-stone-600 uppercase text-center text-sm py-5 tracking-wider"
                />
              </div>

              {loginError && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-5 text-xs tracking-wide"
              >
                Sign In to Sales CRM
              </Button>
            </form>

            <div className="pt-3 border-t border-stone-800/80 text-[11px] text-stone-400 text-center space-y-2">
              <p>Please enter the unique Access Key assigned by your Operations Admin.</p>
              <div className="pt-1">
                <Link
                  to="/staff"
                  search={{ role: "sales" }}
                  className="text-emerald-400 hover:text-emerald-300 underline font-medium text-xs"
                >
                  Go to Unified Staff & Operations Portal →
                </Link>
              </div>
              <p className="text-stone-500 text-[10px]">
                Admins issue and manage keys inside Admin Settings at{" "}
                <code className="text-stone-300">/admin/settings</code>.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Authenticated Sales Dashboard Metrics
  const myCalls = callActivities.filter((c) => c.staffKey === session.key);
  const myConversions = myCalls.filter((c) => c.outcome === "converted").length;
  const myFollowups = myCalls.filter((c) => c.outcome === "follow_up").length;

  return (
    <div className="min-h-screen bg-[#FBF9F4] text-stone-900 flex flex-col selection:bg-emerald-200">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-stone-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2 group">
              <span className="w-8 h-8 rounded-lg bg-emerald-800 flex items-center justify-center text-white font-extrabold text-sm shadow-xs">
                R
              </span>
              <span className="font-bold text-lg text-emerald-950">Raffila</span>
            </Link>
            <span className="text-stone-300">|</span>
            <div className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md bg-emerald-100/80 text-emerald-900 border border-emerald-200">
              <PhoneCall className="w-3.5 h-3.5 text-emerald-700" />
              <span>Sales CRM</span>
            </div>

            {/* Live Firestore indicator */}
            <div className="hidden md:flex items-center gap-1.5 text-[11px] font-medium text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200/60">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
              </span>
              <span>Firestore Live Sync Active</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-bold text-stone-900">{session.name}</span>
              <span className="text-[10px] text-stone-500 font-mono">
                {session.role} • {session.key}
              </span>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={handleLogout}
              className="gap-1.5 text-xs text-stone-700 hover:text-stone-950 h-8"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full space-y-6">
        {/* Welcome & Action Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white rounded-2xl p-6 border border-stone-200 shadow-xs">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold tracking-tight text-emerald-950">
                Sales Outreach Dashboard
              </h1>
              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px]">
                Firestore Connected
              </Badge>
            </div>
            <p className="text-xs text-stone-600 mt-1">
              Welcome, <strong className="text-stone-900">{session.name}</strong>. Locate leads via
              real-time Firestore queries and save call activities directly to the database.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/competitions"
              target="_blank"
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 shadow-xs"
            >
              <ExternalLink className="w-3.5 h-3.5 text-emerald-700" />
              Live Competitions
            </Link>
            <Button
              onClick={openNewLogCall}
              className="gap-1.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold shadow-xs"
            >
              <Plus className="w-4 h-4" />
              Log New Call
            </Button>
          </div>
        </div>

        {/* Rep KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-4 border border-stone-200 shadow-xs">
            <div className="flex items-center justify-between text-xs text-stone-500 font-medium mb-1">
              <span>My Logged Calls</span>
              <PhoneForwarded className="w-4 h-4 text-emerald-700" />
            </div>
            <div className="text-2xl font-extrabold text-stone-900">{myCalls.length}</div>
            <p className="text-[11px] text-stone-500 mt-0.5">
              {callActivities.length} Firestore activities total
            </p>
          </div>

          <div className="bg-white rounded-xl p-4 border border-stone-200 shadow-xs">
            <div className="flex items-center justify-between text-xs text-stone-500 font-medium mb-1">
              <span>My Conversions</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-extrabold text-emerald-700">{myConversions}</div>
            <p className="text-[11px] text-emerald-700 font-medium mt-0.5">
              Ticket purchases closed
            </p>
          </div>

          <div className="bg-white rounded-xl p-4 border border-stone-200 shadow-xs">
            <div className="flex items-center justify-between text-xs text-stone-500 font-medium mb-1">
              <span>Scheduled Follow-ups</span>
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-2xl font-extrabold text-amber-700">{myFollowups}</div>
            <p className="text-[11px] text-stone-500 mt-0.5">Callbacks required</p>
          </div>

          <div className="bg-white rounded-xl p-4 border border-stone-200 shadow-xs">
            <div className="flex items-center justify-between text-xs text-stone-500 font-medium mb-1">
              <span>Real-Time Leads</span>
              <Users className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-extrabold text-stone-900">{leads.length}</div>
            <p className="text-[11px] text-emerald-700 font-medium mt-0.5">
              {leads.filter((l) => l.status === "hot").length} Hot Prospects
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-stone-200 gap-6">
          <button
            onClick={() => setActiveTab("leads")}
            className={`pb-3 text-xs font-semibold uppercase tracking-wider transition-colors relative ${
              activeTab === "leads"
                ? "text-emerald-900 border-b-2 border-emerald-800"
                : "text-stone-500 hover:text-stone-900"
            }`}
          >
            Client Leads & VIPs ({leads.length})
          </button>
          <button
            onClick={() => setActiveTab("logs")}
            className={`pb-3 text-xs font-semibold uppercase tracking-wider transition-colors relative ${
              activeTab === "logs"
                ? "text-emerald-900 border-b-2 border-emerald-800"
                : "text-stone-500 hover:text-stone-900"
            }`}
          >
            Call Activity History ({callActivities.length})
          </button>
          <button
            onClick={() => setActiveTab("pitch")}
            className={`pb-3 text-xs font-semibold uppercase tracking-wider transition-colors relative ${
              activeTab === "pitch"
                ? "text-emerald-900 border-b-2 border-emerald-800"
                : "text-stone-500 hover:text-stone-900"
            }`}
          >
            Sales Script & Talking Points
          </button>
        </div>

        {/* ======================================================== */}
        {/* TAB 1: REAL-TIME LEADS LIST WITH SEARCH & FILTER BAR    */}
        {/* ======================================================== */}
        {activeTab === "leads" && (
          <div className="space-y-4">
            {/* Real-Time Search and Filter Bar */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-stone-200 shadow-xs space-y-3">
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                {/* Search Input for Name, Email, Phone */}
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
                  <Input
                    value={leadSearchQuery}
                    onChange={(e) => setLeadSearchQuery(e.target.value)}
                    placeholder="Search leads by name, email, or phone number in real time..."
                    className="pl-10 pr-8 text-xs h-10 bg-stone-50/80 border-stone-200 text-stone-900 placeholder:text-stone-400 focus:bg-white"
                  />
                  {leadSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setLeadSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 p-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Status Filter */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 text-xs text-stone-600 font-medium shrink-0">
                    <Filter className="w-3.5 h-3.5 text-stone-400" />
                    <span>Status:</span>
                  </div>
                  <select
                    value={leadStatusFilter}
                    onChange={(e) => setLeadStatusFilter(e.target.value)}
                    className="text-xs bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-stone-800 font-medium focus:bg-white focus:outline-emerald-800"
                  >
                    <option value="all">All Statuses ({leads.length})</option>
                    <option value="hot">
                      Hot Leads 🔥 ({leads.filter((l) => l.status === "hot").length})
                    </option>
                    <option value="warm">
                      Warm Leads ({leads.filter((l) => l.status === "warm").length})
                    </option>
                    <option value="converted">
                      Converted ({leads.filter((l) => l.status === "converted").length})
                    </option>
                    <option value="contacted">
                      Contacted ({leads.filter((l) => l.status === "contacted").length})
                    </option>
                  </select>
                </div>
              </div>

              {/* Real-time Query Meta & Active Filter Indicator */}
              <div className="flex flex-wrap items-center justify-between text-xs text-stone-500 pt-1 border-t border-stone-100 gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-stone-800">
                    Showing {filteredLeads.length} of {leads.length} leads
                  </span>
                  {(leadSearchQuery || leadStatusFilter !== "all") && (
                    <button
                      type="button"
                      onClick={() => {
                        setLeadSearchQuery("");
                        setLeadStatusFilter("all");
                      }}
                      className="text-emerald-700 hover:text-emerald-800 underline text-xs font-semibold ml-1"
                    >
                      Reset filters
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 text-[11px] text-stone-400">
                  <Radio className="w-3 h-3 text-emerald-600 animate-pulse" />
                  <span>Real-time Firestore user directory</span>
                </div>
              </div>
            </div>

            {/* Leads Table */}
            <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-50 text-stone-600 font-semibold border-b border-stone-200">
                    <tr>
                      <th className="py-3 px-4">Client Name</th>
                      <th className="py-3 px-4">Contact Info (Phone / Email)</th>
                      <th className="py-3 px-4">Location</th>
                      <th className="py-3 px-4">Lead Status</th>
                      <th className="py-3 px-4">Ticket History</th>
                      <th className="py-3 px-4">Last Contacted</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {loadingLeads ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-stone-400 text-xs">
                          <div className="flex items-center justify-center gap-2">
                            <span className="animate-spin text-emerald-700">●</span>
                            <span>Querying real-time Firestore leads...</span>
                          </div>
                        </td>
                      </tr>
                    ) : filteredLeads.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="py-10 text-center text-stone-400 text-xs space-y-2"
                        >
                          <p>No leads match your search query or status filter.</p>
                          {(leadSearchQuery || leadStatusFilter !== "all") && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setLeadSearchQuery("");
                                setLeadStatusFilter("all");
                              }}
                              className="text-xs"
                            >
                              Clear Filters
                            </Button>
                          )}
                        </td>
                      </tr>
                    ) : (
                      filteredLeads.map((lead) => (
                        <tr key={lead.id} className="hover:bg-stone-50/70 transition-colors">
                          <td className="py-3.5 px-4 font-bold text-stone-900">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-xs">
                                {lead.name.slice(0, 1).toUpperCase()}
                              </div>
                              <span>{lead.name}</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-stone-800 text-[11px]">
                                {lead.phone}
                              </span>
                              {lead.phone && lead.phone !== "No phone added" && (
                                <a
                                  href={`https://wa.me/${lead.phone.replace(/[^0-9]/g, "")}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-emerald-700 hover:text-emerald-800"
                                  title="Chat on WhatsApp"
                                >
                                  <MessageSquare className="w-3.5 h-3.5" />
                                </a>
                              )}
                            </div>
                            <div className="text-stone-400 text-[10px]">{lead.email}</div>
                          </td>
                          <td className="py-3.5 px-4 text-stone-600">{lead.location}</td>
                          <td className="py-3.5 px-4">
                            {lead.status === "hot" && (
                              <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px]">
                                Hot Lead 🔥
                              </Badge>
                            )}
                            {lead.status === "warm" && (
                              <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px]">
                                Warm
                              </Badge>
                            )}
                            {lead.status === "converted" && (
                              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">
                                Converted
                              </Badge>
                            )}
                            {lead.status === "contacted" && (
                              <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-[10px]">
                                Contacted
                              </Badge>
                            )}
                            {lead.status === "unresponsive" && (
                              <Badge className="bg-stone-100 text-stone-600 border-stone-200 text-[10px]">
                                Unresponsive
                              </Badge>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-bold text-stone-900">{lead.ticketsBought}</span>{" "}
                            tickets (₦{lead.totalSpent.toLocaleString()})
                          </td>
                          <td className="py-3.5 px-4 text-stone-600 text-[11px]">
                            {lead.lastContacted ? (
                              new Date(lead.lastContacted).toLocaleDateString("en-NG", {
                                month: "short",
                                day: "numeric",
                              })
                            ) : (
                              <span className="text-stone-400">Not contacted yet</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <Button
                              size="sm"
                              onClick={() => openLogCallForLead(lead)}
                              className="h-8 text-xs bg-emerald-800 hover:bg-emerald-900 text-white gap-1.5 shadow-xs"
                            >
                              <PhoneCall className="w-3 h-3" />
                              Log Call
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: CALL ACTIVITY HISTORY (DIRECT FROM FIRESTORE)   */}
        {/* ======================================================== */}
        {activeTab === "logs" && (
          <div className="space-y-4">
            {/* Filter controls */}
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-4 rounded-2xl border border-stone-200 shadow-xs">
              <div className="relative w-full sm:w-80">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                <Input
                  value={callLogSearch}
                  onChange={(e) => setCallLogSearch(e.target.value)}
                  placeholder="Search client, notes, duration, or rep..."
                  className="pl-8 text-xs h-9 bg-stone-50 border-stone-200"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <span className="text-xs text-stone-500 font-medium">Outcome:</span>
                <select
                  value={callOutcomeFilter}
                  onChange={(e) => setCallOutcomeFilter(e.target.value)}
                  className="text-xs bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1.5 text-stone-800 font-medium"
                >
                  <option value="all">All Outcomes ({callActivities.length})</option>
                  <option value="converted">Converted (Purchased Ticket)</option>
                  <option value="interested">Interested</option>
                  <option value="follow_up">Follow Up</option>
                  <option value="no_answer">No Answer</option>
                  <option value="not_interested">Not Interested</option>
                </select>
              </div>
            </div>

            {/* Activities Table */}
            <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-50 text-stone-600 font-semibold border-b border-stone-200">
                    <tr>
                      <th className="py-3 px-4">Date & Time</th>
                      <th className="py-3 px-4">Sales Rep</th>
                      <th className="py-3 px-4">Client / Lead</th>
                      <th className="py-3 px-4">Call Duration</th>
                      <th className="py-3 px-4">Call Type</th>
                      <th className="py-3 px-4">Outcome</th>
                      <th className="py-3 px-4">Call Notes</th>
                      <th className="py-3 px-4">Next Step</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {filteredActivities.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-10 text-center text-stone-400 text-xs">
                          No call activities recorded yet in Firestore. Click "Log New Call" to
                          record one!
                        </td>
                      </tr>
                    ) : (
                      filteredActivities.map((log) => (
                        <tr key={log.id} className="hover:bg-stone-50/60 transition-colors">
                          <td className="py-3.5 px-4 text-stone-600 text-[11px] whitespace-nowrap">
                            {new Date(log.createdAt).toLocaleDateString("en-NG", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-stone-900">
                            {log.staffName}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-stone-900">{log.clientName}</div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <a
                                href={`tel:${log.clientPhone.replace(/\s+/g, "")}`}
                                className="text-emerald-700 hover:underline font-mono text-[11px] inline-flex items-center gap-1"
                              >
                                <Phone className="w-3 h-3" />
                                {log.clientPhone}
                              </a>
                              {log.clientPhone && (
                                <a
                                  href={`https://wa.me/${log.clientPhone.replace(/[^0-9]/g, "")}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-emerald-600 hover:text-emerald-700"
                                  title="Chat on WhatsApp"
                                >
                                  <MessageSquare className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="inline-flex items-center gap-1 font-mono text-[11px] text-stone-800 bg-stone-100 px-2 py-0.5 rounded-md border border-stone-200">
                              <Timer className="w-3 h-3 text-emerald-700" />
                              <span>{log.callDuration || `${log.durationMinutes || 2} mins`}</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 capitalize text-stone-700">
                            {log.callType.replace("_", " ")}
                          </td>
                          <td className="py-3.5 px-4">
                            {log.outcome === "converted" && (
                              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px]">
                                Converted 🎯
                              </Badge>
                            )}
                            {log.outcome === "interested" && (
                              <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-[10px]">
                                Interested
                              </Badge>
                            )}
                            {log.outcome === "follow_up" && (
                              <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[10px]">
                                Follow-up
                              </Badge>
                            )}
                            {log.outcome === "no_answer" && (
                              <Badge className="bg-stone-100 text-stone-700 border-stone-200 text-[10px]">
                                No Answer
                              </Badge>
                            )}
                            {log.outcome === "not_interested" && (
                              <Badge className="bg-rose-100 text-rose-800 border-rose-200 text-[10px]">
                                Not Interested
                              </Badge>
                            )}
                          </td>
                          <td className="py-3.5 px-4 max-w-xs text-stone-800 text-xs">
                            <p className="line-clamp-2">{log.notes}</p>
                          </td>
                          <td className="py-3.5 px-4 text-xs whitespace-nowrap">
                            {log.followUpDate ? (
                              <div className="text-amber-700 font-semibold inline-flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                <Clock className="w-3 h-3" />
                                {new Date(log.followUpDate).toLocaleDateString("en-NG", {
                                  month: "short",
                                  day: "numeric",
                                })}
                              </div>
                            ) : (
                              <span className="text-stone-400 text-[11px]">—</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 3: SALES PITCH & TALKING POINTS                      */}
        {/* ======================================================== */}
        {activeTab === "pitch" && (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-xs space-y-4">
              <div className="flex items-center gap-2 text-emerald-900 font-bold">
                <Trophy className="w-5 h-5 text-emerald-700" />
                <h3 className="text-base font-extrabold">Active Competitions Talking Points</h3>
              </div>
              <div className="space-y-3 text-xs leading-relaxed text-stone-700">
                <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
                  <p className="font-bold text-stone-900">
                    Luxury 2-Bed Lekki Apartment (₦38,000,000)
                  </p>
                  <p className="text-stone-600 mt-1">
                    Entry is only ₦500. Independent cryptographic draw with SHA-256 seed. Fully
                    finished with deed handover in Lagos.
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
                  <p className="font-bold text-stone-900">2025 Lexus RX 350 SUV (₦45,000,000)</p>
                  <p className="text-stone-600 mt-1">
                    Brand new delivery with customs clearance and comprehensive insurance. Low
                    ticket cap guarantees genuine odds.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-xs space-y-4">
              <div className="flex items-center gap-2 text-emerald-900 font-bold">
                <CheckCircle2 className="w-5 h-5 text-emerald-700" />
                <h3 className="text-base font-extrabold">Common Objections & Responses</h3>
              </div>
              <div className="space-y-3 text-xs leading-relaxed text-stone-700">
                <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
                  <p className="font-bold text-stone-900">Q: "How do I know the draw is fair?"</p>
                  <p className="text-stone-600 mt-1">
                    A: Every draw uses a publicly verifiable SHA-256 cryptographic commit on the
                    blockchain/Firestore before tickets are issued. Anyone can verify the hash at{" "}
                    <code>/draw-verification</code>.
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
                  <p className="font-bold text-stone-900">Q: "How will I receive my prize?"</p>
                  <p className="text-stone-600 mt-1">
                    A: Physical prizes have an official handover ceremony in Lagos with legal deed
                    transfer. Cash prizes are paid instantly to verified Nigerian bank accounts.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* MODAL: LOG NEW CALL (SAVES TO crm_activities FIRESTORE)   */}
        {/* ======================================================== */}
        <Dialog open={isLogCallOpen} onOpenChange={setIsLogCallOpen}>
          <DialogContent className="sm:max-w-xl bg-white text-stone-900 border border-stone-200 shadow-2xl">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <DialogTitle className="flex items-center gap-2 text-emerald-950 font-extrabold text-base">
                  <PhoneCall className="w-5 h-5 text-emerald-700" />
                  Log New Call Activity
                </DialogTitle>
                <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  crm_activities (Firestore)
                </span>
              </div>
              <DialogDescription className="text-stone-500 text-xs">
                Captures call duration, outcome, and notes directly into the Firestore database for
                this lead.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSaveCallLog} className="space-y-4 py-2">
              {/* Lead Linkage Banner */}
              {selectedLead ? (
                <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[10px] uppercase font-bold text-emerald-700 tracking-wider">
                      Selected Lead
                    </span>
                    <div className="font-bold text-sm text-stone-900">{selectedLead.name}</div>
                    <div className="text-[11px] text-stone-600 font-mono">
                      {selectedLead.phone} {selectedLead.email && `• ${selectedLead.email}`}
                    </div>
                  </div>
                  <Badge className="bg-emerald-200/60 text-emerald-900 border-emerald-300 text-[10px] capitalize">
                    {selectedLead.status}
                  </Badge>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-stone-800">
                    Pick Lead from Real-Time Firestore Users
                  </label>
                  <select
                    onChange={(e) => {
                      const found = leads.find((l) => l.id === e.target.value);
                      if (found) {
                        setSelectedLead(found);
                        setClientName(found.name);
                        setClientPhone(found.phone);
                        setClientEmail(found.email || "");
                      }
                    }}
                    className="w-full text-xs bg-stone-50 border border-stone-200 rounded-lg p-2.5 text-stone-800 font-medium"
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Select an existing lead or enter details below...
                    </option>
                    {leads.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} ({l.phone} - {l.status})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Client Name & Phone */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-stone-800">
                    Client / Lead Name *
                  </label>
                  <Input
                    required
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="e.g. Babatunde Adeleke"
                    className="text-xs bg-stone-50"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-stone-800">Phone Number *</label>
                  <Input
                    required
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    placeholder="+234 803 000 0000"
                    className="text-xs bg-stone-50 font-mono"
                  />
                </div>
              </div>

              {/* CALL DURATION (Required by prompt) */}
              <div className="space-y-2 p-3 bg-stone-50 rounded-xl border border-stone-200">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                    <Timer className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Call Duration *</span>
                  </label>
                  <span className="text-[11px] font-mono text-emerald-800 font-semibold">
                    Captured: {callDuration}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {[1, 2, 3, 5, 8, 10, 15, 20, 30].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => handleQuickDuration(mins)}
                      className={`text-xs px-2.5 py-1 rounded-md font-mono transition-colors ${
                        durationMinutes === mins
                          ? "bg-emerald-800 text-white font-bold"
                          : "bg-white border border-stone-200 text-stone-700 hover:bg-stone-100"
                      }`}
                    >
                      {mins}m
                    </button>
                  ))}
                </div>

                <div className="pt-1">
                  <Input
                    required
                    value={callDuration}
                    onChange={(e) => {
                      setCallDuration(e.target.value);
                      const parsed = parseInt(e.target.value.replace(/[^0-9]/g, ""), 10);
                      if (!isNaN(parsed)) setDurationMinutes(parsed);
                    }}
                    placeholder="e.g. 4 mins, 05:30, or 12 mins"
                    className="text-xs bg-white h-8"
                  />
                </div>
              </div>

              {/* CALL OUTCOME (Required by prompt) */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-stone-800">Call Outcome *</label>
                  <select
                    value={outcome}
                    onChange={(e) => setOutcome(e.target.value as CallOutcome)}
                    className="w-full text-xs bg-stone-50 border border-stone-200 rounded-lg p-2.5 text-stone-900 font-bold focus:bg-white"
                  >
                    <option value="interested">Interested / High Intent</option>
                    <option value="converted">Converted (Purchased Ticket!)</option>
                    <option value="follow_up">Follow Up Scheduled</option>
                    <option value="no_answer">No Answer / Left Message</option>
                    <option value="not_interested">Not Interested</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-stone-800">Call Type</label>
                  <select
                    value={callType}
                    onChange={(e) => setCallType(e.target.value as CallType)}
                    className="w-full text-xs bg-stone-50 border border-stone-200 rounded-lg p-2.5 text-stone-800"
                  >
                    <option value="outbound_pitch">Outbound Sales Pitch</option>
                    <option value="inbound">Inbound Ticket Inquiry</option>
                    <option value="whatsapp">WhatsApp Outreach</option>
                    <option value="general_outreach">General Outreach</option>
                    <option value="winner_assistance">Winner Support</option>
                  </select>
                </div>
              </div>

              {/* Follow-up Date (if applicable) */}
              {outcome === "follow_up" && (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-stone-800">
                    Scheduled Follow-up Date
                  </label>
                  <Input
                    type="date"
                    required={outcome === "follow_up"}
                    value={followUpDate}
                    onChange={(e) => setFollowUpDate(e.target.value)}
                    className="text-xs bg-stone-50"
                  />
                </div>
              )}

              {/* CALL NOTES (Required by prompt) */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-800">
                  Call Notes & Conversation Details *
                </label>
                <textarea
                  required
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Detail client response, questions asked, competition interest, concerns addressed, and commitments made..."
                  className="w-full text-xs bg-stone-50 border border-stone-200 rounded-lg p-2.5 text-stone-900 focus:outline-emerald-700"
                />
              </div>

              <DialogFooter className="pt-2 border-t border-stone-100 flex items-center justify-between">
                <span className="text-[11px] text-stone-500">
                  Staff Rep: <strong>{session.name}</strong>
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsLogCallOpen(false)}
                    disabled={isSavingCall}
                    className="text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSavingCall}
                    className="text-xs bg-emerald-800 hover:bg-emerald-900 text-white gap-1.5 shadow-xs"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {isSavingCall ? "Saving to Firestore..." : "Save Directly to Firestore"}
                  </Button>
                </div>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}

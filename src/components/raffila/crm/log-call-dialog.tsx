import { useEffect, useState } from "react";
import { Clock, PhoneCall, Send, Timer } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createCRMTask,
  saveCallToCRMActivities,
  type CallOutcome,
  type CallType,
  type CRMActivity,
  type CRMLead,
  type StaffMember,
} from "@/lib/crm-service";
import { inputClass, selectClass, textareaClass } from "./crm-ui";

const CALL_TYPES: Array<{ value: CallType; label: string }> = [
  { value: "outbound_pitch", label: "Outbound sales pitch" },
  { value: "inbound", label: "Inbound ticket inquiry" },
  { value: "whatsapp", label: "WhatsApp outreach" },
  { value: "general_outreach", label: "General outreach" },
  { value: "winner_assistance", label: "Winner support" },
];

const OUTCOMES: Array<{ value: CallOutcome; label: string }> = [
  { value: "interested", label: "Interested / high intent" },
  { value: "converted", label: "Converted (ticket purchased)" },
  { value: "follow_up", label: "Follow up scheduled" },
  { value: "no_answer", label: "No answer / left message" },
  { value: "not_interested", label: "Not interested" },
];

export function LogCallDialog({
  open,
  onOpenChange,
  leads,
  session,
  initialLead,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leads: CRMLead[];
  session: StaffMember;
  initialLead?: CRMLead | null;
  onSaved?: (activity: CRMActivity) => void;
}) {
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [callDuration, setCallDuration] = useState("5 mins");
  const [durationMinutes, setDurationMinutes] = useState(5);
  const [callType, setCallType] = useState<CallType>("outbound_pitch");
  const [outcome, setOutcome] = useState<CallOutcome>("interested");
  const [notes, setNotes] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelectedLeadId(initialLead?.id ?? "");
    setClientName(initialLead?.name ?? "");
    setClientPhone(initialLead?.phone ?? "");
    setClientEmail(initialLead?.email ?? "");
    setCallDuration("5 mins");
    setDurationMinutes(5);
    setCallType("outbound_pitch");
    setOutcome("interested");
    setNotes("");
    setFollowUpDate("");
  }, [open, initialLead]);

  const selectedLead = leads.find((l) => l.id === selectedLeadId) ?? null;

  const quickDuration = (minutes: number) => {
    setDurationMinutes(minutes);
    setCallDuration(`${minutes} min${minutes > 1 ? "s" : ""}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim() || !clientPhone.trim() || !notes.trim()) {
      toast.error("Add the client name, phone number and call notes first");
      return;
    }
    if (outcome === "follow_up" && !followUpDate) {
      toast.error("Pick a follow-up date so it lands on your task board");
      return;
    }

    setIsSaving(true);
    try {
      const activity = await saveCallToCRMActivities({
        ...(selectedLead?.id ? { leadId: selectedLead.id } : {}),
        clientName: clientName.trim(),
        clientPhone: clientPhone.trim(),
        ...(clientEmail.trim() ? { clientEmail: clientEmail.trim() } : {}),
        callDuration: callDuration.trim() || `${durationMinutes} mins`,
        durationMinutes,
        outcome,
        notes: notes.trim(),
        callType,
        ...(followUpDate ? { followUpDate } : {}),
        staffKey: session.key,
        staffName: session.name,
      });

      if (outcome === "follow_up" && followUpDate) {
        await createCRMTask({
          title: `Follow up with ${clientName.trim()}`,
          description: notes.trim().slice(0, 240),
          ...(selectedLead?.id ? { leadId: selectedLead.id } : {}),
          contactName: clientName.trim(),
          dueDate: new Date(followUpDate).toISOString(),
          priority: "high",
          ownerName: session.name,
          ownerId: session.id,
        });
      }

      onSaved?.(activity);
      onOpenChange(false);
      toast.success("Call logged", {
        description: `${clientName} • ${outcome.replace("_", " ")}${
          outcome === "follow_up" && followUpDate ? " • task created" : ""
        }`,
      });
    } catch (err) {
      toast.error("Could not save the call", {
        description: err instanceof Error ? err.message : "Check your connection and try again",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto border-stone-200 bg-white text-stone-900 sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-extrabold text-stone-900">
            <PhoneCall className="h-5 w-5 text-emerald-700" />
            Log a call
          </DialogTitle>
          <DialogDescription className="text-xs font-medium text-stone-500">
            Capture the conversation, the outcome, and the next step.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-1">
          {selectedLead ? (
            <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2.5">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">
                  Linked lead
                </p>
                <p className="text-sm font-extrabold text-stone-900">{selectedLead.name}</p>
                <p className="font-mono text-[11px] text-stone-600">
                  {selectedLead.phone}
                  {selectedLead.email ? ` • ${selectedLead.email}` : ""}
                </p>
              </div>
              <Badge className="border-emerald-300 bg-white text-[10px] capitalize text-emerald-900">
                {selectedLead.status}
              </Badge>
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="text-[11px] font-extrabold uppercase tracking-wider text-stone-600">
                Link to a lead (optional)
              </label>
              <select
                value={selectedLeadId}
                onChange={(e) => {
                  const id = e.target.value;
                  setSelectedLeadId(id);
                  const found = leads.find((l) => l.id === id);
                  if (found) {
                    setClientName(found.name);
                    setClientPhone(found.phone);
                    setClientEmail(found.email || "");
                  }
                }}
                className={`${selectClass} h-10 w-full`}
              >
                <option value="">Not linked — enter details manually</option>
                {leads.slice(0, 200).map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} — {l.phone}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-[11px] font-extrabold uppercase tracking-wider text-stone-600">
                Client name *
              </label>
              <Input
                required
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Babatunde Adeleke"
                className="h-10 text-[13px]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-extrabold uppercase tracking-wider text-stone-600">
                Phone number *
              </label>
              <Input
                required
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                placeholder="+234 803 000 0000"
                className="h-10 font-mono text-[13px]"
              />
            </div>
          </div>

          <div className="space-y-2 rounded-xl border border-stone-200 bg-stone-50/70 p-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-stone-600">
                <Timer className="h-3.5 w-3.5 text-emerald-700" />
                Call duration *
              </span>
              <span className="font-mono text-[11px] font-bold text-emerald-800">{callDuration}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[1, 2, 3, 5, 8, 10, 15, 20, 30].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => quickDuration(mins)}
                  className={`rounded-md px-2.5 py-1 font-mono text-[11px] font-bold transition ${
                    durationMinutes === mins
                      ? "bg-emerald-800 text-white shadow-sm"
                      : "border border-stone-200 bg-white text-stone-700 hover:bg-stone-100"
                  }`}
                >
                  {mins}m
                </button>
              ))}
            </div>
            <Input
              value={callDuration}
              onChange={(e) => {
                setCallDuration(e.target.value);
                const parsed = parseInt(e.target.value.replace(/[^0-9]/g, ""), 10);
                if (!Number.isNaN(parsed)) setDurationMinutes(parsed);
              }}
              placeholder="e.g. 4 mins or 05:30"
              className="h-9 bg-white text-[13px]"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-[11px] font-extrabold uppercase tracking-wider text-stone-600">
                Outcome *
              </label>
              <select
                value={outcome}
                onChange={(e) => setOutcome(e.target.value as CallOutcome)}
                className={`${selectClass} h-10 w-full`}
              >
                {OUTCOMES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-extrabold uppercase tracking-wider text-stone-600">
                Call type
              </label>
              <select
                value={callType}
                onChange={(e) => setCallType(e.target.value as CallType)}
                className={`${selectClass} h-10 w-full`}
              >
                {CALL_TYPES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {outcome === "follow_up" ? (
            <div className="space-y-1.5 rounded-xl border border-amber-200 bg-amber-50/70 p-3">
              <label className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-amber-800">
                <Clock className="h-3.5 w-3.5" />
                Follow-up date * — creates a task automatically
              </label>
              <Input
                type="date"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
                className="h-10 bg-white text-[13px]"
              />
            </div>
          ) : null}

          <div className="space-y-1.5">
            <label className="text-[11px] font-extrabold uppercase tracking-wider text-stone-600">
              Call notes *
            </label>
            <textarea
              required
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What did they say? Objections, competitions they liked, budget, and what happens next…"
              className={textareaClass}
            />
          </div>

          <DialogFooter className="flex items-center justify-between gap-2 border-t border-stone-100 pt-3 sm:justify-between">
            <span className="text-[11px] font-semibold text-stone-500">
              Rep: <strong className="text-stone-800">{session.name}</strong>
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSaving}
                className="h-9 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSaving}
                className="h-9 gap-1.5 bg-emerald-800 text-xs font-bold text-white hover:bg-emerald-900"
              >
                <Send className="h-3.5 w-3.5" />
                {isSaving ? "Saving…" : "Save call"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import { useMemo, useState } from "react";
import { Copy, FileText, MessageSquare, Pencil, PhoneCall, Plus, Sparkles, Trash2 } from "lucide-react";
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
  createCRMTemplate,
  deleteCRMTemplate,
  seedStarterTemplates,
  updateCRMTemplate,
  type CRMCompetition,
  type CRMLead,
  type CRMTemplate,
  type StaffMember,
  type TemplateChannel,
} from "@/lib/crm-service";
import {
  EmptyState,
  Panel,
  PanelHeader,
  formatDate,
  inputClass,
  selectClass,
  textareaClass,
} from "./crm-ui";

const CHANNELS: Array<{ id: TemplateChannel | "all"; label: string; icon: React.ReactNode }> = [
  { id: "all", label: "All", icon: <FileText className="h-3.5 w-3.5" /> },
  { id: "email", label: "Email", icon: <FileText className="h-3.5 w-3.5" /> },
  { id: "whatsapp", label: "WhatsApp", icon: <MessageSquare className="h-3.5 w-3.5" /> },
  { id: "call_script", label: "Call script", icon: <PhoneCall className="h-3.5 w-3.5" /> },
];

export function TemplatesPanel({
  templates,
  leads,
  competitions,
  session,
}: {
  templates: CRMTemplate[];
  leads: CRMLead[];
  competitions: CRMCompetition[];
  session: StaffMember;
}) {
  const [channel, setChannel] = useState<TemplateChannel | "all">("all");
  const [personaliseFor, setPersonaliseFor] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<CRMTemplate | null>(null);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [formChannel, setFormChannel] = useState<TemplateChannel>("email");
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const visible = useMemo(
    () => (channel === "all" ? templates : templates.filter((t) => t.channel === channel)),
    [templates, channel],
  );

  const lead = leads.find((l) => l.id === personaliseFor);
  const liveCompetitionCount = competitions.filter(
    (c) => c.status === "LIVE" || c.status === "CLOSING SOON",
  ).length;

  const render = (text: string) => {
    if (!lead) return text;
    return text
      .replace(/\{\{name\}\}/g, lead.name.split(" ")[0] || lead.name)
      .replace(/\{\{full_name\}\}/g, lead.name)
      .replace(/\{\{email\}\}/g, lead.email)
      .replace(/\{\{phone\}\}/g, lead.phone)
      .replace(/\{\{rep\}\}/g, session.name);
  };

  const openNew = () => {
    setEditing(null);
    setName("");
    setSubject("");
    setBody("");
    setFormChannel("email");
    setIsOpen(true);
  };

  const openEdit = (template: CRMTemplate) => {
    setEditing(template);
    setName(template.name);
    setSubject(template.subject ?? "");
    setBody(template.body);
    setFormChannel(template.channel);
    setIsOpen(true);
  };

  const save = async () => {
    if (!name.trim() || !body.trim()) {
      toast.error("A template needs a name and body");
      return;
    }
    setSaving(true);
    if (editing) {
      const ok = await updateCRMTemplate(editing.id, {
        name: name.trim(),
        channel: formChannel,
        ...(formChannel === "email" ? { subject: subject.trim() } : {}),
        body: body.trim(),
      });
      setSaving(false);
      if (ok) {
        setIsOpen(false);
        toast.success("Template updated");
      } else {
        toast.error("Could not update the template");
      }
      return;
    }
    const res = await createCRMTemplate({
      name: name.trim(),
      channel: formChannel,
      ...(formChannel === "email" ? { subject: subject.trim() } : {}),
      body: body.trim(),
      createdBy: session.name,
    });
    setSaving(false);
    if (res.id) {
      setIsOpen(false);
      toast.success("Template saved");
    } else {
      toast.error(res.error || "Could not save the template");
    }
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(render(text));
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Clipboard blocked — select and copy manually");
    }
  };

  const installStarters = async () => {
    setSeeding(true);
    const ok = await seedStarterTemplates(session.name, competitions);
    setSeeding(false);
    if (ok) {
      toast.success(
        liveCompetitionCount
          ? `Starter templates installed from ${liveCompetitionCount} live competition${liveCompetitionCount === 1 ? "" : "s"}`
          : "Starter templates installed",
      );
    } else {
      toast.error("Could not install starter templates");
    }
  };

  return (
    <div className="space-y-4">
      <Panel className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1.5">
            {CHANNELS.map((c) => (
              <button
                key={c.id}
                onClick={() => setChannel(c.id)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-extrabold transition ${
                  channel === c.id
                    ? "bg-emerald-800 text-white shadow-sm"
                    : "border border-stone-200 bg-white text-stone-700 hover:bg-stone-50"
                }`}
              >
                {c.icon}
                {c.label}
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <select
              value={personaliseFor}
              onChange={(e) => setPersonaliseFor(e.target.value)}
              className={`${selectClass} h-9`}
            >
              <option value="">Personalise for…</option>
              {leads.slice(0, 200).map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            <Button
              onClick={openNew}
              className="h-9 gap-1.5 bg-emerald-800 text-xs font-bold text-white hover:bg-emerald-900"
            >
              <Plus className="h-3.5 w-3.5" /> New template
            </Button>
          </div>
        </div>
        <p className="mt-2 border-t border-stone-100 pt-2 text-[11px] font-medium text-stone-500">
          Merge tags:{" "}
          <code className="rounded bg-stone-100 px-1 font-bold text-stone-700">{"{{name}}"}</code>{" "}
          <code className="rounded bg-stone-100 px-1 font-bold text-stone-700">{"{{full_name}}"}</code>{" "}
          <code className="rounded bg-stone-100 px-1 font-bold text-stone-700">{"{{email}}"}</code>{" "}
          <code className="rounded bg-stone-100 px-1 font-bold text-stone-700">{"{{phone}}"}</code>{" "}
          <code className="rounded bg-stone-100 px-1 font-bold text-stone-700">{"{{rep}}"}</code>
          {lead ? <span className="ml-2 font-bold text-emerald-800">Previewing as {lead.name}</span> : null}
        </p>
      </Panel>

      {visible.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<FileText className="h-5 w-5" />}
            title="No templates in this view"
            body="Install the starter set — it is built from your live competitions, so prize names, entry prices and close dates are real. Edit any of them to match your voice."
            action={
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button
                  onClick={() => void installStarters()}
                  disabled={seeding}
                  className="h-9 gap-1.5 bg-emerald-800 text-xs font-bold text-white hover:bg-emerald-900"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {seeding
                    ? "Installing…"
                    : liveCompetitionCount
                      ? `Install from ${liveCompetitionCount} live competition${liveCompetitionCount === 1 ? "" : "s"}`
                      : "Install starter templates"}
                </Button>
                <Button variant="outline" onClick={openNew} className="h-9 gap-1.5 text-xs font-bold">
                  <Plus className="h-3.5 w-3.5" /> Write my own
                </Button>
              </div>
            }
          />
        </Panel>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {visible.map((template) => (
            <Panel key={template.id} className="flex flex-col">
              <PanelHeader
                className="px-4 py-3"
                title={template.name}
                subtitle={`${template.channel.replace("_", " ")} • ${formatDate(template.createdAt)}`}
                icon={
                  template.channel === "whatsapp" ? (
                    <MessageSquare className="h-4 w-4" />
                  ) : template.channel === "call_script" ? (
                    <PhoneCall className="h-4 w-4" />
                  ) : (
                    <FileText className="h-4 w-4" />
                  )
                }
              />
              <div className="flex-1 px-4 py-3">
                {template.subject ? (
                  <p className="mb-1.5 text-[11px] font-extrabold text-stone-500">
                    Subject: <span className="text-stone-800">{render(template.subject)}</span>
                  </p>
                ) : null}
                <p className="max-h-40 overflow-y-auto whitespace-pre-line text-xs leading-relaxed text-stone-700">
                  {render(template.body)}
                </p>
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-stone-100 px-4 py-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                  {template.createdBy ? `by ${template.createdBy}` : "Template"}
                </span>
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    onClick={() => void copy(template.body)}
                    className="h-8 gap-1.5 bg-emerald-800 text-[11px] font-bold text-white hover:bg-emerald-900"
                  >
                    <Copy className="h-3 w-3" /> Copy
                  </Button>
                  <button
                    onClick={() => openEdit(template)}
                    className="rounded-md border border-stone-200 bg-white p-1.5 text-stone-600 transition hover:bg-stone-50"
                    aria-label="Edit template"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={async () => {
                      const ok = await deleteCRMTemplate(template.id);
                      if (ok) toast.success("Template deleted");
                      else toast.error("Could not delete the template");
                    }}
                    className="rounded-md border border-stone-200 bg-white p-1.5 text-stone-500 transition hover:bg-rose-50 hover:text-rose-600"
                    aria-label="Delete template"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </Panel>
          ))}
        </div>
      )}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto border-stone-200 bg-white sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-stone-900">
              {editing ? "Edit template" : "New template"}
            </DialogTitle>
            <DialogDescription className="text-xs font-medium text-stone-500">
              Use merge tags so the copy personalises per lead.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-[11px] font-extrabold uppercase tracking-wider text-stone-600">
                Template name *
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Follow-up — abandoned entry"
                className={inputClass}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-extrabold uppercase tracking-wider text-stone-600">
                Channel
              </label>
              <select
                value={formChannel}
                onChange={(e) => setFormChannel(e.target.value as TemplateChannel)}
                className={`${selectClass} h-9 w-full`}
              >
                <option value="email">Email</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="call_script">Call script</option>
              </select>
            </div>

            {formChannel === "email" ? (
              <div className="space-y-1.5">
                <label className="text-[11px] font-extrabold uppercase tracking-wider text-stone-600">
                  Subject
                </label>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="{{name}}, your next win is one entry away"
                  className={inputClass}
                />
              </div>
            ) : null}

            <div className="space-y-1.5">
              <label className="text-[11px] font-extrabold uppercase tracking-wider text-stone-600">
                Body *
              </label>
              <textarea
                rows={9}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={"Hi {{name}},\n\n…"}
                className={textareaClass}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsOpen(false)} className="h-9 text-xs">
              Cancel
            </Button>
            <Button
              onClick={() => void save()}
              disabled={saving}
              className="h-9 gap-1.5 bg-emerald-800 text-xs font-bold text-white hover:bg-emerald-900"
            >
              <Plus className="h-3.5 w-3.5" />
              {saving ? "Saving…" : editing ? "Save changes" : "Create template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

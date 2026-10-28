import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { CallOutcome, DealStage, LeadStatus, ScoreBand, TaskPriority } from "@/lib/crm-service";
import { DEAL_STAGES } from "@/lib/crm-service";

/* ------------------------------- formatting ------------------------------- */

export function formatNaira(value: number): string {
  const n = Number(value) || 0;
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}m`;
  if (n >= 100_000) return `₦${Math.round(n / 1000)}k`;
  return `₦${n.toLocaleString("en-NG")}`;
}

export function formatNairaFull(value: number): string {
  return `₦${(Number(value) || 0).toLocaleString("en-NG")}`;
}

export function formatDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-NG", { month: "short", day: "numeric", year: "numeric" });
}

export function formatDateTime(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-NG", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function relativeTime(iso?: string): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const diff = Date.now() - t;
  const mins = Math.round(diff / 60000);
  if (Math.abs(mins) < 1) return "just now";
  if (Math.abs(mins) < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (Math.abs(hours) < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return `${days}d ago`;
  return formatDate(iso);
}

export function dueLabel(iso?: string): { label: string; tone: string } {
  if (!iso) return { label: "No due date", tone: "text-stone-500" };
  const due = new Date(iso);
  if (Number.isNaN(due.getTime())) return { label: "No due date", tone: "text-stone-500" };
  const today = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfDay(due) - startOfDay(today)) / 86400000);
  if (diffDays < 0)
    return { label: `${Math.abs(diffDays)}d overdue`, tone: "text-rose-700 font-extrabold" };
  if (diffDays === 0) return { label: "Due today", tone: "text-amber-700 font-extrabold" };
  if (diffDays === 1) return { label: "Due tomorrow", tone: "text-amber-700 font-bold" };
  if (diffDays <= 7) return { label: `Due in ${diffDays}d`, tone: "text-stone-700 font-semibold" };
  return { label: formatDate(iso), tone: "text-stone-600" };
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const first = parts[0] ?? "?";
  if (parts.length === 1) return first.slice(0, 2).toUpperCase();
  const last = parts[parts.length - 1] ?? "";
  return (first.charAt(0) + last.charAt(0)).toUpperCase();
}

/* --------------------------------- layout -------------------------------- */

export function Panel({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-stone-200/90 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.05),0_12px_32px_-20px_rgba(16,24,40,0.25)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PanelHeader({
  title,
  subtitle,
  icon,
  action,
  className,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-3 border-b border-stone-100 px-5 py-4",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        {icon ? (
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100">
            {icon}
          </span>
        ) : null}
        <div>
          <h2 className="text-[15px] font-extrabold tracking-tight text-stone-900">{title}</h2>
          {subtitle ? (
            <p className="mt-0.5 text-xs font-medium leading-relaxed text-stone-500">{subtitle}</p>
          ) : null}
        </div>
      </div>
      {action}
    </div>
  );
}

const TONES = {
  emerald: { icon: "bg-emerald-50 text-emerald-700 ring-emerald-100", value: "text-stone-900" },
  amber: { icon: "bg-amber-50 text-amber-700 ring-amber-100", value: "text-stone-900" },
  rose: { icon: "bg-rose-50 text-rose-700 ring-rose-100", value: "text-stone-900" },
  indigo: { icon: "bg-indigo-50 text-indigo-700 ring-indigo-100", value: "text-stone-900" },
  stone: { icon: "bg-stone-100 text-stone-700 ring-stone-200", value: "text-stone-900" },
} as const;

export type StatTone = keyof typeof TONES;

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "emerald",
  footer,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  tone?: StatTone;
  footer?: ReactNode;
}) {
  const t = TONES[tone];
  return (
    <Panel className="p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-wider text-stone-500">{label}</p>
        {icon ? (
          <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl ring-1", t.icon)}>
            {icon}
          </span>
        ) : null}
      </div>
      <p className={cn("mt-2 text-[28px] font-extrabold leading-none tracking-tight", t.value)}>
        {value}
      </p>
      {hint ? <p className="mt-1.5 text-xs font-semibold text-stone-500">{hint}</p> : null}
      {footer ? <div className="mt-3">{footer}</div> : null}
    </Panel>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      {icon ? (
        <span className="mb-1 flex h-11 w-11 items-center justify-center rounded-2xl bg-stone-100 text-stone-500">
          {icon}
        </span>
      ) : null}
      <p className="text-sm font-extrabold text-stone-800">{title}</p>
      {body ? (
        <p className="max-w-sm text-xs font-medium leading-relaxed text-stone-500">{body}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/* --------------------------------- badges -------------------------------- */

const LEAD_STATUS_STYLE: Record<LeadStatus, string> = {
  new: "bg-sky-50 text-sky-800 ring-sky-200",
  contacted: "bg-blue-50 text-blue-800 ring-blue-200",
  qualified: "bg-indigo-50 text-indigo-800 ring-indigo-200",
  hot: "bg-orange-50 text-orange-800 ring-orange-200",
  warm: "bg-amber-50 text-amber-800 ring-amber-200",
  converted: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  lost: "bg-stone-100 text-stone-700 ring-stone-200",
  unresponsive: "bg-stone-100 text-stone-600 ring-stone-200",
};

export function LeadStatusPill({ status }: { status: LeadStatus }) {
  const style = LEAD_STATUS_STYLE[status] ?? LEAD_STATUS_STYLE.new;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ring-1",
        style,
      )}
    >
      {status}
    </span>
  );
}

const OUTCOME_STYLE: Record<CallOutcome, { label: string; style: string }> = {
  converted: { label: "Converted", style: "bg-emerald-50 text-emerald-800 ring-emerald-200" },
  interested: { label: "Interested", style: "bg-blue-50 text-blue-800 ring-blue-200" },
  follow_up: { label: "Follow up", style: "bg-amber-50 text-amber-800 ring-amber-200" },
  no_answer: { label: "No answer", style: "bg-stone-100 text-stone-700 ring-stone-200" },
  not_interested: { label: "Not interested", style: "bg-rose-50 text-rose-800 ring-rose-200" },
};

export function OutcomePill({ outcome }: { outcome: CallOutcome }) {
  const o = OUTCOME_STYLE[outcome] ?? OUTCOME_STYLE.interested;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ring-1",
        o.style,
      )}
    >
      {o.label}
    </span>
  );
}

const SCORE_STYLE: Record<ScoreBand, string> = {
  hot: "bg-orange-500 text-white ring-orange-600",
  warm: "bg-amber-400 text-amber-950 ring-amber-500",
  cold: "bg-stone-200 text-stone-700 ring-stone-300",
};

export function ScorePill({ score, band }: { score: number; band: ScoreBand }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold ring-1",
        SCORE_STYLE[band],
      )}
      title={`Lead score ${score}/100`}
    >
      <span className="tabular-nums">{score}</span>
      <span className="opacity-80">/100</span>
    </span>
  );
}

export function StagePill({ stage }: { stage: DealStage }) {
  const meta = DEAL_STAGES.find((s) => s.id === stage) ?? DEAL_STAGES[0]!;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-stone-700 ring-1 ring-stone-200">
      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </span>
  );
}

const PRIORITY_STYLE: Record<TaskPriority, string> = {
  high: "bg-rose-50 text-rose-800 ring-rose-200",
  medium: "bg-amber-50 text-amber-800 ring-amber-200",
  low: "bg-stone-100 text-stone-600 ring-stone-200",
};

export function PriorityPill({ priority }: { priority: TaskPriority }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ring-1",
        PRIORITY_STYLE[priority],
      )}
    >
      {priority}
    </span>
  );
}

export function LeadAvatar({
  name,
  size = "md",
  band,
}: {
  name: string;
  size?: "sm" | "md" | "lg";
  band?: ScoreBand | undefined;
}) {
  const dims =
    size === "lg" ? "h-12 w-12 text-base" : size === "sm" ? "h-8 w-8 text-[11px]" : "h-10 w-10 text-xs";
  const bg =
    band === "hot"
      ? "bg-orange-100 text-orange-800 ring-orange-200"
      : band === "warm"
        ? "bg-amber-100 text-amber-800 ring-amber-200"
        : "bg-emerald-100 text-emerald-800 ring-emerald-200";
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-extrabold ring-1",
        dims,
        bg,
      )}
    >
      {initials(name)}
    </span>
  );
}

/* ------------------------------- controls -------------------------------- */

export const selectClass =
  "h-9 rounded-lg border border-stone-200 bg-white px-2.5 text-xs font-semibold text-stone-800 shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";

export const inputClass =
  "h-9 w-full rounded-lg border border-stone-200 bg-white px-3 text-xs font-medium text-stone-900 shadow-sm outline-none transition placeholder:text-stone-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";

export const textareaClass =
  "w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-medium leading-relaxed text-stone-900 shadow-sm outline-none transition placeholder:text-stone-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";

export function SearchField({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <svg
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(inputClass, "h-10 pl-9 pr-8 text-[13px]")}
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
          aria-label="Clear search"
        >
          <svg
            className="h-3.5 w-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}

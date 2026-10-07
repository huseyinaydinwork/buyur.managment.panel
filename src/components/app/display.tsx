import Link from "next/link";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  FileText,
  Mail,
  MessageCircle,
  Minus,
  MoveRight,
  Phone,
  PlusCircle,
  Presentation,
  Trophy,
  Users,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Badge, type Tone } from "@/components/ui/misc";
import {
  CAMPAIGN_STATUS_LABELS,
  CONTENT_STATUS_LABELS,
  LEAD_STATUS_LABELS,
  PROJECT_STATUS_LABELS,
  PROJECT_TEAM_LABELS,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  label,
} from "@/lib/constants";
import { fmtPct, fmtRelative, fmtNumber } from "@/lib/format";
import { scoreTone } from "@/lib/lead-score";
import { cn } from "@/lib/utils";
import type { ActivityView } from "@/lib/activity-format";

export const LEAD_STATUS_TONE: Record<string, Tone> = {
  NEW: "neutral",
  CONTACTED: "blue",
  QUALIFIED: "blue",
  DEMO_SCHEDULED: "amber",
  DEMO_COMPLETED: "amber",
  TRIAL: "amber",
  NEGOTIATION: "red",
  WON: "green",
  LOST: "outline",
};

export function LeadStatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge tone={LEAD_STATUS_TONE[status] ?? "neutral"} className={className}>
      {label(LEAD_STATUS_LABELS, status)}
    </Badge>
  );
}

export function ScoreBadge({ score }: { score: number }) {
  const t = scoreTone(score);
  return (
    <span
      title={`Lead score ${score}/100`}
      className={cn(
        "inline-flex h-5 min-w-8 items-center justify-center rounded px-1 text-[11px] font-semibold tabular",
        t === "high" && "bg-success-soft text-success",
        t === "mid" && "bg-warning-soft text-warning",
        t === "low" && "bg-secondary text-muted-foreground",
      )}
    >
      {score}
    </span>
  );
}

const CAMPAIGN_TONE: Record<string, Tone> = { DRAFT: "outline", ACTIVE: "green", PAUSED: "amber", COMPLETED: "neutral" };
export function CampaignStatusBadge({ status }: { status: string }) {
  return <Badge tone={CAMPAIGN_TONE[status] ?? "neutral"}>{label(CAMPAIGN_STATUS_LABELS, status)}</Badge>;
}

const CONTENT_TONE: Record<string, Tone> = { IDEA: "outline", SCRIPT: "neutral", DESIGN: "blue", APPROVAL: "amber", SCHEDULED: "red", PUBLISHED: "green" };
export function ContentStatusBadge({ status }: { status: string }) {
  return <Badge tone={CONTENT_TONE[status] ?? "neutral"}>{label(CONTENT_STATUS_LABELS, status)}</Badge>;
}

export function TaskStatusBadge({ status }: { status: string }) {
  return <Badge tone={status === "DONE" ? "green" : status === "IN_PROGRESS" ? "blue" : "neutral"}>{label(TASK_STATUS_LABELS, status)}</Badge>;
}
export function PriorityBadge({ priority }: { priority: string }) {
  return <Badge tone={priority === "HIGH" ? "red" : priority === "MEDIUM" ? "amber" : "outline"}>{label(TASK_PRIORITY_LABELS, priority)}</Badge>;
}

// ─── KPI ─────────────────────────────────────────────────────────────────────

export function KpiCard({
  label: title,
  value,
  change,
  hint,
  href,
}: {
  label: string;
  value: string;
  change?: number | null;
  hint?: React.ReactNode;
  href?: string;
}) {
  const body = (
    <div className="flex h-full flex-col gap-1 rounded-lg border bg-card px-4 py-3 transition-colors hover:border-foreground/15">
      <p className="text-[12px] font-medium text-muted-foreground">{title}</p>
      <p className="text-[22px] font-semibold leading-tight tracking-tight tabular">{value}</p>
      <div className="flex items-center gap-1.5 text-[11.5px]">
        {change !== undefined && <Delta change={change} />}
        {hint && <span className="truncate text-muted-foreground">{hint}</span>}
      </div>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export function Delta({ change }: { change: number | null }) {
  if (change == null) return <span className="text-muted-foreground">new</span>;
  const up = change > 0.05;
  const down = change < -0.05;
  const Icon = up ? ArrowUpRight : down ? ArrowDownRight : Minus;
  return (
    <span className={cn("inline-flex items-center gap-0.5 font-semibold tabular", up && "text-success", down && "text-destructive", !up && !down && "text-muted-foreground")}>
      <Icon className="size-3.5" />
      {up ? "+" : ""}
      {change.toFixed(0)}%
    </span>
  );
}

// ─── Funnel ──────────────────────────────────────────────────────────────────

export type FunnelStep = { key: string; label: string; count: number; fromPrevious: number | null; overall: number | null };

export function FunnelBars({ steps }: { steps: FunnelStep[] }) {
  const max = Math.max(1, steps[0]?.count ?? 1);
  return (
    <div className="flex flex-col gap-2.5">
      {steps.map((s, i) => (
        <div key={s.key} className="grid grid-cols-[88px_1fr_auto] items-center gap-3 sm:grid-cols-[110px_1fr_150px]">
          <span className="text-[13px] font-medium">{s.label}</span>
          <div className="h-7 overflow-hidden rounded bg-muted">
            <div
              className={cn("flex h-full items-center rounded px-2 text-[12px] font-semibold text-white tabular", i === steps.length - 1 ? "bg-primary" : "bg-foreground/85")}
              style={{ width: `${Math.max(4, (s.count / max) * 100)}%` }}
            >
              {fmtNumber(s.count)}
            </div>
          </div>
          <div className="text-right text-[11.5px] leading-tight text-muted-foreground tabular">
            {i === 0 ? (
              <span>cohort</span>
            ) : (
              <>
                <span className="font-semibold text-foreground">{fmtPct(s.fromPrevious)}</span> of prev
                <span className="hidden sm:inline"> · {fmtPct(s.overall)} overall</span>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ShareBars({ rows }: { rows: { name: string; count: number; share: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="flex flex-col gap-2">
      {rows.map((r) => (
        <div key={r.name} className="grid grid-cols-[110px_1fr_70px] items-center gap-3 text-[13px]">
          <span className="truncate">{r.name}</span>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${(r.count / max) * 100}%` }} />
          </div>
          <span className="text-right text-muted-foreground tabular">
            <span className="font-semibold text-foreground">{r.count}</span> · {fmtPct(r.share, 0)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Activity ────────────────────────────────────────────────────────────────

const ACTIVITY_ICONS: Record<string, LucideIcon> = {
  NOTE: FileText,
  CALL: Phone,
  WHATSAPP: MessageCircle,
  EMAIL: Mail,
  MEETING: Users,
  DEMO: Presentation,
  FOLLOW_UP: CalendarClock,
  STATUS_CHANGE: MoveRight,
  DEAL_WON: Trophy,
  DEAL_LOST: XCircle,
  TASK_COMPLETED: CheckCircle2,
};

export function ActivityIcon({ type, className }: { type: string; className?: string }) {
  const Icon = ACTIVITY_ICONS[type] ?? PlusCircle;
  return (
    <span
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-full border bg-card text-muted-foreground",
        type === "DEAL_WON" && "border-success/30 bg-success-soft text-success",
        type === "DEAL_LOST" && "text-destructive",
        type === "STATUS_CHANGE" && "text-primary",
        className,
      )}
    >
      <Icon className="size-3.5" />
    </span>
  );
}

export function ActivityFeed({ items, showTarget = true, compact }: { items: ActivityView[]; showTarget?: boolean; compact?: boolean }) {
  return (
    <ol className="flex flex-col">
      {items.map((a) => (
        <li key={a.id} className={cn("flex gap-3 border-b px-4 last:border-0", compact ? "py-2.5" : "py-3")}>
          <ActivityIcon type={a.type} />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] leading-snug">
              <span className="font-semibold">{a.actor}</span> <span className="text-muted-foreground">{a.verb}</span>{" "}
              {showTarget && a.target && (a.href ? (
                <Link href={a.href} className="font-medium hover:text-primary hover:underline">
                  {a.target}
                </Link>
              ) : (
                <span className="font-medium">{a.target}</span>
              ))}
              {a.detail && <span className="text-muted-foreground"> · {a.detail}</span>}
            </p>
            {a.body && <p className="mt-1 line-clamp-3 whitespace-pre-line text-[12.5px] text-foreground/75">{a.body}</p>}
          </div>
          <time className="shrink-0 whitespace-nowrap text-[11px] text-muted-foreground" dateTime={a.createdAt.toISOString()} title={a.createdAt.toLocaleString("en-GB")}>
            {fmtRelative(a.createdAt)}
          </time>
        </li>
      ))}
    </ol>
  );
}

// ─── Projects ────────────────────────────────────────────────────────────────

const PROJECT_TONE: Record<string, Tone> = { PLANNING: "outline", ACTIVE: "green", ON_HOLD: "amber", DONE: "neutral" };
export function ProjectStatusBadge({ status }: { status: string }) {
  return <Badge tone={PROJECT_TONE[status] ?? "neutral"}>{label(PROJECT_STATUS_LABELS, status)}</Badge>;
}

const TEAM_TONE: Record<string, Tone> = { GENERAL: "outline", MARKETING: "amber", SALES: "blue" };
export function TeamBadge({ team }: { team: string }) {
  return <Badge tone={TEAM_TONE[team] ?? "outline"}>{label(PROJECT_TEAM_LABELS, team)}</Badge>;
}

export function ProgressBar({ done, total, className }: { done: number; total: number; className?: string }) {
  const p = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${p}%` }} />
      </div>
      <span className="w-16 shrink-0 text-right text-[11.5px] text-muted-foreground tabular">
        {done}/{total} · {p}%
      </span>
    </div>
  );
}

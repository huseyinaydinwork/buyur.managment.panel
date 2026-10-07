"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  CalendarPlus,
  Check,
  ChevronDown,
  ListPlus,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Phone,
  StickyNote,
  Trash2,
  X,
} from "lucide-react";
import { changeLeadStage, deleteLead, logLeadActivity } from "@/actions/leads";
import { cancelFollowUp } from "@/actions/followups";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown";
import { Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/misc";
import {
  ACTIVITY_TYPE_LABELS,
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  OPEN_STATUSES,
  type LeadStatus,
  type LoggableActivityType,
} from "@/lib/constants";
import { daysOverdue, fmtSmartDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { TaskDialog } from "./forms/task-form";
import { LeadScriptsDialog, type PlaybookItem } from "./playbook";
import type { PlaybookVars } from "@/lib/playbook";
import {
  CompleteFollowUpDialog,
  FollowUpDialog,
  LeadEditDialog,
  LogActivityDialog,
  StageChangeDialog,
  needsStageDialog,
  type LeadEditValue,
} from "./lead-dialogs";
import { useAction } from "./use-action";

type LeadCore = {
  id: string;
  name: string;
  businessId: string;
  status: string;
  value: number;
  demoDate: string | null;
  ownerId: string | null;
  tel: string | null;
  whatsapp: string | null;
};

// ─── Header quick actions ────────────────────────────────────────────────────

export function LeadQuickActions({
  lead,
  edit,
  contacts,
  sources,
  campaigns,
  canEdit,
  isAdmin,
  scripts,
}: {
  scripts?: { entries: PlaybookItem[]; vars: PlaybookVars; whatsappBase: string | null } | null;
  lead: LeadCore;
  edit: LeadEditValue;
  contacts: { id: string; name: string; phone: string | null }[];
  sources: { id: string; name: string }[];
  campaigns: { id: string; name: string }[];
  canEdit: boolean;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [log, setLog] = useState<LoggableActivityType | null>(null);
  const [dialog, setDialog] = useState<null | "followup" | "task" | "edit" | "delete" | "scripts">(null);
  const [stageTarget, setStageTarget] = useState<LeadStatus | null>(null);
  const { run, pending } = useAction();

  const moveTo = (s: LeadStatus) => {
    if (s === lead.status) return;
    if (needsStageDialog(s)) setStageTarget(s);
    else run(() => changeLeadStage({ id: lead.id, status: s }), { success: `Moved to ${LEAD_STATUS_LABELS[s]}` });
  };

  const openThenLog = (type: LoggableActivityType) => {
    // Let the tel:/wa.me link open first, then prompt to log the conversation.
    setTimeout(() => setLog(type), 400);
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {lead.tel ? (
        <Button asChild size="sm" variant="dark">
          <a href={lead.tel} onClick={() => openThenLog("CALL")}>
            <Phone /> Call
          </a>
        </Button>
      ) : (
        <Button size="sm" variant="dark" disabled title="No phone number">
          <Phone /> Call
        </Button>
      )}
      {lead.whatsapp ? (
        <Button asChild size="sm" variant="outline">
          <a href={lead.whatsapp} target="_blank" rel="noopener noreferrer" onClick={() => openThenLog("WHATSAPP")}>
            <MessageCircle className="text-success" /> WhatsApp
          </a>
        </Button>
      ) : null}
      <Button size="sm" variant="outline" onClick={() => setLog("NOTE")}>
        <StickyNote /> Add note
      </Button>
      {scripts && scripts.entries.length > 0 && (
        <Button size="sm" variant="outline" onClick={() => setDialog("scripts")}>
          <BookOpen /> Scripts
        </Button>
      )}
      <Button size="sm" variant="outline" onClick={() => setDialog("followup")} disabled={!canEdit}>
        <CalendarPlus /> Follow-up
      </Button>
      <Button size="sm" variant="outline" onClick={() => setDialog("task")}>
        <ListPlus /> Task
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" disabled={!canEdit} loading={pending}>
            Change stage <ChevronDown />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-52">
          {LEAD_STATUSES.map((s) => (
            <DropdownMenuItem key={s} onSelect={() => moveTo(s)} disabled={s === lead.status}>
              <Check className={cn(s === lead.status ? "opacity-100" : "opacity-0")} />
              {LEAD_STATUS_LABELS[s]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon-sm" variant="ghost" aria-label="More actions">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={() => setDialog("edit")} disabled={!canEdit}>
            <Pencil /> Edit lead
          </DropdownMenuItem>
          {(["EMAIL", "MEETING", "DEMO"] as const).map((t) => (
            <DropdownMenuItem key={t} onSelect={() => setLog(t)}>
              <ListPlus /> Log {ACTIVITY_TYPE_LABELS[t].toLowerCase()}
            </DropdownMenuItem>
          ))}
          {isAdmin && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onSelect={() => setDialog("delete")}>
                <Trash2 /> Delete lead
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <LogActivityDialog
        key={log ?? "closed"}
        open={!!log}
        onOpenChange={(o) => !o && setLog(null)}
        leadId={lead.id}
        defaultType={log ?? "NOTE"}
        title={log === "CALL" ? "Log call" : log === "WHATSAPP" ? "Log WhatsApp conversation" : undefined}
      />
      {scripts && (
        <LeadScriptsDialog
          open={dialog === "scripts"}
          onOpenChange={(o) => setDialog(o ? "scripts" : null)}
          entries={scripts.entries}
          vars={scripts.vars}
          stage={lead.status}
          whatsappBase={scripts.whatsappBase}
          onWhatsAppSent={() => openThenLog("WHATSAPP")}
        />
      )}
      <FollowUpDialog open={dialog === "followup"} onOpenChange={(o) => setDialog(o ? "followup" : null)} leadId={lead.id} leadName={lead.name} defaultOwnerId={lead.ownerId} />
      <TaskDialog
        key={`task-${dialog === "task"}`}
        open={dialog === "task"}
        onOpenChange={(o) => setDialog(o ? "task" : null)}
        defaultLead={{ id: lead.id, label: lead.name }}
        defaultBusiness={{ id: lead.businessId, label: lead.name }}
      />
      <LeadEditDialog
        key={`edit-${dialog === "edit"}`}
        open={dialog === "edit"}
        onOpenChange={(o) => setDialog(o ? "edit" : null)}
        lead={edit}
        contacts={contacts}
        allSources={sources}
        allCampaigns={campaigns}
      />
      <StageChangeDialog
        key={stageTarget ?? "none"}
        open={!!stageTarget}
        onOpenChange={(o) => !o && setStageTarget(null)}
        lead={{ id: lead.id, name: lead.name, value: lead.value, status: lead.status, demoDate: lead.demoDate }}
        target={stageTarget}
      />
      <ConfirmDialog
        open={dialog === "delete"}
        onOpenChange={(o) => setDialog(o ? "delete" : null)}
        title="Delete this lead?"
        description="The lead is removed from lists, pipeline and metrics. Its business and contacts stay."
        loading={pending}
        onConfirm={() =>
          run(() => deleteLead(lead.id), {
            success: "Lead deleted",
            onSuccess: () => router.push("/leads"),
          })
        }
      />
    </div>
  );
}

// ─── Stage progress bar ──────────────────────────────────────────────────────

export function StageProgress({ lead, canEdit }: { lead: LeadCore; canEdit: boolean }) {
  const { run, pending } = useAction();
  const [target, setTarget] = useState<LeadStatus | null>(null);
  const steps: LeadStatus[] = [...OPEN_STATUSES, "WON"];
  const current = lead.status === "LOST" ? -1 : steps.indexOf(lead.status as LeadStatus);
  const go = (s: LeadStatus) => {
    if (!canEdit || s === lead.status) return;
    if (needsStageDialog(s)) setTarget(s);
    else run(() => changeLeadStage({ id: lead.id, status: s }), { success: `Moved to ${LEAD_STATUS_LABELS[s]}` });
  };
  return (
    <div className={cn("flex gap-1 overflow-x-auto scroll-thin", pending && "opacity-60")}>
      {steps.map((s, i) => (
        <button
          key={s}
          type="button"
          disabled={!canEdit}
          onClick={() => go(s)}
          title={canEdit ? `Move to ${LEAD_STATUS_LABELS[s]}` : LEAD_STATUS_LABELS[s]}
          className={cn(
            "min-w-[92px] flex-1 cursor-pointer rounded px-2 py-1.5 text-center text-[11.5px] font-medium transition-colors disabled:cursor-default",
            i < current && "bg-foreground/80 text-background",
            i === current && (s === "WON" ? "bg-success text-white" : "bg-primary text-white"),
            i > current && "bg-muted text-muted-foreground hover:bg-secondary",
          )}
        >
          {LEAD_STATUS_LABELS[s]}
        </button>
      ))}
      {lead.status === "LOST" && <Badge tone="dark" className="h-auto px-3">Lost</Badge>}
      <StageChangeDialog
        key={target ?? "none"}
        open={!!target}
        onOpenChange={(o) => !o && setTarget(null)}
        lead={{ id: lead.id, name: lead.name, value: lead.value, status: lead.status, demoDate: lead.demoDate }}
        target={target}
      />
    </div>
  );
}

// ─── Inline composer for notes ───────────────────────────────────────────────

export function NoteComposer({ leadId, businessId }: { leadId?: string; businessId?: string }) {
  const [body, setBody] = useState("");
  const [type, setType] = useState<LoggableActivityType>("NOTE");
  const { run, pending } = useAction();
  const submit = () => {
    if (!body.trim() && type === "NOTE") return;
    run(() => logLeadActivity({ leadId: leadId ?? null, businessId: businessId ?? null, type, body }), {
      success: `${ACTIVITY_TYPE_LABELS[type]} logged`,
      onSuccess: () => setBody(""),
    });
  };
  return (
    <div className="border-b p-3">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={2}
        placeholder="Add a note, or log a call / WhatsApp…  (Ctrl + Enter)"
        className="min-h-14 resize-none border-transparent bg-subtle focus-visible:bg-card"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            submit();
          }
        }}
      />
      <div className="mt-2 flex flex-wrap items-center gap-1">
        {(["NOTE", "CALL", "WHATSAPP", "EMAIL", "MEETING"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={cn(
              "cursor-pointer rounded px-2 py-0.5 text-[12px] font-medium",
              type === t ? "bg-foreground text-background" : "text-muted-foreground hover:bg-accent",
            )}
          >
            {ACTIVITY_TYPE_LABELS[t]}
          </button>
        ))}
        <Button size="xs" className="ml-auto" onClick={submit} loading={pending} disabled={type === "NOTE" && !body.trim()}>
          Log {ACTIVITY_TYPE_LABELS[type].toLowerCase()}
        </Button>
      </div>
    </div>
  );
}

// ─── Follow-up list (lead detail, sales home, tasks) ─────────────────────────

export type FollowUpItem = {
  id: string;
  dueAt: string;
  note: string | null;
  leadId: string;
  leadName: string;
  ownerName?: string | null;
  phoneHref?: string | null;
};

export function FollowUpRow({ f, showLead = true, canCancel }: { f: FollowUpItem; showLead?: boolean; canCancel?: boolean }) {
  const [completing, setCompleting] = useState(false);
  const { run, pending } = useAction();
  const due = new Date(f.dueAt);
  const overdueDays = daysOverdue(due);
  const isOverdue = due.getTime() < Date.now();
  return (
    <div className="flex items-center gap-3 border-b px-4 py-2.5 last:border-0">
      <span className={cn("size-2 shrink-0 rounded-full", isOverdue ? "bg-destructive" : "bg-warning")} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          {showLead ? (
            <Link href={`/leads/${f.leadId}`} className="truncate text-[13.5px] font-medium hover:text-primary">
              {f.leadName}
            </Link>
          ) : (
            <span className="truncate text-[13.5px] font-medium">{f.note ?? "Follow-up"}</span>
          )}
          <span className={cn("shrink-0 text-[11.5px] tabular", isOverdue ? "font-semibold text-destructive" : "text-muted-foreground")}>
            {isOverdue && overdueDays > 0 ? `${overdueDays} day${overdueDays > 1 ? "s" : ""} overdue` : fmtSmartDate(due)}
          </span>
        </div>
        {showLead && f.note && <p className="truncate text-[12px] text-muted-foreground">{f.note}</p>}
        {f.ownerName && <p className="text-[11px] text-muted-foreground">{f.ownerName}</p>}
      </div>
      {f.phoneHref && (
        <Button asChild size="icon-xs" variant="ghost" aria-label="Call">
          <a href={f.phoneHref}>
            <Phone />
          </a>
        </Button>
      )}
      {canCancel && (
        <Button
          size="icon-xs"
          variant="ghost"
          aria-label="Remove follow-up"
          loading={pending}
          onClick={() => run(() => cancelFollowUp(f.id), { success: "Follow-up removed" })}
        >
          {!pending && <X />}
        </Button>
      )}
      <Button size="xs" variant="outline" onClick={() => setCompleting(true)}>
        <Check /> Complete
      </Button>
      <CompleteFollowUpDialog
        key={String(completing)}
        open={completing}
        onOpenChange={setCompleting}
        followUp={{ id: f.id, note: f.note, leadName: f.leadName }}
      />
    </div>
  );
}

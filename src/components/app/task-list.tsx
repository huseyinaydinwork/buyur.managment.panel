"use client";

import { useState } from "react";
import Link from "next/link";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { deleteTask, setTaskStatus } from "@/actions/tasks";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown";
import { Select } from "@/components/ui/input";
import { Avatar } from "@/components/ui/misc";
import { TASK_STATUSES, TASK_STATUS_LABELS } from "@/lib/constants";
import { fmtSmartDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PriorityBadge } from "./display";
import { TaskDialog, type TaskFormValue } from "./forms/task-form";
import type { PickerOption } from "./entity-picker";
import { useAction } from "./use-action";

export type TaskItem = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueAt: string | null;
  ownerId: string | null;
  ownerName: string | null;
  lead: PickerOption | null;
  business: PickerOption | null;
  projectId?: string | null;
};

function TaskRow({ t, compact }: { t: TaskItem; compact?: boolean }) {
  const { run, pending } = useAction();
  const [edit, setEdit] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const done = t.status === "DONE";
  const due = t.dueAt ? new Date(t.dueAt) : null;
  const overdue = !done && due && due.getTime() < Date.now();

  const formValue: TaskFormValue = {
    id: t.id,
    title: t.title,
    description: t.description,
    ownerId: t.ownerId,
    dueAt: t.dueAt,
    priority: t.priority,
    status: t.status,
    lead: t.lead,
    business: t.business,
    projectId: t.projectId,
  };

  return (
    <div className={cn("flex items-start gap-3 border-b px-4 py-2.5 last:border-0", pending && "opacity-60")}>
      <input
        type="checkbox"
        checked={done}
        aria-label={done ? "Mark as not done" : "Mark as done"}
        onChange={(e) =>
          run(() => setTaskStatus(t.id, e.target.checked ? "DONE" : "TODO"), {
            success: e.target.checked ? "Task completed" : "Task reopened",
          })
        }
        className="mt-0.5 size-4 shrink-0 cursor-pointer accent-[var(--success)]"
      />
      <div className="min-w-0 flex-1">
        <button type="button" onClick={() => setEdit(true)} className={cn("block cursor-pointer text-left text-[13.5px] font-medium hover:text-primary", done && "text-muted-foreground line-through")}>
          {t.title}
        </button>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px] text-muted-foreground">
          <PriorityBadge priority={t.priority} />
          {due && <span className={cn("tabular", overdue && "font-semibold text-destructive")}>{overdue ? "Overdue · " : ""}{fmtSmartDate(due)}</span>}
          {t.lead && (
            <Link href={`/leads/${t.lead.id}`} className="hover:text-primary">
              {t.lead.label}
            </Link>
          )}
          {!t.lead && t.business && (
            <Link href={`/businesses/${t.business.id}`} className="hover:text-primary">
              {t.business.label}
            </Link>
          )}
          {!compact && t.ownerName && (
            <span className="inline-flex items-center gap-1">
              <Avatar name={t.ownerName} className="size-4 text-[8px]" /> {t.ownerName.split(" ")[0]}
            </span>
          )}
        </div>
      </div>
      {!compact && (
        <Select
          value={t.status}
          onChange={(e) => run(() => setTaskStatus(t.id, e.target.value), { success: "Task updated" })}
          className="h-7 w-[118px] text-[12px]"
          aria-label="Status"
        >
          {TASK_STATUSES.map((s) => (
            <option key={s} value={s}>
              {TASK_STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon-xs" variant="ghost" aria-label="Task actions">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={() => setEdit(true)}>
            <Pencil /> Edit
          </DropdownMenuItem>
          <DropdownMenuItem destructive onSelect={() => setConfirm(true)}>
            <Trash2 /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <TaskDialog key={`${t.id}-${edit}`} open={edit} onOpenChange={setEdit} task={formValue} />
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Delete task?"
        description={`“${t.title}” will be permanently removed.`}
        loading={pending}
        onConfirm={() => run(() => deleteTask(t.id), { success: "Task deleted", onSuccess: () => setConfirm(false) })}
      />
    </div>
  );
}

export function TaskList({ tasks, compact, emptyText = "No tasks." }: { tasks: TaskItem[]; compact?: boolean; emptyText?: string }) {
  if (!tasks.length) return <p className="px-4 py-4 text-[13px] text-muted-foreground">{emptyText}</p>;
  return (
    <div>
      {tasks.map((t) => (
        <TaskRow key={t.id} t={t} compact={compact} />
      ))}
    </div>
  );
}

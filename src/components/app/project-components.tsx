"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CalendarClock, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteProject, setProjectStatus } from "@/actions/projects";
import { setTaskStatus } from "@/actions/tasks";
import { Button, type ButtonProps } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown";
import { Select } from "@/components/ui/input";
import { Avatar } from "@/components/ui/misc";
import { PROJECT_STATUSES, PROJECT_STATUS_LABELS, TASK_STATUSES, TASK_STATUS_LABELS } from "@/lib/constants";
import { fmtSmartDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PriorityBadge } from "./display";
import { ProjectDialog, type ProjectFormValue } from "./forms/project-form";
import { TaskDialog } from "./forms/task-form";
import type { TaskItem } from "./task-list";
import { useAction } from "./use-action";

export function NewProjectButton({ label = "New project", size = "sm", variant }: { label?: string; size?: ButtonProps["size"]; variant?: ButtonProps["variant"] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size={size} variant={variant} onClick={() => setOpen(true)}>
        <Plus /> {label}
      </Button>
      <ProjectDialog key={String(open)} open={open} onOpenChange={setOpen} />
    </>
  );
}

export function ProjectActions({ project, canEdit, canDelete }: { project: ProjectFormValue; canEdit: boolean; canDelete: boolean }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<null | "edit" | "delete">(null);
  const { run, pending } = useAction();
  if (!canEdit) return null;
  return (
    <div className="flex items-center gap-1.5">
      <Select
        value={project.status}
        onChange={(e) => run(() => setProjectStatus(project.id, e.target.value), { success: `Project ${PROJECT_STATUS_LABELS[e.target.value as keyof typeof PROJECT_STATUS_LABELS].toLowerCase()}` })}
        className="h-8 w-[130px] text-[13px]"
        aria-label="Project status"
      >
        {PROJECT_STATUSES.map((s) => (
          <option key={s} value={s}>
            {PROJECT_STATUS_LABELS[s]}
          </option>
        ))}
      </Select>
      <Button size="sm" variant="outline" onClick={() => setDialog("edit")}>
        <Pencil /> Edit
      </Button>
      {canDelete && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon-sm" variant="ghost" aria-label="More">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem destructive onSelect={() => setDialog("delete")}>
              <Trash2 /> Delete project
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <ProjectDialog key={`e-${dialog === "edit"}`} open={dialog === "edit"} onOpenChange={(o) => setDialog(o ? "edit" : null)} project={project} />
      <ConfirmDialog
        open={dialog === "delete"}
        onOpenChange={(o) => setDialog(o ? "delete" : null)}
        title={`Delete “${project.name}”?`}
        description="The project and its board are removed for everyone."
        loading={pending}
        onConfirm={() => run(() => deleteProject(project.id), { success: "Project deleted", onSuccess: () => router.push("/projects") })}
      />
    </div>
  );
}

// ─── Task board ──────────────────────────────────────────────────────────────

const COLUMN_DOT: Record<string, string> = { TODO: "bg-foreground/30", IN_PROGRESS: "bg-[#e0b25a]", DONE: "bg-primary" };

export function ProjectTaskBoard({ projectId, tasks: initial, canEdit }: { projectId: string; tasks: TaskItem[]; canEdit: boolean }) {
  const [tasks, setTasks] = useState(initial);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [creating, setCreating] = useState<string | null>(null);
  const [editing, setEditing] = useState<TaskItem | null>(null);
  const [, start] = useTransition();
  useEffect(() => setTasks(initial), [initial]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const target = e.over?.id as string | undefined;
    const task = tasks.find((t) => t.id === e.active.id);
    if (!task || !target || task.status === target) return;
    const from = task.status;
    setTasks((ts) => ts.map((t) => (t.id === task.id ? { ...t, status: target } : t)));
    start(async () => {
      const res = await setTaskStatus(task.id, target).catch(() => ({ ok: false as const, error: "Network error" }));
      if (res.ok) toast.success(target === "DONE" ? "Task done ✓" : `Moved to ${TASK_STATUS_LABELS[target as keyof typeof TASK_STATUS_LABELS]}`);
      else {
        setTasks((ts) => ts.map((t) => (t.id === task.id ? { ...t, status: from } : t)));
        toast.error(res.error);
      }
    });
  };
  const active = tasks.find((t) => t.id === activeId);

  return (
    <>
      <DndContext sensors={sensors} onDragStart={(e) => setActiveId(String(e.active.id))} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {TASK_STATUSES.map((s) => {
            const items = tasks.filter((t) => t.status === s);
            return (
              <Column key={s} status={s} count={items.length} onAdd={canEdit ? () => setCreating(s) : undefined}>
                {items.map((t) => (
                  <DraggableTask key={t.id} id={t.id} disabled={!canEdit}>
                    <TaskCard t={t} onOpen={() => setEditing(t)} />
                  </DraggableTask>
                ))}
              </Column>
            );
          })}
        </div>
        <DragOverlay dropAnimation={null}>{active ? <TaskCard t={active} dragging /> : null}</DragOverlay>
      </DndContext>
      <TaskDialog
        key={`new-${creating}`}
        open={!!creating}
        onOpenChange={(o) => !o && setCreating(null)}
        projectId={projectId}
        defaultStatus={creating ?? undefined}
      />
      <TaskDialog
        key={editing?.id ?? "edit-none"}
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        task={editing ? { ...editing, projectId: editing.projectId ?? projectId } : null}
      />
    </>
  );
}

function Column({ status, count, onAdd, children }: { status: string; count: number; onAdd?: () => void; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div ref={setNodeRef} className={cn("flex min-h-[220px] flex-col rounded-lg border bg-subtle", isOver && "border-primary/50 bg-primary-soft/50")}>
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="flex items-center gap-2 text-[13px] font-semibold">
          <span className={cn("size-2 rounded-full", COLUMN_DOT[status])} />
          {TASK_STATUS_LABELS[status as keyof typeof TASK_STATUS_LABELS]}
          <span className="font-normal text-muted-foreground tabular">{count}</span>
        </span>
        {onAdd && (
          <Button size="icon-xs" variant="ghost" onClick={onAdd} aria-label="Add task">
            <Plus />
          </Button>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-2">
        {children}
        {count === 0 && <p className="py-6 text-center text-[12px] text-muted-foreground">Drop tasks here</p>}
      </div>
    </div>
  );
}

function DraggableTask({ id, disabled, children }: { id: string; disabled?: boolean; children: React.ReactNode }) {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({ id, disabled });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} className={cn("outline-none", isDragging && "opacity-30")}>
      {children}
    </div>
  );
}

function TaskCard({ t, onOpen, dragging }: { t: TaskItem; onOpen?: () => void; dragging?: boolean }) {
  const due = t.dueAt ? new Date(t.dueAt) : null;
  const overdue = t.status !== "DONE" && due && due.getTime() < Date.now();
  return (
    <div className={cn("cursor-grab rounded-md border bg-card p-2.5 text-[12.5px]", dragging && "rotate-1 shadow-lg", t.status === "DONE" && "opacity-70")}>
      <button
        type="button"
        onClick={onOpen}
        onPointerDown={(e) => e.stopPropagation()}
        className={cn("block w-full cursor-pointer text-left font-semibold leading-snug hover:text-primary", t.status === "DONE" && "line-through")}
      >
        {t.title}
      </button>
      {t.description && <p className="mt-0.5 line-clamp-2 text-[12px] text-muted-foreground">{t.description}</p>}
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5">
          <PriorityBadge priority={t.priority} />
          {due && (
            <span className={cn("inline-flex items-center gap-1 text-[11px] text-muted-foreground", overdue && "font-semibold text-destructive")}>
              <CalendarClock className="size-3" /> {fmtSmartDate(due)}
            </span>
          )}
        </span>
        {t.ownerName && <Avatar name={t.ownerName} className="size-5 text-[9px]" />}
      </div>
    </div>
  );
}


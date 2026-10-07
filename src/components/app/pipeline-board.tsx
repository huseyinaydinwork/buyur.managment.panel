"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
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
  type DragStartEvent,
} from "@dnd-kit/core";
import { CalendarClock, Clock, Lock } from "lucide-react";
import { toast } from "sonner";
import { changeLeadStage } from "@/actions/leads";
import { Avatar } from "@/components/ui/misc";
import { LEAD_STATUS_LABELS, type LeadStatus } from "@/lib/constants";
import { fmtMoneyCompact, fmtRelative, fmtSmartDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { StageChangeDialog, needsStageDialog } from "./lead-dialogs";

export type PipelineCard = {
  id: string;
  name: string;
  contact: string | null;
  owner: string | null;
  value: number;
  status: string;
  lastActivityAt: string | null;
  nextFollowUpAt: string | null;
  demoDate: string | null;
  canEdit: boolean;
};

export function PipelineBoard({ columns, cards: initial }: { columns: LeadStatus[]; cards: PipelineCard[] }) {
  const [cards, setCards] = useState(initial);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pendingMove, setPendingMove] = useState<{ card: PipelineCard; target: LeadStatus; from: string } | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => setCards(initial), [initial]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const move = (id: string, status: string) => setCards((cs) => cs.map((c) => (c.id === id ? { ...c, status } : c)));

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));
  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const target = e.over?.id as LeadStatus | undefined;
    const card = cards.find((c) => c.id === e.active.id);
    if (!card || !target || card.status === target) return;
    const from = card.status;
    move(card.id, target); // optimistic; reverted on failure
    if (needsStageDialog(target)) {
      setPendingMove({ card, target, from });
      return;
    }
    startTransition(async () => {
      const res = await changeLeadStage({ id: card.id, status: target }).catch(() => ({ ok: false as const, error: "Network error" }));
      if (res.ok) toast.success(`${card.name} → ${LEAD_STATUS_LABELS[target]}`);
      else {
        move(card.id, from);
        toast.error(res.error);
      }
    });
  };

  const active = cards.find((c) => c.id === activeId) ?? null;

  return (
    <>
      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
        <div className="-mx-3 flex gap-3 overflow-x-auto px-3 pb-4 scroll-thin sm:-mx-6 sm:px-6">
          {columns.map((col) => {
            const items = cards.filter((c) => c.status === col);
            return <Column key={col} status={col} items={items} />;
          })}
        </div>
        <DragOverlay dropAnimation={null}>{active ? <CardView card={active} dragging /> : null}</DragOverlay>
      </DndContext>
      <StageChangeDialog
        key={pendingMove ? `${pendingMove.card.id}-${pendingMove.target}` : "none"}
        open={!!pendingMove}
        onOpenChange={(o) => {
          if (!o) setPendingMove(null);
        }}
        lead={pendingMove ? { id: pendingMove.card.id, name: pendingMove.card.name, value: pendingMove.card.value, status: pendingMove.from, demoDate: pendingMove.card.demoDate } : null}
        target={pendingMove?.target ?? null}
        onDone={(ok) => {
          if (!ok && pendingMove) move(pendingMove.card.id, pendingMove.from);
        }}
      />
    </>
  );
}

function Column({ status, items }: { status: LeadStatus; items: PipelineCard[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const total = items.reduce((s, c) => s + c.value, 0);
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-[264px] shrink-0 flex-col rounded-lg border bg-subtle transition-colors",
        isOver && "border-primary/50 bg-primary-soft/40",
        status === "WON" && "bg-success-soft/40",
        status === "LOST" && "bg-muted/60",
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className={cn("size-2 rounded-full", status === "WON" ? "bg-success" : status === "LOST" ? "bg-muted-foreground" : status === "NEGOTIATION" ? "bg-primary" : "bg-foreground/40")} />
          <span className="text-[13px] font-semibold">{LEAD_STATUS_LABELS[status]}</span>
          <span className="text-[12px] text-muted-foreground tabular">{items.length}</span>
        </div>
        <span className="text-[12px] font-medium text-muted-foreground tabular">{fmtMoneyCompact(total)}</span>
      </div>
      <div className="flex min-h-[120px] flex-1 flex-col gap-2 p-2">
        {items.map((c) => (
          <DraggableCard key={c.id} card={c} />
        ))}
        {items.length === 0 && <p className="py-6 text-center text-[12px] text-muted-foreground">Drop here</p>}
      </div>
    </div>
  );
}

function DraggableCard({ card }: { card: PipelineCard }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: card.id, disabled: !card.canEdit });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} className={cn("outline-none", isDragging && "opacity-30")}>
      <CardView card={card} />
    </div>
  );
}

function CardView({ card, dragging }: { card: PipelineCard; dragging?: boolean }) {
  const overdue = card.nextFollowUpAt && new Date(card.nextFollowUpAt).getTime() < Date.now();
  return (
    <div
      className={cn(
        "rounded-md border bg-card p-2.5 text-[12.5px] transition-shadow",
        card.canEdit ? "cursor-grab active:cursor-grabbing" : "cursor-default",
        dragging && "rotate-1 shadow-lg ring-1 ring-primary/30",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <Link href={`/leads/${card.id}`} className="font-semibold leading-snug hover:text-primary" onPointerDown={(e) => e.stopPropagation()}>
          {card.name}
        </Link>
        {!card.canEdit && <Lock className="mt-0.5 size-3 shrink-0 text-muted-foreground" aria-label="Owned by another rep" />}
      </div>
      {card.contact && <p className="mt-0.5 truncate text-muted-foreground">{card.contact}</p>}
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          {card.owner ? (
            <>
              <Avatar name={card.owner} className="size-4 text-[8px]" /> {card.owner.split(" ")[0]}
            </>
          ) : (
            "Unassigned"
          )}
        </span>
        <span className="font-semibold tabular">{card.value ? fmtMoneyCompact(card.value) : "—"}</span>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
        {card.lastActivityAt && (
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3" /> {fmtRelative(card.lastActivityAt)}
          </span>
        )}
        {card.nextFollowUpAt && (
          <span className={cn("inline-flex items-center gap-1", overdue && "font-semibold text-destructive")}>
            <CalendarClock className="size-3" /> {fmtSmartDate(card.nextFollowUpAt)}
          </span>
        )}
      </div>
    </div>
  );
}

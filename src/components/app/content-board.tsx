"use client";

import { useEffect, useState, useTransition } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Eye, Heart, MoreHorizontal, Pencil, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { deleteContent, moveContent } from "@/actions/marketing";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown";
import { Badge } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import {
  CONTENT_FORMAT_LABELS,
  CONTENT_PLATFORM_LABELS,
  CONTENT_STATUSES,
  CONTENT_STATUS_LABELS,
  label,
} from "@/lib/constants";
import { fmtNumber, fmtSmartDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ContentStatusBadge } from "./display";
import { ContentDialog, type ContentFormValue } from "./forms/marketing-forms";
import { useAction } from "./use-action";

export type ContentItem = ContentFormValue & { campaignName: string | null; ownerName: string | null };

export function ContentBoard({ items: initial, view }: { items: ContentItem[]; view: "board" | "table" }) {
  const [items, setItems] = useState(initial);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editing, setEditing] = useState<ContentItem | null>(null);
  const [creatingIn, setCreatingIn] = useState<string | null>(null);
  const [removing, setRemoving] = useState<ContentItem | null>(null);
  const [, start] = useTransition();
  const { run, pending } = useAction();
  useEffect(() => setItems(initial), [initial]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const target = e.over?.id as string | undefined;
    const item = items.find((i) => i.id === e.active.id);
    if (!item || !target || item.status === target) return;
    const from = item.status;
    setItems((xs) => xs.map((x) => (x.id === item.id ? { ...x, status: target } : x)));
    start(async () => {
      const res = await moveContent(item.id, target).catch(() => ({ ok: false as const, error: "Network error" }));
      if (res.ok) toast.success(`Moved to ${label(CONTENT_STATUS_LABELS, target)}`);
      else {
        setItems((xs) => xs.map((x) => (x.id === item.id ? { ...x, status: from } : x)));
        toast.error(res.error);
      }
    });
  };

  const menu = (c: ContentItem) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon-xs" variant="ghost" aria-label="Content actions" onPointerDown={(e) => e.stopPropagation()}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onSelect={() => setEditing(c)}>
          <Pencil /> Edit
        </DropdownMenuItem>
        <DropdownMenuItem destructive onSelect={() => setRemoving(c)}>
          <Trash2 /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const active = items.find((i) => i.id === activeId);

  return (
    <>
      {view === "board" ? (
        <DndContext sensors={sensors} onDragStart={(e) => setActiveId(String(e.active.id))} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
          <div className="-mx-3 flex gap-3 overflow-x-auto px-3 pb-4 scroll-thin sm:-mx-6 sm:px-6">
            {CONTENT_STATUSES.map((s) => (
              <Column key={s} status={s} onAdd={() => setCreatingIn(s)}>
                {items
                  .filter((i) => i.status === s)
                  .map((c) => (
                    <Draggable key={c.id} id={c.id}>
                      <ContentCard c={c} menu={menu(c)} onOpen={() => setEditing(c)} />
                    </Draggable>
                  ))}
              </Column>
            ))}
          </div>
          <DragOverlay dropAnimation={null}>{active ? <ContentCard c={active} dragging /> : null}</DragOverlay>
        </DndContext>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <THead>
              <tr>
                <TH>Title</TH>
                <TH>Platform</TH>
                <TH>Format</TH>
                <TH>Campaign</TH>
                <TH>Owner</TH>
                <TH>Status</TH>
                <TH>Publish</TH>
                <TH className="text-right">Views</TH>
                <TH className="text-right">Likes</TH>
                <TH className="text-right">Saves</TH>
                <TH className="text-right">Shares</TH>
                <TH className="text-right">Leads</TH>
                <TH />
              </tr>
            </THead>
            <TBody>
              {items.map((c) => (
                <TR key={c.id}>
                  <TD className="max-w-[260px]">
                    <button type="button" onClick={() => setEditing(c)} className="cursor-pointer truncate text-left font-medium hover:text-primary">
                      {c.title}
                    </button>
                  </TD>
                  <TD>{label(CONTENT_PLATFORM_LABELS, c.platform)}</TD>
                  <TD className="text-muted-foreground">{label(CONTENT_FORMAT_LABELS, c.format)}</TD>
                  <TD className="text-muted-foreground">{c.campaignName ?? "—"}</TD>
                  <TD className="text-muted-foreground">{c.ownerName?.split(" ")[0] ?? "—"}</TD>
                  <TD>
                    <ContentStatusBadge status={c.status} />
                  </TD>
                  <TD className="whitespace-nowrap text-muted-foreground">{c.publishAt ? fmtSmartDate(c.publishAt) : "—"}</TD>
                  <TD className="text-right tabular">{fmtNumber(c.views)}</TD>
                  <TD className="text-right tabular">{fmtNumber(c.likes)}</TD>
                  <TD className="text-right tabular">{fmtNumber(c.saves)}</TD>
                  <TD className="text-right tabular">{fmtNumber(c.shares)}</TD>
                  <TD className="text-right tabular font-medium">{c.leadsGenerated}</TD>
                  <TD className="w-10">{menu(c)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
          {items.length === 0 && <p className="px-4 py-8 text-center text-sm text-muted-foreground">No content yet.</p>}
        </div>
      )}
      <ContentDialog key={editing?.id ?? "edit-none"} open={!!editing} onOpenChange={(o) => !o && setEditing(null)} content={editing} />
      <ContentDialog key={`new-${creatingIn}`} open={!!creatingIn} onOpenChange={(o) => !o && setCreatingIn(null)} defaultStatus={creatingIn ?? undefined} />
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={`Delete “${removing?.title ?? ""}”?`}
        loading={pending}
        onConfirm={() => removing && run(() => deleteContent(removing.id), { success: "Content deleted", onSuccess: () => setRemoving(null) })}
      />
    </>
  );
}

function Column({ status, children, onAdd }: { status: string; children: React.ReactNode; onAdd: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const count = Array.isArray(children) ? children.length : 0;
  return (
    <div ref={setNodeRef} className={cn("flex w-[248px] shrink-0 flex-col rounded-lg border bg-subtle", isOver && "border-primary/50 bg-primary-soft/40")}>
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-[13px] font-semibold">
          {label(CONTENT_STATUS_LABELS, status)} <span className="ml-1 font-normal text-muted-foreground tabular">{count}</span>
        </span>
        <Button size="icon-xs" variant="ghost" onClick={onAdd} aria-label={`Add to ${status}`}>
          <Plus />
        </Button>
      </div>
      <div className="flex min-h-[100px] flex-1 flex-col gap-2 p-2">{children}</div>
    </div>
  );
}

function Draggable({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({ id });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} className={cn("outline-none", isDragging && "opacity-30")}>
      {children}
    </div>
  );
}

function ContentCard({ c, menu, onOpen, dragging }: { c: ContentItem; menu?: React.ReactNode; onOpen?: () => void; dragging?: boolean }) {
  return (
    <div className={cn("cursor-grab rounded-md border bg-card p-2.5 text-[12.5px]", dragging && "rotate-1 shadow-lg")}>
      <div className="flex items-start justify-between gap-1">
        <button type="button" onClick={onOpen} onPointerDown={(e) => e.stopPropagation()} className="cursor-pointer text-left font-semibold leading-snug hover:text-primary">
          {c.title}
        </button>
        {menu}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1">
        <Badge tone="outline">{label(CONTENT_PLATFORM_LABELS, c.platform)}</Badge>
        <Badge tone="outline">{label(CONTENT_FORMAT_LABELS, c.format)}</Badge>
      </div>
      {c.campaignName && <p className="mt-1.5 truncate text-[11.5px] text-muted-foreground">{c.campaignName}</p>}
      <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{c.publishAt ? fmtSmartDate(c.publishAt) : c.ownerName?.split(" ")[0]}</span>
        {c.status === "PUBLISHED" && (
          <span className="flex items-center gap-2 tabular">
            <span className="inline-flex items-center gap-0.5"><Eye className="size-3" />{fmtNumber(c.views)}</span>
            <span className="inline-flex items-center gap-0.5"><Heart className="size-3" />{fmtNumber(c.likes)}</span>
            <span className="inline-flex items-center gap-0.5"><Users className="size-3" />{c.leadsGenerated}</span>
          </span>
        )}
      </div>
    </div>
  );
}

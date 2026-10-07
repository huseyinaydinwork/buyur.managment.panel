"use client";

import { useMemo, useState } from "react";
import { BookOpen, Copy, MessageCircle, MoreHorizontal, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deletePlaybookEntry, savePlaybookEntry } from "@/actions/playbook";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Card, EmptyState } from "@/components/ui/misc";
import {
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  PLAYBOOK_CATEGORIES,
  PLAYBOOK_CATEGORY_LABELS,
  type PlaybookCategory,
} from "@/lib/constants";
import { PLAYBOOK_PLACEHOLDERS, fillTemplate, type PlaybookVars } from "@/lib/playbook";
import { cn, fold } from "@/lib/utils";
import { LeadStatusBadge } from "./display";
import { formValues, useAction } from "./use-action";

export type PlaybookItem = { id: string; category: string; stage: string | null; title: string; body: string };

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  } catch {
    toast.error("Couldn't copy — select the text manually.");
  }
}

/** Renders a script; placeholders are highlighted when not filled. */
function ScriptBody({ text }: { text: string }) {
  const parts = text.split(/(\{\w+\}|^(?:Satışçı|Müşteri):)/gm);
  return (
    <p className="whitespace-pre-line text-[13px] leading-relaxed text-foreground/90">
      {parts.map((p, i) =>
        /^\{\w+\}$/.test(p) ? (
          <span key={i} className="rounded bg-primary-soft px-1 font-medium text-primary">
            {p}
          </span>
        ) : /^(Satışçı|Müşteri):$/.test(p) ? (
          <span key={i} className={cn("font-semibold", p.startsWith("Satışçı") ? "text-primary" : "text-foreground")}>
            {p}
          </span>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </p>
  );
}

const CATEGORY_HINT: Record<PlaybookCategory, string> = {
  CALL: "Phone & walk-in conversations, step by step",
  WHATSAPP: "Ready-to-send messages for each stage",
  OBJECTION: "What to say when the customer pushes back",
  STRATEGY: "Habits and tactics that win more deals",
};

// ─── Playbook page ───────────────────────────────────────────────────────────

export function PlaybookBrowser({ entries, canEdit, initialCategory }: { entries: PlaybookItem[]; canEdit: boolean; initialCategory: string }) {
  const [category, setCategory] = useState<PlaybookCategory>(
    (PLAYBOOK_CATEGORIES as readonly string[]).includes(initialCategory) ? (initialCategory as PlaybookCategory) : "CALL",
  );
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<PlaybookItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState<PlaybookItem | null>(null);
  const { run, pending } = useAction();

  const counts = useMemo(
    () => Object.fromEntries(PLAYBOOK_CATEGORIES.map((c) => [c, entries.filter((e) => e.category === c).length])),
    [entries],
  );
  const key = fold(q);
  const visible = entries.filter(
    (e) => (key ? fold(`${e.title} ${e.body}`).includes(key) : e.category === category),
  );

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1 rounded-md border bg-card p-0.5">
          {PLAYBOOK_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                setCategory(c);
                setQ("");
                history.replaceState(null, "", `?cat=${c}`);
              }}
              className={cn(
                "flex cursor-pointer items-center gap-1.5 rounded px-2.5 py-1 text-[12.5px] font-medium text-muted-foreground hover:text-foreground",
                !key && category === c && "bg-foreground text-background hover:text-background",
              )}
            >
              {PLAYBOOK_CATEGORY_LABELS[c]}
              <span className="text-[11px] opacity-60 tabular">{counts[c]}</span>
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search all scripts…" className="h-8 pl-8" onKeyDown={(e) => e.key === "Escape" && setQ("")} />
        </div>
        {canEdit && (
          <Button size="sm" className="ml-auto" onClick={() => setCreating(true)}>
            <Plus /> New entry
          </Button>
        )}
      </div>

      {!key && <p className="mb-3 text-[13px] text-muted-foreground">{CATEGORY_HINT[category]}</p>}

      {visible.length === 0 ? (
        <Card>
          <EmptyState icon={<BookOpen />} title={key ? `Nothing matches “${q}”` : "No entries yet"} />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {visible.map((e) => (
            <Card key={e.id} className="flex flex-col">
              <div className="flex items-start justify-between gap-2 border-b px-4 py-3">
                <div className="min-w-0">
                  <h3 className="text-[14px] font-semibold">{e.title}</h3>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {key && <span className="text-[11px] text-muted-foreground">{PLAYBOOK_CATEGORY_LABELS[e.category as PlaybookCategory]}</span>}
                    {e.stage ? <LeadStatusBadge status={e.stage} /> : <span className="text-[11px] text-muted-foreground">Any stage</span>}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button size="xs" variant="outline" onClick={() => copy(e.body)}>
                    <Copy /> Copy
                  </Button>
                  {canEdit && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon-xs" variant="ghost" aria-label="Entry actions">
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onSelect={() => setEditing(e)}>
                          <Pencil /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem destructive onSelect={() => setRemoving(e)}>
                          <Trash2 /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
              <div className="px-4 py-3">
                <ScriptBody text={e.body} />
              </div>
            </Card>
          ))}
        </div>
      )}

      <p className="mt-4 text-[12px] text-muted-foreground">
        Placeholders like <span className="rounded bg-primary-soft px-1 text-primary">{"{isletme}"}</span> are filled automatically when you open
        scripts from a lead (“Scripts” button on the lead page).
      </p>

      {canEdit && (
        <>
          <PlaybookEditor key={`new-${creating}`} open={creating} onOpenChange={setCreating} defaultCategory={category} />
          <PlaybookEditor key={editing?.id ?? "edit"} open={!!editing} onOpenChange={(o) => !o && setEditing(null)} entry={editing} />
          <ConfirmDialog
            open={!!removing}
            onOpenChange={(o) => !o && setRemoving(null)}
            title={`Delete “${removing?.title ?? ""}”?`}
            loading={pending}
            onConfirm={() => removing && run(() => deletePlaybookEntry(removing.id), { success: "Entry deleted", onSuccess: () => setRemoving(null) })}
          />
        </>
      )}
    </>
  );
}

function PlaybookEditor({
  open,
  onOpenChange,
  entry,
  defaultCategory,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  entry?: PlaybookItem | null;
  defaultCategory?: string;
}) {
  const { run, pending, fieldErrors: fe, setFieldErrors } = useAction();
  const close = (o: boolean) => {
    if (!o) setFieldErrors({});
    onOpenChange(o);
  };
  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent title={entry ? "Edit playbook entry" : "New playbook entry"} size="lg">
        <form
          noValidate
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => savePlaybookEntry({ ...formValues(e.currentTarget), id: entry?.id ?? null }), {
              success: entry ? "Entry updated" : "Entry added",
              onSuccess: () => close(false),
            });
          }}
        >
          <Field label="Category" required error={fe.category}>
            <Select name="category" defaultValue={entry?.category ?? defaultCategory ?? "CALL"}>
              {PLAYBOOK_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {PLAYBOOK_CATEGORY_LABELS[c]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Best for stage" error={fe.stage}>
            <Select name="stage" defaultValue={entry?.stage ?? ""}>
              <option value="">Any stage</option>
              {LEAD_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {LEAD_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Title" required error={fe.title} className="sm:col-span-2">
            <Input name="title" autoFocus defaultValue={entry?.title} />
          </Field>
          <Field
            label="Script / message"
            required
            error={fe.body}
            className="sm:col-span-2"
            hint={`Placeholders: ${PLAYBOOK_PLACEHOLDERS.map((p) => `{${p.key}} = ${p.label.toLowerCase()}`).join(" · ")}. Start lines with "Satışçı:" / "Müşteri:" for dialogues.`}
          >
            <Textarea name="body" rows={12} defaultValue={entry?.body} className="font-[inherit] text-[13px]" />
          </Field>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => close(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              {entry ? "Save" : "Add entry"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Lead page: scripts filled with this lead's details ──────────────────────

export function LeadScriptsDialog({
  open,
  onOpenChange,
  entries,
  vars,
  stage,
  whatsappBase,
  onWhatsAppSent,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  entries: PlaybookItem[];
  vars: PlaybookVars;
  stage: string;
  /** wa.me link for the lead's phone, without text. */
  whatsappBase: string | null;
  onWhatsAppSent?: () => void;
}) {
  const [category, setCategory] = useState<PlaybookCategory>("CALL");
  const list = entries
    .filter((e) => e.category === category)
    .sort((a, b) => Number(b.stage === stage) - Number(a.stage === stage));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Scripts for this lead" description="Filled with this lead's details. Entries for the current stage come first." size="xl">
        <div className="mb-3 flex flex-wrap gap-1 rounded-md border bg-card p-0.5">
          {PLAYBOOK_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={cn(
                "cursor-pointer rounded px-2.5 py-1 text-[12.5px] font-medium text-muted-foreground hover:text-foreground",
                category === c && "bg-foreground text-background hover:text-background",
              )}
            >
              {PLAYBOOK_CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
        {list.length === 0 ? (
          <EmptyState title="No entries in this category" />
        ) : (
          <div className="flex flex-col gap-3">
            {list.map((e) => {
              const text = fillTemplate(e.body, vars);
              return (
                <div key={e.id} className={cn("rounded-lg border", e.stage === stage && "border-primary/40 bg-primary-soft/30")}>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[13.5px] font-semibold">{e.title}</span>
                      {e.stage === stage && <span className="text-[11px] font-medium text-primary">Recommended now</span>}
                    </div>
                    <div className="flex gap-1">
                      <Button size="xs" variant="outline" onClick={() => copy(text)}>
                        <Copy /> Copy
                      </Button>
                      {e.category === "WHATSAPP" && whatsappBase && (
                        <Button asChild size="xs" variant="success">
                          <a
                            href={`${whatsappBase}?text=${encodeURIComponent(text)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => {
                              onOpenChange(false);
                              onWhatsAppSent?.();
                            }}
                          >
                            <MessageCircle /> Send on WhatsApp
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="px-4 py-3">
                    <ScriptBody text={text} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

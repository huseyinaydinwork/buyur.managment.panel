"use client";

import { useState } from "react";
import { addDays, format } from "date-fns";
import { changeLeadStage, logLeadActivity, updateLead } from "@/actions/leads";
import { completeFollowUp, createFollowUp } from "@/actions/followups";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/input";
import {
  ACTIVITY_TYPE_LABELS,
  LEAD_STATUS_LABELS,
  LOGGABLE_ACTIVITY_TYPES,
  type LeadStatus,
  type LoggableActivityType,
} from "@/lib/constants";
import { fmtMoney, toInputDateTime } from "@/lib/format";
import { useAppData, useSellers } from "./app-context";
import { formValues, useAction } from "./use-action";

// ─── Quick date chips for follow-ups ─────────────────────────────────────────

function quickDates() {
  const at = (d: Date, h: number, m = 0) => {
    const x = new Date(d);
    x.setHours(h, m, 0, 0);
    return x;
  };
  const now = new Date();
  const laterToday = new Date(now.getTime() + 2 * 3600_000);
  laterToday.setMinutes(laterToday.getMinutes() < 30 ? 30 : 0, 0, 0);
  if (laterToday.getMinutes() === 0) laterToday.setHours(laterToday.getHours() + 1);
  const nextMonday = addDays(now, ((8 - now.getDay()) % 7) || 7);
  return [
    { label: "In 2h", value: laterToday },
    { label: "Tomorrow 10:00", value: at(addDays(now, 1), 10) },
    { label: "In 3 days", value: at(addDays(now, 3), 10) },
    { label: `Next ${format(nextMonday, "EEE")}`, value: at(nextMonday, 10) },
    { label: "In 2 weeks", value: at(addDays(now, 14), 10) },
  ];
}

function DateTimeWithChips({ name, defaultValue, error, label, required }: { name: string; defaultValue?: string; error?: string[]; label: string; required?: boolean }) {
  const [value, setValue] = useState(defaultValue ?? "");
  return (
    <Field label={label} required={required} error={error}>
      <Input type="datetime-local" name={name} value={value} onChange={(e) => setValue(e.target.value)} />
      <div className="flex flex-wrap gap-1">
        {quickDates().map((q) => (
          <button
            key={q.label}
            type="button"
            onClick={() => setValue(toInputDateTime(q.value))}
            className="cursor-pointer rounded border bg-subtle px-2 py-0.5 text-[11.5px] text-muted-foreground hover:border-foreground/20 hover:text-foreground"
          >
            {q.label}
          </button>
        ))}
      </div>
    </Field>
  );
}

// ─── Log activity ────────────────────────────────────────────────────────────

export function LogActivityDialog({
  open,
  onOpenChange,
  leadId,
  businessId,
  defaultType = "NOTE",
  title,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  leadId?: string;
  businessId?: string;
  defaultType?: LoggableActivityType;
  title?: string;
}) {
  const { run, pending, fieldErrors: fe, setFieldErrors } = useAction();
  const [type, setType] = useState<LoggableActivityType>(defaultType);
  const close = (o: boolean) => {
    if (!o) setFieldErrors({});
    onOpenChange(o);
  };
  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent title={title ?? "Log activity"}>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            run(() => logLeadActivity({ ...formValues(e.currentTarget), leadId: leadId ?? null, businessId: businessId ?? null }), {
              success: `${ACTIVITY_TYPE_LABELS[type]} logged`,
              onSuccess: () => close(false),
            });
          }}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-wrap gap-1">
            {LOGGABLE_ACTIVITY_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`cursor-pointer rounded-md border px-2.5 py-1 text-[12.5px] font-medium ${type === t ? "border-foreground bg-foreground text-background" : "bg-card text-muted-foreground hover:text-foreground"}`}
              >
                {ACTIVITY_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
          <input type="hidden" name="type" value={type} />
          <Field label={type === "NOTE" ? "Note" : "What happened?"} required={type === "NOTE"} error={fe.body}>
            <Textarea
              name="body"
              autoFocus
              rows={4}
              placeholder={type === "CALL" ? "e.g. Talked to owner, interested in multi-language menu…" : "Write a note…"}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) e.currentTarget.form?.requestSubmit();
              }}
            />
          </Field>
          <Field label="When" hint="Leave empty for now." error={fe.occurredAt}>
            <Input type="datetime-local" name="occurredAt" max={toInputDateTime(new Date())} />
          </Field>
          <DialogFooter>
            <span className="mr-auto hidden text-[11.5px] text-muted-foreground sm:block">Ctrl + Enter to save</span>
            <Button type="button" variant="outline" onClick={() => close(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Follow-ups ──────────────────────────────────────────────────────────────

export function FollowUpDialog({
  open,
  onOpenChange,
  leadId,
  leadName,
  defaultOwnerId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  leadId: string;
  leadName?: string;
  defaultOwnerId?: string | null;
}) {
  const sellers = useSellers();
  const { user } = useAppData();
  const { run, pending, fieldErrors: fe, setFieldErrors } = useAction();
  const close = (o: boolean) => {
    if (!o) setFieldErrors({});
    onOpenChange(o);
  };
  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent title="Schedule follow-up" description={leadName}>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            run(() => createFollowUp({ ...formValues(e.currentTarget), leadId }), {
              success: "Follow-up scheduled",
              onSuccess: () => close(false),
            });
          }}
          className="flex flex-col gap-4"
        >
          <DateTimeWithChips name="dueAt" label="Follow-up date" required error={fe.dueAt} />
          <Field label="Follow-up note" error={fe.note}>
            <Input name="note" placeholder="e.g. Call owner about pricing" />
          </Field>
          <Field label="Owner">
            <Select name="ownerId" defaultValue={defaultOwnerId ?? user.id}>
              {sellers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => close(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              Schedule
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CompleteFollowUpDialog({
  open,
  onOpenChange,
  followUp,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  followUp: { id: string; note: string | null; leadName: string } | null;
}) {
  const { run, pending, fieldErrors: fe, setFieldErrors } = useAction();
  const [scheduleNext, setScheduleNext] = useState(false);
  const close = (o: boolean) => {
    if (!o) {
      setFieldErrors({});
      setScheduleNext(false);
    }
    onOpenChange(o);
  };
  if (!followUp) return null;
  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent title="Complete follow-up" description={`${followUp.leadName}${followUp.note ? ` · ${followUp.note}` : ""}`}>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            const v = formValues(e.currentTarget);
            if (!scheduleNext) v.nextDueAt = null;
            run(() => completeFollowUp({ ...v, id: followUp.id }), {
              success: (d) => (d.scheduledNext ? "Follow-up completed · next one scheduled" : "Follow-up completed"),
              onSuccess: () => close(false),
            });
          }}
          className="flex flex-col gap-4"
        >
          <Field label="Outcome" error={fe.outcome}>
            <Textarea name="outcome" autoFocus rows={3} placeholder="What happened? (optional)" />
          </Field>
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
            <Checkbox checked={scheduleNext} onChange={(e) => setScheduleNext(e.target.checked)} />
            Schedule the next follow-up
          </label>
          {scheduleNext && (
            <>
              <DateTimeWithChips name="nextDueAt" label="Next follow-up" required error={fe.nextDueAt} />
              <Field label="Next note">
                <Input name="nextNote" placeholder="e.g. Send proposal" />
              </Field>
            </>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => close(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="success" loading={pending}>
              Complete
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Stage change ────────────────────────────────────────────────────────────

export function needsStageDialog(status: string) {
  return status === "WON" || status === "LOST" || status === "DEMO_SCHEDULED";
}

export function StageChangeDialog({
  open,
  onOpenChange,
  lead,
  target,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  lead: { id: string; name: string; value: number; status: string; demoDate?: Date | string | null } | null;
  target: LeadStatus | null;
  onDone?: (ok: boolean) => void;
}) {
  const { run, pending, fieldErrors: fe, setFieldErrors } = useAction();
  const close = (o: boolean, ok = false) => {
    if (!o) {
      setFieldErrors({});
      onDone?.(ok);
    }
    onOpenChange(o);
  };
  if (!lead || !target) return null;
  return (
    <Dialog open={open} onOpenChange={(o) => close(o)}>
      <DialogContent
        title={target === "WON" ? "Mark as won 🎉" : target === "LOST" ? "Mark as lost" : `Move to ${LEAD_STATUS_LABELS[target]}`}
        description={lead.name}
        size="sm"
      >
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            run(() => changeLeadStage({ ...formValues(e.currentTarget), id: lead.id, status: target }), {
              success: target === "WON" ? "Deal won — revenue updated" : `Moved to ${LEAD_STATUS_LABELS[target]}`,
              onSuccess: () => close(false, true),
            });
          }}
          className="flex flex-col gap-4"
        >
          {target === "WON" && (
            <Field label="Final deal value (₺)" required error={fe.value} hint={lead.value ? `Estimated: ${fmtMoney(lead.value)}` : undefined}>
              <Input name="value" inputMode="numeric" autoFocus defaultValue={lead.value || ""} />
            </Field>
          )}
          {target === "LOST" && (
            <Field label="Reason" error={fe.lostReason}>
              <Select name="lostReason" defaultValue="">
                <option value="">— Select —</option>
                {["Price too high", "Chose a competitor", "Not ready / timing", "No response", "Not a fit", "Other"].map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          {target === "DEMO_SCHEDULED" && (
            <DateTimeWithChips name="demoDate" label="Demo date" error={fe.demoDate} defaultValue={toInputDateTime(lead.demoDate ?? null)} />
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => close(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending} variant={target === "WON" ? "success" : target === "LOST" ? "destructive" : "default"}>
              {target === "WON" ? "Mark won" : target === "LOST" ? "Mark lost" : "Move"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit lead ───────────────────────────────────────────────────────────────

export type LeadEditValue = {
  id: string;
  ownerId: string | null;
  sourceId: string | null;
  campaignId: string | null;
  contactId: string | null;
  value: number;
  proposalInterest: boolean;
  demoDate: Date | string | null;
  notes: string | null;
};

export function LeadEditDialog({
  open,
  onOpenChange,
  lead,
  contacts,
  allSources,
  allCampaigns,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  lead: LeadEditValue;
  contacts: { id: string; name: string; phone: string | null }[];
  allSources: { id: string; name: string }[];
  allCampaigns: { id: string; name: string }[];
}) {
  const sellers = useSellers();
  const { run, pending, fieldErrors: fe, setFieldErrors } = useAction();
  const close = (o: boolean) => {
    if (!o) setFieldErrors({});
    onOpenChange(o);
  };
  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent title="Edit lead" size="lg">
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            run(() => updateLead({ ...formValues(e.currentTarget), id: lead.id }), { success: "Lead updated", onSuccess: () => close(false) });
          }}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        >
          <Field label="Owner" error={fe.ownerId}>
            <Select name="ownerId" defaultValue={lead.ownerId ?? ""}>
              <option value="">Unassigned</option>
              {sellers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Deal / estimated value (₺)" error={fe.value}>
            <Input name="value" inputMode="numeric" defaultValue={lead.value || ""} />
          </Field>
          <Field label="Source" error={fe.sourceId}>
            <Select name="sourceId" defaultValue={lead.sourceId ?? ""}>
              <option value="">—</option>
              {allSources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Campaign" error={fe.campaignId}>
            <Select name="campaignId" defaultValue={lead.campaignId ?? ""}>
              <option value="">—</option>
              {allCampaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Primary contact for this lead" error={fe.contactId}>
            <Select name="contactId" defaultValue={lead.contactId ?? ""}>
              <option value="">—</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.phone ? ` · ${c.phone}` : ""}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Demo date" error={fe.demoDate}>
            <Input type="datetime-local" name="demoDate" defaultValue={toInputDateTime(lead.demoDate)} />
          </Field>
          <label className="flex cursor-pointer items-center gap-2 text-sm sm:col-span-2">
            <Checkbox name="proposalInterest" defaultChecked={lead.proposalInterest} />
            Asked about pricing / proposal <span className="text-muted-foreground">(+score)</span>
          </label>
          <Field label="Notes" error={fe.notes} className="sm:col-span-2">
            <Textarea name="notes" rows={4} defaultValue={lead.notes ?? ""} />
          </Field>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => close(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

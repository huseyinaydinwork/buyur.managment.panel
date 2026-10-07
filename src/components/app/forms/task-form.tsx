"use client";

import { useState } from "react";
import { saveTask } from "@/actions/tasks";
import { searchBusinessOptions, searchLeadOptions } from "@/actions/leads";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { TASK_PRIORITIES, TASK_PRIORITY_LABELS, TASK_STATUSES, TASK_STATUS_LABELS } from "@/lib/constants";
import { toInputDateTime } from "@/lib/format";
import { useAppData } from "../app-context";
import { EntityPicker, type PickerOption } from "../entity-picker";
import { formValues, useAction } from "../use-action";

export type TaskFormValue = {
  id: string;
  title: string;
  description: string | null;
  ownerId: string | null;
  dueAt: Date | string | null;
  priority: string;
  status: string;
  lead: PickerOption | null;
  business: PickerOption | null;
  projectId?: string | null;
};

export function TaskDialog({
  open,
  onOpenChange,
  task,
  defaultLead,
  defaultBusiness,
  projectId,
  defaultStatus,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  task?: TaskFormValue | null;
  defaultLead?: PickerOption | null;
  defaultBusiness?: PickerOption | null;
  /** Creates the task inside this project (project mode). */
  projectId?: string;
  defaultStatus?: string;
}) {
  const { user, users, can } = useAppData();
  const { run, pending, fieldErrors: fe, setFieldErrors } = useAction();
  const [lead, setLead] = useState<PickerOption | null>(task?.lead ?? defaultLead ?? null);
  const [business, setBusiness] = useState<PickerOption | null>(task?.business ?? defaultBusiness ?? null);
  const canLink = can.leads;

  const close = (o: boolean) => {
    if (!o) setFieldErrors({});
    onOpenChange(o);
  };
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const values = formValues(e.currentTarget);
    run(() => saveTask({ ...values, id: task?.id ?? null }), {
      success: task ? "Task updated" : "Task created",
      onSuccess: () => close(false),
    });
  };
  const t = task;
  const defaultDue = t ? toInputDateTime(t.dueAt) : "";
  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent title={t ? "Edit task" : "New task"} size="lg">
        <form onSubmit={onSubmit} noValidate className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {(t?.projectId !== undefined || projectId !== undefined) && (
            <input type="hidden" name="projectId" value={t?.projectId ?? projectId ?? ""} />
          )}
          <Field label="Title" required htmlFor="t-title" error={fe.title} className="sm:col-span-2">
            <Input id="t-title" name="title" autoFocus defaultValue={t?.title} placeholder="e.g. Send pricing to Burger Lab" />
          </Field>
          <Field label="Owner" htmlFor="t-owner" error={fe.ownerId}>
            <Select id="t-owner" name="ownerId" defaultValue={t?.ownerId ?? user.id}>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                  {u.id === user.id ? " (me)" : ""}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Due" htmlFor="t-due" error={fe.dueAt}>
            <Input id="t-due" name="dueAt" type="datetime-local" defaultValue={defaultDue} />
          </Field>
          <Field label="Priority" htmlFor="t-pri" error={fe.priority}>
            <Select id="t-pri" name="priority" defaultValue={t?.priority ?? "MEDIUM"}>
              {TASK_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {TASK_PRIORITY_LABELS[p]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status" htmlFor="t-status" error={fe.status}>
            <Select id="t-status" name="status" defaultValue={t?.status ?? defaultStatus ?? "TODO"}>
              {TASK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {TASK_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          </Field>
          {canLink && (
            <>
              <Field label="Related lead" error={fe.leadId}>
                <EntityPicker name="leadId" value={lead} onChange={setLead} search={searchLeadOptions} placeholder="None" />
              </Field>
              <Field label="Related business" error={fe.businessId}>
                <EntityPicker name="businessId" value={business} onChange={setBusiness} search={searchBusinessOptions} placeholder="None" />
              </Field>
            </>
          )}
          <Field label="Description" htmlFor="t-desc" error={fe.description} className="sm:col-span-2">
            <Textarea id="t-desc" name="description" defaultValue={t?.description ?? ""} rows={3} />
          </Field>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => close(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              {t ? "Save" : "Create task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

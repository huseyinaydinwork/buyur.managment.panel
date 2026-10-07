"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saveProject } from "@/actions/projects";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import {
  PROJECT_STATUSES,
  PROJECT_STATUS_LABELS,
  PROJECT_TEAMS,
  PROJECT_TEAM_LABELS,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
} from "@/lib/constants";
import { toInputDate } from "@/lib/format";
import { assignableProjectTeams } from "@/lib/permissions";
import { useAppData } from "../app-context";
import { formValues, useAction } from "../use-action";

export type ProjectFormValue = {
  id: string;
  name: string;
  description: string | null;
  team: string;
  status: string;
  priority: string;
  ownerId: string | null;
  startDate: Date | string | null;
  dueDate: Date | string | null;
};

export function ProjectDialog({
  open,
  onOpenChange,
  project,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  project?: ProjectFormValue | null;
}) {
  const router = useRouter();
  const { user, users } = useAppData();
  const { run, pending, fieldErrors: fe, setFieldErrors } = useAction();
  const p = project;
  // Non-admins may only pick their own team or "Everyone".
  const allowed = assignableProjectTeams(user);
  const teams = PROJECT_TEAMS.filter((t) => allowed.includes(t) || t === p?.team);
  const defaultTeam = p?.team ?? (user.role === "MARKETING" || user.role === "SALES" ? user.role : "GENERAL");
  const close = (o: boolean) => {
    if (!o) setFieldErrors({});
    onOpenChange(o);
  };
  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent title={p ? "Edit project" : "New project"} description="Projects group tasks for a team. Team controls who can see it." size="lg">
        <form
          noValidate
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => saveProject({ ...formValues(e.currentTarget), id: p?.id ?? null }), {
              onSuccess: ({ id }) => {
                close(false);
                if (p) toast.success("Project updated");
                else {
                  toast.success("Project created");
                  router.push(`/projects/${id}`);
                }
              },
            });
          }}
        >
          <Field label="Name" required htmlFor="p-name" error={fe.name} className="sm:col-span-2">
            <Input id="p-name" name="name" autoFocus defaultValue={p?.name} placeholder="e.g. Q4 Instagram relaunch" />
          </Field>
          <Field label="Team" htmlFor="p-team" error={fe.team} hint="Who can see and work on it">
            <Select id="p-team" name="team" defaultValue={defaultTeam}>
              {teams.map((t) => (
                <option key={t} value={t}>
                  {PROJECT_TEAM_LABELS[t]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Owner" htmlFor="p-owner" error={fe.ownerId}>
            <Select id="p-owner" name="ownerId" defaultValue={p?.ownerId ?? user.id}>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                  {u.id === user.id ? " (me)" : ""}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status" htmlFor="p-status" error={fe.status}>
            <Select id="p-status" name="status" defaultValue={p?.status ?? "PLANNING"}>
              {PROJECT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {PROJECT_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Priority" htmlFor="p-pri" error={fe.priority}>
            <Select id="p-pri" name="priority" defaultValue={p?.priority ?? "MEDIUM"}>
              {TASK_PRIORITIES.map((s) => (
                <option key={s} value={s}>
                  {TASK_PRIORITY_LABELS[s]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Start date" htmlFor="p-start" error={fe.startDate}>
            <Input id="p-start" name="startDate" type="date" defaultValue={toInputDate(p?.startDate)} />
          </Field>
          <Field label="Due date" htmlFor="p-due" error={fe.dueDate}>
            <Input id="p-due" name="dueDate" type="date" defaultValue={toInputDate(p?.dueDate)} />
          </Field>
          <Field label="Description" htmlFor="p-desc" error={fe.description} className="sm:col-span-2">
            <Textarea id="p-desc" name="description" rows={3} defaultValue={p?.description ?? ""} placeholder="Goal, scope, definition of done…" />
          </Field>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => close(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              {p ? "Save" : "Create project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, KeyRound, LockKeyhole, LogOut, MoreHorizontal, Pencil, Plus, Trash2, UserCheck, UserX } from "lucide-react";
import { logout } from "@/actions/auth";
import {
  changePassword,
  createUser,
  deleteUser,
  moveLeadSource,
  resetUserPassword,
  saveLeadSource,
  saveStageProbabilities,
  setLeadSourceActive,
  setUserActive,
  setUserPermissions,
  signOutOtherSessions,
  updateProfile,
  updateUser,
} from "@/actions/settings";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown";
import { Field, Input, Select } from "@/components/ui/input";
import { Avatar, Badge } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { LEAD_STATUS_LABELS, ROLES, ROLE_LABELS, label, type LeadStatus } from "@/lib/constants";
import { fmtRelative } from "@/lib/format";
import { MODULE_GROUPS, MODULE_LABELS, can as canAccess, roleDefault, type Module, type PermissionOverrides } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { formValues, useAction } from "./use-action";

// ─── Profile ─────────────────────────────────────────────────────────────────

export function ProfileForm({ name, email }: { name: string; email: string }) {
  const { run, pending, fieldErrors: fe } = useAction();
  return (
    <form
      noValidate
      className="grid max-w-lg grid-cols-1 gap-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => updateProfile(formValues(e.currentTarget)), { success: "Profile saved" });
      }}
    >
      <Field label="Name" error={fe.name}>
        <Input name="name" defaultValue={name} />
      </Field>
      <Field label="Email" error={fe.email}>
        <Input name="email" type="email" defaultValue={email} />
      </Field>
      <div className="sm:col-span-2">
        <Button type="submit" size="sm" loading={pending}>
          Save profile
        </Button>
      </div>
    </form>
  );
}

export function PasswordForm() {
  const { run, pending, fieldErrors: fe } = useAction();
  return (
    <form
      noValidate
      className="grid max-w-lg grid-cols-1 gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        run(() => changePassword(formValues(form)), { success: "Password changed — other sessions signed out", onSuccess: () => form.reset() });
      }}
    >
      <Field label="Current password" error={fe.currentPassword}>
        <Input name="currentPassword" type="password" autoComplete="current-password" />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="New password" error={fe.newPassword} hint="At least 8 characters">
          <Input name="newPassword" type="password" autoComplete="new-password" />
        </Field>
        <Field label="Confirm new password" error={fe.confirmPassword}>
          <Input name="confirmPassword" type="password" autoComplete="new-password" />
        </Field>
      </div>
      <div>
        <Button type="submit" size="sm" variant="outline" loading={pending}>
          <KeyRound /> Change password
        </Button>
      </div>
    </form>
  );
}

export function AccountActions({ sessions }: { sessions: { id: string; userAgent: string | null; lastSeenAt: string; current: boolean }[] }) {
  const { run, pending } = useAction();
  return (
    <div className="flex flex-col gap-4">
      <ul className="divide-y rounded-md border text-[13px]">
        {sessions.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-3 px-3 py-2">
            <span className="truncate text-muted-foreground">{s.userAgent ?? "Unknown device"}</span>
            <span className="shrink-0 text-[12px]">{s.current ? <Badge tone="green">This device</Badge> : `active ${fmtRelative(s.lastSeenAt)}`}</span>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" loading={pending} onClick={() => run(() => signOutOtherSessions(), { success: "Signed out of other sessions" })} disabled={sessions.length <= 1}>
          Sign out other sessions
        </Button>
        <Button size="sm" variant="destructive" onClick={() => logout()}>
          <LogOut /> Sign out
        </Button>
      </div>
    </div>
  );
}

// ─── Team ────────────────────────────────────────────────────────────────────

type TeamUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  lastLoginAt: string | null;
  permissions: PermissionOverrides;
};

export function TeamTable({ users, meId }: { users: TeamUser[]; meId: string }) {
  const [editing, setEditing] = useState<TeamUser | null>(null);
  const [creating, setCreating] = useState(false);
  const [resetting, setResetting] = useState<TeamUser | null>(null);
  const [toggling, setToggling] = useState<TeamUser | null>(null);
  const [removing, setRemoving] = useState<TeamUser | null>(null);
  const [permUser, setPermUser] = useState<TeamUser | null>(null);
  const { run, pending } = useAction();
  return (
    <>
      <div className="mb-3 flex justify-end">
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus /> Create user
        </Button>
      </div>
      <div className="rounded-md border">
        <Table>
          <THead>
            <tr>
              <TH>User</TH>
              <TH>Role</TH>
              <TH>Status</TH>
              <TH>Last login</TH>
              <TH />
            </tr>
          </THead>
          <TBody>
            {users.map((u) => (
              <TR key={u.id} className={u.isActive ? "" : "opacity-60"}>
                <TD>
                  <div className="flex items-center gap-2.5">
                    <Avatar name={u.name} className="size-7" />
                    <div>
                      <p className="font-medium">
                        {u.name} {u.id === meId && <span className="text-[11px] text-muted-foreground">(you)</span>}
                      </p>
                      <p className="text-[12px] text-muted-foreground">{u.email}</p>
                    </div>
                  </div>
                </TD>
                <TD>
                  <div className="flex flex-wrap items-center gap-1">
                    <Badge tone={u.role === "ADMIN" ? "red" : u.role === "SALES" ? "blue" : u.role === "PROJECT" ? "green" : "amber"}>{label(ROLE_LABELS, u.role)}</Badge>
                    {u.role !== "ADMIN" && Object.keys(u.permissions).length > 0 && (
                      <Badge tone="outline" title="Has custom screen access">
                        <LockKeyhole className="size-2.5" /> Custom access
                      </Badge>
                    )}
                  </div>
                </TD>
                <TD>{u.isActive ? <Badge tone="green">Active</Badge> : <Badge tone="outline">Deactivated</Badge>}</TD>
                <TD className="text-muted-foreground">{u.lastLoginAt ? fmtRelative(u.lastLoginAt) : "Never"}</TD>
                <TD className="w-10">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon-xs" variant="ghost" aria-label="User actions">
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onSelect={() => setEditing(u)}>
                        <Pencil /> Edit / change role
                      </DropdownMenuItem>
                      {u.role !== "ADMIN" && (
                        <DropdownMenuItem onSelect={() => setPermUser(u)}>
                          <LockKeyhole /> Screen permissions
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onSelect={() => setResetting(u)}>
                        <KeyRound /> Reset password
                      </DropdownMenuItem>
                      {u.id !== meId && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem destructive={u.isActive} onSelect={() => setToggling(u)}>
                            {u.isActive ? <UserX /> : <UserCheck />} {u.isActive ? "Deactivate" : "Reactivate"}
                          </DropdownMenuItem>
                          <DropdownMenuItem destructive onSelect={() => setRemoving(u)}>
                            <Trash2 /> Delete user
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>
      <PermissionsDialog key={permUser?.id ?? "perm"} user={permUser} onOpenChange={(o) => !o && setPermUser(null)} />
      <UserDialog key={`new-${creating}`} open={creating} onOpenChange={setCreating} />
      <UserDialog key={editing?.id ?? "edit"} open={!!editing} onOpenChange={(o) => !o && setEditing(null)} user={editing} />
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={`Delete ${removing?.name ?? "user"}?`}
        description="The account is removed permanently. Their leads become unassigned and open follow-ups move to you. Activity history is kept."
        confirmLabel="Delete user"
        loading={pending}
        onConfirm={() => removing && run(() => deleteUser(removing.id), { success: "User deleted", onSuccess: () => setRemoving(null) })}
      />
      <ResetPasswordDialog key={resetting?.id ?? "reset"} user={resetting} onOpenChange={(o) => !o && setResetting(null)} />
      <ConfirmDialog
        open={!!toggling}
        onOpenChange={(o) => !o && setToggling(null)}
        title={toggling?.isActive ? `Deactivate ${toggling?.name}?` : `Reactivate ${toggling?.name}?`}
        description={toggling?.isActive ? "They are signed out immediately and can't log in. Their leads and history stay." : "They will be able to sign in again."}
        confirmLabel={toggling?.isActive ? "Deactivate" : "Reactivate"}
        destructive={!!toggling?.isActive}
        loading={pending}
        onConfirm={() =>
          toggling &&
          run(() => setUserActive(toggling.id, !toggling.isActive), {
            success: toggling.isActive ? "User deactivated" : "User reactivated",
            onSuccess: () => setToggling(null),
          })
        }
      />
    </>
  );
}

function UserDialog({ open, onOpenChange, user }: { open: boolean; onOpenChange: (o: boolean) => void; user?: TeamUser | null }) {
  const { run, pending, fieldErrors: fe } = useAction();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={user ? "Edit user" : "Create user"} description={user ? undefined : "Share the temporary password securely; they can change it in Settings."}>
        <form
          noValidate
          className="grid grid-cols-1 gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            const v = formValues(e.currentTarget);
            run(() => (user ? updateUser({ ...v, id: user.id }) : createUser(v)), {
              success: user ? "User updated" : "User created",
              onSuccess: () => onOpenChange(false),
            });
          }}
        >
          <Field label="Name" required error={fe.name}>
            <Input name="name" autoFocus defaultValue={user?.name} />
          </Field>
          <Field label="Email" required error={fe.email}>
            <Input name="email" type="email" defaultValue={user?.email} />
          </Field>
          <Field label="Role" required error={fe.role}>
            <Select name="role" defaultValue={user?.role ?? "SALES"}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </Select>
          </Field>
          {!user && (
            <Field label="Temporary password" required error={fe.password} hint="At least 8 characters">
              <Input name="password" type="text" autoComplete="off" />
            </Field>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              {user ? "Save" : "Create user"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({ user, onOpenChange }: { user: TeamUser | null; onOpenChange: (o: boolean) => void }) {
  const { run, pending, fieldErrors: fe } = useAction();
  return (
    <Dialog open={!!user} onOpenChange={onOpenChange}>
      <DialogContent title="Reset password" description={user ? `${user.name} will be signed out everywhere.` : undefined} size="sm">
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            const pw = String(new FormData(e.currentTarget).get("password") ?? "");
            if (user) run(() => resetUserPassword(user.id, pw), { success: "Password reset", onSuccess: () => onOpenChange(false) });
          }}
        >
          <Field label="New password" error={fe.password}>
            <Input name="password" type="text" autoComplete="off" autoFocus />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              Reset
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Lead sources ────────────────────────────────────────────────────────────

export function LeadSourcesEditor({ sources }: { sources: { id: string; name: string; isActive: boolean; leads: number }[] }) {
  const { run, pending, fieldErrors: fe } = useAction();
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <div className="flex max-w-xl flex-col gap-3">
      <form
        noValidate
        className="flex items-start gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          run(() => saveLeadSource(formValues(form)), { success: "Source added", onSuccess: () => form.reset() });
        }}
      >
        <Field error={fe.name} className="flex-1">
          <Input name="name" placeholder="New source, e.g. Google Maps" />
        </Field>
        <Button type="submit" size="default" loading={pending}>
          <Plus /> Add
        </Button>
      </form>
      <ul className="divide-y rounded-md border">
        {sources.map((s, i) => (
          <li key={s.id} className="flex items-center gap-2 px-3 py-2 text-[13px]">
            {editing === s.id ? (
              <form
                className="flex flex-1 gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const name = String(new FormData(e.currentTarget).get("name") ?? "");
                  run(() => saveLeadSource({ id: s.id, name }), { success: "Source renamed", onSuccess: () => setEditing(null) });
                }}
              >
                <Input name="name" defaultValue={s.name} autoFocus className="h-8" onKeyDown={(e) => e.key === "Escape" && setEditing(null)} />
                <Button size="sm" type="submit">
                  Save
                </Button>
              </form>
            ) : (
              <>
                <span className={`flex-1 ${s.isActive ? "" : "text-muted-foreground line-through"}`}>{s.name}</span>
                <span className="text-[12px] text-muted-foreground tabular">{s.leads} leads</span>
                <Button size="icon-xs" variant="ghost" aria-label="Move up" disabled={i === 0} onClick={() => run(() => moveLeadSource(s.id, "up"))}>
                  <ArrowUp />
                </Button>
                <Button size="icon-xs" variant="ghost" aria-label="Move down" disabled={i === sources.length - 1} onClick={() => run(() => moveLeadSource(s.id, "down"))}>
                  <ArrowDown />
                </Button>
                <Button size="xs" variant="ghost" onClick={() => setEditing(s.id)}>
                  Rename
                </Button>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => run(() => setLeadSourceActive(s.id, !s.isActive), { success: s.isActive ? "Source hidden from forms" : "Source enabled" })}
                >
                  {s.isActive ? "Disable" : "Enable"}
                </Button>
              </>
            )}
          </li>
        ))}
      </ul>
      <p className="text-[12px] text-muted-foreground">Disabled sources stay on existing leads but can&apos;t be picked for new ones.</p>
    </div>
  );
}

// ─── Pipeline probabilities ──────────────────────────────────────────────────

export function PipelineSettings({ probabilities, editable }: { probabilities: Record<string, number>; editable: boolean }) {
  const { run, pending, fieldErrors: fe } = useAction();
  return (
    <form
      noValidate
      className="flex max-w-lg flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => saveStageProbabilities(formValues(e.currentTarget)), { success: "Pipeline probabilities saved" });
      }}
    >
      <div className="divide-y rounded-md border">
        {Object.entries(probabilities).map(([stage, p]) => (
          <div key={stage} className="flex items-center justify-between gap-3 px-3 py-2 text-[13px]">
            <span>{LEAD_STATUS_LABELS[stage as LeadStatus]}</span>
            <div className="flex items-center gap-1.5">
              <Input name={stage} type="number" min={0} max={100} defaultValue={p} disabled={!editable} className="h-8 w-20 text-right" aria-invalid={!!fe[stage]} />
              <span className="text-muted-foreground">%</span>
            </div>
          </div>
        ))}
        <div className="flex items-center justify-between px-3 py-2 text-[13px] text-muted-foreground">
          <span>Won / Lost</span>
          <span>100% / 0%</span>
        </div>
      </div>
      <p className="text-[12px] text-muted-foreground">Used for the weighted pipeline value: Σ deal value × stage probability.</p>
      {editable && (
        <div>
          <Button type="submit" size="sm" loading={pending}>
            Save probabilities
          </Button>
        </div>
      )}
    </form>
  );
}

// ─── Per-user screen permissions ─────────────────────────────────────────────

function PermissionsDialog({ user, onOpenChange }: { user: TeamUser | null; onOpenChange: (o: boolean) => void }) {
  const { run, pending } = useAction();
  const subject = user ? { role: user.role, permissions: user.permissions } : null;
  const [access, setAccess] = useState<Record<string, boolean>>(() =>
    subject ? Object.fromEntries(MODULE_GROUPS.flatMap((g) => g.modules).map((m) => [m, canAccess(subject, m)])) : {},
  );
  if (!user) return null;
  const isDefault = (m: Module) => access[m] === roleDefault(user.role, m);
  const customCount = MODULE_GROUPS.flatMap((g) => g.modules).filter((m) => !isDefault(m)).length;
  const resetToRole = () =>
    setAccess(Object.fromEntries(MODULE_GROUPS.flatMap((g) => g.modules).map((m) => [m, roleDefault(user.role, m)])));

  return (
    <Dialog open={!!user} onOpenChange={onOpenChange}>
      <DialogContent
        title={`Screen permissions · ${user.name}`}
        description={`Role: ${label(ROLE_LABELS, user.role)}. Ticked screens are visible. Changes apply on their next click — no re-login needed.`}
        size="lg"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {MODULE_GROUPS.map((g) => (
            <fieldset key={g.title} className="rounded-md border">
              <legend className="ml-3 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{g.title}</legend>
              <div className="divide-y">
                {g.modules.map((m) => (
                  <label key={m} className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-[13px] hover:bg-subtle">
                    <span className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        className="size-4 cursor-pointer accent-[var(--primary)]"
                        checked={!!access[m]}
                        onChange={(e) => setAccess((a) => ({ ...a, [m]: e.target.checked }))}
                      />
                      {MODULE_LABELS[m]}
                    </span>
                    <span
                      className={cn(
                        "text-[10.5px] font-medium",
                        isDefault(m) ? "text-muted-foreground" : access[m] ? "text-success" : "text-destructive",
                      )}
                    >
                      {isDefault(m) ? "role default" : access[m] ? "granted" : "blocked"}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
        <p className="mt-3 text-[12px] text-muted-foreground">
          Access is enforced on the server for every page and action, not just hidden in the menu.
        </p>
        <DialogFooter>
          <Button type="button" variant="ghost" className="mr-auto" onClick={resetToRole} disabled={customCount === 0}>
            Reset to role defaults
          </Button>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            loading={pending}
            onClick={() =>
              run(() => setUserPermissions(user.id, access), {
                success: (d) => (d.custom ? `Saved · ${d.custom} custom permission${d.custom > 1 ? "s" : ""}` : "Saved · using role defaults"),
                onSuccess: () => onOpenChange(false),
              })
            }
          >
            Save permissions
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

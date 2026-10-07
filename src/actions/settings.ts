"use server";

import { db } from "@/lib/db";
import {
  destroyOtherSessions,
  hashPassword,
  requireModule,
  requireUser,
  verifyPassword,
} from "@/lib/auth";
import { parse, runAction } from "@/lib/action";
import { AppError, ValidationError } from "@/lib/errors";
import { logActivity } from "@/lib/activity";
import { revalidateApp } from "@/lib/revalidate";
import { setStageProbabilities } from "@/lib/settings";
import { OPEN_STATUSES } from "@/lib/constants";
import { MODULES, roleDefault } from "@/lib/permissions";
import {
  leadSourceSchema,
  passwordChangeSchema,
  profileSchema,
  userCreateSchema,
  userUpdateSchema,
} from "@/lib/validation";
import { z } from "zod";

// ─── Team (admin) ────────────────────────────────────────────────────────────

export async function createUser(input: Record<string, unknown>) {
  return runAction(async () => {
    const admin = await requireModule("admin");
    const d = parse(userCreateSchema, input);
    if (await db.user.findUnique({ where: { email: d.email } }))
      throw new AppError("A user with this email already exists.");
    const user = await db.user.create({
      data: { name: d.name, email: d.email, role: d.role, passwordHash: await hashPassword(d.password) },
    });
    await logActivity({ type: "USER_CREATED", userId: admin.id, entityType: "USER", entityId: user.id, metadata: { name: user.name, role: user.role } });
    revalidateApp();
    return { id: user.id };
  });
}

export async function updateUser(input: Record<string, unknown>) {
  return runAction(async () => {
    const admin = await requireModule("admin");
    const d = parse(userUpdateSchema, input);
    const existing = await db.user.findUnique({ where: { id: d.id } });
    if (!existing) throw new AppError("User not found.", "NOT_FOUND");
    if (existing.id === admin.id && d.role !== "ADMIN") throw new AppError("You can't remove your own admin role.");
    const clash = await db.user.findFirst({ where: { email: d.email, NOT: { id: d.id } } });
    if (clash) throw new AppError("Another user already uses this email.");
    await db.user.update({ where: { id: d.id }, data: { name: d.name, email: d.email, role: d.role } });
    revalidateApp();
    return { id: d.id };
  });
}

export async function setUserActive(id: string, isActive: boolean) {
  return runAction(async () => {
    const admin = await requireModule("admin");
    if (id === admin.id) throw new AppError("You can't deactivate yourself.");
    await db.user.update({ where: { id }, data: { isActive } });
    if (!isActive) await db.session.deleteMany({ where: { userId: id } }); // kick out immediately
    revalidateApp();
    return { id, isActive };
  });
}

/**
 * Saves per-user screen access. Only differences from the role defaults are
 * stored, so changing a role later still applies that role's defaults.
 */
export async function setUserPermissions(id: string, access: Record<string, boolean>) {
  return runAction(async () => {
    await requireModule("admin");
    const target = await db.user.findUnique({ where: { id } });
    if (!target) throw new AppError("User not found.", "NOT_FOUND");
    if (target.role === "ADMIN") throw new AppError("Admins always have access to everything.");
    const overrides: Record<string, boolean> = {};
    for (const m of MODULES) {
      if (typeof access[m] !== "boolean") continue;
      if (access[m] !== roleDefault(target.role, m)) overrides[m] = access[m];
    }
    await db.user.update({ where: { id }, data: { permissions: JSON.stringify(overrides) } });
    revalidateApp();
    return { id, custom: Object.keys(overrides).length };
  });
}

/**
 * Permanently removes a user. Their leads become unassigned, open follow-ups
 * move to the admin who deletes them, and history (activities) keeps working
 * with the actor shown as "System".
 */
export async function deleteUser(id: string) {
  return runAction(async () => {
    const admin = await requireModule("admin");
    if (id === admin.id) throw new AppError("You can't delete your own account.");
    const target = await db.user.findUnique({ where: { id } });
    if (!target) throw new AppError("User not found.", "NOT_FOUND");
    if (target.role === "ADMIN") {
      const admins = await db.user.count({ where: { role: "ADMIN", isActive: true } });
      if (admins <= 1) throw new AppError("At least one active admin must remain.");
    }
    await db.$transaction([
      db.followUp.updateMany({ where: { ownerId: id, completedAt: null }, data: { ownerId: admin.id } }),
      db.followUp.deleteMany({ where: { ownerId: id } }),
      db.user.delete({ where: { id } }),
    ]);
    revalidateApp();
    return { id };
  });
}

export async function resetUserPassword(id: string, password: string) {
  return runAction(async () => {
    await requireModule("admin");
    const p = parse(z.object({ password: z.string().min(8, "At least 8 characters").max(200) }), { password });
    await db.user.update({ where: { id }, data: { passwordHash: await hashPassword(p.password) } });
    await db.session.deleteMany({ where: { userId: id } });
    return { id };
  });
}

// ─── Own profile ─────────────────────────────────────────────────────────────

export async function updateProfile(input: Record<string, unknown>) {
  return runAction(async () => {
    const user = await requireUser();
    const d = parse(profileSchema, input);
    const clash = await db.user.findFirst({ where: { email: d.email, NOT: { id: user.id } } });
    if (clash) throw new AppError("Another user already uses this email.");
    await db.user.update({ where: { id: user.id }, data: { name: d.name, email: d.email } });
    revalidateApp();
    return { ok: true };
  });
}

export async function changePassword(input: Record<string, unknown>) {
  return runAction(async () => {
    const user = await requireUser();
    const d = parse(passwordChangeSchema, input);
    const row = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    if (!(await verifyPassword(d.currentPassword, row.passwordHash)))
      throw new AppError("Current password is incorrect.");
    await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(d.newPassword) } });
    await destroyOtherSessions(user.id);
    return { ok: true };
  });
}

export async function signOutOtherSessions() {
  return runAction(async () => {
    const user = await requireUser();
    await destroyOtherSessions(user.id);
    revalidateApp();
    return { ok: true };
  });
}

// ─── Lead sources (admin) ────────────────────────────────────────────────────

export async function saveLeadSource(input: Record<string, unknown>) {
  return runAction(async () => {
    await requireModule("admin");
    const d = parse(leadSourceSchema, input);
    const clash = await db.leadSource.findFirst({ where: { name: d.name, NOT: d.id ? { id: d.id } : undefined } });
    if (clash) throw new AppError("A source with this name already exists.");
    if (d.id) await db.leadSource.update({ where: { id: d.id }, data: { name: d.name } });
    else {
      const max = await db.leadSource.aggregate({ _max: { sortOrder: true } });
      await db.leadSource.create({ data: { name: d.name, sortOrder: (max._max.sortOrder ?? 0) + 1 } });
    }
    revalidateApp();
    return { ok: true };
  });
}

export async function setLeadSourceActive(id: string, isActive: boolean) {
  return runAction(async () => {
    await requireModule("admin");
    await db.leadSource.update({ where: { id }, data: { isActive } });
    revalidateApp();
    return { ok: true };
  });
}

export async function moveLeadSource(id: string, direction: "up" | "down") {
  return runAction(async () => {
    await requireModule("admin");
    const all = await db.leadSource.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
    const i = all.findIndex((s) => s.id === id);
    const j = direction === "up" ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= all.length) return { ok: true };
    [all[i], all[j]] = [all[j]!, all[i]!];
    await db.$transaction(all.map((s, idx) => db.leadSource.update({ where: { id: s.id }, data: { sortOrder: idx } })));
    revalidateApp();
    return { ok: true };
  });
}

// ─── Pipeline (admin) ────────────────────────────────────────────────────────

export async function saveStageProbabilities(input: Record<string, unknown>) {
  return runAction(async () => {
    await requireModule("admin");
    const values: Record<string, number> = {};
    const errors: Record<string, string[]> = {};
    for (const s of OPEN_STATUSES) {
      const n = Number(input[s]);
      if (!Number.isFinite(n) || n < 0 || n > 100) errors[s] = ["0–100"];
      else values[s] = Math.round(n);
    }
    if (Object.keys(errors).length) throw new ValidationError(errors);
    await setStageProbabilities(values);
    revalidateApp();
    return { ok: true };
  });
}

// ─── Notifications ───────────────────────────────────────────────────────────

export async function markNotificationsRead(ids?: string[]) {
  return runAction(async () => {
    const user = await requireUser();
    await db.notification.updateMany({
      where: { userId: user.id, readAt: null, ...(ids?.length ? { id: { in: ids } } : {}) },
      data: { readAt: new Date() },
    });
    revalidateApp();
    return { ok: true };
  });
}

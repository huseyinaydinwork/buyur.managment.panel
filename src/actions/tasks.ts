"use server";

import { db } from "@/lib/db";
import { requireModule, type CurrentUser } from "@/lib/auth";
import { parse, runAction } from "@/lib/action";
import { AppError } from "@/lib/errors";
import { logActivity, notify } from "@/lib/activity";
import { revalidateApp } from "@/lib/revalidate";
import { TASK_STATUSES } from "@/lib/constants";
import { taskSchema } from "@/lib/validation";
import { can, canEditProject } from "@/lib/permissions";

function canManageTask(
  user: CurrentUser,
  t: { ownerId: string | null; createdById: string | null; project?: { team: string; ownerId: string | null } | null },
) {
  if (t.project && canEditProject(user, t.project)) return true;
  return user.role === "ADMIN" || t.ownerId === user.id || t.createdById === user.id || t.ownerId === null;
}

export async function saveTask(input: Record<string, unknown>) {
  return runAction(async () => {
    const user = await requireModule("tasks");
    const d = parse(taskSchema, input);
    // Linking to leads/businesses requires sales access.
    if ((d.leadId || d.businessId) && !can(user, "leads")) {
      throw new AppError("You can't link tasks to leads or businesses.", "FORBIDDEN");
    }
    let businessId = d.businessId;
    let leadName: string | null = null;
    if (d.leadId) {
      const lead = await db.lead.findFirst({ where: { id: d.leadId, deletedAt: null }, include: { business: { select: { name: true } } } });
      if (!lead) throw new AppError("Related lead not found.");
      businessId = businessId ?? lead.businessId;
      leadName = lead.business.name;
    }
    if (businessId && !(await db.business.findFirst({ where: { id: businessId, deletedAt: null } })))
      throw new AppError("Related business not found.");
    if (d.ownerId && !(await db.user.findFirst({ where: { id: d.ownerId, isActive: true } })))
      throw new AppError("Owner must be an active user.");
    let projectName: string | null = null;
    if (d.projectId) {
      const project = await db.project.findFirst({ where: { id: d.projectId, deletedAt: null } });
      if (!project) throw new AppError("Project not found.");
      if (!canEditProject(user, project)) throw new AppError("You can't add tasks to this project.", "FORBIDDEN");
      projectName = project.name;
    }

    const data = {
      title: d.title,
      description: d.description,
      ownerId: d.ownerId ?? user.id,
      leadId: d.leadId,
      businessId,
      ...(d.projectId !== undefined ? { projectId: d.projectId } : {}),
      dueAt: d.dueAt,
      priority: d.priority,
      status: d.status,
      completedAt: d.status === "DONE" ? new Date() : null,
    };

    if (d.id) {
      const t = await db.task.findUnique({ where: { id: d.id }, include: { project: true } });
      if (!t) throw new AppError("Task not found.", "NOT_FOUND");
      if (!canManageTask(user, t)) throw new AppError("You can't edit this task.", "FORBIDDEN");
      await db.task.update({ where: { id: d.id }, data: { ...data, completedAt: d.status === "DONE" ? (t.completedAt ?? new Date()) : null } });
      if (t.status !== "DONE" && d.status === "DONE") {
        await logActivity({ type: "TASK_COMPLETED", userId: user.id, entityType: "TASK", entityId: t.id, leadId: d.leadId, businessId, metadata: { name: d.title, projectId: d.projectId ?? t.projectId, project: projectName ?? t.project?.name ?? null } });
      }
      if (data.ownerId !== t.ownerId) await notify(data.ownerId, user.id, { title: `Task assigned: ${d.title}`, body: `by ${user.name}`, href: "/tasks" });
      revalidateApp();
      return { id: d.id };
    }

    const task = await db.task.create({ data: { ...data, createdById: user.id } });
    await logActivity({
      type: "TASK_CREATED",
      userId: user.id,
      entityType: "TASK",
      entityId: task.id,
      leadId: d.leadId,
      businessId,
      metadata: { name: d.title, lead: leadName, projectId: d.projectId ?? null, project: projectName },
    });
    await notify(data.ownerId, user.id, { title: `New task: ${d.title}`, body: `from ${user.name}`, href: "/tasks" });
    revalidateApp();
    return { id: task.id };
  });
}

export async function setTaskStatus(id: string, status: string) {
  return runAction(async () => {
    const user = await requireModule("tasks");
    if (!(TASK_STATUSES as readonly string[]).includes(status)) throw new AppError("Invalid status.");
    const t = await db.task.findUnique({ where: { id }, include: { project: true } });
    if (!t) throw new AppError("Task not found.", "NOT_FOUND");
    if (!canManageTask(user, t)) throw new AppError("You can't update this task.", "FORBIDDEN");
    await db.task.update({ where: { id }, data: { status, completedAt: status === "DONE" ? new Date() : null } });
    if (status === "DONE" && t.status !== "DONE") {
      await logActivity({ type: "TASK_COMPLETED", userId: user.id, entityType: "TASK", entityId: id, leadId: t.leadId, businessId: t.businessId, metadata: { name: t.title, projectId: t.projectId, project: t.project?.name ?? null } });
    }
    revalidateApp();
    return { id, status };
  });
}

export async function deleteTask(id: string) {
  return runAction(async () => {
    const user = await requireModule("tasks");
    const t = await db.task.findUnique({ where: { id }, include: { project: true } });
    if (!t) throw new AppError("Task not found.", "NOT_FOUND");
    if (!canManageTask(user, t)) throw new AppError("You can't delete this task.", "FORBIDDEN");
    await db.task.delete({ where: { id } });
    revalidateApp();
    return { id };
  });
}

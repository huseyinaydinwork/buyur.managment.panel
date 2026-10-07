"use server";

import { db } from "@/lib/db";
import { requireModule, type CurrentUser } from "@/lib/auth";
import { parse, runAction } from "@/lib/action";
import { AppError } from "@/lib/errors";
import { logActivity, notify } from "@/lib/activity";
import { revalidateApp } from "@/lib/revalidate";
import { fold } from "@/lib/utils";
import { assignableProjectTeams, canEditProject, canSeeProject } from "@/lib/permissions";
import { PROJECT_STATUSES, PROJECT_STATUS_LABELS, type ProjectStatus } from "@/lib/constants";
import { projectSchema } from "@/lib/validation";

async function loadEditable(user: CurrentUser, id: string) {
  const p = await db.project.findFirst({ where: { id, deletedAt: null } });
  if (!p || !canSeeProject(user, p)) throw new AppError("Project not found.", "NOT_FOUND");
  if (!canEditProject(user, p)) throw new AppError("You can't change this project.", "FORBIDDEN");
  return p;
}

export async function saveProject(input: Record<string, unknown>) {
  return runAction(async () => {
    const user = await requireModule("projects");
    const d = parse(projectSchema, input);
    // Non-admins can only create projects for their own team or for everyone.
    if (!assignableProjectTeams(user).includes(d.team))
      throw new AppError("You can only create projects for your own team.", "FORBIDDEN");
    if (d.ownerId && !(await db.user.findFirst({ where: { id: d.ownerId, isActive: true } })))
      throw new AppError("Owner must be an active user.");

    const data = {
      name: d.name,
      description: d.description,
      team: d.team,
      status: d.status,
      priority: d.priority,
      ownerId: d.ownerId ?? user.id,
      startDate: d.startDate,
      dueDate: d.dueDate,
      searchKey: fold(d.name),
    };

    if (d.id) {
      const p = await loadEditable(user, d.id);
      await db.project.update({ where: { id: p.id }, data });
      const fields: string[] = [];
      if (p.status !== d.status) fields.push(`status → ${PROJECT_STATUS_LABELS[d.status]}`);
      if ((p.dueDate?.getTime() ?? null) !== (d.dueDate?.getTime() ?? null)) fields.push("due date");
      if (p.ownerId !== data.ownerId) fields.push("owner");
      await logActivity({
        type: "PROJECT_UPDATED",
        userId: user.id,
        entityType: "PROJECT",
        entityId: p.id,
        metadata: { name: d.name, fields: fields.join(", ") },
      });
      if (p.ownerId !== data.ownerId)
        await notify(data.ownerId, user.id, { title: `You now own project “${d.name}”`, href: `/projects/${p.id}` });
      revalidateApp();
      return { id: p.id };
    }

    const p = await db.project.create({ data });
    await logActivity({ type: "PROJECT_CREATED", userId: user.id, entityType: "PROJECT", entityId: p.id, metadata: { name: p.name } });
    await notify(data.ownerId, user.id, { title: `New project: ${p.name}`, body: `from ${user.name}`, href: `/projects/${p.id}` });
    revalidateApp();
    return { id: p.id };
  });
}

export async function setProjectStatus(id: string, status: string) {
  return runAction(async () => {
    const user = await requireModule("projects");
    if (!(PROJECT_STATUSES as readonly string[]).includes(status)) throw new AppError("Invalid status.");
    const p = await loadEditable(user, id);
    if (p.status === status) return { id };
    await db.project.update({ where: { id }, data: { status } });
    await logActivity({
      type: "PROJECT_UPDATED",
      userId: user.id,
      entityType: "PROJECT",
      entityId: id,
      metadata: { name: p.name, fields: `status → ${PROJECT_STATUS_LABELS[status as ProjectStatus]}` },
    });
    revalidateApp();
    return { id };
  });
}

export async function deleteProject(id: string) {
  return runAction(async () => {
    const user = await requireModule("projects");
    const p = await loadEditable(user, id);
    if (user.role !== "ADMIN" && p.ownerId !== user.id) throw new AppError("Only the owner or an admin can delete a project.", "FORBIDDEN");
    await db.project.update({ where: { id }, data: { deletedAt: new Date() } });
    revalidateApp();
    return { id };
  });
}

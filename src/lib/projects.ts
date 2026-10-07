import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { projectVisibilityWhere } from "./permissions";
import type { CurrentUser } from "./auth";

/** Visible projects with derived progress (task counts are never stored). */
export async function getProjectsWithProgress(user: CurrentUser, where: Prisma.ProjectWhereInput = {}) {
  const projects = await db.project.findMany({
    where: { AND: [projectVisibilityWhere(user), where] },
    orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
    include: { owner: { select: { id: true, name: true } } },
  });
  const ids = projects.map((p) => p.id);
  const now = new Date();
  const [groups, overdue] = await Promise.all([
    ids.length ? db.task.groupBy({ by: ["projectId", "status"], where: { projectId: { in: ids } }, _count: true }) : [],
    ids.length
      ? db.task.groupBy({ by: ["projectId"], where: { projectId: { in: ids }, status: { not: "DONE" }, dueAt: { lt: now } }, _count: true })
      : [],
  ]);
  return projects.map((p) => {
    const rows = groups.filter((g) => g.projectId === p.id);
    const total = rows.reduce((s, r) => s + r._count, 0);
    const done = rows.find((r) => r.status === "DONE")?._count ?? 0;
    const inProgress = rows.find((r) => r.status === "IN_PROGRESS")?._count ?? 0;
    return {
      ...p,
      total,
      done,
      inProgress,
      open: total - done,
      overdue: overdue.find((o) => o.projectId === p.id)?._count ?? 0,
      late: p.status !== "DONE" && !!p.dueDate && p.dueDate < now,
    };
  });
}

export type ProjectWithProgress = Awaited<ReturnType<typeof getProjectsWithProgress>>[number];

import { cookies } from "next/headers";
import { startOfDay } from "date-fns";
import { db } from "@/lib/db";
import { requireUserPage } from "@/lib/auth";
import { MODULES, can, projectVisibilityWhere, type Module } from "@/lib/permissions";
import { AppDataProvider } from "@/components/app/app-context";
import { AppShell } from "@/components/app/shell";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUserPage();
  const jar = await cookies();

  const [users, sources, campaigns, notifications, overdue, projects] = await Promise.all([
    db.user.findMany({ where: { isActive: true }, select: { id: true, name: true, role: true }, orderBy: { name: "asc" } }),
    db.leadSource.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    db.campaign.findMany({
      where: { deletedAt: null, status: { not: "COMPLETED" } },
      select: { id: true, name: true },
      orderBy: { createdAt: "desc" },
    }),
    db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 15 }),
    can(user, "leads")
      ? db.followUp.count({ where: { ownerId: user.id, completedAt: null, dueAt: { lt: startOfDay(new Date()) }, lead: { deletedAt: null } } })
      : 0,
    can(user, "projects")
      ? db.project.findMany({
          where: projectVisibilityWhere(user),
          select: { id: true, name: true, status: true },
          orderBy: [{ status: "asc" }, { dueDate: { sort: "asc", nulls: "last" } }],
          take: 50,
        })
      : [],
  ]);

  const perms = Object.fromEntries(MODULES.map((m) => [m, can(user, m)])) as Record<Module, boolean>;

  return (
    <AppDataProvider value={{ user, users, sources, campaigns, projects, can: perms }}>
      <AppShell
        initialCollapsed={jar.get("sb_collapsed")?.value === "1"}
        overdueFollowUps={overdue}
        notifications={notifications.map((n) => ({
          id: n.id,
          title: n.title,
          body: n.body,
          href: n.href,
          createdAt: n.createdAt.toISOString(),
          read: !!n.readAt,
        }))}
      >
        {children}
      </AppShell>
    </AppDataProvider>
  );
}

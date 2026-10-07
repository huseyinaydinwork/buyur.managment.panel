import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarRange } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser, requireModulePage } from "@/lib/auth";
import { canEditProject, canSeeProject } from "@/lib/permissions";
import { describeActivity } from "@/lib/activity-format";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Avatar, Card, CardHeader, EmptyState } from "@/components/ui/misc";
import { ActivityFeed, PriorityBadge, ProgressBar, ProjectStatusBadge, TeamBadge } from "@/components/app/display";
import { ProjectActions, ProjectTaskBoard } from "@/components/app/project-components";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, p] = await Promise.all([getCurrentUser(), db.project.findUnique({ where: { id }, select: { name: true, team: true, ownerId: true, deletedAt: true } })]);
  // Never reveal names of projects the viewer can't see.
  const visible = user && p && !p.deletedAt && canSeeProject(user, p);
  return { title: visible ? p.name : "Project" };
}

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireModulePage("projects");
  const { id } = await params;
  const p = await db.project.findFirst({
    where: { id, deletedAt: null },
    include: {
      owner: { select: { id: true, name: true } },
      tasks: {
        orderBy: [{ priority: "desc" }, { dueAt: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
        include: {
          owner: { select: { name: true } },
          lead: { select: { id: true, business: { select: { name: true } } } },
          business: { select: { id: true, name: true } },
        },
      },
    },
  });
  // Projects of other teams look like they don't exist.
  if (!p || !canSeeProject(user, p)) notFound();

  const taskIds = p.tasks.map((t) => t.id);
  const activities = await db.activity.findMany({
    where: { OR: [{ entityType: "PROJECT", entityId: p.id }, { entityType: "TASK", entityId: { in: taskIds } }] },
    orderBy: { createdAt: "desc" },
    take: 25,
    include: { user: { select: { name: true } } },
  });

  const canEdit = canEditProject(user, p);
  const done = p.tasks.filter((t) => t.status === "DONE").length;
  const late = p.status !== "DONE" && p.dueDate && p.dueDate < new Date();
  const people = [...new Map(p.tasks.filter((t) => t.owner).map((t) => [t.owner!.name, t.owner!.name])).values()];

  return (
    <>
      <Link href="/projects" className="mb-3 inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> Projects
      </Link>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">{p.name}</h1>
            <ProjectStatusBadge status={p.status} />
            <TeamBadge team={p.team} />
            <PriorityBadge priority={p.priority} />
          </div>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
            {p.owner && (
              <span className="inline-flex items-center gap-1.5">
                <Avatar name={p.owner.name} className="size-5 text-[9px]" /> {p.owner.name}
              </span>
            )}
            <span className={cn("inline-flex items-center gap-1", late && "font-semibold text-destructive")}>
              <CalendarRange className="size-3.5" />
              {p.startDate ? fmtDate(p.startDate, "d MMM") : "—"} → {p.dueDate ? fmtDate(p.dueDate, "d MMM yyyy") : "no due date"}
              {late && " · past due"}
            </span>
          </p>
        </div>
        <ProjectActions
          canEdit={canEdit}
          canDelete={user.role === "ADMIN" || p.ownerId === user.id}
          project={{
            id: p.id,
            name: p.name,
            description: p.description,
            team: p.team,
            status: p.status,
            priority: p.priority,
            ownerId: p.ownerId,
            startDate: p.startDate?.toISOString() ?? null,
            dueDate: p.dueDate?.toISOString() ?? null,
          }}
        />
      </div>

      <Card className="mb-4 px-4 py-3">
        <ProgressBar done={done} total={p.tasks.length} />
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          {!canEdit && (
            <p className="mb-3 rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-[13px] text-warning">
              You can view this project. Only its team, owner or an admin can change tasks.
            </p>
          )}
          <ProjectTaskBoard
            projectId={p.id}
            canEdit={canEdit}
            tasks={p.tasks.map((t) => ({
              id: t.id,
              title: t.title,
              description: t.description,
              status: t.status,
              priority: t.priority,
              dueAt: t.dueAt?.toISOString() ?? null,
              ownerId: t.ownerId,
              ownerName: t.owner?.name ?? null,
              lead: t.lead ? { id: t.lead.id, label: t.lead.business.name } : null,
              business: t.business ? { id: t.business.id, label: t.business.name } : null,
              projectId: p.id,
            }))}
          />
        </div>
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="About" />
            <div className="px-4 py-3 text-[13px]">
              {p.description ? <p className="whitespace-pre-line">{p.description}</p> : <p className="text-muted-foreground">No description.</p>}
              <dl className="mt-3 grid grid-cols-[90px_1fr] gap-y-1.5 border-t pt-3">
                <dt className="text-muted-foreground">People</dt>
                <dd className="flex flex-wrap gap-1">
                  {people.length ? people.map((n) => <Avatar key={n} name={n} className="size-5 text-[9px]" />) : "—"}
                </dd>
                <dt className="text-muted-foreground">Tasks</dt>
                <dd className="tabular">
                  {p.tasks.length} · {done} done
                </dd>
                <dt className="text-muted-foreground">Created</dt>
                <dd>{fmtDateTime(p.createdAt)}</dd>
              </dl>
            </div>
          </Card>
          <Card>
            <CardHeader title="Activity" />
            {activities.length ? <ActivityFeed items={activities.map(describeActivity)} compact /> : <EmptyState title="No activity yet" className="py-6" />}
          </Card>
        </div>
      </div>
    </>
  );
}

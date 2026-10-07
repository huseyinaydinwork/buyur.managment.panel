import Link from "next/link";
import { startOfWeek } from "date-fns";
import { FolderKanban } from "lucide-react";
import { db } from "@/lib/db";
import { requireModulePage } from "@/lib/auth";
import { getProjectsWithProgress, type ProjectWithProgress } from "@/lib/projects";
import { describeActivity } from "@/lib/activity-format";
import { PROJECT_STATUS_LABELS, PROJECT_TEAMS, PROJECT_TEAM_LABELS, type ProjectStatus } from "@/lib/constants";
import { assignableProjectTeams } from "@/lib/permissions";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Avatar, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui/misc";
import { ActivityFeed, KpiCard, PriorityBadge, ProgressBar, TeamBadge } from "@/components/app/display";
import { NewProjectButton } from "@/components/app/project-components";
import { SegmentLinks } from "@/components/app/url-controls";

export const metadata = { title: "Projects" };

const GROUPS: ProjectStatus[] = ["ACTIVE", "PLANNING", "ON_HOLD", "DONE"];

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireModulePage("projects");
  const sp = await searchParams;
  const team = (PROJECT_TEAMS as readonly string[]).includes(sp.team ?? "") ? sp.team : undefined;
  const mine = sp.scope === "mine";

  const projects = await getProjectsWithProgress(user, {
    ...(team ? { team } : {}),
    ...(mine ? { ownerId: user.id } : {}),
  });
  const ids = projects.map((p) => p.id);
  const [doneThisWeek, myOpen, activities] = await Promise.all([
    db.task.count({ where: { projectId: { in: ids }, status: "DONE", completedAt: { gte: startOfWeek(new Date(), { weekStartsOn: 1 }) } } }),
    db.task.count({ where: { projectId: { in: ids }, ownerId: user.id, status: { not: "DONE" } } }),
    db.activity.findMany({
      where: {
        OR: [
          { entityType: "PROJECT", entityId: { in: ids } },
          { entityType: "TASK", metadata: { contains: '"projectId":"' } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { user: { select: { name: true } } },
    }),
  ]);
  // Only keep task events from projects this user can see.
  const visibleActivities = activities
    .filter((a) => a.entityType === "PROJECT" || ids.some((id) => a.metadata.includes(`"projectId":"${id}"`)))
    .slice(0, 12);

  const active = projects.filter((p) => p.status === "ACTIVE");
  const allowed = assignableProjectTeams(user);
  const teamOptions = PROJECT_TEAMS.filter((t) => allowed.includes(t));

  return (
    <>
      <PageHeader title="Projects" description="Team projects for marketing and sales. Progress comes from task completion." actions={<NewProjectButton />}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard label="Active projects" value={String(active.length)} hint={`${projects.length} total`} />
          <KpiCard label="Open tasks" value={String(projects.reduce((s, p) => s + p.open, 0))} hint={`${myOpen} assigned to me`} href="/projects/my-work" />
          <KpiCard label="Overdue tasks" value={String(projects.reduce((s, p) => s + p.overdue, 0))} hint={`${projects.filter((p) => p.late).length} projects past due`} />
          <KpiCard label="Done this week" value={String(doneThisWeek)} hint="tasks completed" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SegmentLinks param="scope" fallback="all" options={[{ value: "all", label: "All projects" }, { value: "mine", label: "I own" }]} />
          <SegmentLinks
            param="team"
            fallback="any"
            options={[{ value: "any", label: "Any team" }, ...teamOptions.map((t) => ({ value: t, label: PROJECT_TEAM_LABELS[t] }))]}
          />
        </div>
      </PageHeader>

      {projects.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FolderKanban />}
            title="No projects yet"
            description="Create a project for a campaign launch, a sales push or any team initiative — then break it into tasks."
            action={<NewProjectButton />}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_340px]">
          <div className="flex flex-col gap-5">
            {GROUPS.map((g) => {
              const items = projects.filter((p) => p.status === g);
              if (!items.length) return null;
              return (
                <section key={g}>
                  <h2 className="mb-2 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {PROJECT_STATUS_LABELS[g]} <span className="tabular">{items.length}</span>
                  </h2>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
                    {items.map((p) => (
                      <ProjectCard key={p.id} p={p} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
          <Card className="self-start">
            <CardHeader title="Recent project activity" />
            {visibleActivities.length ? (
              <ActivityFeed items={visibleActivities.map(describeActivity)} compact />
            ) : (
              <EmptyState title="Nothing yet" className="py-6" />
            )}
          </Card>
        </div>
      )}
    </>
  );
}

function ProjectCard({ p }: { p: ProjectWithProgress }) {
  return (
    <Link href={`/projects/${p.id}`} className="group flex flex-col gap-3 rounded-lg border bg-card p-4 transition-colors hover:border-primary/40">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[14.5px] font-semibold group-hover:text-primary">{p.name}</p>
          {p.description && <p className="mt-0.5 line-clamp-2 text-[12.5px] text-muted-foreground">{p.description}</p>}
        </div>
        <PriorityBadge priority={p.priority} />
      </div>
      <ProgressBar done={p.done} total={p.total} />
      <div className="flex items-center justify-between gap-2 text-[12px] text-muted-foreground">
        <span className="flex items-center gap-2">
          <TeamBadge team={p.team} />
          {p.owner && (
            <span className="inline-flex items-center gap-1">
              <Avatar name={p.owner.name} className="size-4 text-[8px]" /> {p.owner.name.split(" ")[0]}
            </span>
          )}
        </span>
        <span className={cn("tabular", p.late && "font-semibold text-destructive")}>
          {p.overdue > 0 && <span className="mr-2 text-destructive">{p.overdue} overdue</span>}
          {p.dueDate ? `Due ${fmtDate(p.dueDate, "d MMM")}` : "No due date"}
        </span>
      </div>
    </Link>
  );
}

import Link from "next/link";
import { ListChecks } from "lucide-react";
import { db } from "@/lib/db";
import { requireModulePage } from "@/lib/auth";
import { projectVisibilityWhere } from "@/lib/permissions";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui/misc";
import { TaskList } from "@/components/app/task-list";
import { SegmentLinks } from "@/components/app/url-controls";

export const metadata = { title: "My work" };

export default async function MyWorkPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireModulePage("projects");
  const sp = await searchParams;
  const showDone = sp.show === "done";

  const tasks = await db.task.findMany({
    where: {
      ownerId: user.id,
      project: projectVisibilityWhere(user),
      status: showDone ? "DONE" : { not: "DONE" },
    },
    orderBy: [{ dueAt: { sort: "asc", nulls: "last" } }, { priority: "desc" }],
    take: 300,
    include: {
      owner: { select: { name: true } },
      project: { select: { id: true, name: true } },
      lead: { select: { id: true, business: { select: { name: true } } } },
      business: { select: { id: true, name: true } },
    },
  });

  const byProject = new Map<string, { name: string; items: typeof tasks }>();
  for (const t of tasks) {
    const key = t.project!.id;
    if (!byProject.has(key)) byProject.set(key, { name: t.project!.name, items: [] });
    byProject.get(key)!.items.push(t);
  }
  const now = Date.now();
  const overdue = tasks.filter((t) => t.status !== "DONE" && t.dueAt && t.dueAt.getTime() < now).length;

  return (
    <>
      <PageHeader
        title="My work"
        description={showDone ? "Tasks you finished across projects." : `Your open project tasks${overdue ? ` · ${overdue} overdue` : ""}.`}
      >
        <SegmentLinks param="show" fallback="open" options={[{ value: "open", label: "Open" }, { value: "done", label: "Done" }]} />
      </PageHeader>
      {tasks.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ListChecks />}
            title={showDone ? "Nothing completed yet" : "No open project tasks"}
            description="Tasks assigned to you inside projects show up here."
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {[...byProject.entries()].map(([pid, g]) => (
            <Card key={pid}>
              <CardHeader
                title={
                  <Link href={`/projects/${pid}`} className="hover:text-primary">
                    {g.name}
                  </Link>
                }
                description={`${g.items.length} task${g.items.length === 1 ? "" : "s"}`}
              />
              <TaskList
                compact
                tasks={g.items.map((t) => ({
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
                  projectId: pid,
                }))}
              />
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

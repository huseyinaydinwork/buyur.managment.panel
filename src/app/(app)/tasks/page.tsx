import { addDays, startOfDay } from "date-fns";
import type { Prisma } from "@prisma/client";
import { CheckSquare } from "lucide-react";
import { db } from "@/lib/db";
import { requireModulePage } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { TASK_STATUSES, TASK_STATUS_LABELS } from "@/lib/constants";
import { telHref } from "@/lib/utils";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui/misc";
import { NewTaskButton } from "@/components/app/buttons";
import { FollowUpRow } from "@/components/app/lead-detail";
import { TaskList } from "@/components/app/task-list";
import { ParamSelect, SegmentLinks } from "@/components/app/url-controls";

export const metadata = { title: "Tasks" };

export default async function TasksPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireModulePage("tasks");
  const sp = await searchParams;
  const view = ["my", "today", "overdue", "all"].includes(sp.view ?? "") ? sp.view! : "my";
  const today = startOfDay(new Date());
  const tomorrow = addDays(today, 1);
  const now = new Date();
  const showDone = sp.status === "DONE";

  const where: Prisma.TaskWhereInput = {};
  if (view !== "all") where.ownerId = user.id;
  if (view === "today") where.dueAt = { gte: today, lt: tomorrow };
  if (view === "overdue") where.dueAt = { lt: now };
  if (sp.status) where.status = sp.status;
  else if (view !== "all") where.status = { not: "DONE" };
  if (view === "overdue") where.status = { not: "DONE" };
  where.AND = [{ OR: [{ projectId: null }, { project: { deletedAt: null } }] }];
  if (user.role === "MARKETING") where.OR = [{ ownerId: user.id }, { createdById: user.id }, { leadId: null }];

  const followUpsVisible = can(user, "leads") && view !== "all" && !showDone;
  const fuWhere: Prisma.FollowUpWhereInput = { ownerId: user.id, completedAt: null, lead: { deletedAt: null } };
  if (view === "today") fuWhere.dueAt = { gte: today, lt: tomorrow };
  if (view === "overdue") fuWhere.dueAt = { lt: now };

  const [tasks, followUps, counts] = await Promise.all([
    db.task.findMany({
      where,
      orderBy: [{ status: "asc" }, { dueAt: { sort: "asc", nulls: "last" } }, { priority: "desc" }],
      take: 200,
      include: {
        owner: { select: { name: true } },
        lead: { select: { id: true, business: { select: { name: true } } } },
        business: { select: { id: true, name: true } },
      },
    }),
    followUpsVisible
      ? db.followUp.findMany({
          where: fuWhere,
          orderBy: { dueAt: "asc" },
          take: 50,
          include: { lead: { select: { id: true, business: { select: { name: true } }, contact: { select: { phone: true } } } } },
        })
      : [],
    Promise.all([
      db.task.count({ where: { ownerId: user.id, status: { not: "DONE" } } }),
      db.task.count({ where: { ownerId: user.id, status: { not: "DONE" }, dueAt: { gte: today, lt: tomorrow } } }),
      db.task.count({ where: { ownerId: user.id, status: { not: "DONE" }, dueAt: { lt: now } } }),
    ]),
  ]);

  return (
    <>
      <PageHeader title="Tasks" description="Simple to-dos for the team. Sales follow-ups show up here too." actions={<NewTaskButton />}>
        <div className="flex flex-wrap items-center gap-2">
          <SegmentLinks
            param="view"
            fallback="my"
            options={[
              { value: "my", label: "My tasks", count: counts[0] },
              { value: "today", label: "Today", count: counts[1] },
              { value: "overdue", label: "Overdue", count: counts[2] },
              { value: "all", label: "All" },
            ]}
          />
          <ParamSelect param="status" placeholder={view === "all" ? "Any status" : "Open"} options={TASK_STATUSES.map((s) => ({ value: s, label: TASK_STATUS_LABELS[s] }))} />
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_380px]">
        <Card>
          <CardHeader title={view === "all" ? "All tasks" : view === "today" ? "Due today" : view === "overdue" ? "Overdue" : "My tasks"} description={`${tasks.length} task${tasks.length === 1 ? "" : "s"}`} />
          {tasks.length === 0 ? (
            <EmptyState icon={<CheckSquare />} title="Nothing here" description="Enjoy the calm — or create a task." action={<NewTaskButton variant="outline" />} />
          ) : (
            <TaskList
              tasks={tasks.map((t) => ({
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
              }))}
            />
          )}
        </Card>
        {followUpsVisible && (
          <Card className="self-start">
            <CardHeader title="My follow-ups" description="From leads you own" />
            {followUps.length === 0 ? (
              <p className="px-4 py-4 text-[13px] text-muted-foreground">No follow-ups in this view.</p>
            ) : (
              followUps.map((f) => (
                <FollowUpRow
                  key={f.id}
                  f={{
                    id: f.id,
                    dueAt: f.dueAt.toISOString(),
                    note: f.note,
                    leadId: f.lead.id,
                    leadName: f.lead.business.name,
                    phoneHref: telHref(f.lead.contact?.phone),
                  }}
                />
              ))
            )}
          </Card>
        )}
      </div>
    </>
  );
}

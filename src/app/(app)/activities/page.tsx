import type { Prisma } from "@prisma/client";
import { Activity } from "lucide-react";
import { db } from "@/lib/db";
import { requireModulePage } from "@/lib/auth";
import { describeActivity } from "@/lib/activity-format";
import { ACTIVITY_TYPES, ACTIVITY_TYPE_LABELS } from "@/lib/constants";
import { parseDateRange, between } from "@/lib/date-range";
import { Card, EmptyState, PageHeader } from "@/components/ui/misc";
import { ActivityFeed } from "@/components/app/display";
import { DateRangeControl, Pagination, ParamSelect, SegmentLinks } from "@/components/app/url-controls";

export const metadata = { title: "Activities" };
const PER_PAGE = 40;

const GROUPS: Record<string, string[]> = {
  touches: ["NOTE", "CALL", "WHATSAPP", "EMAIL", "MEETING", "DEMO"],
  pipeline: ["STATUS_CHANGE", "DEAL_WON", "DEAL_LOST", "LEAD_CREATED", "LEAD_ASSIGNED"],
  followups: ["FOLLOW_UP"],
};

export default async function ActivitiesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireModulePage("activities");
  const sp = await searchParams;
  const range = parseDateRange(sp, "7d");
  const page = Math.max(1, Number(sp.page) || 1);

  const where: Prisma.ActivityWhereInput = { createdAt: between(range.from, range.to) };
  if (sp.group && GROUPS[sp.group]) where.type = { in: GROUPS[sp.group] };
  if (sp.type) where.type = sp.type;
  if (sp.scope === "mine") where.userId = user.id;
  else if (sp.user) where.userId = sp.user;
  // Sales reps see sales-side activity; marketing events are for marketing/admin.
  if (user.role === "SALES") where.entityType = { in: ["LEAD", "BUSINESS", "TASK"] };

  const [total, rows, users] = await Promise.all([
    db.activity.count({ where }),
    db.activity.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      include: { user: { select: { name: true } } },
    }),
    db.user.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <>
      <PageHeader title="Activities" description="Everything the team did — calls, notes, stage moves, follow-ups." actions={<DateRangeControl />} />
      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <SegmentLinks param="scope" fallback="all" options={[{ value: "all", label: "Team" }, { value: "mine", label: "Mine" }]} />
          <SegmentLinks
            param="group"
            fallback="all"
            options={[
              { value: "all", label: "All" },
              { value: "touches", label: "Calls & notes" },
              { value: "pipeline", label: "Pipeline" },
              { value: "followups", label: "Follow-ups" },
            ]}
          />
          <ParamSelect param="type" placeholder="Any type" options={ACTIVITY_TYPES.map((t) => ({ value: t, label: ACTIVITY_TYPE_LABELS[t] }))} />
          {sp.scope !== "mine" && <ParamSelect param="user" placeholder="Anyone" options={users.map((u) => ({ value: u.id, label: u.name }))} />}
        </div>
        {rows.length === 0 ? (
          <EmptyState icon={<Activity />} title="No activity in this period" description="Try a wider date range." />
        ) : (
          <ActivityFeed items={rows.map(describeActivity)} />
        )}
        {total > 0 && <Pagination page={page} pageCount={Math.ceil(total / PER_PAGE)} total={total} />}
      </Card>
    </>
  );
}

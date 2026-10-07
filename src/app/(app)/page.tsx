import Link from "next/link";
import { redirect } from "next/navigation";
import { startOfDay, subDays } from "date-fns";
import { db } from "@/lib/db";
import { requireUserPage } from "@/lib/auth";
import { can, homePathFor } from "@/lib/permissions";
import { parseDateRange } from "@/lib/date-range";
import { funnelSteps, getFunnel, getKpis, getSourceDistribution } from "@/lib/metrics";
import { describeActivity } from "@/lib/activity-format";
import { refreshStaleScores } from "@/lib/lead-sync";
import { OPEN_STATUSES, STALE_LEAD_DAYS } from "@/lib/constants";
import { fmtMoney, fmtNumber, fmtPct } from "@/lib/format";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui/misc";
import { ActivityFeed, FunnelBars, KpiCard, ShareBars } from "@/components/app/display";
import { DateRangeControl } from "@/components/app/url-controls";

export const metadata = { title: "Command Center" };

export default async function CommandCenterPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUserPage();
  if (!can(user, "command")) redirect(homePathFor(user));
  const sp = await searchParams;
  await refreshStaleScores();
  const range = parseDateRange(sp, "30d");
  const q = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]).toString();

  const [kpis, funnel, sources, activities, attention] = await Promise.all([
    getKpis(range),
    getFunnel(range),
    getSourceDistribution(range),
    db.activity.findMany({ orderBy: { createdAt: "desc" }, take: 14, include: { user: { select: { name: true } } } }),
    Promise.all([
      db.followUp.count({ where: { completedAt: null, dueAt: { lt: startOfDay(new Date()) }, lead: { deletedAt: null } } }),
      db.lead.count({
        where: {
          deletedAt: null,
          status: { in: OPEN_STATUSES },
          OR: [
            { lastActivityAt: { lt: subDays(new Date(), STALE_LEAD_DAYS) } },
            { lastActivityAt: null, createdAt: { lt: subDays(new Date(), STALE_LEAD_DAYS) } },
          ],
        },
      }),
      db.lead.count({ where: { deletedAt: null, ownerId: null, status: { in: OPEN_STATUSES } } }),
    ]),
  ]);
  const [overdue, stale, unassigned] = attention;
  const steps = funnelSteps(funnel.total, ["leads", "qualified", "demo", "won"]);
  const leadToWon = funnel.total.leads ? (funnel.total.won / funnel.total.leads) * 100 : null;

  return (
    <>
      <PageHeader title="Command Center" description={`Growth & sales at a glance · ${range.label} vs previous period`} actions={<DateRangeControl />} />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="New leads" value={fmtNumber(kpis.newLeads.value)} change={kpis.newLeads.change} hint={`prev ${kpis.newLeads.previous}`} href="/leads?created=30d" />
        <KpiCard label="Qualified leads" value={fmtNumber(kpis.qualified.value)} change={kpis.qualified.change} hint={`prev ${kpis.qualified.previous}`} />
        <KpiCard label="Demos" value={fmtNumber(kpis.demos.value)} change={kpis.demos.change} hint={`prev ${kpis.demos.previous}`} />
        <KpiCard label="Won deals" value={fmtNumber(kpis.won.value)} change={kpis.won.change} hint={`prev ${kpis.won.previous}`} />
        <KpiCard label="Pipeline value" value={fmtMoney(kpis.pipelineValue.value)} hint={`+${fmtMoney(kpis.pipelineValue.added)} added`} href="/pipeline" />
        <KpiCard label="Revenue" value={fmtMoney(kpis.revenue.value)} change={kpis.revenue.change} hint={`prev ${fmtMoney(kpis.revenue.previous)}`} />
      </div>

      {(overdue > 0 || stale > 0 || unassigned > 0) && (
        <div className="mb-4 flex flex-wrap gap-2 text-[13px]">
          {overdue > 0 && (
            <span className="rounded-md border border-primary/25 bg-primary-soft px-3 py-1.5 text-primary">
              <b>{overdue}</b> overdue follow-ups across the team
            </span>
          )}
          {stale > 0 && (
            <Link href="/leads?status=open&sort=activity" className="rounded-md border bg-card px-3 py-1.5 hover:border-foreground/20">
              <b>{stale}</b> open leads without activity for {STALE_LEAD_DAYS}+ days
            </Link>
          )}
          {unassigned > 0 && (
            <Link href="/leads?owner=unassigned&status=open" className="rounded-md border bg-card px-3 py-1.5 hover:border-foreground/20">
              <b>{unassigned}</b> unassigned open leads
            </Link>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader
            title="Funnel"
            description={`Leads created ${range.label.toLowerCase()} and how far they got`}
            action={
              <Link href={`/funnel${q ? `?${q}` : ""}`} className="text-[12px] font-medium text-primary hover:underline">
                Details
              </Link>
            }
          />
          <div className="px-4 py-4">
            {funnel.total.leads === 0 ? (
              <EmptyState title="No leads in this period" className="py-6" />
            ) : (
              <>
                <FunnelBars steps={steps} />
                <p className="mt-4 text-[12.5px] text-muted-foreground">
                  Lead → Won conversion: <b className="text-foreground">{fmtPct(leadToWon)}</b> · Revenue from cohort:{" "}
                  <b className="text-foreground">{fmtMoney(funnel.total.revenue)}</b>
                </p>
              </>
            )}
          </div>
        </Card>
        <Card>
          <CardHeader title="Lead sources" description={`${sources.total} leads · ${range.label.toLowerCase()}`} />
          <div className="px-4 py-4">{sources.rows.length ? <ShareBars rows={sources.rows} /> : <EmptyState title="No leads in this period" className="py-6" />}</div>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader
          title="Recent activities"
          action={
            <Link href="/activities" className="text-[12px] font-medium text-primary hover:underline">
              All activity
            </Link>
          }
        />
        {activities.length ? <ActivityFeed items={activities.map(describeActivity)} compact /> : <EmptyState title="No activity yet" />}
      </Card>
    </>
  );
}

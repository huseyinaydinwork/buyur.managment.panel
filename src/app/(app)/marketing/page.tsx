import Link from "next/link";
import { addDays, startOfDay } from "date-fns";
import { db } from "@/lib/db";
import { requireModulePage } from "@/lib/auth";
import { parseDateRange, between } from "@/lib/date-range";
import { funnelSteps, getCampaignMetrics, getFunnel, getKpis, getSourceDistribution } from "@/lib/metrics";
import { describeActivity } from "@/lib/activity-format";
import { CONTENT_STATUSES, CONTENT_STATUS_LABELS } from "@/lib/constants";
import { fmtMoney, fmtNumber, fmtSmartDate } from "@/lib/format";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead } from "@/components/ui/table";
import { ActivityFeed, CampaignStatusBadge, FunnelBars, KpiCard, ShareBars } from "@/components/app/display";
import { ClickableRow, NewCampaignButton } from "@/components/app/buttons";
import { DateRangeControl } from "@/components/app/url-controls";

export const metadata = { title: "Marketing" };

export default async function MarketingHomePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireModulePage("marketingHome");
  const sp = await searchParams;
  const range = parseDateRange(sp, "30d");

  const [kpis, funnel, sources, campaigns, contentGroups, upcoming, activities, leadsFromCampaigns] = await Promise.all([
    getKpis(range),
    getFunnel(range),
    getSourceDistribution(range),
    db.campaign.findMany({ where: { deletedAt: null, status: { in: ["ACTIVE", "PAUSED"] } }, orderBy: { createdAt: "desc" } }),
    db.content.groupBy({ by: ["status"], _count: true }),
    db.content.findMany({
      where: { status: { in: ["SCHEDULED", "APPROVAL"] }, publishAt: { gte: startOfDay(new Date()), lt: addDays(new Date(), 14) } },
      orderBy: { publishAt: "asc" },
      take: 6,
    }),
    db.activity.findMany({
      where: { entityType: { in: ["CAMPAIGN", "CONTENT"] } },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { user: { select: { name: true } } },
    }),
    db.lead.count({ where: { deletedAt: null, campaignId: { not: null }, createdAt: between(range.from, range.to) } }),
  ]);
  const metrics = await getCampaignMetrics(campaigns);
  const spend = campaigns.reduce((s, c) => s + c.spend, 0);

  return (
    <>
      <PageHeader title={`Hi ${user.name.split(" ")[0]} — marketing overview`} description={`${range.label} vs previous period`} actions={<><DateRangeControl /><NewCampaignButton /></>} />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="New leads" value={fmtNumber(kpis.newLeads.value)} change={kpis.newLeads.change} />
        <KpiCard label="From campaigns" value={fmtNumber(leadsFromCampaigns)} hint="attributed" />
        <KpiCard label="Qualified" value={fmtNumber(kpis.qualified.value)} change={kpis.qualified.change} />
        <KpiCard label="Demos" value={fmtNumber(kpis.demos.value)} change={kpis.demos.change} />
        <KpiCard label="Won" value={fmtNumber(kpis.won.value)} change={kpis.won.change} />
        <KpiCard label="Active campaign spend" value={fmtMoney(spend)} />
      </div>

      <Card className="mb-4">
        <CardHeader title="Active campaigns" action={<Link href="/campaigns" className="text-[12px] font-medium text-primary hover:underline">All campaigns</Link>} />
        {campaigns.length === 0 ? (
          <EmptyState title="No active campaigns" action={<NewCampaignButton variant="outline" />} />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Campaign</TH>
                <TH>Status</TH>
                <TH className="text-right">Spend</TH>
                <TH className="text-right">Leads</TH>
                <TH className="text-right">CPL</TH>
                <TH className="text-right">Demos</TH>
                <TH className="text-right">Won</TH>
                <TH className="text-right">ROAS</TH>
              </tr>
            </THead>
            <TBody>
              {campaigns.map((c) => {
                const m = metrics.get(c.id)!;
                return (
                  <ClickableRow key={c.id} href={`/campaigns/${c.id}`}>
                    <TD className="font-medium">{c.name}</TD>
                    <TD><CampaignStatusBadge status={c.status} /></TD>
                    <TD className="text-right tabular">{fmtMoney(c.spend)}</TD>
                    <TD className="text-right tabular">{m.leads}</TD>
                    <TD className="text-right tabular">{m.cpl == null ? "—" : fmtMoney(Math.round(m.cpl))}</TD>
                    <TD className="text-right tabular">{m.demo}</TD>
                    <TD className="text-right tabular">{m.won}</TD>
                    <TD className="text-right tabular">{m.roas == null ? "—" : `${m.roas.toFixed(2)}x`}</TD>
                  </ClickableRow>
                );
              })}
            </TBody>
          </Table>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader title="Funnel" action={<Link href="/funnel" className="text-[12px] font-medium text-primary hover:underline">Details</Link>} />
          <div className="p-4">{funnel.total.leads ? <FunnelBars steps={funnelSteps(funnel.total, ["leads", "qualified", "demo", "won"])} /> : <EmptyState title="No leads in period" />}</div>
        </Card>
        <Card>
          <CardHeader title="Lead sources" />
          <div className="p-4">{sources.rows.length ? <ShareBars rows={sources.rows} /> : <EmptyState title="No leads in period" />}</div>
        </Card>
        <Card>
          <CardHeader title="Content pipeline" action={<Link href="/content" className="text-[12px] font-medium text-primary hover:underline">Board</Link>} />
          <div className="grid grid-cols-3 gap-px border-b bg-border">
            {CONTENT_STATUSES.map((s) => (
              <div key={s} className="bg-card px-3 py-2">
                <p className="text-[11px] text-muted-foreground">{CONTENT_STATUS_LABELS[s]}</p>
                <p className="text-base font-semibold tabular">{contentGroups.find((g) => g.status === s)?._count ?? 0}</p>
              </div>
            ))}
          </div>
          <p className="px-4 pt-3 text-[11px] font-semibold uppercase text-muted-foreground">Next 14 days</p>
          {upcoming.length === 0 ? (
            <p className="px-4 py-3 text-[13px] text-muted-foreground">Nothing scheduled.</p>
          ) : (
            <ul className="px-4 py-2 text-[13px]">
              {upcoming.map((c) => (
                <li key={c.id} className="flex justify-between gap-2 py-1">
                  <span className="truncate">{c.title}</span>
                  <span className="shrink-0 text-muted-foreground">{fmtSmartDate(c.publishAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title="Recent marketing activity" />
        {activities.length ? <ActivityFeed items={activities.map(describeActivity)} compact /> : <EmptyState title="No activity yet" />}
      </Card>
    </>
  );
}

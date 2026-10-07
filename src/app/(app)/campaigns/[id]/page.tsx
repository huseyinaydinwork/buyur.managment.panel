import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { requireModulePage } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { funnelSteps, getCampaignMetrics } from "@/lib/metrics";
import { describeActivity } from "@/lib/activity-format";
import { CAMPAIGN_CHANNEL_LABELS, CONTENT_FORMAT_LABELS, CONTENT_PLATFORM_LABELS, label } from "@/lib/constants";
import { fmtDate, fmtMoney, fmtNumber, fmtPct } from "@/lib/format";
import { Card, CardHeader, EmptyState } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { ActivityFeed, CampaignStatusBadge, ContentStatusBadge, FunnelBars, KpiCard, LeadStatusBadge } from "@/components/app/display";
import { ClickableRow } from "@/components/app/buttons";
import { CampaignActions } from "@/components/app/campaign-actions";

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireModulePage("campaigns");
  const { id } = await params;
  const c = await db.campaign.findFirst({
    where: { id, deletedAt: null },
    include: { owner: { select: { name: true } }, contents: { orderBy: { createdAt: "desc" } } },
  });
  if (!c) notFound();
  const showLeads = can(user, "leads");
  const [metricsMap, leads, activities] = await Promise.all([
    getCampaignMetrics([c]),
    showLeads
      ? db.lead.findMany({
          where: { campaignId: c.id, deletedAt: null },
          orderBy: { createdAt: "desc" },
          include: { business: { select: { name: true } }, owner: { select: { name: true } } },
        })
      : [],
    db.activity.findMany({ where: { campaignId: c.id }, orderBy: { createdAt: "desc" }, take: 15, include: { user: { select: { name: true } } } }),
  ]);
  const m = metricsMap.get(c.id)!;
  const budgetUsed = c.budget ? (c.spend / c.budget) * 100 : null;

  return (
    <>
      <Link href="/campaigns" className="mb-3 inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> Campaigns
      </Link>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">{c.name}</h1>
            <CampaignStatusBadge status={c.status} />
          </div>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {label(CAMPAIGN_CHANNEL_LABELS, c.channel)} · {fmtDate(c.startDate)} – {c.endDate ? fmtDate(c.endDate) : "ongoing"} · Owner {c.owner?.name ?? "—"}
          </p>
          {c.description && <p className="mt-2 max-w-2xl text-[13px]">{c.description}</p>}
        </div>
        <CampaignActions
          campaign={{
            id: c.id,
            name: c.name,
            description: c.description,
            channel: c.channel,
            startDate: c.startDate?.toISOString() ?? null,
            endDate: c.endDate?.toISOString() ?? null,
            budget: c.budget,
            spend: c.spend,
            ownerId: c.ownerId,
            status: c.status,
          }}
        />
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        <KpiCard label="Spend" value={fmtMoney(c.spend)} hint={budgetUsed != null ? `${budgetUsed.toFixed(0)}% of ${fmtMoney(c.budget)}` : undefined} />
        <KpiCard label="CPL" value={m.cpl == null ? "—" : fmtMoney(Math.round(m.cpl))} hint={`${m.leads} leads`} />
        <KpiCard label="Cost per demo" value={m.costPerDemo == null ? "—" : fmtMoney(Math.round(m.costPerDemo))} hint={`${m.demo} demos`} />
        <KpiCard label="CAC" value={m.cac == null ? "—" : fmtMoney(Math.round(m.cac))} hint={`${m.won} won`} />
        <KpiCard label="Conversion" value={fmtPct(m.conversionRate)} hint="lead → won" />
        <KpiCard label="ROAS" value={m.roas == null ? "—" : `${m.roas.toFixed(2)}x`} hint={`${fmtMoney(m.revenue)} revenue`} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader title="Campaign funnel" description="All leads attributed to this campaign" />
          <div className="p-4">{m.leads ? <FunnelBars steps={funnelSteps(m)} /> : <EmptyState title="No leads attributed yet" description="Pick this campaign when creating or editing a lead." />}</div>
        </Card>
        <Card>
          <CardHeader title="Recent activity" />
          {activities.length ? <ActivityFeed items={activities.map(describeActivity)} compact /> : <EmptyState title="No activity yet" />}
        </Card>
      </div>

      {showLeads && (
        <Card className="mt-4">
          <CardHeader title="Attributed leads" description={`${leads.length} leads`} />
          {leads.length === 0 ? (
            <EmptyState title="No leads yet" />
          ) : (
            <Table>
              <THead>
                <tr>
                  <TH>Business</TH>
                  <TH>Status</TH>
                  <TH>Owner</TH>
                  <TH className="text-right">Value</TH>
                  <TH>Created</TH>
                </tr>
              </THead>
              <TBody>
                {leads.map((l) => (
                  <ClickableRow key={l.id} href={`/leads/${l.id}`}>
                    <TD className="font-medium">{l.business.name}</TD>
                    <TD>
                      <LeadStatusBadge status={l.status} />
                    </TD>
                    <TD>{l.owner?.name ?? "Unassigned"}</TD>
                    <TD className="text-right tabular">{fmtMoney(l.value)}</TD>
                    <TD className="text-muted-foreground">{fmtDate(l.createdAt, "d MMM yyyy")}</TD>
                  </ClickableRow>
                ))}
              </TBody>
            </Table>
          )}
        </Card>
      )}

      <Card className="mt-4">
        <CardHeader title="Content" description={`${c.contents.length} pieces linked`} action={<Link href="/content" className="text-[12px] font-medium text-primary hover:underline">Content board</Link>} />
        {c.contents.length === 0 ? (
          <EmptyState title="No content linked" />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Title</TH>
                <TH>Platform</TH>
                <TH>Status</TH>
                <TH className="text-right">Views</TH>
                <TH className="text-right">Likes</TH>
                <TH className="text-right">Leads</TH>
              </tr>
            </THead>
            <TBody>
              {c.contents.map((ct) => (
                <TR key={ct.id}>
                  <TD className="font-medium">{ct.title}</TD>
                  <TD className="text-muted-foreground">
                    {label(CONTENT_PLATFORM_LABELS, ct.platform)} · {label(CONTENT_FORMAT_LABELS, ct.format)}
                  </TD>
                  <TD>
                    <ContentStatusBadge status={ct.status} />
                  </TD>
                  <TD className="text-right tabular">{fmtNumber(ct.views)}</TD>
                  <TD className="text-right tabular">{fmtNumber(ct.likes)}</TD>
                  <TD className="text-right tabular">{ct.leadsGenerated}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </>
  );
}

import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Megaphone } from "lucide-react";
import { db } from "@/lib/db";
import { requireModulePage } from "@/lib/auth";
import { getCampaignMetrics } from "@/lib/metrics";
import { CAMPAIGN_CHANNEL_LABELS, CAMPAIGN_STATUSES, CAMPAIGN_STATUS_LABELS, label } from "@/lib/constants";
import { fmtDate, fmtMoney, fmtMoneyCompact, fmtPct } from "@/lib/format";
import { fold } from "@/lib/utils";
import { Card, EmptyState, PageHeader } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead } from "@/components/ui/table";
import { ClickableRow, NewCampaignButton } from "@/components/app/buttons";
import { CampaignStatusBadge, KpiCard } from "@/components/app/display";
import { ParamSelect, SearchInput } from "@/components/app/url-controls";

export const metadata = { title: "Campaigns" };

export default async function CampaignsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireModulePage("campaigns");
  const sp = await searchParams;
  const where: Prisma.CampaignWhereInput = { deletedAt: null };
  if (sp.status) where.status = sp.status;
  if (sp.channel) where.channel = sp.channel;
  const q = fold(sp.q);
  if (q) where.searchKey = { contains: q };

  const campaigns = await db.campaign.findMany({
    where,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: { owner: { select: { name: true } } },
  });
  const metrics = await getCampaignMetrics(campaigns);
  const totals = [...metrics.values()].reduce(
    (a, m) => ({ spend: a.spend + m.spend, leads: a.leads + m.leads, won: a.won + m.won, revenue: a.revenue + m.revenue }),
    { spend: 0, leads: 0, won: 0, revenue: 0 },
  );

  return (
    <>
      <PageHeader title="Campaigns" description="Attribution from campaign → lead → deal → revenue. Metrics are derived live from linked leads." actions={<NewCampaignButton />}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <KpiCard label="Spend" value={fmtMoney(totals.spend)} />
          <KpiCard label="Attributed leads" value={String(totals.leads)} />
          <KpiCard label="Blended CPL" value={totals.leads ? fmtMoney(Math.round(totals.spend / totals.leads)) : "—"} />
          <KpiCard label="Won deals" value={String(totals.won)} hint={totals.won ? `CAC ${fmtMoney(Math.round(totals.spend / totals.won))}` : undefined} />
          <KpiCard label="Attributed revenue" value={fmtMoney(totals.revenue)} hint={totals.spend ? `ROAS ${(totals.revenue / totals.spend).toFixed(2)}x` : undefined} />
        </div>
      </PageHeader>
      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <SearchInput placeholder="Search campaigns…" className="w-full sm:w-60" />
          <ParamSelect param="status" placeholder="Any status" options={CAMPAIGN_STATUSES.map((s) => ({ value: s, label: CAMPAIGN_STATUS_LABELS[s] }))} />
          <ParamSelect param="channel" placeholder="Any channel" options={Object.entries(CAMPAIGN_CHANNEL_LABELS).map(([value, l]) => ({ value, label: l }))} />
        </div>
        {campaigns.length === 0 ? (
          <EmptyState icon={<Megaphone />} title="No campaigns" action={<NewCampaignButton variant="outline" />} />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Campaign</TH>
                <TH>Status</TH>
                <TH>Dates</TH>
                <TH className="text-right">Budget</TH>
                <TH className="text-right">Spend</TH>
                <TH className="text-right">Leads</TH>
                <TH className="text-right">Qualified</TH>
                <TH className="text-right">Demos</TH>
                <TH className="text-right">Won</TH>
                <TH className="text-right">Revenue</TH>
                <TH className="text-right">CPL</TH>
                <TH className="text-right">CAC</TH>
                <TH className="text-right">Conv.</TH>
                <TH className="text-right">ROAS</TH>
              </tr>
            </THead>
            <TBody>
              {campaigns.map((c) => {
                const m = metrics.get(c.id)!;
                return (
                  <ClickableRow key={c.id} href={`/campaigns/${c.id}`}>
                    <TD className="min-w-[200px]">
                      <Link href={`/campaigns/${c.id}`} className="font-medium hover:text-primary">
                        {c.name}
                      </Link>
                      <p className="text-[11.5px] text-muted-foreground">
                        {label(CAMPAIGN_CHANNEL_LABELS, c.channel)} · {c.owner?.name ?? "—"}
                      </p>
                    </TD>
                    <TD>
                      <CampaignStatusBadge status={c.status} />
                    </TD>
                    <TD className="whitespace-nowrap text-[12px] text-muted-foreground">
                      {fmtDate(c.startDate, "d MMM")} – {c.endDate ? fmtDate(c.endDate, "d MMM") : "…"}
                    </TD>
                    <TD className="text-right tabular text-muted-foreground">{fmtMoneyCompact(c.budget)}</TD>
                    <TD className="text-right tabular">{fmtMoneyCompact(c.spend)}</TD>
                    <TD className="text-right tabular font-medium">{m.leads}</TD>
                    <TD className="text-right tabular">{m.qualified}</TD>
                    <TD className="text-right tabular">{m.demo}</TD>
                    <TD className="text-right tabular">{m.won}</TD>
                    <TD className="text-right tabular font-medium">{fmtMoneyCompact(m.revenue)}</TD>
                    <TD className="text-right tabular">{m.cpl == null ? "—" : fmtMoneyCompact(Math.round(m.cpl))}</TD>
                    <TD className="text-right tabular">{m.cac == null ? "—" : fmtMoneyCompact(Math.round(m.cac))}</TD>
                    <TD className="text-right tabular">{fmtPct(m.conversionRate)}</TD>
                    <TD className="text-right tabular">{m.roas == null ? "—" : `${m.roas.toFixed(2)}x`}</TD>
                  </ClickableRow>
                );
              })}
            </TBody>
          </Table>
        )}
      </Card>
    </>
  );
}

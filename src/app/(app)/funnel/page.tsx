import Link from "next/link";
import { requireModulePage } from "@/lib/auth";
import { parseDateRange } from "@/lib/date-range";
import { funnelSteps, getFunnel } from "@/lib/metrics";
import { fmtMoney, fmtPct } from "@/lib/format";
import { pct } from "@/lib/utils";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { FunnelBars, KpiCard } from "@/components/app/display";
import { DateRangeControl } from "@/components/app/url-controls";

export const metadata = { title: "Funnel" };

export default async function FunnelPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireModulePage("funnel");
  const sp = await searchParams;
  const range = parseDateRange(sp, "30d");
  const f = await getFunnel(range);
  const steps = funnelSteps(f.total);

  return (
    <>
      <PageHeader
        title="Funnel"
        description={`Cohort view: leads created ${range.label.toLowerCase()} and the furthest stage each one reached.`}
        actions={<DateRangeControl />}
      />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        {steps.map((s) => (
          <KpiCard
            key={s.key}
            label={s.label}
            value={String(s.count)}
            hint={s.fromPrevious == null ? "cohort size" : `${fmtPct(s.fromPrevious)} of prev · ${fmtPct(s.overall)} overall`}
          />
        ))}
      </div>

      <Card className="mb-4">
        <CardHeader title="Stage conversion" description={`Revenue from this cohort: ${fmtMoney(f.total.revenue)}`} />
        <div className="p-4">{f.total.leads ? <FunnelBars steps={steps} /> : <EmptyState title="No leads in this period" />}</div>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="By source" description="Where the best leads come from" />
          <BreakdownTable rows={f.sourceRows} />
        </Card>
        <Card>
          <CardHeader title="By campaign" description="Leads attributed to campaigns in this cohort" />
          <BreakdownTable rows={f.campaignRows} linkPrefix="/campaigns/" />
        </Card>
      </div>
    </>
  );
}

function BreakdownTable({
  rows,
  linkPrefix,
}: {
  rows: { id: string; name: string; leads: number; qualified: number; demo: number; trial: number; won: number; revenue: number; leadToWon: number | null }[];
  linkPrefix?: string;
}) {
  if (!rows.length) return <EmptyState title="No data for this period" />;
  return (
    <Table>
      <THead>
        <tr>
          <TH>Name</TH>
          <TH className="text-right">Leads</TH>
          <TH className="text-right">Qualified</TH>
          <TH className="text-right">Demo</TH>
          <TH className="text-right">Won</TH>
          <TH className="text-right">Lead → Won</TH>
          <TH className="text-right">Revenue</TH>
        </tr>
      </THead>
      <TBody>
        {rows.map((r) => (
          <TR key={r.id}>
            <TD className="font-medium">
              {linkPrefix ? (
                <Link href={`${linkPrefix}${r.id}`} className="hover:text-primary">
                  {r.name}
                </Link>
              ) : (
                r.name
              )}
            </TD>
            <TD className="text-right tabular font-medium">{r.leads}</TD>
            <TD className="text-right tabular">
              {r.qualified} <span className="text-[11px] text-muted-foreground">{fmtPct(pct(r.qualified, r.leads), 0)}</span>
            </TD>
            <TD className="text-right tabular">{r.demo}</TD>
            <TD className="text-right tabular">{r.won}</TD>
            <TD className="text-right tabular font-semibold">{fmtPct(r.leadToWon)}</TD>
            <TD className="text-right tabular">{fmtMoney(r.revenue)}</TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}

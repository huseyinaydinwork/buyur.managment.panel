import { startOfMonth, subDays } from "date-fns";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireModulePage } from "@/lib/auth";
import { canEditLead } from "@/lib/permissions";
import { getPipelineSummary } from "@/lib/metrics";
import { refreshStaleScores } from "@/lib/lead-sync";
import { PIPELINE_COLUMNS, OPEN_STATUSES, type LeadStatus } from "@/lib/constants";
import { fmtMoney } from "@/lib/format";
import { PageHeader } from "@/components/ui/misc";
import { KpiCard } from "@/components/app/display";
import { NewLeadButton } from "@/components/app/buttons";
import { PipelineBoard } from "@/components/app/pipeline-board";
import { ParamSelect, SegmentLinks } from "@/components/app/url-controls";

export const metadata = { title: "Pipeline" };

export default async function PipelinePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireModulePage("pipeline");
  const sp = await searchParams;
  await refreshStaleScores();

  const scope = sp.scope === "mine" ? "mine" : "all";
  const showLost = sp.view === "lost";
  const ownerId = scope === "mine" ? user.id : sp.owner || undefined;

  const base: Prisma.LeadWhereInput = { deletedAt: null, ...(ownerId ? { ownerId } : {}) };
  const where: Prisma.LeadWhereInput = {
    ...base,
    OR: [
      { status: { in: OPEN_STATUSES } },
      { status: "WON", wonAt: { gte: startOfMonth(subDays(new Date(), 30)) } },
      ...(showLost ? [{ status: "LOST", lostAt: { gte: subDays(new Date(), 90) } }] : []),
    ],
  };

  const [leads, summary, owners] = await Promise.all([
    db.lead.findMany({
      where,
      orderBy: [{ stageChangedAt: "desc" }],
      include: { business: { select: { name: true } }, contact: { select: { name: true } }, owner: { select: { name: true } } },
    }),
    getPipelineSummary(ownerId ? { ownerId } : undefined),
    db.user.findMany({ where: { role: { in: ["SALES", "ADMIN"] }, isActive: true }, select: { id: true, name: true } }),
  ]);

  const columns: LeadStatus[] = showLost ? [...PIPELINE_COLUMNS, "LOST"] : PIPELINE_COLUMNS;

  return (
    <>
      <PageHeader
        title="Pipeline"
        description="Drag cards between stages — changes save instantly and land in the activity log."
        actions={<NewLeadButton />}
      >
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard label="Total pipeline value" value={fmtMoney(summary.totalValue)} hint="open deals" />
          <KpiCard label="Weighted pipeline" value={fmtMoney(summary.weightedValue)} hint="by stage probability" />
          <KpiCard label="Open deals" value={String(summary.openDeals)} />
          <KpiCard label="Won this month" value={fmtMoney(summary.wonThisMonthValue)} hint={`${summary.wonThisMonthCount} deal${summary.wonThisMonthCount === 1 ? "" : "s"}`} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SegmentLinks param="scope" fallback="all" options={[{ value: "all", label: "Everyone" }, { value: "mine", label: "My deals" }]} />
          {scope === "all" && <ParamSelect param="owner" placeholder="Any owner" options={owners.map((o) => ({ value: o.id, label: o.name }))} />}
          <SegmentLinks param="view" fallback="open" options={[{ value: "open", label: "Open + won" }, { value: "lost", label: "Show lost" }]} />
        </div>
      </PageHeader>
      <PipelineBoard
        columns={columns}
        cards={leads.map((l) => ({
          id: l.id,
          name: l.business.name,
          contact: l.contact?.name ?? null,
          owner: l.owner?.name ?? null,
          value: l.value,
          status: l.status,
          lastActivityAt: l.lastActivityAt?.toISOString() ?? null,
          nextFollowUpAt: l.nextFollowUpAt?.toISOString() ?? null,
          demoDate: l.demoDate?.toISOString() ?? null,
          canEdit: canEditLead(user, l),
        }))}
      />
    </>
  );
}

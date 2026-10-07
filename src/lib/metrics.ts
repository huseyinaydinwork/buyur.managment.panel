import "server-only";
import { startOfMonth } from "date-fns";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { OPEN_STATUSES } from "./constants";
import { between, type DateRange } from "./date-range";
import { getStageProbabilities } from "./settings";
import { pct } from "./utils";

/**
 * All analytics are derived from raw rows (leads + milestone timestamps +
 * campaign spend). Nothing here is persisted.
 */

const live: Prisma.LeadWhereInput = { deletedAt: null };

type Scope = { ownerId?: string };
const scoped = (s?: Scope): Prisma.LeadWhereInput => (s?.ownerId ? { ...live, ownerId: s.ownerId } : live);

export type Kpi = { value: number; previous: number | null; change: number | null };
const kpi = (value: number, previous: number | null): Kpi => ({
  value,
  previous,
  change: previous == null ? null : previous === 0 ? (value === 0 ? 0 : null) : ((value - previous) / previous) * 100,
});

async function periodCounts(from: Date, to: Date, s?: Scope) {
  const w = scoped(s);
  const [newLeads, qualified, demos, won, revenue, pipelineAdded] = await Promise.all([
    db.lead.count({ where: { ...w, createdAt: between(from, to) } }),
    db.lead.count({ where: { ...w, qualifiedAt: between(from, to) } }),
    db.lead.count({ where: { ...w, demoScheduledAt: between(from, to) } }),
    db.lead.count({ where: { ...w, wonAt: between(from, to), status: "WON" } }),
    db.lead.aggregate({ where: { ...w, wonAt: between(from, to), status: "WON" }, _sum: { value: true } }),
    db.lead.aggregate({ where: { ...w, createdAt: between(from, to) }, _sum: { value: true } }),
  ]);
  return { newLeads, qualified, demos, won, revenue: revenue._sum.value ?? 0, pipelineAdded: pipelineAdded._sum.value ?? 0 };
}

export async function getKpis(range: DateRange, s?: Scope) {
  const [cur, prev, pipeline] = await Promise.all([
    periodCounts(range.from, range.to, s),
    periodCounts(range.prevFrom, range.prevTo, s),
    getPipelineSummary(s),
  ]);
  return {
    newLeads: kpi(cur.newLeads, prev.newLeads),
    qualified: kpi(cur.qualified, prev.qualified),
    demos: kpi(cur.demos, prev.demos),
    won: kpi(cur.won, prev.won),
    revenue: kpi(cur.revenue, prev.revenue),
    pipelineValue: { ...kpi(pipeline.totalValue, null), added: cur.pipelineAdded },
  };
}

export async function getPipelineSummary(s?: Scope) {
  const [open, probs, wonMonth] = await Promise.all([
    db.lead.findMany({ where: { ...scoped(s), status: { in: OPEN_STATUSES } }, select: { status: true, value: true } }),
    getStageProbabilities(),
    db.lead.aggregate({
      where: { ...scoped(s), status: "WON", wonAt: { gte: startOfMonth(new Date()) } },
      _sum: { value: true },
      _count: true,
    }),
  ]);
  const totalValue = open.reduce((a, l) => a + l.value, 0);
  const weightedValue = Math.round(open.reduce((a, l) => a + (l.value * (probs[l.status] ?? 0)) / 100, 0));
  return {
    totalValue,
    weightedValue,
    openDeals: open.length,
    wonThisMonthValue: wonMonth._sum.value ?? 0,
    wonThisMonthCount: wonMonth._count,
  };
}

// ─── Funnel (cohort: leads created in range) ─────────────────────────────────

type CohortLead = {
  sourceId: string | null;
  campaignId: string | null;
  status: string;
  value: number;
  qualifiedAt: Date | null;
  demoScheduledAt: Date | null;
  trialAt: Date | null;
  wonAt: Date | null;
};

export type FunnelCounts = { leads: number; qualified: number; demo: number; trial: number; won: number; revenue: number };

function countFunnel(rows: CohortLead[]): FunnelCounts {
  const out: FunnelCounts = { leads: rows.length, qualified: 0, demo: 0, trial: 0, won: 0, revenue: 0 };
  for (const r of rows) {
    if (r.qualifiedAt) out.qualified++;
    if (r.demoScheduledAt) out.demo++;
    if (r.trialAt) out.trial++;
    if (r.wonAt && r.status === "WON") {
      out.won++;
      out.revenue += r.value;
    }
  }
  return out;
}

export const FUNNEL_STAGES = [
  { key: "leads", label: "Leads" },
  { key: "qualified", label: "Qualified" },
  { key: "demo", label: "Demo" },
  { key: "trial", label: "Trial" },
  { key: "won", label: "Won" },
] as const;

export function funnelSteps(c: FunnelCounts, keys: readonly (typeof FUNNEL_STAGES)[number]["key"][] = FUNNEL_STAGES.map((s) => s.key)) {
  const stages = FUNNEL_STAGES.filter((s) => keys.includes(s.key));
  return stages.map((s, i) => {
    const count = c[s.key];
    const prevCount = i === 0 ? null : c[stages[i - 1]!.key];
    return {
      key: s.key,
      label: s.label,
      count,
      fromPrevious: prevCount == null ? null : pct(count, prevCount),
      overall: i === 0 ? null : pct(count, c.leads),
    };
  });
}

async function cohort(range: DateRange, s?: Scope): Promise<CohortLead[]> {
  return db.lead.findMany({
    where: { ...scoped(s), createdAt: between(range.from, range.to) },
    select: { sourceId: true, campaignId: true, status: true, value: true, qualifiedAt: true, demoScheduledAt: true, trialAt: true, wonAt: true },
  });
}

export async function getFunnel(range: DateRange, s?: Scope) {
  const rows = await cohort(range, s);
  const total = countFunnel(rows);

  const [sources, campaigns] = await Promise.all([
    db.leadSource.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    db.campaign.findMany({ where: { deletedAt: null }, select: { id: true, name: true, spend: true } }),
  ]);

  const bySource = new Map<string, CohortLead[]>();
  const byCampaign = new Map<string, CohortLead[]>();
  for (const r of rows) {
    const sk = r.sourceId ?? "none";
    bySource.set(sk, [...(bySource.get(sk) ?? []), r]);
    if (r.campaignId) byCampaign.set(r.campaignId, [...(byCampaign.get(r.campaignId) ?? []), r]);
  }

  const sourceRows = [
    ...sources.map((src) => ({ id: src.id, name: src.name, ...countFunnel(bySource.get(src.id) ?? []) })),
    ...(bySource.has("none") ? [{ id: "none", name: "Unknown", ...countFunnel(bySource.get("none")!) }] : []),
  ]
    .filter((r) => r.leads > 0)
    .sort((a, b) => b.leads - a.leads)
    .map((r) => ({ ...r, leadToWon: pct(r.won, r.leads) }));

  const campaignRows = campaigns
    .map((c) => ({ id: c.id, name: c.name, spend: c.spend, ...countFunnel(byCampaign.get(c.id) ?? []) }))
    .filter((r) => r.leads > 0)
    .sort((a, b) => b.leads - a.leads)
    .map((r) => ({ ...r, leadToWon: pct(r.won, r.leads) }));

  return { total, sourceRows, campaignRows };
}

// ─── Campaign attribution (all time) ─────────────────────────────────────────

export type CampaignMetrics = FunnelCounts & {
  spend: number;
  cpl: number | null;
  costPerDemo: number | null;
  cac: number | null;
  conversionRate: number | null;
  roas: number | null;
};

export function deriveCampaignMetrics(spend: number, c: FunnelCounts): CampaignMetrics {
  return {
    ...c,
    spend,
    cpl: c.leads ? spend / c.leads : null,
    costPerDemo: c.demo ? spend / c.demo : null,
    cac: c.won ? spend / c.won : null,
    conversionRate: pct(c.won, c.leads),
    roas: spend ? c.revenue / spend : null,
  };
}

export async function getCampaignMetrics(campaigns: { id: string; spend: number }[]) {
  const ids = campaigns.map((c) => c.id);
  const leads = ids.length
    ? await db.lead.findMany({
        where: { ...live, campaignId: { in: ids } },
        select: { sourceId: true, campaignId: true, status: true, value: true, qualifiedAt: true, demoScheduledAt: true, trialAt: true, wonAt: true },
      })
    : [];
  const map = new Map<string, CampaignMetrics>();
  for (const c of campaigns) {
    map.set(c.id, deriveCampaignMetrics(c.spend, countFunnel(leads.filter((l) => l.campaignId === c.id))));
  }
  return map;
}

export async function getSourceDistribution(range: DateRange, s?: Scope) {
  const [groups, sources] = await Promise.all([
    db.lead.groupBy({ by: ["sourceId"], where: { ...scoped(s), createdAt: between(range.from, range.to) }, _count: true }),
    db.leadSource.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
  ]);
  const total = groups.reduce((a, g) => a + g._count, 0);
  const rows = groups
    .map((g) => ({
      name: sources.find((s2) => s2.id === g.sourceId)?.name ?? "Unknown",
      count: g._count,
      share: pct(g._count, total) ?? 0,
    }))
    .sort((a, b) => b.count - a.count);
  return { total, rows };
}

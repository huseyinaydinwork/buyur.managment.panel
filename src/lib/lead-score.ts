/**
 * Rule-based lead score (0–100). All weights live here — change them in one
 * place and every score is recomputed on the next lead sync.
 */
export const LEAD_SCORE_RULES = {
  multiBranch: { points: 20, minBranches: 2 },
  hasInstagram: { points: 10 },
  hasWebsite: { points: 5 },
  qualified: { points: 15 },
  demoScheduled: { points: 15 },
  demoCompleted: { points: 15 },
  recentActivity: { points: 10, withinDays: 3 },
  proposalInterest: { points: 10 },
  max: 100,
} as const;

export type LeadScoreInput = {
  branchCount: number | null | undefined;
  instagram: string | null | undefined;
  website: string | null | undefined;
  qualifiedAt: Date | null | undefined;
  demoScheduledAt: Date | null | undefined;
  demoCompletedAt: Date | null | undefined;
  lastActivityAt: Date | null | undefined;
  proposalInterest: boolean | null | undefined;
};

export type ScoreBreakdownItem = { label: string; points: number };

export function scoreBreakdown(input: LeadScoreInput, now: Date = new Date()): ScoreBreakdownItem[] {
  const r = LEAD_SCORE_RULES;
  const items: ScoreBreakdownItem[] = [];
  if ((input.branchCount ?? 0) >= r.multiBranch.minBranches)
    items.push({ label: `${r.multiBranch.minBranches}+ branches`, points: r.multiBranch.points });
  if (input.instagram?.trim()) items.push({ label: "Has Instagram", points: r.hasInstagram.points });
  if (input.website?.trim()) items.push({ label: "Has website", points: r.hasWebsite.points });
  if (input.qualifiedAt) items.push({ label: "Qualified", points: r.qualified.points });
  if (input.demoScheduledAt) items.push({ label: "Demo scheduled", points: r.demoScheduled.points });
  if (input.demoCompletedAt) items.push({ label: "Demo completed", points: r.demoCompleted.points });
  if (
    input.lastActivityAt &&
    now.getTime() - input.lastActivityAt.getTime() < r.recentActivity.withinDays * 86_400_000
  )
    items.push({ label: `Activity in last ${r.recentActivity.withinDays} days`, points: r.recentActivity.points });
  if (input.proposalInterest) items.push({ label: "Pricing / proposal interest", points: r.proposalInterest.points });
  return items;
}

export function computeLeadScore(input: LeadScoreInput, now: Date = new Date()): number {
  const total = scoreBreakdown(input, now).reduce((s, i) => s + i.points, 0);
  return Math.min(LEAD_SCORE_RULES.max, total);
}

export function scoreTone(score: number): "high" | "mid" | "low" {
  if (score >= 60) return "high";
  if (score >= 30) return "mid";
  return "low";
}

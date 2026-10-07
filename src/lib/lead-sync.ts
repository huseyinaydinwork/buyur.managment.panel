import "server-only";
import { db } from "./db";
import { computeLeadScore } from "./lead-score";
import { digitsOnly, fold } from "./utils";

const SCORE_STALE_MS = 1000 * 60 * 60 * 6;

/**
 * Recomputes the denormalised fields of the given leads (score, search key,
 * next follow-up). Call after any mutation touching a lead, its business,
 * contact, activities or follow-ups.
 */
export async function syncLeads(leadIds: string[]) {
  const ids = [...new Set(leadIds.filter(Boolean))];
  if (!ids.length) return;
  const leads = await db.lead.findMany({
    where: { id: { in: ids } },
    include: {
      business: { select: { name: true, branchCount: true, instagram: true, website: true, city: true, district: true } },
      contact: { select: { name: true, phone: true, email: true } },
      followUps: { where: { completedAt: null }, orderBy: { dueAt: "asc" }, take: 1, select: { dueAt: true, note: true } },
    },
  });
  const now = new Date();
  await db.$transaction(
    leads.map((l) => {
      const next = l.followUps[0];
      return db.lead.update({
        where: { id: l.id },
        data: {
          score: computeLeadScore(
            {
              branchCount: l.business.branchCount,
              instagram: l.business.instagram,
              website: l.business.website,
              qualifiedAt: l.qualifiedAt,
              demoScheduledAt: l.demoScheduledAt,
              demoCompletedAt: l.demoCompletedAt,
              lastActivityAt: l.lastActivityAt,
              proposalInterest: l.proposalInterest,
            },
            now,
          ),
          scoreComputedAt: now,
          nextFollowUpAt: next?.dueAt ?? null,
          nextFollowUpNote: next?.note ?? null,
          searchKey: [
            fold(l.business.name),
            fold(l.contact?.name),
            digitsOnly(l.contact?.phone),
            fold(l.contact?.email),
            fold(l.business.city),
            fold(l.business.district),
          ]
            .filter(Boolean)
            .join(" | "),
        },
      });
    }),
  );
}

export async function syncLeadsForBusiness(businessId: string) {
  const leads = await db.lead.findMany({ where: { businessId }, select: { id: true } });
  await syncLeads(leads.map((l) => l.id));
}

/** Time-decaying rules (recent activity) need periodic refresh; cheap at MVP volumes. */
export async function refreshStaleScores() {
  const stale = await db.lead.findMany({
    where: {
      deletedAt: null,
      OR: [{ scoreComputedAt: null }, { scoreComputedAt: { lt: new Date(Date.now() - SCORE_STALE_MS) } }],
    },
    select: { id: true },
    take: 500,
  });
  if (stale.length) await syncLeads(stale.map((s) => s.id));
}

export function businessSearchKey(b: {
  name: string;
  city?: string | null;
  district?: string | null;
  instagram?: string | null;
}) {
  return [fold(b.name), fold(b.city), fold(b.district), fold(b.instagram)].filter(Boolean).join(" | ");
}

export function contactSearchKey(c: { name: string; phone?: string | null; email?: string | null }) {
  return [fold(c.name), digitsOnly(c.phone), fold(c.email)].filter(Boolean).join(" | ");
}

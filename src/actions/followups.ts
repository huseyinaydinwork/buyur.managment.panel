"use server";

import { db } from "@/lib/db";
import { requireModule, type CurrentUser } from "@/lib/auth";
import { parse, runAction } from "@/lib/action";
import { AppError } from "@/lib/errors";
import { canEditLead } from "@/lib/permissions";
import { logActivity, notify } from "@/lib/activity";
import { syncLeads } from "@/lib/lead-sync";
import { revalidateApp } from "@/lib/revalidate";
import { followUpCompleteSchema, followUpCreateSchema } from "@/lib/validation";

async function canManageFollowUp(user: CurrentUser, f: { ownerId: string; lead: { ownerId: string | null } }) {
  return user.role === "ADMIN" || f.ownerId === user.id || canEditLead(user, f.lead);
}

export async function createFollowUp(input: Record<string, unknown>) {
  return runAction(async () => {
    const user = await requireModule("leads");
    const d = parse(followUpCreateSchema, input);
    const lead = await db.lead.findFirst({ where: { id: d.leadId, deletedAt: null }, include: { business: { select: { name: true } } } });
    if (!lead) throw new AppError("Lead not found.", "NOT_FOUND");
    if (!canEditLead(user, lead)) throw new AppError("Only the lead owner or an admin can schedule follow-ups.", "FORBIDDEN");
    const ownerId = d.ownerId ?? lead.ownerId ?? user.id;

    await db.$transaction(async (tx) => {
      const f = await tx.followUp.create({ data: { leadId: lead.id, ownerId, dueAt: d.dueAt, note: d.note } });
      await logActivity(
        {
          type: "FOLLOW_UP",
          userId: user.id,
          entityType: "LEAD",
          entityId: lead.id,
          leadId: lead.id,
          businessId: lead.businessId,
          body: d.note,
          metadata: { name: lead.business.name, action: "scheduled", dueAt: d.dueAt.toISOString(), followUpId: f.id },
        },
        tx,
      );
      await notify(ownerId, user.id, { title: `Follow-up for ${lead.business.name}`, body: d.note ?? undefined, href: `/leads/${lead.id}` }, tx);
    });
    await syncLeads([lead.id]);
    revalidateApp();
    return { ok: true };
  });
}

export async function completeFollowUp(input: Record<string, unknown>) {
  return runAction(async () => {
    const user = await requireModule("leads");
    const d = parse(followUpCompleteSchema, input);
    const f = await db.followUp.findUnique({
      where: { id: d.id },
      include: { lead: { select: { id: true, ownerId: true, businessId: true, business: { select: { name: true } } } } },
    });
    if (!f) throw new AppError("Follow-up not found.", "NOT_FOUND");
    if (f.completedAt) throw new AppError("This follow-up is already completed.");
    if (!(await canManageFollowUp(user, f))) throw new AppError("You can't complete this follow-up.", "FORBIDDEN");

    await db.$transaction(async (tx) => {
      await tx.followUp.update({ where: { id: f.id }, data: { completedAt: new Date(), completedById: user.id } });
      await logActivity(
        {
          type: "FOLLOW_UP",
          userId: user.id,
          entityType: "LEAD",
          entityId: f.leadId,
          leadId: f.leadId,
          businessId: f.lead.businessId,
          body: d.outcome ?? f.note,
          metadata: { name: f.lead.business.name, action: "completed", followUpId: f.id },
        },
        tx,
      );
      if (d.nextDueAt) {
        const next = await tx.followUp.create({
          data: { leadId: f.leadId, ownerId: f.ownerId, dueAt: d.nextDueAt, note: d.nextNote },
        });
        await logActivity(
          {
            type: "FOLLOW_UP",
            userId: user.id,
            entityType: "LEAD",
            entityId: f.leadId,
            leadId: f.leadId,
            businessId: f.lead.businessId,
            body: d.nextNote,
            metadata: { name: f.lead.business.name, action: "scheduled", dueAt: d.nextDueAt.toISOString(), followUpId: next.id },
          },
          tx,
        );
      }
    });
    await syncLeads([f.leadId]);
    revalidateApp();
    return { scheduledNext: !!d.nextDueAt };
  });
}

export async function cancelFollowUp(id: string) {
  return runAction(async () => {
    const user = await requireModule("leads");
    const f = await db.followUp.findUnique({ where: { id }, include: { lead: { select: { ownerId: true } } } });
    if (!f) throw new AppError("Follow-up not found.", "NOT_FOUND");
    if (!(await canManageFollowUp(user, f))) throw new AppError("You can't remove this follow-up.", "FORBIDDEN");
    await db.followUp.delete({ where: { id } });
    await syncLeads([f.leadId]);
    revalidateApp();
    return { ok: true };
  });
}

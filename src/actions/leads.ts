"use server";

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireModule, type CurrentUser } from "@/lib/auth";
import { parse, runAction } from "@/lib/action";
import { AppError } from "@/lib/errors";
import { canEditLead } from "@/lib/permissions";
import { logActivity, notify } from "@/lib/activity";
import { businessSearchKey, contactSearchKey, syncLeads } from "@/lib/lead-sync";
import { revalidateApp } from "@/lib/revalidate";
import { digitsOnly, fold } from "@/lib/utils";
import { LEAD_STATUSES, LEAD_STATUS_LABELS, STAGE_MILESTONE_FIELD, type LeadStatus } from "@/lib/constants";
import { leadCreateSchema, leadUpdateSchema, logActivitySchema, stageChangeSchema } from "@/lib/validation";
import { fmtMoney } from "@/lib/format";

async function assertAssignable(ownerId: string | null) {
  if (!ownerId) return;
  const owner = await db.user.findFirst({ where: { id: ownerId, isActive: true, role: { in: ["SALES", "ADMIN"] } } });
  if (!owner) throw new AppError("Owner must be an active sales user or admin.");
}

async function assertRefs(sourceId: string | null, campaignId: string | null) {
  if (sourceId && !(await db.leadSource.findUnique({ where: { id: sourceId } }))) throw new AppError("Unknown lead source.");
  if (campaignId && !(await db.campaign.findFirst({ where: { id: campaignId, deletedAt: null } })))
    throw new AppError("Unknown campaign.");
}

async function loadEditableLead(user: CurrentUser, id: string) {
  const lead = await db.lead.findFirst({ where: { id, deletedAt: null }, include: { business: true } });
  if (!lead) throw new AppError("Lead not found.", "NOT_FOUND");
  if (!canEditLead(user, lead)) throw new AppError("Only the lead owner or an admin can change this lead.", "FORBIDDEN");
  return lead;
}

// ─── Create ──────────────────────────────────────────────────────────────────

export async function createLead(input: Record<string, unknown>) {
  return runAction(async () => {
    const user = await requireModule("leads");
    const d = parse(leadCreateSchema, input);
    await assertAssignable(d.ownerId);
    await assertRefs(d.sourceId, d.campaignId);

    const leadId = await db.$transaction(async (tx) => {
      let businessId = d.businessId;
      let businessName: string;
      if (businessId) {
        const b = await tx.business.findFirst({ where: { id: businessId, deletedAt: null } });
        if (!b) throw new AppError("Business not found.");
        businessName = b.name;
      } else {
        const name = d.businessName!;
        const b = await tx.business.create({
          data: {
            name,
            type: d.businessType,
            city: d.city,
            district: d.district,
            instagram: d.instagram,
            website: d.website,
            branchCount: d.branchCount ?? 1,
            searchKey: businessSearchKey({ name, city: d.city, district: d.district, instagram: d.instagram }),
          },
        });
        businessId = b.id;
        businessName = b.name;
        await logActivity(
          { type: "BUSINESS_CREATED", userId: user.id, entityType: "BUSINESS", entityId: b.id, businessId: b.id, metadata: { name } },
          tx,
        );
      }

      let contactId = d.contactId;
      if (contactId) {
        const c = await tx.contact.findFirst({ where: { id: contactId, businessId } });
        if (!c) throw new AppError("Contact does not belong to this business.");
      } else if (d.phone || d.contactName) {
        const existing = d.phone
          ? await tx.contact.findFirst({ where: { businessId, phoneDigits: digitsOnly(d.phone) } })
          : null;
        if (existing) contactId = existing.id;
        else {
          const hasPrimary = await tx.contact.count({ where: { businessId, isPrimary: true } });
          const name = d.contactName ?? "Business contact";
          const c = await tx.contact.create({
            data: {
              businessId,
              name,
              phone: d.phone,
              phoneDigits: digitsOnly(d.phone) || null,
              email: d.email,
              isPrimary: hasPrimary === 0,
              searchKey: contactSearchKey({ name, phone: d.phone, email: d.email }),
            },
          });
          contactId = c.id;
        }
      }

      const lead = await tx.lead.create({
        data: {
          businessId,
          contactId,
          ownerId: d.ownerId,
          sourceId: d.sourceId,
          campaignId: d.campaignId,
          value: d.value ?? 0,
          notes: d.notes,
        },
      });
      await logActivity(
        {
          type: "LEAD_CREATED",
          userId: user.id,
          entityType: "LEAD",
          entityId: lead.id,
          leadId: lead.id,
          businessId,
          campaignId: d.campaignId,
          body: d.notes,
          metadata: { name: businessName },
        },
        tx,
      );
      await notify(d.ownerId, user.id, { title: `New lead assigned: ${businessName}`, body: `by ${user.name}`, href: `/leads/${lead.id}` }, tx);
      return lead.id;
    });

    await syncLeads([leadId]);
    revalidateApp();
    return { id: leadId };
  });
}

// ─── Update ──────────────────────────────────────────────────────────────────

export async function updateLead(input: Record<string, unknown>) {
  return runAction(async () => {
    const user = await requireModule("leads");
    const d = parse(leadUpdateSchema, input);
    const lead = await loadEditableLead(user, d.id);
    await assertAssignable(d.ownerId);
    await assertRefs(d.sourceId, d.campaignId);
    if (d.contactId && !(await db.contact.findFirst({ where: { id: d.contactId, businessId: lead.businessId } })))
      throw new AppError("Contact does not belong to this business.");

    const changed: string[] = [];
    if (d.value !== lead.value && !(d.value == null && lead.value === 0)) changed.push(`value ${fmtMoney(d.value ?? 0)}`);
    if (d.sourceId !== lead.sourceId) changed.push("source");
    if (d.campaignId !== lead.campaignId) changed.push("campaign");
    if (d.contactId !== lead.contactId) changed.push("contact");
    if (d.proposalInterest !== lead.proposalInterest) changed.push(d.proposalInterest ? "pricing interest ✓" : "pricing interest ✗");
    if ((d.demoDate?.getTime() ?? null) !== (lead.demoDate?.getTime() ?? null)) changed.push("demo date");
    if ((d.notes ?? null) !== (lead.notes ?? null)) changed.push("notes");

    await db.$transaction(async (tx) => {
      await tx.lead.update({
        where: { id: lead.id },
        data: {
          ownerId: d.ownerId,
          sourceId: d.sourceId,
          campaignId: d.campaignId,
          contactId: d.contactId,
          value: d.value ?? 0,
          proposalInterest: d.proposalInterest,
          demoDate: d.demoDate,
          notes: d.notes,
        },
      });
      const meta = { name: lead.business.name };
      if (d.ownerId !== lead.ownerId) {
        const owner = d.ownerId ? await tx.user.findUnique({ where: { id: d.ownerId }, select: { name: true } }) : null;
        await logActivity(
          { type: "LEAD_ASSIGNED", userId: user.id, entityType: "LEAD", entityId: lead.id, leadId: lead.id, businessId: lead.businessId, metadata: { ...meta, to: owner?.name ?? null } },
          tx,
        );
        await notify(d.ownerId, user.id, { title: `Lead assigned to you: ${lead.business.name}`, body: `by ${user.name}`, href: `/leads/${lead.id}` }, tx);
      }
      if (changed.length) {
        await logActivity(
          { type: "LEAD_UPDATED", userId: user.id, entityType: "LEAD", entityId: lead.id, leadId: lead.id, businessId: lead.businessId, campaignId: d.campaignId, metadata: { ...meta, fields: changed.join(", ") } },
          tx,
        );
      }
    });
    await syncLeads([lead.id]);
    revalidateApp();
    return { id: lead.id };
  });
}

// ─── Stage changes (detail page, pipeline drag & drop) ───────────────────────

export async function changeLeadStage(input: Record<string, unknown>) {
  return runAction(async () => {
    const user = await requireModule("leads", "pipeline");
    const d = parse(stageChangeSchema, input);
    const lead = await loadEditableLead(user, d.id);
    const to = d.status as LeadStatus;
    const from = lead.status as LeadStatus;
    const now = new Date();

    const data: Prisma.LeadUncheckedUpdateInput = {};
    if (to !== from) {
      data.status = to;
      data.stageChangedAt = now;
      if (to !== "LOST") {
        const idx = LEAD_STATUSES.indexOf(to);
        for (const [stage, field] of Object.entries(STAGE_MILESTONE_FIELD)) {
          if (stage === "WON") continue;
          if (LEAD_STATUSES.indexOf(stage as LeadStatus) <= idx && !lead[field as keyof typeof lead]) {
            (data as Record<string, unknown>)[field] = now;
          }
        }
      }
      data.wonAt = to === "WON" ? now : null;
      data.lostAt = to === "LOST" ? now : null;
      if (to !== "LOST") data.lostReason = null;
    }
    if (d.value != null) data.value = d.value;
    if (to === "LOST" && d.lostReason !== undefined) data.lostReason = d.lostReason;
    if (d.demoDate !== undefined && d.demoDate !== null) data.demoDate = d.demoDate;

    if (!Object.keys(data).length) return { id: lead.id, status: lead.status };

    const finalValue = d.value ?? lead.value;
    await db.$transaction(async (tx) => {
      await tx.lead.update({ where: { id: lead.id }, data });
      const meta = { name: lead.business.name };
      if (to !== from) {
        await logActivity(
          { type: "STATUS_CHANGE", userId: user.id, entityType: "LEAD", entityId: lead.id, leadId: lead.id, businessId: lead.businessId, campaignId: lead.campaignId, metadata: { ...meta, from, to } },
          tx,
        );
        if (to === "WON") {
          await logActivity(
            { type: "DEAL_WON", userId: user.id, entityType: "LEAD", entityId: lead.id, leadId: lead.id, businessId: lead.businessId, campaignId: lead.campaignId, metadata: { ...meta, value: finalValue } },
            tx,
          );
          await tx.business.update({ where: { id: lead.businessId }, data: { status: "CUSTOMER" } });
        }
        if (to === "LOST") {
          await logActivity(
            { type: "DEAL_LOST", userId: user.id, entityType: "LEAD", entityId: lead.id, leadId: lead.id, businessId: lead.businessId, campaignId: lead.campaignId, body: d.lostReason ?? null, metadata: { ...meta, reason: d.lostReason ?? null } },
            tx,
          );
        }
        if (to === "WON" || to === "LOST") {
          // Closed deals don't need chasing — clear pending follow-ups from everyone's lists.
          await tx.followUp.updateMany({
            where: { leadId: lead.id, completedAt: null },
            data: { completedAt: now, completedById: user.id },
          });
        }
        if (from === "WON") {
          const otherWins = await tx.lead.count({ where: { businessId: lead.businessId, status: "WON", deletedAt: null, NOT: { id: lead.id } } });
          if (!otherWins) await tx.business.update({ where: { id: lead.businessId }, data: { status: "PROSPECT" } });
        }
      } else if (d.value != null && d.value !== lead.value) {
        await logActivity(
          { type: "LEAD_UPDATED", userId: user.id, entityType: "LEAD", entityId: lead.id, leadId: lead.id, businessId: lead.businessId, metadata: { ...meta, fields: `value ${fmtMoney(d.value)}` } },
          tx,
        );
      }
    });
    await syncLeads([lead.id]);
    revalidateApp();
    return { id: lead.id, status: to, label: LEAD_STATUS_LABELS[to] };
  });
}

// ─── Delete (admin, soft) ────────────────────────────────────────────────────

export async function deleteLead(id: string) {
  return runAction(async () => {
    const user = await requireModule("leads");
    if (user.role !== "ADMIN") throw new AppError("Only admins can delete leads.", "FORBIDDEN");
    await db.lead.update({ where: { id }, data: { deletedAt: new Date() } });
    await db.followUp.updateMany({ where: { leadId: id, completedAt: null }, data: { completedAt: new Date(), completedById: user.id } });
    revalidateApp();
    return { id };
  });
}

// ─── Activity logging (note, call, WhatsApp…) ────────────────────────────────

export async function logLeadActivity(input: Record<string, unknown>) {
  return runAction(async () => {
    const d = parse(logActivitySchema, input);
    const user = await requireModule(d.leadId ? "leads" : "businesses");
    let businessId = d.businessId;
    let name: string;
    let campaignId: string | null = null;
    if (d.leadId) {
      const lead = await db.lead.findFirst({ where: { id: d.leadId, deletedAt: null }, include: { business: { select: { name: true } } } });
      if (!lead) throw new AppError("Lead not found.", "NOT_FOUND");
      businessId = lead.businessId;
      campaignId = lead.campaignId;
      name = lead.business.name;
    } else {
      const b = await db.business.findFirst({ where: { id: businessId!, deletedAt: null } });
      if (!b) throw new AppError("Business not found.", "NOT_FOUND");
      name = b.name;
    }
    const occurredAt = d.occurredAt && d.occurredAt.getTime() <= Date.now() ? d.occurredAt : undefined;
    await logActivity({
      type: d.type,
      userId: user.id,
      entityType: d.leadId ? "LEAD" : "BUSINESS",
      entityId: d.leadId ?? businessId!,
      leadId: d.leadId,
      businessId,
      campaignId,
      body: d.body,
      metadata: { name },
      createdAt: occurredAt,
    });
    if (d.leadId) await syncLeads([d.leadId]);
    revalidateApp();
    return { ok: true };
  });
}

// ─── Lookups for forms ───────────────────────────────────────────────────────

export async function searchLeadOptions(q: string) {
  const user = await requireModule("leads", "tasks");
  if (user.role === "MARKETING") return [];
  const key = fold(q);
  const leads = await db.lead.findMany({
    where: { deletedAt: null, ...(key ? { searchKey: { contains: key } } : { status: { notIn: ["WON", "LOST"] } }) },
    select: { id: true, status: true, business: { select: { name: true } } },
    orderBy: { updatedAt: "desc" },
    take: 30,
  });
  return leads.map((l) => ({ id: l.id, label: l.business.name, sub: LEAD_STATUS_LABELS[l.status as LeadStatus] }));
}

export async function searchBusinessOptions(q: string) {
  const user = await requireModule("businesses", "leads", "tasks");
  if (user.role === "MARKETING") return [];
  const key = fold(q);
  const rows = await db.business.findMany({
    where: { deletedAt: null, ...(key ? { searchKey: { contains: key } } : {}) },
    select: { id: true, name: true, city: true, district: true },
    orderBy: { updatedAt: "desc" },
    take: 30,
  });
  return rows.map((b) => ({ id: b.id, label: b.name, sub: [b.district, b.city].filter(Boolean).join(", ") }));
}

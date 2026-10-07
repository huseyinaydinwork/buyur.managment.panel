"use server";

import { db } from "@/lib/db";
import { requireModule } from "@/lib/auth";
import { parse, runAction } from "@/lib/action";
import { AppError } from "@/lib/errors";
import { logActivity } from "@/lib/activity";
import { revalidateApp } from "@/lib/revalidate";
import { fold } from "@/lib/utils";
import { CONTENT_STATUSES, CONTENT_STATUS_LABELS } from "@/lib/constants";
import { campaignSchema, contentSchema } from "@/lib/validation";

// ─── Campaigns ───────────────────────────────────────────────────────────────

export async function saveCampaign(input: Record<string, unknown>) {
  return runAction(async () => {
    const user = await requireModule("campaigns");
    const d = parse(campaignSchema, input);
    if (d.ownerId && !(await db.user.findFirst({ where: { id: d.ownerId, isActive: true } })))
      throw new AppError("Owner must be an active user.");
    const data = {
      name: d.name,
      description: d.description,
      channel: d.channel,
      startDate: d.startDate,
      endDate: d.endDate,
      budget: d.budget ?? 0,
      spend: d.spend ?? 0,
      ownerId: d.ownerId ?? user.id,
      status: d.status,
      searchKey: fold(d.name),
    };
    if (d.id) {
      const c = await db.campaign.findFirst({ where: { id: d.id, deletedAt: null } });
      if (!c) throw new AppError("Campaign not found.", "NOT_FOUND");
      await db.campaign.update({ where: { id: d.id }, data });
      const fields: string[] = [];
      if (c.status !== d.status) fields.push(`status ${d.status.toLowerCase()}`);
      if (c.spend !== data.spend) fields.push("spend");
      if (c.budget !== data.budget) fields.push("budget");
      await logActivity({
        type: "CAMPAIGN_UPDATED",
        userId: user.id,
        entityType: "CAMPAIGN",
        entityId: d.id,
        campaignId: d.id,
        metadata: { name: d.name, fields: fields.join(", ") },
      });
      revalidateApp();
      return { id: d.id };
    }
    const c = await db.campaign.create({ data });
    await logActivity({ type: "CAMPAIGN_CREATED", userId: user.id, entityType: "CAMPAIGN", entityId: c.id, campaignId: c.id, metadata: { name: c.name } });
    revalidateApp();
    return { id: c.id };
  });
}

export async function deleteCampaign(id: string) {
  return runAction(async () => {
    const user = await requireModule("campaigns");
    if (user.role !== "ADMIN" && user.role !== "MARKETING") throw new AppError("Not allowed.", "FORBIDDEN");
    await db.campaign.update({ where: { id }, data: { deletedAt: new Date() } });
    revalidateApp();
    return { id };
  });
}

// ─── Content ─────────────────────────────────────────────────────────────────

export async function saveContent(input: Record<string, unknown>) {
  return runAction(async () => {
    const user = await requireModule("content");
    const d = parse(contentSchema, input);
    if (d.campaignId && !(await db.campaign.findFirst({ where: { id: d.campaignId, deletedAt: null } })))
      throw new AppError("Unknown campaign.");
    const data = {
      title: d.title,
      platform: d.platform,
      format: d.format,
      campaignId: d.campaignId,
      ownerId: d.ownerId ?? user.id,
      status: d.status,
      publishAt: d.publishAt,
      url: d.url,
      views: d.views ?? 0,
      likes: d.likes ?? 0,
      saves: d.saves ?? 0,
      shares: d.shares ?? 0,
      leadsGenerated: d.leadsGenerated ?? 0,
      notes: d.notes,
    };
    if (d.id) {
      const existing = await db.content.findUnique({ where: { id: d.id } });
      if (!existing) throw new AppError("Content not found.", "NOT_FOUND");
      await db.content.update({ where: { id: d.id }, data });
      if (existing.status !== d.status) {
        await logActivity({
          type: "CONTENT_STATUS_CHANGED",
          userId: user.id,
          entityType: "CONTENT",
          entityId: d.id,
          campaignId: d.campaignId,
          metadata: { name: d.title, to: CONTENT_STATUS_LABELS[d.status] },
        });
      }
      revalidateApp();
      return { id: d.id };
    }
    const c = await db.content.create({ data });
    await logActivity({ type: "CONTENT_CREATED", userId: user.id, entityType: "CONTENT", entityId: c.id, campaignId: d.campaignId, metadata: { name: c.title } });
    revalidateApp();
    return { id: c.id };
  });
}

export async function moveContent(id: string, status: string) {
  return runAction(async () => {
    const user = await requireModule("content");
    if (!(CONTENT_STATUSES as readonly string[]).includes(status)) throw new AppError("Invalid status.");
    const c = await db.content.findUnique({ where: { id } });
    if (!c) throw new AppError("Content not found.", "NOT_FOUND");
    if (c.status === status) return { id };
    await db.content.update({
      where: { id },
      data: { status, publishAt: status === "PUBLISHED" && !c.publishAt ? new Date() : c.publishAt },
    });
    await logActivity({
      type: "CONTENT_STATUS_CHANGED",
      userId: user.id,
      entityType: "CONTENT",
      entityId: id,
      campaignId: c.campaignId,
      metadata: { name: c.title, to: CONTENT_STATUS_LABELS[status as keyof typeof CONTENT_STATUS_LABELS] },
    });
    revalidateApp();
    return { id };
  });
}

export async function deleteContent(id: string) {
  return runAction(async () => {
    await requireModule("content");
    await db.content.delete({ where: { id } });
    revalidateApp();
    return { id };
  });
}

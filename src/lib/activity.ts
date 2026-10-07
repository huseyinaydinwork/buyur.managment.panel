import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import type { ActivityType, EntityType } from "./constants";

type Tx = Prisma.TransactionClient | typeof db;

export type LogActivityInput = {
  type: ActivityType;
  userId: string | null;
  entityType: EntityType;
  entityId: string;
  leadId?: string | null;
  businessId?: string | null;
  campaignId?: string | null;
  body?: string | null;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
};

/** Writes to the central activity log and bumps the lead's lastActivityAt. */
export async function logActivity(input: LogActivityInput, tx: Tx = db) {
  const activity = await tx.activity.create({
    data: {
      type: input.type,
      userId: input.userId,
      entityType: input.entityType,
      entityId: input.entityId,
      leadId: input.leadId ?? null,
      businessId: input.businessId ?? null,
      campaignId: input.campaignId ?? null,
      body: input.body ?? null,
      metadata: JSON.stringify(input.metadata ?? {}),
      createdAt: input.createdAt,
    },
  });
  if (input.leadId) {
    await tx.lead.update({ where: { id: input.leadId }, data: { lastActivityAt: activity.createdAt } });
  }
  return activity;
}

/** In-app notification for someone else (never notifies the actor). */
export async function notify(
  userId: string | null | undefined,
  actorId: string,
  n: { title: string; body?: string; href?: string },
  tx: Tx = db,
) {
  if (!userId || userId === actorId) return;
  await tx.notification.create({ data: { userId, ...n } });
}

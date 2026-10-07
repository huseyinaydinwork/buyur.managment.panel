"use server";

import { db } from "@/lib/db";
import { requireModule } from "@/lib/auth";
import { parse, runAction } from "@/lib/action";
import { AppError } from "@/lib/errors";
import { logActivity } from "@/lib/activity";
import { businessSearchKey, contactSearchKey, syncLeads, syncLeadsForBusiness } from "@/lib/lead-sync";
import { revalidateApp } from "@/lib/revalidate";
import { digitsOnly } from "@/lib/utils";
import { businessSchema, contactSchema } from "@/lib/validation";

export async function saveBusiness(input: Record<string, unknown>) {
  return runAction(async () => {
    const user = await requireModule("businesses");
    const d = parse(businessSchema, input);
    const data = {
      name: d.name,
      type: d.type,
      city: d.city,
      district: d.district,
      address: d.address,
      instagram: d.instagram,
      website: d.website,
      branchCount: d.branchCount ?? 1,
      notes: d.notes,
      searchKey: businessSearchKey(d),
      ...(d.status ? { status: d.status } : {}),
    };
    if (d.id) {
      const existing = await db.business.findFirst({ where: { id: d.id, deletedAt: null } });
      if (!existing) throw new AppError("Business not found.", "NOT_FOUND");
      await db.business.update({ where: { id: d.id }, data });
      await logActivity({ type: "BUSINESS_UPDATED", userId: user.id, entityType: "BUSINESS", entityId: d.id, businessId: d.id, metadata: { name: d.name } });
      await syncLeadsForBusiness(d.id); // branch count / instagram / website feed lead score
      revalidateApp();
      return { id: d.id };
    }
    const b = await db.business.create({ data });
    await logActivity({ type: "BUSINESS_CREATED", userId: user.id, entityType: "BUSINESS", entityId: b.id, businessId: b.id, metadata: { name: b.name } });
    revalidateApp();
    return { id: b.id };
  });
}

export async function deleteBusiness(id: string) {
  return runAction(async () => {
    const user = await requireModule("businesses");
    if (user.role !== "ADMIN") throw new AppError("Only admins can delete businesses.", "FORBIDDEN");
    const now = new Date();
    await db.$transaction([
      db.business.update({ where: { id }, data: { deletedAt: now } }),
      db.lead.updateMany({ where: { businessId: id, deletedAt: null }, data: { deletedAt: now } }),
    ]);
    revalidateApp();
    return { id };
  });
}

export async function saveContact(input: Record<string, unknown>) {
  return runAction(async () => {
    const user = await requireModule("businesses", "leads");
    const d = parse(contactSchema, input);
    const business = await db.business.findFirst({ where: { id: d.businessId, deletedAt: null } });
    if (!business) throw new AppError("Business not found.", "NOT_FOUND");
    const data = {
      name: d.name,
      role: d.role,
      phone: d.phone,
      phoneDigits: digitsOnly(d.phone) || null,
      email: d.email,
      isPrimary: d.isPrimary,
      searchKey: contactSearchKey(d),
    };
    const contactId = await db.$transaction(async (tx) => {
      const hasContacts = await tx.contact.count({ where: { businessId: d.businessId } });
      const isPrimary = d.isPrimary || hasContacts === 0;
      if (isPrimary) await tx.contact.updateMany({ where: { businessId: d.businessId }, data: { isPrimary: false } });
      if (d.id) {
        const c = await tx.contact.findFirst({ where: { id: d.id, businessId: d.businessId } });
        if (!c) throw new AppError("Contact not found.", "NOT_FOUND");
        await tx.contact.update({ where: { id: d.id }, data: { ...data, isPrimary } });
        return d.id;
      }
      const c = await tx.contact.create({ data: { ...data, isPrimary, businessId: d.businessId } });
      await logActivity(
        { type: "CONTACT_ADDED", userId: user.id, entityType: "BUSINESS", entityId: d.businessId, businessId: d.businessId, metadata: { name: business.name, contact: d.name } },
        tx,
      );
      return c.id;
    });
    const leads = await db.lead.findMany({ where: { contactId }, select: { id: true } });
    await syncLeads(leads.map((l) => l.id));
    revalidateApp();
    return { id: contactId };
  });
}

export async function deleteContact(id: string) {
  return runAction(async () => {
    await requireModule("businesses");
    const c = await db.contact.findUnique({ where: { id } });
    if (!c) throw new AppError("Contact not found.", "NOT_FOUND");
    const leads = await db.lead.findMany({ where: { contactId: id }, select: { id: true } });
    await db.contact.delete({ where: { id } });
    if (c.isPrimary) {
      const next = await db.contact.findFirst({ where: { businessId: c.businessId }, orderBy: { createdAt: "asc" } });
      if (next) await db.contact.update({ where: { id: next.id }, data: { isPrimary: true } });
    }
    await syncLeads(leads.map((l) => l.id));
    revalidateApp();
    return { id };
  });
}

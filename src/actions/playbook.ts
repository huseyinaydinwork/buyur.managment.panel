"use server";

import { db } from "@/lib/db";
import { requireModule } from "@/lib/auth";
import { parse, runAction } from "@/lib/action";
import { AppError } from "@/lib/errors";
import { can } from "@/lib/permissions";
import { revalidateApp } from "@/lib/revalidate";
import { playbookSchema } from "@/lib/validation";

/** Everyone with playbook access can read; editing is for admins. */
async function requireEditor() {
  const user = await requireModule("playbook");
  if (!can(user, "admin")) throw new AppError("Only admins can edit the playbook.", "FORBIDDEN");
  return user;
}

export async function savePlaybookEntry(input: Record<string, unknown>) {
  return runAction(async () => {
    await requireEditor();
    const d = parse(playbookSchema, input);
    const data = { category: d.category, stage: d.stage, title: d.title, body: d.body };
    if (d.id) {
      await db.playbookEntry.update({ where: { id: d.id }, data });
      revalidateApp();
      return { id: d.id };
    }
    const max = await db.playbookEntry.aggregate({ _max: { sortOrder: true } });
    const e = await db.playbookEntry.create({ data: { ...data, sortOrder: (max._max.sortOrder ?? 0) + 1 } });
    revalidateApp();
    return { id: e.id };
  });
}

export async function deletePlaybookEntry(id: string) {
  return runAction(async () => {
    await requireEditor();
    await db.playbookEntry.delete({ where: { id } });
    revalidateApp();
    return { id };
  });
}

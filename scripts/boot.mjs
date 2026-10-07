// Production boot tasks (run by scripts/start.sh after `prisma migrate deploy`):
//  1. SQLite pragmas (WAL for concurrent reads during writes)
//  2. Persistence markers: firstBootAt is written once; bootCount increments on
//     every start. /api/health exposes both, so you can verify that data
//     survives restarts and deploys.
//  3. First-run bootstrap: create the initial admin from ADMIN_EMAIL /
//     ADMIN_PASSWORD, or load demo data when SEED_ON_EMPTY=true.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { ensurePlaybook } from "../prisma/playbook-defaults.mjs";

const prisma = new PrismaClient();

async function setMeta(key, value) {
  await prisma.appSetting.upsert({ where: { key }, create: { key, value }, update: { value } });
}

try {
  await prisma.$queryRawUnsafe("PRAGMA journal_mode=WAL;");
  await prisma.$queryRawUnsafe("PRAGMA busy_timeout=5000;");

  const first = await prisma.appSetting.findUnique({ where: { key: "system.firstBootAt" } });
  const count = await prisma.appSetting.findUnique({ where: { key: "system.bootCount" } });
  const nowIso = new Date().toISOString();
  if (!first) await setMeta("system.firstBootAt", nowIso);
  await setMeta("system.lastBootAt", nowIso);
  await setMeta("system.bootCount", String((Number(count?.value) || 0) + 1));
  console.log(
    `[boot] database ok — firstBootAt=${first?.value ?? nowIso} bootCount=${(Number(count?.value) || 0) + 1}`,
  );

  const added = await ensurePlaybook(prisma);
  if (added) console.log(`[boot] loaded ${added} default sales playbook entries`);

  const users = await prisma.user.count();
  if (users === 0) {
    if (process.env.SEED_ON_EMPTY === "true") {
      console.log("[boot] empty database + SEED_ON_EMPTY=true → loading demo data");
      const { seed } = await import("../prisma/seed.mjs");
      await seed(prisma);
    } else if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
      if (process.env.ADMIN_PASSWORD.length < 8) throw new Error("ADMIN_PASSWORD must be at least 8 characters");
      await prisma.user.create({
        data: {
          email: process.env.ADMIN_EMAIL.trim().toLowerCase(),
          name: process.env.ADMIN_NAME || "Admin",
          role: "ADMIN",
          passwordHash: await bcrypt.hash(process.env.ADMIN_PASSWORD, 12),
        },
      });
      const defaults = ["Instagram", "Meta Ads", "Cold Outreach", "Website", "Referral", "Event", "Partner", "Other"];
      for (const [i, name] of defaults.entries()) {
        await prisma.leadSource.upsert({ where: { name }, create: { name, sortOrder: i }, update: {} });
      }
      console.log(`[boot] created initial admin ${process.env.ADMIN_EMAIL}`);
    } else {
      console.warn("[boot] WARNING: no users exist. Open /setup in the browser to create the admin account.");
    }
  }
} catch (err) {
  console.error("[boot] failed:", err);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}

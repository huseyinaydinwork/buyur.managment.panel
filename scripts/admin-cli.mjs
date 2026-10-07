// Small ops CLI for production (run via `fly ssh console`):
//   node scripts/admin-cli.mjs make-admin <email> [--from <existingEmail>]
//     - with --from: renames that account's email to <email> and makes it ADMIN (keeps password)
//     - without:     promotes an existing user with <email> to ADMIN
//   node scripts/admin-cli.mjs list
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const [cmd, email, flag, from] = process.argv.slice(2);
try {
  if (cmd === "list") {
    for (const u of await prisma.user.findMany({ orderBy: { createdAt: "asc" } }))
      console.log(`${u.role.padEnd(9)} ${u.isActive ? "active  " : "inactive"} ${u.email}  (${u.name})`);
  } else if (cmd === "make-admin" && email) {
    const target = email.trim().toLowerCase();
    const source = flag === "--from" && from ? from.trim().toLowerCase() : target;
    const user = await prisma.user.findUnique({ where: { email: source } });
    if (!user) throw new Error(`No user with email ${source}`);
    if (source !== target && (await prisma.user.findUnique({ where: { email: target } })))
      throw new Error(`${target} already exists`);
    await prisma.user.update({ where: { id: user.id }, data: { email: target, role: "ADMIN", isActive: true } });
    console.log(`✓ ${target} is now an active ADMIN`);
  } else if (cmd === "reset-users" && email === "--yes") {
    // Removes every account so the /setup screen opens again. Business data is kept.
    await prisma.$transaction([prisma.session.deleteMany(), prisma.notification.deleteMany(), prisma.followUp.deleteMany(), prisma.user.deleteMany()]);
    console.log("✓ All users removed — open /setup to create the admin account");
  } else {
    console.log("Usage: node scripts/admin-cli.mjs list | make-admin <email> [--from <existingEmail>] | reset-users --yes");
    process.exitCode = 1;
  }
} catch (e) {
  console.error("✗", e.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}

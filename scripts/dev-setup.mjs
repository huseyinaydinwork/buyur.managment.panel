// Runs before `npm run dev`: makes a fresh clone work with just
// `npm install && npm run dev` — creates .env, applies migrations, seeds demo data once.
import { copyFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";

if (!existsSync(".env")) {
  copyFileSync(".env.example", ".env");
  console.log("• Created .env from .env.example");
}

// Load .env for this process (Prisma CLI reads it too, but we need DATABASE_URL for the client)
const { readFileSync } = await import("node:fs");
for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*"?([^"]*)"?\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

try {
  execSync("npx prisma migrate deploy", { stdio: "inherit" });
} catch {
  console.error("✗ Migration failed. Fix the error above, or reset the local DB with `npm run db:reset`.");
  process.exit(1);
}

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();
try {
  const users = await prisma.user.count();
  if (users === 0) {
    console.log("• Empty database — loading demo data");
    const { seed } = await import("../prisma/seed.mjs");
    await seed(prisma);
  }
} finally {
  await prisma.$disconnect();
}

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Liveness + persistence check used by Fly health checks.
 * `firstBootAt` stays constant and `bootCount` grows across restarts/deploys
 * when the SQLite file lives on the persistent volume — if `firstBootAt`
 * changes after a deploy, the database was recreated (volume not mounted).
 */
export async function GET() {
  try {
    const [users, leads, meta] = await Promise.all([
      db.user.count(),
      db.lead.count(),
      db.appSetting.findMany({ where: { key: { startsWith: "system." } } }),
    ]);
    const m = Object.fromEntries(meta.map((r) => [r.key.replace("system.", ""), r.value]));
    return NextResponse.json({
      status: "ok",
      database: "ok",
      firstBootAt: m.firstBootAt ?? null,
      lastBootAt: m.lastBootAt ?? null,
      bootCount: m.bootCount ? Number(m.bootCount) : null,
      counts: { users, leads },
      time: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[health]", err);
    return NextResponse.json({ status: "error", database: "unreachable" }, { status: 503 });
  }
}

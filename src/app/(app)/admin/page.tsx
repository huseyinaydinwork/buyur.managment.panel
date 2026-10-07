import Link from "next/link";
import { db } from "@/lib/db";
import { requireModulePage } from "@/lib/auth";
import { parseOverrides } from "@/lib/permissions";
import { ROLES, ROLE_LABELS } from "@/lib/constants";
import { fmtDateTime } from "@/lib/format";
import { Card, CardHeader, PageHeader } from "@/components/ui/misc";
import { KpiCard } from "@/components/app/display";
import { TeamTable } from "@/components/app/settings-forms";

export const metadata = { title: "Admin" };

export default async function AdminPage() {
  const me = await requireModulePage("admin");
  const [users, meta, counts] = await Promise.all([
    db.user.findMany({ orderBy: [{ isActive: "desc" }, { role: "asc" }, { name: "asc" }] }),
    db.appSetting.findMany({ where: { key: { startsWith: "system." } } }),
    Promise.all([db.business.count({ where: { deletedAt: null } }), db.lead.count({ where: { deletedAt: null } }), db.activity.count()]),
  ]);
  const m = Object.fromEntries(meta.map((r) => [r.key.replace("system.", ""), r.value]));
  const active = users.filter((u) => u.isActive);

  return (
    <>
      <PageHeader title="Admin" description="Add, edit, deactivate or remove team members. Changes take effect immediately." />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        <KpiCard label="Active users" value={String(active.length)} hint={`${users.length - active.length} deactivated`} />
        {ROLES.map((r) => (
          <KpiCard key={r} label={ROLE_LABELS[r]} value={String(active.filter((u) => u.role === r).length)} />
        ))}
      </div>

      <Card className="mb-4">
        <CardHeader title="Team members" description="Deactivate keeps the account (can be restored); Delete removes it permanently." />
        <div className="p-4">
          <TeamTable
            meId={me.id}
            users={users.map((u) => ({
              id: u.id,
              name: u.name,
              email: u.email,
              role: u.role,
              isActive: u.isActive,
              lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
            permissions: parseOverrides(u.permissions),
            }))}
          />
        </div>
      </Card>

      <Card>
        <CardHeader
          title="System"
          description="Database persistence markers — first boot stays constant across restarts and deploys"
          action={
            <Link href="/settings?tab=sources" className="text-[12px] font-medium text-primary hover:underline">
              Lead sources & pipeline settings
            </Link>
          }
        />
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 px-4 py-3 text-[13px] sm:grid-cols-[160px_1fr_160px_1fr]">
          <dt className="text-muted-foreground">First boot</dt>
          <dd>{m.firstBootAt ? fmtDateTime(m.firstBootAt) : "— (local dev)"}</dd>
          <dt className="text-muted-foreground">Last boot</dt>
          <dd>{m.lastBootAt ? fmtDateTime(m.lastBootAt) : "—"}</dd>
          <dt className="text-muted-foreground">Boot count</dt>
          <dd className="tabular">{m.bootCount ?? "—"}</dd>
          <dt className="text-muted-foreground">Records</dt>
          <dd className="tabular">
            {counts[0]} businesses · {counts[1]} leads · {counts[2]} activities
          </dd>
        </dl>
      </Card>
    </>
  );
}

import Link from "next/link";
import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { SESSION_COOKIE, requireUserPage } from "@/lib/auth";
import { can, parseOverrides } from "@/lib/permissions";
import { getStageProbabilities } from "@/lib/settings";
import { LEAD_SCORE_RULES } from "@/lib/lead-score";
import { ROLE_LABELS, label } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Card, CardHeader, PageHeader } from "@/components/ui/misc";
import {
  AccountActions,
  LeadSourcesEditor,
  PasswordForm,
  PipelineSettings,
  ProfileForm,
  TeamTable,
} from "@/components/app/settings-forms";

export const metadata = { title: "Settings" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireUserPage();
  const isAdmin = can(user, "admin");
  const tabs = [
    { key: "profile", label: "Profile" },
    ...(isAdmin ? [{ key: "team", label: "Team" }, { key: "sources", label: "Lead Sources" }] : []),
    { key: "pipeline", label: "Pipeline" },
    { key: "account", label: "Account" },
  ];
  const { tab: raw } = await searchParams;
  const tab = tabs.some((t) => t.key === raw) ? raw! : "profile";

  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  const currentSessionId = token ? createHash("sha256").update(token).digest("hex") : null;

  return (
    <>
      <PageHeader title="Settings" description={`Signed in as ${user.email} · ${label(ROLE_LABELS, user.role)}`} />
      <div className="mb-4 flex gap-1 overflow-x-auto border-b scroll-thin">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.key === "profile" ? "/settings" : `/settings?tab=${t.key}`}
            className={cn(
              "-mb-px whitespace-nowrap border-b-2 border-transparent px-3 py-2 text-[13px] font-medium text-muted-foreground hover:text-foreground",
              tab === t.key && "border-primary text-foreground",
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === "profile" && (
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="Profile" />
            <div className="p-4">
              <ProfileForm name={user.name} email={user.email} />
            </div>
          </Card>
          <Card>
            <CardHeader title="Password" />
            <div className="p-4">
              <PasswordForm />
            </div>
          </Card>
        </div>
      )}

      {tab === "team" && isAdmin && <TeamTab meId={user.id} />}
      {tab === "sources" && isAdmin && <SourcesTab />}
      {tab === "pipeline" && <PipelineTab editable={isAdmin} />}

      {tab === "account" && (
        <Card>
          <CardHeader title="Sessions" description="Devices currently signed in to your account" />
          <div className="p-4">
            <AccountActions
              sessions={(await db.session.findMany({ where: { userId: user.id }, orderBy: { lastSeenAt: "desc" } })).map((s) => ({
                id: s.id.slice(0, 12),
                userAgent: s.userAgent,
                lastSeenAt: s.lastSeenAt.toISOString(),
                current: s.id === currentSessionId,
              }))}
            />
          </div>
        </Card>
      )}
    </>
  );
}

async function TeamTab({ meId }: { meId: string }) {
  const users = await db.user.findMany({ orderBy: [{ isActive: "desc" }, { name: "asc" }] });
  return (
    <Card>
      <CardHeader title="Team" description="Create users, change roles, deactivate accounts." />
      <div className="p-4">
        <TeamTable
          meId={meId}
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
  );
}

async function SourcesTab() {
  const sources = await db.leadSource.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { leads: { where: { deletedAt: null } } } } },
  });
  return (
    <Card>
      <CardHeader title="Lead sources" description="Options shown in lead forms and used in source analytics." />
      <div className="p-4">
        <LeadSourcesEditor sources={sources.map((s) => ({ id: s.id, name: s.name, isActive: s.isActive, leads: s._count.leads }))} />
      </div>
    </Card>
  );
}

async function PipelineTab({ editable }: { editable: boolean }) {
  const probabilities = await getStageProbabilities();
  const r = LEAD_SCORE_RULES;
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader title="Stage probabilities" description={editable ? "Admins can tune these." : "Read-only — ask an admin to change."} />
        <div className="p-4">
          <PipelineSettings probabilities={probabilities} editable={editable} />
        </div>
      </Card>
      <Card>
        <CardHeader title="Lead score rules" description="Defined centrally in code (src/lib/lead-score.ts)" />
        <ul className="divide-y text-[13px]">
          {[
            [`Branch count ≥ ${r.multiBranch.minBranches}`, r.multiBranch.points],
            ["Has Instagram", r.hasInstagram.points],
            ["Has website", r.hasWebsite.points],
            ["Reached Qualified", r.qualified.points],
            ["Reached Demo Scheduled", r.demoScheduled.points],
            ["Reached Demo Completed", r.demoCompleted.points],
            [`Activity in last ${r.recentActivity.withinDays} days`, r.recentActivity.points],
            ["Pricing / proposal interest", r.proposalInterest.points],
          ].map(([l, p]) => (
            <li key={String(l)} className="flex justify-between px-4 py-2">
              <span>{l}</span>
              <span className="font-medium text-success tabular">+{p}</span>
            </li>
          ))}
          <li className="flex justify-between px-4 py-2 text-muted-foreground">
            <span>Maximum</span>
            <span className="tabular">{r.max}</span>
          </li>
        </ul>
      </Card>
    </div>
  );
}

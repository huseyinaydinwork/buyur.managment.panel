import Link from "next/link";
import { addDays, endOfMonth, startOfDay, startOfMonth, subDays, subMonths } from "date-fns";
import { CalendarClock, Clock, Presentation } from "lucide-react";
import { db } from "@/lib/db";
import { requireModulePage } from "@/lib/auth";
import { refreshStaleScores } from "@/lib/lead-sync";
import { OPEN_STATUSES, STALE_LEAD_DAYS, type LeadStatus } from "@/lib/constants";
import { fmtMoney, fmtMoneyCompact, fmtRelative, fmtSmartDate } from "@/lib/format";
import { telHref } from "@/lib/utils";
import { Card, CardHeader, PageHeader } from "@/components/ui/misc";
import { Delta, LeadStatusBadge, ScoreBadge } from "@/components/app/display";
import { NewLeadButton } from "@/components/app/buttons";
import { FollowUpRow, type FollowUpItem } from "@/components/app/lead-detail";

export const metadata = { title: "My Day" };

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

const PIPE_GROUPS: { label: string; statuses: LeadStatus[] }[] = [
  { label: "New", statuses: ["NEW"] },
  { label: "Contacted", statuses: ["CONTACTED"] },
  { label: "Qualified", statuses: ["QUALIFIED"] },
  { label: "Demo", statuses: ["DEMO_SCHEDULED", "DEMO_COMPLETED"] },
  { label: "Trial", statuses: ["TRIAL"] },
  { label: "Negotiation", statuses: ["NEGOTIATION"] },
];

export default async function SalesHomePage() {
  const user = await requireModulePage("salesHome");
  await refreshStaleScores();
  const now = new Date();
  const today = startOfDay(now);
  const tomorrow = addDays(today, 1);
  const weekAhead = addDays(today, 8);
  const monthStart = startOfMonth(now);
  const lastMonthStart = subMonths(monthStart, 1);
  const lastMonthSameDay = new Date(Math.min(subMonths(now, 1).getTime(), endOfMonth(lastMonthStart).getTime()));
  const mine = { deletedAt: null, ownerId: user.id };

  const [followUps, demos, staleLeads, newLeads, pipeline, wonMonth, perf, perfPrev] = await Promise.all([
    db.followUp.findMany({
      where: { ownerId: user.id, completedAt: null, dueAt: { lt: weekAhead }, lead: { deletedAt: null } },
      orderBy: { dueAt: "asc" },
      include: { lead: { select: { id: true, business: { select: { name: true } }, contact: { select: { phone: true } } } } },
    }),
    db.lead.findMany({
      where: { ...mine, status: "DEMO_SCHEDULED", demoDate: { gte: today, lt: weekAhead } },
      orderBy: { demoDate: "asc" },
      include: { business: { select: { name: true } }, contact: { select: { name: true } } },
    }),
    db.lead.findMany({
      where: {
        ...mine,
        status: { in: OPEN_STATUSES },
        OR: [
          { lastActivityAt: { lt: subDays(now, STALE_LEAD_DAYS) } },
          { lastActivityAt: null, createdAt: { lt: subDays(now, STALE_LEAD_DAYS) } },
        ],
      },
      orderBy: [{ lastActivityAt: { sort: "asc", nulls: "first" } }],
      take: 8,
      include: { business: { select: { name: true } } },
    }),
    db.lead.count({ where: { ...mine, status: "NEW" } }),
    db.lead.groupBy({ by: ["status"], where: { ...mine, status: { in: OPEN_STATUSES } }, _count: true, _sum: { value: true } }),
    db.lead.aggregate({ where: { ...mine, status: "WON", wonAt: { gte: monthStart } }, _count: true, _sum: { value: true } }),
    perfFor(user.id, monthStart, now),
    perfFor(user.id, lastMonthStart, lastMonthSameDay),
  ]);

  const toItem = (f: (typeof followUps)[number]): FollowUpItem => ({
    id: f.id,
    dueAt: f.dueAt.toISOString(),
    note: f.note,
    leadId: f.lead.id,
    leadName: f.lead.business.name,
    phoneHref: telHref(f.lead.contact?.phone),
  });
  const overdue = followUps.filter((f) => f.dueAt < today).map(toItem);
  const todays = followUps.filter((f) => f.dueAt >= today && f.dueAt < tomorrow).map(toItem);
  const upcoming = followUps.filter((f) => f.dueAt >= tomorrow).map(toItem);
  const demosToday = demos.filter((d) => d.demoDate! < tomorrow).length;

  const groupRows = PIPE_GROUPS.map((g) => {
    const rows = pipeline.filter((p) => g.statuses.includes(p.status as LeadStatus));
    return { ...g, count: rows.reduce((s, r) => s + r._count, 0), value: rows.reduce((s, r) => s + (r._sum.value ?? 0), 0) };
  });
  const maxCount = Math.max(1, ...groupRows.map((g) => g.count));

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${user.name.split(" ")[0]}`}
        description="Here's what needs you today."
        actions={<NewLeadButton />}
      />

      <div className="mb-5 grid grid-cols-3 gap-3">
        <TodayStat label="Follow-ups today" value={todays.length + overdue.length} sub={overdue.length ? `${overdue.length} overdue` : "none overdue"} danger={overdue.length > 0} />
        <TodayStat label="Demos today" value={demosToday} sub={`${demos.length} this week`} />
        <TodayStat label="New leads to contact" value={newLeads} sub="status New" href="/leads?scope=mine&status=NEW" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.25fr_1fr]">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="Follow-ups" description="Overdue · today · next 7 days" />
            <Section title="Overdue" tone="danger" items={overdue} empty="Nothing overdue 🎉" />
            <Section title="Today" items={todays} empty="No follow-ups due today." />
            <Section title="Upcoming" items={upcoming} empty="Nothing scheduled this week." />
          </Card>

          <Card>
            <CardHeader title="Needs attention" description={`Open leads with no activity for ${STALE_LEAD_DAYS}+ days`} />
            {staleLeads.length === 0 ? (
              <p className="px-4 py-4 text-[13px] text-muted-foreground">All your open leads were touched recently.</p>
            ) : (
              <ul>
                {staleLeads.map((l) => (
                  <li key={l.id} className="flex items-center gap-3 border-b px-4 py-2.5 last:border-0">
                    <Clock className="size-4 shrink-0 text-warning" />
                    <Link href={`/leads/${l.id}`} className="min-w-0 flex-1 truncate text-[13.5px] font-medium hover:text-primary">
                      {l.business.name}
                    </Link>
                    <LeadStatusBadge status={l.status} />
                    <ScoreBadge score={l.score} />
                    <span className="w-24 shrink-0 text-right text-[11.5px] text-muted-foreground">{fmtRelative(l.lastActivityAt ?? l.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="Upcoming demos" />
            {demos.length === 0 ? (
              <p className="px-4 py-4 text-[13px] text-muted-foreground">No demos scheduled in the next 7 days.</p>
            ) : (
              <ul>
                {demos.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 border-b px-4 py-2.5 last:border-0">
                    <Presentation className="size-4 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <Link href={`/leads/${d.id}`} className="block truncate text-[13.5px] font-medium hover:text-primary">
                        {d.business.name}
                      </Link>
                      {d.contact && <p className="text-[11.5px] text-muted-foreground">{d.contact.name}</p>}
                    </div>
                    <span className="inline-flex items-center gap-1 text-[12px] font-medium tabular">
                      <CalendarClock className="size-3.5 text-muted-foreground" /> {fmtSmartDate(d.demoDate)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="My pipeline" action={<Link href="/pipeline?scope=mine" className="text-[12px] font-medium text-primary hover:underline">Open board</Link>} />
            <div className="flex flex-col gap-2 px-4 py-3">
              {groupRows.map((g) => (
                <div key={g.label} className="grid grid-cols-[90px_1fr_86px] items-center gap-3 text-[13px]">
                  <span>{g.label}</span>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-foreground/80" style={{ width: `${(g.count / maxCount) * 100}%` }} />
                  </div>
                  <span className="text-right tabular">
                    <b>{g.count}</b> <span className="text-[11.5px] text-muted-foreground">{fmtMoneyCompact(g.value)}</span>
                  </span>
                </div>
              ))}
              <div className="grid grid-cols-[90px_1fr_86px] items-center gap-3 border-t pt-2 text-[13px]">
                <span className="font-medium text-success">Won (month)</span>
                <span />
                <span className="text-right tabular">
                  <b>{wonMonth._count}</b> <span className="text-[11.5px] text-muted-foreground">{fmtMoneyCompact(wonMonth._sum.value ?? 0)}</span>
                </span>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="My performance" description="This month vs same point last month" />
            <div className="grid grid-cols-2 gap-px bg-border">
              {(
                [
                  ["Leads contacted", perf.contacted, perfPrev.contacted, false],
                  ["Demos held", perf.demos, perfPrev.demos, false],
                  ["Deals won", perf.won, perfPrev.won, false],
                  ["Revenue", perf.revenue, perfPrev.revenue, true],
                ] as const
              ).map(([l, v, p, money]) => (
                <div key={l} className="bg-card px-4 py-3">
                  <p className="text-[12px] text-muted-foreground">{l}</p>
                  <p className="text-lg font-semibold tabular">{money ? fmtMoney(v) : v}</p>
                  <p className="text-[11.5px]">
                    <Delta change={p ? ((v - p) / p) * 100 : v ? null : 0} />
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

async function perfFor(userId: string, from: Date, to: Date) {
  const w = { deletedAt: null, ownerId: userId };
  const [contacted, demos, won] = await Promise.all([
    db.lead.count({ where: { ...w, contactedAt: { gte: from, lt: to } } }),
    db.lead.count({ where: { ...w, demoCompletedAt: { gte: from, lt: to } } }),
    db.lead.aggregate({ where: { ...w, status: "WON", wonAt: { gte: from, lt: to } }, _count: true, _sum: { value: true } }),
  ]);
  return { contacted, demos, won: won._count, revenue: won._sum.value ?? 0 };
}

function TodayStat({ label, value, sub, danger, href }: { label: string; value: number; sub: string; danger?: boolean; href?: string }) {
  const body = (
    <div className="rounded-lg border bg-card px-4 py-3 transition-colors hover:border-foreground/15">
      <p className="text-[12px] font-medium text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold tabular">{value}</p>
      <p className={`text-[11.5px] ${danger ? "font-semibold text-destructive" : "text-muted-foreground"}`}>{sub}</p>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function Section({ title, items, empty, tone }: { title: string; items: FollowUpItem[]; empty: string; tone?: "danger" }) {
  return (
    <div>
      <p className={`border-b bg-subtle px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide ${tone === "danger" && items.length ? "text-destructive" : "text-muted-foreground"}`}>
        {title} <span className="tabular">· {items.length}</span>
      </p>
      {items.length === 0 ? <p className="border-b px-4 py-3 text-[12.5px] text-muted-foreground">{empty}</p> : items.map((f) => <FollowUpRow key={f.id} f={f} />)}
    </div>
  );
}

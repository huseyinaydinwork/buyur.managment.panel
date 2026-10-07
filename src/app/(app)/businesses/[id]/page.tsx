import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { requireModulePage } from "@/lib/auth";
import { describeActivity } from "@/lib/activity-format";
import { BUSINESS_STATUS_LABELS, BUSINESS_TYPE_LABELS, label } from "@/lib/constants";
import { fmtDate, fmtMoney, fmtRelative, fmtSmartDate } from "@/lib/format";
import { cn, instagramHref, websiteHref } from "@/lib/utils";
import { Avatar, Badge, Card, CardHeader, EmptyState } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead } from "@/components/ui/table";
import { ActivityFeed, LeadStatusBadge, ScoreBadge } from "@/components/app/display";
import { BusinessActions, ContactsTable } from "@/components/app/business-detail";
import { ClickableRow, NewLeadButton, NewTaskButton } from "@/components/app/buttons";
import { NoteComposer } from "@/components/app/lead-detail";
import { TaskList } from "@/components/app/task-list";

const TABS = ["overview", "contacts", "deals", "activities", "notes", "tasks"] as const;

export default async function BusinessDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await requireModulePage("businesses");
  const { id } = await params;
  const { tab: rawTab } = await searchParams;
  const tab = (TABS as readonly string[]).includes(rawTab ?? "") ? rawTab! : "overview";

  const b = await db.business.findFirst({
    where: { id, deletedAt: null },
    include: {
      contacts: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
      leads: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        include: { owner: { select: { name: true } }, source: { select: { name: true } } },
      },
    },
  });
  if (!b) notFound();

  const [activities, tasks] = await Promise.all([
    db.activity.findMany({
      where: { OR: [{ businessId: b.id }, { lead: { businessId: b.id } }], ...(tab === "notes" ? { type: "NOTE" } : {}) },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { user: { select: { name: true } } },
    }),
    db.task.findMany({
      where: { OR: [{ businessId: b.id }, { lead: { businessId: b.id } }] },
      orderBy: [{ status: "asc" }, { dueAt: { sort: "asc", nulls: "last" } }],
      include: { owner: { select: { name: true } }, lead: { select: { id: true, business: { select: { name: true } } } } },
    }),
  ]);

  const formValue = {
    id: b.id,
    name: b.name,
    type: b.type,
    city: b.city,
    district: b.district,
    address: b.address,
    instagram: b.instagram,
    website: b.website,
    branchCount: b.branchCount,
    status: b.status,
    notes: b.notes,
  };
  const wonValue = b.leads.filter((l) => l.status === "WON").reduce((s, l) => s + l.value, 0);
  const openLeads = b.leads.filter((l) => !["WON", "LOST"].includes(l.status));
  const counts: Record<string, number> = {
    contacts: b.contacts.length,
    deals: b.leads.length,
    tasks: tasks.filter((t) => t.status !== "DONE").length,
  };

  return (
    <>
      <Link href="/businesses" className="mb-3 inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> Businesses
      </Link>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">{b.name}</h1>
            <Badge tone={b.status === "CUSTOMER" ? "green" : b.status === "CHURNED" ? "outline" : "neutral"}>{label(BUSINESS_STATUS_LABELS, b.status)}</Badge>
          </div>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {[label(BUSINESS_TYPE_LABELS, b.type), [b.district, b.city].filter(Boolean).join(", "), `${b.branchCount} branch${b.branchCount > 1 ? "es" : ""}`]
              .filter((x) => x && x !== "—")
              .join(" · ")}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <NewLeadButton
            label="New deal"
            business={{ id: b.id, name: b.name }}
            contacts={b.contacts.map((c) => ({ id: c.id, name: c.name, phone: c.phone }))}
          />
          <BusinessActions business={formValue} isAdmin={user.role === "ADMIN"} />
        </div>
      </div>

      <div className="mb-4 flex gap-1 overflow-x-auto border-b scroll-thin">
        {TABS.map((t) => (
          <Link
            key={t}
            href={t === "overview" ? `/businesses/${b.id}` : `/businesses/${b.id}?tab=${t}`}
            scroll={false}
            className={cn(
              "-mb-px whitespace-nowrap border-b-2 border-transparent px-3 py-2 text-[13px] font-medium capitalize text-muted-foreground hover:text-foreground",
              tab === t && "border-primary text-foreground",
            )}
          >
            {t}
            {counts[t] != null && <span className="ml-1.5 text-[11px] text-muted-foreground tabular">{counts[t]}</span>}
          </Link>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-3">
              <Card className="px-4 py-3">
                <p className="text-[12px] text-muted-foreground">Open deals</p>
                <p className="text-lg font-semibold tabular">{openLeads.length}</p>
              </Card>
              <Card className="px-4 py-3">
                <p className="text-[12px] text-muted-foreground">Open value</p>
                <p className="text-lg font-semibold tabular">{fmtMoney(openLeads.reduce((s, l) => s + l.value, 0))}</p>
              </Card>
              <Card className="px-4 py-3">
                <p className="text-[12px] text-muted-foreground">Won revenue</p>
                <p className="text-lg font-semibold tabular">{fmtMoney(wonValue)}</p>
              </Card>
            </div>
            <Card>
              <CardHeader title="Recent activity" action={<Link href={`/businesses/${b.id}?tab=activities`} className="text-[12px] font-medium text-primary hover:underline">View all</Link>} />
              {activities.length ? <ActivityFeed items={activities.slice(0, 8).map(describeActivity)} compact /> : <EmptyState title="No activity yet" />}
            </Card>
          </div>
          <Card>
            <CardHeader title="Overview" />
            <dl className="grid grid-cols-[100px_1fr] gap-x-3 gap-y-2.5 px-4 py-3 text-[13px]">
              <dt className="text-muted-foreground">Type</dt>
              <dd>{label(BUSINESS_TYPE_LABELS, b.type)}</dd>
              <dt className="text-muted-foreground">City</dt>
              <dd>{b.city ?? "—"}</dd>
              <dt className="text-muted-foreground">District</dt>
              <dd>{b.district ?? "—"}</dd>
              <dt className="text-muted-foreground">Address</dt>
              <dd>{b.address ?? "—"}</dd>
              <dt className="text-muted-foreground">Instagram</dt>
              <dd className="truncate">{b.instagram ? <a href={instagramHref(b.instagram)!} target="_blank" rel="noopener noreferrer" className="hover:text-primary">{b.instagram}</a> : "—"}</dd>
              <dt className="text-muted-foreground">Website</dt>
              <dd className="truncate">{b.website ? <a href={websiteHref(b.website)!} target="_blank" rel="noopener noreferrer" className="hover:text-primary">{b.website}</a> : "—"}</dd>
              <dt className="text-muted-foreground">Branches</dt>
              <dd className="tabular">{b.branchCount}</dd>
              <dt className="text-muted-foreground">Status</dt>
              <dd>{label(BUSINESS_STATUS_LABELS, b.status)}</dd>
              <dt className="text-muted-foreground">Created</dt>
              <dd>{fmtDate(b.createdAt)}</dd>
            </dl>
            {b.notes && <p className="whitespace-pre-line border-t px-4 py-3 text-[13px]">{b.notes}</p>}
          </Card>
        </div>
      )}

      {tab === "contacts" && (
        <Card>
          <ContactsTable
            businessId={b.id}
            contacts={b.contacts.map((c) => ({ id: c.id, name: c.name, role: c.role, phone: c.phone, email: c.email, isPrimary: c.isPrimary }))}
          />
        </Card>
      )}

      {tab === "deals" && (
        <Card>
          {b.leads.length === 0 ? (
            <EmptyState title="No deals yet" description="Create a deal (lead) for this business to start the pipeline." />
          ) : (
            <Table>
              <THead>
                <tr>
                  <TH>Status</TH>
                  <TH>Owner</TH>
                  <TH>Source</TH>
                  <TH className="text-center">Score</TH>
                  <TH className="text-right">Value</TH>
                  <TH>Last activity</TH>
                  <TH>Next follow-up</TH>
                  <TH>Created</TH>
                </tr>
              </THead>
              <TBody>
                {b.leads.map((l) => (
                  <ClickableRow key={l.id} href={`/leads/${l.id}`}>
                    <TD>
                      <LeadStatusBadge status={l.status} />
                    </TD>
                    <TD>{l.owner ? <span className="inline-flex items-center gap-1.5"><Avatar name={l.owner.name} className="size-5 text-[9px]" />{l.owner.name}</span> : "Unassigned"}</TD>
                    <TD className="text-muted-foreground">{l.source?.name ?? "—"}</TD>
                    <TD className="text-center"><ScoreBadge score={l.score} /></TD>
                    <TD className="text-right tabular">{fmtMoney(l.value)}</TD>
                    <TD className="text-muted-foreground">{l.lastActivityAt ? fmtRelative(l.lastActivityAt) : "—"}</TD>
                    <TD>{l.nextFollowUpAt ? fmtSmartDate(l.nextFollowUpAt) : "—"}</TD>
                    <TD className="text-muted-foreground">{fmtDate(l.createdAt, "d MMM yyyy")}</TD>
                  </ClickableRow>
                ))}
              </TBody>
            </Table>
          )}
        </Card>
      )}

      {(tab === "activities" || tab === "notes") && (
        <Card>
          <NoteComposer businessId={b.id} />
          {activities.length ? (
            <ActivityFeed items={activities.map(describeActivity)} />
          ) : (
            <EmptyState title={tab === "notes" ? "No notes yet" : "No activity yet"} />
          )}
        </Card>
      )}

      {tab === "tasks" && (
        <Card>
          <CardHeader title="Tasks" action={<NewTaskButton size="xs" variant="outline" label="Add task" business={{ id: b.id, label: b.name }} />} />
          <TaskList
            tasks={tasks.map((t) => ({
              id: t.id,
              title: t.title,
              description: t.description,
              status: t.status,
              priority: t.priority,
              dueAt: t.dueAt?.toISOString() ?? null,
              ownerId: t.ownerId,
              ownerName: t.owner?.name ?? null,
              lead: t.lead ? { id: t.lead.id, label: t.lead.business.name } : null,
              business: { id: b.id, label: b.name },
            }))}
            emptyText="No tasks for this business."
          />
        </Card>
      )}
    </>
  );
}

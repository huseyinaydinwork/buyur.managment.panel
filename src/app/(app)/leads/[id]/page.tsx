import Link from "next/link";
import { notFound } from "next/navigation";
import { format, isSameDay } from "date-fns";
import { ArrowLeft, Building2, CalendarClock, ExternalLink, AtSign, Globe, Mail, MapPin, Phone } from "lucide-react";
import { db } from "@/lib/db";
import { requireModulePage } from "@/lib/auth";
import { canEditLead } from "@/lib/permissions";
import { describeActivity } from "@/lib/activity-format";
import { scoreBreakdown, LEAD_SCORE_RULES } from "@/lib/lead-score";
import { BUSINESS_TYPE_LABELS, label } from "@/lib/constants";
import { fmtDate, fmtDateTime, fmtMoney, fmtSmartDate } from "@/lib/format";
import { instagramHref, telHref, websiteHref, whatsappHref } from "@/lib/utils";
import { Avatar, Card, CardHeader, EmptyState } from "@/components/ui/misc";
import { ActivityFeed, LeadStatusBadge, ScoreBadge } from "@/components/app/display";
import { FollowUpRow, LeadQuickActions, NoteComposer, StageProgress } from "@/components/app/lead-detail";
import { TaskList } from "@/components/app/task-list";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireModulePage("leads");
  const { id } = await params;
  const lead = await db.lead.findFirst({
    where: { id, deletedAt: null },
    include: {
      business: { include: { contacts: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] } } },
      contact: true,
      owner: { select: { id: true, name: true } },
      source: { select: { name: true } },
      campaign: { select: { id: true, name: true } },
      followUps: { where: { completedAt: null }, orderBy: { dueAt: "asc" }, include: { owner: { select: { name: true } } } },
      tasks: {
        where: { status: { not: "DONE" } },
        orderBy: [{ dueAt: { sort: "asc", nulls: "last" } }],
        include: { owner: { select: { name: true } }, lead: { select: { id: true, business: { select: { name: true } } } }, business: { select: { id: true, name: true } } },
      },
    },
  });
  if (!lead) notFound();

  const [activities, sources, campaigns] = await Promise.all([
    db.activity.findMany({
      where: { leadId: lead.id },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { user: { select: { name: true } } },
    }),
    db.leadSource.findMany({ orderBy: [{ sortOrder: "asc" }], select: { id: true, name: true } }),
    db.campaign.findMany({ where: { deletedAt: null }, orderBy: { createdAt: "desc" }, select: { id: true, name: true } }),
  ]);

  const canEdit = canEditLead(user, lead);
  const b = lead.business;
  const phone = lead.contact?.phone ?? b.contacts.find((c) => c.phone)?.phone ?? null;
  const breakdown = scoreBreakdown({ ...lead, branchCount: b.branchCount, instagram: b.instagram, website: b.website });
  const views = activities.map(describeActivity);

  // Group timeline by day
  const groups: { day: Date; items: typeof views }[] = [];
  for (const v of views) {
    const g = groups[groups.length - 1];
    if (g && isSameDay(g.day, v.createdAt)) g.items.push(v);
    else groups.push({ day: v.createdAt, items: [v] });
  }

  const core = {
    id: lead.id,
    name: b.name,
    businessId: b.id,
    status: lead.status,
    value: lead.value,
    demoDate: lead.demoDate?.toISOString() ?? null,
    ownerId: lead.ownerId,
    tel: telHref(phone),
    whatsapp: whatsappHref(phone, `Merhaba ${lead.contact?.name?.split(" ")[0] ?? ""}, BUYUR'dan yazıyorum.`),
  };

  return (
    <>
      <Link href="/leads" className="mb-3 inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> Leads
      </Link>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">{b.name}</h1>
            <LeadStatusBadge status={lead.status} />
            <ScoreBadge score={lead.score} />
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              {lead.owner ? (
                <>
                  <Avatar name={lead.owner.name} className="size-5 text-[9px]" /> {lead.owner.name}
                </>
              ) : (
                "Unassigned"
              )}
            </span>
            {lead.value > 0 && <span className="font-medium text-foreground tabular">{fmtMoney(lead.value)}</span>}
            {lead.demoDate && (
              <span className="inline-flex items-center gap-1">
                <CalendarClock className="size-3.5" /> Demo {fmtSmartDate(lead.demoDate)}
              </span>
            )}
            {lead.lostReason && lead.status === "LOST" && <span>Lost: {lead.lostReason}</span>}
          </div>
        </div>
        <LeadQuickActions
          lead={core}
          canEdit={canEdit}
          isAdmin={user.role === "ADMIN"}
          contacts={b.contacts.map((c) => ({ id: c.id, name: c.name, phone: c.phone }))}
          sources={sources}
          campaigns={campaigns}
          edit={{
            id: lead.id,
            ownerId: lead.ownerId,
            sourceId: lead.sourceId,
            campaignId: lead.campaignId,
            contactId: lead.contactId,
            value: lead.value,
            proposalInterest: lead.proposalInterest,
            demoDate: lead.demoDate?.toISOString() ?? null,
            notes: lead.notes,
          }}
        />
      </div>

      {!canEdit && (
        <p className="mb-4 rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-[13px] text-warning">
          This lead belongs to {lead.owner?.name ?? "another rep"}. You can add notes and tasks; stage and follow-up changes are limited to the owner and admins.
        </p>
      )}

      <Card className="mb-4 p-2">
        <StageProgress lead={core} canEdit={canEdit} />
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardHeader title="Follow-ups" description={lead.followUps.length ? `${lead.followUps.length} open` : "Nothing scheduled"} />
            {lead.followUps.length === 0 ? (
              <p className="px-4 py-4 text-[13px] text-muted-foreground">No open follow-ups. Use “Follow-up” above to schedule the next touch.</p>
            ) : (
              lead.followUps.map((f) => (
                <FollowUpRow
                  key={f.id}
                  showLead={false}
                  canCancel={canEdit}
                  f={{ id: f.id, dueAt: f.dueAt.toISOString(), note: f.note, leadId: lead.id, leadName: b.name, ownerName: f.owner.name }}
                />
              ))
            )}
          </Card>

          <Card>
            <CardHeader title="Activity timeline" description={`${activities.length} events`} />
            <NoteComposer leadId={lead.id} />
            {groups.length === 0 ? (
              <EmptyState title="No activity yet" />
            ) : (
              groups.map((g) => (
                <div key={g.day.toISOString()}>
                  <p className="sticky top-14 z-10 border-b bg-subtle px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {format(g.day, "EEE, d MMM yyyy")}
                  </p>
                  <ActivityFeed items={g.items} showTarget={false} />
                </div>
              ))
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader
              title="Details"
              action={
                <Link href={`/businesses/${b.id}`} className="inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:underline">
                  <Building2 className="size-3.5" /> Business
                </Link>
              }
            />
            <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-2.5 px-4 py-3 text-[13px]">
              <dt className="text-muted-foreground">Contact</dt>
              <dd>
                {lead.contact?.name ?? "—"}
                {lead.contact?.role && <span className="text-muted-foreground"> · {lead.contact.role}</span>}
              </dd>
              <dt className="text-muted-foreground">Phone</dt>
              <dd>
                {phone ? (
                  <a href={core.tel ?? undefined} className="inline-flex items-center gap-1 tabular hover:text-primary">
                    <Phone className="size-3 text-muted-foreground" /> {phone}
                  </a>
                ) : (
                  "—"
                )}
              </dd>
              <dt className="text-muted-foreground">Email</dt>
              <dd className="truncate">
                {lead.contact?.email ? (
                  <a href={`mailto:${lead.contact.email}`} className="inline-flex items-center gap-1 hover:text-primary">
                    <Mail className="size-3 text-muted-foreground" /> {lead.contact.email}
                  </a>
                ) : (
                  "—"
                )}
              </dd>
              <dt className="text-muted-foreground">Instagram</dt>
              <dd className="truncate">
                {b.instagram ? (
                  <a href={instagramHref(b.instagram)!} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-primary">
                    <AtSign className="size-3 text-muted-foreground" /> {b.instagram}
                  </a>
                ) : (
                  "—"
                )}
              </dd>
              <dt className="text-muted-foreground">Website</dt>
              <dd className="truncate">
                {b.website ? (
                  <a href={websiteHref(b.website)!} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-primary">
                    <Globe className="size-3 text-muted-foreground" /> {b.website} <ExternalLink className="size-3" />
                  </a>
                ) : (
                  "—"
                )}
              </dd>
              <dt className="text-muted-foreground">Location</dt>
              <dd>
                {b.district || b.city ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3 text-muted-foreground" /> {[b.district, b.city].filter(Boolean).join(", ")}
                  </span>
                ) : (
                  "—"
                )}
              </dd>
              <dt className="text-muted-foreground">Type</dt>
              <dd>{label(BUSINESS_TYPE_LABELS, b.type)}</dd>
              <dt className="text-muted-foreground">Branches</dt>
              <dd className="tabular">{b.branchCount}</dd>
              <dt className="text-muted-foreground">Source</dt>
              <dd>{lead.source?.name ?? "—"}</dd>
              <dt className="text-muted-foreground">Campaign</dt>
              <dd>{lead.campaign ? <Link href={`/campaigns/${lead.campaign.id}`} className="hover:text-primary">{lead.campaign.name}</Link> : "—"}</dd>
              <dt className="text-muted-foreground">Est. value</dt>
              <dd className="tabular">{lead.value ? fmtMoney(lead.value) : "—"}</dd>
              <dt className="text-muted-foreground">Created</dt>
              <dd>{fmtDateTime(lead.createdAt)}</dd>
              {lead.wonAt && lead.status === "WON" && (
                <>
                  <dt className="text-muted-foreground">Won</dt>
                  <dd>{fmtDate(lead.wonAt)}</dd>
                </>
              )}
            </dl>
            {lead.notes && (
              <div className="border-t px-4 py-3">
                <p className="mb-1 text-[11px] font-semibold uppercase text-muted-foreground">Notes</p>
                <p className="whitespace-pre-line text-[13px]">{lead.notes}</p>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Lead score" action={<ScoreBadge score={lead.score} />} />
            <ul className="px-4 py-3 text-[13px]">
              {breakdown.length === 0 && <li className="text-muted-foreground">No scoring signals yet.</li>}
              {breakdown.map((r) => (
                <li key={r.label} className="flex justify-between py-0.5">
                  <span>{r.label}</span>
                  <span className="font-medium text-success tabular">+{r.points}</span>
                </li>
              ))}
              <li className="mt-1 border-t pt-1.5 text-[11.5px] text-muted-foreground">Capped at {LEAD_SCORE_RULES.max}. Rules are defined centrally.</li>
            </ul>
          </Card>

          <Card>
            <CardHeader title="Open tasks" />
            <TaskList
              compact
              tasks={lead.tasks.map((t) => ({
                id: t.id,
                title: t.title,
                description: t.description,
                status: t.status,
                priority: t.priority,
                dueAt: t.dueAt?.toISOString() ?? null,
                ownerId: t.ownerId,
                ownerName: t.owner?.name ?? null,
                lead: t.lead ? { id: t.lead.id, label: t.lead.business.name } : null,
                business: t.business ? { id: t.business.id, label: t.business.name } : null,
              }))}
              emptyText="No open tasks for this lead."
            />
          </Card>

          {b.contacts.length > 1 && (
            <Card>
              <CardHeader title="Other contacts" />
              <ul className="divide-y text-[13px]">
                {b.contacts
                  .filter((c) => c.id !== lead.contactId)
                  .map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-2 px-4 py-2">
                      <span>
                        {c.name}
                        {c.role && <span className="text-muted-foreground"> · {c.role}</span>}
                      </span>
                      {c.phone && (
                        <a href={telHref(c.phone) ?? undefined} className="text-muted-foreground tabular hover:text-primary">
                          {c.phone}
                        </a>
                      )}
                    </li>
                  ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}


import Link from "next/link";
import { subDays } from "date-fns";
import type { Prisma } from "@prisma/client";
import { Phone, Users } from "lucide-react";
import { db } from "@/lib/db";
import { requireModulePage } from "@/lib/auth";
import { refreshStaleScores } from "@/lib/lead-sync";
import { LEAD_STATUSES, LEAD_STATUS_LABELS, PAGE_SIZE } from "@/lib/constants";
import { fmtDate, fmtMoneyCompact, fmtRelative, fmtSmartDate } from "@/lib/format";
import { fold, telHref } from "@/lib/utils";
import { Card, EmptyState, PageHeader, Avatar } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead } from "@/components/ui/table";
import { ClickableRow, NewLeadButton } from "@/components/app/buttons";
import { LeadStatusBadge, ScoreBadge } from "@/components/app/display";
import { Pagination, ParamSelect, SearchInput, SegmentLinks } from "@/components/app/url-controls";

export const metadata = { title: "Leads" };

type SP = Record<string, string | undefined>;

const SORTS: Record<string, { label: string; orderBy: Prisma.LeadOrderByWithRelationInput[] }> = {
  newest: { label: "Newest", orderBy: [{ createdAt: "desc" }] },
  oldest: { label: "Oldest", orderBy: [{ createdAt: "asc" }] },
  score: { label: "Highest score", orderBy: [{ score: "desc" }, { createdAt: "desc" }] },
  activity: { label: "Last activity", orderBy: [{ lastActivityAt: { sort: "desc", nulls: "last" } }] },
  followup: { label: "Next follow-up", orderBy: [{ nextFollowUpAt: { sort: "asc", nulls: "last" } }] },
};

export default async function LeadsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireModulePage("leads");
  const sp = await searchParams;
  await refreshStaleScores();

  const page = Math.max(1, Number(sp.page) || 1);
  const sort = SORTS[sp.sort ?? ""] ? sp.sort! : "newest";
  const scope = sp.scope === "mine" ? "mine" : "all";
  const statusFilter = sp.status === "open" ? "open" : (LEAD_STATUSES as readonly string[]).includes(sp.status ?? "") ? sp.status : null;

  const where: Prisma.LeadWhereInput = { deletedAt: null };
  if (scope === "mine") where.ownerId = user.id;
  else if (sp.owner === "unassigned") where.ownerId = null;
  else if (sp.owner) where.ownerId = sp.owner;
  if (statusFilter === "open") where.status = { notIn: ["WON", "LOST"] };
  else if (statusFilter) where.status = statusFilter;
  if (sp.source) where.sourceId = sp.source === "none" ? null : sp.source;
  if (sp.campaign) where.campaignId = sp.campaign;
  if (sp.created) {
    const days = { "7d": 7, "30d": 30, "90d": 90 }[sp.created];
    if (days) where.createdAt = { gte: subDays(new Date(), days) };
  }
  if (sp.score) {
    const ranges: Record<string, Prisma.IntFilter> = { high: { gte: 60 }, mid: { gte: 30, lt: 60 }, low: { lt: 30 } };
    if (ranges[sp.score]) where.score = ranges[sp.score];
  }
  const q = fold(sp.q);
  if (q) {
    const digits = (sp.q ?? "").replace(/\D/g, "");
    where.OR = [{ searchKey: { contains: q } }, ...(digits.length >= 3 ? [{ searchKey: { contains: digits } }] : [])];
  }

  const [total, leads, owners, sources, mineCount, allCount] = await Promise.all([
    db.lead.count({ where }),
    db.lead.findMany({
      where,
      orderBy: SORTS[sort]!.orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        business: { select: { name: true, city: true, district: true } },
        contact: { select: { name: true, phone: true } },
        owner: { select: { name: true } },
        source: { select: { name: true } },
      },
    }),
    db.user.findMany({ where: { role: { in: ["SALES", "ADMIN"] } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.leadSource.findMany({ orderBy: [{ sortOrder: "asc" }] }),
    db.lead.count({ where: { deletedAt: null, ownerId: user.id } }),
    db.lead.count({ where: { deletedAt: null } }),
  ]);
  const pageCount = Math.ceil(total / PAGE_SIZE);
  const now = Date.now();

  return (
    <>
      <PageHeader
        title="Leads"
        description="Every restaurant opportunity in one list. Click a row for the full timeline."
        actions={<NewLeadButton />}
      />
      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <SegmentLinks
            param="scope"
            fallback="all"
            options={[
              { value: "all", label: "All leads", count: allCount },
              { value: "mine", label: "My leads", count: mineCount },
            ]}
          />
          <SearchInput placeholder="Business, contact, phone, email…" className="w-full sm:w-64" />
          <ParamSelect
            param="status"
            placeholder="Any status"
            options={[{ value: "open", label: "Open (not won/lost)" }, ...LEAD_STATUSES.map((s) => ({ value: s, label: LEAD_STATUS_LABELS[s] }))]}
          />
          {scope === "all" && (
            <ParamSelect
              param="owner"
              placeholder="Any owner"
              options={[{ value: "unassigned", label: "Unassigned" }, ...owners.map((o) => ({ value: o.id, label: o.name }))]}
            />
          )}
          <ParamSelect param="source" placeholder="Any source" options={sources.map((s) => ({ value: s.id, label: s.name }))} />
          <ParamSelect
            param="created"
            placeholder="Any date"
            options={[
              { value: "7d", label: "Created · 7 days" },
              { value: "30d", label: "Created · 30 days" },
              { value: "90d", label: "Created · 90 days" },
            ]}
          />
          <ParamSelect
            param="score"
            placeholder="Any score"
            options={[
              { value: "high", label: "Score 60+" },
              { value: "mid", label: "Score 30–59" },
              { value: "low", label: "Score < 30" },
            ]}
          />
          <div className="ml-auto flex items-center gap-2 text-[12.5px] text-muted-foreground">
            Sort
            <ParamSelect param="sort" placeholder="Newest" options={Object.entries(SORTS).filter(([k]) => k !== "newest").map(([k, v]) => ({ value: k, label: v.label }))} />
          </div>
        </div>

        {leads.length === 0 ? (
          <EmptyState
            icon={<Users />}
            title={allCount === 0 ? "No leads yet" : "No leads match these filters"}
            description={allCount === 0 ? "Add your first restaurant lead — it only takes a business name and phone." : "Try clearing a filter or searching for something else."}
            action={allCount === 0 ? <NewLeadButton /> : undefined}
          />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Business</TH>
                <TH>Contact</TH>
                <TH>Phone</TH>
                <TH>Source</TH>
                <TH>Owner</TH>
                <TH>Status</TH>
                <TH className="text-center">Score</TH>
                <TH className="text-right">Value</TH>
                <TH>Last activity</TH>
                <TH>Next follow-up</TH>
                <TH>Created</TH>
              </tr>
            </THead>
            <TBody>
              {leads.map((l) => {
                const tel = telHref(l.contact?.phone);
                const overdue = l.nextFollowUpAt && l.nextFollowUpAt.getTime() < now;
                return (
                  <ClickableRow key={l.id} href={`/leads/${l.id}`}>
                    <TD className="max-w-[220px]">
                      <Link href={`/leads/${l.id}`} className="block truncate font-medium hover:text-primary">
                        {l.business.name}
                      </Link>
                      <span className="block truncate text-[11.5px] text-muted-foreground">
                        {[l.business.district, l.business.city].filter(Boolean).join(", ") || "—"}
                      </span>
                    </TD>
                    <TD className="max-w-[160px] truncate">{l.contact?.name ?? "—"}</TD>
                    <TD className="whitespace-nowrap">
                      {tel ? (
                        <a href={tel} className="inline-flex items-center gap-1 tabular hover:text-primary">
                          <Phone className="size-3 text-muted-foreground" />
                          {l.contact?.phone}
                        </a>
                      ) : (
                        "—"
                      )}
                    </TD>
                    <TD className="whitespace-nowrap text-muted-foreground">{l.source?.name ?? "—"}</TD>
                    <TD className="whitespace-nowrap">
                      {l.owner ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Avatar name={l.owner.name} className="size-5 text-[9px]" />
                          {l.owner.name.split(" ")[0]}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Unassigned</span>
                      )}
                    </TD>
                    <TD>
                      <LeadStatusBadge status={l.status} />
                    </TD>
                    <TD className="text-center">
                      <ScoreBadge score={l.score} />
                    </TD>
                    <TD className="whitespace-nowrap text-right tabular">{l.value ? fmtMoneyCompact(l.value) : "—"}</TD>
                    <TD className="whitespace-nowrap text-muted-foreground">{l.lastActivityAt ? fmtRelative(l.lastActivityAt) : "—"}</TD>
                    <TD className="whitespace-nowrap">
                      {l.nextFollowUpAt ? (
                        <span className={overdue ? "font-medium text-destructive" : ""}>{fmtSmartDate(l.nextFollowUpAt)}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TD>
                    <TD className="whitespace-nowrap text-muted-foreground">{fmtDate(l.createdAt, "d MMM")}</TD>
                  </ClickableRow>
                );
              })}
            </TBody>
          </Table>
        )}
        {total > 0 && <Pagination page={page} pageCount={pageCount} total={total} />}
      </Card>
    </>
  );
}

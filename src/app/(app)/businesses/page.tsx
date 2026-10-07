import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Building2 } from "lucide-react";
import { db } from "@/lib/db";
import { requireModulePage } from "@/lib/auth";
import { BUSINESS_STATUSES, BUSINESS_STATUS_LABELS, BUSINESS_TYPES, BUSINESS_TYPE_LABELS, PAGE_SIZE, label } from "@/lib/constants";
import { fmtDate } from "@/lib/format";
import { fold } from "@/lib/utils";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead } from "@/components/ui/table";
import { ClickableRow, NewBusinessButton } from "@/components/app/buttons";
import { LeadStatusBadge } from "@/components/app/display";
import { Pagination, ParamSelect, SearchInput } from "@/components/app/url-controls";

export const metadata = { title: "Businesses" };

export default async function BusinessesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireModulePage("businesses");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);

  const where: Prisma.BusinessWhereInput = { deletedAt: null };
  const q = fold(sp.q);
  if (q) where.OR = [{ searchKey: { contains: q } }, { contacts: { some: { searchKey: { contains: q } } } }];
  if (sp.status) where.status = sp.status;
  if (sp.type) where.type = sp.type;
  if (sp.city) where.city = sp.city;

  const [total, rows, cities] = await Promise.all([
    db.business.count({ where }),
    db.business.findMany({
      where,
      orderBy: sp.sort === "name" ? { name: "asc" } : { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        contacts: { where: { isPrimary: true }, take: 1, select: { name: true, phone: true } },
        leads: { where: { deletedAt: null }, orderBy: { updatedAt: "desc" }, take: 1, select: { status: true } },
        _count: { select: { contacts: true, leads: { where: { deletedAt: null } } } },
      },
    }),
    db.business.findMany({ where: { deletedAt: null, city: { not: null } }, select: { city: true }, distinct: ["city"], orderBy: { city: "asc" } }),
  ]);

  return (
    <>
      <PageHeader title="Businesses" description="Restaurants & cafes — each can have several contacts and deals." actions={<NewBusinessButton />} />
      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <SearchInput placeholder="Name, city, contact, phone…" className="w-full sm:w-64" />
          <ParamSelect param="status" placeholder="Any status" options={BUSINESS_STATUSES.map((s) => ({ value: s, label: BUSINESS_STATUS_LABELS[s] }))} />
          <ParamSelect param="type" placeholder="Any type" options={BUSINESS_TYPES.map((s) => ({ value: s, label: BUSINESS_TYPE_LABELS[s] }))} />
          <ParamSelect param="city" placeholder="Any city" options={cities.map((c) => ({ value: c.city!, label: c.city! }))} />
          <div className="ml-auto">
            <ParamSelect param="sort" placeholder="Newest" options={[{ value: "name", label: "Name A–Z" }]} />
          </div>
        </div>
        {rows.length === 0 ? (
          <EmptyState icon={<Building2 />} title="No businesses found" description="Create one, or adjust the filters." action={<NewBusinessButton />} />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Name</TH>
                <TH>Type</TH>
                <TH>Location</TH>
                <TH className="text-center">Branches</TH>
                <TH>Primary contact</TH>
                <TH>Status</TH>
                <TH>Latest deal</TH>
                <TH className="text-center">Contacts</TH>
                <TH>Created</TH>
              </tr>
            </THead>
            <TBody>
              {rows.map((b) => (
                <ClickableRow key={b.id} href={`/businesses/${b.id}`}>
                  <TD className="font-medium">
                    <Link href={`/businesses/${b.id}`} className="hover:text-primary">
                      {b.name}
                    </Link>
                  </TD>
                  <TD className="whitespace-nowrap text-muted-foreground">{label(BUSINESS_TYPE_LABELS, b.type)}</TD>
                  <TD className="whitespace-nowrap">{[b.district, b.city].filter(Boolean).join(", ") || "—"}</TD>
                  <TD className="text-center tabular">{b.branchCount}</TD>
                  <TD className="whitespace-nowrap">
                    {b.contacts[0] ? (
                      <>
                        {b.contacts[0].name}
                        {b.contacts[0].phone && <span className="ml-1.5 text-muted-foreground tabular">{b.contacts[0].phone}</span>}
                      </>
                    ) : (
                      "—"
                    )}
                  </TD>
                  <TD>
                    <Badge tone={b.status === "CUSTOMER" ? "green" : b.status === "CHURNED" ? "outline" : "neutral"}>{label(BUSINESS_STATUS_LABELS, b.status)}</Badge>
                  </TD>
                  <TD>{b.leads[0] ? <LeadStatusBadge status={b.leads[0].status} /> : <span className="text-muted-foreground">—</span>}</TD>
                  <TD className="text-center tabular text-muted-foreground">{b._count.contacts}</TD>
                  <TD className="whitespace-nowrap text-muted-foreground">{fmtDate(b.createdAt, "d MMM yyyy")}</TD>
                </ClickableRow>
              ))}
            </TBody>
          </Table>
        )}
        {total > 0 && <Pagination page={page} pageCount={Math.ceil(total / PAGE_SIZE)} total={total} />}
      </Card>
    </>
  );
}

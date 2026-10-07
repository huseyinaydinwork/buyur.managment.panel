import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireModulePage } from "@/lib/auth";
import { CONTENT_PLATFORMS, CONTENT_PLATFORM_LABELS } from "@/lib/constants";
import { fmtNumber } from "@/lib/format";
import { PageHeader } from "@/components/ui/misc";
import { NewContentButton } from "@/components/app/buttons";
import { ContentBoard } from "@/components/app/content-board";
import { KpiCard } from "@/components/app/display";
import { ParamSelect, SegmentLinks } from "@/components/app/url-controls";

export const metadata = { title: "Content" };

export default async function ContentPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireModulePage("content");
  const sp = await searchParams;
  const view = sp.view === "table" ? "table" : "board";
  const where: Prisma.ContentWhereInput = {};
  if (sp.platform) where.platform = sp.platform;
  if (sp.campaign) where.campaignId = sp.campaign;

  const [items, campaigns] = await Promise.all([
    db.content.findMany({
      where,
      orderBy: [{ publishAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
      include: { campaign: { select: { name: true } }, owner: { select: { name: true } } },
    }),
    db.campaign.findMany({ where: { deletedAt: null }, select: { id: true, name: true }, orderBy: { createdAt: "desc" } }),
  ]);
  const published = items.filter((i) => i.status === "PUBLISHED");
  const sum = (k: "views" | "likes" | "leadsGenerated") => published.reduce((s, i) => s + i[k], 0);

  return (
    <>
      <PageHeader title="Content" description="Idea → published. Drag cards to move them through the pipeline." actions={<NewContentButton />}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard label="In production" value={String(items.length - published.length)} />
          <KpiCard label="Published" value={String(published.length)} />
          <KpiCard label="Total views" value={fmtNumber(sum("views"))} hint={`${fmtNumber(sum("likes"))} likes`} />
          <KpiCard label="Leads generated" value={String(sum("leadsGenerated"))} hint="self-reported per post" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SegmentLinks param="view" fallback="board" options={[{ value: "board", label: "Board" }, { value: "table", label: "Table" }]} />
          <ParamSelect param="platform" placeholder="Any platform" options={CONTENT_PLATFORMS.map((p) => ({ value: p, label: CONTENT_PLATFORM_LABELS[p] }))} />
          <ParamSelect param="campaign" placeholder="Any campaign" options={campaigns.map((c) => ({ value: c.id, label: c.name }))} />
        </div>
      </PageHeader>
      <ContentBoard
        view={view}
        items={items.map((i) => ({
          id: i.id,
          title: i.title,
          platform: i.platform,
          format: i.format,
          campaignId: i.campaignId,
          ownerId: i.ownerId,
          status: i.status,
          publishAt: i.publishAt?.toISOString() ?? null,
          url: i.url,
          views: i.views,
          likes: i.likes,
          saves: i.saves,
          shares: i.shares,
          leadsGenerated: i.leadsGenerated,
          notes: i.notes,
          campaignName: i.campaign?.name ?? null,
          ownerName: i.owner?.name ?? null,
        }))}
      />
    </>
  );
}

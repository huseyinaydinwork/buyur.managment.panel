import { db } from "@/lib/db";
import { requireModulePage } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/misc";
import { PlaybookBrowser } from "@/components/app/playbook";

export const metadata = { title: "Sales Playbook" };

export default async function PlaybookPage({ searchParams }: { searchParams: Promise<{ cat?: string }> }) {
  const user = await requireModulePage("playbook");
  const { cat } = await searchParams;
  const entries = await db.playbookEntry.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, category: true, stage: true, title: true, body: true },
  });
  return (
    <>
      <PageHeader
        title="Sales Playbook"
        description="Call scripts, WhatsApp messages, objection handling and the habits that win deals. Open “Scripts” on any lead to get them pre-filled."
      />
      <PlaybookBrowser entries={entries} canEdit={can(user, "admin")} initialCategory={cat ?? "CALL"} />
    </>
  );
}

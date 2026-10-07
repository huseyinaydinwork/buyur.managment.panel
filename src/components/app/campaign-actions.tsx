"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { deleteCampaign } from "@/actions/marketing";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { CampaignDialog, type CampaignFormValue } from "./forms/marketing-forms";
import { useAction } from "./use-action";

export function CampaignActions({ campaign }: { campaign: CampaignFormValue }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<null | "edit" | "delete">(null);
  const { run, pending } = useAction();
  return (
    <div className="flex gap-1.5">
      <Button size="sm" variant="outline" onClick={() => setDialog("edit")}>
        <Pencil /> Edit / update spend
      </Button>
      <Button size="icon-sm" variant="ghost" onClick={() => setDialog("delete")} aria-label="Delete campaign">
        <Trash2 />
      </Button>
      <CampaignDialog key={String(dialog === "edit")} open={dialog === "edit"} onOpenChange={(o) => setDialog(o ? "edit" : null)} campaign={campaign} />
      <ConfirmDialog
        open={dialog === "delete"}
        onOpenChange={(o) => setDialog(o ? "delete" : null)}
        title={`Delete “${campaign.name}”?`}
        description="Linked leads keep their data but lose the campaign attribution in lists."
        loading={pending}
        onConfirm={() => run(() => deleteCampaign(campaign.id), { success: "Campaign deleted", onSuccess: () => router.push("/campaigns") })}
      />
    </div>
  );
}

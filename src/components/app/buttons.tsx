"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { BusinessDialog } from "./forms/business-form";
import { LeadCreateDialog } from "./forms/lead-form";
import { CampaignDialog, ContentDialog } from "./forms/marketing-forms";
import { TaskDialog } from "./forms/task-form";
import type { PickerOption } from "./entity-picker";

type Common = { label?: string; size?: ButtonProps["size"]; variant?: ButtonProps["variant"] };

export function NewLeadButton({
  label = "New lead",
  size = "sm",
  variant,
  business,
  contacts,
  campaignId,
}: Common & {
  business?: { id: string; name: string };
  contacts?: { id: string; name: string; phone: string | null }[];
  campaignId?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size={size} variant={variant} onClick={() => setOpen(true)}>
        <Plus /> {label}
      </Button>
      <LeadCreateDialog key={String(open)} open={open} onOpenChange={setOpen} business={business} contacts={contacts} defaultCampaignId={campaignId} />
    </>
  );
}

export function NewBusinessButton({ label = "New business", size = "sm", variant }: Common) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size={size} variant={variant} onClick={() => setOpen(true)}>
        <Plus /> {label}
      </Button>
      <BusinessDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

export function NewTaskButton({
  label = "New task",
  size = "sm",
  variant,
  lead,
  business,
}: Common & { lead?: PickerOption; business?: PickerOption }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size={size} variant={variant} onClick={() => setOpen(true)}>
        <Plus /> {label}
      </Button>
      <TaskDialog key={String(open)} open={open} onOpenChange={setOpen} defaultLead={lead} defaultBusiness={business} />
    </>
  );
}

export function NewCampaignButton({ label = "New campaign", size = "sm", variant }: Common) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size={size} variant={variant} onClick={() => setOpen(true)}>
        <Plus /> {label}
      </Button>
      <CampaignDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

export function NewContentButton({ label = "New content", size = "sm", variant }: Common) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size={size} variant={variant} onClick={() => setOpen(true)}>
        <Plus /> {label}
      </Button>
      <ContentDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

/** Table row that navigates on click (links inside still work normally). */
export function ClickableRow({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) {
  const router = useRouter();
  return (
    <tr
      className={`cursor-pointer border-b transition-colors hover:bg-subtle/70 ${className ?? ""}`}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("a,button,input,select")) return;
        if (e.metaKey || e.ctrlKey) window.open(href, "_blank");
        else router.push(href);
      }}
    >
      {children}
    </tr>
  );
}

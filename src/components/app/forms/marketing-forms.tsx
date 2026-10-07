"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saveCampaign, saveContent } from "@/actions/marketing";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import {
  CAMPAIGN_CHANNELS,
  CAMPAIGN_CHANNEL_LABELS,
  CAMPAIGN_STATUSES,
  CAMPAIGN_STATUS_LABELS,
  CONTENT_FORMATS,
  CONTENT_FORMAT_LABELS,
  CONTENT_PLATFORMS,
  CONTENT_PLATFORM_LABELS,
  CONTENT_STATUSES,
  CONTENT_STATUS_LABELS,
} from "@/lib/constants";
import { toInputDate, toInputDateTime } from "@/lib/format";
import { useAppData } from "../app-context";
import { formValues, useAction } from "../use-action";

export type CampaignFormValue = {
  id: string;
  name: string;
  description: string | null;
  channel: string;
  startDate: Date | string | null;
  endDate: Date | string | null;
  budget: number;
  spend: number;
  ownerId: string | null;
  status: string;
};

export function CampaignDialog({
  open,
  onOpenChange,
  campaign,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  campaign?: CampaignFormValue | null;
}) {
  const router = useRouter();
  const { user, users } = useAppData();
  const { run, pending, fieldErrors: fe, setFieldErrors } = useAction();
  const close = (o: boolean) => {
    if (!o) setFieldErrors({});
    onOpenChange(o);
  };
  const c = campaign;
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    run(() => saveCampaign({ ...formValues(e.currentTarget), id: c?.id ?? null }), {
      onSuccess: ({ id }) => {
        close(false);
        if (c) toast.success("Campaign updated");
        else toast.success("Campaign created", { action: { label: "Open", onClick: () => router.push(`/campaigns/${id}`) } });
      },
    });
  };
  const marketers = users.filter((u) => u.role === "MARKETING" || u.role === "ADMIN");
  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent title={c ? "Edit campaign" : "New campaign"} size="lg">
        <form onSubmit={onSubmit} noValidate className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Name" required htmlFor="cp-name" error={fe.name} className="sm:col-span-2">
            <Input id="cp-name" name="name" autoFocus defaultValue={c?.name} placeholder="e.g. October Acquisition" />
          </Field>
          <Field label="Channel" required htmlFor="cp-ch" error={fe.channel}>
            <Select id="cp-ch" name="channel" defaultValue={c?.channel ?? "META_ADS"}>
              {CAMPAIGN_CHANNELS.map((ch) => (
                <option key={ch} value={ch}>
                  {CAMPAIGN_CHANNEL_LABELS[ch]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status" htmlFor="cp-st" error={fe.status}>
            <Select id="cp-st" name="status" defaultValue={c?.status ?? "DRAFT"}>
              {CAMPAIGN_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {CAMPAIGN_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Start date" htmlFor="cp-sd" error={fe.startDate}>
            <Input id="cp-sd" name="startDate" type="date" defaultValue={toInputDate(c?.startDate)} />
          </Field>
          <Field label="End date" htmlFor="cp-ed" error={fe.endDate}>
            <Input id="cp-ed" name="endDate" type="date" defaultValue={toInputDate(c?.endDate)} />
          </Field>
          <Field label="Budget (₺)" htmlFor="cp-bu" error={fe.budget}>
            <Input id="cp-bu" name="budget" inputMode="numeric" defaultValue={c?.budget || ""} />
          </Field>
          <Field label="Spend to date (₺)" htmlFor="cp-sp" error={fe.spend} hint="Actual spend — CPL, CAC and ROAS are derived from this.">
            <Input id="cp-sp" name="spend" inputMode="numeric" defaultValue={c?.spend || ""} />
          </Field>
          <Field label="Owner" htmlFor="cp-own" error={fe.ownerId}>
            <Select id="cp-own" name="ownerId" defaultValue={c?.ownerId ?? user.id}>
              {(marketers.length ? marketers : users).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Description" htmlFor="cp-desc" error={fe.description} className="sm:col-span-2">
            <Textarea id="cp-desc" name="description" defaultValue={c?.description ?? ""} rows={3} />
          </Field>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => close(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              {c ? "Save" : "Create campaign"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export type ContentFormValue = {
  id: string;
  title: string;
  platform: string;
  format: string;
  campaignId: string | null;
  ownerId: string | null;
  status: string;
  publishAt: Date | string | null;
  url: string | null;
  views: number;
  likes: number;
  saves: number;
  shares: number;
  leadsGenerated: number;
  notes: string | null;
};

export function ContentDialog({
  open,
  onOpenChange,
  content,
  defaultStatus,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  content?: ContentFormValue | null;
  defaultStatus?: string;
}) {
  const { user, users, campaigns } = useAppData();
  const { run, pending, fieldErrors: fe, setFieldErrors } = useAction();
  const close = (o: boolean) => {
    if (!o) setFieldErrors({});
    onOpenChange(o);
  };
  const c = content;
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    run(() => saveContent({ ...formValues(e.currentTarget), id: c?.id ?? null }), {
      success: c ? "Content updated" : "Content created",
      onSuccess: () => close(false),
    });
  };
  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent title={c ? "Edit content" : "New content"} size="lg">
        <form onSubmit={onSubmit} noValidate className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="Title" required htmlFor="ct-title" error={fe.title} className="col-span-2 sm:col-span-4">
            <Input id="ct-title" name="title" autoFocus defaultValue={c?.title} placeholder="e.g. QR menü 5 dakikada kurulum reels" />
          </Field>
          <Field label="Platform" htmlFor="ct-pl" error={fe.platform}>
            <Select id="ct-pl" name="platform" defaultValue={c?.platform ?? "INSTAGRAM"}>
              {CONTENT_PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {CONTENT_PLATFORM_LABELS[p]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Format" htmlFor="ct-fm" error={fe.format}>
            <Select id="ct-fm" name="format" defaultValue={c?.format ?? "REEL"}>
              {CONTENT_FORMATS.map((f) => (
                <option key={f} value={f}>
                  {CONTENT_FORMAT_LABELS[f]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status" htmlFor="ct-st" error={fe.status}>
            <Select id="ct-st" name="status" defaultValue={c?.status ?? defaultStatus ?? "IDEA"}>
              {CONTENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {CONTENT_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Publish date" htmlFor="ct-pa" error={fe.publishAt}>
            <Input id="ct-pa" name="publishAt" type="datetime-local" defaultValue={toInputDateTime(c?.publishAt)} />
          </Field>
          <Field label="Campaign" htmlFor="ct-cp" error={fe.campaignId} className="col-span-2">
            <Select id="ct-cp" name="campaignId" defaultValue={c?.campaignId ?? ""}>
              <option value="">—</option>
              {campaigns.map((cp) => (
                <option key={cp.id} value={cp.id}>
                  {cp.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Owner" htmlFor="ct-own" error={fe.ownerId} className="col-span-2">
            <Select id="ct-own" name="ownerId" defaultValue={c?.ownerId ?? user.id}>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="URL" htmlFor="ct-url" error={fe.url} className="col-span-2 sm:col-span-4">
            <Input id="ct-url" name="url" defaultValue={c?.url ?? ""} placeholder="https://instagram.com/p/…" />
          </Field>
          {(
            [
              ["views", "Views"],
              ["likes", "Likes"],
              ["saves", "Saves"],
              ["shares", "Shares"],
            ] as const
          ).map(([k, l]) => (
            <Field key={k} label={l} htmlFor={`ct-${k}`} error={fe[k]}>
              <Input id={`ct-${k}`} name={k} inputMode="numeric" defaultValue={c?.[k] || ""} />
            </Field>
          ))}
          <Field label="Leads generated" htmlFor="ct-lg" error={fe.leadsGenerated}>
            <Input id="ct-lg" name="leadsGenerated" inputMode="numeric" defaultValue={c?.leadsGenerated || ""} />
          </Field>
          <Field label="Notes" htmlFor="ct-notes" error={fe.notes} className="col-span-2 sm:col-span-3">
            <Input id="ct-notes" name="notes" defaultValue={c?.notes ?? ""} />
          </Field>
          <DialogFooter className="col-span-2 sm:col-span-4">
            <Button type="button" variant="outline" onClick={() => close(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              {c ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

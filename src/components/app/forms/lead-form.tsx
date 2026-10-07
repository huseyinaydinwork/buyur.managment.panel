"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown } from "lucide-react";
import { createLead, searchBusinessOptions } from "@/actions/leads";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { BUSINESS_TYPES, BUSINESS_TYPE_LABELS } from "@/lib/constants";
import { useAppData, useSellers } from "../app-context";
import { EntityPicker, type PickerOption } from "../entity-picker";
import { formValues, useAction } from "../use-action";

export function LeadCreateDialog({
  open,
  onOpenChange,
  business,
  contacts = [],
  defaultCampaignId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  business?: { id: string; name: string } | null;
  contacts?: { id: string; name: string; phone: string | null }[];
  defaultCampaignId?: string;
}) {
  const router = useRouter();
  const { user, sources, campaigns } = useAppData();
  const sellers = useSellers();
  const { run, pending, fieldErrors: fe, setFieldErrors } = useAction();
  const [existing, setExisting] = useState<PickerOption | null>(business ? { id: business.id, label: business.name } : null);
  const [mode, setMode] = useState<"new" | "existing">(business ? "existing" : "new");
  const [contactId, setContactId] = useState<string>(contacts.find(Boolean)?.id ?? "");
  const [more, setMore] = useState(false);
  const isSeller = sellers.some((s) => s.id === user.id);

  const close = (o: boolean) => {
    if (!o) setFieldErrors({});
    onOpenChange(o);
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const values = formValues(e.currentTarget);
    if (mode === "existing") values.businessName = null;
    else values.businessId = null;
    run(() => createLead(values), {
      onSuccess: ({ id }) => {
        toast.success("Lead created", { action: { label: "Open", onClick: () => router.push(`/leads/${id}`) } });
        close(false);
      },
    });
  };

  const showContactPicker = mode === "existing" && business && contacts.length > 0;

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent title="New lead" description="Only business name and phone are required." size="lg">
        <form onSubmit={onSubmit} noValidate className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {!business && (
            <div className="flex gap-1 rounded-md bg-muted p-0.5 text-[13px] sm:col-span-2">
              {(["new", "existing"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`flex-1 cursor-pointer rounded px-3 py-1.5 font-medium ${mode === m ? "bg-card shadow-sm" : "text-muted-foreground"}`}
                >
                  {m === "new" ? "New business" : "Existing business"}
                </button>
              ))}
            </div>
          )}

          {mode === "new" ? (
            <Field label="Business name" required htmlFor="l-bn" error={fe.businessName}>
              <Input id="l-bn" name="businessName" autoFocus placeholder="e.g. Minoa Cafe" />
            </Field>
          ) : (
            <Field label="Business" required error={fe.businessId}>
              <EntityPicker
                name="businessId"
                value={existing}
                onChange={setExisting}
                search={searchBusinessOptions}
                placeholder="Select business"
                disabled={!!business}
              />
            </Field>
          )}

          {showContactPicker ? (
            <Field label="Contact">
              <Select name="contactId" value={contactId} onChange={(e) => setContactId(e.target.value)}>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.phone ? ` · ${c.phone}` : ""}
                  </option>
                ))}
                <option value="">+ New contact</option>
              </Select>
            </Field>
          ) : (
            <Field label="Phone" required={!contactId} htmlFor="l-ph" error={fe.phone}>
              <Input id="l-ph" name="phone" type="tel" inputMode="tel" placeholder="0532 123 45 67" />
            </Field>
          )}

          {(!showContactPicker || !contactId) && (
            <>
              {showContactPicker && (
                <Field label="Phone" required htmlFor="l-ph2" error={fe.phone}>
                  <Input id="l-ph2" name="phone" type="tel" inputMode="tel" placeholder="0532 123 45 67" />
                </Field>
              )}
              <Field label="Contact name" htmlFor="l-cn" error={fe.contactName}>
                <Input id="l-cn" name="contactName" placeholder="Owner / manager" />
              </Field>
              <Field label="Email" htmlFor="l-em" error={fe.email}>
                <Input id="l-em" name="email" type="email" placeholder="name@restaurant.com" />
              </Field>
            </>
          )}

          <Field label="Source" htmlFor="l-src" error={fe.sourceId}>
            <Select id="l-src" name="sourceId" defaultValue="">
              <option value="">—</option>
              {sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Owner" htmlFor="l-own" error={fe.ownerId}>
            <Select id="l-own" name="ownerId" defaultValue={isSeller ? user.id : ""}>
              <option value="">Unassigned</option>
              {sellers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                  {u.id === user.id ? " (me)" : ""}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Estimated value (₺)" htmlFor="l-val" error={fe.value}>
            <Input id="l-val" name="value" inputMode="numeric" placeholder="e.g. 12000" />
          </Field>
          <Field label="Campaign" htmlFor="l-cmp" error={fe.campaignId}>
            <Select id="l-cmp" name="campaignId" defaultValue={defaultCampaignId ?? ""}>
              <option value="">—</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>

          {mode === "new" && (
            <button
              type="button"
              onClick={() => setMore((m) => !m)}
              className="flex cursor-pointer items-center gap-1 text-left text-[13px] font-medium text-muted-foreground hover:text-foreground sm:col-span-2"
            >
              <ChevronDown className={`size-4 transition-transform ${more ? "rotate-180" : ""}`} />
              Business details (Instagram, website, location, type, branches)
            </button>
          )}
          {mode === "new" && (
            <div className={more ? "contents" : "hidden"}>
              <Field label="Instagram" htmlFor="l-ig" error={fe.instagram}>
                <Input id="l-ig" name="instagram" placeholder="@handle" />
              </Field>
              <Field label="Website" htmlFor="l-web" error={fe.website}>
                <Input id="l-web" name="website" placeholder="restaurant.com" />
              </Field>
              <Field label="City" htmlFor="l-city" error={fe.city}>
                <Input id="l-city" name="city" placeholder="İstanbul" />
              </Field>
              <Field label="District" htmlFor="l-dist" error={fe.district}>
                <Input id="l-dist" name="district" placeholder="Kadıköy" />
              </Field>
              <Field label="Restaurant type" htmlFor="l-type" error={fe.businessType}>
                <Select id="l-type" name="businessType" defaultValue="">
                  <option value="">—</option>
                  {BUSINESS_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {BUSINESS_TYPE_LABELS[t]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Branch count" htmlFor="l-br" error={fe.branchCount}>
                <Input id="l-br" name="branchCount" type="number" min={1} defaultValue={1} />
              </Field>
            </div>
          )}

          <Field label="Notes" htmlFor="l-notes" error={fe.notes} className="sm:col-span-2">
            <Textarea id="l-notes" name="notes" rows={3} placeholder="Context, needs, how you found them…" />
          </Field>

          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => close(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              Create lead
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

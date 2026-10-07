"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saveBusiness, saveContact } from "@/actions/businesses";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/input";
import { BUSINESS_STATUSES, BUSINESS_STATUS_LABELS, BUSINESS_TYPES, BUSINESS_TYPE_LABELS } from "@/lib/constants";
import { formValues, useAction } from "../use-action";

export type BusinessFormValue = {
  id: string;
  name: string;
  type: string | null;
  city: string | null;
  district: string | null;
  address: string | null;
  instagram: string | null;
  website: string | null;
  branchCount: number;
  status: string;
  notes: string | null;
};

export function BusinessDialog({
  open,
  onOpenChange,
  business,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  business?: BusinessFormValue | null;
}) {
  const router = useRouter();
  const { run, pending, fieldErrors: fe, setFieldErrors } = useAction();
  const close = (o: boolean) => {
    if (!o) setFieldErrors({});
    onOpenChange(o);
  };
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const values = formValues(e.currentTarget);
    run(() => saveBusiness({ ...values, id: business?.id ?? null }), {
      onSuccess: ({ id }) => {
        close(false);
        if (business) toast.success("Business updated");
        else toast.success("Business created", { action: { label: "Open", onClick: () => router.push(`/businesses/${id}`) } });
      },
    });
  };
  const b = business;
  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent title={b ? "Edit business" : "New business"} description="A restaurant, cafe or group — leads and contacts live under it." size="lg">
        <form onSubmit={onSubmit} noValidate className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Name" required htmlFor="b-name" error={fe.name} className="sm:col-span-2">
            <Input id="b-name" name="name" autoFocus defaultValue={b?.name} placeholder="e.g. Lokal Kitchen" />
          </Field>
          <Field label="Type" htmlFor="b-type" error={fe.type}>
            <Select id="b-type" name="type" defaultValue={b?.type ?? ""}>
              <option value="">—</option>
              {BUSINESS_TYPES.map((t) => (
                <option key={t} value={t}>
                  {BUSINESS_TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status" htmlFor="b-status" error={fe.status}>
            <Select id="b-status" name="status" defaultValue={b?.status ?? "PROSPECT"}>
              {BUSINESS_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {BUSINESS_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="City" htmlFor="b-city" error={fe.city}>
            <Input id="b-city" name="city" defaultValue={b?.city ?? ""} placeholder="İstanbul" />
          </Field>
          <Field label="District" htmlFor="b-district" error={fe.district}>
            <Input id="b-district" name="district" defaultValue={b?.district ?? ""} placeholder="Beşiktaş" />
          </Field>
          <Field label="Address" htmlFor="b-address" error={fe.address} className="sm:col-span-2">
            <Input id="b-address" name="address" defaultValue={b?.address ?? ""} />
          </Field>
          <Field label="Instagram" htmlFor="b-ig" error={fe.instagram}>
            <Input id="b-ig" name="instagram" defaultValue={b?.instagram ?? ""} placeholder="@handle" />
          </Field>
          <Field label="Website" htmlFor="b-web" error={fe.website}>
            <Input id="b-web" name="website" defaultValue={b?.website ?? ""} placeholder="restaurant.com" />
          </Field>
          <Field label="Branch count" htmlFor="b-br" error={fe.branchCount}>
            <Input id="b-br" name="branchCount" type="number" min={1} defaultValue={b?.branchCount ?? 1} />
          </Field>
          <Field label="Notes" htmlFor="b-notes" error={fe.notes} className="sm:col-span-2">
            <Textarea id="b-notes" name="notes" defaultValue={b?.notes ?? ""} rows={3} />
          </Field>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => close(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              {b ? "Save changes" : "Create business"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export type ContactFormValue = {
  id: string;
  name: string;
  role: string | null;
  phone: string | null;
  email: string | null;
  isPrimary: boolean;
};

export function ContactDialog({
  open,
  onOpenChange,
  businessId,
  contact,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  businessId: string;
  contact?: ContactFormValue | null;
}) {
  const { run, pending, fieldErrors: fe, setFieldErrors } = useAction();
  const close = (o: boolean) => {
    if (!o) setFieldErrors({});
    onOpenChange(o);
  };
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const values = formValues(e.currentTarget);
    run(() => saveContact({ ...values, id: contact?.id ?? null, businessId }), {
      success: contact ? "Contact updated" : "Contact added",
      onSuccess: () => close(false),
    });
  };
  const c = contact;
  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent title={c ? "Edit contact" : "Add contact"}>
        <form onSubmit={onSubmit} noValidate className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Name" required htmlFor="c-name" error={fe.name}>
            <Input id="c-name" name="name" autoFocus defaultValue={c?.name} />
          </Field>
          <Field label="Role" htmlFor="c-role" error={fe.role}>
            <Input id="c-role" name="role" defaultValue={c?.role ?? ""} placeholder="Owner, Manager…" />
          </Field>
          <Field label="Phone" htmlFor="c-phone" error={fe.phone}>
            <Input id="c-phone" name="phone" type="tel" defaultValue={c?.phone ?? ""} />
          </Field>
          <Field label="Email" htmlFor="c-email" error={fe.email}>
            <Input id="c-email" name="email" type="email" defaultValue={c?.email ?? ""} />
          </Field>
          <label className="flex cursor-pointer items-center gap-2 text-sm sm:col-span-2">
            <Checkbox name="isPrimary" defaultChecked={c?.isPrimary} /> Primary contact
          </label>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => close(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              {c ? "Save" : "Add contact"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

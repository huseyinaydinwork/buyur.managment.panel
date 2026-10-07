"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Pencil, Phone, Plus, Star, Trash2, MessageCircle, Mail } from "lucide-react";
import { deleteBusiness, deleteContact } from "@/actions/businesses";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown";
import { Badge } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { telHref, whatsappHref } from "@/lib/utils";
import { BusinessDialog, ContactDialog, type BusinessFormValue, type ContactFormValue } from "./forms/business-form";
import { useAction } from "./use-action";

export function BusinessActions({ business, isAdmin }: { business: BusinessFormValue; isAdmin: boolean }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<null | "edit" | "contact" | "delete">(null);
  const { run, pending } = useAction();
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Button size="sm" variant="outline" onClick={() => setDialog("contact")}>
        <Plus /> Contact
      </Button>
      <Button size="sm" variant="outline" onClick={() => setDialog("edit")}>
        <Pencil /> Edit
      </Button>
      {isAdmin && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon-sm" variant="ghost" aria-label="More">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem destructive onSelect={() => setDialog("delete")}>
              <Trash2 /> Delete business
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <BusinessDialog key={`b-${dialog === "edit"}`} open={dialog === "edit"} onOpenChange={(o) => setDialog(o ? "edit" : null)} business={business} />
      <ContactDialog key={`c-${dialog === "contact"}`} open={dialog === "contact"} onOpenChange={(o) => setDialog(o ? "contact" : null)} businessId={business.id} />
      <ConfirmDialog
        open={dialog === "delete"}
        onOpenChange={(o) => setDialog(o ? "delete" : null)}
        title={`Delete ${business.name}?`}
        description="The business and all its leads are removed from lists and metrics."
        loading={pending}
        onConfirm={() => run(() => deleteBusiness(business.id), { success: "Business deleted", onSuccess: () => router.push("/businesses") })}
      />
    </div>
  );
}

export function ContactsTable({ businessId, contacts }: { businessId: string; contacts: ContactFormValue[] }) {
  const [editing, setEditing] = useState<ContactFormValue | null>(null);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<ContactFormValue | null>(null);
  const { run, pending } = useAction();
  return (
    <>
      <div className="flex justify-end border-b px-4 py-2">
        <Button size="xs" variant="outline" onClick={() => setAdding(true)}>
          <Plus /> Add contact
        </Button>
      </div>
      {contacts.length === 0 ? (
        <p className="px-4 py-6 text-center text-[13px] text-muted-foreground">No contacts yet.</p>
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>Name</TH>
              <TH>Role</TH>
              <TH>Phone</TH>
              <TH>Email</TH>
              <TH />
            </tr>
          </THead>
          <TBody>
            {contacts.map((c) => (
              <TR key={c.id}>
                <TD className="font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    {c.name}
                    {c.isPrimary && (
                      <Badge tone="red">
                        <Star className="size-2.5" /> Primary
                      </Badge>
                    )}
                  </span>
                </TD>
                <TD className="text-muted-foreground">{c.role ?? "—"}</TD>
                <TD className="whitespace-nowrap tabular">
                  {c.phone ? (
                    <span className="inline-flex items-center gap-1">
                      {c.phone}
                      <a href={telHref(c.phone) ?? undefined} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Call">
                        <Phone className="size-3.5" />
                      </a>
                      {whatsappHref(c.phone) && (
                        <a href={whatsappHref(c.phone)!} target="_blank" rel="noopener noreferrer" className="rounded p-1 text-success hover:bg-accent" aria-label="WhatsApp">
                          <MessageCircle className="size-3.5" />
                        </a>
                      )}
                    </span>
                  ) : (
                    "—"
                  )}
                </TD>
                <TD>
                  {c.email ? (
                    <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1 hover:text-primary">
                      <Mail className="size-3 text-muted-foreground" /> {c.email}
                    </a>
                  ) : (
                    "—"
                  )}
                </TD>
                <TD className="w-10 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon-xs" variant="ghost" aria-label="Contact actions">
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onSelect={() => setEditing(c)}>
                        <Pencil /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem destructive onSelect={() => setRemoving(c)}>
                        <Trash2 /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
      <ContactDialog key={editing?.id ?? "none"} open={!!editing} onOpenChange={(o) => !o && setEditing(null)} businessId={businessId} contact={editing} />
      <ContactDialog key={`add-${adding}`} open={adding} onOpenChange={setAdding} businessId={businessId} />
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={`Delete ${removing?.name ?? "contact"}?`}
        loading={pending}
        onConfirm={() => removing && run(() => deleteContact(removing.id), { success: "Contact deleted", onSuccess: () => setRemoving(null) })}
      />
    </>
  );
}

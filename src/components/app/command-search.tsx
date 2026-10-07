"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { Dialog as D } from "radix-ui";
import { Building2, FolderKanban, Loader2, Megaphone, Search, User, Users } from "lucide-react";
import { Kbd } from "@/components/ui/misc";

type Hit = { id: string; title: string; subtitle?: string; href: string };
type Results = { businesses: Hit[]; contacts: Hit[]; leads: Hit[]; campaigns: Hit[]; projects: Hit[] };
const EMPTY: Results = { businesses: [], contacts: [], leads: [], campaigns: [], projects: [] };

const GROUPS = [
  { key: "leads", label: "Leads", icon: Users },
  { key: "businesses", label: "Businesses", icon: Building2 },
  { key: "contacts", label: "Contacts", icon: User },
  { key: "campaigns", label: "Campaigns", icon: Megaphone },
  { key: "projects", label: "Projects", icon: FolderKanban },
] as const;

export function CommandSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Results>(EMPTY);
  const [loading, setLoading] = useState(false);
  const reqId = useRef(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) {
      setQ("");
      setResults(EMPTY);
    }
  }, [open]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults(EMPTY);
      setLoading(false);
      return;
    }
    const id = ++reqId.current;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { cache: "no-store" });
        const data = (await res.json()) as Results;
        if (id === reqId.current) setResults(res.ok ? data : EMPTY);
      } catch {
        if (id === reqId.current) setResults(EMPTY);
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    }, 180);
    return () => clearTimeout(t);
  }, [q]);

  const total = GROUPS.reduce((n, g) => n + results[g.key].length, 0);

  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-foreground/25 animate-fade-in" />
        <D.Content className="fixed left-1/2 top-[12vh] z-50 w-[calc(100vw-1.5rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border bg-card shadow-2xl animate-pop outline-none">
          <D.Title className="sr-only">Search</D.Title>
          <D.Description className="sr-only">Search leads, businesses, contacts and campaigns</D.Description>
          <Command shouldFilter={false} label="Global search">
            <div className="flex items-center gap-2 border-b px-4">
              {loading ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : <Search className="size-4 text-muted-foreground" />}
              <Command.Input
                value={q}
                onValueChange={setQ}
                autoFocus
                placeholder="Search businesses, contacts, phone, leads, campaigns, projects…"
                className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              <Kbd>Esc</Kbd>
            </div>
            <Command.List className="max-h-[60vh] overflow-y-auto p-2 scroll-thin">
              {q.trim().length < 2 ? (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">Type at least 2 characters. Phone numbers work too.</p>
              ) : !loading && total === 0 ? (
                <Command.Empty className="px-3 py-6 text-center text-sm text-muted-foreground">No results for “{q}”.</Command.Empty>
              ) : null}
              {GROUPS.map((g) =>
                results[g.key].length ? (
                  <Command.Group
                    key={g.key}
                    heading={g.label}
                    className="mb-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:text-muted-foreground"
                  >
                    {results[g.key].map((hit) => (
                      <Command.Item
                        key={`${g.key}-${hit.id}`}
                        value={`${g.key}-${hit.id}`}
                        onSelect={() => {
                          onOpenChange(false);
                          router.push(hit.href);
                        }}
                        className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm data-[selected=true]:bg-accent"
                      >
                        <g.icon className="size-4 shrink-0 text-muted-foreground" />
                        <span className="truncate font-medium">{hit.title}</span>
                        {hit.subtitle && <span className="ml-auto truncate pl-2 text-xs text-muted-foreground">{hit.subtitle}</span>}
                      </Command.Item>
                    ))}
                  </Command.Group>
                ) : null,
              )}
            </Command.List>
          </Command>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

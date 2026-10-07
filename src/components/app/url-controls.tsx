"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { RANGE_KEYS, RANGE_LABELS } from "@/lib/date-range";
import { cn } from "@/lib/utils";

/** Updates URL search params (server components re-render with new filters). */
export function useSetParams() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();
  const set = (patch: Record<string, string | null | undefined>, opts: { resetPage?: boolean } = { resetPage: true }) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v == null || v === "") next.delete(k);
      else next.set(k, v);
    }
    if (opts.resetPage) next.delete("page");
    const qs = next.toString();
    start(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };
  return { set, pending, sp };
}

export function DateRangeControl() {
  const { set, pending, sp } = useSetParams();
  const current = sp.get("range") ?? "30d";
  const [from, setFrom] = useState(sp.get("from") ?? "");
  const [to, setTo] = useState(sp.get("to") ?? "");
  return (
    <div className="flex flex-wrap items-center gap-2">
      {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
      <div className="flex rounded-md border bg-card p-0.5">
        {RANGE_KEYS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => (k === "custom" ? set({ range: "custom", from: from || null, to: to || null }) : set({ range: k, from: null, to: null }))}
            className={cn(
              "cursor-pointer rounded px-2.5 py-1 text-[12.5px] font-medium text-muted-foreground transition-colors hover:text-foreground",
              current === k && "bg-foreground text-background hover:text-background",
            )}
          >
            {RANGE_LABELS[k]}
          </button>
        ))}
      </div>
      {current === "custom" && (
        <form
          className="flex items-center gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            set({ range: "custom", from, to });
          }}
        >
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8 w-[140px]" aria-label="From" />
          <span className="text-muted-foreground">–</span>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8 w-[140px]" aria-label="To" />
          <Button size="sm" variant="outline" type="submit">
            Apply
          </Button>
        </form>
      )}
    </div>
  );
}

export function SearchInput({ param = "q", placeholder = "Search…", className }: { param?: string; placeholder?: string; className?: string }) {
  const { set, pending, sp } = useSetParams();
  const [value, setValue] = useState(sp.get(param) ?? "");
  useEffect(() => {
    const current = sp.get(param) ?? "";
    if (value === current) return;
    const t = setTimeout(() => set({ [param]: value.trim() || null }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <div className={cn("relative", className)}>
      {pending ? (
        <Loader2 className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
      ) : (
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      )}
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setValue("");
        }}
        placeholder={placeholder}
        className="h-8 pl-8"
      />
    </div>
  );
}

export function ParamSelect({
  param,
  options,
  placeholder,
  className,
}: {
  param: string;
  options: { value: string; label: string }[];
  placeholder: string;
  className?: string;
}) {
  const { set, sp } = useSetParams();
  return (
    <Select
      value={sp.get(param) ?? ""}
      onChange={(e) => set({ [param]: e.target.value || null })}
      className={cn("h-8 w-auto min-w-[120px] text-[13px]", className)}
      aria-label={placeholder}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </Select>
  );
}

export function Pagination({ page, pageCount, total }: { page: number; pageCount: number; total: number }) {
  const pathname = usePathname();
  const sp = useSearchParams();
  const href = (p: number) => {
    const next = new URLSearchParams(sp.toString());
    if (p <= 1) next.delete("page");
    else next.set("page", String(p));
    const qs = next.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };
  return (
    <div className="flex items-center justify-between gap-3 border-t px-4 py-2.5 text-[12.5px] text-muted-foreground">
      <span>
        {total} result{total === 1 ? "" : "s"}
      </span>
      <div className="flex items-center gap-1">
        <span className="mr-2">
          Page {page} of {Math.max(1, pageCount)}
        </span>
        <Button asChild variant="outline" size="icon-xs" aria-disabled={page <= 1} className={page <= 1 ? "pointer-events-none opacity-40" : ""}>
          <Link href={href(page - 1)} aria-label="Previous page" scroll={false}>
            <ChevronLeft />
          </Link>
        </Button>
        <Button asChild variant="outline" size="icon-xs" aria-disabled={page >= pageCount} className={page >= pageCount ? "pointer-events-none opacity-40" : ""}>
          <Link href={href(page + 1)} aria-label="Next page" scroll={false}>
            <ChevronRight />
          </Link>
        </Button>
      </div>
    </div>
  );
}

export function SegmentLinks({ param, options, fallback }: { param: string; options: { value: string; label: string; count?: number }[]; fallback: string }) {
  const { set, sp } = useSetParams();
  const current = sp.get(param) ?? fallback;
  return (
    <div className="flex flex-wrap gap-1 rounded-md border bg-card p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => set({ [param]: o.value === fallback ? null : o.value })}
          className={cn(
            "flex cursor-pointer items-center gap-1.5 rounded px-2.5 py-1 text-[12.5px] font-medium text-muted-foreground hover:text-foreground",
            current === o.value && "bg-foreground text-background hover:text-background",
          )}
        >
          {o.label}
          {o.count != null && <span className={cn("tabular text-[11px]", current === o.value ? "opacity-70" : "opacity-60")}>{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

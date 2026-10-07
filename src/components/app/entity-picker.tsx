"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronsUpDown, Loader2, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/dropdown";
import { cn } from "@/lib/utils";

export type PickerOption = { id: string; label: string; sub?: string };

/** Async searchable single-select. Submits the selected id via a hidden input. */
export function EntityPicker({
  name,
  search,
  value,
  onChange,
  placeholder = "Search…",
  disabled,
}: {
  name: string;
  search: (q: string) => Promise<PickerOption[]>;
  value: PickerOption | null;
  onChange: (v: PickerOption | null) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [options, setOptions] = useState<PickerOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const req = useRef(0);

  useEffect(() => {
    if (!open) return;
    const id = ++req.current;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await search(q);
        if (id === req.current) {
          setOptions(res);
          setActive(0);
        }
      } finally {
        if (id === req.current) setLoading(false);
      }
    }, 150);
    return () => clearTimeout(t);
  }, [q, open, search]);

  const select = (o: PickerOption) => {
    onChange(o);
    setOpen(false);
    setQ("");
  };

  return (
    <div className="relative">
      <input type="hidden" name={name} value={value?.id ?? ""} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild disabled={disabled}>
          <button
            type="button"
            className="flex h-9 w-full cursor-pointer items-center gap-2 rounded-md border border-input bg-card px-3 text-left text-sm outline-none focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-ring/20 disabled:opacity-50"
          >
            <span className={cn("flex-1 truncate", !value && "text-muted-foreground/70")}>{value?.label ?? placeholder}</span>
            {value && !disabled ? (
              <span
                role="button"
                tabIndex={-1}
                aria-label="Clear"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(null);
                }}
                className="rounded p-0.5 text-muted-foreground hover:bg-accent"
              >
                <X className="size-3.5" />
              </span>
            ) : (
              <ChevronsUpDown className="size-3.5 text-muted-foreground" />
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-64 p-1">
          <div className="flex items-center gap-2 border-b px-2 pb-1">
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActive((a) => Math.min(a + 1, options.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive((a) => Math.max(a - 1, 0));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  if (options[active]) select(options[active]);
                }
              }}
              placeholder="Type to search…"
              className="h-8 flex-1 bg-transparent text-sm outline-none"
            />
            {loading && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
          </div>
          <div className="max-h-60 overflow-y-auto py-1 scroll-thin">
            {!loading && options.length === 0 && <p className="px-2 py-3 text-center text-xs text-muted-foreground">No matches</p>}
            {options.map((o, i) => (
              <button
                type="button"
                key={o.id}
                onMouseEnter={() => setActive(i)}
                onClick={() => select(o)}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-sm",
                  i === active && "bg-accent",
                )}
              >
                <Check className={cn("size-3.5", value?.id === o.id ? "opacity-100" : "opacity-0")} />
                <span className="truncate">{o.label}</span>
                {o.sub && <span className="ml-auto truncate pl-2 text-xs text-muted-foreground">{o.sub}</span>}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

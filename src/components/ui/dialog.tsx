"use client";

import * as React from "react";
import { Dialog as D, AlertDialog as AD } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

export function DialogContent({
  className,
  children,
  title,
  description,
  size = "md",
  ...props
}: React.ComponentProps<typeof D.Content> & {
  title: React.ReactNode;
  description?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const width = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" }[size];
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-50 bg-foreground/30 animate-fade-in" />
      <D.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 flex max-h-[92vh] -translate-x-1/2 -translate-y-1/2 w-[calc(100vw-1.5rem)] flex-col rounded-lg border bg-card shadow-xl animate-zoom-in outline-none",
          width,
          className,
        )}
        {...props}
      >
        <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
          <div>
            <D.Title className="text-base font-semibold">{title}</D.Title>
            {description ? (
              <D.Description className="mt-0.5 text-sm text-muted-foreground">{description}</D.Description>
            ) : (
              <D.Description className="sr-only">{typeof title === "string" ? title : "Dialog"}</D.Description>
            )}
          </div>
          <D.Close asChild>
            <Button variant="ghost" size="icon-xs" aria-label="Close">
              <X />
            </Button>
          </D.Close>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 scroll-thin">{children}</div>
      </D.Content>
    </D.Portal>
  );
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("-mx-5 -mb-4 mt-5 flex items-center justify-end gap-2 border-t bg-subtle px-5 py-3", className)}
      {...props}
    />
  );
}

/** Confirmation dialog for destructive actions. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Delete",
  destructive = true,
  loading,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
}) {
  return (
    <AD.Root open={open} onOpenChange={onOpenChange}>
      <AD.Portal>
        <AD.Overlay className="fixed inset-0 z-50 bg-foreground/30 animate-fade-in" />
        <AD.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-1.5rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-card p-5 shadow-xl animate-zoom-in">
          <AD.Title className="text-base font-semibold">{title}</AD.Title>
          <AD.Description className="mt-1.5 text-sm text-muted-foreground">
            {description ?? "This action cannot be undone."}
          </AD.Description>
          <div className="mt-5 flex justify-end gap-2">
            <AD.Cancel asChild>
              <Button variant="outline" size="sm">
                Cancel
              </Button>
            </AD.Cancel>
            <Button
              size="sm"
              variant={destructive ? "destructive" : "default"}
              loading={loading}
              onClick={(e) => {
                e.preventDefault();
                onConfirm();
              }}
            >
              {confirmLabel}
            </Button>
          </div>
        </AD.Content>
      </AD.Portal>
    </AD.Root>
  );
}

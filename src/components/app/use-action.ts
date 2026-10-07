"use client";

import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/errors";

type RunOptions<T> = {
  success?: string | ((data: T) => string);
  onSuccess?: (data: T) => void;
  onError?: (error: string) => void;
};

/** Calls a server action inside a transition, surfaces toasts + field errors. */
export function useAction() {
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const run = useCallback(<T,>(fn: () => Promise<ActionResult<T>>, opts: RunOptions<T> = {}) => {
    startTransition(async () => {
      let res: ActionResult<T>;
      try {
        res = await fn();
      } catch (e) {
        console.error(e);
        res = { ok: false, error: "Network error — please try again." };
      }
      if (res.ok) {
        setFieldErrors({});
        if (opts.success) toast.success(typeof opts.success === "function" ? opts.success(res.data) : opts.success);
        opts.onSuccess?.(res.data);
      } else {
        setFieldErrors(res.fieldErrors ?? {});
        toast.error(res.error);
        opts.onError?.(res.error);
      }
    });
  }, []);

  return { pending, fieldErrors, setFieldErrors, run };
}

/** FormData → plain object (server actions validate with Zod). */
export function formValues(form: HTMLFormElement): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  new FormData(form).forEach((v, k) => {
    out[k] = typeof v === "string" ? v : null;
  });
  return out;
}

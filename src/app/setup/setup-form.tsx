"use client";

import { useActionState } from "react";
import { setupAdmin, type LoginState } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

export function SetupForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(setupAdmin, undefined);
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <Field label="Name" htmlFor="name" error={fe.name}>
        <Input id="name" name="name" autoComplete="name" autoFocus required />
      </Field>
      <Field label="Email" htmlFor="email" error={fe.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required placeholder="you@buyur.in" />
      </Field>
      <Field label="Password" htmlFor="password" error={fe.password} hint="At least 8 characters">
        <Input id="password" name="password" type="password" autoComplete="new-password" required />
      </Field>
      <Field label="Confirm password" htmlFor="confirmPassword" error={fe.confirmPassword}>
        <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required />
      </Field>
      {state?.error && (
        <p role="alert" className="rounded-md bg-primary-soft px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" loading={pending} className="mt-1 w-full">
        Create admin & sign in
      </Button>
    </form>
  );
}

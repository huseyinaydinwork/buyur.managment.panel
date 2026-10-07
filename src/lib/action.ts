import "server-only";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { AppError, ValidationError, type ActionResult } from "./errors";

/** Wraps a server action body: converts thrown errors into a typed result. */
export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data };
  } catch (err) {
    if (err instanceof ValidationError) return { ok: false, error: err.message, fieldErrors: err.fieldErrors };
    if (err instanceof AppError) return { ok: false, error: err.message };
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2002") return { ok: false, error: "A record with these details already exists." };
      if (err.code === "P2025") return { ok: false, error: "Record not found — it may have been deleted." };
    }
    console.error("[action]", err);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export function parse<S extends z.ZodTypeAny>(schema: S, input: unknown): z.output<S> {
  const res = schema.safeParse(input);
  if (!res.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of res.error.issues) {
      const key = issue.path.join(".") || "_form";
      (fieldErrors[key] ??= []).push(issue.message);
    }
    throw new ValidationError(fieldErrors);
  }
  return res.data;
}

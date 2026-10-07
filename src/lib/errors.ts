export class AppError extends Error {
  constructor(message: string, public code: "FORBIDDEN" | "NOT_FOUND" | "UNAUTHENTICATED" | "INVALID" = "INVALID") {
    super(message);
  }
}

export class ValidationError extends Error {
  constructor(public fieldErrors: Record<string, string[]>, message = "Please fix the highlighted fields.") {
    super(message);
  }
}

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

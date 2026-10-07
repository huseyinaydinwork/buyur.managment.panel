"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createSession, destroySession, hashPassword, verifyPassword } from "@/lib/auth";
import { loginSchema, setupSchema } from "@/lib/validation";
import { homePathFor, parseOverrides } from "@/lib/permissions";

// Simple in-memory brute-force protection. Fine for the single-instance SQLite
// deployment; move to a shared store if the app is ever scaled horizontally.
const attempts = new Map<string, { count: number; until: number }>();
const MAX_ATTEMPTS = 8;
const LOCK_MS = 10 * 60 * 1000;

// Dummy hash so unknown emails take as long as known ones (no user enumeration by timing).
let dummyHash: Promise<string> | null = null;
const getDummyHash = () => (dummyHash ??= hashPassword("timing-safe-dummy-password"));

export type LoginState = { error?: string; fieldErrors?: Record<string, string[]> } | undefined;

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) {
    const fe: Record<string, string[]> = {};
    for (const i of parsed.error.issues) (fe[String(i.path[0])] ??= []).push(i.message);
    return { fieldErrors: fe };
  }
  const { email, password } = parsed.data;
  const h = await headers();
  const ip = h.get("fly-client-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const key = `${ip}:${email}`;
  const entry = attempts.get(key);
  if (entry && entry.count >= MAX_ATTEMPTS && entry.until > Date.now()) {
    return { error: "Too many attempts. Try again in a few minutes." };
  }

  const user = await db.user.findUnique({ where: { email } });
  const valid = await verifyPassword(password, user?.passwordHash ?? (await getDummyHash()));
  if (!user || !valid || !user.isActive) {
    const next = { count: (entry?.count ?? 0) + 1, until: Date.now() + LOCK_MS };
    attempts.set(key, next);
    return { error: user && valid && !user.isActive ? "This account has been deactivated." : "Invalid email or password." };
  }

  attempts.delete(key);
  await createSession(user.id, h.get("user-agent"));
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  const next = String(formData.get("next") ?? "");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : homePathFor({ role: user.role, permissions: parseOverrides(user.permissions) }));
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

// ─── First-run setup ─────────────────────────────────────────────────────────
// Only works while the database has zero users; afterwards it is permanently closed.

const DEFAULT_SOURCES = ["Instagram", "Meta Ads", "Cold Outreach", "Website", "Referral", "Event", "Partner", "Other"];

export async function setupAdmin(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = setupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    const fe: Record<string, string[]> = {};
    for (const i of parsed.error.issues) (fe[String(i.path[0])] ??= []).push(i.message);
    return { fieldErrors: fe };
  }
  const { name, email, password } = parsed.data;
  const passwordHash = await hashPassword(password);

  const user = await db.$transaction(async (tx) => {
    if ((await tx.user.count()) > 0) return null;
    const u = await tx.user.create({ data: { name, email, role: "ADMIN", passwordHash, lastLoginAt: new Date() } });
    for (const [i, s] of DEFAULT_SOURCES.entries()) {
      await tx.leadSource.upsert({ where: { name: s }, create: { name: s, sortOrder: i }, update: {} });
    }
    return u;
  });
  if (!user) return { error: "Setup is already complete. Please sign in." };

  const h = await headers();
  await createSession(user.id, h.get("user-agent"));
  redirect("/admin");
}

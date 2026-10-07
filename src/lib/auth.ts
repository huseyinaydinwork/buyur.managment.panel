import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { AppError } from "./errors";
import { can, parseOverrides, type Module, type PermissionOverrides } from "./permissions";

export const SESSION_COOKIE = "buyur_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
const SESSION_REFRESH_MS = 1000 * 60 * 60 * 24; // extend at most once a day
const BCRYPT_ROUNDS = 12;

export type CurrentUser = { id: string; name: string; email: string; role: string; permissions: PermissionOverrides };

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function hashPassword(password: string) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: string, userAgent?: string | null) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.session.create({
    data: { id: hashToken(token), userId, expiresAt, userAgent: userAgent?.slice(0, 250) ?? null },
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { id: hashToken(token) } });
  jar.delete(SESSION_COOKIE);
}

export async function destroyOtherSessions(userId: string) {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  await db.session.deleteMany({ where: { userId, NOT: token ? { id: hashToken(token) } : undefined } });
}

/** Resolves the session cookie to an active user. Cached per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { id: hashToken(token) },
    include: { user: { select: { id: true, name: true, email: true, role: true, isActive: true, permissions: true } } },
  });
  if (!session) return null;
  const now = Date.now();
  if (session.expiresAt.getTime() < now || !session.user.isActive) {
    await db.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  // Sliding expiration (cookie is re-issued on next login/action; DB is source of truth).
  if (now - session.lastSeenAt.getTime() > SESSION_REFRESH_MS) {
    await db.session
      .update({ where: { id: session.id }, data: { lastSeenAt: new Date(), expiresAt: new Date(now + SESSION_TTL_MS) } })
      .catch(() => {});
  }
  const { id, name, email, role } = session.user;
  return { id, name, email, role, permissions: parseOverrides(session.user.permissions) };
});

/** For pages: redirects to /login when signed out. */
export async function requireUserPage(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** For pages: requires module access, otherwise sends the user home. */
export async function requireModulePage(module: Module): Promise<CurrentUser> {
  const user = await requireUserPage();
  if (!can(user, module)) redirect("/forbidden");
  return user;
}

/** For server actions / route handlers: throws instead of redirecting. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new AppError("Your session has expired. Please sign in again.", "UNAUTHENTICATED");
  return user;
}

export async function requireModule(...modules: Module[]): Promise<CurrentUser> {
  const user = await requireUser();
  if (!modules.some((m) => can(user, m))) {
    throw new AppError("You don't have permission to do that.", "FORBIDDEN");
  }
  return user;
}

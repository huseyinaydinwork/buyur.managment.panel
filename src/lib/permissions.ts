import type { Role } from "./constants";

/**
 * Module-level access matrix. Enforced server-side in every page and server
 * action via requireModule() — hiding menu items is only cosmetic.
 *
 * Effective access = role defaults, then per-user overrides
 * (User.permissions JSON, edited by admins in Admin → Team → Permissions).
 * Admins always have everything, so nobody can lock the panel out.
 */
export const MODULES = [
  "command", // Command Center (company-wide dashboard)
  "salesHome",
  "leads",
  "pipeline",
  "businesses",
  "activities",
  "playbook", // sales scripts & strategies
  "marketingHome",
  "campaigns",
  "content",
  "funnel",
  "tasks",
  "projects", // project management mode
  "admin", // team, permissions, lead sources, pipeline settings
] as const;
export type Module = (typeof MODULES)[number];

export const MODULE_LABELS: Record<Module, string> = {
  command: "Command Center",
  salesHome: "My Day (sales home)",
  leads: "Leads",
  pipeline: "Pipeline",
  businesses: "Businesses",
  activities: "Activities",
  playbook: "Sales Playbook",
  marketingHome: "Marketing overview",
  campaigns: "Campaigns",
  content: "Content",
  funnel: "Funnel",
  tasks: "Tasks",
  projects: "Projects",
  admin: "Admin (users & settings)",
};

export const MODULE_GROUPS: { title: string; modules: Module[] }[] = [
  { title: "Growth & Sales", modules: ["command", "salesHome", "leads", "pipeline", "businesses", "activities", "playbook"] },
  { title: "Marketing", modules: ["marketingHome", "campaigns", "content", "funnel"] },
  { title: "Projects", modules: ["projects"] },
  { title: "Team", modules: ["tasks", "admin"] },
];

/** Modules that belong to the Growth & Sales panel (vs. Projects mode). */
export const GROWTH_MODULES: Module[] = [
  "command",
  "salesHome",
  "leads",
  "pipeline",
  "businesses",
  "activities",
  "playbook",
  "marketingHome",
  "campaigns",
  "content",
  "funnel",
  "tasks",
];

export const ROLE_MODULES: Record<Role, readonly Module[]> = {
  ADMIN: MODULES,
  SALES: ["salesHome", "leads", "pipeline", "businesses", "activities", "playbook", "tasks"],
  MARKETING: ["marketingHome", "campaigns", "content", "funnel", "tasks"],
  PROJECT: ["projects"],
};

export type PermissionOverrides = Partial<Record<Module, boolean>>;
export type PermSubject = { role: string; permissions?: PermissionOverrides | null };

export function roleDefault(role: string, module: Module): boolean {
  return !!ROLE_MODULES[role as Role]?.includes(module);
}

/** Accepts a user (role + overrides) or, for role-only checks, a role string. */
export function can(subject: PermSubject | string | null | undefined, module: Module): boolean {
  if (!subject) return false;
  const s = typeof subject === "string" ? { role: subject } : subject;
  if (s.role === "ADMIN") return true;
  const override = s.permissions?.[module];
  return typeof override === "boolean" ? override : roleDefault(s.role, module);
}

export function permissionMap(subject: PermSubject): Record<Module, boolean> {
  return Object.fromEntries(MODULES.map((m) => [m, can(subject, m)])) as Record<Module, boolean>;
}

export function parseOverrides(json: string | null | undefined): PermissionOverrides {
  try {
    const raw = JSON.parse(json || "{}") as Record<string, unknown>;
    const out: PermissionOverrides = {};
    for (const m of MODULES) if (typeof raw[m] === "boolean") out[m] = raw[m] as boolean;
    return out;
  } catch {
    return {};
  }
}

/** Home of the Growth & Sales panel for this permission set (null = no access). */
export function growthHome(p: Record<Module, boolean>): string | null {
  if (p.command) return "/";
  if (p.salesHome) return "/sales-home";
  if (p.marketingHome) return "/marketing";
  const firstPage: [Module, string][] = [
    ["leads", "/leads"],
    ["pipeline", "/pipeline"],
    ["businesses", "/businesses"],
    ["campaigns", "/campaigns"],
    ["content", "/content"],
    ["funnel", "/funnel"],
    ["playbook", "/playbook"],
    ["activities", "/activities"],
    ["tasks", "/tasks"],
  ];
  return firstPage.find(([m]) => p[m])?.[1] ?? null;
}

/** Where a user lands after login. */
export function homeFor(p: Record<Module, boolean>): string {
  return growthHome(p) ?? (p.projects ? "/projects" : "/settings");
}

export function homePathFor(subject: PermSubject): string {
  return homeFor(permissionMap(subject));
}

type LeadOwnership = { ownerId: string | null };
type Actor = { id: string; role: string; permissions?: PermissionOverrides | null };

/** Users with lead access may edit their own and unassigned leads; admins edit everything. */
export function canEditLead(user: Actor, lead: LeadOwnership): boolean {
  if (user.role === "ADMIN") return true;
  if (!can(user, "leads")) return false;
  return lead.ownerId === null || lead.ownerId === user.id;
}

// ─── Projects ────────────────────────────────────────────────────────────────
// A project belongs to a team. Admins and project managers (PROJECT role) see
// everything; others see their own team's projects, "Everyone" projects and
// projects they own.

type ProjectAccess = { team: string; ownerId: string | null };

const seesAllProjects = (user: Actor) => user.role === "ADMIN" || user.role === "PROJECT";

export function canSeeProject(user: Actor, p: ProjectAccess): boolean {
  if (seesAllProjects(user)) return true;
  return p.team === "GENERAL" || p.team === user.role || p.ownerId === user.id;
}

/** Owners, admins, project managers and members of the project's team can edit it. */
export function canEditProject(user: Actor, p: ProjectAccess): boolean {
  if (seesAllProjects(user) || p.ownerId === user.id) return true;
  return p.team === user.role || p.team === "GENERAL";
}

/** Teams a user may assign a project to. */
export function assignableProjectTeams(user: Actor): string[] {
  if (seesAllProjects(user)) return ["GENERAL", "MARKETING", "SALES"];
  return ["GENERAL", ...(user.role === "MARKETING" || user.role === "SALES" ? [user.role] : [])];
}

/** Prisma filter equivalent of canSeeProject. */
export function projectVisibilityWhere(user: Actor) {
  if (seesAllProjects(user)) return { deletedAt: null };
  return { deletedAt: null, OR: [{ team: "GENERAL" }, { team: user.role }, { ownerId: user.id }] };
}

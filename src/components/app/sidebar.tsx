"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  BarChart3,
  BookOpen,
  Building2,
  CalendarRange,
  CheckSquare,
  ChevronsLeft,
  ChevronsRight,
  Clapperboard,
  Columns3,
  FolderKanban,
  LayoutDashboard,
  ListChecks,
  Megaphone,
  Settings,
  ShieldCheck,
  Sun,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { growthHome, type Module } from "@/lib/permissions";
import { useAppData } from "./app-context";

type Item = { label: string; href: string; icon: LucideIcon; module?: Module; dot?: string };
type Section = { title?: string; items: Item[] };

export type AppMode = "growth" | "projects";

export function modeFromPath(pathname: string): AppMode {
  return pathname === "/projects" || pathname.startsWith("/projects/") ? "projects" : "growth";
}

/**
 * Current panel mode. Users with access to only one side are pinned to it
 * (e.g. the Project team never sees the Growth & Sales chrome).
 */
export function useMode(): AppMode {
  const pathname = usePathname();
  const { can } = useAppData();
  const hasGrowth = growthHome(can) !== null;
  if (!hasGrowth && can.projects) return "projects";
  if (!can.projects) return "growth";
  return modeFromPath(pathname);
}

// ─── Animated mode switching ─────────────────────────────────────────────────

let settleTransition: (() => void) | null = null;

/** Called by the shell once the new mode has rendered. */
export function settleModeTransition() {
  settleTransition?.();
  settleTransition = null;
}

type VTDocument = Document & { startViewTransition?: (cb: () => Promise<void>) => unknown };

function switchMode(router: ReturnType<typeof useRouter>, href: string) {
  const doc = document as VTDocument;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (doc.startViewTransition && !reduce) {
    // Cross-fade the whole panel between the two themes.
    doc.startViewTransition(
      () =>
        new Promise<void>((resolve) => {
          settleTransition = resolve;
          router.push(href);
          window.setTimeout(resolve, 1500); // never hang the transition
        }),
    );
    return;
  }
  // Fallback: let colours morph smoothly while the route changes.
  const root = document.documentElement;
  root.classList.add("mode-switching");
  window.setTimeout(() => root.classList.remove("mode-switching"), 700);
  router.push(href);
}

const PROJECT_DOT: Record<string, string> = {
  PLANNING: "bg-sidebar-muted",
  ACTIVE: "bg-[#6fbf87]",
  ON_HOLD: "bg-[#e0b25a]",
  DONE: "bg-sidebar-muted/40",
};

function useGrowthNav(): Section[] {
  const { can } = useAppData();
  const home = growthHome(can);
  return [
    { items: home ? [{ label: can.command ? "Command Center" : "Home", href: home, icon: LayoutDashboard }] : [] },
    {
      title: "Marketing",
      items: [
        ...(can.marketingHome && home !== "/marketing" ? [{ label: "Marketing overview", href: "/marketing", icon: LayoutDashboard }] : []),
        { label: "Content", href: "/content", icon: Clapperboard, module: "content" },
        { label: "Campaigns", href: "/campaigns", icon: Megaphone, module: "campaigns" },
      ],
    },
    {
      title: "Sales",
      items: [
        ...(can.salesHome && home !== "/sales-home" ? [{ label: "My Day", href: "/sales-home", icon: Sun }] : []),
        { label: "Leads", href: "/leads", icon: Users, module: "leads" },
        { label: "Pipeline", href: "/pipeline", icon: Columns3, module: "pipeline" },
        { label: "Businesses", href: "/businesses", icon: Building2, module: "businesses" },
        { label: "Activities", href: "/activities", icon: Activity, module: "activities" },
        { label: "Playbook", href: "/playbook", icon: BookOpen, module: "playbook" },
      ],
    },
    { title: "Growth", items: [{ label: "Funnel", href: "/funnel", icon: BarChart3, module: "funnel" }] },
    {
      title: "Team",
      items: [
        { label: "Tasks", href: "/tasks", icon: CheckSquare, module: "tasks" },
        { label: "Admin", href: "/admin", icon: ShieldCheck, module: "admin" },
      ],
    },
  ];
}

function useProjectNav(): Section[] {
  const { projects } = useAppData();
  const open = projects.filter((p) => p.status !== "DONE").slice(0, 10);
  return [
    {
      items: [
        { label: "Overview", href: "/projects", icon: FolderKanban },
        { label: "My work", href: "/projects/my-work", icon: ListChecks },
        { label: "Timeline", href: "/projects/timeline", icon: CalendarRange },
      ],
    },
    ...(open.length
      ? [
          {
            title: "Projects",
            items: open.map((p) => ({ label: p.name, href: `/projects/${p.id}`, icon: FolderKanban, dot: PROJECT_DOT[p.status] })),
          },
        ]
      : []),
    { title: "Team", items: [{ label: "Admin", href: "/admin", icon: ShieldCheck, module: "admin" as Module }] },
  ];
}

export function useNav(): Section[] {
  const { can } = useAppData();
  const mode = useMode();
  const growth = useGrowthNav();
  const pm = useProjectNav();
  const sections = mode === "projects" ? pm : growth;
  return sections
    .map((s) => ({ ...s, items: s.items.filter((i) => !i.module || can[i.module]) }))
    .filter((s) => s.items.length);
}

function isActive(pathname: string, href: string) {
  if (href === "/" || href === "/projects") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

const itemCls = (active: boolean, collapsed?: boolean) =>
  cn(
    "flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13.5px] font-medium text-sidebar-fg/80 transition-colors hover:bg-sidebar-hover hover:text-sidebar-fg",
    active && "bg-sidebar-active text-sidebar-fg shadow-[0_0_0_1px_var(--sidebar-border)]",
    collapsed && "justify-center px-0",
  );

export function NavList({ collapsed, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const mode = useMode();
  const sections = useNav();
  return (
    <nav key={mode} className="flex flex-1 flex-col gap-4 overflow-y-auto px-2 py-3 scroll-thin animate-nav-in">
      {sections.map((s, i) => (
        <div key={i} className="flex flex-col gap-0.5">
          {s.title &&
            (collapsed ? (
              <div className="mx-auto my-1 h-px w-5 bg-sidebar-border" />
            ) : (
              <p className="px-2.5 pb-1 text-[10.5px] font-semibold uppercase tracking-wider text-sidebar-muted">{s.title}</p>
            ))}
          {s.items.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link key={item.href} href={item.href} onClick={onNavigate} title={collapsed ? item.label : undefined} className={itemCls(active, collapsed)}>
                {item.dot && !collapsed ? (
                  <span className={cn("ml-1 mr-0.5 size-2 shrink-0 rounded-full", item.dot)} />
                ) : (
                  <item.icon className={cn("size-4 shrink-0", active ? "text-sidebar-accent" : "text-sidebar-muted")} />
                )}
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export function Brand({ collapsed }: { collapsed?: boolean }) {
  const mode = useMode();
  return (
    <div className={cn("flex h-14 items-center gap-2 px-4", collapsed && "justify-center px-0")}>
      <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-[13px] font-bold text-white transition-colors duration-300">
        B
      </span>
      {!collapsed && (
        <div className="leading-none">
          <p className="text-[14px] font-bold tracking-tight text-sidebar-fg">BUYUR</p>
          <p key={mode} className="mt-0.5 text-[10.5px] text-sidebar-muted animate-nav-in">
            {mode === "projects" ? "Projects" : "Growth & Sales"}
          </p>
        </div>
      )}
    </div>
  );
}

/** One-click switch between the Growth & Sales panel and Project management mode. */
export function ModeSwitch({ className }: { className?: string }) {
  const mode = useMode();
  const router = useRouter();
  const { can } = useAppData();
  const gHome = growthHome(can);
  if (!can.projects || !gHome) return null; // single-section users don't need a switch

  const options: { m: AppMode; href: string; icon: LucideIcon; label: string; short: string }[] = [
    { m: "growth", href: gHome, icon: LayoutDashboard, label: "Growth & Sales", short: "Growth" },
    { m: "projects", href: "/projects", icon: FolderKanban, label: "Projects", short: "Projects" },
  ];
  return (
    <div role="tablist" aria-label="Panel mode" className={cn("relative grid shrink-0 grid-cols-2 rounded-lg border bg-card p-0.5", className)}>
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] rounded-md bg-primary shadow-sm transition-[translate,background-color] duration-300 ease-[cubic-bezier(.2,.8,.2,1)]",
          mode === "projects" && "translate-x-full",
        )}
      />
      {options.map((o) => {
        const active = mode === o.m;
        return (
          <Link
            key={o.m}
            href={o.href}
            role="tab"
            aria-selected={active}
            onClick={(e) => {
              if (active || e.metaKey || e.ctrlKey || e.shiftKey) return;
              e.preventDefault();
              switchMode(router, o.href);
            }}
            className={cn(
              "relative z-10 flex h-7 items-center justify-center gap-1.5 rounded-md px-3 text-[12.5px] font-medium transition-colors duration-300",
              active ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <o.icon className="size-3.5" />
            <span className="hidden md:inline">{o.label}</span>
            <span className="md:hidden">{o.short}</span>
          </Link>
        );
      })}
    </div>
  );
}

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const pathname = usePathname();
  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width,background-color] duration-300 lg:flex",
        collapsed ? "w-[60px]" : "w-[228px]",
      )}
    >
      <Brand collapsed={collapsed} />
      <NavList collapsed={collapsed} />
      <div className="flex flex-col gap-0.5 border-t border-sidebar-border px-2 py-2">
        <Link href="/settings" title={collapsed ? "Settings" : undefined} className={itemCls(isActive(pathname, "/settings"), collapsed)}>
          <Settings className="size-4 text-sidebar-muted" />
          {!collapsed && "Settings"}
        </Link>
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            "flex h-8 cursor-pointer items-center gap-2.5 rounded-md px-2.5 text-[13px] text-sidebar-muted hover:bg-sidebar-hover",
            collapsed && "justify-center px-0",
          )}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
          {!collapsed && "Collapse"}
        </button>
      </div>
    </aside>
  );
}

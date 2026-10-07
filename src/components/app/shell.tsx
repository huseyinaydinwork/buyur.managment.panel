"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Dialog as D } from "radix-ui";
import {
  Bell,
  Building2,
  CheckSquare,
  FolderPlus,
  LogOut,
  Megaphone,
  Menu,
  Plus,
  Search,
  Settings,
  UserPlus,
  X,
} from "lucide-react";
import { logout } from "@/actions/auth";
import { markNotificationsRead } from "@/actions/settings";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/dropdown";
import { Avatar, Kbd } from "@/components/ui/misc";
import { ROLE_LABELS, label } from "@/lib/constants";
import { fmtRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAppData } from "./app-context";
import { CommandSearch } from "./command-search";
import { BusinessDialog } from "./forms/business-form";
import { LeadCreateDialog } from "./forms/lead-form";
import { CampaignDialog } from "./forms/marketing-forms";
import { TaskDialog } from "./forms/task-form";
import { Brand, ModeSwitch, NavList, Sidebar, settleModeTransition, useMode } from "./sidebar";
import { ProjectDialog } from "./forms/project-form";
import { useAction } from "./use-action";

export type NotificationItem = { id: string; title: string; body: string | null; href: string | null; createdAt: string; read: boolean };

export function AppShell({
  children,
  initialCollapsed,
  notifications,
  overdueFollowUps,
}: {
  children: React.ReactNode;
  initialCollapsed: boolean;
  notifications: NotificationItem[];
  overdueFollowUps: number;
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [mobileNav, setMobileNav] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const mode = useMode();
  const pathname = usePathname();

  // Mirror the mode on <html> so portals (dialogs, menus) pick up the same theme.
  useEffect(() => {
    document.documentElement.dataset.mode = mode;
  }, [mode]);
  // Finish an in-flight mode view-transition once the new route has rendered.
  useEffect(() => {
    settleModeTransition();
  }, [pathname]);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `sb_collapsed=${next ? 1 : 0}; path=/; max-age=31536000; samesite=lax`;
  };

  return (
    <div className="flex min-h-dvh" data-mode={mode}>
      <Sidebar collapsed={collapsed} onToggle={toggle} />

      <D.Root open={mobileNav} onOpenChange={setMobileNav}>
        <D.Portal>
          <D.Overlay className="fixed inset-0 z-50 bg-foreground/30 animate-fade-in lg:hidden" />
          <D.Content className="fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col bg-sidebar shadow-xl animate-slide-in-left outline-none lg:hidden">
            <D.Title className="sr-only">Navigation</D.Title>
            <D.Description className="sr-only">Main navigation</D.Description>
            <div className="flex items-center justify-between pr-2">
              <Brand />
              <D.Close asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Close menu">
                  <X />
                </Button>
              </D.Close>
            </div>
            <NavList onNavigate={() => setMobileNav(false)} />
            <div className="border-t border-sidebar-border p-2">
              <Link href="/settings" onClick={() => setMobileNav(false)} className="flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13.5px] font-medium text-sidebar-fg hover:bg-sidebar-hover">
                <Settings className="size-4 text-sidebar-muted" /> Settings
              </Link>
            </div>
          </D.Content>
        </D.Portal>
      </D.Root>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur-sm sm:px-5">
          <Button variant="ghost" size="icon-sm" className="lg:hidden" onClick={() => setMobileNav(true)} aria-label="Open menu">
            <Menu />
          </Button>
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="flex h-9 w-full max-w-md cursor-pointer items-center gap-2 rounded-md border border-input bg-card px-3 text-sm text-muted-foreground transition-colors hover:border-foreground/20"
          >
            <Search className="size-4" />
            <span className="flex-1 truncate text-left">Search businesses, contacts, leads…</span>
            <Kbd className="hidden sm:inline-flex">Ctrl K</Kbd>
          </button>
          <ModeSwitch />
          <div className="ml-auto flex items-center gap-1.5">
            <QuickAdd />
            <Notifications items={notifications} overdueFollowUps={overdueFollowUps} />
            <UserMenu />
          </div>
        </header>
        <main key={mode} className="mx-auto w-full max-w-[1480px] flex-1 px-3 py-5 animate-mode-in sm:px-6 sm:py-6">{children}</main>
      </div>
      <CommandSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}

function QuickAdd() {
  const { can } = useAppData();
  const [open, setOpen] = useState<null | "lead" | "business" | "task" | "campaign" | "project">(null);
  const set = (k: typeof open) => () => setOpen(k);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" className="gap-1">
            <Plus className="size-4" />
            <span className="hidden sm:inline">Quick add</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {can.leads && (
            <DropdownMenuItem onSelect={set("lead")}>
              <UserPlus /> New lead
            </DropdownMenuItem>
          )}
          {can.businesses && (
            <DropdownMenuItem onSelect={set("business")}>
              <Building2 /> New business
            </DropdownMenuItem>
          )}
          {can.tasks && (
            <DropdownMenuItem onSelect={set("task")}>
              <CheckSquare /> New task
            </DropdownMenuItem>
          )}
          {can.campaigns && (
            <DropdownMenuItem onSelect={set("campaign")}>
              <Megaphone /> New campaign
            </DropdownMenuItem>
          )}
          {can.projects && (
            <DropdownMenuItem onSelect={set("project")}>
              <FolderPlus /> New project
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {can.leads && <LeadCreateDialog key={`lead-${open === "lead"}`} open={open === "lead"} onOpenChange={(o) => setOpen(o ? "lead" : null)} />}
      {can.businesses && <BusinessDialog open={open === "business"} onOpenChange={(o) => setOpen(o ? "business" : null)} />}
      {can.tasks && <TaskDialog key={`task-${open === "task"}`} open={open === "task"} onOpenChange={(o) => setOpen(o ? "task" : null)} />}
      {can.campaigns && <CampaignDialog open={open === "campaign"} onOpenChange={(o) => setOpen(o ? "campaign" : null)} />}
      {can.projects && <ProjectDialog key={`project-${open === "project"}`} open={open === "project"} onOpenChange={(o) => setOpen(o ? "project" : null)} />}
    </>
  );
}

function Notifications({ items, overdueFollowUps }: { items: NotificationItem[]; overdueFollowUps: number }) {
  const router = useRouter();
  const { can } = useAppData();
  const { run } = useAction();
  const unread = items.filter((i) => !i.read).length;
  const badge = unread + (overdueFollowUps > 0 ? 1 : 0);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Notifications" className="relative">
          <Bell />
          {badge > 0 && (
            <span className="absolute right-1 top-1 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9.5px] font-semibold leading-4 text-white">
              {badge}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(360px,calc(100vw-1.5rem))] p-0">
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <p className="text-sm font-semibold">Notifications</p>
          {unread > 0 && (
            <button className="cursor-pointer text-xs font-medium text-primary hover:underline" onClick={() => run(() => markNotificationsRead())}>
              Mark all read
            </button>
          )}
        </div>
        <div className="max-h-[420px] overflow-y-auto scroll-thin">
          {can.leads && overdueFollowUps > 0 && (
            <Link href="/sales-home" className="flex items-start gap-3 border-b bg-primary-soft/50 px-4 py-3 hover:bg-primary-soft">
              <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
              <div>
                <p className="text-sm font-medium">
                  {overdueFollowUps} overdue follow-up{overdueFollowUps > 1 ? "s" : ""}
                </p>
                <p className="text-xs text-muted-foreground">Open My Day to catch up</p>
              </div>
            </Link>
          )}
          {items.length === 0 && !(can.leads && overdueFollowUps > 0) && (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">You&apos;re all caught up.</p>
          )}
          {items.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => {
                if (!n.read) run(() => markNotificationsRead([n.id]));
                if (n.href) router.push(n.href);
              }}
              className={cn("flex w-full cursor-pointer items-start gap-3 border-b px-4 py-3 text-left last:border-0 hover:bg-subtle", n.read && "opacity-60")}
            >
              <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-primary")} />
              <div className="min-w-0">
                <p className="text-sm font-medium">{n.title}</p>
                {n.body && <p className="truncate text-xs text-muted-foreground">{n.body}</p>}
                <p className="mt-0.5 text-[11px] text-muted-foreground">{fmtRelative(n.createdAt)}</p>
              </div>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function UserMenu() {
  const { user } = useAppData();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="ml-1 flex cursor-pointer items-center gap-2 rounded-md p-1 hover:bg-accent" aria-label="Account menu">
          <Avatar name={user.name} className="size-7" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <DropdownMenuLabel className="normal-case">
          <p className="text-sm font-semibold text-foreground">{user.name}</p>
          <p className="truncate text-xs font-normal">{user.email}</p>
          <p className="mt-1 text-[11px] font-medium text-primary">{label(ROLE_LABELS, user.role)}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings /> Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => logout()}>
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

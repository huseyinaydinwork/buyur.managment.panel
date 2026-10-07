import Link from "next/link";
import { addDays, addWeeks, differenceInCalendarDays, format, startOfWeek } from "date-fns";
import { CalendarRange } from "lucide-react";
import { requireModulePage } from "@/lib/auth";
import { getProjectsWithProgress } from "@/lib/projects";
import { cn } from "@/lib/utils";
import { Card, EmptyState, PageHeader } from "@/components/ui/misc";
import { TeamBadge } from "@/components/app/display";
import { NewProjectButton } from "@/components/app/project-components";

export const metadata = { title: "Timeline" };

const WEEKS = 14;
const BAR: Record<string, string> = {
  PLANNING: "bg-foreground/25",
  ACTIVE: "bg-primary",
  ON_HOLD: "bg-[#e0b25a]",
  DONE: "bg-foreground/15",
};

export default async function TimelinePage() {
  const user = await requireModulePage("projects");
  const projects = (await getProjectsWithProgress(user)).filter((p) => p.startDate || p.dueDate);

  const windowStart = startOfWeek(addWeeks(new Date(), -3), { weekStartsOn: 1 });
  const windowEnd = addWeeks(windowStart, WEEKS);
  const totalDays = differenceInCalendarDays(windowEnd, windowStart);
  const pos = (d: Date) => Math.min(100, Math.max(0, (differenceInCalendarDays(d, windowStart) / totalDays) * 100));
  const today = pos(new Date());

  return (
    <>
      <PageHeader title="Timeline" description="Projects across the next weeks. Bars run from start to due date; the fill shows task progress." actions={<NewProjectButton />} />
      {projects.length === 0 ? (
        <Card>
          <EmptyState icon={<CalendarRange />} title="No dated projects" description="Give projects a start or due date to see them here." />
        </Card>
      ) : (
        <Card className="overflow-x-auto scroll-thin">
          <div className="min-w-[860px]">
            <div className="grid grid-cols-[220px_1fr] border-b bg-subtle text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <div className="px-4 py-2">Project</div>
              <div className="relative grid" style={{ gridTemplateColumns: `repeat(${WEEKS}, 1fr)` }}>
                {Array.from({ length: WEEKS }).map((_, i) => (
                  <div key={i} className="border-l px-1.5 py-2">
                    {format(addWeeks(windowStart, i), "d MMM")}
                  </div>
                ))}
              </div>
            </div>
            {projects.map((p) => {
              const start = p.startDate ?? addDays(p.dueDate!, -7);
              const end = p.dueDate ?? addDays(start, 14);
              const left = pos(start);
              const width = Math.max(1.5, pos(end) - left);
              const progress = p.total ? (p.done / p.total) * 100 : 0;
              return (
                <div key={p.id} className="grid grid-cols-[220px_1fr] border-b last:border-0 hover:bg-subtle/60">
                  <div className="flex min-w-0 items-center gap-2 px-4 py-2.5">
                    <Link href={`/projects/${p.id}`} className="truncate text-[13px] font-medium hover:text-primary">
                      {p.name}
                    </Link>
                    <TeamBadge team={p.team} />
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 w-px bg-primary/60" style={{ left: `${today}%` }} title="Today" />
                    <Link
                      href={`/projects/${p.id}`}
                      title={`${p.name}: ${format(start, "d MMM")} → ${format(end, "d MMM")} · ${p.done}/${p.total} tasks`}
                      className={cn("absolute top-1/2 h-5 -translate-y-1/2 overflow-hidden rounded", BAR[p.status], p.late && "ring-2 ring-destructive/60")}
                      style={{ left: `${left}%`, width: `${width}%` }}
                    >
                      <span className="block h-full bg-black/25" style={{ width: `${progress}%` }} />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </>
  );
}

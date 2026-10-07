import {
  addDays,
  differenceInCalendarDays,
  format,
  isValid,
  parseISO,
  startOfDay,
  startOfMonth,
  subDays,
  subMonths,
} from "date-fns";

export const RANGE_KEYS = ["today", "7d", "30d", "month", "custom"] as const;
export type RangeKey = (typeof RANGE_KEYS)[number];
export const RANGE_LABELS: Record<RangeKey, string> = {
  today: "Today",
  "7d": "7 days",
  "30d": "30 days",
  month: "This month",
  custom: "Custom",
};

export type DateRange = {
  key: RangeKey;
  from: Date;
  to: Date; // exclusive
  prevFrom: Date;
  prevTo: Date; // exclusive
  label: string;
  fromParam: string;
  toParam: string;
};

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Parses ?range=7d | ?range=custom&from=2026-10-01&to=2026-10-06 (dates inclusive). */
export function parseDateRange(sp: SP, fallback: RangeKey = "30d"): DateRange {
  const now = new Date();
  const rawKey = one(sp.range);
  const key: RangeKey = (RANGE_KEYS as readonly string[]).includes(rawKey ?? "") ? (rawKey as RangeKey) : fallback;
  let from: Date;
  let to: Date = startOfDay(addDays(now, 1));
  let prevFrom: Date;
  let prevTo: Date;

  switch (key) {
    case "today":
      from = startOfDay(now);
      prevFrom = subDays(from, 1);
      prevTo = from;
      break;
    case "7d":
      from = startOfDay(subDays(now, 6));
      prevFrom = subDays(from, 7);
      prevTo = from;
      break;
    case "month": {
      from = startOfMonth(now);
      prevFrom = subMonths(from, 1);
      // Same elapsed period of last month for a fair comparison
      const elapsed = differenceInCalendarDays(to, from);
      prevTo = addDays(prevFrom, Math.min(elapsed, differenceInCalendarDays(from, prevFrom)));
      break;
    }
    case "custom": {
      const f = parseISO(one(sp.from) ?? "");
      const t = parseISO(one(sp.to) ?? "");
      from = isValid(f) ? startOfDay(f) : startOfDay(subDays(now, 29));
      if (isValid(t)) to = startOfDay(addDays(t, 1));
      if (to <= from) to = addDays(from, 1);
      const len = differenceInCalendarDays(to, from);
      prevTo = from;
      prevFrom = subDays(from, len);
      break;
    }
    default: // 30d
      from = startOfDay(subDays(now, 29));
      prevFrom = subDays(from, 30);
      prevTo = from;
  }

  const lastDay = subDays(to, 1);
  const label =
    key === "custom"
      ? `${format(from, "d MMM")} – ${format(lastDay, "d MMM yyyy")}`
      : RANGE_LABELS[key];
  return {
    key,
    from,
    to,
    prevFrom,
    prevTo,
    label,
    fromParam: format(from, "yyyy-MM-dd"),
    toParam: format(lastDay, "yyyy-MM-dd"),
  };
}

export function between(from: Date, to: Date) {
  return { gte: from, lt: to };
}

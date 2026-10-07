import { differenceInCalendarDays, format, formatDistanceToNowStrict, isToday, isTomorrow, isYesterday } from "date-fns";

const currency = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 });
const compactCurrency = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  notation: "compact",
  maximumFractionDigits: 1,
});
const number = new Intl.NumberFormat("tr-TR");

export const fmtMoney = (v: number | null | undefined) => (v == null ? "—" : currency.format(v));
export const fmtMoneyCompact = (v: number | null | undefined) =>
  v == null ? "—" : Math.abs(v) >= 100_000 ? compactCurrency.format(v) : currency.format(v);
export const fmtNumber = (v: number | null | undefined) => (v == null ? "—" : number.format(v));
export const fmtPct = (v: number | null | undefined, digits = 1) =>
  v == null || !Number.isFinite(v) ? "—" : `${v.toFixed(digits).replace(/\.0$/, "")}%`;

type D = Date | string | null | undefined;
const toDate = (d: D) => (d == null ? null : typeof d === "string" ? new Date(d) : d);

export function fmtDate(d: D, pattern = "d MMM yyyy") {
  const x = toDate(d);
  return x ? format(x, pattern) : "—";
}

export function fmtDateTime(d: D) {
  const x = toDate(d);
  return x ? format(x, "d MMM, HH:mm") : "—";
}

export function fmtTime(d: D) {
  const x = toDate(d);
  return x ? format(x, "HH:mm") : "";
}

/** "Today 14:30", "Tomorrow", "Yesterday", "Mon 12 Oct" */
export function fmtSmartDate(d: D, withTime = true) {
  const x = toDate(d);
  if (!x) return "—";
  const t = withTime && (x.getHours() !== 0 || x.getMinutes() !== 0) ? ` ${format(x, "HH:mm")}` : "";
  if (isToday(x)) return `Today${t}`;
  if (isTomorrow(x)) return `Tomorrow${t}`;
  if (isYesterday(x)) return `Yesterday${t}`;
  const days = differenceInCalendarDays(x, new Date());
  if (days > 0 && days < 7) return `${format(x, "EEE")}${t}`;
  return `${format(x, "d MMM")}${t}`;
}

export function fmtRelative(d: D) {
  const x = toDate(d);
  if (!x) return "—";
  if (Math.abs(Date.now() - x.getTime()) < 60_000) return "just now";
  return formatDistanceToNowStrict(x, { addSuffix: true });
}

export function daysOverdue(d: D): number {
  const x = toDate(d);
  if (!x) return 0;
  return Math.max(0, differenceInCalendarDays(new Date(), x));
}

/** Value for <input type="datetime-local"> in server/local time. */
export function toInputDateTime(d: D) {
  const x = toDate(d);
  return x ? format(x, "yyyy-MM-dd'T'HH:mm") : "";
}

export function toInputDate(d: D) {
  const x = toDate(d);
  return x ? format(x, "yyyy-MM-dd") : "";
}

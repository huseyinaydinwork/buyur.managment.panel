import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Turkish-aware lowercase + diacritic folding used for search keys. */
export function fold(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .replace(/İ/g, "i")
    .replace(/I/g, "ı")
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function digitsOnly(input: string | null | undefined): string {
  return (input ?? "").replace(/\D/g, "");
}

/** Normalises a Turkish phone number to international digits (90XXXXXXXXXX). */
export function toIntlPhone(input: string | null | undefined): string | null {
  let d = digitsOnly(input);
  if (!d) return null;
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("0")) d = "90" + d.slice(1);
  if (d.length === 10 && d.startsWith("5")) d = "90" + d;
  return d.length >= 8 ? d : null;
}

export function telHref(phone: string | null | undefined): string | null {
  const intl = toIntlPhone(phone);
  return intl ? `tel:+${intl}` : null;
}

export function whatsappHref(phone: string | null | undefined, text?: string): string | null {
  const intl = toIntlPhone(phone);
  if (!intl) return null;
  return `https://wa.me/${intl}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

export function instagramHref(handle: string | null | undefined): string | null {
  if (!handle) return null;
  if (/^https?:\/\//i.test(handle)) return handle;
  return `https://instagram.com/${handle.replace(/^@/, "")}`;
}

export function websiteHref(url: string | null | undefined): string | null {
  if (!url) return null;
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toLocaleUpperCase("tr-TR"))
    .join("");
}

export function safeJson<T = Record<string, unknown>>(value: string | null | undefined): T {
  try {
    return (value ? JSON.parse(value) : {}) as T;
  } catch {
    return {} as T;
  }
}

export function pct(part: number, whole: number): number | null {
  if (!whole) return null;
  return (part / whole) * 100;
}

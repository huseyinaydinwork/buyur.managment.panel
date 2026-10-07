/** Placeholders sales reps can use in playbook entries. */
export const PLAYBOOK_PLACEHOLDERS = [
  { key: "isletme", label: "Business name" },
  { key: "yetkili", label: "Contact name" },
  { key: "satisci", label: "Your name" },
] as const;

export type PlaybookVars = Partial<Record<(typeof PLAYBOOK_PLACEHOLDERS)[number]["key"], string | null | undefined>>;

const FALLBACK: Record<string, string> = { isletme: "işletmeniz", yetkili: "", satisci: "" };

/** Fills {placeholders}; missing values fall back gracefully ("Merhaba {yetkili}," → "Merhaba,"). */
export function fillTemplate(body: string, vars: PlaybookVars): string {
  return body
    .replace(/\{(\w+)\}/g, (m, k: string) => {
      const v = vars[k as keyof PlaybookVars];
      if (v && v.trim()) return v.trim();
      return k in FALLBACK ? FALLBACK[k]! : m;
    })
    .replace(/[ \t]+([,.!?])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/— \n/g, "\n");
}

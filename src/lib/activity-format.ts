import { ACTIVITY_TYPE_LABELS, LEAD_STATUS_LABELS, label, type ActivityType } from "./constants";
import { fmtMoney } from "./format";
import { safeJson } from "./utils";

export type ActivityRow = {
  id: string;
  type: string;
  entityType: string;
  entityId: string;
  leadId: string | null;
  businessId: string | null;
  campaignId: string | null;
  body: string | null;
  metadata: string;
  createdAt: Date;
  user: { name: string } | null;
};

export type ActivityView = {
  id: string;
  type: string;
  typeLabel: string;
  actor: string;
  verb: string;
  target: string | null;
  href: string | null;
  detail: string | null;
  body: string | null;
  createdAt: Date;
};

type Meta = Record<string, string | number | null | undefined>;

const VERBS: Partial<Record<ActivityType, string>> = {
  NOTE: "added a note to",
  CALL: "logged a call with",
  WHATSAPP: "logged a WhatsApp chat with",
  EMAIL: "logged an email to",
  MEETING: "logged a meeting with",
  DEMO: "held a demo with",
  STATUS_CHANGE: "moved",
  LEAD_CREATED: "created lead",
  LEAD_UPDATED: "updated",
  LEAD_ASSIGNED: "assigned",
  DEAL_WON: "won",
  DEAL_LOST: "lost",
  BUSINESS_CREATED: "added business",
  BUSINESS_UPDATED: "updated business",
  CONTACT_ADDED: "added a contact to",
  TASK_CREATED: "created task",
  TASK_COMPLETED: "completed task",
  CAMPAIGN_CREATED: "created campaign",
  CAMPAIGN_UPDATED: "updated campaign",
  CONTENT_CREATED: "created content",
  CONTENT_STATUS_CHANGED: "moved content",
  USER_CREATED: "added teammate",
  PROJECT_CREATED: "created project",
  PROJECT_UPDATED: "updated project",
};

function detailFor(type: string, m: Meta): string | null {
  switch (type) {
    case "STATUS_CHANGE":
      return `${label(LEAD_STATUS_LABELS, m.from as string)} → ${label(LEAD_STATUS_LABELS, m.to as string)}`;
    case "LEAD_UPDATED":
      return (m.fields as string) ?? null;
    case "LEAD_ASSIGNED":
      return m.to ? `to ${m.to}` : "as unassigned";
    case "DEAL_WON":
      return m.value ? fmtMoney(Number(m.value)) : null;
    case "DEAL_LOST":
      return (m.reason as string) || null;
    case "CONTACT_ADDED":
      return (m.contact as string) ?? null;
    case "CONTENT_STATUS_CHANGED":
      return m.to ? `→ ${m.to}` : null;
    case "PROJECT_UPDATED":
      return (m.fields as string) || null;
    case "TASK_CREATED":
    case "TASK_COMPLETED":
      return m.project ? `in ${m.project}` : null;
    default:
      return null;
  }
}

/** Turns an activity row into "Ahmet moved Minoa Cafe · Qualified → Demo Scheduled". */
export function describeActivity(a: ActivityRow): ActivityView {
  const m = safeJson<Meta>(a.metadata);
  const actor = a.user?.name?.split(" ")[0] ?? "System";
  const href = a.leadId
    ? `/leads/${a.leadId}`
    : a.entityType === "BUSINESS"
      ? `/businesses/${a.entityId}`
      : a.entityType === "CAMPAIGN"
        ? `/campaigns/${a.entityId}`
        : a.entityType === "PROJECT"
          ? `/projects/${a.entityId}`
          : a.entityType === "TASK"
          ? (m.projectId ? `/projects/${m.projectId}` : `/tasks`)
          : a.entityType === "CONTENT"
            ? `/content`
            : null;
  let verb = VERBS[a.type as ActivityType] ?? label(ACTIVITY_TYPE_LABELS, a.type).toLowerCase();
  if (a.type === "FOLLOW_UP") verb = m.action === "completed" ? "completed a follow-up with" : "scheduled a follow-up with";
  return {
    id: a.id,
    type: a.type,
    typeLabel: label(ACTIVITY_TYPE_LABELS, a.type),
    actor,
    verb,
    target: (m.name as string) ?? null,
    href,
    detail: detailFor(a.type, m),
    body: a.body,
    createdAt: a.createdAt,
  };
}

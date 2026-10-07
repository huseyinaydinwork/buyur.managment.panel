// Single source of truth for enumerations used across the app.
// SQLite stores these as strings; Zod schemas validate against these lists.

export const ROLES = ["ADMIN", "MARKETING", "SALES", "PROJECT"] as const;
export type Role = (typeof ROLES)[number];
export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin / Growth Lead",
  MARKETING: "Marketing",
  SALES: "Sales",
  PROJECT: "Project team",
};

// ─── Leads / pipeline ────────────────────────────────────────────────────────
export const LEAD_STATUSES = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "DEMO_SCHEDULED",
  "DEMO_COMPLETED",
  "TRIAL",
  "NEGOTIATION",
  "WON",
  "LOST",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: "New Lead",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  DEMO_SCHEDULED: "Demo Scheduled",
  DEMO_COMPLETED: "Demo Completed",
  TRIAL: "Trial",
  NEGOTIATION: "Negotiation",
  WON: "Won",
  LOST: "Lost",
};

export const OPEN_STATUSES: LeadStatus[] = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "DEMO_SCHEDULED",
  "DEMO_COMPLETED",
  "TRIAL",
  "NEGOTIATION",
];

export const PIPELINE_COLUMNS: LeadStatus[] = [...OPEN_STATUSES, "WON"];

/** Milestone timestamp column written the first time a lead reaches a stage. */
export const STAGE_MILESTONE_FIELD = {
  CONTACTED: "contactedAt",
  QUALIFIED: "qualifiedAt",
  DEMO_SCHEDULED: "demoScheduledAt",
  DEMO_COMPLETED: "demoCompletedAt",
  TRIAL: "trialAt",
  NEGOTIATION: "negotiationAt",
  WON: "wonAt",
} as const satisfies Partial<Record<LeadStatus, string>>;

/** Default win probability per open stage (editable in Settings → Pipeline). */
export const DEFAULT_STAGE_PROBABILITIES: Record<string, number> = {
  NEW: 5,
  CONTACTED: 10,
  QUALIFIED: 25,
  DEMO_SCHEDULED: 40,
  DEMO_COMPLETED: 55,
  TRIAL: 65,
  NEGOTIATION: 80,
};

export const STALE_LEAD_DAYS = 3;

// ─── Businesses ──────────────────────────────────────────────────────────────
export const BUSINESS_TYPES = [
  "RESTAURANT",
  "CAFE",
  "FAST_FOOD",
  "FINE_DINING",
  "BAKERY",
  "BAR",
  "BREAKFAST",
  "KEBAB",
  "OTHER",
] as const;
export const BUSINESS_TYPE_LABELS: Record<(typeof BUSINESS_TYPES)[number], string> = {
  RESTAURANT: "Restaurant",
  CAFE: "Cafe",
  FAST_FOOD: "Fast food",
  FINE_DINING: "Fine dining",
  BAKERY: "Bakery / Patisserie",
  BAR: "Bar / Pub",
  BREAKFAST: "Breakfast",
  KEBAB: "Kebab / Ocakbaşı",
  OTHER: "Other",
};

export const BUSINESS_STATUSES = ["PROSPECT", "CUSTOMER", "CHURNED"] as const;
export const BUSINESS_STATUS_LABELS: Record<(typeof BUSINESS_STATUSES)[number], string> = {
  PROSPECT: "Prospect",
  CUSTOMER: "Customer",
  CHURNED: "Churned",
};

// ─── Activities ──────────────────────────────────────────────────────────────
export const LOGGABLE_ACTIVITY_TYPES = ["NOTE", "CALL", "WHATSAPP", "EMAIL", "MEETING", "DEMO"] as const;
export type LoggableActivityType = (typeof LOGGABLE_ACTIVITY_TYPES)[number];

export const ACTIVITY_TYPES = [
  ...LOGGABLE_ACTIVITY_TYPES,
  "FOLLOW_UP",
  "STATUS_CHANGE",
  "LEAD_CREATED",
  "LEAD_UPDATED",
  "LEAD_ASSIGNED",
  "DEAL_WON",
  "DEAL_LOST",
  "BUSINESS_CREATED",
  "BUSINESS_UPDATED",
  "CONTACT_ADDED",
  "TASK_CREATED",
  "TASK_COMPLETED",
  "CAMPAIGN_CREATED",
  "CAMPAIGN_UPDATED",
  "CONTENT_CREATED",
  "CONTENT_STATUS_CHANGED",
  "USER_CREATED",
  "PROJECT_CREATED",
  "PROJECT_UPDATED",
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  NOTE: "Note",
  CALL: "Call",
  WHATSAPP: "WhatsApp",
  EMAIL: "Email",
  MEETING: "Meeting",
  DEMO: "Demo",
  FOLLOW_UP: "Follow-up",
  STATUS_CHANGE: "Stage change",
  LEAD_CREATED: "Lead created",
  LEAD_UPDATED: "Lead updated",
  LEAD_ASSIGNED: "Lead assigned",
  DEAL_WON: "Deal won",
  DEAL_LOST: "Deal lost",
  BUSINESS_CREATED: "Business created",
  BUSINESS_UPDATED: "Business updated",
  CONTACT_ADDED: "Contact added",
  TASK_CREATED: "Task created",
  TASK_COMPLETED: "Task completed",
  CAMPAIGN_CREATED: "Campaign created",
  CAMPAIGN_UPDATED: "Campaign updated",
  CONTENT_CREATED: "Content created",
  CONTENT_STATUS_CHANGED: "Content moved",
  USER_CREATED: "User created",
  PROJECT_CREATED: "Project created",
  PROJECT_UPDATED: "Project updated",
};

export const ENTITY_TYPES = ["LEAD", "BUSINESS", "TASK", "CAMPAIGN", "CONTENT", "USER", "PROJECT"] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

// ─── Tasks ───────────────────────────────────────────────────────────────────
export const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;
export const TASK_STATUSES = ["TODO", "IN_PROGRESS", "DONE"] as const;
export const TASK_STATUS_LABELS: Record<(typeof TASK_STATUSES)[number], string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  DONE: "Done",
};
export const TASK_PRIORITY_LABELS: Record<(typeof TASK_PRIORITIES)[number], string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
};

// ─── Campaigns ───────────────────────────────────────────────────────────────
export const CAMPAIGN_STATUSES = ["DRAFT", "ACTIVE", "PAUSED", "COMPLETED"] as const;
export const CAMPAIGN_STATUS_LABELS: Record<(typeof CAMPAIGN_STATUSES)[number], string> = {
  DRAFT: "Draft",
  ACTIVE: "Active",
  PAUSED: "Paused",
  COMPLETED: "Completed",
};
export const CAMPAIGN_CHANNELS = [
  "INSTAGRAM",
  "META_ADS",
  "GOOGLE_ADS",
  "TIKTOK",
  "COLD_OUTREACH",
  "EMAIL",
  "EVENT",
  "REFERRAL",
  "OTHER",
] as const;
export const CAMPAIGN_CHANNEL_LABELS: Record<(typeof CAMPAIGN_CHANNELS)[number], string> = {
  INSTAGRAM: "Instagram (organic)",
  META_ADS: "Meta Ads",
  GOOGLE_ADS: "Google Ads",
  TIKTOK: "TikTok",
  COLD_OUTREACH: "Cold Outreach",
  EMAIL: "Email",
  EVENT: "Event",
  REFERRAL: "Referral",
  OTHER: "Other",
};

// ─── Content ─────────────────────────────────────────────────────────────────
export const CONTENT_STATUSES = ["IDEA", "SCRIPT", "DESIGN", "APPROVAL", "SCHEDULED", "PUBLISHED"] as const;
export const CONTENT_STATUS_LABELS: Record<(typeof CONTENT_STATUSES)[number], string> = {
  IDEA: "Idea",
  SCRIPT: "Script",
  DESIGN: "Design",
  APPROVAL: "Approval",
  SCHEDULED: "Scheduled",
  PUBLISHED: "Published",
};
export const CONTENT_PLATFORMS = ["INSTAGRAM", "TIKTOK", "LINKEDIN", "X", "YOUTUBE", "OTHER"] as const;
export const CONTENT_PLATFORM_LABELS: Record<(typeof CONTENT_PLATFORMS)[number], string> = {
  INSTAGRAM: "Instagram",
  TIKTOK: "TikTok",
  LINKEDIN: "LinkedIn",
  X: "X",
  YOUTUBE: "YouTube",
  OTHER: "Other",
};
export const CONTENT_FORMATS = ["REEL", "CAROUSEL", "SINGLE", "STORY", "VIDEO", "POST"] as const;
export const CONTENT_FORMAT_LABELS: Record<(typeof CONTENT_FORMATS)[number], string> = {
  REEL: "Reel",
  CAROUSEL: "Carousel",
  SINGLE: "Single",
  STORY: "Story",
  VIDEO: "Video",
  POST: "Post",
};

export const DEFAULT_LEAD_SOURCES = [
  "Instagram",
  "Meta Ads",
  "Cold Outreach",
  "Website",
  "Referral",
  "Event",
  "Partner",
  "Other",
];

export const PAGE_SIZE = 25;

export function label<T extends string>(map: Record<T, string>, key: string | null | undefined): string {
  if (!key) return "—";
  return (map as Record<string, string>)[key] ?? key;
}

// ─── Projects (project management mode) ──────────────────────────────────────
export const PROJECT_STATUSES = ["PLANNING", "ACTIVE", "ON_HOLD", "DONE"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  PLANNING: "Planning",
  ACTIVE: "Active",
  ON_HOLD: "On hold",
  DONE: "Done",
};
export const PROJECT_TEAMS = ["GENERAL", "MARKETING", "SALES"] as const;
export type ProjectTeam = (typeof PROJECT_TEAMS)[number];
export const PROJECT_TEAM_LABELS: Record<ProjectTeam, string> = {
  GENERAL: "Everyone",
  MARKETING: "Marketing",
  SALES: "Sales",
};

// ─── Sales playbook ──────────────────────────────────────────────────────────
export const PLAYBOOK_CATEGORIES = ["CALL", "WHATSAPP", "OBJECTION", "STRATEGY"] as const;
export type PlaybookCategory = (typeof PLAYBOOK_CATEGORIES)[number];
export const PLAYBOOK_CATEGORY_LABELS: Record<PlaybookCategory, string> = {
  CALL: "Call scripts",
  WHATSAPP: "WhatsApp messages",
  OBJECTION: "Objection handling",
  STRATEGY: "Winning strategies",
};

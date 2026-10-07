import { z } from "zod";
import {
  BUSINESS_STATUSES,
  BUSINESS_TYPES,
  CAMPAIGN_CHANNELS,
  CAMPAIGN_STATUSES,
  CONTENT_FORMATS,
  CONTENT_PLATFORMS,
  CONTENT_STATUSES,
  LEAD_STATUSES,
  LOGGABLE_ACTIVITY_TYPES,
  PLAYBOOK_CATEGORIES,
  PROJECT_STATUSES,
  PROJECT_TEAMS,
  ROLES,
  TASK_PRIORITIES,
  TASK_STATUSES,
} from "./constants";

// ─── Primitive helpers (FormData sends strings; empty string ⇒ null) ─────────

const emptyToNull = (v: unknown) => {
  if (v == null) return null;
  if (typeof v === "string") {
    const t = v.trim();
    return t === "" ? null : t;
  }
  return v;
};

export const optText = (max = 1000) => z.preprocess(emptyToNull, z.string().max(max, `Max ${max} characters`).nullable());
export const reqText = (msg: string, max = 200) =>
  z.preprocess((v) => (typeof v === "string" ? v.trim() : v), z.string({ required_error: msg }).min(1, msg).max(max));
export const optId = z.preprocess(emptyToNull, z.string().max(64).nullable());
export const reqId = z.string().min(1).max(64);
export const optEmail = z.preprocess(emptyToNull, z.string().email("Invalid email address").max(200).nullable());
export const optInt = (min = 0) =>
  z.preprocess((v) => {
    const e = emptyToNull(v);
    if (e == null) return null;
    if (typeof e === "number") return e;
    const n = Number(String(e).replace(/[.\s₺]/g, "").replace(",", "."));
    return Number.isFinite(n) ? Math.round(n) : NaN;
  }, z.number({ invalid_type_error: "Must be a number" }).int().min(min, `Must be ≥ ${min}`).max(1_000_000_000).nullable());
export const optDate = z.preprocess((v) => {
  const e = emptyToNull(v);
  if (e == null) return null;
  return e instanceof Date ? e : new Date(String(e));
}, z.date({ invalid_type_error: "Invalid date" }).nullable());
export const reqDate = (msg: string) =>
  z.preprocess((v) => {
    const e = emptyToNull(v);
    return e == null ? undefined : new Date(String(e));
  }, z.date({ required_error: msg, invalid_type_error: "Invalid date" }));
export const bool = z.preprocess((v) => v === true || v === "on" || v === "true" || v === "1", z.boolean());
const optEnum = <T extends readonly [string, ...string[]]>(values: T) => z.preprocess(emptyToNull, z.enum(values).nullable());
const phone = z.preprocess(
  emptyToNull,
  z
    .string()
    .max(40)
    .refine((v) => v.replace(/\D/g, "").length >= 7, "Enter a valid phone number")
    .nullable(),
);

// ─── Leads ───────────────────────────────────────────────────────────────────

export const leadCreateSchema = z
  .object({
    businessId: optId,
    businessName: optText(160),
    contactId: optId,
    contactName: optText(120),
    phone,
    email: optEmail,
    instagram: optText(120),
    website: optText(200),
    city: optText(80),
    district: optText(80),
    businessType: optEnum(BUSINESS_TYPES),
    branchCount: optInt(1),
    sourceId: optId,
    ownerId: optId,
    campaignId: optId,
    value: optInt(0),
    notes: optText(4000),
  })
  .superRefine((v, ctx) => {
    if (!v.businessId && !v.businessName)
      ctx.addIssue({ code: "custom", path: ["businessName"], message: "Business name is required" });
    if (!v.contactId && !v.phone) ctx.addIssue({ code: "custom", path: ["phone"], message: "Phone is required" });
  });

export const leadUpdateSchema = z.object({
  id: reqId,
  ownerId: optId,
  sourceId: optId,
  campaignId: optId,
  contactId: optId,
  value: optInt(0),
  proposalInterest: bool,
  demoDate: optDate,
  notes: optText(4000),
});

export const stageChangeSchema = z.object({
  id: reqId,
  status: z.enum(LEAD_STATUSES),
  value: optInt(0).optional(),
  lostReason: optText(500).optional(),
  demoDate: optDate.optional(),
});

export const logActivitySchema = z
  .object({
    leadId: optId,
    businessId: optId,
    type: z.enum(LOGGABLE_ACTIVITY_TYPES),
    body: optText(5000),
    occurredAt: optDate,
  })
  .superRefine((v, ctx) => {
    if (!v.leadId && !v.businessId) ctx.addIssue({ code: "custom", path: ["_form"], message: "Missing lead or business" });
    if (v.type === "NOTE" && !v.body) ctx.addIssue({ code: "custom", path: ["body"], message: "Write the note" });
  });

// ─── Follow-ups ──────────────────────────────────────────────────────────────

export const followUpCreateSchema = z.object({
  leadId: reqId,
  dueAt: reqDate("Pick a follow-up date"),
  note: optText(500),
  ownerId: optId,
});

export const followUpCompleteSchema = z.object({
  id: reqId,
  outcome: optText(2000),
  nextDueAt: optDate,
  nextNote: optText(500),
});

// ─── Businesses / contacts ───────────────────────────────────────────────────

export const businessSchema = z.object({
  id: optId,
  name: reqText("Business name is required", 160),
  type: optEnum(BUSINESS_TYPES),
  city: optText(80),
  district: optText(80),
  address: optText(300),
  instagram: optText(120),
  website: optText(200),
  branchCount: optInt(1),
  status: z.preprocess(emptyToNull, z.enum(BUSINESS_STATUSES).nullable()),
  notes: optText(4000),
});

export const contactSchema = z
  .object({
    id: optId,
    businessId: reqId,
    name: reqText("Name is required", 120),
    role: optText(80),
    phone,
    email: optEmail,
    isPrimary: bool,
  });

// ─── Tasks ───────────────────────────────────────────────────────────────────

export const taskSchema = z.object({
  id: optId,
  title: reqText("Title is required", 200),
  description: optText(4000),
  ownerId: optId,
  leadId: optId,
  businessId: optId,
  projectId: optId.optional(), // omitted ⇒ unchanged on edit
  dueAt: optDate,
  priority: z.preprocess((v) => emptyToNull(v) ?? "MEDIUM", z.enum(TASK_PRIORITIES)),
  status: z.preprocess((v) => emptyToNull(v) ?? "TODO", z.enum(TASK_STATUSES)),
});

// ─── Campaigns / content ─────────────────────────────────────────────────────

export const campaignSchema = z
  .object({
    id: optId,
    name: reqText("Campaign name is required", 160),
    description: optText(4000),
    channel: z.enum(CAMPAIGN_CHANNELS, { errorMap: () => ({ message: "Pick a channel" }) }),
    startDate: optDate,
    endDate: optDate,
    budget: optInt(0),
    spend: optInt(0),
    ownerId: optId,
    status: z.preprocess((v) => emptyToNull(v) ?? "DRAFT", z.enum(CAMPAIGN_STATUSES)),
  })
  .superRefine((v, ctx) => {
    if (v.startDate && v.endDate && v.endDate < v.startDate)
      ctx.addIssue({ code: "custom", path: ["endDate"], message: "End date must be after start date" });
  });

export const contentSchema = z.object({
  id: optId,
  title: reqText("Title is required", 200),
  platform: z.enum(CONTENT_PLATFORMS),
  format: z.enum(CONTENT_FORMATS),
  campaignId: optId,
  ownerId: optId,
  status: z.preprocess((v) => emptyToNull(v) ?? "IDEA", z.enum(CONTENT_STATUSES)),
  publishAt: optDate,
  url: optText(500),
  views: optInt(0),
  likes: optInt(0),
  saves: optInt(0),
  shares: optInt(0),
  leadsGenerated: optInt(0),
  notes: optText(4000),
});

// ─── Users / settings ────────────────────────────────────────────────────────

const password = z.string().min(8, "At least 8 characters").max(200);

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password").max(200),
});

export const userCreateSchema = z.object({
  name: reqText("Name is required", 120),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  role: z.enum(ROLES),
  password,
});

export const userUpdateSchema = z.object({
  id: reqId,
  name: reqText("Name is required", 120),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  role: z.enum(ROLES),
});

export const profileSchema = z.object({
  name: reqText("Name is required", 120),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
});

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: password,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords don't match" });

export const leadSourceSchema = z.object({
  id: optId,
  name: reqText("Name is required", 60),
});

export const setupSchema = z
  .object({
    name: reqText("Name is required", 120),
    email: z.string().trim().toLowerCase().email("Enter a valid email"),
    password,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords don't match" });

export const projectSchema = z
  .object({
    id: optId,
    name: reqText("Project name is required", 160),
    description: optText(4000),
    team: z.preprocess((v) => emptyToNull(v) ?? "GENERAL", z.enum(PROJECT_TEAMS)),
    status: z.preprocess((v) => emptyToNull(v) ?? "PLANNING", z.enum(PROJECT_STATUSES)),
    priority: z.preprocess((v) => emptyToNull(v) ?? "MEDIUM", z.enum(TASK_PRIORITIES)),
    ownerId: optId,
    startDate: optDate,
    dueDate: optDate,
  })
  .superRefine((v, ctx) => {
    if (v.startDate && v.dueDate && v.dueDate < v.startDate)
      ctx.addIssue({ code: "custom", path: ["dueDate"], message: "Due date must be after start date" });
  });

export const playbookSchema = z.object({
  id: optId,
  category: z.enum(PLAYBOOK_CATEGORIES, { errorMap: () => ({ message: "Pick a category" }) }),
  stage: z.preprocess(emptyToNull, z.enum(LEAD_STATUSES).nullable()),
  title: reqText("Title is required", 160),
  body: reqText("Write the script", 10000),
});

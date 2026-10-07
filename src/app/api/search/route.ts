import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can, projectVisibilityWhere } from "@/lib/permissions";
import { digitsOnly, fold } from "@/lib/utils";
import { LEAD_STATUS_LABELS, label } from "@/lib/constants";

export const dynamic = "force-dynamic";

type Hit = { id: string; title: string; subtitle?: string; href: string };

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = (req.nextUrl.searchParams.get("q") ?? "").slice(0, 100);
  const key = fold(q);
  const digits = digitsOnly(q);
  if (key.length < 2 && digits.length < 3) return NextResponse.json({ businesses: [], contacts: [], leads: [], campaigns: [], projects: [] });

  const sales = can(user, "leads");
  const marketing = can(user, "campaigns");
  const phoneMatch = digits.length >= 3 ? [{ searchKey: { contains: digits } }] : [];

  const [businesses, contacts, leads, campaigns, projects] = await Promise.all([
    sales
      ? db.business.findMany({
          where: { deletedAt: null, searchKey: { contains: key } },
          select: { id: true, name: true, city: true, district: true, status: true },
          take: 6,
        })
      : [],
    sales
      ? db.contact.findMany({
          where: { business: { deletedAt: null }, OR: [{ searchKey: { contains: key } }, ...phoneMatch] },
          select: { id: true, name: true, phone: true, email: true, role: true, business: { select: { id: true, name: true } } },
          take: 6,
        })
      : [],
    sales
      ? db.lead.findMany({
          where: { deletedAt: null, OR: [{ searchKey: { contains: key } }, ...phoneMatch] },
          select: { id: true, status: true, business: { select: { name: true } }, owner: { select: { name: true } } },
          orderBy: { updatedAt: "desc" },
          take: 6,
        })
      : [],
    marketing
      ? db.campaign.findMany({
          where: { deletedAt: null, searchKey: { contains: key } },
          select: { id: true, name: true, status: true, channel: true },
          take: 5,
        })
      : [],
    can(user, "projects")
      ? db.project.findMany({
          where: { AND: [projectVisibilityWhere(user), { searchKey: { contains: key } }] },
          select: { id: true, name: true, status: true, team: true },
          take: 5,
        })
      : [],
  ]);

  return NextResponse.json({
    businesses: businesses.map<Hit>((b) => ({
      id: b.id,
      title: b.name,
      subtitle: [b.district, b.city].filter(Boolean).join(", "),
      href: `/businesses/${b.id}`,
    })),
    contacts: contacts.map<Hit>((c) => ({
      id: c.id,
      title: c.name,
      subtitle: [c.business.name, c.phone, c.email].filter(Boolean).join(" · "),
      href: `/businesses/${c.business.id}?tab=contacts`,
    })),
    leads: leads.map<Hit>((l) => ({
      id: l.id,
      title: l.business.name,
      subtitle: [label(LEAD_STATUS_LABELS, l.status), l.owner?.name].filter(Boolean).join(" · "),
      href: `/leads/${l.id}`,
    })),
    campaigns: campaigns.map<Hit>((c) => ({ id: c.id, title: c.name, subtitle: c.status.toLowerCase(), href: `/campaigns/${c.id}` })),
    projects: projects.map<Hit>((p) => ({ id: p.id, title: p.name, subtitle: `${p.team.toLowerCase()} · ${p.status.toLowerCase().replace("_", " ")}`, href: `/projects/${p.id}` })),
  });
}

// Demo / seed data for BUYUR Growth & Sales Panel.
// Usage: `npm run db:seed` (wipes and re-creates demo data).
// Plain JS on purpose: runs in the production image without TypeScript tooling.

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { ensurePlaybook } from "./playbook-defaults.mjs";
import { fileURLToPath } from "node:url";
import path from "node:path";

export const DEMO_PASSWORD = "Buyur2026!";

const DAY = 86_400_000;
const now = new Date();
const daysAgo = (d, h = 10, m = 0) => {
  const x = new Date(now.getTime() - d * DAY);
  x.setHours(h, m, 0, 0);
  return x;
};
const daysAhead = (d, h = 11, m = 0) => daysAgo(-d, h, m);

const fold = (s) =>
  (s ?? "")
    .replace(/İ/g, "i")
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
const digits = (s) => (s ?? "").replace(/\D/g, "");

const STATUS_ORDER = ["NEW", "CONTACTED", "QUALIFIED", "DEMO_SCHEDULED", "DEMO_COMPLETED", "TRIAL", "NEGOTIATION", "WON", "LOST"];
const MILESTONES = [
  ["CONTACTED", "contactedAt"],
  ["QUALIFIED", "qualifiedAt"],
  ["DEMO_SCHEDULED", "demoScheduledAt"],
  ["DEMO_COMPLETED", "demoCompletedAt"],
  ["TRIAL", "trialAt"],
  ["NEGOTIATION", "negotiationAt"],
  ["WON", "wonAt"],
];

// name, type, city, district, branches, instagram, website, contact, role, phone
const BUSINESSES = [
  ["Minoa Cafe", "CAFE", "İstanbul", "Moda", 1, "@minoacafe", null, "Elif Aksoy", "Owner", "0532 411 20 15"],
  ["Burger Lab", "FAST_FOOD", "İstanbul", "Beşiktaş", 3, "@burgerlab.ist", "burgerlab.com.tr", "Kerem Öztürk", "Operations Manager", "0533 287 66 10"],
  ["Lokal Kitchen", "RESTAURANT", "İstanbul", "Kadıköy", 2, "@lokalkitchen", "lokalkitchen.com", "Zeynep Çelik", "Co-founder", "0542 330 18 77"],
  ["Kahve Durağı", "CAFE", "Ankara", "Çankaya", 4, "@kahveduragi", "kahveduragi.com", "Murat Yıldız", "Owner", "0535 902 44 31"],
  ["Çınaraltı Ocakbaşı", "KEBAB", "İstanbul", "Üsküdar", 1, null, null, "Hasan Kılıç", "Owner", "0216 334 55 12"],
  ["Mavi Balık Evi", "RESTAURANT", "İzmir", "Alsancak", 2, "@mavibalikevi", "mavibalik.com", "Deniz Aydın", "General Manager", "0532 718 09 42"],
  ["Simit & Co", "BAKERY", "İstanbul", "Şişli", 6, "@simitandco", "simitandco.com", "Burak Şen", "Franchise Manager", "0544 120 73 38"],
  ["Pide Atölyesi", "RESTAURANT", "Bursa", "Nilüfer", 1, "@pideatolyesi", null, "Cem Doğan", "Owner", "0530 455 81 26"],
  ["Lavanta Pastanesi", "BAKERY", "İzmir", "Karşıyaka", 2, "@lavantapastane", null, "Ayşe Koç", "Owner", "0536 663 27 90"],
  ["Köşe Bistro", "RESTAURANT", "İstanbul", "Cihangir", 1, "@kosebistro", "kosebistro.com", "Selim Avcı", "Chef / Owner", "0532 104 66 58"],
  ["Ege Sofrası", "RESTAURANT", "Muğla", "Bodrum", 1, "@egesofrasi", null, "Gül Turan", "Manager", "0252 316 40 22"],
  ["Nar Meyhane", "BAR", "İstanbul", "Beyoğlu", 1, "@narmeyhane", null, "Orhan Polat", "Owner", "0537 882 15 03"],
  ["Kuzu Döner House", "KEBAB", "Ankara", "Kızılay", 5, "@kuzudonerhouse", "kuzudoner.com", "Emre Yalçın", "Brand Manager", "0541 207 39 64"],
  ["Moda Brunch", "BREAKFAST", "İstanbul", "Moda", 1, "@modabrunch", null, "İrem Kurt", "Owner", "0538 590 12 47"],
  ["Fırın 34", "BAKERY", "İstanbul", "Ataşehir", 3, "@firin34", "firin34.com", "Okan Erdem", "Owner", "0532 777 34 34"],
  ["Zeytin Dalı", "RESTAURANT", "İzmir", "Urla", 1, "@zeytindaliurla", "zeytindali.com", "Seda Güneş", "Owner", "0533 640 21 85"],
  ["Ada Kahvaltı Evi", "BREAKFAST", "İstanbul", "Büyükada", 1, null, null, "Levent Aras", "Owner", "0216 382 11 09"],
  ["Bakır Cezve", "CAFE", "Eskişehir", "Odunpazarı", 2, "@bakircezve", null, "Nihan Uçar", "Co-owner", "0543 312 58 70"],
  ["Tava & Taş", "RESTAURANT", "Antalya", "Kaleiçi", 1, "@tavaveitas", "tavavetas.com", "Barış Özkan", "General Manager", "0532 249 63 18"],
  ["Sakız Dondurma", "CAFE", "İstanbul", "Bebek", 2, "@sakizdondurma", null, "Melis Er", "Marketing", "0535 118 47 92"],
  ["Halit Usta Lokantası", "RESTAURANT", "İstanbul", "Fatih", 1, null, null, "Halit Bayram", "Owner", "0212 528 70 61"],
  ["Gurme Köfte", "FAST_FOOD", "Kocaeli", "İzmit", 4, "@gurmekofte", "gurmekofte.com", "Tolga Aksu", "Operations", "0539 401 22 76"],
];

export async function seed(prisma) {
  console.log("→ Clearing existing data…");
  await prisma.$transaction([
    prisma.notification.deleteMany(),
    prisma.playbookEntry.deleteMany(),
    prisma.activity.deleteMany(),
    prisma.followUp.deleteMany(),
    prisma.task.deleteMany(),
    prisma.project.deleteMany(),
    prisma.content.deleteMany(),
    prisma.lead.deleteMany(),
    prisma.contact.deleteMany(),
    prisma.business.deleteMany(),
    prisma.campaign.deleteMany(),
    prisma.leadSource.deleteMany(),
    prisma.session.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  console.log("→ Users");
  const hash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const mk = (email, name, role) => prisma.user.create({ data: { email, name, role, passwordHash: hash } });
  const admin = await mk("admin@buyur.in", "Deniz Arslan", "ADMIN");
  const ahmet = await mk("ahmet@buyur.in", "Ahmet Kaya", "SALES");
  const selin = await mk("selin@buyur.in", "Selin Demir", "SALES");
  const ece = await mk("ece@buyur.in", "Ece Şahin", "MARKETING");
  await mk("mert@buyur.in", "Mert Yıldırım", "PROJECT");
  const sellers = [ahmet, selin, ahmet, selin, admin];

  console.log("→ Lead sources");
  const sourceNames = ["Instagram", "Meta Ads", "Cold Outreach", "Website", "Referral", "Event", "Partner", "Other"];
  const sources = {};
  for (const [i, name] of sourceNames.entries()) {
    sources[name] = await prisma.leadSource.create({ data: { name, sortOrder: i } });
  }

  console.log("→ Campaigns");
  const camp = async (data, createdDaysAgo) =>
    prisma.campaign.create({ data: { ...data, searchKey: fold(data.name), createdAt: daysAgo(createdDaysAgo) } });
  const october = await camp(
    { name: "October Acquisition", channel: "META_ADS", status: "ACTIVE", budget: 40000, spend: 18650, ownerId: ece.id, startDate: daysAgo(20), endDate: daysAhead(25), description: "Meta lead ads targeting cafe & restaurant owners in İstanbul. Offer: free QR menu setup." },
    22,
  );
  const reels = await camp(
    { name: "Instagram Reels — QR Menü", channel: "INSTAGRAM", status: "ACTIVE", budget: 12000, spend: 7400, ownerId: ece.id, startDate: daysAgo(45), endDate: daysAhead(15), description: "Organic + boosted reels showing 5-minute menu setup." },
    46,
  );
  const outreach = await camp(
    { name: "Kadıköy Cold Outreach", channel: "COLD_OUTREACH", status: "ACTIVE", budget: 5000, spend: 2100, ownerId: admin.id, startDate: daysAgo(35), endDate: null, description: "Door-to-door + WhatsApp outreach in Kadıköy & Moda." },
    36,
  );
  const summer = await camp(
    { name: "Summer Coast Push", channel: "META_ADS", status: "COMPLETED", budget: 25000, spend: 24300, ownerId: ece.id, startDate: daysAgo(110), endDate: daysAgo(50), description: "Coastal restaurants (İzmir, Bodrum, Antalya) before tourist season." },
    112,
  );
  await camp(
    { name: "Referral Program v1", channel: "REFERRAL", status: "DRAFT", budget: 8000, spend: 0, ownerId: ece.id, startDate: daysAhead(7), endDate: null, description: "1 month free for each referred restaurant." },
    3,
  );
  const campaignBySource = { "Meta Ads": october, Instagram: reels, "Cold Outreach": outreach };

  console.log("→ Businesses & contacts");
  const businesses = [];
  for (const [i, b] of BUSINESSES.entries()) {
    const [name, type, city, district, branchCount, instagram, website, cName, cRole, phone] = b;
    const created = daysAgo(70 - i * 3);
    const biz = await prisma.business.create({
      data: {
        name, type, city, district, branchCount, instagram, website,
        address: `${district}, ${city}`,
        searchKey: [fold(name), fold(city), fold(district), fold(instagram)].filter(Boolean).join(" | "),
        createdAt: created,
      },
    });
    const contact = await prisma.contact.create({
      data: {
        businessId: biz.id, name: cName, role: cRole, phone, phoneDigits: digits(phone), isPrimary: true,
        email: `${fold(cName).split(" ")[0]}@${website ?? "gmail.com"}`,
        searchKey: [fold(cName), digits(phone)].join(" | "),
        createdAt: created,
      },
    });
    if (i % 4 === 1) {
      await prisma.contact.create({
        data: {
          businessId: biz.id, name: ["Can Yılmaz", "Pelin Ateş", "Mert Şimşek", "Derya Bal", "Kaan Uysal", "Buse Tan"][i % 6], role: "Manager",
          phone: `0532 ${100 + i} ${10 + i} ${20 + i}`, phoneDigits: digits(`0532 ${100 + i} ${10 + i} ${20 + i}`),
          searchKey: "", createdAt: created,
        },
      });
    }
    businesses.push({ biz, contact });
  }

  console.log("→ Leads, activities & follow-ups");
  // [businessIndex, status, sourceName, createdDaysAgo, value, proposalInterest, staleDays]
  const LEADS = [
    [0, "DEMO_SCHEDULED", "Instagram", 12, 9600, false, 0],
    [1, "NEGOTIATION", "Meta Ads", 18, 28800, true, 1],
    [2, "DEMO_COMPLETED", "Cold Outreach", 25, 14400, true, 0],
    [3, "WON", "Referral", 40, 36000, true, 0],
    [4, "NEW", "Cold Outreach", 1, 7200, false, 0],
    [5, "WON", "Meta Ads", 75, 19200, true, 0],
    [6, "TRIAL", "Website", 30, 54000, true, 2],
    [7, "CONTACTED", "Instagram", 6, 7200, false, 5],
    [8, "QUALIFIED", "Instagram", 9, 9600, false, 4],
    [9, "CONTACTED", "Cold Outreach", 4, 8400, false, 0],
    [10, "LOST", "Meta Ads", 80, 9600, false, 0],
    [11, "NEW", "Meta Ads", 2, 7200, false, 0],
    [12, "NEGOTIATION", "Partner", 28, 48000, true, 0],
    [13, "QUALIFIED", "Cold Outreach", 8, 8400, false, 0],
    [14, "WON", "Meta Ads", 16, 26400, true, 0],
    [15, "DEMO_SCHEDULED", "Meta Ads", 7, 9600, false, 0],
    [16, "NEW", "Website", 0, 6000, false, 0],
    [17, "QUALIFIED", "Event", 14, 12000, false, 6],
    [18, "TRIAL", "Instagram", 21, 9600, true, 0],
    [19, "CONTACTED", "Meta Ads", 5, 9600, false, 3],
    [20, "NEW", "Cold Outreach", 3, 6000, false, 3],
    [21, "LOST", "Meta Ads", 33, 31200, true, 0],
    [2, "NEW", "Referral", 0, 0, false, 0],
    [8, "WON", "Instagram", 52, 8400, false, 0],
    [13, "NEW", "Instagram", 1, 7200, false, 0],
    [19, "DEMO_SCHEDULED", "Referral", 10, 9600, false, 0],
  ];

  const notes = [
    "Owner wants printed QR stands for every table.",
    "Currently using PDF menu on Google Drive — pain with price updates.",
    "Asked about English & Arabic menu for tourists.",
    "Interested in product analytics: which dishes get viewed.",
    "Has 3 branches; wants central price management.",
    "Called back, decision maker is the co-founder.",
  ];
  const callNotes = [
    "Quick intro call, sent the demo menu link.",
    "Discussed pricing, wants a discount for multiple branches.",
    "Owner busy during lunch, call back after 15:00.",
    "Walked through the panel, liked the instant price updates.",
  ];

  let leadIdx = 0;
  for (const [bi, status, sourceName, createdDays, value, proposal, staleDays] of LEADS) {
    const { biz, contact } = businesses[bi];
    const owner = status === "NEW" && leadIdx % 3 === 0 ? null : sellers[leadIdx % sellers.length];
    const createdAt = daysAgo(createdDays, 9 + (leadIdx % 6), (leadIdx * 7) % 60);
    const source = sources[sourceName];
    const campaign = campaignBySource[sourceName] && createdDays <= 45 ? campaignBySource[sourceName] : createdDays > 45 && sourceName === "Meta Ads" ? summer : null;

    const lead = await prisma.lead.create({
      data: {
        businessId: biz.id, contactId: contact.id, ownerId: owner?.id ?? null, sourceId: source.id, campaignId: campaign?.id ?? null,
        status, value, proposalInterest: proposal, createdAt, stageChangedAt: createdAt,
        notes: leadIdx % 2 === 0 ? notes[leadIdx % notes.length] : null,
        searchKey: [fold(biz.name), fold(contact.name), digits(contact.phone), fold(biz.city), fold(biz.district)].join(" | "),
      },
    });

    const actorId = owner?.id ?? admin.id;
    const acts = [];
    acts.push({ type: "LEAD_CREATED", userId: actorId, createdAt, body: lead.notes, metadata: { name: biz.name } });

    // Walk through milestones up to the target status, spreading timestamps between created and now - staleDays
    const target = status === "LOST" ? Math.min(3, 1 + (leadIdx % 3)) : STATUS_ORDER.indexOf(status);
    const end = new Date(now.getTime() - Math.max(staleDays, 0.2) * DAY);
    const span = Math.max(end.getTime() - createdAt.getTime(), DAY / 4);
    const data = {};
    let prev = "NEW";
    let lastAt = createdAt;
    const steps = MILESTONES.filter(([st]) => STATUS_ORDER.indexOf(st) <= target);
    steps.forEach(([st, field], k) => {
      const at = new Date(createdAt.getTime() + (span * (k + 1)) / (steps.length + (status === "LOST" ? 1 : 0)));
      data[field] = at;
      if (k === 0) {
        acts.push({ type: k % 2 === 0 ? "CALL" : "WHATSAPP", userId: actorId, createdAt: new Date(at.getTime() - 3600_000), body: callNotes[leadIdx % callNotes.length], metadata: { name: biz.name } });
      }
      acts.push({ type: "STATUS_CHANGE", userId: actorId, createdAt: at, metadata: { name: biz.name, from: prev, to: st } });
      if (st === "DEMO_COMPLETED") acts.push({ type: "DEMO", userId: actorId, createdAt: new Date(at.getTime() - 1800_000), body: "Showed QR menu + multi-language + analytics.", metadata: { name: biz.name } });
      if (st === "WON") acts.push({ type: "DEAL_WON", userId: actorId, createdAt: at, metadata: { name: biz.name, value } });
      prev = st;
      lastAt = at;
    });
    if (status === "LOST") {
      const at = new Date(end.getTime());
      data.lostAt = at;
      data.lostReason = leadIdx % 2 ? "Chose a competitor with POS integration" : "Not ready — revisit next season";
      acts.push({ type: "STATUS_CHANGE", userId: actorId, createdAt: at, metadata: { name: biz.name, from: prev, to: "LOST" } });
      acts.push({ type: "DEAL_LOST", userId: actorId, createdAt: at, body: data.lostReason, metadata: { name: biz.name, reason: data.lostReason } });
      lastAt = at;
    }
    if (leadIdx % 3 === 0 && status !== "NEW") {
      const at = new Date(lastAt.getTime() - 2 * 3600_000);
      acts.push({ type: "NOTE", userId: actorId, createdAt: at > createdAt ? at : createdAt, body: notes[(leadIdx + 2) % notes.length], metadata: { name: biz.name } });
    }
    if (status === "DEMO_SCHEDULED") data.demoDate = daysAhead(leadIdx % 3 === 0 ? 0 : (leadIdx % 4) + 1, leadIdx % 3 === 0 ? 15 : 11, leadIdx % 3 === 0 ? 30 : 0);

    for (const a of acts) {
      await prisma.activity.create({
        data: {
          type: a.type, userId: a.userId, entityType: "LEAD", entityId: lead.id, leadId: lead.id, businessId: biz.id,
          campaignId: campaign?.id ?? null, body: a.body ?? null, metadata: JSON.stringify(a.metadata), createdAt: a.createdAt,
        },
      });
    }
    const lastActivityAt = acts.reduce((m, a) => (a.createdAt > m ? a.createdAt : m), createdAt);
    await prisma.lead.update({ where: { id: lead.id }, data: { ...data, stageChangedAt: lastAt, lastActivityAt } });
    if (status === "WON") await prisma.business.update({ where: { id: biz.id }, data: { status: "CUSTOMER" } });

    // Follow-ups for open leads
    const open = !["WON", "LOST"].includes(status);
    if (open && owner) {
      const pattern = leadIdx % 4;
      const dueAt =
        pattern === 0 ? daysAgo(2, 11) : pattern === 1 ? daysAhead(0, 14, 30) : pattern === 2 ? daysAhead(2, 10) : daysAgo(1, 16);
      const fnotes = ["Call owner about pricing", "Send demo recording", "Check if trial menu is live", "WhatsApp: share case study"];
      await prisma.followUp.create({ data: { leadId: lead.id, ownerId: owner.id, dueAt, note: fnotes[pattern], createdAt: lastActivityAt } });
      await prisma.followUp.create({
        data: { leadId: lead.id, ownerId: owner.id, dueAt: new Date(createdAt.getTime() + DAY), note: "First touch", completedAt: new Date(createdAt.getTime() + DAY), completedById: owner.id, createdAt },
      });
    }
    leadIdx++;
  }

  console.log("→ Tasks");
  const leadsAll = await prisma.lead.findMany({ include: { business: true } });
  const byName = (n) => leadsAll.find((l) => l.business.name === n);
  const tasks = [
    ["Prepare proposal for Burger Lab (3 branches)", ahmet, byName("Burger Lab"), daysAhead(0, 17), "HIGH", "IN_PROGRESS"],
    ["Send printed QR stand samples to Simit & Co", selin, byName("Simit & Co"), daysAgo(1, 12), "HIGH", "TODO"],
    ["Update pricing deck with annual plan", admin, null, daysAhead(3, 12), "MEDIUM", "TODO"],
    ["Record 5-min setup reel", ece, null, daysAhead(1, 15), "MEDIUM", "IN_PROGRESS"],
    ["Brief designer for October carousel", ece, null, daysAgo(2, 10), "LOW", "TODO"],
    ["Onboard Kahve Durağı menu (4 branches)", ahmet, byName("Kahve Durağı"), daysAgo(5, 10), "HIGH", "DONE"],
    ["Check Kuzu Döner House legal review", selin, byName("Kuzu Döner House"), daysAhead(2, 11), "MEDIUM", "TODO"],
    ["Weekly pipeline review", admin, null, daysAhead(0, 16), "MEDIUM", "TODO"],
    ["Collect testimonial from Mavi Balık Evi", ece, null, daysAhead(6, 11), "LOW", "TODO"],
    ["Translate menu to Arabic for Tava & Taş", ahmet, byName("Tava & Taş"), daysAhead(4, 10), "MEDIUM", "TODO"],
  ];
  for (const [title, owner, lead, dueAt, priority, status] of tasks) {
    const t = await prisma.task.create({
      data: {
        title, ownerId: owner.id, createdById: admin.id, leadId: lead?.id ?? null, businessId: lead?.businessId ?? null, dueAt, priority, status,
        completedAt: status === "DONE" ? daysAgo(4) : null, createdAt: daysAgo(7),
      },
    });
    await prisma.activity.create({
      data: { type: "TASK_CREATED", userId: admin.id, entityType: "TASK", entityId: t.id, leadId: lead?.id ?? null, businessId: lead?.businessId ?? null, metadata: JSON.stringify({ name: title }), createdAt: daysAgo(7, 9) },
    });
  }

  console.log("→ Content");
  const contents = [
    ["QR menü 5 dakikada — kurulum reels", "INSTAGRAM", "REEL", reels, "PUBLISHED", daysAgo(20), 48200, 2310, 640, 290, 9],
    ["Fiyat değişikliği anında menüde", "INSTAGRAM", "CAROUSEL", reels, "PUBLISHED", daysAgo(12), 21400, 980, 410, 120, 4],
    ["8 dilde menü — turist masası", "TIKTOK", "VIDEO", reels, "PUBLISHED", daysAgo(8), 67900, 4100, 820, 530, 6],
    ["Restoran sahipleri için 3 hata", "INSTAGRAM", "REEL", october, "SCHEDULED", daysAhead(2, 19), 0, 0, 0, 0, 0],
    ["Müşteri hikayesi: Kahve Durağı", "LINKEDIN", "POST", null, "APPROVAL", daysAhead(4, 10), 0, 0, 0, 0, 0],
    ["Hangi ürün daha çok bakılıyor? Analitik", "INSTAGRAM", "CAROUSEL", october, "DESIGN", null, 0, 0, 0, 0, 0],
    ["Baskı maliyeti hesaplayıcı", "INSTAGRAM", "STORY", null, "SCRIPT", null, 0, 0, 0, 0, 0],
    ["Kafe sahibiyle 1 gün", "YOUTUBE", "VIDEO", null, "IDEA", null, 0, 0, 0, 0, 0],
    ["Kalori & alerjen bilgisi neden önemli", "X", "POST", null, "IDEA", null, 0, 0, 0, 0, 0],
    ["Ekim kampanyası lansman reels", "INSTAGRAM", "REEL", october, "PUBLISHED", daysAgo(18), 35600, 1520, 380, 210, 7],
  ];
  for (const [title, platform, format, campaign, status, publishAt, views, likes, saves, shares, leadsGenerated] of contents) {
    const c = await prisma.content.create({
      data: { title, platform, format, campaignId: campaign?.id ?? null, ownerId: ece.id, status, publishAt, views, likes, saves, shares, leadsGenerated, createdAt: daysAgo(25) },
    });
    if (status === "PUBLISHED") {
      await prisma.activity.create({
        data: { type: "CONTENT_STATUS_CHANGED", userId: ece.id, entityType: "CONTENT", entityId: c.id, campaignId: campaign?.id ?? null, metadata: JSON.stringify({ name: title, to: "Published" }), createdAt: publishAt },
      });
    }
  }

  // Campaign creation activities
  for (const c of [october, reels, outreach]) {
    await prisma.activity.create({
      data: { type: "CAMPAIGN_CREATED", userId: c.ownerId, entityType: "CAMPAIGN", entityId: c.id, campaignId: c.id, metadata: JSON.stringify({ name: c.name }), createdAt: c.createdAt },
    });
  }

  console.log("→ Projects");
  const proj = async (data, tasks) => {
    const p = await prisma.project.create({ data: { ...data, searchKey: fold(data.name), createdAt: daysAgo(20) } });
    await prisma.activity.create({ data: { type: "PROJECT_CREATED", userId: data.ownerId, entityType: "PROJECT", entityId: p.id, metadata: JSON.stringify({ name: p.name }), createdAt: daysAgo(20) } });
    for (const [title, owner, status, due, priority] of tasks) {
      await prisma.task.create({
        data: { title, projectId: p.id, ownerId: owner.id, createdById: data.ownerId, status, dueAt: due, priority, completedAt: status === "DONE" ? daysAgo(2) : null, createdAt: daysAgo(15) },
      });
    }
  };
  await proj(
    { name: "Q4 Instagram relaunch", description: "New grid, 3 reels/week, bio link to QR demo.", team: "MARKETING", status: "ACTIVE", priority: "HIGH", ownerId: ece.id, startDate: daysAgo(14), dueDate: daysAhead(21) },
    [
      ["Moodboard & grid template", ece, "DONE", daysAgo(8), "MEDIUM"],
      ["Shoot 6 reels at customer cafes", ece, "IN_PROGRESS", daysAhead(3), "HIGH"],
      ["Write captions (TR + EN)", ece, "TODO", daysAhead(6), "MEDIUM"],
      ["Set up link-in-bio to demo menu", admin, "TODO", daysAgo(1), "HIGH"],
    ],
  );
  await proj(
    { name: "Kadıköy door-to-door sprint", description: "Visit 40 cafes in Moda & Kadıköy in two weeks.", team: "SALES", status: "ACTIVE", priority: "HIGH", ownerId: ahmet.id, startDate: daysAgo(7), dueDate: daysAhead(7) },
    [
      ["Print 200 demo QR stands", selin, "DONE", daysAgo(5), "MEDIUM"],
      ["Route plan: Moda (20 venues)", ahmet, "DONE", daysAgo(4), "MEDIUM"],
      ["Route plan: Kadıköy çarşı (20 venues)", selin, "IN_PROGRESS", daysAhead(1), "MEDIUM"],
      ["Log every visit as a lead", ahmet, "TODO", daysAhead(7), "HIGH"],
    ],
  );
  await proj(
    { name: "Pricing page refresh", description: "Annual plan + multi-branch pricing.", team: "GENERAL", status: "PLANNING", priority: "MEDIUM", ownerId: admin.id, startDate: daysAhead(5), dueDate: daysAhead(35) },
    [
      ["Collect objections from sales calls", selin, "TODO", daysAhead(8), "MEDIUM"],
      ["Draft new tiers", admin, "TODO", daysAhead(14), "HIGH"],
    ],
  );
  await proj(
    { name: "Partner program", description: "POS & supplier partnerships.", team: "SALES", status: "ON_HOLD", priority: "LOW", ownerId: selin.id, startDate: daysAgo(30), dueDate: daysAhead(60) },
    [["List 10 POS vendors", selin, "DONE", daysAgo(20), "LOW"], ["Intro deck", selin, "TODO", null, "LOW"]],
  );

  console.log("→ Sales playbook");
  await ensurePlaybook(prisma);

  console.log("→ Notifications");
  await prisma.notification.createMany({
    data: [
      { userId: ahmet.id, title: "Lead assigned to you: Burger Lab", body: "by Deniz Arslan", href: `/leads/${byName("Burger Lab").id}`, createdAt: daysAgo(1, 9) },
      { userId: selin.id, title: "New task: Send printed QR stand samples to Simit & Co", body: "from Deniz Arslan", href: "/tasks", createdAt: daysAgo(2, 9) },
      { userId: ece.id, title: "New task: Record 5-min setup reel", body: "from Deniz Arslan", href: "/tasks", createdAt: daysAgo(1, 10) },
    ],
  });

  const counts = {
    users: await prisma.user.count(),
    businesses: await prisma.business.count(),
    leads: await prisma.lead.count(),
    activities: await prisma.activity.count(),
    tasks: await prisma.task.count(),
    followUps: await prisma.followUp.count(),
    campaigns: await prisma.campaign.count(),
    content: await prisma.content.count(),
  };
  console.log("✓ Seed complete", counts);
  console.log(`  Demo password for all users: ${DEMO_PASSWORD}`);
}

// Run directly: `node prisma/seed.mjs`
if (process.argv[1] && path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1])) {
  const prisma = new PrismaClient();
  seed(prisma)
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}

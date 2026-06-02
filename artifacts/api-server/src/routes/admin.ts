import { Router } from "express";
import { db, usersTable, listingsTable, chatMessagesTable, announcementsTable, adminSettingsTable, bannedWordsTable, bannersTable, supportTicketsTable, chatRulesTable } from "@workspace/db";
import { eq, desc, ilike, and, sql, asc } from "drizzle-orm";
import { authMiddleware, requireAdmin } from "../middlewares/auth";
import { onlineSockets } from "./chat";
import bcrypt from "bcryptjs";

const router = Router();

function safeId(raw: string | string[] | undefined): number | null {
  const id = parseInt(String(Array.isArray(raw) ? raw[0] : raw ?? ""), 10);
  return isNaN(id) ? null : id;
}

function adminUserJson(u: typeof usersTable.$inferSelect) {
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    displayName: u.displayName ?? null,
    role: u.role,
    avatarUrl: u.avatarUrl,
    bio: u.bio,
    nameColor: u.nameColor,
    nameAnimated: u.nameAnimated,
    isBanned: u.isBanned,
    banReason: u.banReason,
    banExpiresAt: u.banExpiresAt?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
  };
}

router.get("/admin/stats", authMiddleware, requireAdmin, async (_req, res): Promise<void> => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const settings = await db.select().from(adminSettingsTable).limit(1);
  const fakeBonus = settings[0]?.fakeOnlineBonus ?? 0;

  const [totalUsers, totalListings, todayListings, totalMessages, bannedUsers, pendingListings] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(usersTable),
    db.select({ count: sql<number>`count(*)::int` }).from(listingsTable).where(eq(listingsTable.status, "active")),
    db.select({ count: sql<number>`count(*)::int` }).from(listingsTable).where(and(eq(listingsTable.status, "active"), sql`${listingsTable.createdAt} >= ${today}`)),
    db.select({ count: sql<number>`count(*)::int` }).from(chatMessagesTable).where(eq(chatMessagesTable.isDeleted, false)),
    db.select({ count: sql<number>`count(*)::int` }).from(usersTable).where(eq(usersTable.isBanned, true)),
    db.select({ count: sql<number>`count(*)::int` }).from(listingsTable).where(eq(listingsTable.status, "pending")),
  ]);

  res.json({
    totalUsers: totalUsers[0]?.count ?? 0,
    onlineUsers: onlineSockets.size + fakeBonus,
    totalListings: totalListings[0]?.count ?? 0,
    todayListings: todayListings[0]?.count ?? 0,
    totalMessages: totalMessages[0]?.count ?? 0,
    bannedUsers: bannedUsers[0]?.count ?? 0,
    pendingListings: pendingListings[0]?.count ?? 0,
    reportedMessages: 0,
  });
});

router.get("/admin/users", authMiddleware, requireAdmin, async (req, res): Promise<void> => {
  const page = Math.max(1, parseInt(String(req.query["page"] ?? "1"), 10));
  const search = req.query["search"] as string | undefined;
  const limit = 20;
  const offset = (page - 1) * limit;

  const conditions = search ? [ilike(usersTable.username, `%${search}%`)] : [];
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [users, countResult] = await Promise.all([
    db.select().from(usersTable).where(whereClause).orderBy(desc(usersTable.createdAt)).limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(usersTable).where(whereClause),
  ]);

  res.json({ users: users.map(adminUserJson), total: countResult[0]?.count ?? 0 });
});

router.post("/admin/users/:id/ban", authMiddleware, requireAdmin, async (req, res): Promise<void> => {
  const id = safeId(req.params["id"]);
  if (!id) { res.status(400).json({ error: "Geçersiz ID" }); return; }
  const { reason, expiresAt } = req.body as { reason?: string; expiresAt?: string | null };
  if (!reason) { res.status(400).json({ error: "Ban sebebi zorunludur" }); return; }
  await db.update(usersTable).set({ isBanned: true, banReason: reason, banExpiresAt: expiresAt ? new Date(expiresAt) : null }).where(eq(usersTable.id, id));
  res.json({ success: true, message: "Kullanıcı yasaklandı" });
});

router.post("/admin/users/:id/unban", authMiddleware, requireAdmin, async (req, res): Promise<void> => {
  const id = safeId(req.params["id"]);
  if (!id) { res.status(400).json({ error: "Geçersiz ID" }); return; }
  await db.update(usersTable).set({ isBanned: false, banReason: null, banExpiresAt: null }).where(eq(usersTable.id, id));
  res.json({ success: true, message: "Yasak kaldırıldı" });
});

// ─── Admin: reset any user's password ────────────────────────────
router.post("/admin/users/:id/reset-password", authMiddleware, requireAdmin, async (req, res): Promise<void> => {
  const id = safeId(req.params["id"]);
  if (!id) { res.status(400).json({ error: "Geçersiz ID" }); return; }
  const { newPassword } = req.body as { newPassword?: string };
  if (!newPassword || newPassword.length < 6) { res.status(400).json({ error: "Yeni şifre en az 6 karakter olmalıdır" }); return; }
  const hash = await bcrypt.hash(newPassword, 10);
  await db.update(usersTable).set({ passwordHash: hash }).where(eq(usersTable.id, id));
  res.json({ success: true, message: "Şifre sıfırlandı" });
});

// ─── Admin: update user's displayName ────────────────────────────
router.patch("/admin/users/:id/display-name", authMiddleware, requireAdmin, async (req, res): Promise<void> => {
  const id = safeId(req.params["id"]);
  if (!id) { res.status(400).json({ error: "Geçersiz ID" }); return; }
  const { displayName } = req.body as { displayName?: string | null };
  await db.update(usersTable).set({ displayName: displayName?.trim() || null }).where(eq(usersTable.id, id));
  res.json({ success: true });
});

router.post("/admin/create-staff", authMiddleware, requireAdmin, async (req, res): Promise<void> => {
  const { username, email, password, role } = req.body as { username?: string; email?: string; password?: string; role?: string };
  if (!username || !email || !password) { res.status(400).json({ error: "Kullanıcı adı, e-posta ve şifre zorunludur" }); return; }
  const allowedRoles = ["moderator", "admin"];
  const targetRole = allowedRoles.includes(role ?? "") ? role! : "moderator";

  const existing = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existing.length > 0) { res.status(409).json({ error: "Bu e-posta zaten kullanılıyor" }); return; }
  const existingUser = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.username, username)).limit(1);
  if (existingUser.length > 0) { res.status(409).json({ error: "Bu kullanıcı adı zaten kullanılıyor" }); return; }

  const hash = await bcrypt.hash(password, 10);
  const [created] = await db.insert(usersTable).values({ username, email, passwordHash: hash, role: targetRole }).returning({ id: usersTable.id, username: usersTable.username, role: usersTable.role });
  res.status(201).json({ success: true, user: created });
});

router.patch("/admin/users/:id/role", authMiddleware, requireAdmin, async (req, res): Promise<void> => {
  const id = safeId(req.params["id"]);
  if (!id) { res.status(400).json({ error: "Geçersiz ID" }); return; }
  const { role } = req.body as { role?: string };
  if (!role || !["user", "moderator", "admin"].includes(role)) { res.status(400).json({ error: "Geçersiz rol" }); return; }
  await db.update(usersTable).set({ role }).where(eq(usersTable.id, id));
  res.json({ success: true, message: "Rol güncellendi" });
});

router.patch("/admin/users/:id/name-color", authMiddleware, requireAdmin, async (req, res): Promise<void> => {
  const id = safeId(req.params["id"]);
  if (!id) { res.status(400).json({ error: "Geçersiz ID" }); return; }
  const { nameColor, nameAnimated } = req.body as { nameColor?: string | null; nameAnimated?: boolean };
  const updates: Partial<typeof usersTable.$inferInsert> = {};
  if (nameColor !== undefined) updates.nameColor = nameColor ?? null;
  if (nameAnimated !== undefined) updates.nameAnimated = Boolean(nameAnimated);
  await db.update(usersTable).set(updates).where(eq(usersTable.id, id));
  res.json({ success: true, message: "İsim rengi güncellendi" });
});

function settingsJson(s: typeof adminSettingsTable.$inferSelect) {
  return {
    chatLocked: s.chatLocked, fakeOnlineBonus: s.fakeOnlineBonus,
    maintenanceMode: s.maintenanceMode, welcomeMessage: s.welcomeMessage,
    hasOpenaiKey: !!s.openaiApiKey, spamCooldown: s.spamCooldown ?? 3,
    chatAnnounceListings: s.chatAnnounceListings ?? true,
  };
}

router.get("/admin/settings", authMiddleware, requireAdmin, async (_req, res): Promise<void> => {
  const settings = await db.select().from(adminSettingsTable).limit(1);
  if (!settings[0]) {
    const [created] = await db.insert(adminSettingsTable).values({ chatLocked: false, fakeOnlineBonus: 0, maintenanceMode: false }).returning();
    res.json(settingsJson(created));
    return;
  }
  res.json(settingsJson(settings[0]));
});

router.patch("/admin/settings", authMiddleware, requireAdmin, async (req, res): Promise<void> => {
  const { chatLocked, fakeOnlineBonus, maintenanceMode, welcomeMessage, openaiApiKey, spamCooldown, chatAnnounceListings } = req.body as Record<string, unknown>;
  const updates: Partial<typeof adminSettingsTable.$inferInsert> = {};
  if (chatLocked !== undefined) updates.chatLocked = Boolean(chatLocked);
  if (fakeOnlineBonus !== undefined) updates.fakeOnlineBonus = parseInt(String(fakeOnlineBonus), 10);
  if (maintenanceMode !== undefined) updates.maintenanceMode = Boolean(maintenanceMode);
  if (welcomeMessage !== undefined) updates.welcomeMessage = welcomeMessage == null ? null : String(welcomeMessage);
  if (openaiApiKey !== undefined) updates.openaiApiKey = openaiApiKey == null || openaiApiKey === "" ? null : String(openaiApiKey);
  if (spamCooldown !== undefined) updates.spamCooldown = Math.max(0, parseInt(String(spamCooldown), 10) || 0);
  if (chatAnnounceListings !== undefined) updates.chatAnnounceListings = Boolean(chatAnnounceListings);

  const existing = await db.select().from(adminSettingsTable).limit(1);
  let result;
  if (!existing[0]) {
    [result] = await db.insert(adminSettingsTable).values({ chatLocked: false, fakeOnlineBonus: 0, maintenanceMode: false, ...updates }).returning();
  } else {
    [result] = await db.update(adminSettingsTable).set(updates).where(eq(adminSettingsTable.id, existing[0].id)).returning();
  }
  res.json(settingsJson(result!));
});

// ── Smart parser: regex-based, no external API needed ──────────────────────────
const TR_CITIES: Record<string, string> = {
  "istanbul": "İstanbul", "ankara": "Ankara", "izmir": "İzmir", "bursa": "Bursa",
  "antalya": "Antalya", "adana": "Adana", "konya": "Konya", "gaziantep": "Gaziantep",
  "şanlıurfa": "Şanlıurfa", "mersin": "Mersin", "kayseri": "Kayseri", "eskişehir": "Eskişehir",
  "diyarbakır": "Diyarbakır", "samsun": "Samsun", "denizli": "Denizli", "şırnak": "Şırnak",
  "sakarya": "Sakarya", "trabzon": "Trabzon", "manisa": "Manisa", "kocaeli": "Kocaeli",
  "gebze": "Kocaeli", "izmit": "Kocaeli", "hatay": "Hatay", "balıkesir": "Balıkesir",
  "van": "Van", "batman": "Batman", "malatya": "Malatya", "kahramanmaraş": "Kahramanmaraş",
  "erzurum": "Erzurum", "muğla": "Muğla", "bodrum": "Muğla", "marmaris": "Muğla",
  "tekirdağ": "Tekirdağ", "siirt": "Siirt", "afyon": "Afyonkarahisar", "afyonkarahisar": "Afyonkarahisar",
  "aydın": "Aydın", "kütahya": "Kütahya", "çorum": "Çorum", "elazığ": "Elazığ",
  "mardin": "Mardin", "tokat": "Tokat", "sivas": "Sivas", "kastamonu": "Kastamonu",
  "aksaray": "Aksaray", "giresun": "Giresun", "muş": "Muş", "uşak": "Uşak",
  "zonguldak": "Zonguldak", "ordu": "Ordu", "edirne": "Edirne", "bolu": "Bolu",
  "isparta": "Isparta", "karabük": "Karabük", "osmaniye": "Osmaniye", "düzce": "Düzce",
  "yalova": "Yalova", "niğde": "Niğde", "nevşehir": "Nevşehir", "kırıkkale": "Kırıkkale",
  "karaman": "Karaman", "ağrı": "Ağrı", "rize": "Rize", "bingöl": "Bingöl",
  "tunceli": "Tunceli", "hakkari": "Hakkari", "kars": "Kars", "iğdır": "Iğdır",
  "ardahan": "Ardahan", "sinop": "Sinop", "artvin": "Artvin", "gümüşhane": "Gümüşhane",
  "bayburt": "Bayburt", "bitlis": "Bitlis", "erzincan": "Erzincan", "kırşehir": "Kırşehir",
  "yozgat": "Yozgat", "çankırı": "Çankırı", "bilecik": "Bilecik", "amasya": "Amasya",
  "burdur": "Burdur", "çanakkale": "Çanakkale", "kırklareli": "Kırklareli",
  "adıyaman": "Adıyaman", "bartın": "Bartın", "kilis": "Kilis",
};

const ISTANBUL_DISTRICTS = [
  "kadıköy","beşiktaş","şişli","beyoğlu","fatih","üsküdar","maltepe","kartal","pendik",
  "tuzla","ataşehir","umraniye","ümraniye","bağcılar","bahçelievler","bakırköy","başakşehir",
  "beylikdüzü","büyükçekmece","çekmeköy","esenler","esenyurt","eyüpsultan","güngören",
  "küçükçekmece","sarıyer","sultanbeyli","sultangazi","zeytinburnu","arnavutköy","avcılar",
  "sancaktepe","gaziosmanpaşa","kağıthane","silivri","şile","çatalca","adalar","beykoz","sultangazi",
];

function normalizeForLookup(s: string): string {
  return s.toLowerCase()
    .replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ü/g, "u")
    .replace(/ş/g, "s").replace(/ö/g, "o").replace(/ç/g, "c").replace(/İ/g, "i");
}

function parseListingText(raw: string): Record<string, string> {
  const text = raw.trim();
  const lines = text.split(/\n/);

  // Phone numbers — Turkish formats
  const phoneMatch = text.match(/(?:0|\+90)[\s\-]?(?:\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}|\d{3}[\s\-]?\d{7})/);
  const rawPhone = phoneMatch?.[0]?.replace(/[\s\-\(\)]/g, "") ?? "";
  const contactPhone = rawPhone ? rawPhone.replace(/^0/, "+90").replace(/^\+90(\d{10})$/, "+90$1") : "";
  const applyUrl = contactPhone ? `tel:${contactPhone}` : "";

  // Contact name — patterns: "iletisim: Ad Soyad", "adı soyad:", "yetkili:", etc.
  let contactName = "";
  const namePatterns = [
    /(?:iletişim|yetkili|irtibat|sorumlu|müdür|bey|hanım|bay|bayan)\s*[:\-]?\s*([A-ZÇĞİÖŞÜa-zçğışöüİ]{2,}\s+[A-ZÇĞİÖŞÜa-zçğışöüİ]{2,}(?:\s+[A-ZÇĞİÖŞÜa-zçğışöüİ]{2,})?)/i,
    /([A-ZÇĞİÖŞÜ][a-zçğışöü]{2,}\s+[A-ZÇĞİÖŞÜ][a-zçğışöü]{2,})\s+(?:bey|hanım|bay|bayan)/i,
  ];
  for (const pat of namePatterns) {
    const m = text.match(pat);
    if (m?.[1] && m[1].length > 4 && !m[1].toLowerCase().includes("güvenlik") && !m[1].toLowerCase().includes("personel")) {
      contactName = m[1].trim(); break;
    }
  }

  // City — scan each word against known cities
  let city = "";
  let district = "";
  const cityPatterns = [
    /(?:il|şehir|konum|lokasyon|bölge)\s*[:\-]?\s*([A-ZÇĞİÖŞÜa-zçğışöüİ\/\s]{3,30})/i,
  ];
  for (const pat of cityPatterns) {
    const m = text.match(pat);
    if (m?.[1]) {
      const candidate = m[1].split(/[\/,\s]/)[0]?.trim().toLowerCase() ?? "";
      const normalized = normalizeForLookup(candidate);
      if (TR_CITIES[normalized]) { city = TR_CITIES[normalized]; break; }
    }
  }
  // Fallback: scan all words
  if (!city) {
    const words = text.split(/[\s\/,\-]+/);
    for (const word of words) {
      const norm = normalizeForLookup(word);
      if (TR_CITIES[norm]) { city = TR_CITIES[norm]; break; }
    }
  }
  // District scan (İstanbul districts for now)
  for (const word of text.split(/[\s\/,\-]+/)) {
    if (ISTANBUL_DISTRICTS.includes(normalizeForLookup(word))) {
      district = word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      if (!city) city = "İstanbul";
      break;
    }
  }

  // Salary
  let salary = "";
  const salaryPatterns = [
    /(\d[\d\.\s]+)\s*[-–]\s*(\d[\d\.\s]+)\s*(?:bin\s*)?tl/i,
    /(\d[\d\.\s]+)\s*(?:bin\s*)?tl\s*(?:maaş|ücret|aylık)/i,
    /maaş\s*[:\-]?\s*(\d[\d\.\s]+\s*(?:bin\s*)?tl(?:\s*[-–]\s*\d[\d\.\s]+\s*(?:bin\s*)?tl)?)/i,
    /ücret\s*[:\-]?\s*(\d[\d\.\s]+\s*(?:bin\s*)?tl(?:\s*[-–]\s*\d[\d\.\s]+\s*(?:bin\s*)?tl)?)/i,
  ];
  for (const pat of salaryPatterns) {
    const m = text.match(pat);
    if (m) {
      salary = m[0].replace(/\n/g, " ").trim();
      salary = salary.charAt(0).toUpperCase() + salary.slice(1);
      if (!salary.toLowerCase().includes("tl")) salary += " TL";
      break;
    }
  }

  // Work type
  let workType = "Tam Zamanlı";
  if (/vardiy/i.test(text)) workType = "Vardiyalı";
  else if (/yarı\s*zamanl/i.test(text) || /part[\s\-]?time/i.test(text)) workType = "Yarı Zamanlı";
  else if (/proje\s*baz/i.test(text) || /freelance/i.test(text)) workType = "Proje Bazlı";
  else if (/tam\s*zamanl/i.test(text) || /full[\s\-]?time/i.test(text)) workType = "Tam Zamanlı";

  // Job title
  let title = "";
  const titlePatterns = [
    /(?:pozisyon|görev|ünvan|iş\s*ilanı|aranan)\s*[:\-]?\s*(.+)/i,
    /(?:güvenlik\s*(?:görevlisi|uzmanı|şefi|amiri|koordinatörü|müdürü)|özel\s*güvenlik|silahlı\s*güvenlik|koruma\s*görevlisi|kasiyp|resepsiyonist)/i,
  ];
  for (const pat of titlePatterns) {
    const m = text.match(pat);
    if (m) { title = (m[1] ?? m[0]).trim().split(/\n/)[0]!.trim(); if (title.length > 5 && title.length < 80) break; title = ""; }
  }
  if (!title) {
    // First non-empty line often is the title in WhatsApp forwards
    for (const line of lines) {
      const l = line.trim();
      if (l.length > 5 && l.length < 80 && !/^\d/.test(l) && !l.includes("http")) {
        title = l.replace(/^[🔔📢🚨✅❗❕#\*\-\•]/g, "").trim();
        if (title.length > 3) break;
        title = "";
      }
    }
  }

  // Company
  let company = "";
  const companyPatterns = [
    /(?:şirket|firma|kurum|işveren)\s*[:\-]?\s*(.+)/i,
    /([A-ZÇĞİÖŞÜ][A-ZÇĞİÖŞÜa-zçğışöüİ\s]{2,30}(?:A\.Ş\.|Ltd\.|Tic\.|Grup|Güvenlik|Holding|Şirketi))/,
  ];
  for (const pat of companyPatterns) {
    const m = text.match(pat);
    if (m?.[1]) {
      company = m[1].trim().split(/\n/)[0]!.trim();
      if (company.length > 2 && company.length < 60) break;
      company = "";
    }
  }

  // Description: remove lines with phone/link, keep rest
  const descLines = lines.filter(l => {
    const ll = l.trim();
    if (!ll) return false;
    if (/(?:0|\+90)[\s\-]?\d{3}/.test(ll)) return false;
    if (/http[s]?:\/\//.test(ll)) return false;
    if (ll === title) return false;
    return true;
  });
  const description = descLines.join("\n").trim();

  return { title, company, city, district, salary, workType, description, contactPhone, contactName, applyUrl };
}

router.post("/admin/listings/parse", authMiddleware, requireAdmin, async (req, res): Promise<void> => {
  const { text } = req.body as { text?: string };
  if (!text?.trim()) { res.status(400).json({ error: "Metin zorunludur" }); return; }
  const result = parseListingText(text);
  res.json(result);
});

router.post("/admin/chat/lock", authMiddleware, requireAdmin, async (req, res): Promise<void> => {
  const settings = await db.select().from(adminSettingsTable).limit(1);
  const current = settings[0]?.chatLocked ?? false;
  if (!settings[0]) {
    await db.insert(adminSettingsTable).values({ chatLocked: !current, fakeOnlineBonus: 0, maintenanceMode: false });
  } else {
    await db.update(adminSettingsTable).set({ chatLocked: !current }).where(eq(adminSettingsTable.id, settings[0].id));
  }
  const ioInstance = (req as any).app.get("io") as { emit: (event: string, data: unknown) => void } | null;
  if (ioInstance) ioInstance.emit("chat_locked", { locked: !current });
  res.json({ success: true, message: !current ? "Sohbet kilitledi" : "Sohbet kilidi açıldı" });
});

// ─── Clear all chat ────────────────────────────────────────────────
router.delete("/admin/chat/messages/all", authMiddleware, requireAdmin, async (req, res): Promise<void> => {
  await db.update(chatMessagesTable).set({ isDeleted: true });
  const io = (req as any).app.get("io") as { emit: (event: string, data: unknown) => void } | null;
  if (io) io.emit("chat:clear", {});
  res.json({ success: true });
});

// ─── Chat rules ────────────────────────────────────────────────────
router.get("/admin/chat/rules", authMiddleware, requireAdmin, async (_req, res): Promise<void> => {
  const rules = await db.select().from(chatRulesTable).orderBy(asc(chatRulesTable.sortOrder), asc(chatRulesTable.id));
  res.json(rules.map(r => ({ id: r.id, content: r.content, sortOrder: r.sortOrder })));
});

router.get("/chat/rules", async (_req, res): Promise<void> => {
  const rules = await db.select().from(chatRulesTable).orderBy(asc(chatRulesTable.sortOrder), asc(chatRulesTable.id));
  res.json(rules.map(r => ({ id: r.id, content: r.content, sortOrder: r.sortOrder })));
});

router.post("/admin/chat/rules", authMiddleware, requireAdmin, async (req, res): Promise<void> => {
  const { content, sortOrder } = req.body as { content?: string; sortOrder?: number };
  if (!content?.trim()) { res.status(400).json({ error: "İçerik zorunludur" }); return; }
  const [rule] = await db.insert(chatRulesTable).values({ content: content.trim(), sortOrder: sortOrder ?? 0 }).returning();
  res.status(201).json({ id: rule!.id, content: rule!.content, sortOrder: rule!.sortOrder });
});

router.patch("/admin/chat/rules/:id", authMiddleware, requireAdmin, async (req, res): Promise<void> => {
  const id = safeId(req.params["id"]);
  if (!id) { res.status(400).json({ error: "Geçersiz ID" }); return; }
  const { content, sortOrder } = req.body as { content?: string; sortOrder?: number };
  const updates: Partial<typeof chatRulesTable.$inferInsert> = {};
  if (content !== undefined) updates.content = content.trim();
  if (sortOrder !== undefined) updates.sortOrder = sortOrder;
  await db.update(chatRulesTable).set(updates).where(eq(chatRulesTable.id, id));
  res.json({ success: true });
});

router.delete("/admin/chat/rules/:id", authMiddleware, requireAdmin, async (req, res): Promise<void> => {
  const id = safeId(req.params["id"]);
  if (!id) { res.status(400).json({ error: "Geçersiz ID" }); return; }
  await db.delete(chatRulesTable).where(eq(chatRulesTable.id, id));
  res.sendStatus(204);
});

router.get("/admin/banned-words", authMiddleware, requireAdmin, async (_req, res): Promise<void> => {
  const words = await db.select().from(bannedWordsTable).orderBy(desc(bannedWordsTable.createdAt));
  res.json(words.map(w => ({ id: w.id, word: w.word, createdAt: w.createdAt.toISOString() })));
});

router.post("/admin/banned-words", authMiddleware, requireAdmin, async (req, res): Promise<void> => {
  const { word } = req.body as { word?: string };
  if (!word?.trim()) { res.status(400).json({ error: "Kelime zorunludur" }); return; }
  const [existing] = await db.select().from(bannedWordsTable).where(eq(bannedWordsTable.word, word.trim().toLowerCase()));
  if (existing) { res.status(400).json({ error: "Bu kelime zaten engelli" }); return; }
  const [created] = await db.insert(bannedWordsTable).values({ word: word.trim().toLowerCase() }).returning();
  res.status(201).json({ id: created.id, word: created.word, createdAt: created.createdAt.toISOString() });
});

router.delete("/admin/banned-words/:id", authMiddleware, requireAdmin, async (req, res): Promise<void> => {
  const id = safeId(req.params["id"]);
  if (!id) { res.status(400).json({ error: "Geçersiz ID" }); return; }
  await db.delete(bannedWordsTable).where(eq(bannedWordsTable.id, id));
  res.sendStatus(204);
});

// ─── Admin Listings ────────────────────────────────────────────────
router.get("/admin/listings", authMiddleware, requireAdmin, async (req, res): Promise<void> => {
  const page = Math.max(1, parseInt(String(req.query["page"] ?? "1"), 10));
  const limit = 20;
  const offset = (page - 1) * limit;
  const status = req.query["status"] as string | undefined;
  const conditions = status ? [eq(listingsTable.status, status)] : [];
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const [listings, countResult] = await Promise.all([
    db.select().from(listingsTable).where(whereClause).orderBy(desc(listingsTable.createdAt)).limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(listingsTable).where(whereClause),
  ]);
  res.json({
    listings: listings.map(l => ({
      id: l.id, title: l.title, company: l.company, city: l.city, salary: l.salary,
      workType: l.workType, status: l.status, isFeatured: l.isFeatured, likeCount: l.likeCount,
      expiresAt: l.expiresAt?.toISOString() ?? null, createdAt: l.createdAt.toISOString(),
    })),
    total: countResult[0]?.count ?? 0,
  });
});

router.post("/admin/listings", authMiddleware, requireAdmin, async (req, res): Promise<void> => {
  const { title, company, city, workType, salary, description, requirements, applyUrl, isFeatured, expiresAt } = req.body as Record<string, unknown>;
  if (!title || !company || !city || !workType) { res.status(400).json({ error: "Başlık, şirket, şehir ve çalışma şekli zorunludur" }); return; }
  const [listing] = await db.insert(listingsTable).values({
    title: String(title), company: String(company), city: String(city), workType: String(workType),
    salary: salary ? String(salary) : null, description: description ? String(description) : null,
    requirements: requirements ? String(requirements) : null, applyUrl: applyUrl ? String(applyUrl) : null,
    isFeatured: Boolean(isFeatured), status: "active",
    expiresAt: expiresAt ? new Date(String(expiresAt)) : null,
    authorId: (req as any).user?.id ?? null,
  }).returning();
  res.status(201).json({ id: listing!.id, title: listing!.title, status: listing!.status });
});

router.patch("/admin/listings/:id/status", authMiddleware, requireAdmin, async (req, res): Promise<void> => {
  const id = safeId(req.params["id"]);
  if (!id) { res.status(400).json({ error: "Geçersiz ID" }); return; }
  const { status, isFeatured } = req.body as { status?: string; isFeatured?: boolean };
  const updates: Partial<typeof listingsTable.$inferInsert> = {};
  if (status && ["active", "pending", "rejected"].includes(status)) updates.status = status;
  if (isFeatured !== undefined) updates.isFeatured = Boolean(isFeatured);
  await db.update(listingsTable).set(updates).where(eq(listingsTable.id, id));
  res.json({ success: true });
});

router.delete("/admin/listings/:id", authMiddleware, requireAdmin, async (req, res): Promise<void> => {
  const id = safeId(req.params["id"]);
  if (!id) { res.status(400).json({ error: "Geçersiz ID" }); return; }
  await db.delete(listingsTable).where(eq(listingsTable.id, id));
  res.sendStatus(204);
});

// ─── Banners ─────────────────────────────────────────────────────
router.get("/admin/banners", authMiddleware, requireAdmin, async (_req, res): Promise<void> => {
  const banners = await db.select().from(bannersTable).orderBy(asc(bannersTable.sortOrder), desc(bannersTable.createdAt));
  res.json(banners.map(b => ({ id: b.id, title: b.title, imageUrl: b.imageUrl, linkUrl: b.linkUrl, isActive: b.isActive, sortOrder: b.sortOrder, createdAt: b.createdAt.toISOString() })));
});

router.post("/admin/banners", authMiddleware, requireAdmin, async (req, res): Promise<void> => {
  const { title, imageUrl, linkUrl, isActive, sortOrder } = req.body as Record<string, unknown>;
  if (!imageUrl) { res.status(400).json({ error: "Resim URL zorunludur" }); return; }
  const [banner] = await db.insert(bannersTable).values({ title: title ? String(title) : null, imageUrl: String(imageUrl), linkUrl: linkUrl ? String(linkUrl) : null, isActive: isActive !== false, sortOrder: sortOrder ? parseInt(String(sortOrder), 10) : 0 }).returning();
  res.status(201).json({ id: banner!.id, imageUrl: banner!.imageUrl, isActive: banner!.isActive });
});

router.patch("/admin/banners/:id", authMiddleware, requireAdmin, async (req, res): Promise<void> => {
  const id = safeId(req.params["id"]);
  if (!id) { res.status(400).json({ error: "Geçersiz ID" }); return; }
  const { title, imageUrl, linkUrl, isActive, sortOrder } = req.body as Record<string, unknown>;
  const updates: Partial<typeof bannersTable.$inferInsert> = {};
  if (title !== undefined) updates.title = title ? String(title) : null;
  if (imageUrl !== undefined) updates.imageUrl = String(imageUrl);
  if (linkUrl !== undefined) updates.linkUrl = linkUrl ? String(linkUrl) : null;
  if (isActive !== undefined) updates.isActive = Boolean(isActive);
  if (sortOrder !== undefined) updates.sortOrder = parseInt(String(sortOrder), 10);
  await db.update(bannersTable).set(updates).where(eq(bannersTable.id, id));
  res.json({ success: true });
});

router.delete("/admin/banners/:id", authMiddleware, requireAdmin, async (req, res): Promise<void> => {
  const id = safeId(req.params["id"]);
  if (!id) { res.status(400).json({ error: "Geçersiz ID" }); return; }
  await db.delete(bannersTable).where(eq(bannersTable.id, id));
  res.sendStatus(204);
});

router.get("/banners", async (_req, res): Promise<void> => {
  const banners = await db.select().from(bannersTable).where(eq(bannersTable.isActive, true)).orderBy(asc(bannersTable.sortOrder), desc(bannersTable.createdAt));
  res.json(banners.map(b => ({ id: b.id, title: b.title, imageUrl: b.imageUrl, linkUrl: b.linkUrl })));
});

// ─── Admin: support tickets ──────────────────────────────────────
router.get("/admin/support", authMiddleware, requireAdmin, async (req, res): Promise<void> => {
  const status = req.query["status"] as string | undefined;
  const conditions = status && status !== "all" ? [eq(supportTicketsTable.status, status)] : [];
  const tickets = await db.select().from(supportTicketsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(supportTicketsTable.updatedAt)).limit(50);
  res.json(tickets.map(t => ({ id: t.id, subject: t.subject, status: t.status, userId: t.userId, username: null, msgCount: 0, createdAt: t.createdAt.toISOString(), updatedAt: t.updatedAt.toISOString() })));
});

export default router;

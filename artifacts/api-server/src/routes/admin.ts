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

// ── AI: parse raw text into listing fields ─────────────────────────────────────
router.post("/admin/listings/parse", authMiddleware, requireAdmin, async (req, res): Promise<void> => {
  const { text } = req.body as { text?: string };
  if (!text?.trim()) { res.status(400).json({ error: "Metin zorunludur" }); return; }

  const settings = await db.select().from(adminSettingsTable).limit(1);
  const apiKey = settings[0]?.openaiApiKey;
  if (!apiKey) { res.status(400).json({ error: "OpenAI API anahtarı ayarlanmamış. Admin ayarlarından girin." }); return; }

  const prompt = `Sen bir Türk iş ilanı asistanısın. Aşağıdaki ham metinden iş ilanı bilgilerini çıkar ve SADECE JSON döndür, başka hiçbir şey yazma.

HAM METİN:
${text.trim()}

Çıkar ve JSON olarak döndür:
{
  "title": "İş pozisyonu başlığı",
  "company": "Şirket adı (varsa, yoksa boş string)",
  "city": "İl adı Türkçe (varsa, yoksa boş string)",
  "district": "İlçe adı (varsa, yoksa boş string)",
  "salary": "Maaş bilgisi (varsa, yoksa boş string)",
  "workType": "Tam Zamanlı veya Yarı Zamanlı veya Vardiyalı veya Proje Bazlı",
  "description": "İş tanımı ve gereksinimler temiz paragraf olarak",
  "contactPhone": "Telefon numarası (varsa, yoksa boş string)",
  "contactName": "İletişim kişisi adı (varsa, yoksa boş string)",
  "applyUrl": "Başvuru linki veya telefon (varsa, yoksa boş string)"
}

Önemli kurallar:
- Sadece metinde açıkça yazanı çıkar, tahmin etme
- Şehir adı Türkçe il adı olmalı
- applyUrl için telefon numarası varsa "tel:+905..." formatında yaz
- Tüm alanlar string olmalı`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "user", content: prompt }], temperature: 0.1, max_tokens: 800, response_format: { type: "json_object" } }),
    });
    if (!response.ok) { res.status(502).json({ error: "OpenAI API hatası: " + response.statusText }); return; }
    const data = await response.json() as { choices: { message: { content: string } }[] };
    const parsed = JSON.parse(data.choices[0]?.message?.content ?? "{}");
    res.json({ title: parsed.title ?? "", company: parsed.company ?? "", city: parsed.city ?? "", district: parsed.district ?? "", salary: parsed.salary ?? "", workType: parsed.workType ?? "Tam Zamanlı", description: parsed.description ?? "", contactPhone: parsed.contactPhone ?? "", contactName: parsed.contactName ?? "", applyUrl: parsed.applyUrl ?? "" });
  } catch (err) {
    req.log.error(err, "Parse listing error");
    res.status(500).json({ error: "AI ayıklama başarısız oldu" });
  }
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

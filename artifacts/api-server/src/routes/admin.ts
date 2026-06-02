import { Router } from "express";
import { db, usersTable, listingsTable, chatMessagesTable, notificationsTable, announcementsTable, adminSettingsTable, bannedWordsTable } from "@workspace/db";
import { eq, desc, ilike, and, sql } from "drizzle-orm";
import { authMiddleware, requireAdmin } from "../middlewares/auth";
import { onlineSockets } from "./chat";

const router = Router();

router.get("/admin/stats", authMiddleware, requireAdmin, async (_req, res): Promise<void> => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const settings = await db.select().from(adminSettingsTable).limit(1);
  const fakeBonus = settings[0]?.fakeOnlineBonus ?? 0;

  const [totalUsers, onlineCount, totalListings, todayListings, totalMessages, bannedUsers, pendingListings] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(usersTable),
    Promise.resolve([{ count: onlineSockets.size + fakeBonus }]),
    db.select({ count: sql<number>`count(*)::int` }).from(listingsTable).where(eq(listingsTable.status, "active")),
    db.select({ count: sql<number>`count(*)::int` }).from(listingsTable).where(and(eq(listingsTable.status, "active"), sql`${listingsTable.createdAt} >= ${today}`)),
    db.select({ count: sql<number>`count(*)::int` }).from(chatMessagesTable).where(eq(chatMessagesTable.isDeleted, false)),
    db.select({ count: sql<number>`count(*)::int` }).from(usersTable).where(eq(usersTable.isBanned, true)),
    db.select({ count: sql<number>`count(*)::int` }).from(listingsTable).where(eq(listingsTable.status, "pending")),
  ]);

  res.json({
    totalUsers: totalUsers[0]?.count ?? 0,
    onlineUsers: onlineCount[0]?.count ?? 0,
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

  res.json({
    users: users.map(u => ({
      id: u.id,
      username: u.username,
      email: u.email,
      role: u.role,
      avatarUrl: u.avatarUrl,
      bio: u.bio,
      nameColor: u.nameColor,
      nameAnimated: u.nameAnimated,
      isBanned: u.isBanned,
      banReason: u.banReason,
      banExpiresAt: u.banExpiresAt?.toISOString() ?? null,
      createdAt: u.createdAt.toISOString(),
    })),
    total: countResult[0]?.count ?? 0,
  });
});

router.post("/admin/users/:id/ban", authMiddleware, requireAdmin, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params["id"]) ? req.params["id"][0] : req.params["id"];
  const id = parseInt(rawId ?? "", 10);
  if (isNaN(id)) { res.status(400).json({ error: "Geçersiz ID" }); return; }

  const { reason, expiresAt } = req.body as { reason?: string; expiresAt?: string | null };
  if (!reason) { res.status(400).json({ error: "Ban sebebi zorunludur" }); return; }

  await db.update(usersTable).set({
    isBanned: true,
    banReason: reason,
    banExpiresAt: expiresAt ? new Date(expiresAt) : null,
  }).where(eq(usersTable.id, id));

  res.json({ success: true, message: "Kullanıcı yasaklandı" });
});

router.post("/admin/users/:id/unban", authMiddleware, requireAdmin, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params["id"]) ? req.params["id"][0] : req.params["id"];
  const id = parseInt(rawId ?? "", 10);
  if (isNaN(id)) { res.status(400).json({ error: "Geçersiz ID" }); return; }

  await db.update(usersTable).set({ isBanned: false, banReason: null, banExpiresAt: null }).where(eq(usersTable.id, id));
  res.json({ success: true, message: "Kullanıcının yasağı kaldırıldı" });
});

router.patch("/admin/users/:id/role", authMiddleware, requireAdmin, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params["id"]) ? req.params["id"][0] : req.params["id"];
  const id = parseInt(rawId ?? "", 10);
  if (isNaN(id)) { res.status(400).json({ error: "Geçersiz ID" }); return; }

  const { role } = req.body as { role?: string };
  if (!role || !["user", "moderator", "admin"].includes(role)) {
    res.status(400).json({ error: "Geçersiz rol" });
    return;
  }

  await db.update(usersTable).set({ role }).where(eq(usersTable.id, id));
  res.json({ success: true, message: "Rol güncellendi" });
});

router.patch("/admin/users/:id/name-color", authMiddleware, requireAdmin, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params["id"]) ? req.params["id"][0] : req.params["id"];
  const id = parseInt(rawId ?? "", 10);
  if (isNaN(id)) { res.status(400).json({ error: "Geçersiz ID" }); return; }

  const { nameColor, nameAnimated } = req.body as { nameColor?: string | null; nameAnimated?: boolean };
  const updates: Partial<typeof usersTable.$inferInsert> = {};
  if (nameColor !== undefined) updates.nameColor = nameColor ?? null;
  if (nameAnimated !== undefined) updates.nameAnimated = Boolean(nameAnimated);

  await db.update(usersTable).set(updates).where(eq(usersTable.id, id));
  res.json({ success: true, message: "İsim rengi güncellendi" });
});

router.get("/admin/settings", authMiddleware, requireAdmin, async (_req, res): Promise<void> => {
  const settings = await db.select().from(adminSettingsTable).limit(1);
  if (!settings[0]) {
    const [created] = await db.insert(adminSettingsTable).values({ chatLocked: false, fakeOnlineBonus: 0, maintenanceMode: false }).returning();
    res.json({ chatLocked: created.chatLocked, fakeOnlineBonus: created.fakeOnlineBonus, maintenanceMode: created.maintenanceMode, welcomeMessage: created.welcomeMessage });
    return;
  }
  const s = settings[0];
  res.json({ chatLocked: s.chatLocked, fakeOnlineBonus: s.fakeOnlineBonus, maintenanceMode: s.maintenanceMode, welcomeMessage: s.welcomeMessage });
});

router.patch("/admin/settings", authMiddleware, requireAdmin, async (req, res): Promise<void> => {
  const { chatLocked, fakeOnlineBonus, maintenanceMode, welcomeMessage } = req.body as Record<string, unknown>;
  const updates: Partial<typeof adminSettingsTable.$inferInsert> = {};
  if (chatLocked !== undefined) updates.chatLocked = Boolean(chatLocked);
  if (fakeOnlineBonus !== undefined) updates.fakeOnlineBonus = parseInt(String(fakeOnlineBonus), 10);
  if (maintenanceMode !== undefined) updates.maintenanceMode = Boolean(maintenanceMode);
  if (welcomeMessage !== undefined) updates.welcomeMessage = welcomeMessage == null ? null : String(welcomeMessage);

  const existing = await db.select().from(adminSettingsTable).limit(1);
  let result;
  if (!existing[0]) {
    [result] = await db.insert(adminSettingsTable).values({ chatLocked: false, fakeOnlineBonus: 0, maintenanceMode: false, ...updates }).returning();
  } else {
    [result] = await db.update(adminSettingsTable).set(updates).where(eq(adminSettingsTable.id, existing[0].id)).returning();
  }

  res.json({ chatLocked: result!.chatLocked, fakeOnlineBonus: result!.fakeOnlineBonus, maintenanceMode: result!.maintenanceMode, welcomeMessage: result!.welcomeMessage });
});

router.post("/admin/chat/lock", authMiddleware, requireAdmin, async (req, res): Promise<void> => {
  const settings = await db.select().from(adminSettingsTable).limit(1);
  const current = settings[0]?.chatLocked ?? false;

  if (!settings[0]) {
    await db.insert(adminSettingsTable).values({ chatLocked: !current, fakeOnlineBonus: 0, maintenanceMode: false });
  } else {
    await db.update(adminSettingsTable).set({ chatLocked: !current }).where(eq(adminSettingsTable.id, settings[0].id));
  }

  const io = (req as unknown as { app: { get: (key: string) => unknown } }).app.get("io") as { emit: (event: string, data: unknown) => void } | null;
  if (io) {
    io.emit("chat_locked", { locked: !current });
  }

  res.json({ success: true, message: !current ? "Sohbet kilitledi" : "Sohbet kilidi açıldı" });
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
  const rawId = Array.isArray(req.params["id"]) ? req.params["id"][0] : req.params["id"];
  const id = parseInt(rawId ?? "", 10);
  if (isNaN(id)) { res.status(400).json({ error: "Geçersiz ID" }); return; }

  await db.delete(bannedWordsTable).where(eq(bannedWordsTable.id, id));
  res.sendStatus(204);
});

export default router;

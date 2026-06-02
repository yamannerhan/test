import { Router } from "express";
import { db, chatMessagesTable, usersTable, adminSettingsTable } from "@workspace/db";
import { eq, desc, and, lt } from "drizzle-orm";
import { authMiddleware, optionalAuthMiddleware, requireAdmin } from "../middlewares/auth";

const router = Router();

// Shared online tracking (in-memory, resets on restart)
export const onlineSockets = new Map<string, { userId?: number; joinedAt: Date }>();

function extractMentions(content: string): string[] {
  const regex = /@(\w+)/g;
  const mentions: string[] = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    mentions.push(match[1]!);
  }
  return [...new Set(mentions)];
}

async function formatMessage(msg: typeof chatMessagesTable.$inferSelect, userMap: Map<number, typeof usersTable.$inferSelect>) {
  const user = userMap.get(msg.userId);
  let replyToUsername: string | null = null;
  let replyToContent: string | null = null;

  if (msg.replyToId) {
    const [replyMsg] = await db.select().from(chatMessagesTable).where(eq(chatMessagesTable.id, msg.replyToId));
    if (replyMsg) {
      replyToContent = replyMsg.content;
      const replyUser = userMap.get(replyMsg.userId);
      replyToUsername = replyUser?.username ?? null;
    }
  }

  return {
    id: msg.id,
    content: msg.content,
    userId: msg.userId,
    username: user?.username ?? "Silindi",
    userAvatarUrl: user?.avatarUrl ?? null,
    userNameColor: user?.nameColor ?? null,
    userNameAnimated: user?.nameAnimated ?? false,
    userRole: user?.role ?? "user",
    replyToId: msg.replyToId,
    replyToUsername,
    replyToContent,
    isPinned: msg.isPinned,
    mentions: extractMentions(msg.content),
    createdAt: msg.createdAt.toISOString(),
  };
}

router.get("/chat/messages", optionalAuthMiddleware, async (req, res): Promise<void> => {
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query["limit"] ?? "50"), 10)));
  const before = req.query["before"] ? parseInt(String(req.query["before"]), 10) : undefined;

  const conditions = [eq(chatMessagesTable.isDeleted, false)];
  if (before != null && !isNaN(before)) {
    conditions.push(lt(chatMessagesTable.id, before));
  }

  const messages = await db.select().from(chatMessagesTable)
    .where(and(...conditions))
    .orderBy(desc(chatMessagesTable.createdAt))
    .limit(limit);

  messages.reverse();

  const userIds = [...new Set(messages.map(m => m.userId).concat(messages.map(m => m.replyToId).filter(Boolean) as number[]))];
  const users = userIds.length > 0 ? await db.select().from(usersTable).where(eq(usersTable.id, userIds[0]!)) : [];

  // Fetch all needed users
  const allUsers = await db.select().from(usersTable);
  const userMap = new Map(allUsers.map(u => [u.id, u]));

  const formatted = await Promise.all(messages.map(m => formatMessage(m, userMap)));
  res.json(formatted);
});

router.post("/chat/messages", authMiddleware, async (req, res): Promise<void> => {
  const settings = await db.select().from(adminSettingsTable).limit(1);
  const chatLocked = settings[0]?.chatLocked ?? false;
  if (chatLocked && req.user!.role !== "admin") {
    res.status(403).json({ error: "Sohbet şu an kilitli" });
    return;
  }

  const { content, replyToId } = req.body as { content?: string; replyToId?: number | null };
  if (!content?.trim()) {
    res.status(400).json({ error: "Mesaj boş olamaz" });
    return;
  }
  if (content.length > 500) {
    res.status(400).json({ error: "Mesaj çok uzun (max 500 karakter)" });
    return;
  }

  const [msg] = await db.insert(chatMessagesTable).values({
    content: content.trim(),
    userId: req.user!.id,
    replyToId: replyToId ?? null,
    isPinned: false,
    isDeleted: false,
  }).returning();

  const allUsers = await db.select().from(usersTable);
  const userMap = new Map(allUsers.map(u => [u.id, u]));
  const formatted = await formatMessage(msg, userMap);

  // Emit via socket if available
  const io = (req as unknown as { app: { get: (key: string) => unknown } }).app.get("io") as { emit: (event: string, data: unknown) => void } | null;
  if (io) {
    io.emit("new_message", formatted);
  }

  res.status(201).json(formatted);
});

router.delete("/chat/messages/:id", authMiddleware, requireAdmin, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params["id"]) ? req.params["id"][0] : req.params["id"];
  const id = parseInt(rawId ?? "", 10);
  if (isNaN(id)) { res.status(400).json({ error: "Geçersiz ID" }); return; }

  await db.update(chatMessagesTable).set({ isDeleted: true }).where(eq(chatMessagesTable.id, id));

  const io = (req as unknown as { app: { get: (key: string) => unknown } }).app.get("io") as { emit: (event: string, data: unknown) => void } | null;
  if (io) {
    io.emit("message_deleted", { id });
  }

  res.sendStatus(204);
});

router.post("/chat/messages/:id/pin", authMiddleware, requireAdmin, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params["id"]) ? req.params["id"][0] : req.params["id"];
  const id = parseInt(rawId ?? "", 10);
  if (isNaN(id)) { res.status(400).json({ error: "Geçersiz ID" }); return; }

  const [msg] = await db.select({ isPinned: chatMessagesTable.isPinned }).from(chatMessagesTable).where(eq(chatMessagesTable.id, id));
  if (!msg) { res.status(404).json({ error: "Mesaj bulunamadı" }); return; }

  await db.update(chatMessagesTable).set({ isPinned: !msg.isPinned }).where(eq(chatMessagesTable.id, id));
  res.json({ success: true, message: msg.isPinned ? "Sabitleme kaldırıldı" : "Mesaj sabitlendi" });
});

router.get("/chat/online", async (req, res): Promise<void> => {
  const settings = await db.select().from(adminSettingsTable).limit(1);
  const fakeBonus = settings[0]?.fakeOnlineBonus ?? 0;
  const realCount = onlineSockets.size;
  res.json({ count: realCount + fakeBonus, fakeBonus });
});

export default router;

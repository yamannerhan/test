import { Router } from "express";
import { db, sourcesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { authMiddleware, requireAdmin } from "../middlewares/auth";
import { isTelegramTokenSet } from "../workers/scraper";

const router = Router();

function safeId(raw: string | string[] | undefined): number | null {
  const s = Array.isArray(raw) ? (raw[0] ?? "") : (raw ?? "");
  const n = parseInt(s, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// ── List sources ──────────────────────────────────────────────────
router.get("/admin/sources", authMiddleware, requireAdmin, async (_req, res): Promise<void> => {
  const sources = await db.select().from(sourcesTable).orderBy(desc(sourcesTable.createdAt));
  res.json({
    sources: sources.map(s => ({
      id: s.id,
      name: s.name,
      platform: s.platform,
      url: s.url,
      active: s.active,
      checkInterval: s.checkInterval,
      autoPublish: s.autoPublish,
      requireApproval: s.requireApproval,
      lastCheckedAt: s.lastCheckedAt?.toISOString() ?? null,
      lastError: s.lastError ?? null,
      totalImported: s.totalImported,
      telegramChatId: s.telegramChatId ?? null,
      createdAt: s.createdAt.toISOString(),
    })),
    telegramTokenSet: isTelegramTokenSet(),
  });
});

// ── Create source ─────────────────────────────────────────────────
router.post("/admin/sources", authMiddleware, requireAdmin, async (req, res): Promise<void> => {
  const { name, platform, url, active, checkInterval, autoPublish, requireApproval } = req.body as {
    name?: string; platform?: string; url?: string;
    active?: boolean; checkInterval?: number;
    autoPublish?: boolean; requireApproval?: boolean;
  };

  if (!name?.trim()) { res.status(400).json({ error: "Kaynak adı zorunlu" }); return; }
  if (!platform || !["telegram", "facebook"].includes(platform)) { res.status(400).json({ error: "Geçersiz platform" }); return; }
  if (!url?.trim()) { res.status(400).json({ error: "URL zorunlu" }); return; }

  const [source] = await db.insert(sourcesTable).values({
    name: name.trim(),
    platform,
    url: url.trim(),
    active: active ?? true,
    checkInterval: checkInterval ?? 15,
    autoPublish: autoPublish ?? false,
    requireApproval: requireApproval ?? true,
  }).returning();

  res.json(source);
});

// ── Update source ─────────────────────────────────────────────────
router.patch("/admin/sources/:id", authMiddleware, requireAdmin, async (req, res): Promise<void> => {
  const id = safeId(req.params["id"]);
  if (!id) { res.status(400).json({ error: "Geçersiz ID" }); return; }

  const { name, url, active, checkInterval, autoPublish, requireApproval } = req.body as {
    name?: string; url?: string; active?: boolean;
    checkInterval?: number; autoPublish?: boolean; requireApproval?: boolean;
  };

  const updates: Partial<typeof sourcesTable.$inferInsert> = {};
  if (name !== undefined) updates.name = name.trim();
  if (url !== undefined) updates.url = url.trim();
  if (active !== undefined) updates.active = active;
  if (checkInterval !== undefined) updates.checkInterval = checkInterval;
  if (autoPublish !== undefined) updates.autoPublish = autoPublish;
  if (requireApproval !== undefined) updates.requireApproval = requireApproval;

  await db.update(sourcesTable).set(updates).where(eq(sourcesTable.id, id));
  res.json({ success: true });
});

// ── Toggle active ─────────────────────────────────────────────────
router.post("/admin/sources/:id/toggle", authMiddleware, requireAdmin, async (req, res): Promise<void> => {
  const id = safeId(req.params["id"]);
  if (!id) { res.status(400).json({ error: "Geçersiz ID" }); return; }
  const [s] = await db.select({ active: sourcesTable.active }).from(sourcesTable).where(eq(sourcesTable.id, id));
  if (!s) { res.status(404).json({ error: "Kaynak bulunamadı" }); return; }
  await db.update(sourcesTable).set({ active: !s.active }).where(eq(sourcesTable.id, id));
  res.json({ active: !s.active });
});

// ── Delete source ─────────────────────────────────────────────────
router.delete("/admin/sources/:id", authMiddleware, requireAdmin, async (req, res): Promise<void> => {
  const id = safeId(req.params["id"]);
  if (!id) { res.status(400).json({ error: "Geçersiz ID" }); return; }
  await db.delete(sourcesTable).where(eq(sourcesTable.id, id));
  res.json({ success: true });
});

export default router;

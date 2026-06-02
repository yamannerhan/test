import { Router } from "express";
import multer from "multer";
import sharp from "sharp";
import path from "path";
import fs from "fs";
import { db, usersTable, listingsTable, listingFavoritesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { authMiddleware } from "../middlewares/auth";

const router = Router();

// ── Avatar upload setup ──────────────────────────────────────────
const UPLOADS_DIR = path.join(process.cwd(), "uploads", "avatars");
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB max
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif", "image/bmp"];
    cb(null, allowed.includes(file.mimetype));
  },
});

router.post("/users/avatar", authMiddleware, upload.single("avatar"), async (req, res): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: "Resim dosyası gerekli (jpg, png, webp, gif)" });
    return;
  }

  const filename = `${req.user!.id}_${Date.now()}.jpg`;
  const filepath = path.join(UPLOADS_DIR, filename);

  // Resize and convert to JPEG — max 256x256, quality 85
  await sharp(req.file.buffer)
    .resize(256, 256, { fit: "cover", position: "center" })
    .jpeg({ quality: 85 })
    .toFile(filepath);

  const avatarUrl = `/api/avatars/${filename}`;

  const [updated] = await db
    .update(usersTable)
    .set({ avatarUrl })
    .where(eq(usersTable.id, req.user!.id))
    .returning();

  res.json({
    id: updated.id,
    username: updated.username,
    email: updated.email,
    role: updated.role,
    avatarUrl: updated.avatarUrl,
    bio: updated.bio,
    nameColor: updated.nameColor,
    nameAnimated: updated.nameAnimated,
    isBanned: updated.isBanned,
    banReason: updated.banReason,
    banExpiresAt: updated.banExpiresAt?.toISOString() ?? null,
    createdAt: updated.createdAt.toISOString(),
  });
});

// ── User search for @ mention ─────────────────────────────────────
router.get("/users/search", async (req, res): Promise<void> => {
  const q = String(req.query["q"] ?? "").trim().toLowerCase();
  if (!q) { res.json([]); return; }

  const all = await db
    .select({ id: usersTable.id, username: usersTable.username, avatarUrl: usersTable.avatarUrl, role: usersTable.role })
    .from(usersTable)
    .limit(8);

  const filtered = all.filter(u => u.username.toLowerCase().startsWith(q)).slice(0, 6);
  res.json(filtered);
});

// ── Profile ───────────────────────────────────────────────────────
router.get("/users/profile/:username", async (req, res): Promise<void> => {
  const username = Array.isArray(req.params["username"]) ? req.params["username"][0] : req.params["username"];
  if (!username) { res.status(400).json({ error: "Geçersiz kullanıcı adı" }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.username, username));
  if (!user) { res.status(404).json({ error: "Kullanıcı bulunamadı" }); return; }

  const [countResult] = await db.select({ count: sql<number>`count(*)::int` }).from(listingsTable).where(eq(listingsTable.authorId, user.id));

  res.json({
    id: user.id,
    username: user.username,
    role: user.role,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    nameColor: user.nameColor,
    nameAnimated: user.nameAnimated,
    listingCount: countResult?.count ?? 0,
    createdAt: user.createdAt.toISOString(),
  });
});

router.patch("/users/me", authMiddleware, async (req, res): Promise<void> => {
  const { bio, avatarUrl } = req.body as { bio?: string | null; avatarUrl?: string | null };
  const updates: Partial<typeof usersTable.$inferInsert> = {};
  if (bio !== undefined) updates.bio = bio ?? null;
  if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl ?? null;

  const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.id, req.user!.id)).returning();
  res.json({
    id: updated.id,
    username: updated.username,
    email: updated.email,
    role: updated.role,
    avatarUrl: updated.avatarUrl,
    bio: updated.bio,
    nameColor: updated.nameColor,
    nameAnimated: updated.nameAnimated,
    isBanned: updated.isBanned,
    banReason: updated.banReason,
    banExpiresAt: updated.banExpiresAt?.toISOString() ?? null,
    createdAt: updated.createdAt.toISOString(),
  });
});

router.get("/users/favorites", authMiddleware, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const favs = await db.select({ listingId: listingFavoritesTable.listingId }).from(listingFavoritesTable).where(eq(listingFavoritesTable.userId, userId));
  if (favs.length === 0) { res.json([]); return; }

  const listingIds = favs.map(f => f.listingId);
  const listings = await db.select().from(listingsTable).where(sql`${listingsTable.id} = ANY(${listingIds})`);

  res.json(listings.map(l => ({
    id: l.id,
    title: l.title,
    company: l.company,
    city: l.city,
    salary: l.salary,
    workType: l.workType,
    description: l.description,
    requirements: l.requirements,
    status: l.status,
    viewCount: l.viewCount,
    likeCount: l.likeCount,
    isFeatured: l.isFeatured,
    applyUrl: l.applyUrl,
    companyLogoUrl: l.companyLogoUrl,
    authorId: l.authorId,
    authorUsername: null,
    isLikedByMe: false,
    isFavoritedByMe: true,
    createdAt: l.createdAt.toISOString(),
  })));
});

export default router;

import { Router } from "express";
import { db, usersTable, listingsTable, listingFavoritesTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { authMiddleware } from "../middlewares/auth";

const router = Router();

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

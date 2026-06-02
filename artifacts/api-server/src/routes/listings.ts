import { Router } from "express";
import { db, listingsTable, listingLikesTable, listingFavoritesTable, usersTable } from "@workspace/db";
import { eq, desc, and, sql, ilike, inArray } from "drizzle-orm";
import { authMiddleware, optionalAuthMiddleware, requireAdmin } from "../middlewares/auth";

const router = Router();

function formatListing(listing: typeof listingsTable.$inferSelect, userId?: number, likedIds?: Set<number>, favIds?: Set<number>, authorUsername?: string | null) {
  return {
    id: listing.id,
    title: listing.title,
    company: listing.company,
    city: listing.city,
    salary: listing.salary,
    workType: listing.workType,
    description: listing.description,
    requirements: listing.requirements,
    status: listing.status,
    viewCount: listing.viewCount,
    likeCount: listing.likeCount,
    isFeatured: listing.isFeatured,
    applyUrl: listing.applyUrl,
    companyLogoUrl: listing.companyLogoUrl,
    authorId: listing.authorId,
    authorUsername: authorUsername ?? null,
    isLikedByMe: userId != null && likedIds != null ? likedIds.has(listing.id) : false,
    isFavoritedByMe: userId != null && favIds != null ? favIds.has(listing.id) : false,
    createdAt: listing.createdAt.toISOString(),
  };
}

router.get("/listings", optionalAuthMiddleware, async (req, res): Promise<void> => {
  const page = Math.max(1, parseInt(String(req.query["page"] ?? "1"), 10));
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query["limit"] ?? "10"), 10)));
  const offset = (page - 1) * limit;
  const city = req.query["city"] as string | undefined;
  const search = req.query["search"] as string | undefined;
  const featured = req.query["featured"] === "true";

  const conditions = [];
  if (featured) conditions.push(eq(listingsTable.isFeatured, true));
  if (city) conditions.push(ilike(listingsTable.city, `%${city}%`));
  if (search) conditions.push(ilike(listingsTable.title, `%${search}%`));
  conditions.push(eq(listingsTable.status, "active"));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [listings, countResult] = await Promise.all([
    db.select().from(listingsTable).where(whereClause).orderBy(desc(listingsTable.isFeatured), desc(listingsTable.createdAt)).limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(listingsTable).where(whereClause),
  ]);

  const total = countResult[0]?.count ?? 0;
  const userId = req.user?.id;

  let likedIds = new Set<number>();
  let favIds = new Set<number>();

  if (userId) {
    const [likes, favs] = await Promise.all([
      db.select({ listingId: listingLikesTable.listingId }).from(listingLikesTable).where(eq(listingLikesTable.userId, userId)),
      db.select({ listingId: listingFavoritesTable.listingId }).from(listingFavoritesTable).where(eq(listingFavoritesTable.userId, userId)),
    ]);
    likedIds = new Set(likes.map(l => l.listingId));
    favIds = new Set(favs.map(f => f.listingId));
  }

  const authorIds = [...new Set(listings.map(l => l.authorId).filter(Boolean) as number[])];
  let authorMap = new Map<number, string>();
  if (authorIds.length > 0) {
    const authors = await db.select({ id: usersTable.id, username: usersTable.username }).from(usersTable).where(inArray(usersTable.id, authorIds));
    authorMap = new Map(authors.map(a => [a.id, a.username]));
  }

  res.json({
    listings: listings.map(l => formatListing(l, userId, likedIds, favIds, l.authorId ? authorMap.get(l.authorId) : null)),
    total,
    page,
    limit,
  });
});

router.post("/listings", authMiddleware, async (req, res): Promise<void> => {
  const { title, company, city, salary, workType, description, requirements, applyUrl, companyLogoUrl } = req.body as Record<string, string | undefined>;

  if (!title || !company || !city) {
    res.status(400).json({ error: "Başlık, firma ve şehir zorunludur" });
    return;
  }

  const [listing] = await db.insert(listingsTable).values({
    title,
    company,
    city,
    salary: salary ?? null,
    workType: workType ?? "Tam Zamanlı",
    description: description ?? null,
    requirements: requirements ?? null,
    applyUrl: applyUrl ?? null,
    companyLogoUrl: companyLogoUrl ?? null,
    authorId: req.user!.id,
    status: req.user!.role === "admin" ? "active" : "active",
  }).returning();

  res.status(201).json(formatListing(listing, req.user!.id, new Set(), new Set(), req.user!.username));
});

router.get("/listings/stats/summary", async (_req, res): Promise<void> => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [totalResult, todayResult, featuredResult, byCityResult] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(listingsTable).where(eq(listingsTable.status, "active")),
    db.select({ count: sql<number>`count(*)::int` }).from(listingsTable).where(and(eq(listingsTable.status, "active"), sql`${listingsTable.createdAt} >= ${today}`)),
    db.select({ count: sql<number>`count(*)::int` }).from(listingsTable).where(and(eq(listingsTable.status, "active"), eq(listingsTable.isFeatured, true))),
    db.select({ city: listingsTable.city, count: sql<number>`count(*)::int` }).from(listingsTable).where(eq(listingsTable.status, "active")).groupBy(listingsTable.city).orderBy(sql`count(*) desc`).limit(10),
  ]);

  res.json({
    total: totalResult[0]?.count ?? 0,
    today: todayResult[0]?.count ?? 0,
    featured: featuredResult[0]?.count ?? 0,
    byCity: byCityResult,
  });
});

router.get("/listings/:id", optionalAuthMiddleware, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params["id"]) ? req.params["id"][0] : req.params["id"];
  const id = parseInt(rawId ?? "", 10);
  if (isNaN(id)) { res.status(400).json({ error: "Geçersiz ID" }); return; }

  const [listing] = await db.select().from(listingsTable).where(eq(listingsTable.id, id));
  if (!listing) { res.status(404).json({ error: "İlan bulunamadı" }); return; }

  const userId = req.user?.id;
  let isLikedByMe = false;
  let isFavoritedByMe = false;

  if (userId) {
    const [like, fav] = await Promise.all([
      db.select().from(listingLikesTable).where(and(eq(listingLikesTable.listingId, id), eq(listingLikesTable.userId, userId))),
      db.select().from(listingFavoritesTable).where(and(eq(listingFavoritesTable.listingId, id), eq(listingFavoritesTable.userId, userId))),
    ]);
    isLikedByMe = like.length > 0;
    isFavoritedByMe = fav.length > 0;
  }

  let authorUsername: string | null = null;
  if (listing.authorId) {
    const [author] = await db.select({ username: usersTable.username }).from(usersTable).where(eq(usersTable.id, listing.authorId));
    authorUsername = author?.username ?? null;
  }

  res.json({ ...formatListing(listing, userId, isLikedByMe ? new Set([id]) : new Set(), isFavoritedByMe ? new Set([id]) : new Set(), authorUsername) });
});

router.patch("/listings/:id", authMiddleware, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params["id"]) ? req.params["id"][0] : req.params["id"];
  const id = parseInt(rawId ?? "", 10);
  if (isNaN(id)) { res.status(400).json({ error: "Geçersiz ID" }); return; }

  const [listing] = await db.select().from(listingsTable).where(eq(listingsTable.id, id));
  if (!listing) { res.status(404).json({ error: "İlan bulunamadı" }); return; }

  if (listing.authorId !== req.user!.id && req.user!.role !== "admin") {
    res.status(403).json({ error: "Bu ilanı düzenleme yetkiniz yok" });
    return;
  }

  const { title, company, city, salary, workType, description, requirements, status, applyUrl, isFeatured } = req.body as Record<string, unknown>;
  const updates: Partial<typeof listingsTable.$inferInsert> = {};
  if (title != null) updates.title = String(title);
  if (company != null) updates.company = String(company);
  if (city != null) updates.city = String(city);
  if (salary !== undefined) updates.salary = salary == null ? null : String(salary);
  if (workType != null) updates.workType = String(workType);
  if (description !== undefined) updates.description = description == null ? null : String(description);
  if (requirements !== undefined) updates.requirements = requirements == null ? null : String(requirements);
  if (status != null && req.user!.role === "admin") updates.status = String(status);
  if (applyUrl !== undefined) updates.applyUrl = applyUrl == null ? null : String(applyUrl);
  if (isFeatured !== undefined && req.user!.role === "admin") updates.isFeatured = Boolean(isFeatured);

  const [updated] = await db.update(listingsTable).set(updates).where(eq(listingsTable.id, id)).returning();
  res.json(formatListing(updated, req.user!.id, new Set(), new Set(), req.user!.username));
});

router.delete("/listings/:id", authMiddleware, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params["id"]) ? req.params["id"][0] : req.params["id"];
  const id = parseInt(rawId ?? "", 10);
  if (isNaN(id)) { res.status(400).json({ error: "Geçersiz ID" }); return; }

  const [listing] = await db.select().from(listingsTable).where(eq(listingsTable.id, id));
  if (!listing) { res.status(404).json({ error: "İlan bulunamadı" }); return; }

  if (listing.authorId !== req.user!.id && req.user!.role !== "admin") {
    res.status(403).json({ error: "Bu ilanı silme yetkiniz yok" });
    return;
  }

  await db.delete(listingsTable).where(eq(listingsTable.id, id));
  res.sendStatus(204);
});

router.post("/listings/:id/like", authMiddleware, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params["id"]) ? req.params["id"][0] : req.params["id"];
  const id = parseInt(rawId ?? "", 10);
  if (isNaN(id)) { res.status(400).json({ error: "Geçersiz ID" }); return; }

  const userId = req.user!.id;
  const [existing] = await db.select().from(listingLikesTable).where(and(eq(listingLikesTable.listingId, id), eq(listingLikesTable.userId, userId)));

  let liked: boolean;
  if (existing) {
    await db.delete(listingLikesTable).where(and(eq(listingLikesTable.listingId, id), eq(listingLikesTable.userId, userId)));
    await db.update(listingsTable).set({ likeCount: sql`GREATEST(0, ${listingsTable.likeCount} - 1)` }).where(eq(listingsTable.id, id));
    liked = false;
  } else {
    await db.insert(listingLikesTable).values({ listingId: id, userId });
    await db.update(listingsTable).set({ likeCount: sql`${listingsTable.likeCount} + 1` }).where(eq(listingsTable.id, id));
    liked = true;
  }

  const [updated] = await db.select({ likeCount: listingsTable.likeCount }).from(listingsTable).where(eq(listingsTable.id, id));
  res.json({ liked, likeCount: updated?.likeCount ?? 0 });
});

router.post("/listings/:id/favorite", authMiddleware, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params["id"]) ? req.params["id"][0] : req.params["id"];
  const id = parseInt(rawId ?? "", 10);
  if (isNaN(id)) { res.status(400).json({ error: "Geçersiz ID" }); return; }

  const userId = req.user!.id;
  const [existing] = await db.select().from(listingFavoritesTable).where(and(eq(listingFavoritesTable.listingId, id), eq(listingFavoritesTable.userId, userId)));

  if (existing) {
    await db.delete(listingFavoritesTable).where(and(eq(listingFavoritesTable.listingId, id), eq(listingFavoritesTable.userId, userId)));
    res.json({ favorited: false });
  } else {
    await db.insert(listingFavoritesTable).values({ listingId: id, userId });
    res.json({ favorited: true });
  }
});

router.post("/listings/:id/view", optionalAuthMiddleware, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params["id"]) ? req.params["id"][0] : req.params["id"];
  const id = parseInt(rawId ?? "", 10);
  if (isNaN(id)) { res.status(400).json({ error: "Geçersiz ID" }); return; }

  await db.update(listingsTable).set({ viewCount: sql`${listingsTable.viewCount} + 1` }).where(eq(listingsTable.id, id));
  res.json({ success: true });
});

// Admin: approve listing
router.post("/admin/listings/:id/approve", authMiddleware, requireAdmin, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params["id"]) ? req.params["id"][0] : req.params["id"];
  const id = parseInt(rawId ?? "", 10);
  if (isNaN(id)) { res.status(400).json({ error: "Geçersiz ID" }); return; }

  await db.update(listingsTable).set({ status: "active" }).where(eq(listingsTable.id, id));
  res.json({ success: true, message: "İlan onaylandı" });
});

// Admin: feature listing
router.post("/admin/listings/:id/feature", authMiddleware, requireAdmin, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params["id"]) ? req.params["id"][0] : req.params["id"];
  const id = parseInt(rawId ?? "", 10);
  if (isNaN(id)) { res.status(400).json({ error: "Geçersiz ID" }); return; }

  const [listing] = await db.select({ isFeatured: listingsTable.isFeatured }).from(listingsTable).where(eq(listingsTable.id, id));
  if (!listing) { res.status(404).json({ error: "İlan bulunamadı" }); return; }

  await db.update(listingsTable).set({ isFeatured: !listing.isFeatured }).where(eq(listingsTable.id, id));
  res.json({ success: true, message: listing.isFeatured ? "Öne çıkarma kaldırıldı" : "İlan öne çıkarıldı" });
});

// Admin: fake likes
router.post("/admin/listings/:id/fake-likes", authMiddleware, requireAdmin, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params["id"]) ? req.params["id"][0] : req.params["id"];
  const id = parseInt(rawId ?? "", 10);
  if (isNaN(id)) { res.status(400).json({ error: "Geçersiz ID" }); return; }

  const count = parseInt(String((req.body as Record<string, unknown>)["count"] ?? "10"), 10);
  await db.update(listingsTable).set({ likeCount: sql`${listingsTable.likeCount} + ${count}` }).where(eq(listingsTable.id, id));
  res.json({ success: true, message: `${count} sahte beğeni eklendi` });
});

export default router;

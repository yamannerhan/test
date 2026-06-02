import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq, or } from "drizzle-orm";
import { authMiddleware, signToken } from "../middlewares/auth";

const router = Router();

router.post("/auth/register", async (req, res): Promise<void> => {
  const { username, email, password } = req.body as { username?: string; email?: string; password?: string };

  if (!username || !email || !password) {
    res.status(400).json({ error: "Tüm alanlar zorunludur" });
    return;
  }
  if (username.length < 3) {
    res.status(400).json({ error: "Kullanıcı adı en az 3 karakter olmalıdır" });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: "Şifre en az 6 karakter olmalıdır" });
    return;
  }

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing) {
    res.status(400).json({ error: "Bu e-posta adresi zaten kayıtlı" });
    return;
  }

  const [existingUsername] = await db.select().from(usersTable).where(eq(usersTable.username, username));
  if (existingUsername) {
    res.status(400).json({ error: "Bu kullanıcı adı zaten alınmış" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db.insert(usersTable).values({
    username,
    email,
    passwordHash,
    role: "user",
  }).returning();

  const token = signToken(user.id, user.role);
  res.status(201).json({
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      nameColor: user.nameColor,
      nameAnimated: user.nameAnimated,
      isBanned: user.isBanned,
      banReason: user.banReason,
      banExpiresAt: user.banExpiresAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
    },
    token,
  });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400).json({ error: "E-posta/kullanıcı adı ve şifre zorunludur" });
    return;
  }

  // Allow login with either email or username
  const [user] = await db
    .select()
    .from(usersTable)
    .where(or(eq(usersTable.email, email), eq(usersTable.username, email)));

  if (!user) {
    res.status(401).json({ error: "E-posta/kullanıcı adı veya şifre hatalı" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "E-posta/kullanıcı adı veya şifre hatalı" });
    return;
  }

  if (user.isBanned) {
    const now = new Date();
    if (!user.banExpiresAt || user.banExpiresAt > now) {
      res.status(403).json({ error: "Hesabınız yasaklandı", banReason: user.banReason });
      return;
    }
  }

  const token = signToken(user.id, user.role);
  res.json({
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      nameColor: user.nameColor,
      nameAnimated: user.nameAnimated,
      isBanned: user.isBanned,
      banReason: user.banReason,
      banExpiresAt: user.banExpiresAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
    },
    token,
  });
});

router.post("/auth/logout", (_req, res): void => {
  res.json({ success: true, message: "Çıkış yapıldı" });
});

router.get("/auth/me", authMiddleware, (req, res): void => {
  const user = req.user!;
  res.json({
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    nameColor: user.nameColor,
    nameAnimated: user.nameAnimated,
    isBanned: user.isBanned,
    banReason: user.banReason,
    banExpiresAt: user.banExpiresAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  });
});

export default router;

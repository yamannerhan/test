import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

const JWT_SECRET = process.env.SESSION_SECRET ?? "ozelguvenlik-secret-key";

export interface JwtPayload {
  userId: number;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        username: string;
        email: string;
        role: string;
        avatarUrl: string | null;
        bio: string | null;
        nameColor: string | null;
        nameAnimated: boolean;
        isBanned: boolean;
        banReason: string | null;
        banExpiresAt: Date | null;
        createdAt: Date;
      };
    }
  }
}

export function signToken(userId: number, role: string): string {
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: "30d" });
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Giriş yapmanız gerekiyor" });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.userId));
    if (!user) {
      res.status(401).json({ error: "Kullanıcı bulunamadı" });
      return;
    }
    if (user.isBanned) {
      const now = new Date();
      if (!user.banExpiresAt || user.banExpiresAt > now) {
        res.status(403).json({ error: "Hesabınız yasaklandı", banReason: user.banReason });
        return;
      }
    }
    req.user = user;
    next();
  } catch {
    logger.warn("Invalid JWT token");
    res.status(401).json({ error: "Geçersiz token" });
  }
}

export async function optionalAuthMiddleware(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    next();
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.userId));
    if (user && !user.isBanned) {
      req.user = user;
    }
  } catch {
    // ignore invalid token
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || req.user.role !== "admin") {
    res.status(403).json({ error: "Admin yetkisi gerekiyor" });
    return;
  }
  next();
}

export function requireAdminOrModerator(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || !["admin", "moderator"].includes(req.user.role)) {
    res.status(403).json({ error: "Admin veya moderatör yetkisi gerekiyor" });
    return;
  }
  next();
}

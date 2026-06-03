import { Router } from "express";
import { authMiddleware, requireAdmin } from "../middlewares/auth";
import {
  getAuthState,
  startAuth,
  verifyCode,
  verifyPassword,
  logoutTelegram,
} from "../services/telegram-client";

const router = Router();

router.get("/admin/telegram/status", authMiddleware, requireAdmin, async (_req, res): Promise<void> => {
  const state = await getAuthState();
  res.json(state);
});

router.post("/admin/telegram/auth/start", authMiddleware, requireAdmin, async (req, res): Promise<void> => {
  const { phone } = req.body as { phone?: string };
  if (!phone?.trim()) { res.status(400).json({ error: "Telefon numarası zorunlu" }); return; }
  try {
    await startAuth(phone.trim());
    res.json({ ok: true, message: "Doğrulama kodu telefonunuza gönderildi" });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(400).json({ error: msg });
  }
});

router.post("/admin/telegram/auth/verify", authMiddleware, requireAdmin, async (req, res): Promise<void> => {
  const { code } = req.body as { code?: string };
  if (!code?.trim()) { res.status(400).json({ error: "Kod zorunlu" }); return; }
  try {
    const result = await verifyCode(code.trim());
    res.json({ ok: true, needs2FA: result.needs2FA });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(400).json({ error: msg });
  }
});

router.post("/admin/telegram/auth/password", authMiddleware, requireAdmin, async (req, res): Promise<void> => {
  const { password } = req.body as { password?: string };
  if (!password) { res.status(400).json({ error: "Şifre zorunlu" }); return; }
  try {
    await verifyPassword(password);
    res.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(400).json({ error: msg });
  }
});

router.post("/admin/telegram/auth/logout", authMiddleware, requireAdmin, async (_req, res): Promise<void> => {
  await logoutTelegram();
  res.json({ ok: true });
});

export default router;

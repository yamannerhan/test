import { Router } from "express";
import { authMiddleware, requireAdmin } from "../middlewares/auth";
import { getBotInfo, isBotTokenSet } from "../services/telegram-client";

const router = Router();

router.get("/admin/telegram/status", authMiddleware, requireAdmin, async (_req, res): Promise<void> => {
  const tokenSet = isBotTokenSet();
  if (!tokenSet) {
    res.json({ connected: false, bot: null, message: "TELEGRAM_BOT_TOKEN ayarlanmamış" });
    return;
  }
  const bot = await getBotInfo();
  if (!bot) {
    res.json({ connected: false, bot: null, message: "Bot token geçersiz veya Telegram'a erişilemiyor" });
    return;
  }
  res.json({ connected: true, bot, message: null });
});

export default router;

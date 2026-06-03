const BOT_TOKEN = process.env["TELEGRAM_BOT_TOKEN"] ?? "";
const BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

export interface BotInfo {
  id: number;
  username: string;
  firstName: string;
}

export interface BotUpdate {
  update_id: number;
  message?: { message_id: number; chat: { id: number; username?: string; title?: string; type: string }; text?: string; date: number };
  channel_post?: { message_id: number; chat: { id: number; username?: string; title?: string; type: string }; text?: string; date: number };
}

export function isBotTokenSet(): boolean {
  return BOT_TOKEN.length > 10;
}

export async function getBotInfo(): Promise<BotInfo | null> {
  if (!isBotTokenSet()) return null;
  try {
    const res = await fetch(`${BASE}/getMe`, { signal: AbortSignal.timeout(8000) });
    const data = await res.json() as { ok: boolean; result?: { id: number; username: string; first_name: string } };
    if (!data.ok || !data.result) return null;
    return { id: data.result.id, username: data.result.username, firstName: data.result.first_name };
  } catch {
    return null;
  }
}

export async function getUpdates(offset: number, limit = 100): Promise<BotUpdate[]> {
  if (!isBotTokenSet()) return [];
  try {
    const url = `${BASE}/getUpdates?offset=${offset}&limit=${limit}&timeout=0&allowed_updates=["message","channel_post"]`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    const data = await res.json() as { ok: boolean; result?: BotUpdate[] };
    return data.ok ? (data.result ?? []) : [];
  } catch {
    return [];
  }
}

export function isClientConnected(): boolean {
  return isBotTokenSet();
}

// Kept for scraper compatibility — unused in bot mode
export async function fetchMessagesViaClient(_username: string, _limit?: number): Promise<never[]> {
  return [];
}

export async function initTelegramClient(): Promise<void> {
  // No-op in bot mode
}

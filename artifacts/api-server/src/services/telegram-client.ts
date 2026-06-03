import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { db, telegramSessionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

const API_ID = parseInt(process.env["TELEGRAM_API_ID"] ?? "0", 10);
const API_HASH = process.env["TELEGRAM_API_HASH"] ?? "";

export type TgAuthState = "disconnected" | "awaiting_code" | "awaiting_password" | "connected";

interface ScrapedMessage {
  id: string;
  text: string;
  url: string;
}

let _client: TelegramClient | null = null;

function buildClient(sessionStr = ""): TelegramClient {
  return new TelegramClient(
    new StringSession(sessionStr),
    API_ID,
    API_HASH,
    {
      connectionRetries: 3,
      retryDelay: 1000,
      // Suppress verbose GramJS console output
      baseLogger: { levels: [] as string[] } as never,
    }
  );
}

async function getOrCreateRow() {
  const [row] = await db.select().from(telegramSessionsTable).limit(1);
  if (row) return row;
  const [created] = await db.insert(telegramSessionsTable).values({ authState: "disconnected" }).returning();
  return created!;
}

async function saveState(patch: Partial<typeof telegramSessionsTable.$inferInsert>) {
  const row = await getOrCreateRow();
  await db.update(telegramSessionsTable)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(telegramSessionsTable.id, row.id));
}

export async function getAuthState(): Promise<{ state: TgAuthState; phone: string | null; connected: boolean }> {
  const row = await getOrCreateRow();
  const connected = _client?.connected ?? false;
  return {
    state: (row.authState as TgAuthState) ?? "disconnected",
    phone: row.phone ?? null,
    connected: connected && row.authState === "connected",
  };
}

export async function initTelegramClient(): Promise<void> {
  if (!API_ID || !API_HASH) return;
  try {
    const row = await getOrCreateRow();
    if (row.authState === "connected" && row.sessionString) {
      _client = buildClient(row.sessionString);
      await _client.connect();
      if (_client.connected) {
        logger.info("telegram-client: session restored");
      } else {
        await saveState({ authState: "disconnected", sessionString: null });
      }
    }
  } catch (e) {
    logger.error(e, "telegram-client: failed to restore session");
    await saveState({ authState: "disconnected", sessionString: null });
  }
}

export async function startAuth(phone: string): Promise<void> {
  if (!API_ID || !API_HASH) throw new Error("TELEGRAM_API_ID ve TELEGRAM_API_HASH tanımlı değil");

  if (_client) {
    try { await _client.disconnect(); } catch { /* ignore */ }
    _client = null;
  }

  _client = buildClient();
  await _client.connect();

  const result = await _client.sendCode({ apiId: API_ID, apiHash: API_HASH }, phone);
  await saveState({
    phone,
    phoneCodeHash: result.phoneCodeHash,
    authState: "awaiting_code",
    sessionString: null,
  });
}

export async function verifyCode(code: string): Promise<{ needs2FA: boolean }> {
  if (!_client) throw new Error("Önce telefon numarası girin");

  const row = await getOrCreateRow();
  if (!row.phone || !row.phoneCodeHash) throw new Error("Oturum bulunamadı, telefon numarasını tekrar girin");

  try {
    await _client.signIn(
      { apiId: API_ID, apiHash: API_HASH },
      { phoneNumber: row.phone, phoneCodeHash: row.phoneCodeHash, phoneCode: code }
    );
    const sessionStr = _client.session.save() as unknown as string;
    await saveState({ authState: "connected", sessionString: sessionStr, phoneCodeHash: null });
    return { needs2FA: false };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("SESSION_PASSWORD_NEEDED") || msg.includes("password")) {
      await saveState({ authState: "awaiting_password" });
      return { needs2FA: true };
    }
    throw new Error(`Kod doğrulanamadı: ${msg}`);
  }
}

export async function verifyPassword(password: string): Promise<void> {
  if (!_client) throw new Error("Oturum bulunamadı");

  try {
    await _client.signInWithPassword(
      { apiId: API_ID, apiHash: API_HASH },
      {
        password: async () => password,
        onError: async (e: Error) => { throw e; },
      }
    );
    const sessionStr = _client.session.save() as unknown as string;
    await saveState({ authState: "connected", sessionString: sessionStr, phoneCodeHash: null });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Şifre hatalı: ${msg}`);
  }
}

export async function logoutTelegram(): Promise<void> {
  try {
    if (_client?.connected) {
      await _client.invoke({ className: "auth.LogOut" } as never);
      await _client.disconnect();
    }
  } catch { /* ignore */ }
  _client = null;
  await saveState({ authState: "disconnected", sessionString: null, phoneCodeHash: null, phone: null });
}

export async function fetchMessagesViaClient(username: string, limit = 50): Promise<ScrapedMessage[]> {
  if (!_client?.connected) throw new Error("Telegram oturumu yok");

  const messages = await _client.getMessages(username, { limit });
  const result: ScrapedMessage[] = [];

  for (const msg of messages) {
    const text = (msg as { message?: string }).message ?? "";
    if (!text.trim()) continue;
    result.push({
      id: String(msg.id),
      text,
      url: `https://t.me/${username}/${msg.id}`,
    });
  }
  return result;
}

export function isClientConnected(): boolean {
  return _client?.connected === true;
}

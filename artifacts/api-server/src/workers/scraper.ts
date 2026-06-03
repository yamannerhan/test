import crypto from "crypto";
import { db, sourcesTable, importedPostsTable, pendingJobsTable, listingsTable } from "@workspace/db";
import { eq, and, or } from "drizzle-orm";
import { logger } from "../lib/logger";

const TELEGRAM_TOKEN = process.env["TELEGRAM_BOT_TOKEN"] ?? "";
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

// ── Keyword lists ──────────────────────────────────────────────────
const JOB_KEYWORDS = [
  "özel güvenlik", "güvenlik görevlisi", "silahlı", "silahsız",
  "personel aranıyor", "eleman aranıyor", "vardiya", "maaş",
  "yol ", "yemek", "sgk", "başvuru", "iletişim", "telefon", "şehir", "firma",
];
const CHAT_SKIP_KEYWORDS = [
  "selam", "merhaba", "nasılsın", "iş var mı", "iş arıyorum",
  "özelden yaz", "teşekkür", "tamam", "günaydın", "iyi akşam",
  "kolay gelsin", "iyi günler",
];
const TR_CITIES = [
  "istanbul", "ankara", "izmir", "bursa", "antalya", "adana", "konya",
  "gaziantep", "kocaeli", "mersin", "diyarbakır", "hatay", "manisa",
  "kayseri", "samsun", "tekirdağ", "balıkesir", "sakarya", "denizli",
  "trabzon", "malatya", "eskişehir", "erzurum", "rize", "ordu",
  "zonguldak", "van", "şanlıurfa", "afyon", "aydın", "muğla",
];
const CITY_DISPLAY: Record<string, string> = {
  istanbul: "İstanbul", ankara: "Ankara", izmir: "İzmir",
  bursa: "Bursa", antalya: "Antalya", adana: "Adana", konya: "Konya",
  gaziantep: "Gaziantep", kocaeli: "Kocaeli", mersin: "Mersin",
  diyarbakır: "Diyarbakır", hatay: "Hatay", manisa: "Manisa",
  kayseri: "Kayseri", samsun: "Samsun", tekirdağ: "Tekirdağ",
  balıkesir: "Balıkesir", sakarya: "Sakarya", denizli: "Denizli",
  trabzon: "Trabzon", malatya: "Malatya", eskişehir: "Eskişehir",
  erzurum: "Erzurum", rize: "Rize", ordu: "Ordu", zonguldak: "Zonguldak",
  van: "Van", şanlıurfa: "Şanlıurfa", afyon: "Afyon", aydın: "Aydın", muğla: "Muğla",
};

// ── Text utils ─────────────────────────────────────────────────────
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function createDuplicateHash(text: string): string {
  const phone = extractPhone(text) ?? "";
  const city = extractCity(text) ?? "";
  const normalized = normalizeText(text).slice(0, 250);
  return crypto.createHash("sha256").update(`${phone}|${city}|${normalized}`).digest("hex");
}

function extractPhone(text: string): string | null {
  const m = text.match(/(?:\+90|0)?[\s\-.]?(?:5\d{2})[\s\-.]?\d{3}[\s\-.]?\d{2}[\s\-.]?\d{2}/);
  return m ? m[0].replace(/[\s\-.]/g, "") : null;
}

function extractCity(text: string): string | null {
  const lower = normalizeText(text);
  const found = TR_CITIES.find(c => lower.includes(c));
  return found ? (CITY_DISPLAY[found] ?? found) : null;
}

function extractSalary(text: string): string | null {
  const m = text.match(/(\d[\d.,]*)\s*(?:TL|₺|tl)/i);
  if (m) return `${m[1]} TL`;
  const range = text.match(/(\d[\d.]+)\s*[-–]\s*(\d[\d.]+)\s*(?:TL|₺)/i);
  if (range) return `${range[1]}-${range[2]} TL`;
  return null;
}

function extractTitle(text: string): string {
  const lower = normalizeText(text);
  const TITLES = [
    "silahlı güvenlik görevlisi", "silahsız güvenlik görevlisi",
    "güvenlik amiri", "güvenlik şefi", "güvenlik müdürü",
    "özel güvenlik görevlisi", "güvenlik personeli",
    "güvenlik görevlisi",
  ];
  const found = TITLES.find(t => lower.includes(t));
  if (found) return found.charAt(0).toUpperCase() + found.slice(1);
  if (lower.includes("silahlı")) return "Silahlı Güvenlik Görevlisi Aranıyor";
  if (lower.includes("silahsız")) return "Silahsız Güvenlik Görevlisi Aranıyor";
  return "Güvenlik Personeli Aranıyor";
}

function isJobPosting(text: string): boolean {
  if (text.length < 30) return false;
  const lower = normalizeText(text);
  const count = JOB_KEYWORDS.filter(kw => lower.includes(kw)).length;
  return count >= 3;
}

function isChatMessage(text: string): boolean {
  if (text.length > 300) return false;
  const lower = normalizeText(text);
  return CHAT_SKIP_KEYWORDS.some(kw => lower.includes(kw));
}

function extractTelegramUsername(url: string): string | null {
  const m = url.match(/t\.me\/([^/?+\s]+)/);
  return m ? m[1].toLowerCase() : null;
}

// ── Telegram polling ───────────────────────────────────────────────
let telegramOffset = 0;

interface TgMessage {
  message_id: number;
  text?: string;
  caption?: string;
  chat: { id: number; username?: string; type: string };
  date: number;
}

interface TgUpdate {
  update_id: number;
  message?: TgMessage;
  channel_post?: TgMessage;
}

async function telegramGetUpdates(): Promise<TgUpdate[]> {
  try {
    const res = await fetch(
      `${TELEGRAM_API}/getUpdates?offset=${telegramOffset + 1}&limit=100&timeout=0&allowed_updates=["message","channel_post"]`,
      { signal: AbortSignal.timeout(15_000) }
    );
    if (!res.ok) return [];
    const data = await res.json() as { ok: boolean; result: TgUpdate[] };
    return data.ok ? data.result : [];
  } catch {
    return [];
  }
}

// ── Core processing ────────────────────────────────────────────────
async function processMessage(
  source: typeof sourcesTable.$inferSelect,
  externalId: string,
  text: string,
  sourceUrl: string,
): Promise<void> {
  if (!text?.trim() || isChatMessage(text)) return;
  if (!isJobPosting(text)) return;

  const hash = createDuplicateHash(text);

  // Duplicate check
  const existing = await db.select({ id: importedPostsTable.id })
    .from(importedPostsTable)
    .where(eq(importedPostsTable.duplicateHash, hash))
    .limit(1);
  if (existing.length > 0) return;

  // Save imported post
  const [imported] = await db.insert(importedPostsTable).values({
    sourceId: source.id,
    platform: source.platform,
    externalId,
    rawText: text,
    sourceUrl,
    duplicateHash: hash,
    isJob: true,
    status: "pending",
  }).returning();

  if (!imported) return;

  // Increment counter
  await db.update(sourcesTable)
    .set({ totalImported: (source.totalImported ?? 0) + 1 })
    .where(eq(sourcesTable.id, source.id));

  const title = extractTitle(text);
  const city = extractCity(text) ?? "Türkiye";
  const salary = extractSalary(text);
  const phone = extractPhone(text);

  if (source.autoPublish && !source.requireApproval) {
    // Auto-publish directly to listings
    await db.insert(listingsTable).values({
      title: title ?? "Güvenlik Personeli Aranıyor",
      company: "Belirtilmemiş",
      city,
      salary: salary ?? undefined,
      workType: "Tam Zamanlı",
      description: text,
      status: "active",
      applyUrl: sourceUrl,
    });
    await db.update(importedPostsTable)
      .set({ status: "approved" })
      .where(eq(importedPostsTable.id, imported.id));
  } else {
    // Add to pending jobs queue
    await db.insert(pendingJobsTable).values({
      sourceId: source.id,
      importedPostId: imported.id,
      rawText: text,
      title,
      company: null,
      city,
      salary,
      phone,
      description: text,
      applicationUrl: null,
      sourceUrl,
      platform: source.platform,
      status: "pending",
      duplicateHash: hash,
    });
  }
}

// ── Telegram poll cycle ────────────────────────────────────────────
async function runTelegramPoll(): Promise<void> {
  if (!TELEGRAM_TOKEN) return;

  const updates = await telegramGetUpdates();
  if (updates.length === 0) return;

  // Update offset
  telegramOffset = Math.max(...updates.map(u => u.update_id));

  // Get active Telegram sources
  const sources = await db.select().from(sourcesTable)
    .where(and(eq(sourcesTable.platform, "telegram"), eq(sourcesTable.active, true)));

  if (sources.length === 0) return;

  for (const update of updates) {
    const msg = update.message ?? update.channel_post;
    if (!msg) continue;

    const text = msg.text ?? msg.caption ?? "";
    if (!text.trim()) continue;

    const chatId = String(msg.chat.id);
    const chatUsername = msg.chat.username?.toLowerCase() ?? "";

    // Match to a source
    const source = sources.find(s => {
      // Match by stored chat ID
      if (s.telegramChatId === chatId) return true;
      // Match by username from URL
      const urlUsername = extractTelegramUsername(s.url);
      if (urlUsername && chatUsername === urlUsername) return true;
      return false;
    });

    if (!source) continue;

    // Check interval
    const now = new Date();
    const intervalMs = (source.checkInterval ?? 15) * 60 * 1000;
    if (source.lastCheckedAt && (now.getTime() - source.lastCheckedAt.getTime()) < intervalMs) continue;

    // Store chat ID if not already set
    if (!source.telegramChatId && chatId) {
      await db.update(sourcesTable)
        .set({ telegramChatId: chatId })
        .where(eq(sourcesTable.id, source.id));
    }

    const msgUrl = chatUsername
      ? `https://t.me/${chatUsername}/${msg.message_id}`
      : source.url;

    try {
      await processMessage(source, `${chatId}_${msg.message_id}`, text, msgUrl);
      await db.update(sourcesTable)
        .set({ lastCheckedAt: now, lastError: null })
        .where(eq(sourcesTable.id, source.id));
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      logger.error(e, `scraper: error processing message from source ${source.id}`);
      await db.update(sourcesTable)
        .set({ lastError: errMsg.slice(0, 500) })
        .where(eq(sourcesTable.id, source.id));
    }
  }
}

// ── Public API ────────────────────────────────────────────────────
export function startScraperWorker(): void {
  if (!TELEGRAM_TOKEN) {
    logger.warn("scraper: TELEGRAM_BOT_TOKEN not set — Telegram scraping disabled");
    return;
  }

  logger.info("scraper: worker started");

  // Poll every 30 seconds
  setInterval(async () => {
    try {
      await runTelegramPoll();
    } catch (e) {
      logger.error(e, "scraper: poll error");
    }
  }, 30_000);

  // Also run immediately after startup
  setTimeout(async () => {
    try {
      await runTelegramPoll();
    } catch {}
  }, 5_000);
}

export function isTelegramTokenSet(): boolean {
  return !!TELEGRAM_TOKEN;
}

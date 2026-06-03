import crypto from "crypto";
import { db, sourcesTable, importedPostsTable, pendingJobsTable, listingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";
import { getUpdates, isBotTokenSet } from "../services/telegram-client";
import type { BotUpdate } from "../services/telegram-client";

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
  const range = text.match(/(\d[\d.]+)\s*[-–]\s*(\d[\d.]+)\s*(?:TL|₺)/i);
  if (range) return `${range[1]}-${range[2]} TL`;
  const m = text.match(/(\d[\d.,]*)\s*(?:TL|₺|tl)/i);
  if (m) return `${m[1]} TL`;
  return null;
}

function extractTitle(text: string): string {
  const lower = normalizeText(text);
  const TITLES = [
    "silahlı güvenlik görevlisi", "silahsız güvenlik görevlisi",
    "güvenlik amiri", "güvenlik şefi", "güvenlik müdürü",
    "özel güvenlik görevlisi", "güvenlik personeli", "güvenlik görevlisi",
  ];
  const found = TITLES.find(t => lower.includes(t));
  if (found) return found.charAt(0).toUpperCase() + found.slice(1);
  if (lower.includes("silahlı")) return "Silahlı Güvenlik Görevlisi Aranıyor";
  if (lower.includes("silahsız")) return "Silahsız Güvenlik Görevlisi Aranıyor";
  return "Güvenlik Personeli Aranıyor";
}

function createDuplicateHash(text: string): string {
  const phone = extractPhone(text) ?? "";
  const city = extractCity(text) ?? "";
  const normalized = normalizeText(text).slice(0, 250);
  return crypto.createHash("sha256").update(`${phone}|${city}|${normalized}`).digest("hex");
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
  const m = url.match(/t\.me\/(?:s\/)?([^/?+\s]+)/);
  if (!m) return null;
  const name = m[1];
  return name.startsWith("+") ? null : name.toLowerCase();
}

// ── Telegram web scraping (no bot token needed) ────────────────────
interface ScrapedMessage { id: string; text: string; url: string }

function decodeHtmlEntities(html: string): string {
  return html
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function stripHtmlTags(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, "")
  ).trim();
}

async function scrapeTelegramChannel(username: string): Promise<ScrapedMessage[]> {
  const url = `https://t.me/s/${username}`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
      },
      signal: AbortSignal.timeout(20_000),
    });

    if (!res.ok) {
      if (res.status === 404) throw new Error("Kanal bulunamadı. Kullanıcı adını kontrol edin.");
      throw new Error(`HTTP ${res.status} — kanala erişilemiyor`);
    }

    // Detect redirect: t.me/s/username → t.me/username (web preview disabled)
    const finalUrl = res.url ?? "";
    const webPreviewDisabled = !finalUrl.includes("/s/");

    const html = await res.text();

    if (webPreviewDisabled || !html.includes("data-post")) {
      // Check if channel exists at all
      const hasChannel = html.includes("tgme_page_title") || html.includes("tgme_page");
      if (!hasChannel) {
        throw new Error("Kanal bulunamadı. Kullanıcı adını kontrol edin.");
      }
      // Extract member count for better error
      const membersMatch = html.match(/>([\d,. ]+)\s*(?:üye|member|subscriber|abone)/i);
      const memberInfo = membersMatch ? ` (${membersMatch[1].trim()} üye)` : "";
      throw new Error(
        `Bu kanalda web önizleme kapalı${memberInfo}. ` +
        `Kanal yöneticisi Telegram'da şu adımları izlemeli: ` +
        `Kanal Ayarları → Kanal Türü → "Önizlemeyi Etkinleştir" (Preview Channel) seçeneğini açsın.`
      );
    }

    const messages: ScrapedMessage[] = [];

    // Split HTML into per-message sections on data-post boundaries
    const sections = html.split(/(?=<div[^>]+data-post=")/);

    for (const section of sections) {
      const postMatch = section.match(/data-post="([^"/]+)\/(\d+)"/);
      if (!postMatch) continue;

      const postPath = postMatch[1] ?? "";
      const msgId = postMatch[2] ?? "";

      // Locate the message text div by its unique class
      const markerIdx = section.indexOf("js-message_text");
      if (markerIdx === -1) continue;

      // Find the opening tag's closing ">"
      const openEnd = section.indexOf(">", markerIdx);
      if (openEnd === -1) continue;

      // Find the closing </div> — inline elements (<b>,<a>,<br>) don't nest divs
      const closeDiv = section.indexOf("</div>", openEnd);
      const rawHtml = closeDiv === -1
        ? section.slice(openEnd + 1, openEnd + 2000)
        : section.slice(openEnd + 1, closeDiv);

      const text = stripHtmlTags(rawHtml).trim();
      if (text.length > 0) {
        messages.push({
          id: msgId,
          text,
          url: `https://t.me/${postPath}/${msgId}`,
        });
      }
    }

    return messages;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Pass through already-formatted errors
    if (msg.includes("kapalı") || msg.includes("bulunamadı") || msg.includes("erişilemiyor")) {
      throw new Error(msg);
    }
    throw new Error(`Kanal verisi alınamadı: ${msg}`);
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

  const existing = await db.select({ id: importedPostsTable.id })
    .from(importedPostsTable)
    .where(eq(importedPostsTable.duplicateHash, hash))
    .limit(1);
  if (existing.length > 0) return;

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

  await db.update(sourcesTable)
    .set({ totalImported: (source.totalImported ?? 0) + 1 })
    .where(eq(sourcesTable.id, source.id));

  const title = extractTitle(text);
  const city = extractCity(text) ?? "Türkiye";
  const salary = extractSalary(text);
  const phone = extractPhone(text);

  if (source.autoPublish && !source.requireApproval) {
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

// ── Bot API polling state ──────────────────────────────────────────
let botUpdateOffset = 0;

async function processBotUpdates(): Promise<void> {
  if (!isBotTokenSet()) return;

  const updates = await getUpdates(botUpdateOffset);
  if (updates.length === 0) return;

  // Load active telegram sources once
  const sources = await db.select().from(sourcesTable)
    .where(eq(sourcesTable.active, true));
  const telegramSources = sources.filter(s => s.platform === "telegram");

  for (const update of updates) {
    const post = update.channel_post ?? update.message;
    if (!post?.text || post.text.length < 30) {
      botUpdateOffset = update.update_id + 1;
      continue;
    }

    const chatUsername = post.chat.username?.toLowerCase();
    const chatId = String(post.chat.id);

    // Match to a registered source by username or saved chatId
    const source = telegramSources.find(s => {
      const srcUsername = extractTelegramUsername(s.url);
      return (chatUsername && srcUsername === chatUsername) ||
             (s.telegramChatId && s.telegramChatId === chatId);
    });

    if (source) {
      // Save chatId for future matching if not stored
      if (!source.telegramChatId) {
        await db.update(sourcesTable)
          .set({ telegramChatId: chatId })
          .where(eq(sourcesTable.id, source.id));
        source.telegramChatId = chatId;
      }
      const msgUrl = chatUsername
        ? `https://t.me/${chatUsername}/${post.message_id}`
        : `https://t.me/c/${chatId.replace("-100", "")}/${post.message_id}`;
      try {
        await processMessage(source, `bot_${chatId}_${post.message_id}`, post.text, msgUrl);
      } catch (e) {
        logger.error(e, `scraper: bot update processing error`);
      }
    }

    botUpdateOffset = update.update_id + 1;
  }
}

// ── Check a single Telegram source via web scraping ────────────────
async function checkTelegramSource(source: typeof sourcesTable.$inferSelect): Promise<void> {
  const username = extractTelegramUsername(source.url);
  if (!username) {
    await db.update(sourcesTable)
      .set({ lastError: "Geçersiz Telegram kanal linki. Örnek: https://t.me/kanal_adi" })
      .where(eq(sourcesTable.id, source.id));
    return;
  }

  logger.info(`scraper: web-scraping @${username}`);

  const messages = await scrapeTelegramChannel(username);

  if (messages.length === 0) {
    await db.update(sourcesTable)
      .set({
        lastCheckedAt: new Date(),
        lastError: "Kanal boş veya mesajlar okunamadı. Kanal herkese açık olmalı.",
      })
      .where(eq(sourcesTable.id, source.id));
    return;
  }

  let processed = 0;
  for (const msg of messages) {
    try {
      await processMessage(source, `${username}_${msg.id}`, msg.text, msg.url);
      processed++;
    } catch (e) {
      logger.error(e, `scraper: error processing msg ${msg.id} from @${username}`);
    }
  }

  await db.update(sourcesTable)
    .set({ lastCheckedAt: new Date(), lastError: null })
    .where(eq(sourcesTable.id, source.id));

  logger.info(`scraper: @${username} — ${messages.length} mesaj tarandı, ${processed} işlendi`);
}

// ── Main scraper loop ──────────────────────────────────────────────
async function runScraperCycle(): Promise<void> {
  // 1) Pull all updates the bot received across all its chats
  await processBotUpdates();

  // 2) For sources that have web preview enabled, also scrape periodically
  const sources = await db.select().from(sourcesTable)
    .where(eq(sourcesTable.active, true));

  const now = new Date();

  for (const source of sources) {
    const intervalMs = (source.checkInterval ?? 15) * 60 * 1000;
    const lastChecked = source.lastCheckedAt?.getTime() ?? 0;
    if (now.getTime() - lastChecked < intervalMs) continue;

    if (source.platform === "telegram") {
      try {
        await checkTelegramSource(source);
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        logger.warn(`scraper: web scrape failed for source ${source.id}: ${errMsg}`);
        await db.update(sourcesTable)
          .set({ lastError: errMsg.slice(0, 500), lastCheckedAt: now })
          .where(eq(sourcesTable.id, source.id));
      }
    } else if (source.platform === "facebook") {
      await db.update(sourcesTable)
        .set({ lastError: "Facebook entegrasyonu henüz aktif değil." })
        .where(eq(sourcesTable.id, source.id));
    }
  }
}

// ── Public API ─────────────────────────────────────────────────────
export function startScraperWorker(): void {
  const mode = isBotTokenSet() ? "Bot API polling + web scraping fallback" : "web scraping only";
  logger.info(`scraper: worker started (${mode})`);

  // Bot polling runs every 30 seconds for fast message delivery
  if (isBotTokenSet()) {
    setInterval(async () => {
      try { await processBotUpdates(); }
      catch (e) { logger.error(e, "scraper: bot poll error"); }
    }, 30_000);
  }

  // Full cycle (web scraping + bot poll) runs every minute
  setInterval(async () => {
    try { await runScraperCycle(); }
    catch (e) { logger.error(e, "scraper: cycle error"); }
  }, 60_000);

  // Run immediately after 10 seconds
  setTimeout(async () => {
    try { await runScraperCycle(); }
    catch (e) { logger.error(e, "scraper: initial run error"); }
  }, 10_000);
}

export function isTelegramTokenSet(): boolean {
  return isBotTokenSet();
}

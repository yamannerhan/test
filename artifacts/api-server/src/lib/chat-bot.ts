import { db, listingsTable, adminSettingsTable } from "@workspace/db";
import { eq, count, sql } from "drizzle-orm";

type IO = { emit: (event: string, data: unknown) => void };
let _io: IO | null = null;

export function setBotIo(io: IO) { _io = io; }

const BOT_USER = {
  id: 0, username: "GuvenlikBot", displayName: "GuvenlikBot",
  userRole: "bot", userAvatarUrl: null,
  userNameColor: "#06B6D4", userNameAnimated: false, isBot: true,
};

function makeBotMsg(content: string, replyToUsername?: string) {
  return {
    ...BOT_USER,
    id: Date.now() + Math.random(),
    content,
    replyToId: null,
    replyToUsername: replyToUsername ?? null,
    replyToContent: null,
    isPinned: false,
    mentions: replyToUsername ? [replyToUsername] : [],
    reactions: [],
    createdAt: new Date().toISOString(),
  };
}

// ── DB'den istatistik (5 dakika önbellekli) ────────────────────────
type StatsResult = { total: number; minSalary: number; maxSalary: number; cities: string[]; ok: boolean };
let cachedStats: StatsResult | null = null;
let statsCachedAt = 0;
const STATS_TTL_MS = 5 * 60_000;

async function getStats(): Promise<StatsResult> {
  if (cachedStats && Date.now() - statsCachedAt < STATS_TTL_MS) return cachedStats;
  try {
    const activeRows = await db
      .select({ city: listingsTable.city, salary: listingsTable.salary })
      .from(listingsTable)
      .where(eq(listingsTable.status, "active"));

    const total = activeRows.length;
    const cities = [...new Set(activeRows.map(r => r.city).filter(Boolean))].slice(0, 5);

    // salary alanı "28.000 - 40.000 TL" gibi metin — sayıları parse et
    const nums: number[] = [];
    for (const row of activeRows) {
      if (row.salary) {
        const matches = row.salary.replace(/\./g, "").match(/\d{4,}/g);
        if (matches) nums.push(...matches.map(Number).filter(n => n >= 10000 && n <= 200000));
      }
    }
    const minSalary = nums.length > 0 ? Math.round(Math.min(...nums) / 1000) * 1000 : 25000;
    const maxSalary = nums.length > 0 ? Math.round(Math.max(...nums) / 1000) * 1000 : 55000;

    cachedStats = { total, minSalary, maxSalary, cities, ok: true };
    statsCachedAt = Date.now();
    return cachedStats;
  } catch {
    // Hata durumunda önceki cache varsa onu kullan, yoksa bilinmiyor işareti
    if (cachedStats) return cachedStats;
    return { total: -1, minSalary: 25000, maxSalary: 50000, cities: [] as string[], ok: false };
  }
}

// ── API key önbelleği (60 saniye) ──────────────────────────────────
let cachedApiKey: string | null = null;
let apiKeyCachedAt = 0;
const API_KEY_TTL_MS = 60_000;

async function getOpenAiKey(): Promise<string | null> {
  if (cachedApiKey !== null && Date.now() - apiKeyCachedAt < API_KEY_TTL_MS) {
    return cachedApiKey;
  }
  try {
    const rows = await db.select({ k: adminSettingsTable.openaiApiKey }).from(adminSettingsTable).limit(1);
    cachedApiKey = rows[0]?.k ?? null;
    apiKeyCachedAt = Date.now();
    return cachedApiKey;
  } catch {
    return null;
  }
}

// ── OpenAI API çağrısı ─────────────────────────────────────────────
async function callOpenAI(apiKey: string, userMsg: string, username: string, stats: Awaited<ReturnType<typeof getStats>>): Promise<string | null> {
  const cityStr = stats.cities.length > 0 ? stats.cities.join(", ") : "İstanbul, Ankara, İzmir";
  const listingInfo = stats.total > 0
    ? `Şu an ${stats.total} aktif iş ilanı var. Maaş aralığı: ${stats.minSalary.toLocaleString("tr-TR")}–${stats.maxSalary.toLocaleString("tr-TR")} TL. Aktif şehirler: ${cityStr}.`
    : stats.total === 0
      ? "Şu an aktif ilan bulunmuyor, yakında yenileri eklenecek."
      : "İlan sayısı şu an alınamadı; kullanıcılara /ilanlar sayfasını ziyaret etmelerini öner.";

  const systemPrompt = `Sen ÖzelGüvenlik.Online platformunun yapay zeka destekli sohbet botu GuvenlikBot'sun. Bu platform Türkiye'deki özel güvenlik sektörüne özel iş ilanları ve topluluk platformudur.

PLATFORM BİLGİSİ:
- ${listingInfo}
- Kullanıcılar /ilanlar sayfasından iş ilanlarını filtreleyebilir (şehir, maaş, pozisyon).
- /cv-olustur sayfasından profesyonel CV oluşturabilirler.
- /profil sayfasından hesaplarını yönetebilirler.

UZMANLIK ALANLARIN:
- 5188 Sayılı Özel Güvenlik Kanunu ve yetkileri
- İş Kanunu (fazla mesai, kıdem, ihbar, izin hakları)
- SGK primleri, emeklilik, işsizlik ödeneği
- Özel güvenlik sertifikaları (temel eğitim, silahlı, amirlik, ilk yardım)
- Kariyer gelişimi (güvenlik görevlisi → ekip lideri → amir → müdür)
- Maaş bilgileri ve pazarlık taktikleri
- AVM, fabrika, hastane, banka, VIP koruma sektörleri

SELAMLAMA KURALLARI (ÇOK ÖNEMLİ):
- "sa", "s.a", "s/a", "selamun aleyküm" → "Ve aleyküm selam @kullanici! ..." ile başla
- "merhaba", "selam", "hey", "naber", "nasılsın" → samimi karşılama yap
- "günaydın" → "Günaydın @kullanici! ..."
- "iyi akşamlar", "iyi geceler" → uygun karşılık ver

YANIT KURALLARI:
1. Her zaman @${username} ile başla (ör: "@${username} Merhaba!")
2. Maksimum 2-3 kısa cümle — sohbet ortamındasın, makale yazmıyorsun
3. Türkçe yaz, samimi ve yardımcı ol
4. Konuya göre platforma yönlendir (/ilanlar, /cv-olustur vb.)
5. Bilmediğin şeyleri uydurmaa, "BİLGİ BOTU'ndan detaylı bilgi alabilirsin" de
6. Emoji kullanabilirsin ama abartma`;

  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 200,
        temperature: 0.75,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMsg },
        ],
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!resp.ok) return null;
    const data = await resp.json() as { choices?: Array<{ message?: { content?: string } }> };
    const text = data.choices?.[0]?.message?.content?.trim();
    return text ?? null;
  } catch {
    return null;
  }
}

// ── Anahtar kelime fallback ────────────────────────────────────────
type Stats = Awaited<ReturnType<typeof getStats>>;

const KEYWORD_RULES: Array<{
  keywords: RegExp;
  getReplies: (s: Stats, username: string) => string[];
}> = [
  {
    keywords: /^(sa|s\.a\.?|s\/a|selamun aleyküm|selamün aleyküm)/i,
    getReplies: (_, u) => [
      `@${u} Ve aleyküm selam! ÖzelGüvenlik.Online'a hoş geldiniz. Size nasıl yardımcı olabilirim?`,
    ],
  },
  {
    keywords: /merhaba|selam|günaydın|iyi akşam|iyi geceler|hey|naber/i,
    getReplies: (_, u) => [
      `@${u} Merhaba! Güvenlik sektöründe iş, maaş, sertifika veya yasal haklar konusunda yardımcı olabilirim.`,
      `@${u} Hoş geldiniz! İş ilanları, mevzuat veya kariyer konularında her türlü sorunuzu yanıtlayabilirim.`,
    ],
  },
  {
    keywords: /maaş|ücret|ne kadar|kaç tl|kaç para|kazan/i,
    getReplies: (s, u) => [
      `@${u} Platformumuzdaki ilanların maaş aralığı genellikle ${s.minSalary.toLocaleString("tr-TR")}–${s.maxSalary.toLocaleString("tr-TR")} TL. Silahlı ve deneyimli pozisyonlarda çok daha yüksek olabiliyor.`,
      `@${u} Maaşlar pozisyona ve şirkete göre büyük fark gösteriyor. Güncel rakamlar için /ilanlar sayfasını filtreli inceleyin.`,
    ],
  },
  {
    keywords: /sertifika|lisans|belge|kurs|eğitim|kart/i,
    getReplies: (_, u) => [
      `@${u} Temel güvenlik eğitimi (120 saat, MEB onaylı) zorunlu. Sonrasında ilk yardım ve silahlı güvenlik belgeleri kariyer için büyük fark yaratıyor.`,
      `@${u} Özel güvenlik kimlik kartı 5 yılda bir yenileniyor. Süresi dolmuş kartla çalışmak yasal ihlal sayılır.`,
    ],
  },
  {
    keywords: /ilan|iş bul|pozisyon|açık|başvur|iş aran/i,
    getReplies: (s, u) => [
      s.total > 0
        ? `@${u} Şu an ${s.total} aktif ilan var. /ilanlar sayfasında şehir, pozisyon ve maaşa göre filtreleyebilirsiniz.`
        : `@${u} İlanlar sayfamızı düzenli takip edin, yeni pozisyonlar sürekli ekleniyor.`,
    ],
  },
  {
    keywords: /sgk|sigorta|prim/i,
    getReplies: (_, u) => [
      `@${u} e-Devlet'ten "Sigortalılık Hizmet Dökümü"ne girerek primlerinizin düzgün yatıp yatmadığını kontrol edin. Eksikse işverene yazılı bildirim yapın.`,
    ],
  },
  {
    keywords: /kıdem|tazminat|ihbar/i,
    getReplies: (_, u) => [
      `@${u} Kıdem tazminatı için en az 1 yıl çalışmış olmanız gerekiyor. Son brüt ücret üzerinden her yıl için 30 günlük ödeme yapılır.`,
    ],
  },
  {
    keywords: /silahlı|tabanca|silah ruhsat/i,
    getReplies: (_, u) => [
      `@${u} Silahlı güvenlik için valilik onayı, psiko-teknik değerlendirme ve ateşli silah yetkinlik belgesi şart. Maaş avantajı önemli bir fark yaratıyor.`,
    ],
  },
  {
    keywords: /fazla mesai|haftalık 45|mesai ücret/i,
    getReplies: (_, u) => [
      `@${u} Haftalık 45 saati aşan her saat %50 zamlı ödenmek zorunda. Yıllık 270 saat sınırı var, aşımı için onayınız şart.`,
    ],
  },
  {
    keywords: /nasıl başla|nasıl giri|yeni başl|sektöre gir/i,
    getReplies: (_, u) => [
      `@${u} Önce temel özel güvenlik eğitimi sertifikası alın, ardından sabıka kaydı ve sağlık raporuyla başvurabilirsiniz. Deneyimsiz adayları kabul eden ilanlar da mevcut.`,
    ],
  },
  {
    keywords: /teşekkür|sağ ol|eyvallah/i,
    getReplies: (_, u) => [
      `@${u} Rica ederim! Başka sorularınız olursa buradayım.`,
      `@${u} Ne demek, başarılar dilerim!`,
    ],
  },
  {
    keywords: /mobbing|baskı|haksız|istismar/i,
    getReplies: (_, u) => [
      `@${u} Psikolojik baskı yasal olarak suç. ALO 170 (Çalışma Bakanlığı) hattını arayarak şikayette bulunabilirsiniz.`,
    ],
  },
  {
    keywords: /tatil|bayram|resmi tatil/i,
    getReplies: (_, u) => [
      `@${u} Resmi tatillerde çalıştırılan işçiye o gün için ayrıca günlük ücret ödenmek zorunda. Bu tutar normal ücrete ek olarak ödenir.`,
    ],
  },
];

const lastBotReplyAt = new Map<string, number>();
const BOT_REPLY_COOLDOWN_MS = 8_000;

function keywordFallback(content: string, username: string, stats: Stats): string | null {
  const matched = KEYWORD_RULES.find(rule => rule.keywords.test(content));
  if (!matched) return null;
  const replies = matched.getReplies(stats, username);
  return replies[Math.floor(Math.random() * replies.length)]!;
}

// Mesajın bot cevabı gerektirip gerektirmediğini belirle
function shouldReply(content: string, role: string): boolean {
  const trimmed = content.trim().toLowerCase();
  // Bot kendi mesajlarına cevap vermesin
  if (role === "bot") return false;
  // Çok kısa mesajlar (3 karakterden az) genelde anlamsız
  if (trimmed.length < 3) return false;
  // @GuvenlikBot veya soru işareti varsa her zaman cevap ver
  if (/guvenlikbot|güvenlikbot|@bot/i.test(trimmed)) return true;
  if (trimmed.includes("?")) return true;
  // Anahtar kelime eşleşmesi varsa her zaman cevap ver
  if (KEYWORD_RULES.some(rule => rule.keywords.test(content))) return true;
  // Yoksa %40 ihtimalle cevap ver (çok gürültülü olmasın)
  return Math.random() < 0.40;
}

function genericFallback(username: string, stats: Stats): string {
  const opts = [
    `@${username} Maaş, sertifika, yasal haklar veya iş ilanları hakkında sorularınızı yanıtlayabilirim. Ne öğrenmek istersiniz?`,
    `@${username} 5188 sayılı kanun, fazla mesai hakları, SGK primleri veya kariyer konularında yardımcı olabilirim.`,
    `@${username} Güvenlik sektöründe ${stats.total > 0 ? `${stats.total} aktif ilan` : "güncel ilanlar"} mevcut. Soru sormaktan çekinmeyin!`,
  ];
  return opts[Math.floor(Math.random() * opts.length)]!;
}

export function triggerContextualReply(content: string, username: string, role: string): void {
  if (!_io) return;
  if (!shouldReply(content, role)) return;

  const now = Date.now();
  const last = lastBotReplyAt.get(username) ?? 0;
  if (now - last < BOT_REPLY_COOLDOWN_MS) return;

  lastBotReplyAt.set(username, now);

  const trimmed = content.trim();
  const delay = 2000 + Math.random() * 4000;

  setTimeout(async () => {
    if (!_io) return;
    const stats = await getStats();
    const apiKey = await getOpenAiKey();

    let reply: string | null = null;

    if (apiKey) {
      reply = await callOpenAI(apiKey, trimmed, username, stats);
    }

    // OpenAI yoksa veya başarısız olduysa anahtar kelime fallback
    if (!reply) {
      reply = keywordFallback(trimmed, username, stats);
    }

    // Hiçbiri tutmadıysa genel bir yardımcı cevap ver (botu susturma)
    if (!reply) {
      reply = genericFallback(username, stats);
    }

    _io!.emit("chat:message", makeBotMsg(reply, username));
  }, delay);
}

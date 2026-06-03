import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import app from "./app";
import { logger } from "./lib/logger";
import { onlineSockets } from "./routes/chat";
import { setBotIo } from "./lib/chat-bot";
import { db, usersTable, listingsTable, adminSettingsTable } from "@workspace/db";
import { eq, count, sql } from "drizzle-orm";

const rawPort = process.env["PORT"];
if (!rawPort) throw new Error("PORT environment variable is required but was not provided.");
const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) throw new Error(`Invalid PORT value: "${rawPort}"`);

const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  path: "/ws",
  cors: { origin: "*", methods: ["GET", "POST"] },
});
app.set("io", io);
setBotIo(io);

// ── GuvenlikBot ───────────────────────────────────────────────────
const BOT_USER = {
  id: 0, username: "GuvenlikBot", displayName: "GuvenlikBot",
  userRole: "bot", userAvatarUrl: null,
  userNameColor: "#06B6D4", userNameAnimated: false, isBot: true,
};

function makeBotMsg(content: string, replyToUsername?: string | null) {
  return {
    ...BOT_USER,
    id: Date.now() + Math.random(),
    content,
    replyToId: null,
    replyToUsername: replyToUsername ?? null,
    replyToContent: null,
    isPinned: false,
    mentions: [],
    reactions: [],
    createdAt: new Date().toISOString(),
  };
}

// ── Dinamik ilan verisi ───────────────────────────────────────────
async function getListingStats(): Promise<{ total: number; cities: string[]; minSalary: number; maxSalary: number }> {
  try {
    const [{ total }] = await db.select({ total: count() }).from(listingsTable).where(eq(listingsTable.isActive, true));
    const cityRows = await db.selectDistinct({ city: listingsTable.city }).from(listingsTable).where(eq(listingsTable.isActive, true)).limit(8);
    const salaryRows = await db.select({
      minSalary: sql<number>`min(${listingsTable.salaryMin})`,
      maxSalary: sql<number>`max(${listingsTable.salaryMax})`,
    }).from(listingsTable).where(eq(listingsTable.isActive, true));
    return {
      total: Number(total),
      cities: cityRows.map(r => r.city).filter(Boolean) as string[],
      minSalary: Math.round((salaryRows[0]?.minSalary ?? 25000) / 1000) * 1000,
      maxSalary: Math.round((salaryRows[0]?.maxSalary ?? 55000) / 1000) * 1000,
    };
  } catch {
    return { total: 0, cities: ["İstanbul", "Ankara", "İzmir"], minSalary: 25000, maxSalary: 50000 };
  }
}

// ── Saat başı hatırlatma mesajları ────────────────────────────────
const HOURLY_TEMPLATES: Array<(h: string) => string> = [
  h => `Saat ${h}:00 oldu! Yeni iş ilanlarını kaçırmamak için ilanlar sayfasını kontrol edin.`,
  h => `${h}:00 — Güvenlik sektöründe yeni fırsatlar sizi bekliyor. İlanları incelediniz mi?`,
  h => `Saat ${h}:00. İyi çalışmalar! Bugün yayınlanan ilanları görüntülemek için İlanlar bölümüne göz atın.`,
  h => `🕐 ${h}:00 oldu. Güncel maaş ve pozisyonlar için ilanlarımızı takip edin.`,
  h => `Saat ${h}:00 — Kariyer hedefinize bir adım daha yaklaşın. Yeni ilanlar eklendi!`,
  h => `${h}:00 çaldı. Özel güvenlik sektöründe binlerce pozisyon sizi bekliyor.`,
  h => `Saat ${h}:00. Silahlı, silahsız, AVM, site güvenliği — tüm ilanlar platformumuzda!`,
  h => `${h}:00 oldu! Başvurmadığınız ilanlar kalmasın, fırsatları kaçırmayın.`,
];
const usedHourlyIdx = new Set<number>();
function getHourlyMsg(hour: number): string {
  if (usedHourlyIdx.size >= HOURLY_TEMPLATES.length) usedHourlyIdx.clear();
  let idx: number;
  do { idx = Math.floor(Math.random() * HOURLY_TEMPLATES.length); } while (usedHourlyIdx.has(idx));
  usedHourlyIdx.add(idx);
  const pad = hour.toString().padStart(2, "0");
  return HOURLY_TEMPLATES[idx]!(pad);
}

// Türkiye saati (UTC+3)
function turkeyHour(): number {
  return parseInt(
    new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", hour: "numeric", hour12: false }).format(new Date()),
    10
  );
}

function scheduleHourlyReminder() {
  const now = new Date();
  // Bir sonraki tam saati UTC+3'e göre hesapla
  const trOffset = 3 * 60 * 60 * 1000;
  const trNow = new Date(now.getTime() + trOffset);
  const msUntilNextHour = (60 - trNow.getUTCMinutes()) * 60 * 1000 - trNow.getUTCSeconds() * 1000 - trNow.getUTCMilliseconds();
  setTimeout(() => {
    io.emit("chat:message", makeBotMsg(getHourlyMsg(turkeyHour())));
    setInterval(() => {
      io.emit("chat:message", makeBotMsg(getHourlyMsg(turkeyHour())));
    }, 60 * 60 * 1000);
  }, msUntilNextHour);
}

// ── GuvenlikBot döngüsel mesajlar ─────────────────────────────────
const BOT_MSG_POOL = [
  "Güvenlik sektöründe kariyer yapmak isteyenler için yüzlerce ilan mevcut!",
  "Topluluk kurallarına uymayı unutmayın — saygılı bir ortam herkese faydalı olur.",
  "Herhangi bir sorun yaşıyorsanız Destek menüsünden bize ulaşabilirsiniz.",
  "Özel güvenlik sertifikası almak isteyenler için eğitim ilanlarımıza göz atın!",
  "İstanbul, Ankara, İzmir ve daha birçok şehirde güncel ilanlar ekleniyor.",
  "Profil sayfanızı tamamlayarak işverenlerin sizi daha kolay bulmasını sağlayın.",
  "Yeni üyelerimize hoş geldiniz! Soru ve sorunlarınız için Destek menüsünü kullanın.",
  "Güvenlik sektöründe gece vardiyası zammı yasal olarak yüzde 25'tir — haklarınızı bilin.",
  "AVM, fabrika, site ve okul güvenliği için ayrı ayrı ilanlar platformumuzda.",
  "Deneyimli güvenlik personeline büyük talep var — başvurularınızı güncel tutun.",
  "SGK prim ödeyen şirketleri tercih edin, haklarınızdan vazgeçmeyin.",
  "Silahlı güvenlik lisansı için gerekli belgeler ilanlar bölümünde açıklanmıştır.",
];
const usedBotMsgIdx = new Set<number>();
function getNextBotMsg(): string {
  if (usedBotMsgIdx.size >= BOT_MSG_POOL.length) usedBotMsgIdx.clear();
  let idx: number;
  do { idx = Math.floor(Math.random() * BOT_MSG_POOL.length); } while (usedBotMsgIdx.has(idx));
  usedBotMsgIdx.add(idx);
  return BOT_MSG_POOL[idx]!;
}
async function getDynamicBotMsg(): Promise<string> {
  const stats = await getListingStats();
  if (stats.total > 0 && Math.random() < 0.35) {
    const cityStr = stats.cities.slice(0, 3).join(", ");
    const dynamic = [
      `Şu an platformumuzda ${stats.total} aktif ilan bulunuyor. ${cityStr} başta olmak üzere birçok şehirde pozisyon var!`,
      `Güncel maaş aralıkları: ${stats.minSalary.toLocaleString("tr-TR")} - ${stats.maxSalary.toLocaleString("tr-TR")} TL. ${stats.total} ilanı inceleyin.`,
      `Bugün itibarıyla ${stats.total} açık pozisyon mevcut. ${cityStr} ve çevresinde fırsatlar sizi bekliyor!`,
    ];
    return dynamic[Math.floor(Math.random() * dynamic.length)]!;
  }
  return getNextBotMsg();
}

function scheduleBotMessage() {
  const delay = 5 * 60 * 1000 + Math.random() * 8 * 60 * 1000;
  setTimeout(async () => {
    const msg = await getDynamicBotMsg();
    io.emit("chat:message", makeBotMsg(msg));
    scheduleBotMessage();
  }, delay);
}

// ── Sahte kullanıcılar ────────────────────────────────────────────
const FAKE_USERS = [
  { id: -1,  username: "mehmet_k",    displayName: "Mehmet",   color: "#94a3b8", avatar: "https://randomuser.me/api/portraits/men/32.jpg" },
  { id: -2,  username: "ayse_g",      displayName: "Ayşe",     color: "#a78bfa", avatar: "https://randomuser.me/api/portraits/women/44.jpg" },
  { id: -3,  username: "ali_demir",   displayName: "Ali",      color: "#94a3b8", avatar: "https://randomuser.me/api/portraits/men/45.jpg" },
  { id: -4,  username: "fatma_y",     displayName: "Fatma",    color: "#f9a8d4", avatar: "https://randomuser.me/api/portraits/women/68.jpg" },
  { id: -5,  username: "hasan_b",     displayName: "Hasan",    color: "#94a3b8", avatar: "https://randomuser.me/api/portraits/men/52.jpg" },
  { id: -6,  username: "zeynep_a",    displayName: "Zeynep",   color: "#67e8f9", avatar: "https://randomuser.me/api/portraits/women/12.jpg" },
  { id: -7,  username: "ibrahim_s",   displayName: "İbrahim",  color: "#94a3b8", avatar: "https://randomuser.me/api/portraits/men/76.jpg" },
  { id: -8,  username: "selin_c",     displayName: "Selin",    color: "#86efac", avatar: "https://randomuser.me/api/portraits/women/33.jpg" },
  { id: -9,  username: "murat_d",     displayName: "Murat",    color: "#fbbf24", avatar: "https://randomuser.me/api/portraits/men/19.jpg" },
  { id: -10, username: "gulsum_k",    displayName: "Gülsüm",   color: "#f472b6", avatar: "https://randomuser.me/api/portraits/women/57.jpg" },
  { id: -11, username: "taner_y",     displayName: "Taner",    color: "#94a3b8", avatar: "https://randomuser.me/api/portraits/men/85.jpg" },
  { id: -12, username: "hacer_o",     displayName: "Hacer",    color: "#a3e635", avatar: "https://randomuser.me/api/portraits/women/90.jpg" },
  { id: -13, username: "kemal_p",     displayName: "Kemal",    color: "#fb923c", avatar: "https://randomuser.me/api/portraits/men/42.jpg" },
  { id: -14, username: "nese_b",      displayName: "Neşe",     color: "#e879f9", avatar: "https://randomuser.me/api/portraits/women/22.jpg" },
  { id: -15, username: "cengiz_t",    displayName: "Cengiz",   color: "#94a3b8", avatar: "https://randomuser.me/api/portraits/men/60.jpg" },
  { id: -16, username: "rukiye_s",    displayName: "Rukiye",   color: "#34d399", avatar: "https://randomuser.me/api/portraits/women/78.jpg" },
  { id: -17, username: "burak_a",     displayName: "Burak",    color: "#60a5fa", avatar: "https://randomuser.me/api/portraits/men/11.jpg" },
  { id: -18, username: "derya_m",     displayName: "Derya",    color: "#f0abfc", avatar: "https://randomuser.me/api/portraits/women/25.jpg" },
  { id: -19, username: "serkan_o",    displayName: "Serkan",   color: "#94a3b8", avatar: "https://randomuser.me/api/portraits/men/36.jpg" },
  { id: -20, username: "emine_k",     displayName: "Emine",    color: "#fda4af", avatar: "https://randomuser.me/api/portraits/women/51.jpg" },
  { id: -21, username: "osman_c",     displayName: "Osman",    color: "#94a3b8", avatar: "https://randomuser.me/api/portraits/men/62.jpg" },
  { id: -22, username: "hatice_b",    displayName: "Hatice",   color: "#d8b4fe", avatar: "https://randomuser.me/api/portraits/women/63.jpg" },
  { id: -23, username: "yusuf_d",     displayName: "Yusuf",    color: "#94a3b8", avatar: "https://randomuser.me/api/portraits/men/71.jpg" },
  { id: -24, username: "merve_s",     displayName: "Merve",    color: "#6ee7b7", avatar: "https://randomuser.me/api/portraits/women/36.jpg" },
  { id: -25, username: "kadir_y",     displayName: "Kadir",    color: "#fdba74", avatar: "https://randomuser.me/api/portraits/men/88.jpg" },
  { id: -26, username: "sibel_t",     displayName: "Sibel",    color: "#93c5fd", avatar: "https://randomuser.me/api/portraits/women/82.jpg" },
  { id: -27, username: "volkan_k",    displayName: "Volkan",   color: "#94a3b8", avatar: "https://randomuser.me/api/portraits/men/17.jpg" },
  { id: -28, username: "gulcan_d",    displayName: "Gülcan",   color: "#fca5a5", avatar: "https://randomuser.me/api/portraits/women/9.jpg" },
  { id: -29, username: "erhan_m",     displayName: "Erhan",    color: "#94a3b8", avatar: "https://randomuser.me/api/portraits/men/55.jpg" },
  { id: -30, username: "ozlem_b",     displayName: "Özlem",    color: "#a5b4fc", avatar: "https://randomuser.me/api/portraits/women/40.jpg" },
  { id: -31, username: "cem_a",       displayName: "Cem",      color: "#94a3b8", avatar: "https://randomuser.me/api/portraits/men/28.jpg" },
  { id: -32, username: "hulya_g",     displayName: "Hülya",    color: "#f9a8d4", avatar: "https://randomuser.me/api/portraits/women/66.jpg" },
];

const STANDALONE_MSGS = [
  // İş fırsatları ve ilanlar
  "Bugün yeni bir ilan gördüm, oldukça iyi görünüyor.",
  "İstanbul dışı ilanlar da artık daha fazla, umut verici.",
  "Şirketler yaz döneminde daha fazla personel alıyor genellikle.",
  "AVM güvenliği mi yoksa site güvenliği mi daha avantajlı acaba?",
  "Belediye güvenliği ilanları da son dönemde artmış.",
  "Havaalanı güvenliği için özel sertifika gerekiyor, biliyor musunuz?",
  "Sağlık kurumu güvenliği çok stresli ama maaşlar gerçekten iyi.",
  "Mağaza güvenliği ile banka güvenliği arasında çok fark var.",
  "Yaz aylarında tatil köyü güvenliği için ilanlar artıyor.",
  "Fabrika ve lojistik güvenliği ilanları artmış, taşeron firmalar çok aktif.",
  "Organize sanayi bölgelerinde iş imkânları genişlemiş gibi görünüyor.",
  "Otel güvenliği yazın zirveye ulaşıyor, sezonluk işler de var.",
  "Liman güvenliği için ayrı lisans gerekiyor, araştırıyorum.",
  "Konut site güvenliği sakin ama saatler çok uzun oluyor.",
  // Maaş ve yasal haklar
  "Bu sektörde tecrübe çok önemli, en az 2 yıl şart gibi görünüyor.",
  "Maaşlar geçen yıla göre biraz arttı, güzel.",
  "Gece vardiyası zam farkı hangi şirkette en yüksek acaba?",
  "Tatil günleri yüzde elliden fazla zam hakkınız olduğunu unutmayın.",
  "Sigortasız çalıştıranlardan uzak durun, hakkınızı koruyun.",
  "İşe başlamadan önce mutlaka sözleşmeyi okuyun.",
  "Kıdem tazminatı için en az bir yıl çalışmak şart, baştan bilin.",
  "Fazla mesai ücretlerini düzenli takip edin, bazı firmalar eksik ödüyor.",
  "Yemek ve servis yardımı yapan firmalar ciddi bir avantaj sağlıyor.",
  "SGK primlerinizi e-Devlet'ten kontrol etmeyi alışkanlık haline getirin.",
  "İzin günlerinde çalıştırılıyorsanız ayrıca yevmiye hakkınız var.",
  // Sertifika ve eğitim
  "Silahlı güvenlik lisansı almak istiyorum, nasıl yapılıyor acaba?",
  "Sertifika kurslarının ücreti biraz yüksek bence.",
  "Güvenlik kamerası sistemleri konusunda eğitim alan önde gidiyor.",
  "Emekli olduktan sonra da bu sektörde çalışabilirsiniz, talep var.",
  "Sivil kıyafetli gözetleme görevi için ayrı eğitim gerekiyor.",
  "İlk yardım sertifikası artık çoğu firmada isteniyor, almak faydalı.",
  "İngilizce bilen güvenlik personeli otellerde büyük avantaj sağlıyor.",
  "Yangın söndürme eğitimi almak hem kariyer hem güvenlik açısından önemli.",
  "Özel güvenlik kimliği 5 yılda bir yenileniyor, takip etmek gerekiyor.",
  "Askeri deneyim özellikle silahlı pozisyonlarda çok işe yarıyor.",
  // Platform ve başvurular
  "Bu platforma yeni üye oldum, ilanlar gerçekten çok kapsamlı.",
  "İlanlara başvururken CV'nizi güncel tutun.",
  "Hangi şehirlerde talep daha fazla, bilen var mı?",
  "Profilinizi tamamlayın, işverenler dolu profil adaylarını tercih ediyor.",
  "Birden fazla şehirde iş arayabilirsiniz, mobil olmak büyük avantaj.",
  // Çalışma koşulları
  "Vardiyalı çalışmak zor ama zamanla alışılıyor.",
  "Kıyafet yardımı yapan şirketler mutlaka tercih edilmeli.",
  "İkinci el koruyucu ekipman mı yoksa yeni mi almak daha iyi?",
  "12 saatlik vardiyada ayakta durmak çok yorucu, doğru ayakkabı şart.",
  "Müşteri ile iletişim kuvvetli olmak sizi diğerlerinden ayırıyor.",
  "Gece vardiyasında dikkatli olmak için molayı iyi kullanmak şart.",
  // Teknoloji ve yenilikler
  "Yapay zeka kameralar artık güvenlik sektörüne giriyor, işler değişiyor.",
  "Biyometrik giriş sistemleri için ek eğitim veren firmalar avantajlı.",
  "Akıllı bina sistemlerini bilen personele talep giderek artıyor.",
  "Drone güvenliği gibi yeni alanlar açılıyor, ek sertifika fırsatı var.",
  // Sektör gözlemleri
  "Bu meslek psikolojik olarak zorlayıcı, destek almayı ihmal etmeyin.",
  "Tecrübeli güvenlik görevlileri artık danışmanlık hizmeti de veriyor.",
  "Hangi firmalar en düzenli maaş ödüyor, deneyimi olan söylesin.",
  "Çalıştığım yerde yöneticimiz çok anlayışlı, böyle ortam nadiren bulunuyor.",
  "Sendikalı güvenlik şirketi bulmak giderek zorlaşıyor maalesef.",
  "Kariyer planı yapmak bu sektörde de kritik, plansız ilerlemek zor.",
];

// Dinamik konuşma çiftleri - DB verisiyle güncellenebilir
type ConvPair = { a: string; bTemplate: (stats: { total: number; cities: string[]; minSalary: number; maxSalary: number }) => string; delay: number };

const CONV_PAIRS: ConvPair[] = [
  {
    a: "Bu ay kaç ilan çıktı acaba?",
    bTemplate: s => s.total > 0 ? `Şu an ${s.total} aktif ilan var. ${s.cities.slice(0, 2).join(" ve ")} başta olmak üzere her yerden.` : "Epey fazla, özellikle İstanbul ilanları artmış.",
    delay: 25000,
  },
  {
    a: "Silahlı güvenlik maaşları ne kadar?",
    bTemplate: s => s.maxSalary > 0 ? `Genellikle ${s.minSalary.toLocaleString("tr-TR")} - ${s.maxSalary.toLocaleString("tr-TR")} TL arasında, şirkete göre değişiyor.` : "Genellikle 28-45 bin TL arasında, şirkete göre değişiyor.",
    delay: 30000,
  },
  {
    a: "AVM güvenliği deneyimli mi arıyor?",
    bTemplate: () => "Çoğu yer 1 yıl tecrübe istiyor, bazıları deneyimsiz de alıyor. İlanlara bakman lazım.",
    delay: 20000,
  },
  {
    a: "Sertifika almak için kurs kaç para?",
    bTemplate: () => "MEB onaylı kurslar 4-7 bin TL civarı, fiyatlar sürekli değişiyor.",
    delay: 28000,
  },
  {
    a: "Gece vardiyası zammı ne kadar oluyor?",
    bTemplate: () => "Yasal olarak yüzde 25 zam hakkınız var, bazı firmalar yüzde 35-40 da veriyor.",
    delay: 22000,
  },
  {
    a: "İstanbul'da hangi ilçelerde ilan var?",
    bTemplate: () => "Kadıköy, Şişli, Ataşehir çok ilan var. Anadolu yakası da son dönemde iyice arttı.",
    delay: 18000,
  },
  {
    a: "Yeni başlayanlar için hangi pozisyon uygun?",
    bTemplate: () => "Site güvenliği veya iş merkezi güvenliği daha uygun başlangıç. Gece vardiyası daha kolay bulunuyor.",
    delay: 26000,
  },
  {
    a: "Emekli maaşı alırken çalışabilir miyim?",
    bTemplate: () => "Evet, SGDP kesintisi olur ama çalışabilirsiniz. Bazı şirketler buna göre kontratsız alıyor.",
    delay: 32000,
  },
  {
    a: "Hangi belgeler lazım başvuru için?",
    bTemplate: () => "Genellikle nüfus cüzdanı, sabıka kaydı, sağlık raporu ve özel güvenlik kimliği yeterli.",
    delay: 24000,
  },
  {
    a: "İzmir'de iş ilanı var mı?",
    bTemplate: s => s.cities.includes("İzmir") ? "Evet, İzmir ilanları son dönemde arttı. Platforma baksan iyi olur." : "İzmir ilanları da var ama İstanbul kadar yoğun değil.",
    delay: 20000,
  },
  {
    a: "Yabancı uyruklu çalışabilir mi bu sektörde?",
    bTemplate: () => "Hayır, Türk vatandaşlığı şart. Bazı firma ilanlarında açıkça yazıyor.",
    delay: 27000,
  },
  {
    a: "Okul güvenliği maaşları düşük mü?",
    bTemplate: () => "Diğer pozisyonlara göre biraz düşük kalabiliyor ama çalışma saatleri düzenli. Yazın tatil oluyor.",
    delay: 23000,
  },
  {
    a: "Kaç yıl deneyim gerekiyor genelde?",
    bTemplate: () => "Çoğu ilan 1-3 yıl istiyor. Deneyimsiz başvurabilirsiniz ama alınma şansı azalıyor.",
    delay: 19000,
  },
  {
    a: "Sigortalı pozisyon bulmak zor mu?",
    bTemplate: () => "Bu platformdaki ilanların büyük çoğunluğu SGK'lı. Sigortsuz ilanlardan kaçının.",
    delay: 21000,
  },
  {
    a: "En çok hangi şehirde ilan var?",
    bTemplate: s => s.cities.length > 0 ? `${s.cities[0]} en fazla ilana sahip şehir şu an.` : "İstanbul açık ara önde, ardından Ankara ve İzmir geliyor.",
    delay: 25000,
  },
  {
    a: "Drone güvenliği için ek eğitim şart mı?",
    bTemplate: () => "Yeni düzenlemelerle birlikte özel sertifika gerekiyor. Henüz çok az kişi var bu alanda, erken girenler avantajlı.",
    delay: 22000,
  },
  {
    a: "En güvenilir güvenlik şirketleri hangileri?",
    bTemplate: () => "SGK'yı düzenli ödeyen, kıyafet ve servis veren firmalar genelde öne çıkıyor. İlan yorumlarına bak.",
    delay: 28000,
  },
  {
    a: "Gece çalışmak sağlığı etkiliyor mu?",
    bTemplate: () => "Uzun vadede uyku düzenini bozuyor. D vitamini eksikliği çok yaygın, düzenli kontrol şart.",
    delay: 25000,
  },
  {
    a: "Otel güvenliğinde İngilizce şart mı?",
    bTemplate: () => "4-5 yıldızlı otellerde büyük artı. Temel düzeyde bile olsa fark yaratıyor. Online kurs almaya değer.",
    delay: 20000,
  },
  {
    a: "Kıdem tazminatı nasıl hesaplanıyor?",
    bTemplate: () => "Son brüt ücretin tavan sınırına kadar her yıl için 30 günlük tutar. SGK'dan belge alarak takip edin.",
    delay: 30000,
  },
  {
    a: "Site güvenliğinde iş sakin mi oluyor?",
    bTemplate: () => "Büyük konut sitelerinde yoğun olabiliyor. Küçük sitelerde daha sakin ama sosyal imkânlar az.",
    delay: 18000,
  },
  {
    a: "Askeri tecrübe avantaj sağlıyor mu?",
    bTemplate: () => "Kesinlikle. Özellikle silahlı güvenlik pozisyonlarında askerlik tecrübesi adayı öne çıkarıyor.",
    delay: 26000,
  },
  {
    a: "Hangi sertifikayı önce almak lazım?",
    bTemplate: () => "Temel güvenlik eğitimi zorunlu tabi. Sonrasında ilk yardım ve yangın söndürme sertifikaları kariyer hızlandırıyor.",
    delay: 27000,
  },
  {
    a: "Fabrika güvenliği tehlikeli mi?",
    bTemplate: () => "Kimyasal veya makine üretimi yapan yerlerde iş sağlığı önlemleri kritik. Gerekli eğitim alınmazsa ciddi risk var.",
    delay: 23000,
  },
  {
    a: "Bu sektörde kariyer nasıl ilerler?",
    bTemplate: () => "Ekip liderliği, vardiya amirliği, güvenlik amirliği ve yöneticilik. Sertifikalar ve deneyimle adım adım çıkılıyor.",
    delay: 29000,
  },
  {
    a: "Ankara'da güvenlik sektörü nasıl?",
    bTemplate: s => s.cities.includes("Ankara") ? "Ankara'da da iyi ilanlar var, özellikle kamu kurumları çevresi aktif." : "Ankara'da talep var ama İstanbul kadar yoğun değil.",
    delay: 21000,
  },
  {
    a: "Yazın iş ilanları artıyor mu?",
    bTemplate: s => s.total > 0 ? `Şu an ${s.total} ilan var, yaz döneminde turizm ve güvenlik ilanları genellikle yükseliyor.` : "Yaz aylarında turizm ilanları çok artıyor, özellikle kıyı şehirleri.",
    delay: 24000,
  },
  {
    a: "Liman güvenliği için neler gerekiyor?",
    bTemplate: () => "Liman güvenliği sertifikası ve ISPS kodu eğitimi şart. Ayrıca deniz güvenliği lisansı bazı yerlerde isteniyor.",
    delay: 31000,
  },
  {
    a: "İlk başvuruda ne dikkat etmeli?",
    bTemplate: () => "CV'nizi güncel tutun, sabıka kaydı ve sağlık raporunu hazırlayın. Deneyiminizi somut rakamlarla yazın.",
    delay: 22000,
  },
  // Ek soru çiftleri
  {
    a: "Tatil günleri çalışırsak ekstra ücret alıyor muyuz?",
    bTemplate: () => "Evet, ulusal bayram ve resmi tatillerde çalışanlara o gün için ayrıca günlük ücret ödenmesi zorunlu. Haftalık ücretin dışında ek yevmiye hakkınız var.",
    delay: 26000,
  },
  {
    a: "Güvenlik amiri olmak için ne gerekiyor?",
    bTemplate: () => "En az 5 yıl deneyim ve güvenlik amirliği sertifikası şart. Liderlik becerileri ve temiz sicil kaydı da kritik. Bazı firmalar ek yöneticilik eğitimi istiyor.",
    delay: 29000,
  },
  {
    a: "Yurt dışında güvenlik işi var mı?",
    bTemplate: () => "Körfez ülkeleri başta olmak üzere bazı Türk şirketleri yurt dışı güvenlik personeli alıyor. Dil bilmek ve pasaportunuzun açık olması şart. Fırsatlar için özel ajansları takip edin.",
    delay: 31000,
  },
  {
    a: "Sendika üyesi olmak avantajlı mı?",
    bTemplate: () => "Sendikalı işyerlerinde toplu iş sözleşmesi kapsamında daha iyi maaş ve haklar elde edilebiliyor. Ancak sektörde sendikalı şirket bulmak giderek zorlaşıyor maalesef.",
    delay: 27000,
  },
  {
    a: "Fabrika mı yoksa AVM mi daha iyi çalışma ortamı?",
    bTemplate: () => "AVM'lerde müşteri yoğun ama ortam daha kontrollü. Fabrikalarda iş sağlığı riskleri var ama genellikle yemek ve servis imkânı daha iyi. İkisi de kişiye göre değişiyor.",
    delay: 23000,
  },
  {
    a: "Kamera sistemleri eğitimi almak şart mı?",
    bTemplate: () => "Zorunlu değil ama büyük fark yaratıyor. CCTV ve alarm sistemleri konusunda sertifika alanlar hem daha kolay iş buluyor hem de daha yüksek maaş alıyor.",
    delay: 20000,
  },
  {
    a: "Banka güvenliğine nasıl başvurabilirim?",
    bTemplate: () => "Banka güvenliği için silahlı güvenlik lisansı genellikle şart. Bunun yanı sıra temiz sicil kaydı ve psikolojik değerlendirme gerekiyor. Rekabet yüksek ama maaşlar çok iyi.",
    delay: 24000,
  },
  {
    a: "Güvenlik sektöründe stres çok mu oluyor?",
    bTemplate: () => "Pozisyona göre çok değişiyor. Havaalanı veya banka güvenliği gergin olabiliyor. Site veya okul güvenliği görece daha sakin. Psikolojik destek almaktan çekinmeyin.",
    delay: 28000,
  },
  {
    a: "Yazın sezonluk iş bulmak mümkün mü?",
    bTemplate: s => s.total > 0
      ? `Evet, yaz döneminde otel, tatil köyü ve sahil güvenliği ilanları çok artıyor. Şu an ${s.total} ilan var, sezonluk filtresine bak.`
      : "Yaz döneminde turizm bölgelerinde sezonluk güvenlik ilanları çok artıyor. Otel ve tatil köyleri özellikle Mayıs'tan itibaren alım yapıyor.",
    delay: 22000,
  },
  {
    a: "Özel hastane güvenliği çalışmak zor mu?",
    bTemplate: () => "Sağlık tesislerinde gerginlik yaşanabiliyor, özellikle acil servislerde. Ama maaşlar iyi ve çalışma koşulları genellikle düzgün. Sağlık kurumu tecrübesi kariyerinize değer katıyor.",
    delay: 25000,
  },
  {
    a: "Parmak izi sistemi olan yerlerde çalışmak nasıl?",
    bTemplate: () => "Biyometrik giriş kontrol sistemleri artık yaygınlaşıyor. Bu tür sistemleri bilen personel daha değerli. Temel IT bilgisi ile bu sistemleri rahatça öğrenebilirsiniz.",
    delay: 19000,
  },
  {
    a: "Vardiya değişimi sırasında sorun çıkarsa ne yapmalı?",
    bTemplate: () => "Her vardiya devir-teslimini yazılı tutanakla kayıt altına alın. Sorun varsa amirlerinizi bilgilendirin ve işyeri güvenlik defterine düşün. Belgesiz kalmak hukuki açıdan sizi zor durumda bırakır.",
    delay: 30000,
  },
  {
    a: "Çalışırken üniversite okumak mümkün mü?",
    bTemplate: () => "Açıköğretim programları bu sektör için idealdir. Vardiyalı çalışanlar gündüz derslerini ayarlayabiliyor. Güvenlik yönetimi veya hukuk bölümleri kariyer açısından çok işe yarıyor.",
    delay: 26000,
  },
  {
    a: "İşyeri kıyafeti firmadan mı veriliyor?",
    bTemplate: () => "Büyük firmaların büyük çoğunluğu üniforma ve temel ekipmanı temin ediyor. Başvuru öncesinde iş ilanında veya mülakatta bunu netleştirmenizi öneririm.",
    delay: 21000,
  },
  {
    a: "Güvenlik görevlisi olmak için boy sınırı var mı?",
    bTemplate: () => "Yasal olarak belirlenmiş bir boy sınırı yok. Ancak bazı firmalar iç kriterleri olarak 170 cm üzeri tercih edebiliyor. Tüm pozisyonlarda sağlık raporu ve fiziksel uygunluk aranıyor.",
    delay: 23000,
  },
  {
    a: "Bu platformu tavsiye ediyorum, ilanlar gerçekten kapsamlı.",
    bTemplate: () => "Teşekkürler! Güvenlik sektörüne özel ilanları bir arada bulmak gerçekten zaman kazandırıyor. Arkadaşlarınıza da önerin, birlikte daha güçlüyüz.",
    delay: 18000,
  },
];

const usedConvIdx = new Set<number>();
function getNextConvPair(): ConvPair {
  if (usedConvIdx.size >= CONV_PAIRS.length) usedConvIdx.clear();
  let idx: number;
  do { idx = Math.floor(Math.random() * CONV_PAIRS.length); } while (usedConvIdx.has(idx));
  usedConvIdx.add(idx);
  return CONV_PAIRS[idx]!;
}

const usedStandaloneIdx = new Set<number>();
function getNextStandalone(): string {
  if (usedStandaloneIdx.size >= STANDALONE_MSGS.length) usedStandaloneIdx.clear();
  let idx: number;
  do { idx = Math.floor(Math.random() * STANDALONE_MSGS.length); } while (usedStandaloneIdx.has(idx));
  usedStandaloneIdx.add(idx);
  return STANDALONE_MSGS[idx]!;
}

function makeFakeMsg(user: typeof FAKE_USERS[0], content: string, replyToUsername?: string): object {
  const fullContent = replyToUsername ? `@${replyToUsername} ${content}` : content;
  return {
    id: Date.now() + Math.random(),
    content: fullContent,
    userId: user.id,
    username: user.username,
    displayName: user.displayName,
    userAvatarUrl: user.avatar,
    userNameColor: user.color,
    userNameAnimated: false,
    userRole: "user",
    replyToId: null,
    replyToUsername: replyToUsername ?? null,
    replyToContent: null,
    isPinned: false,
    mentions: replyToUsername ? [replyToUsername] : [],
    reactions: [],
    createdAt: new Date().toISOString(),
    isFake: true,
  };
}

function getRandomUser(exclude?: typeof FAKE_USERS[0]): typeof FAKE_USERS[0] {
  let user: typeof FAKE_USERS[0];
  do { user = FAKE_USERS[Math.floor(Math.random() * FAKE_USERS.length)]!; } while (exclude && user.id === exclude.id);
  return user;
}

// Bot kullanıcıya @ ile cevap versin
async function maybeBotReply(question: string, askerUsername: string) {
  // %40 ihtimalle bot da araya girip cevap versin
  if (Math.random() > 0.4) return;
  const stats = await getListingStats();
  const botReplies: Array<(s: typeof stats) => string> = [
    s => `Güncel bilgi: şu an platformumuzda ${s.total} aktif ilan mevcut. İncelemeyi unutmayın!`,
    s => `Maaş aralıkları ${s.minSalary.toLocaleString("tr-TR")} - ${s.maxSalary.toLocaleString("tr-TR")} TL arasında değişiyor.`,
    () => "Daha fazla bilgi için ilanlar sayfamızı ziyaret edebilirsiniz!",
    s => s.cities.length > 0 ? `${s.cities.slice(0, 3).join(", ")} gibi şehirlerde pozisyon açıklamaları var.` : "Birçok şehirde ilanlarımız mevcut.",
  ];
  const replyFn = botReplies[Math.floor(Math.random() * botReplies.length)]!;
  const content = `@${askerUsername} ${replyFn(stats)}`;
  setTimeout(() => {
    io.emit("chat:message", { ...makeBotMsg(content, askerUsername), content });
  }, 8000 + Math.random() * 12000);
}

function scheduleFakeConversation() {
  const delay = 50000 + Math.random() * 110000;
  setTimeout(async () => {
    const roll = Math.random();
    if (roll < 0.35) {
      const user = getRandomUser();
      io.emit("chat:message", makeFakeMsg(user, getNextStandalone()));
    } else {
      const pair = getNextConvPair();
      const stats = await getListingStats();
      const userA = getRandomUser();
      const userB = getRandomUser(userA);

      io.emit("chat:message", makeFakeMsg(userA, pair.a));

      // Bot bazen soruya cevap verir
      await maybeBotReply(pair.a, userA.username);

      setTimeout(() => {
        const answer = pair.bTemplate(stats);
        io.emit("chat:message", makeFakeMsg(userB, answer, userA.username));
      }, pair.delay);
    }
    scheduleFakeConversation();
  }, delay);
}

// ── Hoş geldiniz metni ────────────────────────────────────────────
const WELCOME_RULES = `Hoş geldiniz! Topluluk Kuralları:
1. Saygılı ve nazik olun
2. Spam ve reklam yapmayın
3. Kişisel bilgilerinizi paylaşmayın
4. Hakaret ve küfür kesinlikle yasak
5. İş ilanları için doğru kategoriyi kullanın

İyi sohbetler dileriz!`;

const userLastDisconnect = new Map<number, number>();
const JOIN_THRESHOLD_MS = 20 * 60 * 1000;

// ── Socket.io ─────────────────────────────────────────────────────
io.on("connection", (socket) => {
  const socketId = socket.id;
  onlineSockets.set(socketId, { joinedAt: new Date() });
  logger.info({ socketId, online: onlineSockets.size }, "Socket connected");
  io.emit("online_count", { count: onlineSockets.size });

  socket.on("authenticate", async (data: { userId?: number }) => {
    if (data?.userId) {
      const userId = data.userId;
      const entry = onlineSockets.get(socketId);
      if (entry) { entry.userId = userId; onlineSockets.set(socketId, entry); }

      const alreadyConnected = [...onlineSockets.values()].filter(e => e.userId === userId).length;

      try {
        const [user] = await db.select({ username: usersTable.username, displayName: usersTable.displayName })
          .from(usersTable).where(eq(usersTable.id, userId)).limit(1);
        if (user) {
          if (alreadyConnected <= 1) {
            const lastDisconnect = userLastDisconnect.get(userId);
            const awayLong = !lastDisconnect || (Date.now() - lastDisconnect) >= JOIN_THRESHOLD_MS;
            if (awayLong) {
              io.emit("chat:join", { username: user.displayName || user.username });
            }
          }
          socket.emit("chat:welcome", { message: WELCOME_RULES });
        }
      } catch { /* ignore */ }
    }
  });

  socket.on("disconnect", () => {
    const entry = onlineSockets.get(socketId);
    if (entry?.userId) {
      const remaining = [...onlineSockets.values()].filter(e => e.userId === entry.userId && e !== entry);
      if (remaining.length === 0) {
        userLastDisconnect.set(entry.userId, Date.now());
      }
    }
    onlineSockets.delete(socketId);
    logger.info({ socketId, online: onlineSockets.size }, "Socket disconnected");
    io.emit("online_count", { count: onlineSockets.size });
  });
});

// ── BİLGİLENDİRME BOT ────────────────────────────────────────────
const INFO_BOT = {
  id: -999, username: "BilgilendirmeBot", displayName: "BİLGİLENDİRME BOT",
  userRole: "bot", userAvatarUrl: null,
  userNameColor: "#22C55E", userNameAnimated: false, isBot: true,
};

function makeInfoMsg(content: string) {
  return {
    ...INFO_BOT,
    id: Date.now() + Math.random(),
    content,
    replyToId: null, replyToUsername: null, replyToContent: null,
    isPinned: false, mentions: [], reactions: [],
    createdAt: new Date().toISOString(),
  };
}

const INFO_MESSAGES = [
  "KANUN BİLGİSİ — 5188 Sayılı Kanun Md.1: Bu Kanunun amacı, kamu güvenliğini tamamlayıcı nitelikteki özel güvenlik hizmetlerinin yerine getirilmesine ilişkin esas ve usulleri düzenlemektir.",
  "KANUN BİLGİSİ — 5188 Sayılı Kanun Md.3: Özel güvenlik izni, valiliklerce verilir. İzin alınmadan özel güvenlik hizmeti verilemez ve özel güvenlik şirketi kurulamaz.",
  "KANUN BİLGİSİ — 5188 Sayılı Kanun Md.11: Özel güvenlik görevlileri, bu Kanunda belirtilen yetkilerini gürev alanları ve süreleriyle sınırlı olarak kullanabilir.",
  "KANUN BİLGİSİ — 5188 Sayılı Kanun Md.14: Özel güvenlik görevlileri, Türkiye Cumhuriyeti vatandaşı olmak zorundadır. Yabancı uyruklu kişiler özel güvenlik görevlisi olarak çalışamaz.",
  "KANUN BİLGİSİ — 5188 Sayılı Kanun Md.18: Özel güvenlik görevlileri kaba kuvvet kullanamaz; orantılılık ilkesine uymak zorundadır. Her türlü hak ihlali cezai sorumluluk doğurur.",
  "KANUN BİLGİSİ — 5188 Sayılı Kanun Md.10: Silahlı özel güvenlik görevi yapılabilmesi için valiliğin onayı ve ilgili silah taşıma izninin alınmış olması gerekir.",
  "İSG BİLGİSİ — 6331 Sayılı İş Sağlığı ve Güvenliği Kanunu: İşveren, çalışanların işle ilgili sağlık ve güvenliklerini sağlamakla yükümlüdür. Risk değerlendirmesi yapmak zorundadır.",
  "İSG BİLGİSİ — Güvenlik görevlileri gece vardiyasında çalışıyorsa yasal olarak %25 gece zammı hakkına sahiptir. Bu oran bazı işyeri sözleşmelerinde %35-40'a çıkabilir.",
  "İSG BİLGİSİ — Fazla mesai sınırı: Günlük 11 saati, haftalık 45 saati aşan çalışmalar yasal fazla mesai sayılır ve %50 zamlı ödenmek zorundadır.",
  "İSG BİLGİSİ — İş kazasında ilk 48 saat: İşveren, iş kazasını Sosyal Güvenlik Kurumu'na en geç 3 iş günü içinde bildirmek zorundadır. Bildirmezse idari para cezasına çarptırılır.",
  "İSG BİLGİSİ — Ulusal bayram ve genel tatil günlerinde çalışan güvenlik görevlisine bu süre için ayrıca günlük ücret ödenmesi zorunludur (haftalık ücreti dışında).",
  "SEKTÖR BİLGİSİ — Özel Güvenlik Kimlik Kartı 5 yılda bir yenilenmesi zorunludur. Süresi dolan kart ile görev yapmak hem işçi hem işveren açısından yasal ihlal oluşturur.",
  "SEKTÖR BİLGİSİ — Silahlı güvenlik ruhsatı için: Ateşli silah eğitimi ve yetkinlik belgesi, valilik onayı, psiko-teknik değerlendirme raporu gerekmektedir.",
  "SEKTÖR BİLGİSİ — Özel güvenlik şirketleri, istihdam ettikleri personel için yıllık eğitim planı hazırlamak ve Bakanlığa sunmak zorundadır.",
  "SEKTÖR BİLGİSİ — Kıdemli güvenlik personeli; kıdem tazminatı, ihbar tazminatı ve yıllık izin haklarına tam anlamıyla sahiptir. Bu haklardan vazgeçilemez.",
  "HATIRLATMA — Çalıştığınız şirketin SGK bildirimlerini e-Devlet üzerinden düzenli olarak kontrol edin. Eksik ya da hatalı bildirimleri fark edince itiraz etme hakkınız vardır.",
];

const usedInfoIdx = new Set<number>();
function getNextInfoMsg(): string {
  if (usedInfoIdx.size >= INFO_MESSAGES.length) usedInfoIdx.clear();
  let idx: number;
  do { idx = Math.floor(Math.random() * INFO_MESSAGES.length); } while (usedInfoIdx.has(idx));
  usedInfoIdx.add(idx);
  return INFO_MESSAGES[idx]!;
}

function scheduleInfoBot() {
  const delay = 5 * 60 * 1000 + Math.random() * 5 * 60 * 1000;
  setTimeout(() => {
    io.emit("chat:message", makeInfoMsg(getNextInfoMsg()));
    scheduleInfoBot();
  }, delay);
}

// ── Online sayısı dalgalanma intervalı ───────────────────────────
async function broadcastOnlineCount() {
  try {
    const settings = await db.select().from(adminSettingsTable).limit(1);
    const s0 = settings[0];
    const fakeMin = s0?.fakeOnlineMin ?? 0;
    const fakeMax = s0?.fakeOnlineMax ?? 0;
    const fakeBonus = fakeMin > 0 || fakeMax > 0
      ? Math.floor(Math.random() * (Math.max(fakeMin, fakeMax) - Math.min(fakeMin, fakeMax) + 1)) + Math.min(fakeMin, fakeMax)
      : (s0?.fakeOnlineBonus ?? 0);
    io.emit("online_count", { count: onlineSockets.size + fakeBonus });
  } catch { /* ignore */ }
}

// ── Süresi dolan ilanları otomatik pasif yap ─────────────────────
async function expireListings() {
  try {
    await db.update(listingsTable)
      .set({ status: "expired" })
      .where(
        sql`${listingsTable.status} = 'active' AND ${listingsTable.expiresAt} IS NOT NULL AND ${listingsTable.expiresAt} < NOW()`
      );
  } catch { /* ignore */ }
}

// Başlangıç gecikmeleri
void expireListings();
setInterval(() => { void expireListings(); }, 30 * 60 * 1000);
setTimeout(() => scheduleBotMessage(), 3 * 60 * 1000);
setTimeout(() => scheduleFakeConversation(), 30000);
setTimeout(() => scheduleInfoBot(), 2 * 60 * 1000);
scheduleHourlyReminder();
setInterval(() => { void broadcastOnlineCount(); }, 45000);

httpServer.listen(port, (err?: Error) => {
  if (err) { logger.error({ err }, "Error listening on port"); process.exit(1); }
  logger.info({ port }, "Server listening");
});

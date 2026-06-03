import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import app from "./app";
import { logger } from "./lib/logger";
import { onlineSockets } from "./routes/chat";
import { setBotIo } from "./lib/chat-bot";
import { db, usersTable, listingsTable, adminSettingsTable, chatMessagesTable } from "@workspace/db";
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

async function saveToDB(userId: number, content: string): Promise<void> {
  try {
    await db.insert(chatMessagesTable).values({ userId, content, isPinned: false });
  } catch (e) {
    logger.error(e, "saveToDB error");
  }
}

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
    const hourlyMsg = getHourlyMsg(turkeyHour());
    void saveToDB(0, hourlyMsg);
    io.emit("chat:message", makeBotMsg(hourlyMsg));
    setInterval(() => {
      const m = getHourlyMsg(turkeyHour());
      void saveToDB(0, m);
      io.emit("chat:message", makeBotMsg(m));
    }, 60 * 60 * 1000);
  }, msUntilNextHour);
}

// ── GuvenlikBot döngüsel mesajlar (yalnızca platform tanıtımı) ────
const BOT_MSG_POOL = [
  "Güvenlik sektöründe kariyer yapmak isteyenler için yüzlerce ilan mevcut! İlanlar sayfasına göz atın.",
  "Topluluk kurallarına uymayı unutmayın — saygılı bir ortam herkese faydalı olur.",
  "Herhangi bir sorun yaşıyorsanız Destek menüsünden bize ulaşabilirsiniz.",
  "Özel güvenlik sertifikası almak isteyenler için eğitim ilanlarımıza göz atın!",
  "İstanbul, Ankara, İzmir ve daha birçok şehirde güncel ilanlar ekleniyor.",
  "Profil sayfanızı tamamlayarak işverenlerin sizi daha kolay bulmasını sağlayın.",
  "Yeni üyelerimize hoş geldiniz! Soru ve sorunlarınız için Destek menüsünü kullanın.",
  "AVM, fabrika, site, hastane ve okul güvenliği için ayrı ayrı ilanlar platformumuzda.",
  "Deneyimli güvenlik personeline büyük talep var — başvurularınızı güncel tutun.",
  "Arama filtrelerini kullanarak şehir, pozisyon ve maaş aralığına göre ilanları daraltabilirsiniz.",
  "Favori özelliğiyle beğendiğiniz ilanları kaydedebilir, daha sonra başvurabilirsiniz.",
  "Birden fazla şehirde iş arıyorsanız şehir filtresini kullanmayı deneyin.",
  "Platformumuza her gün yeni ilanlar ekleniyor, düzenli takip etmeyi unutmayın!",
  "İlan başvurularınızı tamamlamak için profilinizi eksiksiz doldurduğunuzdan emin olun.",
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
    void saveToDB(0, msg);
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
  // İş yeri deneyimleri — kişisel hikayeler
  "Bugün yeni bir ilan gördüm, oldukça iyi görünüyor.",
  "İstanbul dışı ilanlar da artık daha fazla, umut verici.",
  "AVM güvenliği mi yoksa site güvenliği mi daha avantajlı acaba?",
  "Havaalanı güvenliği için özel sertifika gerekiyor, biliyor musunuz?",
  "Sağlık kurumu güvenliği çok stresli ama maaşlar gerçekten iyi.",
  "Yaz aylarında tatil köyü güvenliği için ilanlar artıyor.",
  "Fabrika ve lojistik güvenliği ilanları artmış, taşeron firmalar çok aktif.",
  "Otel güvenliği yazın zirveye ulaşıyor, sezonluk işler de var.",
  "Liman güvenliği için ayrı lisans gerekiyor, araştırıyorum.",
  "Konut site güvenliği sakin ama saatler çok uzun oluyor.",
  "3 yıldır aynı yerde çalışıyorum, değişiklik yapmayı düşünüyorum artık.",
  "Bugün mülakata gittim, amir çok sıcakkanlıydı. Umarım olur.",
  "Sabah vardiyası insanı daha zinde tutuyor bence, gece pek sevmiyorum.",
  "Bu ay üç farklı firmaya başvurdum, bir tanesinden geri dönüş aldım.",
  "İlk kez güvenlik işi yapıyorum, başlangıçta çok zor geldi ama alıştım.",
  "Emeklilerin çalışabileceği pozisyonlar da var, fırsat değerlendirin.",
  "Fabrikada çalışmak farklı bir deneyim. İlk başta zor ama alışılıyor.",
  "Şirket değiştirince maaşım yüzde 20 arttı, sormadan değişmeyecektim.",
  "Aynı pozisyon için iki farklı firmanın teklifini karşılaştırıyorum şu an.",
  "Sektörde 8 yıldır varım, çok şey değişti. Teknoloji işleri farklılaştırdı.",
  "Bugün müdürümüz yeni kamera sistemleri hakkında eğitim verdi, faydalıydı.",
  "Arkadaşım bu platformdan iş buldu geçen ay, ben de deneyeyim dedim.",
  "Mülakatta ne tür sorular soruyorlar genellikle, tecrübe paylaşan var mı?",
  "İlk yıl çok zor geçti ama artık işin ritmine girdim.",
  "Öğrenci olarak da part-time güvenlik işi yapılabilir mi?",
  "Hafta sonu çalışmanın zor olduğunu söylüyorlar ama ben alıştım.",
  "İstanbul'da yeni açılan projelerde güvenlik açığı fazla gibi görünüyor.",
  "Uzun süredir iş arıyordum, sonunda bu platformda buldum. Tavsiye ederim.",
  "Yöneticim eski güvenlik görevlisiymiş, o yüzden sorunlarımızı anlıyor.",
  "Hastane güvenliği gerçekten zor. Sabah vardiyasında bir olay yaşandı bugün.",
  // Maaş ve yasal haklar
  "Bu sektörde tecrübe çok önemli, en az 2 yıl şart gibi görünüyor.",
  "Maaşlar geçen yıla göre biraz arttı, güzel.",
  "Gece vardiyası zam farkı hangi şirkette en yüksek acaba?",
  "Sigortasız çalıştıranlardan uzak durun, hakkınızı koruyun.",
  "İşe başlamadan önce mutlaka sözleşmeyi okuyun.",
  "Kıdem tazminatı için en az bir yıl çalışmak şart, baştan bilin.",
  "Fazla mesai ücretlerini düzenli takip edin, bazı firmalar eksik ödüyor.",
  "Yemek ve servis yardımı yapan firmalar ciddi bir avantaj sağlıyor.",
  "SGK primlerinizi e-Devlet'ten kontrol etmeyi alışkanlık haline getirin.",
  "Bu ay maaş geç yattı, bir dahaki işte buna dikkat edeceğim.",
  "Servis imkânı olan firma az, ama varsa gerçekten büyük kolaylık.",
  "Aylık brüt ile net arasındaki farka dikkat edin, yanıltıcı ilanlar var.",
  "Yıllık iznimi kullandırmıyorlardı, hukuki danışmanlık aldım.",
  "İşten ayrılırken haklarımı tam alamadım. Biraz daha bilinçli olmalıydım.",
  "Bayram ikramiyesi veren firmalar azaldı, yazık.",
  "Toplu iş sözleşmesi olan bir firmada çalışmak istiyorum, zam garantisi şart.",
  "Prim sistemi olan iş yerinde verim daha yüksek oluyor bence.",
  "Seyyar güvenlik olarak çalışmak yorucu ama maaş farkı iyi.",
  // Sertifika ve eğitim
  "Silahlı güvenlik lisansı almak istiyorum, nasıl yapılıyor acaba?",
  "Sertifika kurslarının ücreti biraz yüksek bence.",
  "Güvenlik kamerası sistemleri konusunda eğitim alan önde gidiyor.",
  "Sivil kıyafetli gözetleme görevi için ayrı eğitim gerekiyor.",
  "İlk yardım sertifikası artık çoğu firmada isteniyor, almak faydalı.",
  "İngilizce bilen güvenlik personeli otellerde büyük avantaj sağlıyor.",
  "Yangın söndürme eğitimi almak hem kariyer hem güvenlik açısından önemli.",
  "Özel güvenlik kimliği 5 yılda bir yenileniyor, takip etmek gerekiyor.",
  "Askeri deneyim özellikle silahlı pozisyonlarda çok işe yarıyor.",
  "Kurs masrafını işveren karşılarsa çok daha iyi, sormaktan çekinmeyin.",
  "Online ilk yardım kursu sertifika için geçerli mi, araştırıyorum.",
  "CCTV operatörlüğü için sertifika aldım, birkaç firmadan teklif geldi.",
  "Güvenlik amirliği eğitimi almak istiyorum ama burslu kurs bulmak zor.",
  "Yangın tatbikatı bugün yapıldı, çok faydalı bir deneyimdi.",
  "Deneyimli ama sertifikasız kişiler bazen geride kalıyor, maalesef.",
  // Çalışma koşulları ve iş yeri gözlemleri
  "Vardiyalı çalışmak zor ama zamanla alışılıyor.",
  "12 saatlik vardiyada ayakta durmak çok yorucu, doğru ayakkabı şart.",
  "Müşteri ile iletişim kuvvetli olmak sizi diğerlerinden ayırıyor.",
  "Gece vardiyasında dikkatli olmak için molayı iyi kullanmak şart.",
  "Güneş çıkmadan kalkmak zorunda kalmak gerçekten alışmayı gerektiriyor.",
  "Kış aylarında dış görev çok zor, ekipman önemli.",
  "Yönetici değişince iş yeri atmosferi bir anda değişti, olumlu yönde.",
  "Kapalı kameralı ortamda çalışmak başlangıçta tuhaf geldi.",
  "İş arkadaşlarım çok iyi, bu sektörde dayanışma şart.",
  "Site güvenliğinde sakinlik iyi ama uzun vardiya yorucu.",
  "AVM'de çalışırken çok farklı insanla karşılaştım, iletişim gelişiyor.",
  "Gece vardiyasından gündüze geçince vücut ritmi bozuluyor, dikkat edin.",
  "Ekipman kalitesi firma kalitesinin göstergesi bence.",
  "Yeni işyerimde mola odası var, küçük şeyler büyük fark yaratıyor.",
  "Bir olay anında nasıl tepki vereceğinizi mutlaka prova edin.",
  "Yazlık sezonda sahil güvenliği farklı bir deneyim, tavsiye ederim.",
  "Fabrikada gürültüden kaynaklanan yorgunluk ciddi, kulak koruyucu şart.",
  "Banka güvenliğinde protokol çok sıkı, ama disiplin açısından iyi.",
  "Özel hastanede çalışmak farklı, personel ilişkileri çok daha resmi.",
  "Vardiya takvimine önceden bakmayı alışkanlık haline getirin.",
  // Teknoloji ve yenilikler
  "Yapay zeka kameralar artık güvenlik sektörüne giriyor, işler değişiyor.",
  "Biyometrik giriş sistemleri için ek eğitim veren firmalar avantajlı.",
  "Akıllı bina sistemlerini bilen personele talep giderek artıyor.",
  "Drone güvenliği gibi yeni alanlar açılıyor, ek sertifika fırsatı var.",
  "Yüz tanıma sistemi çalıştığım yerde devreye girdi, herkesi şaşırttı.",
  "Cep telefonu yerine telsiz kullanan firmalar hâlâ çok, eski alışkanlıklar.",
  "Güvenlik yazılımları artık rapor da otomatik üretiyor, iş kolaylaşıyor.",
  "Akıllı kilit sistemleri mekanik kilitlerin yerini alıyor hızla.",
  "Çalıştığım yerde QR kod bazlı ziyaretçi takibi başladı, verimli.",
  "Alarm sistemleri artık telefona bildirim gönderiyor, anlık müdahale mümkün.",
  // Sektör gözlemleri ve genel
  "Bu meslek psikolojik olarak zorlayıcı, destek almayı ihmal etmeyin.",
  "Tecrübeli güvenlik görevlileri artık danışmanlık hizmeti de veriyor.",
  "Hangi firmalar en düzenli maaş ödüyor, deneyimi olan söylesin.",
  "Çalıştığım yerde yöneticimiz çok anlayışlı, böyle ortam nadiren bulunuyor.",
  "Sendikalı güvenlik şirketi bulmak giderek zorlaşıyor maalesef.",
  "Kariyer planı yapmak bu sektörde de kritik, plansız ilerlemek zor.",
  "İş arama sürecinde çok ret aldım ama pes etmedim, sonunda oldu.",
  "Bu sektörde dürüstlük ve güvenilirlik her şeyden önce geliyor.",
  "Sabır gerektiren bir meslek, özellikle ilk yıllarda zorlanabilirsiniz.",
  "İki yılda bir şirket değiştirmek mi daha avantajlı, tartışılır.",
  "Referanslarınızı güncel tutun, sektör çok dar, herkes birbirini tanıyor.",
  "Mesleki gelişim için sektör fuarlarını takip ediyorum, faydalı oluyor.",
  "Çalıştığım firmanın itibarı benim itibarım da, seçimde dikkatli olun.",
  "İlk işime başladığımda çok şey bilmiyordum, meslektaşlar çok öğretti.",
  "Bu platformdaki tartışmalar gerçekten bilgilendirici, teşekkürler.",
  "Herkese kolay gelsin, bu meslek hak ettiği değeri görmüyor.",
  "Sektördeki dayanışma artıyor, bu çok güzel bir gelişme.",
  "Genç arkadaşlara tavsiyem: ilk 3 yıl sabırlı olun, her şey oturur.",
  "Aynı firmada 5 yılı geçince yöneticilik teklifi aldım, beklenmedikti.",
  "Güvenlik sektörü küçük görünür ama içinde kocaman bir dünya var.",
  "Müdürüm eski komisermiş, o yüzden prosedürlere çok dikkat ediyor.",
  // Kişisel durumlar ve aile
  "Gece vardiyasında çalışınca aile ile vakit geçirmek güçleşiyor.",
  "Eşim de bu sektörde, farklı firmalarda çalışıyoruz, koordinasyon zor.",
  "Çocuklar okula giderken ben yatıyorum, ritim alışmayı gerektiriyor.",
  "Uzak şehirdeki ilana başvurdum, aile bırakmak zor ama iyi fırsat.",
  "İkiz kardeşim de benimle aynı firmada çalışıyor, güzel tesadüf.",
  "Anne ve babam bu mesleği güvenli bulmuyordu, şimdi fikir değiştirdiler.",
  "Şehir dışından taşındım bu iş için, ilk ay çok zorlandım.",
  "İki çocuk babasıyım, düzenli ödeme yapan firmayı tercih etmek şart.",
  "Tatillerde ailemi göremiyorum bazen, ama mesleği seviyorum.",
  // Güncel yorum ve sorular
  "Bu yıl iş ilanları geçen yıla kıyasla daha mı çok, takip eden var mı?",
  "Hangi şehirde güvenlik personeline talep daha yüksek, fikir var mı?",
  "Taşeron firma mı yoksa doğrudan kurumsal mı çalışmak daha iyi?",
  "Kamu kurumuna geçmek mümkün mü güvenlik sektöründen, deneyim paylaşın.",
  "Uzun vadede bu sektörde kariyer yapılabilir mi, tartışalım.",
  "Farklı şehirde iş ilanına başvuruyorum, taşınma desteği veren yer var mı?",
  "Kendi güvenlik şirketimi kurmayı düşünüyorum, deneyimi olan var mı?",
  "Bu platforma yeni üye oldum, oldukça faydalı bir topluluk.",
  "Maaş pazarlığında nasıl bir strateji izlemeliyim, tavsiye var mı?",
  "Referans mektubu nasıl yazılır, yardımcı olabilir misiniz?",
  "İş görüşmesine giderken ne giyilmeli, resmi mi yoksa yarı resmi mi?",
  "CV'me ne yazmalıyım, askeri geçmişimi de ekleyeyim mi?",
  "Birden fazla sertifikam var, hangisini öne çıkarmalıyım?",
  "Kötü referans veren eski müdürüm hakkında ne yapabilirim?",
  "İş sözleşmesinde anlamadığım maddeler var, hukuki destek nereden alınır?",
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
    void saveToDB(0, content);
    io.emit("chat:message", { ...makeBotMsg(content, askerUsername), content });
  }, 8000 + Math.random() * 12000);
}

function scheduleFakeConversation() {
  const delay = 50000 + Math.random() * 110000;
  setTimeout(async () => {
    const roll = Math.random();
    if (roll < 0.35) {
      const user = getRandomUser();
      const standaloneContent = getNextStandalone();
      void saveToDB(user.id, standaloneContent);
      io.emit("chat:message", makeFakeMsg(user, standaloneContent));
    } else {
      const pair = getNextConvPair();
      const stats = await getListingStats();
      const userA = getRandomUser();
      const userB = getRandomUser(userA);

      void saveToDB(userA.id, pair.a);
      io.emit("chat:message", makeFakeMsg(userA, pair.a));

      // Bot bazen soruya cevap verir
      await maybeBotReply(pair.a, userA.username);

      setTimeout(() => {
        const answer = pair.bTemplate(stats);
        const fullAnswer = `@${userA.username} ${answer}`;
        void saveToDB(userB.id, fullAnswer);
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

// ── BİLGİ BOTU ───────────────────────────────────────────────────
const INFO_BOT = {
  id: -999, username: "BilgiBot", displayName: "Bilgi Botu",
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
  // Kanun bilgileri — 5188
  "KANUN BİLGİSİ — 5188 Sayılı Kanun Md.1: Bu Kanunun amacı, kamu güvenliğini tamamlayıcı nitelikteki özel güvenlik hizmetlerinin yerine getirilmesine ilişkin esas ve usulleri düzenlemektir.",
  "KANUN BİLGİSİ — 5188 Sayılı Kanun Md.3: Özel güvenlik izni, valiliklerce verilir. İzin alınmadan özel güvenlik hizmeti verilemez ve özel güvenlik şirketi kurulamaz.",
  "KANUN BİLGİSİ — 5188 Sayılı Kanun Md.7: Özel güvenlik görevlileri; kimlik sorma, durdurma, üst ve araç arama, el koyma gibi yetkileri yalnızca görev alanlarında ve kanun çerçevesinde kullanabilir.",
  "KANUN BİLGİSİ — 5188 Sayılı Kanun Md.11: Özel güvenlik görevlileri, bu Kanunda belirtilen yetkilerini görev alanları ve süreleriyle sınırlı olarak kullanabilir.",
  "KANUN BİLGİSİ — 5188 Sayılı Kanun Md.14: Özel güvenlik görevlileri, Türkiye Cumhuriyeti vatandaşı olmak zorundadır. Yabancı uyruklu kişiler özel güvenlik görevlisi olarak çalışamaz.",
  "KANUN BİLGİSİ — 5188 Sayılı Kanun Md.18: Özel güvenlik görevlileri kaba kuvvet kullanamaz; orantılılık ilkesine uymak zorundadır. Her türlü hak ihlali cezai sorumluluk doğurur.",
  "KANUN BİLGİSİ — 5188 Sayılı Kanun Md.10: Silahlı özel güvenlik görevi yapılabilmesi için valiliğin onayı ve ilgili silah taşıma izninin alınmış olması gerekir.",
  "KANUN BİLGİSİ — 5188 Sayılı Kanun Md.13: Özel güvenlik şirketleri, çalıştırdıkları personele ilişkin bilgileri her yıl ocak ayı sonuna kadar valiliğe bildirmek zorundadır.",
  "KANUN BİLGİSİ — 5188 Sayılı Kanun Md.19: Özel güvenlik görevlileri görevleri dışında, başka amaçlarla istihdam edilemez. İşveren bu hükme aykırı davranırsa idari para cezasıyla karşılaşır.",
  "KANUN BİLGİSİ — 5188 Sayılı Kanun Md.23: Kanun hükümlerine aykırı davranan özel güvenlik şirketleri ve görevlileri idari para cezası ile karşılaşır; aykırılığın tekrarı lisans iptaline yol açabilir.",
  // İş Kanunu
  "İŞ KANUNU — Md.41 (Fazla Mesai): Haftalık 45 saati aşan her saat çalışma, yüzde elli zamlı ücretle ödenir. İşçi, yıllık 270 saat fazla mesai sınırını aşmayı reddedebilir.",
  "İŞ KANUNU — Md.46 (Hafta Tatili): Her işçi, kesintisiz en az 24 saat haftalık dinlenme hakkına sahiptir. Bu günde çalışmak zorunda bırakılan işçiye ilave ücret ödenmelidir.",
  "İŞ KANUNU — Md.53 (Yıllık İzin): 1-5 yıl arasında çalışan işçi yılda 14 gün, 5-15 yıl arası 20 gün, 15 yılı aşkın çalışanlara 26 gün yıllık ücretli izin hakkı tanınır.",
  "İŞ KANUNU — Md.17 (İhbar Süresi): 6 aya kadar çalışmada 2 hafta, 6 ay - 1.5 yıl arası 4 hafta, 1.5-3 yıl arası 6 hafta, 3 yıldan fazla çalışmada 8 hafta ihbar süresi uygulanır.",
  "İŞ KANUNU — Md.25 (Haklı Fesih): İşçi, ücretini ödemeyen, sözleşme şartlarına uymayan veya mobbing uygulayan işvereni bekleme süresi beklemeksizin feshedip kıdem tazminatı talep edebilir.",
  // SGK ve sosyal haklar
  "SGK BİLGİSİ — Eksik Prim Bildirimi: İşveren, gerçek ücretin altında prim yatırırsa emeklilikte aldığınız aylık düşük hesaplanır. e-Devlet'ten 'Hizmet Dökümü' sayfasını düzenli kontrol edin.",
  "SGK BİLGİSİ — İş Kazası Bildirimi: İşveren, iş kazasını kazadan sonra en geç 3 iş günü içinde SGK'ya bildirmek zorundadır. Bildirmezse idari para cezası alır ve tazminat yükü artar.",
  "SGK BİLGİSİ — Emeklilik Yaşı Hesabı: 5510 Sayılı Kanun kapsamında prim gün sayısı ve yaş koşulları birlikte değerlendirilir. Güncel simülasyon için 'sigortalı hizmet dökümü'nden gün sayınızı takip edin.",
  "SGK BİLGİSİ — Kıdem Tazminatı Hesabı: Son brüt ücretiniz üzerinden her tam çalışma yılı için 30 günlük ödeme yapılır. Kıdem tazminatı tavanını aşan kısım yasal tavan üzerinden hesaplanır.",
  "SGK BİLGİSİ — İşsizlik Ödeneği: İşveren tarafından işten çıkarılırsanız, son 3 yılda en az 600 gün prim ödenmiş olması koşuluyla işsizlik ödeneğine başvurabilirsiniz.",
  // İSG (İş Sağlığı ve Güvenliği)
  "İSG BİLGİSİ — 6331 Sayılı Kanun: İşveren, çalışma ortamındaki risk faktörlerini belirlemek ve gidermek için risk değerlendirmesi yapmakla yükümlüdür. Bu belge denetçilere ibraz edilebilir olmalıdır.",
  "İSG BİLGİSİ — Gece Çalışması: Yasal olarak gece 20:00 - 06:00 saatleri arasında çalışanlara yüzde 25 gece zammı ödenmesi zorunludur. Bazı iş sözleşmeleri bu oranı yüzde 35-40'a çıkarır.",
  "İSG BİLGİSİ — Fazla Mesai: Günlük 11 saati veya haftalık 45 saati aşan çalışmalar yasal fazla mesai sayılır ve yüzde elli zamlı ücret gerektirir. Bu sınırların üstü işçinin onayına bağlıdır.",
  "İSG BİLGİSİ — Vardiya Çalışması: Vardiyalı çalışanlara rotasyon düzeni uygulanmalı, aynı kişi uzun süre gece vardiyasında bırakılmamalıdır. Sağlık taramaları yılda en az bir kez yapılmalıdır.",
  "İSG BİLGİSİ — Kişisel Koruyucu Donanım: İşveren, çalışanın sağlığını korumak için KKD (baret, yelek, eldiven vb.) sağlamakla yükümlüdür. Bunların maliyeti işçiden kesilemez.",
  "İSG BİLGİSİ — Tatil Ücretleri: Ulusal bayram ve genel tatillerde çalıştırılan işçiye, o günün ücreti haftalık ücrete ek olarak ayrıca ödenmek zorundadır.",
  // Sertifika ve eğitim
  "SERTİFİKA BİLGİSİ — Özel Güvenlik Kimlik Kartı: Kimlik kartı 5 yılda bir İçişleri Bakanlığı'ndan yenilenmek zorundadır. Süresi dolmuş kartla görev yapmak 5188 sayılı Kanun kapsamında suç teşkil eder.",
  "SERTİFİKA BİLGİSİ — Silahlı Güvenlik Ruhsatı: Silahlı görev için; psiko-teknik değerlendirme raporu, ateşli silah yetkinlik belgesi ve valilik onayı gerekmektedir. Bu belgeler 3 yılda bir yenilenir.",
  "SERTİFİKA BİLGİSİ — İlk Yardım Sertifikası: Birinci basamak ilk yardım eğitimi artık pek çok firmada zorunlu tutuluyor. Sertifika 3 yıl geçerli; sonunda yenileme kursu zorunlu.",
  "SERTİFİKA BİLGİSİ — Yangın Güvenliği: Yangın söndürme ve tahliye ekibi eğitimi, 6331 sayılı ISG Kanunu kapsamında zorunlu. Bu eğitimi alan personel firmada ekip kurucusu olabilir.",
  "SERTİFİKA BİLGİSİ — Temel Güvenlik Eğitimi: MEB onaylı 120 saatlik temel eğitim; hukuk, fiziksel güvenlik, iletişim ve silah eğitimini kapsar. Bu eğitim olmadan özel güvenlik kimliği alınamaz.",
  "SERTİFİKA BİLGİSİ — CCTV ve Alarm Sistemleri: Kamera ve alarm sistemleri operatörlüğü için ayrı sertifika programları mevcut. Bu alanda sertifikalı personelin maaşı sektör ortalamasının yüzde 15-20 üzerindedir.",
  "SERTİFİKA BİLGİSİ — Güvenlik Amirliği Sertifikası: Güvenlik amiri olmak için en az 5 yıl deneyim ve İçişleri Bakanlığı onaylı amirlik kursu gereklidir. Kariyer planınızda buna yer açın.",
  // Kariyer ve haklar
  "KARİYER BİLGİSİ — Kariyer Basamakları: Güvenlik görevlisi → Ekip lideri → Vardiya amiri → Güvenlik amiri → Güvenlik müdürü. Her basamakta ek sertifika ve deneyim şartı aranır.",
  "KARİYER BİLGİSİ — Referans Önemi: Güvenlik sektöründe referans belirleyici. Eski amirinizden veya çalıştığınız kurumdan olumlu referans almanız iş başvurularında büyük avantaj sağlar.",
  "KARİYER BİLGİSİ — CV Hazırlama: CV'nize çalıştığınız sektörü (AVM, fabrika, banka vb.), taşıdığınız sertifikaları ve vardiya deneyimini açıkça yazın. Belirsiz ifadeler yerine somut rakamlar kullanın.",
  "KARİYER BİLGİSİ — Mülakat Tüyoları: Mülakatta iletişim becerisi, sakin kalma kapasitesi ve hukuki farkındalık ön plana çıkar. Önceki iş yerlerinizi kötülemeyin; bunun yerine kazanımlarınızı anlatın.",
  "HAKLARINIZ — Mobbing: İşyerinde psikolojik baskı ve taciz (mobbing) 4857 sayılı İş Kanunu kapsamında işçiye haklı fesih hakkı tanır. ALO 170 hattını arayarak Bakanlığa şikayette bulunabilirsiniz.",
  "HAKLARINIZ — Ücret Garantisi: İşveren, ücretinizi aylık olarak ödemek zorundadır. 20 günü aşan gecikme, işçiye iş sözleşmesini haklı nedenle feshetme hakkı tanır.",
  "HAKLARINIZ — İzin Hakkı: Yıllık ücretli izin paraya çevrilemez; işçi, izin yerine ücret talep edemez. Kullandırılmayan izinler iş sözleşmesi sonunda tazminat olarak ödenir.",
  "HAKLARINIZ — İbraname: İşten ayrılırken 'tüm haklarımı aldım' ibareli ibranameyi imzalamayı reddetme hakkınız var. İmzalamak için baskıya maruz kalırsanız noter huzurunda itiraz edebilirsiniz.",
  "HAKLARINIZ — Kötü Niyet Tazminatı: İşverenin geçerli neden olmaksızın iş sözleşmesini feshetmesi halinde işçi, ihbar tazminatının 3 katı tutarında kötü niyet tazminatı talep edebilir.",
  // Teknoloji ve gelişmeler
  "TEKNOLOJİ — Yapay Zeka Kameralar: Davranış analizi yapabilen akıllı kamera sistemleri güvenlik sektörüne hızla giriyor. Bu sistemleri kuran ve yöneten teknisyenlere olan talep artıyor.",
  "TEKNOLOJİ — Biyometrik Sistemler: Parmak izi, yüz tanıma ve retina sistemleri AVM, havaalanı ve kritik tesislerde yaygınlaşıyor. Bu teknolojileri bilen personel daha yüksek maaşla işe alınıyor.",
  "TEKNOLOJİ — Drone Güvenliği: 2023 yılında yürürlüğe giren düzenlemelerle insansız hava araçları güvenliği yeni bir uzmanlık alanı haline geldi. Drone pilotu sertifikası güvenlik kariyerine değer katıyor.",
  "TEKNOLOJİ — Siber Güvenlik Farkındalığı: Fiziksel güvenlik ile siber güvenliğin kesiştiği alanlar genişliyor. Temel siber güvenlik bilgisi artık pek çok kurumun güvenlik personelinden beklediği bir nitelik.",
  "TEKNOLOJİ — Merkezi İzleme Merkezleri: TEDES ve benzeri merkezi güvenlik izleme sistemleri büyük firmalarda yaygınlaşıyor. Operatör olarak çalışmak için özel eğitim ve sertifika gerekiyor.",
  // Sağlık ve wellness
  "SAĞLIK BİLGİSİ — Gece Vardiyası Etkileri: Uzun vadeli gece çalışması; uyku bozukluğu, D vitamini eksikliği ve metabolik sorunlara yol açabilir. Düzenli kan tahlili ve güneş ışığı maruziyeti şart.",
  "SAĞLIK BİLGİSİ — Ayakta Çalışma: Uzun süre ayakta durmak eklem ve sırt problemlerine neden olabilir. Ergonomik ayakkabı, düzenli germe egzersizleri ve molaları verimli kullanmak kritik önem taşır.",
  "SAĞLIK BİLGİSİ — Stres Yönetimi: Güvenlik görevi yüksek stres içerebilir. Nefes egzersizleri, düzenli uyku ve sosyal destek ağı oluşturmak mesleki tükenmişliği önlemede etkili yöntemlerdir.",
  "SAĞLIK BİLGİSİ — Periyodik Sağlık Muayenesi: İşveren, tehlikeli ve çok tehlikeli işlerde çalışan güvenlik personelinin yılda en az bir kez sağlık muayenesini yaptırmak zorundadır.",
  // Ekonomi ve güncel
  "EKONOMİ BİLGİSİ — Asgari Ücret: Asgari ücret yılda iki kez güncellenir. Güvenlik sektöründeki maaşlar asgari ücretin genellikle yüzde 20-80 üzerinde seyreder; pozisyon ve deneyime göre değişir.",
  "EKONOMİ BİLGİSİ — Enflasyona Karşı Hak Arama: Toplu iş sözleşmesi kapsamındaki işçiler enflasyona karşı zam güvencesine sahiptir. TİS yoksa bireysel sözleşme yenileme talebini yazılı yapın.",
  "HATIRLATMA — SGK Kontrol: Her ay e-Devlet üzerinden 'SGK Hizmet Dökümü'nü kontrol edin. Yatırılmayan primler karşısında işverene yazılı bildirim, ardından SGK'ya şikayet yoluna başvurun.",
  "HATIRLATMA — İş Sözleşmesi: İş sözleşmenizi iki nüsha olarak imzalayın ve bir kopyasını saklayın. Sözleşmenizde yazılmayan sözel vaatler hukuken geçersizdir.",
  "HATIRLATMA — İşkur Kaydı: İşsizlik durumunda önce İŞKUR'a kaydolun; böylece hem işsizlik ödeneğine başvurabilir hem de ücretsiz mesleki eğitim fırsatlarından yararlanabilirsiniz.",
  "HATIRLATMA — Yıllık İzin Takibi: Kullanmadığınız yıllık izin günlerini kayıt altına alın. İş sözleşmesi sona erdiğinde kullanılmayan izinler ücret olarak ödenmek zorundadır.",
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
  const delay = 3 * 60 * 1000 + Math.random() * 4 * 60 * 1000;
  setTimeout(() => {
    const infoContent = getNextInfoMsg();
    void saveToDB(-999, infoContent);
    io.emit("chat:message", makeInfoMsg(infoContent));
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
setTimeout(() => scheduleInfoBot(), 10 * 1000);
scheduleHourlyReminder();
setInterval(() => { void broadcastOnlineCount(); }, 45000);

httpServer.listen(port, (err?: Error) => {
  if (err) { logger.error({ err }, "Error listening on port"); process.exit(1); }
  logger.info({ port }, "Server listening");
});

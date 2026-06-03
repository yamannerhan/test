import { db, listingsTable } from "@workspace/db";
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

async function getStats() {
  try {
    const [{ total }] = await db.select({ total: count() }).from(listingsTable).where(eq(listingsTable.isActive, true));
    const salaryRows = await db.select({
      minSalary: sql<number>`min(${listingsTable.salaryMin})`,
      maxSalary: sql<number>`max(${listingsTable.salaryMax})`,
    }).from(listingsTable).where(eq(listingsTable.isActive, true));
    return {
      total: Number(total),
      minSalary: Math.round((salaryRows[0]?.minSalary ?? 25000) / 1000) * 1000,
      maxSalary: Math.round((salaryRows[0]?.maxSalary ?? 55000) / 1000) * 1000,
    };
  } catch {
    return { total: 0, minSalary: 25000, maxSalary: 50000 };
  }
}

type Stats = { total: number; minSalary: number; maxSalary: number };

const KEYWORD_RULES: Array<{
  keywords: RegExp;
  getReplies: (s: Stats, username: string) => string[];
}> = [
  {
    keywords: /maaş|ücret|ne kadar|kaç tl|kaç para|kazan/i,
    getReplies: (s, u) => [
      `@${u} Platformumuzdaki ilanların maaş aralığı genellikle ${s.minSalary.toLocaleString("tr-TR")} - ${s.maxSalary.toLocaleString("tr-TR")} TL arasında. Silahlı ve deneyimli pozisyonlarda bu rakam çok daha yüksek olabiliyor.`,
      `@${u} Maaşlar pozisyona ve şirkete göre büyük fark gösteriyor. Site güvenliği ile havaalanı güvenliği arasında yüzde kırk farka kadar çıkabiliyor. Güncel rakamlar için ilanları incelemenizi öneririm.`,
      `@${u} ${s.total > 0 ? `Şu an ${s.total} aktif ilanımız var.` : "Platformumuzdaki ilanları inceleyin."} Maaş kıyaslaması için filtrelerden pozisyon ve şehir seçerek arama yapabilirsiniz.`,
    ],
  },
  {
    keywords: /sertifika|lisans|belge|kurs|eğitim|kart/i,
    getReplies: (_, u) => [
      `@${u} Özel güvenlik sektöründe temel eğitim sertifikası zorunlu. Sonrasında ilk yardım, yangın söndürme ve silahlı güvenlik belgelerini almanızı tavsiye ederim — kariyer açısından büyük fark yaratıyor.`,
      `@${u} Özel güvenlik kimlik kartı 5 yılda bir yenileniyor. Süresi dolmadan başvuru yapın; süresi dolmuş kartla çalışmak yasal ihlal sayılır ve hem işçi hem işveren ceza alır.`,
      `@${u} MEB onaylı güvenlik kursları genellikle 4-8 bin TL arasında. Fakat bu yatırım kısa sürede geri dönüyor; sertifikalı personel daha hızlı iş buluyor ve daha yüksek maaş alıyor.`,
    ],
  },
  {
    keywords: /ilan|iş bul|pozisyon|açık|başvur|iş aran/i,
    getReplies: (s, u) => [
      s.total > 0
        ? `@${u} Şu an platformumuzda ${s.total} aktif ilan bulunuyor. Şehir, pozisyon ve maaş aralığına göre filtreleyebilirsiniz.`
        : `@${u} İlanlar sayfamızı düzenli takip edin, yeni pozisyonlar sürekli ekleniyor.`,
      `@${u} Başvururken CV'nizi güncel tutun ve sabıka kaydı ile sağlık raporunuzu hazır bulundurun. İşverenler hazır belgeleri olan adayları tercih ediyor.`,
    ],
  },
  {
    keywords: /sigorta|sgk|prim/i,
    getReplies: (_, u) => [
      `@${u} SGK primlerinizi e-Devlet üzerinden düzenli kontrol edin. Sigortasız çalıştıranlardan kesinlikle uzak durun — bu hem yasal bir hak hem de emekliliğiniz için kritik.`,
      `@${u} Bazı firmalar sigorta primini düzük gösteriyor. e-Devlet'ten "Sigortalılık Hizmet Dökümü"ne girerek primlerin doğru yatıp yatmadığını kontrol edebilirsiniz.`,
    ],
  },
  {
    keywords: /gece vardiya|vardiya zam|gece zam/i,
    getReplies: (_, u) => [
      `@${u} Gece vardiyası çalışması için yasal olarak yüzde yirmi beş zam hakkınız bulunuyor. Bazı firmalar yüzde otuz beş - kırk da verebiliyor. İş sözleşmenizde bu maddenin açıkça yazılmasına dikkat edin.`,
      `@${u} Gece vardiyası zammı kanunen zorunlu. İş Kanunu madde 41'e göre gece çalışması için işçiye ek ücret ödenmesi şart. Ödenmiyorsa iş mahkemesine başvurabilirsiniz.`,
    ],
  },
  {
    keywords: /silahlı|tabanca|silah ruhsat/i,
    getReplies: (_, u) => [
      `@${u} Silahlı güvenlik görevi için valilik onayı, psiko-teknik değerlendirme ve ateşli silah yetkinlik belgesi gerekiyor. Süreç biraz uzun ama maaş avantajı önemli bir fark yaratıyor.`,
      `@${u} Silahlı pozisyonlarda genellikle en az iki yıl güvenlik deneyimi şart. Askeri geçmişiniz varsa bu süreç çok daha kolay ilerliyor.`,
    ],
  },
  {
    keywords: /kıdem|tazminat|ihbar/i,
    getReplies: (_, u) => [
      `@${u} Kıdem tazminatı için en az bir yıl çalışmış olmanız gerekiyor. Son brüt ücretiniz üzerinden her yıl için otuz günlük ödeme yapılır. Bu haklardan vazgeçtiren sözleşme maddeleri hukuken geçersizdir.`,
      `@${u} İşten çıkarılırsanız kıdem ve ihbar tazminatı haklarınız doğar. Kendi isteğinizle ayrılırsanız ihbar tazminatı alamazsınız, kıdem hakkınız ise koşula bağlı. Hukuki destek alın.`,
    ],
  },
  {
    keywords: /fazla mesai|haftalık 45|11 saat|mesai ücret/i,
    getReplies: (_, u) => [
      `@${u} Haftalık kırk beş saati veya günlük on bir saati aşan çalışmalar yasal fazla mesai sayılır ve yüzde elli zamlı ödenmek zorundadır. Kayıtlarınızı tutun ve itiraz hakkınızı kullanın.`,
    ],
  },
  {
    keywords: /nasıl başla|nasıl giri|yeni başl|sektöre gir/i,
    getReplies: (_, u) => [
      `@${u} Sektöre giriş için önce temel özel güvenlik eğitimi sertifikası almanız gerekiyor. Sonrasında sabıka kaydı ve sağlık raporu ile başvurabilirsiniz. Deneyimsiz adayları kabul eden ilanlar da mevcut.`,
      `@${u} Başlangıç için site güvenliği veya iş merkezi güvenliği en uygun pozisyonlar. Gece vardiyalı ilanlar genellikle daha kolay kabul ediyor, tecrübe kazanmak için iyi bir başlangıç noktası.`,
    ],
  },
  {
    keywords: /merhaba|selam|günaydın|iyi akşam|iyi geceler|hey|naber/i,
    getReplies: (_, u) => [
      `@${u} Merhaba! ÖzelGüvenlik.Online'a hoş geldiniz. İş ilanları, mevzuat veya kariyer konularında her türlü sorunuzu yanıtlayabilirim.`,
      `@${u} Hoş geldiniz! Güvenlik sektöründe iş, maaş, sertifika veya yasal haklar konusunda yardımcı olabilirim.`,
    ],
  },
  {
    keywords: /emekli|emeklil/i,
    getReplies: (_, u) => [
      `@${u} Emekli maaşı alırken bu sektörde çalışabilirsiniz, ancak SGDP kesintisi uygulanır. Bazı firmalar buna göre farklı sözleşme yapıyor. SGK'ya danışmanızı öneririm.`,
    ],
  },
  {
    keywords: /teşekkür|sağ ol|eyvallah|tamam|anladım/i,
    getReplies: (_, u) => [
      `@${u} Rica ederim! Başka sorularınız olursa buradayım.`,
      `@${u} Ne demek, iyi çalışmalar! Sektörde başarılar dilerim.`,
    ],
  },
  {
    keywords: /istismar|mobbing|baskı|zorbalık|haksız/i,
    getReplies: (_, u) => [
      `@${u} Çalışma hayatında psikolojik baskı ve haksız muamele yasal olarak suç teşkil eder. ALO 170 hattını arayarak Çalışma ve Sosyal Güvenlik Bakanlığı'na şikayette bulunabilirsiniz.`,
    ],
  },
  {
    keywords: /fazla maaş|düşük maaş|az para|düşük ücret/i,
    getReplies: (s, u) => [
      `@${u} Platformumuzdaki ilanların büyük çoğunluğu piyasa ortalamasının üzerinde ücret sunuyor. ${s.maxSalary > 0 ? `En yüksek teklifler ${s.maxSalary.toLocaleString("tr-TR")} TL'ye kadar çıkabiliyor.` : "Silahlı ve deneyimli pozisyonlarda maaşlar oldukça iyi."} Alternatifleri değerlendirin.`,
    ],
  },
  {
    keywords: /tatil|bayram|resmi tatil/i,
    getReplies: (_, u) => [
      `@${u} Ulusal bayram ve resmi tatil günlerinde çalışan güvenlik görevlisine, o gün için ayrıca günlük ücret ödenmesi zorunludur. Bu tutar normal günlük ücretinize ek olarak ödenir.`,
    ],
  },
];

const lastBotReplyAt = new Map<string, number>();
const BOT_REPLY_COOLDOWN_MS = 25 * 1000;

export function triggerContextualReply(content: string, username: string, role: string): void {
  if (!_io) return;
  if (role === "admin" || role === "moderator") return;

  const now = Date.now();
  const last = lastBotReplyAt.get(username) ?? 0;
  if (now - last < BOT_REPLY_COOLDOWN_MS) return;

  if (Math.random() > 0.65) return;

  const matched = KEYWORD_RULES.find(rule => rule.keywords.test(content));
  if (!matched) return;

  lastBotReplyAt.set(username, now);

  const delay = 4000 + Math.random() * 9000;
  setTimeout(async () => {
    if (!_io) return;
    const stats = await getStats();
    const replies = matched.getReplies(stats, username);
    const reply = replies[Math.floor(Math.random() * replies.length)]!;
    _io.emit("chat:message", makeBotMsg(reply, username));
  }, delay);
}

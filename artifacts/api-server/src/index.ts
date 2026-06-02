import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import app from "./app";
import { logger } from "./lib/logger";
import { onlineSockets } from "./routes/chat";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

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

// ── GuvenlikBot ──────────────────────────────────────────────────
const BOT_USER = {
  id: 0, username: "GuvenlikBot", displayName: "GuvenlikBot",
  userRole: "bot", userAvatarUrl: null,
  userNameColor: "#06B6D4", userNameAnimated: false, isBot: true,
};
function makeBotMsg(content: string) {
  return {
    ...BOT_USER,
    id: Date.now(), content, replyToId: null, replyToUsername: null,
    replyToContent: null, isPinned: false, mentions: [],
    createdAt: new Date().toISOString(),
  };
}
const BOT_MESSAGES = [
  "Güvenlik sektöründe kariyer yapmak isteyenler için yüzlerce ilan mevcut!",
  "Yeni üyelerimize hoş geldiniz! Soru ve sorunlarınız için destek menüsünü kullanabilirsiniz.",
  "Topluluk kurallarına uymayı unutmayın — saygılı bir ortam herkese faydalı olur.",
  "Güvenlik sektöründeki son ilanlar için bizi takip etmeye devam edin!",
  "Herhangi bir sorun yaşıyorsanız Destek menüsünden bize ulaşabilirsiniz.",
  "Özel güvenlik sertifikası almak isteyenler için eğitim ilanlarımıza göz atın!",
];
let botMsgIndex = 0;
function scheduleBotMessage() {
  const delay = 4 * 60 * 1000 + Math.random() * 6 * 60 * 1000;
  setTimeout(() => {
    io.emit("chat:message", makeBotMsg(BOT_MESSAGES[botMsgIndex % BOT_MESSAGES.length]!));
    botMsgIndex++;
    scheduleBotMessage();
  }, delay);
}

// ── Fake Live Conversation ────────────────────────────────────────
// Pools of realistic fake users and messages for the security sector
const FAKE_USERS = [
  { id: -1, username: "mehmet_k",    displayName: "Mehmet",   color: "#94a3b8" },
  { id: -2, username: "ayse_g",      displayName: "Ayse",     color: "#a78bfa" },
  { id: -3, username: "ali_demir",   displayName: "Ali",      color: "#94a3b8" },
  { id: -4, username: "fatma_y",     displayName: "Fatma",    color: "#f9a8d4" },
  { id: -5, username: "hasan_b",     displayName: "Hasan",    color: "#94a3b8" },
  { id: -6, username: "zeynep_a",    displayName: "Zeynep",   color: "#67e8f9" },
  { id: -7, username: "ibrahim_s",   displayName: "Ibrahim",  color: "#94a3b8" },
  { id: -8, username: "selin_c",     displayName: "Selin",    color: "#86efac" },
];

// Standalone messages (just a random comment)
const STANDALONE_MSGS = [
  "Bugün yeni bir ilan gördüm, oldukça iyi görünüyor.",
  "Bu sektörde tecrübe çok önemli, en az 2 yıl şart gibi görünüyor.",
  "Maaşlar geçen yıla göre biraz arttı, güzel.",
  "Vardiyalı çalışmak zor ama alışılıyor.",
  "Silahlı güvenlik lisansı almak istiyorum, nasıl yapılıyor acaba?",
  "İstanbul dışı ilanlar da artık daha fazla, umut verici.",
  "Şirketler yaz döneminde daha fazla personel alıyor genellikle.",
  "Sertifika kurslarının ücreti biraz yüksek bence.",
  "AVM güvenliği mi yoksa site güvenliği mi daha avantajlı?",
  "Gece vardiyası zam farkı hangi şirkette en yüksek acaba?",
  "Emekli olduktan sonra da bu sektörde çalışabilirsiniz, talep var.",
  "İlanlara başvururken CV'nizi güncel tutun.",
  "Kıyafet yardımı yapan şirketler tercih edilmeli.",
  "İşe başlamadan önce mutlaka sözleşmeyi okuyun.",
  "Güvenlik kamerası sistemleri konusunda eğitim alan önde gidiyor.",
];

// Conversation pairs: A says something, B responds shortly after
const CONV_PAIRS: { a: string; b: string; delay: number }[] = [
  { a: "Bu ay kaç ilan çıktı acaba?", b: "Epey fazla, özellikle İstanbul ilanları artmış.", delay: 25000 },
  { a: "Silahlı güvenlik maaşları ne kadar?", b: "Genellikle 25-35 bin TL arasında, şirkete göre değişiyor.", delay: 30000 },
  { a: "AVM güvenliği deneyimli mi arıyor?", b: "Çoğu yer 1 yıl tecrübe istiyor, bazıları deneyimsiz de alıyor.", delay: 20000 },
  { a: "Sertifika almak için kurs kaç para?", b: "MEB onaylı kurslar 3-5 bin TL civarı, fiyatlar değişiyor.", delay: 28000 },
  { a: "Gece vardiyası zammı ne kadar oluyor?", b: "Yasal olarak yüzde 25 zam hakkınız var, bazı firmalar daha fazla veriyor.", delay: 22000 },
  { a: "İstanbul'da hangi ilçelerde ilan var?", b: "Kadıköy, Şişli, Ataşehir çok ilanlar var, Anadolu yakası da iyi.", delay: 18000 },
  { a: "Yeni başlayanlar için hangi pozisyon uygun?", b: "Site güvenliği veya iş merkezi güvenliği daha uygun başlangıç.", delay: 26000 },
  { a: "Emekli maaşı alırken çalışabilir miyim?", b: "Evet, SGDP kesintisi olur ama çalışabilirsiniz.", delay: 32000 },
];

function makeFakeMsg(user: typeof FAKE_USERS[0], content: string): object {
  return {
    id: Date.now() + Math.random(),
    content,
    userId: user.id,
    username: user.username,
    displayName: user.displayName,
    userAvatarUrl: null,
    userNameColor: user.color,
    userNameAnimated: false,
    userRole: "user",
    replyToId: null,
    replyToUsername: null,
    replyToContent: null,
    isPinned: false,
    mentions: [],
    createdAt: new Date().toISOString(),
    isFake: true,
  };
}

function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function scheduleFakeConversation() {
  // Random interval 45 - 150 seconds
  const delay = 45000 + Math.random() * 105000;
  setTimeout(() => {
    const roll = Math.random();
    if (roll < 0.4) {
      // Standalone single message
      const user = getRandomItem(FAKE_USERS);
      const msg = getRandomItem(STANDALONE_MSGS);
      io.emit("chat:message", makeFakeMsg(user, msg));
    } else {
      // Conversation pair
      const pair = getRandomItem(CONV_PAIRS);
      const userA = getRandomItem(FAKE_USERS);
      let userB = getRandomItem(FAKE_USERS);
      while (userB.id === userA.id) userB = getRandomItem(FAKE_USERS);

      io.emit("chat:message", makeFakeMsg(userA, pair.a));
      setTimeout(() => {
        io.emit("chat:message", makeFakeMsg(userB, pair.b));
      }, pair.delay);
    }
    scheduleFakeConversation();
  }, delay);
}

const WELCOME_RULES = `Hoş geldiniz! Topluluk Kuralları:
1. Saygılı ve nazik olun
2. Spam ve reklam yapmayın
3. Kişisel bilgilerinizi paylaşmayın
4. Hakaret ve küfür kesinlikle yasak
5. İş ilanları için doğru kategoriyi kullanın

İyi sohbetler dileriz!`;

// ── Socket.io ─────────────────────────────────────────────────────
io.on("connection", (socket) => {
  const socketId = socket.id;
  onlineSockets.set(socketId, { joinedAt: new Date() });
  logger.info({ socketId, online: onlineSockets.size }, "Socket connected");
  io.emit("online_count", { count: onlineSockets.size });

  socket.on("authenticate", async (data: { userId?: number }) => {
    if (data?.userId) {
      const entry = onlineSockets.get(socketId);
      if (entry) { entry.userId = data.userId; onlineSockets.set(socketId, entry); }
      try {
        const [user] = await db.select({ username: usersTable.username, displayName: usersTable.displayName })
          .from(usersTable).where(eq(usersTable.id, data.userId)).limit(1);
        if (user) {
          io.emit("chat:join", { username: user.displayName || user.username });
          socket.emit("chat:welcome", { message: WELCOME_RULES });
        }
      } catch { /* ignore */ }
    }
  });

  socket.on("disconnect", () => {
    onlineSockets.delete(socketId);
    logger.info({ socketId, online: onlineSockets.size }, "Socket disconnected");
    io.emit("online_count", { count: onlineSockets.size });
  });
});

// Start loops after warmup
setTimeout(() => scheduleBotMessage(), 2 * 60 * 1000);
setTimeout(() => scheduleFakeConversation(), 30000); // Start fake chat after 30s

httpServer.listen(port, (err?: Error) => {
  if (err) { logger.error({ err }, "Error listening on port"); process.exit(1); }
  logger.info({ port }, "Server listening");
});

import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import app from "./app";
import { logger } from "./lib/logger";
import { onlineSockets } from "./routes/chat";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const httpServer = createServer(app);

const io = new SocketIOServer(httpServer, {
  path: "/ws",
  cors: { origin: "*", methods: ["GET", "POST"] },
});

// Make io accessible in route handlers
app.set("io", io);

// ── Bot system ──────────────────────────────────────────────────
const BOT_USER = {
  id: 0,
  username: "GuvenlikBot",
  userRole: "bot",
  userAvatarUrl: null,
  userNameColor: "#06B6D4",
  userNameAnimated: false,
  isBot: true,
};

function makeBotMsg(content: string) {
  return {
    ...BOT_USER,
    id: Date.now(),
    content,
    replyToId: null,
    replyToUsername: null,
    replyToContent: null,
    isPinned: false,
    mentions: [],
    createdAt: new Date().toISOString(),
  };
}

const BOT_MESSAGES = [
  "Güvenlik sektöründe kariyer yapmak isteyenler için yüzlerce ilan mevcut! 💼",
  "Yeni üyelerimize hoş geldiniz! Soru ve sorunlarınız için destek menüsünü kullanabilirsiniz.",
  "İlanlarınızı öne çıkarmak için admin panelini kullanabilirsiniz.",
  "Topluluk kurallarına uymayı unutmayın — saygılı bir ortam herkese faydalı olur.",
  "Güvenlik sektöründeki son haberler ve ilanlar için bizi takip etmeye devam edin!",
  "Herhangi bir sorun yaşıyorsanız Destek menüsünden bize ulaşabilirsiniz.",
  "Özel güvenlik sertifikası almak isteyenler için eğitim ilanlarımıza göz atın!",
];

let botMsgIndex = 0;
function scheduleBotMessage() {
  const delay = 4 * 60 * 1000 + Math.random() * 6 * 60 * 1000; // 4-10 min
  setTimeout(() => {
    const content = BOT_MESSAGES[botMsgIndex % BOT_MESSAGES.length]!;
    botMsgIndex++;
    io.emit("chat:message", makeBotMsg(content));
    scheduleBotMessage();
  }, delay);
}

const WELCOME_RULES = `Hoş geldiniz! 🛡️ Topluluk Kuralları:
1. Saygılı ve nazik olun
2. Spam ve reklam yapmayın
3. Kişisel bilgilerinizi paylaşmayın
4. Hakaret ve küfür kesinlikle yasak
5. İş ilanları için doğru kategoriyi kullanın

İyi sohbetler dileriz!`;

// ── Socket.io connection handling ────────────────────────────────
io.on("connection", (socket) => {
  const socketId = socket.id;
  onlineSockets.set(socketId, { joinedAt: new Date() });
  logger.info({ socketId, online: onlineSockets.size }, "Socket connected");

  io.emit("online_count", { count: onlineSockets.size });

  socket.on("authenticate", async (data: { userId?: number }) => {
    if (data?.userId) {
      const entry = onlineSockets.get(socketId);
      if (entry) {
        entry.userId = data.userId;
        onlineSockets.set(socketId, entry);
      }

      try {
        const [user] = await db.select({ username: usersTable.username })
          .from(usersTable).where(eq(usersTable.id, data.userId)).limit(1);

        if (user) {
          // Broadcast join notification to all
          io.emit("chat:join", { username: user.username });

          // Send private welcome + rules only to this socket
          socket.emit("chat:welcome", {
            message: WELCOME_RULES,
          });
        }
      } catch {
        // ignore DB errors for socket auth
      }
    }
  });

  socket.on("disconnect", () => {
    onlineSockets.delete(socketId);
    logger.info({ socketId, online: onlineSockets.size }, "Socket disconnected");
    io.emit("online_count", { count: onlineSockets.size });
  });
});

// Start bot message loop after 2 min warmup
setTimeout(() => scheduleBotMessage(), 2 * 60 * 1000);

httpServer.listen(port, (err?: Error) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, "Server listening");
});

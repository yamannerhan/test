import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import app from "./app";
import { logger } from "./lib/logger";
import { onlineSockets } from "./routes/chat";

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

io.on("connection", (socket) => {
  const socketId = socket.id;
  onlineSockets.set(socketId, { joinedAt: new Date() });
  logger.info({ socketId, online: onlineSockets.size }, "Socket connected");

  // Broadcast updated online count
  io.emit("online_count", { count: onlineSockets.size });

  socket.on("authenticate", (data: { userId?: number }) => {
    if (data?.userId) {
      const entry = onlineSockets.get(socketId);
      if (entry) {
        entry.userId = data.userId;
        onlineSockets.set(socketId, entry);
      }
    }
  });

  socket.on("disconnect", () => {
    onlineSockets.delete(socketId);
    logger.info({ socketId, online: onlineSockets.size }, "Socket disconnected");
    io.emit("online_count", { count: onlineSockets.size });
  });
});

httpServer.listen(port, (err?: Error) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, "Server listening");
});

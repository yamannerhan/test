import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, Maximize2, Zap, Bot, Shield, Star } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Link, useLocation } from "wouter";
import { io, Socket } from "socket.io-client";
import type { ChatMessage } from "@workspace/api-client-react";

function getToken() { return localStorage.getItem("auth_token") ?? ""; }
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

interface SystemMsg { id: number; type: "join" | "welcome"; text: string; createdAt: string; }
type AnyMsg = (ChatMessage & { isBot?: boolean }) | SystemMsg;
function isSystem(m: AnyMsg): m is SystemMsg { return "type" in m; }

/* ── Role badge ─────────────────────────────────────────── */
function RoleBadge({ role }: { role: string }) {
  if (role === "admin") {
    return (
      <span
        className="inline-flex items-center gap-0.5 text-[8px] font-black px-1.5 py-0.5 rounded-full ml-1 shrink-0"
        style={{
          background: "linear-gradient(90deg,#ef4444,#f97316,#ef4444)",
          backgroundSize: "200% 100%",
          animation: "role-slide 2s linear infinite",
          color: "#fff",
          boxShadow: "0 0 8px rgba(239,68,68,0.6)",
        }}
      >
        <Shield className="w-2 h-2 inline" />
        YÖNETİCİ
      </span>
    );
  }
  if (role === "moderator") {
    return (
      <span
        className="inline-flex items-center gap-0.5 text-[8px] font-black px-1.5 py-0.5 rounded-full ml-1 shrink-0"
        style={{
          background: "linear-gradient(90deg,#3b82f6,#06b6d4,#3b82f6)",
          backgroundSize: "200% 100%",
          animation: "role-slide 2.5s linear infinite",
          color: "#fff",
          boxShadow: "0 0 8px rgba(59,130,246,0.6)",
        }}
      >
        <Star className="w-2 h-2 inline" />
        MODERATÖR
      </span>
    );
  }
  return (
    <span className="text-[8px] font-medium text-white/25 ml-1 shrink-0">Üye</span>
  );
}

/* ── User avatar ─────────────────────────────────────────── */
function UserAvatar({ src, username, role }: { src?: string | null; username: string; role: string }) {
  const ringColor =
    role === "admin" ? "rgba(239,68,68,0.8)" :
    role === "moderator" ? "rgba(59,130,246,0.8)" :
    "rgba(255,255,255,0.12)";

  return (
    <div
      className="w-7 h-7 rounded-full shrink-0 overflow-hidden flex items-center justify-center text-[10px] font-bold text-white"
      style={{
        boxShadow: `0 0 0 2px ${ringColor}`,
        background: src ? "transparent" : "linear-gradient(135deg,#4F46E5,#7C3AED)",
        flexShrink: 0,
      }}
    >
      {src ? (
        <img src={src} alt={username} className="w-full h-full object-cover" />
      ) : (
        username.substring(0, 2).toUpperCase()
      )}
    </div>
  );
}

export function ChatBubble() {
  const { user } = useAuth();
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<AnyMsg[]>([]);
  const [content, setContent] = useState("");
  const [socket, setSocket] = useState<Socket | null>(null);
  const [unread, setUnread] = useState(0);
  const [sending, setSending] = useState(false);
  const [pulse, setPulse] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isOnChatPage = location === "/sohbet";

  const addMsg = useCallback((msg: AnyMsg) => {
    setMessages(prev => [...prev.slice(-59), msg]);
    setPulse(true);
    setTimeout(() => setPulse(false), 600);
  }, []);

  useEffect(() => {
    fetch("/api/chat/messages?limit=30", {
      headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : {},
    })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setMessages(data.slice(-30)); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const s = io({ path: "/ws" });
    setSocket(s);
    if (user?.id) s.emit("authenticate", { userId: user.id });

    s.on("chat:message", (msg: ChatMessage) => {
      addMsg(msg);
      if (!open) setUnread(n => n + 1);
    });
    s.on("chat:delete", ({ id }: { id: number }) => {
      setMessages(prev => prev.filter(m => !isSystem(m) && (m as ChatMessage).id !== id));
    });
    s.on("chat:join", ({ username }: { username: string }) => {
      addMsg({ id: Date.now(), type: "join", text: `${username} sohbete katıldı`, createdAt: new Date().toISOString() });
    });
    s.on("chat:welcome", ({ message }: { message: string }) => {
      addMsg({ id: Date.now() + 1, type: "welcome", text: message, createdAt: new Date().toISOString() });
    });
    return () => { s.disconnect(); };
  }, [user?.id]);

  useEffect(() => {
    if (open) {
      setUnread(0);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
    }
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, [messages.length]);

  const sendMsg = async () => {
    if (!content.trim() || !user || sending) return;
    setSending(true);
    try {
      await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ content: content.trim() }),
      });
      setContent("");
    } catch {} finally { setSending(false); }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMsg(); }
  };

  if (isOnChatPage) return null;

  return (
    <>
      {/* role-slide keyframe injected inline */}
      <style>{`
        @keyframes role-slide {
          0%   { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
      `}</style>

      {/* Floating button */}
      <motion.button
        onClick={() => setOpen(o => !o)}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.94 }}
        animate={pulse && !open ? { scale: [1, 1.15, 1] } : {}}
        transition={{ duration: 0.3 }}
        className="fixed bottom-24 right-4 z-50 w-14 h-14 rounded-2xl shadow-2xl flex items-center justify-center"
        style={{
          background: "linear-gradient(135deg,#4F46E5,#7C3AED)",
          boxShadow: "0 8px 32px rgba(79,70,229,0.5), 0 0 0 1px rgba(255,255,255,0.1)",
        }}
      >
        <AnimatePresence mode="wait">
          {open ? (
            <motion.div key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.18 }}>
              <X className="w-5 h-5 text-white" />
            </motion.div>
          ) : (
            <motion.div key="chat" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.18 }} className="relative">
              <MessageCircle className="w-6 h-6 text-white" />
              {unread > 0 && (
                <motion.span
                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                  className="absolute -top-2 -right-2 min-w-[18px] h-[18px] bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center px-1 border-2 border-background"
                >
                  {unread > 9 ? "9+" : unread}
                </motion.span>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.92 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="fixed bottom-[calc(6rem+56px)] right-4 z-50 w-[22rem] flex flex-col rounded-3xl overflow-hidden"
            style={{
              background: "rgba(15,23,42,0.97)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 32px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(79,70,229,0.2)",
              maxHeight: 500,
            }}
          >
            {/* Header */}
            <div
              className="flex items-center gap-3 px-4 py-3.5 shrink-0"
              style={{ background: "linear-gradient(135deg,rgba(79,70,229,0.9),rgba(124,58,237,0.9))", borderBottom: "1px solid rgba(255,255,255,0.08)" }}
            >
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <MessageCircle className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-sm leading-tight">Topluluk Sohbeti</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  <p className="text-white/60 text-[10px]">Canlı</p>
                </div>
              </div>
              <Link href="/sohbet" onClick={() => setOpen(false)}
                className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors mr-1" title="Tam ekranda aç">
                <Maximize2 className="w-3 h-3 text-white/70" />
              </Link>
              <button onClick={() => setOpen(false)}
                className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
                <X className="w-3.5 h-3.5 text-white/70" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5 min-h-0" style={{ maxHeight: 360 }}>
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-24 gap-2">
                  <MessageCircle className="w-8 h-8 text-white/10" />
                  <p className="text-xs text-muted-foreground">Henüz mesaj yok.</p>
                </div>
              ) : (
                messages.map(msg => {
                  /* ─── System messages ─── */
                  if (isSystem(msg)) {
                    return (
                      <motion.div key={msg.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="flex justify-center">
                        {msg.type === "join" ? (
                          <div className="flex items-center gap-1.5 bg-green-500/10 border border-green-500/20 text-green-400 text-[10px] font-medium px-3 py-1 rounded-full">
                            <Zap className="w-2.5 h-2.5" />
                            {msg.text}
                          </div>
                        ) : (
                          <div className="w-full bg-primary/10 border border-primary/20 rounded-2xl p-3 text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed">
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <Bot className="w-3 h-3 text-primary" />
                              <span className="text-[10px] font-bold text-primary">GuvenlikBot · Hoş Geldiniz</span>
                            </div>
                            {msg.text}
                          </div>
                        )}
                      </motion.div>
                    );
                  }

                  const chatMsg = msg as ChatMessage & { isBot?: boolean };
                  const isMe = user?.id === chatMsg.userId;
                  const isBot = chatMsg.isBot || chatMsg.userId === 0;

                  /* ─── Bot message ─── */
                  if (isBot) {
                    return (
                      <motion.div key={chatMsg.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-2">
                        <div className="w-7 h-7 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center shrink-0">
                          <Bot className="w-3.5 h-3.5 text-cyan-400" />
                        </div>
                        <div className="max-w-[82%] bg-cyan-500/10 border border-cyan-500/20 rounded-2xl rounded-tl-sm px-3 py-2 text-xs">
                          <div className="flex items-center gap-1 mb-0.5">
                            <span className="text-[9px] font-bold text-cyan-400">GuvenlikBot</span>
                            <span className="text-[8px] text-cyan-400/50">· Bot</span>
                          </div>
                          <p className="break-words text-foreground/90 leading-relaxed">{chatMsg.content}</p>
                          <p className="text-[9px] text-white/25 mt-0.5">{formatTime(chatMsg.createdAt)}</p>
                        </div>
                      </motion.div>
                    );
                  }

                  /* ─── Regular user message ─── */
                  return (
                    <motion.div
                      key={chatMsg.id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex items-end gap-2 ${isMe ? "flex-row-reverse" : "flex-row"}`}
                    >
                      {/* Avatar — always shown */}
                      <UserAvatar
                        src={chatMsg.userAvatarUrl}
                        username={chatMsg.username}
                        role={chatMsg.userRole ?? "user"}
                      />

                      {/* Bubble */}
                      <div className={`flex flex-col max-w-[75%] ${isMe ? "items-end" : "items-start"}`}>
                        {/* Name row — shown for everyone (including "me") */}
                        <div className="flex items-center flex-wrap gap-0.5 mb-1 px-1">
                          {isMe ? (
                            <span className="text-[9px] font-bold text-white/40">Sen</span>
                          ) : (
                            <>
                              <span
                                className={`text-[10px] font-bold leading-tight ${chatMsg.userNameAnimated ? "animate-rainbow" : ""}`}
                                style={chatMsg.userNameColor && !chatMsg.userNameAnimated ? { color: chatMsg.userNameColor } : !chatMsg.userNameColor && !chatMsg.userNameAnimated ? { color: "#94a3b8" } : {}}
                              >
                                {chatMsg.username}
                              </span>
                              <RoleBadge role={chatMsg.userRole ?? "user"} />
                            </>
                          )}
                        </div>

                        {/* Bubble body */}
                        <div
                          className={`rounded-2xl px-3 py-2 text-xs ${isMe ? "rounded-br-sm text-white" : "rounded-bl-sm"}`}
                          style={
                            isMe
                              ? { background: "linear-gradient(135deg,#4F46E5,#7C3AED)" }
                              : { background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.06)" }
                          }
                        >
                          <p className="break-words leading-relaxed">{chatMsg.content}</p>
                          <p className={`text-[9px] mt-0.5 ${isMe ? "text-white/40" : "text-white/25"}`}>{formatTime(chatMsg.createdAt)}</p>
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              {!user ? (
                <Link href="/giris" onClick={() => setOpen(false)}
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-xs font-bold text-white"
                  style={{ background: "linear-gradient(135deg,#4F46E5,#7C3AED)" }}>
                  <MessageCircle className="w-3.5 h-3.5" />
                  Giriş yap ve mesaj gönder
                </Link>
              ) : (
                <div className="flex gap-2 items-center">
                  <input
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    onKeyDown={handleKey}
                    placeholder="Bir şeyler yaz..."
                    maxLength={500}
                    className="flex-1 rounded-xl px-3 py-2.5 text-xs text-foreground placeholder:text-white/30 focus:outline-none"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
                  />
                  <motion.button
                    onClick={sendMsg}
                    disabled={!content.trim() || sending}
                    whileTap={{ scale: 0.9 }}
                    className="w-9 h-9 rounded-xl flex items-center justify-center disabled:opacity-30 shrink-0 transition-opacity"
                    style={{ background: "linear-gradient(135deg,#4F46E5,#7C3AED)" }}
                  >
                    <Send className="w-3.5 h-3.5 text-white" />
                  </motion.button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

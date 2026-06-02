import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Maximize2, Bot, Shield, Star, MessageSquareDot } from "lucide-react";
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
  if (role === "admin") return (
    <span className="text-[8px] font-semibold tracking-wide" style={{ color: "rgba(248,113,113,0.75)" }}>admin</span>
  );
  if (role === "moderator") return (
    <span className="text-[8px] font-semibold tracking-wide" style={{ color: "rgba(96,165,250,0.75)" }}>mod</span>
  );
  return (
    <span className="text-[8px] font-medium" style={{ color: "rgba(148,163,184,0.45)" }}>üye</span>
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

/* ── Cool floating button icon ───────────────────────────── */
function ChatIcon({ unread, pulse }: { unread: number; pulse: boolean }) {
  return (
    <div className="relative flex items-center justify-center w-full h-full">
      {/* Glow ring */}
      <motion.div
        animate={pulse ? { scale: [1, 1.6, 1], opacity: [0.5, 0, 0] } : { scale: 1, opacity: 0 }}
        transition={{ duration: 0.6 }}
        className="absolute inset-0 rounded-2xl"
        style={{ background: "radial-gradient(circle,rgba(79,70,229,0.8),transparent)" }}
      />
      {/* Icon layers */}
      <div className="relative">
        <MessageSquareDot className="w-6 h-6 text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.6)]" />
        {/* live indicator dot */}
        <span
          className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#4F46E5] bg-green-400"
          style={{ boxShadow: "0 0 6px rgba(74,222,128,0.8)" }}
        />
      </div>
      {/* Unread badge */}
      {unread > 0 && (
        <motion.span
          initial={{ scale: 0 }} animate={{ scale: 1 }}
          className="absolute -top-2 -right-2 min-w-[18px] h-[18px] bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center px-1 border-2 border-[#4F46E5]"
          style={{ boxShadow: "0 0 8px rgba(239,68,68,0.7)" }}
        >
          {unread > 9 ? "9+" : unread}
        </motion.span>
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
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
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
    s.on("chat:clear", () => {
      setMessages([]);
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

  const startCooldown = (seconds: number) => {
    setCooldownLeft(seconds);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setCooldownLeft(prev => {
        if (prev <= 1) { clearInterval(cooldownRef.current!); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const sendMsg = async () => {
    if (!content.trim() || !user || sending || cooldownLeft > 0) return;
    setSending(true);
    try {
      const r = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ content: content.trim() }),
      });
      if (r.status === 429) {
        const data = await r.json().catch(() => ({})) as { waitSeconds?: number };
        startCooldown(data.waitSeconds ?? 3);
        return;
      }
      if (r.ok) setContent("");
    } catch {} finally { setSending(false); }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMsg(); }
  };

  if (isOnChatPage) return null;

  return (
    <>
      <style>{`
        @keyframes role-slide {
          0%   { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
        @keyframes bubble-glow {
          0%, 100% { box-shadow: 0 8px 32px rgba(79,70,229,0.5), 0 0 0 1px rgba(255,255,255,0.1); }
          50% { box-shadow: 0 8px 40px rgba(124,58,237,0.7), 0 0 0 1px rgba(255,255,255,0.15), 0 0 0 4px rgba(79,70,229,0.15); }
        }
      `}</style>

      {/* Floating button */}
      <motion.button
        onClick={() => setOpen(o => !o)}
        whileHover={{ scale: 1.08, rotate: open ? 0 : 5 }}
        whileTap={{ scale: 0.92 }}
        animate={pulse && !open ? { scale: [1, 1.18, 1] } : {}}
        transition={{ duration: 0.3 }}
        className="fixed bottom-24 right-4 z-50 w-14 h-14 rounded-2xl flex items-center justify-center"
        style={{
          background: open
            ? "linear-gradient(135deg,#1E293B,#334155)"
            : "linear-gradient(135deg,#4F46E5,#7C3AED,#4F46E5)",
          backgroundSize: "200% 200%",
          animation: open ? "none" : "bubble-glow 3s ease-in-out infinite",
        }}
      >
        <AnimatePresence mode="wait">
          {open ? (
            <motion.div key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.18 }}>
              <X className="w-5 h-5 text-white" />
            </motion.div>
          ) : (
            <motion.div key="chat" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.18 }}>
              <ChatIcon unread={unread} pulse={pulse} />
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
                <MessageSquareDot className="w-4 h-4 text-white" />
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
                  <MessageSquareDot className="w-8 h-8 text-white/10" />
                  <p className="text-xs text-muted-foreground">Henüz mesaj yok.</p>
                </div>
              ) : (
                messages.map(msg => {
                  /* ─── System messages ─── */
                  if (isSystem(msg)) {
                    return (
                      <motion.div key={msg.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="flex justify-center">
                        {msg.type === "join" ? (
                          <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-medium px-3 py-1 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
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
                      <UserAvatar
                        src={chatMsg.userAvatarUrl}
                        username={chatMsg.username}
                        role={chatMsg.userRole ?? "user"}
                      />
                      <div className={`flex flex-col max-w-[75%] ${isMe ? "items-end" : "items-start"}`}>
                        <div className="flex flex-col mb-1 px-1">
                          {isMe ? (
                            <span className="text-[9px] font-bold text-white/40">Sen</span>
                          ) : (
                            <>
                              <span
                                className={`text-[10px] font-bold leading-tight ${chatMsg.userNameAnimated ? "animate-rainbow" : ""}`}
                                style={chatMsg.userNameColor && !chatMsg.userNameAnimated ? { color: chatMsg.userNameColor } : !chatMsg.userNameColor && !chatMsg.userNameAnimated ? { color: "#94a3b8" } : {}}
                              >
                                {(chatMsg as any).displayName || chatMsg.username}
                              </span>
                              <RoleBadge role={chatMsg.userRole ?? "user"} />
                            </>
                          )}
                        </div>
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
                  <MessageSquareDot className="w-3.5 h-3.5" />
                  Giriş yap ve mesaj gönder
                </Link>
              ) : (
                <div className="space-y-1.5">
                  {cooldownLeft > 0 && (
                    <div className="flex items-center gap-1.5 px-1">
                      <div className="h-0.5 flex-1 bg-white/10 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-amber-400"
                          initial={{ width: "100%" }}
                          animate={{ width: "0%" }}
                          transition={{ duration: cooldownLeft, ease: "linear" }}
                        />
                      </div>
                      <span className="text-[10px] text-amber-400 font-bold shrink-0">{cooldownLeft}s</span>
                    </div>
                  )}
                  <div className="flex gap-2 items-center">
                    <input
                      value={content}
                      onChange={e => setContent(e.target.value)}
                      onKeyDown={handleKey}
                      placeholder={cooldownLeft > 0 ? `${cooldownLeft}s bekle...` : "Bir şeyler yaz..."}
                      disabled={cooldownLeft > 0}
                      maxLength={500}
                      className="flex-1 rounded-xl px-3 py-2.5 text-xs text-foreground placeholder:text-white/30 focus:outline-none disabled:opacity-50"
                      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
                    />
                    <motion.button
                      onClick={sendMsg}
                      disabled={!content.trim() || sending || cooldownLeft > 0}
                      whileTap={{ scale: 0.9 }}
                      className="w-9 h-9 rounded-xl flex items-center justify-center disabled:opacity-30 shrink-0 transition-opacity"
                      style={{ background: "linear-gradient(135deg,#4F46E5,#7C3AED)" }}
                    >
                      <Send className="w-3.5 h-3.5 text-white" />
                    </motion.button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

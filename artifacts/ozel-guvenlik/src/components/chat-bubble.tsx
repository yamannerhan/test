import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, Maximize2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Link, useLocation } from "wouter";
import { io, Socket } from "socket.io-client";
import type { ChatMessage } from "@workspace/api-client-react";

function getToken() {
  return localStorage.getItem("auth_token") ?? "";
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

export function ChatBubble() {
  const { user } = useAuth();
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [content, setContent] = useState("");
  const [socket, setSocket] = useState<Socket | null>(null);
  const [unread, setUnread] = useState(0);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isOnChatPage = location === "/sohbet";

  // Load initial messages
  useEffect(() => {
    fetch("/api/chat/messages?limit=30", {
      headers: user ? { Authorization: `Bearer ${getToken()}` } : {},
    })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setMessages(data.slice(-30)); })
      .catch(() => {});
  }, []);

  // Socket.io
  useEffect(() => {
    const s = io({ path: "/ws" });
    setSocket(s);
    s.on("chat:message", (msg: ChatMessage) => {
      setMessages(prev => [...prev.slice(-49), msg]);
      if (!open) setUnread(n => n + 1);
    });
    s.on("chat:delete", ({ id }: { id: number }) => {
      setMessages(prev => prev.filter(m => m.id !== id));
    });
    return () => { s.disconnect(); };
  }, []);

  useEffect(() => {
    if (open) {
      setUnread(0);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
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
      {/* Bubble button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-24 right-[4.5rem] z-50 w-[52px] h-[52px] rounded-full shadow-xl flex items-center justify-center transition-all"
        style={{ background: "linear-gradient(135deg,#06B6D4,#0891B2)" }}
      >
        <AnimatePresence mode="wait">
          {open ? (
            <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }}>
              <X className="w-5 h-5 text-white" />
            </motion.div>
          ) : (
            <motion.div key="open" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.2 }} className="relative">
              <MessageCircle className="w-5 h-5 text-white" />
              {unread > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </button>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed bottom-[calc(6rem+52px)] right-4 z-50 w-80 flex flex-col rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
            style={{ background: "#1E293B", maxHeight: 460 }}
          >
            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 shrink-0"
              style={{ background: "linear-gradient(135deg,#06B6D4,#0891B2)" }}>
              <MessageCircle className="w-5 h-5 text-white shrink-0" />
              <div className="flex-1">
                <p className="text-white font-bold text-sm leading-tight">Topluluk Sohbeti</p>
                <p className="text-white/70 text-[10px]">Canlı mesajlaşma</p>
              </div>
              <Link href="/sohbet" onClick={() => setOpen(false)}
                className="text-white/70 hover:text-white mr-2" title="Tam ekranda aç">
                <Maximize2 className="w-3.5 h-3.5" />
              </Link>
              <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0" style={{ maxHeight: 320 }}>
              {messages.length === 0 ? (
                <p className="text-xs text-center text-muted-foreground py-4">Henüz mesaj yok.</p>
              ) : (
                messages.map(msg => {
                  const isMe = user?.id === msg.userId;
                  return (
                    <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[85%] rounded-2xl px-3 py-1.5 text-xs ${
                        isMe
                          ? "text-white rounded-br-sm"
                          : "bg-white/10 text-foreground rounded-bl-sm"
                      }`} style={isMe ? { background: "linear-gradient(135deg,#4F46E5,#7C3AED)" } : {}}>
                        {!isMe && (
                          <p className={`text-[9px] font-bold mb-0.5 ${msg.userNameAnimated ? "animate-rainbow" : ""}`}
                            style={msg.userNameColor && !msg.userNameAnimated ? { color: msg.userNameColor } : { color: "#94a3b8" }}>
                            {msg.username}
                            {msg.userRole === "admin" && <span className="ml-1 text-red-400">[Admin]</span>}
                            {msg.userRole === "moderator" && <span className="ml-1 text-blue-400">[Mod]</span>}
                          </p>
                        )}
                        <p className="break-words leading-relaxed">{msg.content}</p>
                        <p className={`text-[9px] mt-0.5 ${isMe ? "text-white/50" : "text-muted-foreground"}`}>{formatTime(msg.createdAt)}</p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 border-t border-white/10 shrink-0">
              {!user ? (
                <Link href="/giris" onClick={() => setOpen(false)}
                  className="block w-full text-center py-2 rounded-xl text-xs font-semibold text-white"
                  style={{ background: "linear-gradient(135deg,#06B6D4,#0891B2)" }}>
                  Mesaj göndermek için giriş yap
                </Link>
              ) : (
                <div className="flex gap-2">
                  <input
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    onKeyDown={handleKey}
                    placeholder="Mesaj yaz..."
                    maxLength={500}
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent/50"
                  />
                  <button onClick={sendMsg} disabled={!content.trim() || sending}
                    className="w-9 h-9 rounded-xl flex items-center justify-center disabled:opacity-40 shrink-0"
                    style={{ background: "linear-gradient(135deg,#06B6D4,#0891B2)" }}>
                    <Send className="w-3.5 h-3.5 text-white" />
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

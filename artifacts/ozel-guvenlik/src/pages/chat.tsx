import React, { useEffect, useState, useRef, useCallback } from "react";
import { useGetChatMessages } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { useAuth } from "@/contexts/AuthContext";
import { io, Socket } from "socket.io-client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, X, Bot, Zap, CornerUpLeft } from "lucide-react";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import type { ChatMessage } from "@workspace/api-client-react";

function getToken() { return localStorage.getItem("auth_token") ?? ""; }

interface SystemMsg { id: number; type: "join" | "welcome"; text: string; createdAt: string; }
type ExtMsg = ChatMessage & { displayName?: string | null; isFake?: boolean };
type AnyMsg = ExtMsg | SystemMsg;
function isSystem(m: AnyMsg): m is SystemMsg { return "type" in m; }

interface UserSuggestion { id: number; username: string; displayName?: string | null; avatarUrl: string | null; role: string; }

/* ── Role badge ─────────────────────────────────────────────── */
function RoleBadge({ role }: { role: string }) {
  if (role === "admin") return (
    <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full ml-1"
      style={{ background: "linear-gradient(90deg,#ef4444,#f97316)", color: "#fff", boxShadow: "0 0 6px rgba(239,68,68,0.5)" }}>
      YÖNETİCİ
    </span>
  );
  if (role === "moderator") return (
    <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full ml-1"
      style={{ background: "linear-gradient(90deg,#3b82f6,#06b6d4)", color: "#fff", boxShadow: "0 0 6px rgba(59,130,246,0.5)" }}>
      MODERATÖR
    </span>
  );
  return <span className="text-[9px] text-white/30 ml-1">Üye</span>;
}

/* ── Swipeable row ────────────────────────────────────────────── */
function SwipeableMessage({ children, onReply }: { children: React.ReactNode; onReply: () => void }) {
  const x = useMotionValue(0);
  const opacity = useTransform(x, [0, 60], [0, 1]);
  const touchStartX = useRef(0);
  const swiped = useRef(false);
  return (
    <div className="relative"
      onTouchStart={e => { touchStartX.current = e.touches[0]!.clientX; swiped.current = false; }}
      onTouchMove={e => { const dx = e.touches[0]!.clientX - touchStartX.current; if (dx > 0) x.set(Math.min(dx, 80)); }}
      onTouchEnd={() => { if (x.get() >= 60 && !swiped.current) { swiped.current = true; onReply(); } x.set(0); }}
    >
      <motion.div style={{ opacity }} className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-7 h-7 rounded-full bg-primary flex items-center justify-center pointer-events-none z-10">
        <CornerUpLeft className="w-3.5 h-3.5 text-white" />
      </motion.div>
      <motion.div style={{ x }}>{children}</motion.div>
    </div>
  );
}

export default function Chat() {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [replyTo, setReplyTo] = useState<ExtMsg | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [, setSocket] = useState<Socket | null>(null);
  const [messages, setMessages] = useState<AnyMsg[]>([]);
  const [sending, setSending] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<UserSuggestion[]>([]);

  const { data: initialData, isLoading } = useGetChatMessages({ limit: 50 });

  useEffect(() => { if (initialData) setMessages([...initialData as ExtMsg[]]); }, [initialData]);

  const addMsg = useCallback((msg: AnyMsg) => {
    setMessages(prev => [...prev, msg]);
    setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
  }, []);

  useEffect(() => {
    const s = io({ path: "/ws" });
    setSocket(s);
    if (user?.id) s.emit("authenticate", { userId: user.id });
    s.on("chat:message", (msg: ExtMsg) => addMsg(msg));
    s.on("chat:delete", ({ id }: { id: number }) => {
      setMessages(prev => prev.filter(m => isSystem(m) || (m as ExtMsg).id !== id));
    });
    s.on("chat:join", ({ username }: { username: string }) => {
      addMsg({ id: Date.now(), type: "join", text: `${username} sohbete katıldı`, createdAt: new Date().toISOString() });
    });
    s.on("chat:welcome", ({ message }: { message: string }) => {
      addMsg({ id: Date.now() + 1, type: "welcome", text: message, createdAt: new Date().toISOString() });
    });
    return () => { s.disconnect(); };
  }, [user?.id]);

  useEffect(() => { setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: "instant" }), 100); }, [isLoading]);

  // @ mention search
  useEffect(() => {
    if (mentionQuery === null) { setSuggestions([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(mentionQuery)}`);
        if (res.ok) setSuggestions(await res.json());
      } catch {}
    }, 120);
    return () => clearTimeout(t);
  }, [mentionQuery]);

  const handleInputChange = (val: string) => {
    setContent(val);
    const lastAt = val.lastIndexOf("@");
    if (lastAt !== -1) {
      const after = val.slice(lastAt + 1);
      if (!after.includes(" ")) { setMentionQuery(after); return; }
    }
    setMentionQuery(null);
  };

  const insertMention = (username: string) => {
    const lastAt = content.lastIndexOf("@");
    setContent(content.slice(0, lastAt) + `@${username} `);
    setMentionQuery(null);
    setSuggestions([]);
    inputRef.current?.focus();
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !user || sending) return;
    setSending(true);
    try {
      await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ content: content.trim(), replyToId: replyTo?.id }),
      });
      setContent("");
      setReplyTo(null);
      setMentionQuery(null);
    } catch {} finally { setSending(false); }
  };

  // Show displayName (first name) if available, otherwise username
  function chatName(msg: ExtMsg): string {
    return (msg as any).displayName || msg.username;
  }

  const renderMsg = (msg: AnyMsg) => {
    if (isSystem(msg)) {
      if (msg.type === "join") return (
        <motion.div key={msg.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="flex justify-center my-1">
          <div className="flex items-center gap-1.5 bg-green-500/10 border border-green-500/20 text-green-400 text-[10px] font-semibold px-3 py-1 rounded-full">
            <Zap className="w-2.5 h-2.5" />{msg.text}
          </div>
        </motion.div>
      );
      return (
        <motion.div key={msg.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="my-2 px-2">
          <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4 text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
            <div className="flex items-center gap-2 mb-2">
              <Bot className="w-4 h-4 text-primary" />
              <span className="text-xs font-bold text-primary">GuvenlikBot · Hoş Geldiniz!</span>
            </div>
            {msg.text}
          </div>
        </motion.div>
      );
    }

    const chatMsg = msg as ExtMsg;
    const isBot = (chatMsg as any).isBot || chatMsg.userId === 0;
    const isMe = !isBot && user?.id === chatMsg.userId;
    const name = chatName(chatMsg);

    if (isBot) return (
      <motion.div key={chatMsg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-2 group px-2">
        <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center shrink-0 mt-5">
          <Bot className="w-4 h-4 text-cyan-400" />
        </div>
        <div className="flex flex-col items-start">
          <div className="flex items-center gap-1 mb-1 ml-1">
            <span className="text-[10px] font-bold text-cyan-400">GuvenlikBot</span>
            <span className="text-[8px] text-cyan-400/50">· Bot</span>
          </div>
          <div className="bg-cyan-500/10 border border-cyan-500/20 px-4 py-2.5 rounded-2xl rounded-bl-sm text-sm max-w-[80%]">
            <p className="break-words text-foreground/90">{chatMsg.content}</p>
            <p className="text-[10px] text-muted-foreground mt-1">{new Date(chatMsg.createdAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}</p>
          </div>
        </div>
      </motion.div>
    );

    return (
      <SwipeableMessage key={chatMsg.id} onReply={() => setReplyTo(chatMsg)}>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className={`flex px-2 ${isMe ? "justify-end" : "justify-start"} group`}>
          <div className={`flex max-w-[85%] ${isMe ? "flex-row-reverse" : "flex-row"} items-end gap-2`}>
            {/* Avatar */}
            <div className="w-8 h-8 rounded-full shrink-0 overflow-hidden flex items-center justify-center text-[10px] font-bold text-white"
              style={{
                boxShadow: chatMsg.userRole === "admin" ? "0 0 0 2px rgba(239,68,68,0.7)" : chatMsg.userRole === "moderator" ? "0 0 0 2px rgba(59,130,246,0.7)" : "0 0 0 2px rgba(255,255,255,0.1)",
                background: chatMsg.userAvatarUrl ? "transparent" : "linear-gradient(135deg,#4F46E5,#7C3AED)",
                flexShrink: 0,
              }}>
              {chatMsg.userAvatarUrl
                ? <img src={chatMsg.userAvatarUrl} alt={name} className="w-full h-full object-cover" />
                : name.substring(0, 2).toUpperCase()}
            </div>

            <div className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
              {/* Name */}
              <div className="flex items-center flex-wrap gap-0.5 mb-1 px-1">
                {isMe ? (
                  <span className="text-[9px] text-white/30">Sen</span>
                ) : (
                  <>
                    <span className={`text-[10px] font-bold leading-tight ${chatMsg.userNameAnimated ? "animate-rainbow" : ""}`}
                      style={chatMsg.userNameColor && !chatMsg.userNameAnimated ? { color: chatMsg.userNameColor } : !chatMsg.userNameColor && !chatMsg.userNameAnimated ? { color: "#94a3b8" } : {}}>
                      {name}
                    </span>
                    <RoleBadge role={chatMsg.userRole ?? "user"} />
                  </>
                )}
              </div>

              {/* Bubble */}
              <div className={`relative rounded-2xl px-4 py-2.5 text-sm shadow-sm ${isMe ? "text-white rounded-br-sm" : "glass-card rounded-bl-sm"}`}
                style={isMe ? { background: "linear-gradient(135deg,#4F46E5,#7C3AED)" } : {}}>
                {chatMsg.replyToId && (
                  <div className={`mb-2 pl-2 border-l-2 text-xs opacity-70 ${isMe ? "border-white/50" : "border-primary"}`}>
                    <div className="font-medium">{chatMsg.replyToUsername}</div>
                    <div className="line-clamp-1">{chatMsg.replyToContent}</div>
                  </div>
                )}
                <p className="break-words leading-relaxed">
                  {chatMsg.content.split(/(@\w+)/g).map((part, i) =>
                    part.startsWith("@")
                      ? <span key={i} className="text-accent font-semibold">{part}</span>
                      : <span key={i}>{part}</span>
                  )}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[10px] ${isMe ? "text-white/40" : "text-white/30"}`}>
                    {new Date(chatMsg.createdAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <button onClick={() => setReplyTo(chatMsg)}
                    className="text-[10px] text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity hidden sm:inline-flex items-center gap-0.5">
                    <CornerUpLeft className="w-2.5 h-2.5" /> Yanıtla
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </SwipeableMessage>
    );
  };

  return (
    <Layout>
      <div className="flex flex-col h-[calc(100vh-7rem)] bg-background relative">
        <div className="flex-1 overflow-y-auto py-4 space-y-3 pb-36">
          {isLoading ? (
            <div className="flex justify-center items-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">Henüz mesaj yok. İlk mesajı sen gönder!</div>
          ) : (
            messages.map(msg => renderMsg(msg))
          )}
          <div ref={scrollRef} />
        </div>

        <div className="absolute bottom-0 left-0 right-0 bg-background/90 backdrop-blur-xl border-t border-white/10 p-4">
          {!user ? (
            <div className="text-center py-2 text-sm text-muted-foreground">
              Mesaj yazmak için <a href="/giris" className="text-primary font-medium">giriş yapmanız</a> gerekiyor.
            </div>
          ) : (
            <form onSubmit={handleSend} className="max-w-lg mx-auto relative">
              {/* @ suggestions */}
              <AnimatePresence>
                {mentionQuery !== null && suggestions.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                    className="absolute bottom-full left-0 right-0 mb-2 glass-card rounded-2xl overflow-hidden border border-white/10 shadow-xl">
                    {suggestions.map(s => (
                      <button key={s.id} type="button" onClick={() => insertMention(s.username)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors text-left">
                        <div className="w-7 h-7 rounded-full shrink-0 overflow-hidden flex items-center justify-center text-[10px] font-bold text-white"
                          style={{ background: s.avatarUrl ? "transparent" : "linear-gradient(135deg,#4F46E5,#7C3AED)" }}>
                          {s.avatarUrl ? <img src={s.avatarUrl} alt={s.username} className="w-full h-full object-cover" /> : s.username.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <span className="text-sm font-medium">{s.displayName || s.username}</span>
                          {s.displayName && <span className="text-[10px] text-muted-foreground ml-1">@{s.username}</span>}
                        </div>
                        <RoleBadge role={s.role} />
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Reply preview */}
              <AnimatePresence>
                {replyTo && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                    className="absolute bottom-full left-0 right-0 mb-2 p-3 glass-card rounded-xl text-xs flex justify-between items-start border border-white/10">
                    <div className="pl-2 border-l-2 border-primary">
                      <div className="font-semibold text-primary mb-0.5">{chatName(replyTo)} ↩</div>
                      <div className="line-clamp-1 text-foreground/70">{replyTo.content}</div>
                    </div>
                    <button type="button" onClick={() => setReplyTo(null)} className="p-1 text-muted-foreground hover:text-foreground ml-2 shrink-0">
                      <X className="w-4 h-4" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex space-x-2">
                <Input
                  ref={inputRef}
                  value={content}
                  onChange={e => handleInputChange(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && mentionQuery === null) { e.preventDefault(); handleSend(e as any); } }}
                  placeholder={replyTo ? `${chatName(replyTo)}'e yanıtla...` : "Mesajınızı yazın... (@ ile etiketle)"}
                  className="glass-card border-white/10 rounded-full h-12 px-5 text-sm"
                  maxLength={500}
                  autoComplete="off"
                />
                <Button type="submit" disabled={!content.trim() || sending}
                  className="rounded-full w-12 h-12 shrink-0 bg-gradient-to-r from-primary to-secondary text-white shadow-lg">
                  {sending ? <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" /> : <Send className="w-5 h-5" />}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </Layout>
  );
}

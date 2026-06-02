import React, { useEffect, useState, useRef, useCallback } from "react";
import { useGetChatMessages } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { useAuth } from "@/contexts/AuthContext";
import { io, Socket } from "socket.io-client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Reply, X, Bot, Zap } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { motion, AnimatePresence } from "framer-motion";
import type { ChatMessage } from "@workspace/api-client-react";

function getToken() { return localStorage.getItem("auth_token") ?? ""; }

interface SystemMsg { id: number; type: "join" | "welcome"; text: string; createdAt: string; }
type AnyMsg = (ChatMessage & { isBot?: boolean }) | SystemMsg;
function isSystem(m: AnyMsg): m is SystemMsg { return "type" in m; }

export default function Chat() {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [messages, setMessages] = useState<AnyMsg[]>([]);
  const [sending, setSending] = useState(false);

  const { data: initialData, isLoading } = useGetChatMessages({ limit: 50 });

  useEffect(() => {
    if (initialData) setMessages([...initialData]);
  }, [initialData]);

  const addMsg = useCallback((msg: AnyMsg) => {
    setMessages(prev => [...prev, msg]);
    setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
  }, []);

  useEffect(() => {
    const s = io({ path: "/ws" });
    setSocket(s);

    if (user?.id) s.emit("authenticate", { userId: user.id });

    s.on("chat:message", (msg: ChatMessage) => addMsg(msg));

    s.on("chat:delete", ({ id }: { id: number }) => {
      setMessages(prev => prev.filter(m => !isSystem(m) && m.id !== id));
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
    setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: "instant" }), 100);
  }, [isLoading]);

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
    } catch {} finally { setSending(false); }
  };

  const renderMsg = (msg: AnyMsg, i: number) => {
    if (isSystem(msg)) {
      if (msg.type === "join") {
        return (
          <motion.div key={msg.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="flex justify-center my-1">
            <div className="flex items-center gap-1.5 bg-green-500/10 border border-green-500/20 text-green-400 text-[10px] font-semibold px-3 py-1 rounded-full">
              <Zap className="w-2.5 h-2.5" />
              {msg.text}
            </div>
          </motion.div>
        );
      }
      return (
        <motion.div key={msg.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="my-2">
          <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4 text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed max-w-[85%] mx-auto">
            <div className="flex items-center gap-2 mb-2">
              <Bot className="w-4 h-4 text-primary" />
              <span className="text-xs font-bold text-primary">GuvenlikBot · Hoş Geldiniz!</span>
            </div>
            {msg.text}
          </div>
        </motion.div>
      );
    }

    const chatMsg = msg as ChatMessage & { isBot?: boolean };
    const isMe = user?.id === chatMsg.userId;
    const isBot = chatMsg.isBot || chatMsg.userId === 0;

    if (isBot) {
      return (
        <motion.div key={chatMsg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start group">
          <div className="flex items-end gap-2 max-w-[85%]">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="bg-cyan-500/10 border border-cyan-500/20 px-4 py-2.5 rounded-2xl rounded-bl-sm text-sm">
              <p className="text-[10px] font-bold text-cyan-400 mb-0.5">GuvenlikBot</p>
              <p className="break-words text-foreground/90">{chatMsg.content}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{new Date(chatMsg.createdAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}</p>
            </div>
          </div>
        </motion.div>
      );
    }

    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        key={chatMsg.id}
        className={`flex ${isMe ? "justify-end" : "justify-start"} group`}
      >
        <div className={`flex max-w-[85%] ${isMe ? "flex-row-reverse" : "flex-row"} items-end gap-2`}>
          {!isMe && (
            <Avatar className="w-8 h-8 shrink-0 border border-white/10">
              <AvatarImage src={chatMsg.userAvatarUrl || undefined} />
              <AvatarFallback className="bg-primary/20 text-xs">
                {chatMsg.username.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          )}
          <div className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
            {!isMe && (
              <div className="flex items-center gap-1 mb-1 ml-1">
                <span
                  className={`text-xs font-bold ${chatMsg.userNameAnimated ? "animate-rainbow" : ""}`}
                  style={chatMsg.userNameColor && !chatMsg.userNameAnimated ? { color: chatMsg.userNameColor } : { color: "#94a3b8" }}
                >
                  {chatMsg.username}
                </span>
                {chatMsg.userRole === "admin" && (
                  <span className="text-[9px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full border border-red-500/30 font-black">A</span>
                )}
                {chatMsg.userRole === "moderator" && (
                  <span className="text-[9px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-full border border-blue-500/30 font-black">M</span>
                )}
              </div>
            )}
            <div className={`relative px-4 py-2.5 rounded-2xl text-sm shadow-sm ${
              isMe
                ? "text-white rounded-br-sm"
                : "glass-card rounded-bl-sm"
            }`} style={isMe ? { background: "linear-gradient(135deg,#4F46E5,#7C3AED)" } : {}}>
              {chatMsg.replyToId && (
                <div className={`mb-2 pl-2 border-l-2 text-xs opacity-70 ${isMe ? "border-white/50" : "border-primary"}`}>
                  <div className="font-medium">{chatMsg.replyToUsername}</div>
                  <div className="line-clamp-1">{chatMsg.replyToContent}</div>
                </div>
              )}
              <div className="break-words">
                {chatMsg.content.split(' ').map((word: string, wi: number) =>
                  word.startsWith('@') ? (
                    <span key={wi} className="text-accent font-medium">{word} </span>
                  ) : (
                    <span key={wi}>{word} </span>
                  )
                )}
              </div>
            </div>
            <div className="flex items-center mt-1 gap-2">
              <span className="text-[10px] text-muted-foreground">
                {new Date(chatMsg.createdAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
              </span>
              {!isMe && (
                <button
                  onClick={() => setReplyTo(chatMsg)}
                  className="text-[10px] text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  Yanıtla
                </button>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <Layout>
      <div className="flex flex-col h-[calc(100vh-7rem)] bg-background relative">
        <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-32">
          {isLoading ? (
            <div className="flex justify-center items-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">Henüz mesaj yok. İlk mesajı sen gönder!</div>
          ) : (
            messages.map((msg, i) => renderMsg(msg, i))
          )}
          <div ref={scrollRef} />
        </div>

        <div className="absolute bottom-0 left-0 right-0 bg-background/90 backdrop-blur-xl border-t border-white/10 p-4">
          {!user ? (
            <div className="text-center py-2 text-sm text-muted-foreground">
              Mesaj yazmak için <a href="/giris" className="text-primary font-medium">giriş yapmanız</a> gerekiyor.
            </div>
          ) : (
            <form onSubmit={handleSend} className="max-w-md mx-auto relative">
              <AnimatePresence>
                {replyTo && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                    className="absolute bottom-full left-0 right-0 mb-2 p-2 glass-card rounded-xl text-xs flex justify-between items-start"
                  >
                    <div className="pl-2 border-l-2 border-primary">
                      <div className="font-medium text-muted-foreground">Yanıtlanıyor: {replyTo.username}</div>
                      <div className="line-clamp-1 text-foreground">{replyTo.content}</div>
                    </div>
                    <button type="button" onClick={() => setReplyTo(null)} className="p-1 text-muted-foreground hover:text-foreground">
                      <X className="w-4 h-4" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="flex space-x-2">
                <Input
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder="Mesajınızı yazın..."
                  className="glass-card border-white/10 rounded-full h-12 px-6"
                  maxLength={500}
                />
                <Button
                  type="submit"
                  disabled={!content.trim() || sending}
                  className="rounded-full w-12 h-12 shrink-0 bg-gradient-to-r from-primary to-secondary text-white shadow-lg"
                >
                  <Send className="w-5 h-5" />
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </Layout>
  );
}

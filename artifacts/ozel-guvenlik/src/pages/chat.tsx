import React, { useEffect, useState, useRef } from "react";
import { useGetChatMessages, useSendChatMessage, getGetChatMessagesQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { useAuth } from "@/contexts/AuthContext";
import { io, Socket } from "socket.io-client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Reply, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { motion, AnimatePresence } from "framer-motion";
import type { ChatMessage } from "@workspace/api-client-react";

export default function Chat() {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const queryClient = useQueryClient();

  const { data: initialData, isLoading } = useGetChatMessages({ limit: 50 });
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const sendMsg = useSendChatMessage();
  
  useEffect(() => {
    if (initialData) {
      setMessages([...initialData]);
    }
  }, [initialData]);

  useEffect(() => {
    const s = io({ path: "/ws" });
    setSocket(s);

    s.on("chat:message", (msg: ChatMessage) => {
      setMessages(prev => [...prev, msg]);
      setTimeout(() => {
        scrollRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    });

    s.on("chat:delete", ({ id }) => {
      setMessages(prev => prev.filter(m => m.id !== id));
    });

    return () => {
      s.disconnect();
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "instant" });
  }, [messages.length > 0 && !socket]); // Only on initial load

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !user) return;

    try {
      await sendMsg.mutateAsync({
        data: {
          content: content.trim(),
          replyToId: replyTo?.id
        }
      });
      setContent("");
      setReplyTo(null);
    } catch (error) {
      console.error(error);
    }
  };

  const handleReply = (msg: ChatMessage) => {
    setReplyTo(msg);
  };

  return (
    <Layout>
      <div className="flex flex-col h-[calc(100vh-7rem)] bg-background relative">
        <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-32">
          {isLoading ? (
            <div className="flex justify-center items-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              Henüz mesaj yok. İlk mesajı sen gönder!
            </div>
          ) : (
            messages.map((msg, i) => {
              const isMe = user?.id === msg.userId;
              
              return (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={msg.id}
                  className={`flex ${isMe ? "justify-end" : "justify-start"} group`}
                >
                  <div className={`flex max-w-[85%] ${isMe ? "flex-row-reverse" : "flex-row"} items-end`}>
                    {!isMe && (
                      <Avatar className="w-8 h-8 mr-2 shrink-0 border border-white/10">
                        <AvatarImage src={msg.userAvatarUrl || undefined} />
                        <AvatarFallback className="bg-primary/20 text-xs">
                          {msg.username.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    
                    <div className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                      {!isMe && (
                        <div className="flex items-center space-x-1 mb-1 ml-1">
                          <span 
                            className={`text-xs font-medium ${msg.userNameAnimated ? "animate-rainbow" : ""}`}
                            style={msg.userNameColor && !msg.userNameAnimated ? { color: msg.userNameColor } : {}}
                          >
                            {msg.username}
                          </span>
                          {msg.userRole === "admin" && (
                            <span className="text-[9px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full border border-red-500/30">
                              Admin
                            </span>
                          )}
                        </div>
                      )}

                      <div className={`relative px-4 py-2.5 rounded-2xl text-sm shadow-sm
                        ${isMe 
                          ? "bg-primary text-primary-foreground rounded-br-sm" 
                          : "glass-card rounded-bl-sm"}
                      `}>
                        {msg.replyToId && (
                          <div className={`mb-2 pl-2 border-l-2 text-xs opacity-70 ${isMe ? "border-primary-foreground/50" : "border-primary"}`}>
                            <div className="font-medium">{msg.replyToUsername}</div>
                            <div className="line-clamp-1">{msg.replyToContent}</div>
                          </div>
                        )}
                        
                        <div className="break-words">
                          {msg.content.split(' ').map((word: string, i: number) => 
                            word.startsWith('@') ? (
                              <span key={i} className="text-accent font-medium">{word} </span>
                            ) : (
                              <span key={i}>{word} </span>
                            )
                          )}
                        </div>
                      </div>

                      <div className="flex items-center mt-1 space-x-2">
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(msg.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {!isMe && (
                          <button 
                            onClick={() => handleReply(msg)}
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
            })
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
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute bottom-full left-0 right-0 mb-2 p-2 glass-card rounded-xl text-xs flex justify-between items-start"
                  >
                    <div className="pl-2 border-l-2 border-primary">
                      <div className="font-medium text-muted-foreground">Yanıtlanıyor: {replyTo.username}</div>
                      <div className="line-clamp-1 text-foreground">{replyTo.content}</div>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => setReplyTo(null)}
                      className="p-1 text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="flex space-x-2">
                <Input
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Mesajınızı yazın..."
                  className="glass-card border-white/10 rounded-full h-12 px-6"
                  maxLength={500}
                />
                <Button 
                  type="submit" 
                  disabled={!content.trim() || sendMsg.isPending}
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

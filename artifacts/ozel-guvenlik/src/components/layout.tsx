import React, { useState, useEffect } from "react";
import { BottomNav } from "./bottom-nav";
import { ChatBubble } from "./chat-bubble";
import { PwaInstall } from "./pwa-install";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "wouter";
import { Bell } from "lucide-react";
import {
  useGetOnlineCount, getGetOnlineCountQueryKey,
  useGetUnreadNotificationCount, getGetUnreadNotificationCountQueryKey,
} from "@workspace/api-client-react";
import { io as socketIo } from "socket.io-client";

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, isModerator } = useAuth();
  const { data: onlineData } = useGetOnlineCount({
    query: { queryKey: getGetOnlineCountQueryKey(), refetchInterval: 60000 }
  });
  const [liveCount, setLiveCount] = useState<number | null>(null);

  const { data: unreadData } = useGetUnreadNotificationCount({
    query: {
      queryKey: getGetUnreadNotificationCountQueryKey(),
      enabled: !!user,
      refetchInterval: 30000,
    }
  });
  const unreadCount = user ? (unreadData?.count ?? 0) : 0;

  useEffect(() => {
    const socket = socketIo({ path: "/ws", transports: ["websocket"] });
    socket.on("online_count", (data: { count: number }) => {
      setLiveCount(data.count);
    });
    return () => { socket.disconnect(); };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <header className="sticky top-0 z-40 bg-background/90 backdrop-blur-xl border-b border-white/10 shadow-[0_2px_24px_rgba(79,70,229,0.15)]">
        <div className="flex items-center justify-between px-4 h-14 max-w-md mx-auto">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="relative w-9 h-9 shrink-0">
              <img
                src="/logo.png"
                alt="ÖZEL GÜVENLİK"
                className="w-full h-full object-contain rounded-lg logo-glow-anim"
              />
            </div>
            <span className="flex flex-col leading-none">
              <span className="font-extrabold text-base tracking-tight logo-gradient animate-logo-glow">ÖzelGüvenlik</span>
              <span className="text-accent text-[10px] font-semibold tracking-widest">.Online</span>
            </span>
          </Link>

          <div className="flex items-center gap-2.5">
            <div className="flex items-center space-x-1.5 bg-green-500/10 border border-green-500/20 rounded-full px-2.5 py-1 text-xs font-semibold text-green-400">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span>{liveCount ?? onlineData?.count ?? 0} Online</span>
            </div>

            {isAdmin && (
              <Link href="/admin" className="text-xs font-bold text-destructive hover:text-destructive/80 bg-destructive/10 px-2.5 py-1 rounded-full border border-destructive/20 transition-colors">
                Admin
              </Link>
            )}
            {!isAdmin && isModerator && (
              <Link href="/moderator" className="text-xs font-bold text-amber-400 hover:text-amber-300 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20 transition-colors">
                Moderatör
              </Link>
            )}

            {/* Bildirim zili */}
            <Link href="/bildirimler" className="relative text-foreground hover:text-primary transition-colors">
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Link>

            {/* Profil avatarı */}
            <Link href={user ? `/profil/${user.username}` : "/giris"} className="shrink-0">
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.username}
                  className="w-8 h-8 rounded-full object-cover ring-2 ring-primary/40 hover:ring-primary transition-all"
                />
              ) : user ? (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-xs font-bold ring-2 ring-primary/30 hover:ring-primary/60 transition-all">
                  {user.username.slice(0, 1).toUpperCase()}
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center hover:bg-white/15 transition-all">
                  <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              )}
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto relative min-h-[calc(100vh-7rem)]">
        {children}
      </main>

      <BottomNav />
      <ChatBubble />
      <PwaInstall />
    </div>
  );
}

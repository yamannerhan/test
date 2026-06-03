import React from "react";
import { BottomNav } from "./bottom-nav";
import { ChatBubble } from "./chat-bubble";
import { PwaInstall } from "./pwa-install";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "wouter";
import { Bell } from "lucide-react";
import { useGetOnlineCount, getGetOnlineCountQueryKey } from "@workspace/api-client-react";

export function Layout({ children }: { children: React.ReactNode }) {
  const { isAdmin, isModerator } = useAuth();
  const { data: onlineData } = useGetOnlineCount({
    query: { queryKey: getGetOnlineCountQueryKey(), refetchInterval: 30000 }
  });

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
            <span className="font-extrabold text-base tracking-tight logo-gradient animate-logo-glow leading-tight">
              ÖzelGüvenlik<span className="text-accent text-[10px] font-semibold">.Online</span>
            </span>
          </Link>
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-1.5 bg-green-500/10 border border-green-500/20 rounded-full px-2.5 py-1 text-xs font-semibold text-green-400">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span>{onlineData?.count || 0} Online</span>
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
            <Link href="/bildirimler" className="relative text-foreground hover:text-primary transition-colors">
              <Bell className="w-5 h-5" />
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

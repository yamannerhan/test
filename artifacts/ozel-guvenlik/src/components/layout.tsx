import React from "react";
import { BottomNav } from "./bottom-nav";
import { SupportBubble } from "./support-bubble";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "wouter";
import { Bell, ShieldCheck } from "lucide-react";
import { useGetOnlineCount, getGetOnlineCountQueryKey } from "@workspace/api-client-react";

export function Layout({ children }: { children: React.ReactNode }) {
  const { isAdmin } = useAuth();
  const { data: onlineData } = useGetOnlineCount({
    query: { queryKey: getGetOnlineCountQueryKey(), refetchInterval: 30000 }
  });

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <header className="sticky top-0 z-40 bg-background/90 backdrop-blur-xl border-b border-white/10 shadow-[0_2px_24px_rgba(79,70,229,0.15)]">
        <div className="flex items-center justify-between px-4 h-14 max-w-md mx-auto">
          <Link href="/" className="flex items-center space-x-2 group">
            <div className="relative">
              <ShieldCheck className="w-7 h-7 text-primary drop-shadow-[0_0_8px_rgba(79,70,229,0.8)]" />
            </div>
            <span className="font-extrabold text-xl tracking-tight logo-gradient animate-logo-glow">
              ÖzelGüvenlik
            </span>
            <span className="text-[10px] font-semibold text-accent/80 tracking-widest uppercase hidden sm:block">.Online</span>
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
      <SupportBubble />
    </div>
  );
}

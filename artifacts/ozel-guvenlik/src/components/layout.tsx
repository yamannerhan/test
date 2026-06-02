import React from "react";
import { BottomNav } from "./bottom-nav";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "wouter";
import { Bell, ShieldAlert } from "lucide-react";
import { useGetOnlineCount, getGetOnlineCountQueryKey } from "@workspace/api-client-react";

export function Layout({ children }: { children: React.ReactNode }) {
  const { isAdmin } = useAuth();
  const { data: onlineData } = useGetOnlineCount({
    query: { queryKey: getGetOnlineCountQueryKey(), refetchInterval: 30000 }
  });

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-white/10">
        <div className="flex items-center justify-between px-4 h-14 max-w-md mx-auto">
          <Link href="/" className="flex items-center space-x-2">
            <ShieldAlert className="w-6 h-6 text-primary" />
            <span className="font-bold text-lg bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
              ÖzelGüvenlik
            </span>
          </Link>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1.5 text-xs font-medium text-muted-foreground">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span>{onlineData?.count || 0} Online</span>
            </div>
            {isAdmin && (
              <Link href="/admin" className="text-destructive hover:text-destructive/80 transition-colors">
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
    </div>
  );
}

import React from "react";
import { Link, useLocation } from "wouter";
import { Home, Search, MessageCircle, Headphones, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export function BottomNav() {
  const [location] = useLocation();
  const { user } = useAuth();

  const navItems = [
    { icon: Home, label: "Ana Sayfa", path: "/" },
    { icon: Search, label: "İlanlar", path: "/ilanlar" },
    { icon: MessageCircle, label: "Sohbet", path: "/sohbet" },
    { icon: Headphones, label: "Destek", path: "/destek" },
    {
      icon: User,
      label: "Profil",
      path: user ? `/profil/${user.username}` : "/giris"
    },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-t border-white/10 pb-safe">
      <div className="flex items-center justify-around h-16 max-w-md mx-auto px-4">
        {navItems.map((item) => {
          const isActive = location === item.path || (item.path !== "/" && location.startsWith(item.path));

          return (
            <Link
              key={item.path}
              href={item.path}
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-all duration-300 ${
                isActive ? "text-accent" : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid={`nav-${item.label.toLowerCase()}`}
            >
              <div className={`relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-300 ${
                isActive ? "bg-accent/20 shadow-[0_0_15px_rgba(6,182,212,0.3)]" : ""
              }`}>
                <item.icon className={`w-5 h-5 ${isActive ? "animate-pulse" : ""}`} />
              </div>
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

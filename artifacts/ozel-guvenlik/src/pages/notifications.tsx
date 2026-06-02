import React, { useEffect } from "react";
import { useGetNotifications, useMarkAllNotificationsRead, getGetNotificationsQueryKey, getGetUnreadNotificationCountQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { useAuth } from "@/contexts/AuthContext";
import { Redirect, Link } from "wouter";
import { motion } from "framer-motion";
import { Bell, Heart, MessageCircle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";

export default function Notifications() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const queryClient = useQueryClient();
  const markRead = useMarkAllNotificationsRead();

  const { data: notificationsData, isLoading } = useGetNotifications({
    query: {
      queryKey: getGetNotificationsQueryKey(),
      enabled: !!user
    }
  });

  const notifications = notificationsData || [];

  const handleMarkAllRead = async () => {
    try {
      await markRead.mutateAsync();
      queryClient.invalidateQueries({ queryKey: getGetNotificationsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetUnreadNotificationCountQueryKey() });
    } catch (e) {}
  };

  if (isAuthLoading) return null;
  if (!user) return <Redirect to="/giris" />;

  const getIcon = (type: string) => {
    switch (type) {
      case 'like': return <Heart className="w-5 h-5 text-red-500 fill-red-500" />;
      case 'reply': return <MessageCircle className="w-5 h-5 text-accent" />;
      default: return <Info className="w-5 h-5 text-primary" />;
    }
  };

  return (
    <Layout>
      <div className="p-4 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center">
            <Bell className="w-6 h-6 mr-2 text-primary" />
            Bildirimler
          </h1>
          {notifications.some(n => !n.isRead) && (
            <Button variant="ghost" size="sm" onClick={handleMarkAllRead} className="text-xs text-muted-foreground">
              Tümünü Okundu İşaretle
            </Button>
          )}
        </div>

        <div className="space-y-3">
          {isLoading ? (
            <div className="text-center text-muted-foreground py-10">Yükleniyor...</div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-12 glass-card rounded-2xl">
              <Bell className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">Henüz bildiriminiz yok</p>
            </div>
          ) : (
            notifications.map((notif, i) => (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                key={notif.id}
                className={`glass-card rounded-2xl p-4 flex items-start space-x-4 ${!notif.isRead ? 'bg-primary/5 ring-1 ring-primary/20' : ''}`}
              >
                <div className="mt-1 bg-white/5 p-2 rounded-full">
                  {getIcon(notif.type)}
                </div>
                <div className="flex-1">
                  <p className="text-sm text-foreground/90">{notif.message}</p>
                  <div className="mt-2 flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">
                      {new Date(notif.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {notif.linkUrl && (
                      <Link href={notif.linkUrl} className="text-xs text-accent font-medium hover:underline">
                        Görüntüle
                      </Link>
                    )}
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
}

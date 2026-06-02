import React, { useRef, useState } from "react";
import { useGetUserProfile, useGetListings, useLogout, getGetUserProfileQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { useParams, Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LogOut, MapPin, Briefcase, Camera, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";

function getToken() { return localStorage.getItem("auth_token") ?? ""; }

export default function Profile() {
  const { username } = useParams();
  const { user } = useAuth();
  const isMe = user?.username === username;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const logoutMutation = useLogout();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const { data: profile, isLoading } = useGetUserProfile(username || "", {
    query: {
      enabled: !!username,
      queryKey: getGetUserProfileQueryKey(username || ""),
    }
  });

  const { data: listingsData } = useGetListings({ page: 1, limit: 10 });
  const userListings = listingsData?.listings?.filter(l => l.authorUsername === username) || [];

  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
      localStorage.removeItem("auth_token");
      queryClient.clear();
      setLocation("/");
      toast({ title: "Çıkış yapıldı" });
    } catch {
      toast({ title: "Hata", variant: "destructive" });
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show local preview immediately
    const reader = new FileReader();
    reader.onload = ev => setAvatarPreview(ev.target?.result as string);
    reader.readAsDataURL(file);

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("avatar", file);

      const res = await fetch("/api/users/avatar", {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Yükleme başarısız");
      }

      await queryClient.invalidateQueries();
      toast({ title: "Profil resmi güncellendi" });
    } catch (err: any) {
      toast({ title: "Hata", description: err.message, variant: "destructive" });
      setAvatarPreview(null);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="p-4 flex justify-center mt-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </Layout>
    );
  }

  if (!profile) {
    return (
      <Layout>
        <div className="p-4 text-center mt-20">Kullanıcı bulunamadı.</div>
      </Layout>
    );
  }

  const displayAvatar = avatarPreview ?? (profile.avatarUrl || undefined);

  return (
    <Layout>
      <div className="p-4 space-y-6">
        <div className="glass-card p-6 rounded-3xl relative overflow-hidden flex flex-col items-center text-center">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/10 to-transparent pointer-events-none" />

          {isMe && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="absolute top-4 right-4 text-muted-foreground hover:text-destructive"
              data-testid="btn-logout"
            >
              <LogOut className="w-5 h-5" />
            </Button>
          )}

          {/* Avatar with upload button */}
          <div className="relative mb-4">
            <Avatar className="w-24 h-24 ring-4 ring-background shadow-xl">
              <AvatarImage src={displayAvatar} />
              <AvatarFallback className="text-2xl bg-gradient-to-br from-primary to-secondary">
                {profile.username.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>

            {isMe && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp,image/gif,image/bmp"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="absolute bottom-0 right-0 w-8 h-8 rounded-full flex items-center justify-center shadow-lg border-2 border-background transition-all hover:scale-110 active:scale-95"
                  style={{ background: "linear-gradient(135deg,#4F46E5,#7C3AED)" }}
                  title="Profil resmi değiştir"
                >
                  {uploading ? (
                    <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                  ) : (
                    <Camera className="w-3.5 h-3.5 text-white" />
                  )}
                </button>
              </>
            )}
          </div>

          <h1
            className={`text-2xl font-bold mb-1 ${profile.nameAnimated ? "animate-rainbow" : ""}`}
            style={profile.nameColor && !profile.nameAnimated ? { color: profile.nameColor } : {}}
          >
            {profile.username}
          </h1>

          <div className="flex items-center space-x-2 text-sm text-muted-foreground mb-4">
            <span className="capitalize">
              {profile.role === "admin" ? "Yönetici" : profile.role === "moderator" ? "Moderatör" : "Üye"}
            </span>
            <span>•</span>
            <span>Katılım: {new Date(profile.createdAt).toLocaleDateString("tr-TR", { month: "long", year: "numeric" })}</span>
          </div>

          {isMe && (
            <p className="text-[11px] text-white/30 mb-2">Profil resmi için kamera ikonuna tıklayın (jpg, png, webp, gif)</p>
          )}

          {profile.bio && (
            <p className="text-sm px-4 text-foreground/80">{profile.bio}</p>
          )}

          <div className="mt-6 flex space-x-6 text-center">
            <div>
              <div className="font-bold text-xl">{profile.listingCount || 0}</div>
              <div className="text-xs text-muted-foreground">İlan</div>
            </div>
            {isMe && (
              <div>
                <Link href="/favoriler">
                  <div className="font-bold text-xl text-accent">Favoriler</div>
                  <div className="text-xs text-muted-foreground">Görüntüle</div>
                </Link>
              </div>
            )}
          </div>
        </div>

        <div>
          <h2 className="text-lg font-bold mb-4">{isMe ? "Senin İlanların" : "İlanları"}</h2>
          <div className="space-y-4">
            {userListings.length === 0 ? (
              <div className="text-center p-8 glass-card rounded-2xl text-muted-foreground">
                İlan bulunmuyor.
              </div>
            ) : (
              userListings.map((listing, i) => (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  key={listing.id}
                  className="glass-card rounded-2xl p-4 relative"
                >
                  <Link href={`/ilan/${listing.id}`} className="block">
                    <h3 className="font-semibold text-base mb-1 line-clamp-1">{listing.title}</h3>
                    <p className="text-sm text-muted-foreground mb-3">{listing.company}</p>
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex space-x-3 text-muted-foreground">
                        <span className="flex items-center">
                          <MapPin className="w-3.5 h-3.5 mr-1" />
                          {listing.city}
                        </span>
                        <span className="flex items-center">
                          <Briefcase className="w-3.5 h-3.5 mr-1" />
                          {listing.workType}
                        </span>
                      </div>
                      <span className={`px-2 py-1 rounded font-medium ${listing.status === "active" ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"}`}>
                        {listing.status === "active" ? "Yayında" : "Bekliyor"}
                      </span>
                    </div>
                  </Link>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

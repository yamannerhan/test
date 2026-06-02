import React, { useState } from "react";
import { useGetListing, useToggleListingLike, useToggleListingFavorite, getGetListingQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { useParams, Link } from "wouter";
import { MapPin, Briefcase, Heart, Bookmark, Building, Calendar, ArrowLeft, Share2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";

export default function ListingDetail() {
  const { id } = useParams();
  const listingId = parseInt(id || "0", 10);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: listing, isLoading, isError } = useGetListing(listingId, {
    query: {
      enabled: !!listingId,
      queryKey: getGetListingQueryKey(listingId)
    }
  });

  const toggleLike = useToggleListingLike();
  const toggleFavorite = useToggleListingFavorite();

  const handleLike = async () => {
    if (!listing) return;
    try {
      const res = await toggleLike.mutateAsync({ id: listingId });
      queryClient.setQueryData(getGetListingQueryKey(listingId), (old: any) => 
        old ? { ...old, isLikedByMe: res.liked, likeCount: res.likeCount } : old
      );
    } catch (e) {
      toast({ title: "Hata", description: "Beğenirken bir hata oluştu.", variant: "destructive" });
    }
  };

  const handleFavorite = async () => {
    if (!listing) return;
    try {
      const res = await toggleFavorite.mutateAsync({ id: listingId });
      queryClient.setQueryData(getGetListingQueryKey(listingId), (old: any) => 
        old ? { ...old, isFavoritedByMe: res.favorited } : old
      );
      toast({ 
        title: res.favorited ? "Favorilere eklendi" : "Favorilerden çıkarıldı",
      });
    } catch (e) {
      toast({ title: "Hata", description: "İşlem başarısız.", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="p-4 space-y-4">
          <Skeleton className="h-8 w-1/4 mb-4" />
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      </Layout>
    );
  }

  if (isError || !listing) {
    return (
      <Layout>
        <div className="p-4 flex flex-col items-center justify-center min-h-[50vh] text-center">
          <AlertCircle className="w-12 h-12 text-destructive mb-4" />
          <h2 className="text-xl font-bold mb-2">İlan Bulunamadı</h2>
          <p className="text-muted-foreground mb-6">Bu ilan silinmiş veya yayından kaldırılmış olabilir.</p>
          <Link href="/ilanlar">
            <Button>İlanlara Dön</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="pb-24">
        <div className="sticky top-14 z-30 bg-background/80 backdrop-blur-md border-b border-white/10 px-4 py-3 flex items-center justify-between">
          <Link href="/ilanlar" className="flex items-center text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5 mr-1" />
            <span className="text-sm font-medium">Geri</span>
          </Link>
          <div className="flex space-x-2">
            <Button variant="ghost" size="icon" className="rounded-full h-8 w-8" onClick={handleFavorite}>
              <Bookmark className={`w-4 h-4 ${listing.isFavoritedByMe ? "fill-primary text-primary" : ""}`} />
            </Button>
            <Button variant="ghost" size="icon" className="rounded-full h-8 w-8" onClick={() => {
              if (navigator.share) {
                navigator.share({ title: listing.title, text: listing.company, url: window.location.href });
              }
            }}>
              <Share2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="p-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-3xl p-6 relative overflow-hidden">
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-primary/20 blur-3xl rounded-full pointer-events-none" />
            
            <div className="flex items-center space-x-4 mb-6">
              {listing.companyLogoUrl ? (
                <img src={listing.companyLogoUrl} alt={listing.company} className="w-16 h-16 rounded-xl object-cover bg-white/5" />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center text-xl font-bold">
                  {listing.company.charAt(0)}
                </div>
              )}
              <div>
                <h1 className="text-2xl font-bold leading-tight">{listing.title}</h1>
                <p className="text-primary font-medium mt-1">{listing.company}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-white/5 rounded-xl p-3 flex flex-col justify-center">
                <div className="flex items-center text-muted-foreground mb-1">
                  <MapPin className="w-4 h-4 mr-1.5" />
                  <span className="text-xs">Konum</span>
                </div>
                <span className="font-medium text-sm">{listing.city}</span>
              </div>
              <div className="bg-white/5 rounded-xl p-3 flex flex-col justify-center">
                <div className="flex items-center text-muted-foreground mb-1">
                  <Briefcase className="w-4 h-4 mr-1.5" />
                  <span className="text-xs">Çalışma Şekli</span>
                </div>
                <span className="font-medium text-sm">{listing.workType}</span>
              </div>
              {listing.salary && (
                <div className="bg-white/5 rounded-xl p-3 flex flex-col justify-center col-span-2">
                  <div className="flex items-center text-muted-foreground mb-1">
                    <Building className="w-4 h-4 mr-1.5" />
                    <span className="text-xs">Maaş Bilgisi</span>
                  </div>
                  <span className="font-medium text-sm text-green-400">{listing.salary}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground pt-4 border-t border-white/10">
              <div className="flex items-center space-x-4">
                <button onClick={handleLike} className="flex items-center space-x-1.5 hover:text-red-400 transition-colors">
                  <Heart className={`w-4 h-4 ${listing.isLikedByMe ? "fill-red-500 text-red-500" : ""}`} />
                  <span>{listing.likeCount}</span>
                </button>
                <div className="flex items-center space-x-1.5">
                  <span className="font-medium">{listing.viewCount}</span>
                  <span>Görüntülenme</span>
                </div>
              </div>
              <div className="flex items-center">
                <Calendar className="w-3.5 h-3.5 mr-1" />
                {new Date(listing.createdAt).toLocaleDateString('tr-TR')}
              </div>
            </div>
          </motion.div>

          {listing.description && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mt-6">
              <h3 className="text-lg font-bold mb-3 px-2">İş Tanımı</h3>
              <div className="glass-card rounded-2xl p-5 text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
                {listing.description}
              </div>
            </motion.div>
          )}

          {listing.requirements && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mt-6">
              <h3 className="text-lg font-bold mb-3 px-2">Aranan Nitelikler</h3>
              <div className="glass-card rounded-2xl p-5 text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
                {listing.requirements}
              </div>
            </motion.div>
          )}
        </div>

        <div className="fixed bottom-16 left-0 right-0 p-4 bg-gradient-to-t from-background via-background/90 to-transparent z-40">
          <div className="max-w-md mx-auto">
            {listing.applyUrl ? (
              <a href={listing.applyUrl} target="_blank" rel="noopener noreferrer" className="block">
                <Button className="w-full h-14 rounded-full text-base font-bold bg-gradient-to-r from-primary via-secondary to-accent shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all">
                  Hemen Başvur
                </Button>
              </a>
            ) : (
              <Button disabled className="w-full h-14 rounded-full text-base font-bold bg-white/10 text-muted-foreground border border-white/5">
                Başvuru Linki Yok
              </Button>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

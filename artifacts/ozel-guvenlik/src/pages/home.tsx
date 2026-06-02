import React, { useState, useEffect, useCallback } from "react";
import { useGetListings, useGetAnnouncements } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Briefcase, ChevronRight, Clock, Star, Calendar } from "lucide-react";

interface Banner {
  id: number;
  title: string | null;
  imageUrl: string;
  linkUrl: string | null;
}

function BannerCarousel({ banners }: { banners: Banner[] }) {
  const [current, setCurrent] = useState(0);

  const next = useCallback(() => {
    setCurrent(c => (c + 1) % banners.length);
  }, [banners.length]);

  useEffect(() => {
    if (banners.length < 2) return;
    const id = setInterval(next, 4000);
    return () => clearInterval(id);
  }, [next, banners.length]);

  if (banners.length === 0) return null;

  return (
    <div className="relative w-full overflow-hidden rounded-2xl" style={{ aspectRatio: "16/5" }}>
      <AnimatePresence mode="wait">
        <motion.div
          key={current}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          className="absolute inset-0"
        >
          {banners[current]!.linkUrl ? (
            <a href={banners[current]!.linkUrl!} target="_blank" rel="noopener noreferrer" className="block w-full h-full">
              <img
                src={banners[current]!.imageUrl}
                alt={banners[current]!.title ?? "Banner"}
                className="w-full h-full object-cover rounded-2xl"
              />
            </a>
          ) : (
            <img
              src={banners[current]!.imageUrl}
              alt={banners[current]!.title ?? "Banner"}
              className="w-full h-full object-cover rounded-2xl"
            />
          )}
          {banners[current]!.title && (
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent rounded-b-2xl px-4 py-3">
              <p className="text-white text-sm font-semibold">{banners[current]!.title}</p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {banners.length > 1 && (
        <>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
            {banners.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`h-1.5 rounded-full transition-all ${i === current ? "w-5 bg-white" : "w-1.5 bg-white/40"}`}
              />
            ))}
          </div>
          <button
            onClick={() => setCurrent(c => (c - 1 + banners.length) % banners.length)}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/40 text-white flex items-center justify-center z-10 hover:bg-black/60"
          >‹</button>
          <button
            onClick={next}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/40 text-white flex items-center justify-center z-10 hover:bg-black/60"
          >›</button>
        </>
      )}
    </div>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (mins < 1) return "Az önce";
  if (mins < 60) return `${mins} dk önce`;
  if (hours < 24) return `${hours} sa önce`;
  if (days < 7) return `${days} gün önce`;
  return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "short" });
}

function isExpiringSoon(expiresAt: string | null) {
  if (!expiresAt) return false;
  const exp = new Date(expiresAt);
  const diff = exp.getTime() - Date.now();
  return diff > 0 && diff < 3 * 24 * 60 * 60 * 1000;
}

export default function Home() {
  const { data: announcementsData } = useGetAnnouncements();
  const { data: listingsData, isLoading } = useGetListings({ limit: 10 });
  const [banners, setBanners] = useState<Banner[]>([]);
  const announcements = announcementsData || [];

  useEffect(() => {
    fetch("/api/banners")
      .then(r => r.json())
      .then(data => setBanners(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const featured = listingsData?.listings?.filter(l => l.isFeatured) ?? [];
  const recent = listingsData?.listings?.slice(0, 10) ?? [];

  return (
    <Layout>
      {announcements.length > 0 && (
        <div className="bg-primary/10 border-b border-primary/20 overflow-hidden relative h-9 flex items-center">
          <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
          <div
            className="whitespace-nowrap animate-ticker flex space-x-16 text-sm font-medium"
            style={{ color: "rgba(148,163,184,0.95)" }}
          >
            {[...announcements, ...announcements].map((a, i) => (
              <span key={i} className="inline-flex items-center gap-2">
                <span className="text-primary text-xs">◆</span>
                {a.content}
              </span>
            ))}
          </div>
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
        </div>
      )}

      {banners.length > 0 && (
        <div className="px-4 pt-4">
          <BannerCarousel banners={banners} />
        </div>
      )}

      <div className="p-4 space-y-6">
        {featured.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                <h2 className="text-base font-bold">Öne Çıkanlar</h2>
              </div>
              <Link href="/ilanlar?featured=true" className="text-xs text-accent flex items-center gap-0.5 font-medium">
                Tümü <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="flex overflow-x-auto pb-2 -mx-4 px-4 space-x-3 snap-x hide-scrollbar">
              {isLoading
                ? [1, 2, 3].map(i => (
                    <div key={i} className="min-w-[260px] h-[150px] glass-card rounded-2xl animate-pulse bg-white/5 snap-center" />
                  ))
                : featured.map((listing, i) => (
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.08 }}
                      key={listing.id}
                      className="min-w-[260px] glass-card rounded-2xl p-4 snap-center relative overflow-hidden group border-primary/20"
                    >
                      <div className="absolute top-2 right-2">
                        <span className="text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded-full">
                          ÖNE ÇIKAN
                        </span>
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-secondary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      <Link href={`/ilan/${listing.id}`} className="block relative z-10">
                        <h3 className="font-semibold text-sm line-clamp-2 pr-16">{listing.title}</h3>
                        <p className="text-muted-foreground text-xs mt-0.5 line-clamp-1">{listing.company}</p>
                        <div className="mt-3 flex items-center space-x-3 text-xs font-medium">
                          <div className="flex items-center text-accent">
                            <MapPin className="w-3 h-3 mr-1" />
                            {listing.city}
                          </div>
                          <div className="flex items-center text-muted-foreground">
                            <Briefcase className="w-3 h-3 mr-1" />
                            {listing.workType}
                          </div>
                        </div>
                        {listing.salary && (
                          <div className="mt-2">
                            <span className="text-[11px] font-semibold bg-primary/20 text-primary-foreground px-2 py-0.5 rounded-md">
                              {listing.salary}
                            </span>
                          </div>
                        )}
                        <div className="mt-2 flex items-center text-xs text-muted-foreground/60">
                          <Clock className="w-3 h-3 mr-1" />
                          {formatDate(listing.createdAt)}
                          {(listing as any).expiresAt && (
                            <span className={`ml-2 flex items-center gap-1 ${isExpiringSoon((listing as any).expiresAt) ? "text-amber-400" : ""}`}>
                              <Calendar className="w-3 h-3" />
                              {isExpiringSoon((listing as any).expiresAt) ? "Son günler!" : "Süreli ilan"}
                            </span>
                          )}
                        </div>
                      </Link>
                    </motion.div>
                  ))}
            </div>
          </section>
        )}

        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-1 h-5 bg-gradient-to-b from-primary to-secondary rounded-full" />
              <h2 className="text-base font-bold">Son İlanlar</h2>
            </div>
            <Link href="/ilanlar" className="text-xs text-accent flex items-center gap-0.5 font-medium">
              Tümü <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="space-y-3">
            {isLoading
              ? [1, 2, 3, 4].map(i => (
                  <div key={i} className="h-[110px] glass-card rounded-2xl animate-pulse bg-white/5" />
                ))
              : recent.map((listing, i) => (
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    key={listing.id}
                    className="glass-card rounded-2xl p-4 hover:border-primary/30 transition-all"
                  >
                    <Link href={`/ilan/${listing.id}`} className="block">
                      <div className="flex justify-between items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <h3 className="font-semibold text-sm line-clamp-1">{listing.title}</h3>
                            {listing.isFeatured && (
                              <Star className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-1">{listing.company}</p>
                        </div>
                        {listing.salary && (
                          <span className="text-[11px] font-semibold bg-primary/20 text-primary-foreground px-2 py-0.5 rounded-md shrink-0">
                            {listing.salary}
                          </span>
                        )}
                      </div>
                      <div className="mt-2.5 flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center">
                          <MapPin className="w-3 h-3 mr-1 text-accent" />
                          {listing.city}
                        </span>
                        <span className="flex items-center">
                          <Briefcase className="w-3 h-3 mr-1 text-secondary" />
                          {listing.workType}
                        </span>
                        <span className="flex items-center ml-auto">
                          <Clock className="w-3 h-3 mr-1" />
                          {formatDate(listing.createdAt)}
                        </span>
                      </div>
                      {(listing as any).expiresAt && (
                        <div className={`mt-1.5 flex items-center gap-1 text-[10px] font-medium ${isExpiringSoon((listing as any).expiresAt) ? "text-amber-400" : "text-muted-foreground/60"}`}>
                          <Calendar className="w-3 h-3" />
                          {isExpiringSoon((listing as any).expiresAt)
                            ? `Son: ${new Date((listing as any).expiresAt).toLocaleDateString("tr-TR")}`
                            : `Bitiş: ${new Date((listing as any).expiresAt).toLocaleDateString("tr-TR")}`}
                        </div>
                      )}
                    </Link>
                  </motion.div>
                ))}
          </div>
        </section>
      </div>
    </Layout>
  );
}

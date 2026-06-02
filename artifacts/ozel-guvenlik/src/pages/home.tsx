import React from "react";
import { useGetListings, useGetAnnouncements } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { MapPin, Briefcase, ChevronRight } from "lucide-react";

export default function Home() {
  const { data: announcementsData } = useGetAnnouncements();
  const { data: listingsData, isLoading } = useGetListings({ limit: 10 });
  const announcements = announcementsData || [];

  return (
    <Layout>
      {announcements.length > 0 && (
        <div className="bg-primary/10 border-b border-primary/20 overflow-hidden relative h-10 flex items-center">
          <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-background to-transparent z-10" />
          <div className="whitespace-nowrap animate-ticker flex space-x-8 text-sm font-medium text-primary-foreground/90">
            {announcements.map((a, i) => (
              <span key={i}>{a.content}</span>
            ))}
          </div>
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent z-10" />
        </div>
      )}

      <div className="p-4 space-y-6">
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Öne Çıkanlar</h2>
            <Link href="/ilanlar?featured=true" className="text-sm text-accent flex items-center">
              Tümü <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="flex overflow-x-auto pb-4 -mx-4 px-4 space-x-4 snap-x hide-scrollbar">
            {isLoading ? (
              [1, 2, 3].map(i => (
                <div key={i} className="min-w-[280px] h-[160px] glass-card rounded-2xl animate-pulse bg-white/5 snap-center" />
              ))
            ) : (
              listingsData?.listings?.filter(l => l.isFeatured).map((listing, i) => (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  key={listing.id}
                  className="min-w-[280px] glass-card rounded-2xl p-5 snap-center relative overflow-hidden group"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <Link href={`/ilan/${listing.id}`} className="block relative z-10">
                    <h3 className="font-semibold text-lg line-clamp-1">{listing.title}</h3>
                    <p className="text-muted-foreground text-sm line-clamp-1">{listing.company}</p>
                    <div className="mt-4 flex items-center space-x-4 text-xs font-medium">
                      <div className="flex items-center text-accent">
                        <MapPin className="w-3.5 h-3.5 mr-1" />
                        {listing.city}
                      </div>
                      <div className="flex items-center text-secondary-foreground/80">
                        <Briefcase className="w-3.5 h-3.5 mr-1" />
                        {listing.workType}
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))
            )}
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Son İlanlar</h2>
            <Link href="/ilanlar" className="text-sm text-accent flex items-center">
              Tümü <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="space-y-4">
            {isLoading ? (
               [1, 2, 3, 4].map(i => (
                <div key={i} className="h-[120px] glass-card rounded-2xl animate-pulse bg-white/5" />
              ))
            ) : (
              listingsData?.listings?.slice(0, 10).map((listing, i) => (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  key={listing.id}
                  className="glass-card rounded-2xl p-4"
                >
                  <Link href={`/ilan/${listing.id}`} className="block">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-base mb-1">{listing.title}</h3>
                        <p className="text-sm text-muted-foreground">{listing.company}</p>
                      </div>
                      {listing.salary && (
                        <span className="text-xs font-medium bg-primary/20 text-primary-foreground px-2 py-1 rounded-md">
                          {listing.salary}
                        </span>
                      )}
                    </div>
                    <div className="mt-4 flex items-center space-x-3 text-xs text-muted-foreground">
                      <span className="flex items-center">
                        <MapPin className="w-3.5 h-3.5 mr-1 text-accent" />
                        {listing.city}
                      </span>
                      <span className="flex items-center">
                        <Briefcase className="w-3.5 h-3.5 mr-1 text-secondary" />
                        {listing.workType}
                      </span>
                    </div>
                  </Link>
                </motion.div>
              ))
            )}
          </div>
        </section>
      </div>
    </Layout>
  );
}

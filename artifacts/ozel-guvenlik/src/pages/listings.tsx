import React, { useState } from "react";
import { useGetListings } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { MapPin, Briefcase, Search, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function Listings() {
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useGetListings({
    page,
    limit: 20,
    search: search || undefined,
    city: city || undefined,
  });

  return (
    <Layout>
      <div className="p-4 space-y-6">
        <div className="space-y-4 sticky top-14 z-30 bg-background/80 backdrop-blur-md pb-4 pt-2 -mx-4 px-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="İlan ara (örn: Özel Güvenlik Görevlisi)"
              className="pl-9 glass-card border-white/10"
              data-testid="input-search"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
            {["Tümü", "İstanbul", "Ankara", "İzmir", "Bursa", "Antalya"].map((c) => (
              <Button
                key={c}
                variant={city === (c === "Tümü" ? "" : c) ? "default" : "outline"}
                className={`rounded-full shrink-0 ${
                  city === (c === "Tümü" ? "" : c) 
                    ? "bg-gradient-to-r from-primary to-secondary text-white border-transparent" 
                    : "glass-card border-white/10"
                }`}
                onClick={() => setCity(c === "Tümü" ? "" : c)}
                size="sm"
                data-testid={`btn-filter-${c}`}
              >
                {c}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {isLoading ? (
             [1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-[140px] glass-card rounded-2xl animate-pulse bg-white/5" />
            ))
          ) : data?.listings?.length === 0 ? (
            <div className="text-center py-12 glass-card rounded-2xl">
              <p className="text-muted-foreground">İlan bulunamadı</p>
            </div>
          ) : (
            data?.listings?.map((listing, i) => (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                key={listing.id}
                className={`glass-card rounded-2xl p-4 relative overflow-hidden ${
                  listing.isFeatured ? "ring-1 ring-accent" : ""
                }`}
              >
                {listing.isFeatured && (
                  <div className="absolute top-0 right-0 bg-accent text-accent-foreground text-[10px] font-bold px-2 py-0.5 rounded-bl-lg">
                    ÖNE ÇIKAN
                  </div>
                )}
                <Link href={`/ilan/${listing.id}`} className="block">
                  <div className="flex justify-between items-start mb-2">
                    <div className="pr-4">
                      <h3 className="font-semibold text-lg leading-tight mb-1">{listing.title}</h3>
                      <p className="text-sm text-muted-foreground">{listing.company}</p>
                    </div>
                  </div>
                  
                  {listing.salary && (
                    <div className="mb-4 inline-block">
                      <span className="text-xs font-semibold bg-primary/20 text-primary-foreground px-2 py-1 rounded border border-primary/30">
                        {listing.salary}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs text-muted-foreground mt-4">
                    <div className="flex items-center space-x-3">
                      <span className="flex items-center">
                        <MapPin className="w-3.5 h-3.5 mr-1 text-accent" />
                        {listing.city}
                      </span>
                      <span className="flex items-center">
                        <Briefcase className="w-3.5 h-3.5 mr-1 text-secondary" />
                        {listing.workType}
                      </span>
                    </div>
                    <span>{new Date(listing.createdAt).toLocaleDateString('tr-TR')}</span>
                  </div>
                </Link>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
}

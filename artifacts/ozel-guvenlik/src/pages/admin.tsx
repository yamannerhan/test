import React, { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { useAuth } from "@/contexts/AuthContext";
import { Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Users, Briefcase, MessageSquare, Settings, Image, Plus, Trash2,
  ToggleLeft, ToggleRight, Star, StarOff, CheckCircle, XCircle, Clock,
  ChevronDown, ChevronUp, Calendar, Infinity
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function getToken() {
  return localStorage.getItem("auth_token") ?? "";
}

function useAdminApi<T>(path: string, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const refetch = () => {
    const tok = getToken();
    if (!tok) return;
    setLoading(true);
    fetch(`/api${path}`, { headers: { Authorization: `Bearer ${tok}` } })
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { if (user) refetch(); }, [user, ...deps]);
  return { data, loading, refetch };
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: React.ElementType; color: string }) {
  return (
    <div className="glass-card rounded-xl p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <div className="text-lg font-bold">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

function Section({ title, icon: Icon, children, defaultOpen = false }: { title: string; icon: React.ElementType; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2 font-semibold text-sm">
          <Icon className="w-4 h-4 text-primary" />
          {title}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && <div className="px-4 pb-4 border-t border-white/5 pt-4">{children}</div>}
    </div>
  );
}

export default function AdminDashboard() {
  const { user, isAdmin, isLoading } = useAuth();
  const { toast } = useToast();

  const { data: stats, refetch: refetchStats } = useAdminApi<{
    totalUsers: number; onlineUsers: number; totalListings: number;
    todayListings: number; totalMessages: number; bannedUsers: number; pendingListings: number;
  }>("/admin/stats");

  const { data: settings, refetch: refetchSettings } = useAdminApi<{
    chatLocked: boolean; fakeOnlineBonus: number; maintenanceMode: boolean; welcomeMessage: string | null;
  }>("/admin/settings");

  const { data: bannersData, refetch: refetchBanners } = useAdminApi<{
    id: number; title: string | null; imageUrl: string; linkUrl: string | null; isActive: boolean; sortOrder: number;
  }[]>("/admin/banners");

  const { data: listingsData, refetch: refetchListings } = useAdminApi<{
    listings: { id: number; title: string; company: string; city: string; status: string; isFeatured: boolean; createdAt: string; expiresAt: string | null }[];
    total: number;
  }>("/admin/listings");

  const [fakeBonus, setFakeBonus] = useState("");
  const [welcomeMsg, setWelcomeMsg] = useState("");
  useEffect(() => {
    if (settings) {
      setFakeBonus(String(settings.fakeOnlineBonus));
      setWelcomeMsg(settings.welcomeMessage ?? "");
    }
  }, [settings]);

  const [newBanner, setNewBanner] = useState({ title: "", imageUrl: "", linkUrl: "", sortOrder: "0" });
  const [newListing, setNewListing] = useState({
    title: "", company: "", city: "", workType: "Tam Zamanlı",
    salary: "", description: "", isFeatured: false, isTimed: false, expiresAt: ""
  });

  if (isLoading) return null;
  if (!user || !isAdmin) return <Redirect to="/" />;

  const apiCall = async (path: string, method: string, body?: unknown) => {
    const r = await fetch(`/api${path}`, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error((err as any).error || "İşlem başarısız");
    }
    return r.status === 204 ? null : r.json();
  };

  const saveSettings = async () => {
    try {
      await apiCall("/admin/settings", "PATCH", {
        fakeOnlineBonus: parseInt(fakeBonus, 10) || 0,
        welcomeMessage: welcomeMsg || null,
      });
      toast({ title: "Ayarlar kaydedildi" });
      refetchSettings();
      refetchStats();
    } catch (e: any) { toast({ title: "Hata", description: e.message, variant: "destructive" }); }
  };

  const toggleChatLock = async () => {
    try {
      await apiCall("/admin/chat/lock", "POST");
      toast({ title: "Sohbet durumu değiştirildi" });
      refetchSettings();
    } catch (e: any) { toast({ title: "Hata", description: e.message, variant: "destructive" }); }
  };

  const addBanner = async () => {
    if (!newBanner.imageUrl) { toast({ title: "Resim URL zorunludur", variant: "destructive" }); return; }
    try {
      await apiCall("/admin/banners", "POST", {
        title: newBanner.title || null,
        imageUrl: newBanner.imageUrl,
        linkUrl: newBanner.linkUrl || null,
        sortOrder: parseInt(newBanner.sortOrder, 10) || 0,
        isActive: true,
      });
      toast({ title: "Banner eklendi" });
      setNewBanner({ title: "", imageUrl: "", linkUrl: "", sortOrder: "0" });
      refetchBanners();
    } catch (e: any) { toast({ title: "Hata", description: e.message, variant: "destructive" }); }
  };

  const deleteBanner = async (id: number) => {
    try {
      await apiCall(`/admin/banners/${id}`, "DELETE");
      toast({ title: "Banner silindi" });
      refetchBanners();
    } catch (e: any) { toast({ title: "Hata", description: e.message, variant: "destructive" }); }
  };

  const toggleBanner = async (id: number, current: boolean) => {
    try {
      await apiCall(`/admin/banners/${id}`, "PATCH", { isActive: !current });
      refetchBanners();
    } catch (e: any) { toast({ title: "Hata", description: e.message, variant: "destructive" }); }
  };

  const addListing = async () => {
    if (!newListing.title || !newListing.company || !newListing.city) {
      toast({ title: "Başlık, şirket ve şehir zorunludur", variant: "destructive" }); return;
    }
    try {
      await apiCall("/admin/listings", "POST", {
        title: newListing.title,
        company: newListing.company,
        city: newListing.city,
        workType: newListing.workType,
        salary: newListing.salary || null,
        description: newListing.description || null,
        isFeatured: newListing.isFeatured,
        expiresAt: newListing.isTimed && newListing.expiresAt ? new Date(newListing.expiresAt).toISOString() : null,
      });
      toast({ title: "İlan eklendi ve yayında" });
      setNewListing({ title: "", company: "", city: "", workType: "Tam Zamanlı", salary: "", description: "", isFeatured: false, isTimed: false, expiresAt: "" });
      refetchListings();
      refetchStats();
    } catch (e: any) { toast({ title: "Hata", description: e.message, variant: "destructive" }); }
  };

  const toggleFeatured = async (id: number, cur: boolean) => {
    try {
      await apiCall(`/admin/listings/${id}/status`, "PATCH", { isFeatured: !cur });
      refetchListings();
    } catch (e: any) { toast({ title: "Hata", description: e.message, variant: "destructive" }); }
  };

  const setListingStatus = async (id: number, status: string) => {
    try {
      await apiCall(`/admin/listings/${id}/status`, "PATCH", { status });
      refetchListings();
      refetchStats();
    } catch (e: any) { toast({ title: "Hata", description: e.message, variant: "destructive" }); }
  };

  const deleteListing = async (id: number) => {
    try {
      await apiCall(`/admin/listings/${id}`, "DELETE");
      toast({ title: "İlan silindi" });
      refetchListings();
      refetchStats();
    } catch (e: any) { toast({ title: "Hata", description: e.message, variant: "destructive" }); }
  };

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "2-digit" });

  return (
    <Layout>
      <div className="p-4 space-y-4 pb-8">
        <div>
          <h1 className="text-xl font-bold text-destructive">Admin Paneli</h1>
          <p className="text-xs text-muted-foreground mt-0.5">ÖzelGüvenlik.Online yönetim merkezi</p>
        </div>

        {stats && (
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Toplam Üye" value={stats.totalUsers} icon={Users} color="bg-primary/20 text-primary" />
            <StatCard label="Çevrimiçi" value={stats.onlineUsers} icon={Users} color="bg-green-500/20 text-green-400" />
            <StatCard label="Aktif İlan" value={stats.totalListings} icon={Briefcase} color="bg-accent/20 text-accent" />
            <StatCard label="Bekleyen" value={stats.pendingListings} icon={Clock} color="bg-amber-500/20 text-amber-400" />
            <StatCard label="Mesaj" value={stats.totalMessages} icon={MessageSquare} color="bg-secondary/20 text-secondary" />
            <StatCard label="Yasaklı" value={stats.bannedUsers} icon={XCircle} color="bg-destructive/20 text-destructive" />
          </div>
        )}

        <Section title="Genel Ayarlar" icon={Settings} defaultOpen>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Sahte Online Bonus</label>
              <Input
                type="number"
                value={fakeBonus}
                onChange={e => setFakeBonus(e.target.value)}
                placeholder="127"
                className="glass-card border-white/10"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Karşılama Mesajı</label>
              <Input
                value={welcomeMsg}
                onChange={e => setWelcomeMsg(e.target.value)}
                placeholder="Hoş geldiniz..."
                className="glass-card border-white/10"
              />
            </div>
            <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
              <div>
                <div className="text-sm font-medium">Sohbet Kilidi</div>
                <div className="text-xs text-muted-foreground">{settings?.chatLocked ? "Kilitli" : "Açık"}</div>
              </div>
              <button onClick={toggleChatLock} className="text-primary hover:text-primary/80 transition-colors">
                {settings?.chatLocked
                  ? <ToggleRight className="w-7 h-7 text-destructive" />
                  : <ToggleLeft className="w-7 h-7" />}
              </button>
            </div>
            <Button onClick={saveSettings} className="w-full bg-primary/80 hover:bg-primary text-sm">
              Kaydet
            </Button>
          </div>
        </Section>

        <Section title="Banner Yönetimi" icon={Image}>
          <div className="space-y-3">
            <div className="bg-white/5 rounded-xl p-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Yeni Banner Ekle</p>
              <Input value={newBanner.imageUrl} onChange={e => setNewBanner(b => ({ ...b, imageUrl: e.target.value }))}
                placeholder="Resim URL (https://...)" className="glass-card border-white/10 text-sm" />
              <Input value={newBanner.title} onChange={e => setNewBanner(b => ({ ...b, title: e.target.value }))}
                placeholder="Başlık (opsiyonel)" className="glass-card border-white/10 text-sm" />
              <Input value={newBanner.linkUrl} onChange={e => setNewBanner(b => ({ ...b, linkUrl: e.target.value }))}
                placeholder="Link URL (opsiyonel)" className="glass-card border-white/10 text-sm" />
              <Input type="number" value={newBanner.sortOrder} onChange={e => setNewBanner(b => ({ ...b, sortOrder: e.target.value }))}
                placeholder="Sıra (0=önce)" className="glass-card border-white/10 text-sm" />
              {newBanner.imageUrl && (
                <img src={newBanner.imageUrl} alt="Önizleme" className="w-full h-24 object-cover rounded-lg" onError={e => (e.currentTarget.style.display = "none")} />
              )}
              <Button onClick={addBanner} className="w-full text-sm bg-accent/80 hover:bg-accent text-accent-foreground">
                <Plus className="w-4 h-4 mr-1" /> Banner Ekle
              </Button>
            </div>

            {bannersData && bannersData.length > 0 && (
              <div className="space-y-2">
                {bannersData.map(b => (
                  <div key={b.id} className="flex items-center gap-2 bg-white/5 rounded-xl p-2">
                    <img src={b.imageUrl} alt="" className="w-16 h-10 object-cover rounded-lg shrink-0" onError={e => (e.currentTarget.style.display = "none")} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">{b.title || "—"}</div>
                      <div className="text-[10px] text-muted-foreground">Sıra: {b.sortOrder}</div>
                    </div>
                    <button onClick={() => toggleBanner(b.id, b.isActive)} className={b.isActive ? "text-green-400" : "text-muted-foreground"}>
                      {b.isActive ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                    </button>
                    <button onClick={() => deleteBanner(b.id)} className="text-destructive hover:text-destructive/80">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Section>

        <Section title="İlan Ekle (Admin)" icon={Briefcase}>
          <div className="space-y-3">
            <Input value={newListing.title} onChange={e => setNewListing(l => ({ ...l, title: e.target.value }))}
              placeholder="İlan başlığı" className="glass-card border-white/10 text-sm" />
            <div className="grid grid-cols-2 gap-2">
              <Input value={newListing.company} onChange={e => setNewListing(l => ({ ...l, company: e.target.value }))}
                placeholder="Şirket" className="glass-card border-white/10 text-sm" />
              <Input value={newListing.city} onChange={e => setNewListing(l => ({ ...l, city: e.target.value }))}
                placeholder="Şehir" className="glass-card border-white/10 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Select value={newListing.workType} onValueChange={v => setNewListing(l => ({ ...l, workType: v }))}>
                <SelectTrigger className="glass-card border-white/10 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Tam Zamanlı">Tam Zamanlı</SelectItem>
                  <SelectItem value="Yarı Zamanlı">Yarı Zamanlı</SelectItem>
                  <SelectItem value="Vardiyalı">Vardiyalı</SelectItem>
                  <SelectItem value="Proje Bazlı">Proje Bazlı</SelectItem>
                </SelectContent>
              </Select>
              <Input value={newListing.salary} onChange={e => setNewListing(l => ({ ...l, salary: e.target.value }))}
                placeholder="Maaş (opsiyonel)" className="glass-card border-white/10 text-sm" />
            </div>
            <Textarea value={newListing.description} onChange={e => setNewListing(l => ({ ...l, description: e.target.value }))}
              placeholder="İş tanımı..." className="glass-card border-white/10 text-sm min-h-[80px]" />

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setNewListing(l => ({ ...l, isTimed: false }))}
                className={`flex items-center justify-center gap-2 py-2 rounded-xl border text-xs font-medium transition-all ${!newListing.isTimed ? "border-primary bg-primary/20 text-primary-foreground" : "border-white/10 text-muted-foreground"}`}
              >
                <Infinity className="w-3.5 h-3.5" /> Süresiz
              </button>
              <button
                type="button"
                onClick={() => setNewListing(l => ({ ...l, isTimed: true }))}
                className={`flex items-center justify-center gap-2 py-2 rounded-xl border text-xs font-medium transition-all ${newListing.isTimed ? "border-accent bg-accent/20 text-accent" : "border-white/10 text-muted-foreground"}`}
              >
                <Clock className="w-3.5 h-3.5" /> Süreli
              </button>
            </div>

            {newListing.isTimed && (
              <div>
                <label className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Bitiş Tarihi
                </label>
                <input
                  type="datetime-local"
                  value={newListing.expiresAt}
                  onChange={e => setNewListing(l => ({ ...l, expiresAt: e.target.value }))}
                  min={new Date().toISOString().slice(0, 16)}
                  className="w-full glass-card border border-white/10 rounded-xl px-3 py-2 text-sm bg-transparent text-foreground"
                />
              </div>
            )}

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={newListing.isFeatured}
                onChange={e => setNewListing(l => ({ ...l, isFeatured: e.target.checked }))}
                className="w-4 h-4 rounded accent-amber-400"
              />
              <span className="text-sm flex items-center gap-1">
                <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" /> Öne çıkarılsın
              </span>
            </label>

            <Button onClick={addListing} className="w-full text-sm bg-gradient-to-r from-primary to-secondary">
              <Plus className="w-4 h-4 mr-1" /> İlanı Yayınla
            </Button>
          </div>
        </Section>

        <Section title="İlan Listesi" icon={Briefcase}>
          <div className="space-y-2">
            {listingsData?.listings?.map(l => (
              <div key={l.id} className="bg-white/5 rounded-xl p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium line-clamp-1">{l.title}</div>
                    <div className="text-xs text-muted-foreground">{l.company} · {l.city}</div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                        l.status === "active" ? "bg-green-500/20 text-green-400" :
                        l.status === "pending" ? "bg-amber-500/20 text-amber-400" :
                        "bg-destructive/20 text-destructive"
                      }`}>{l.status === "active" ? "Aktif" : l.status === "pending" ? "Bekliyor" : "Reddedildi"}</span>
                      {l.isFeatured && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-medium">Öne Çıkan</span>}
                      {l.expiresAt && <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Calendar className="w-2.5 h-2.5" />{formatDate(l.expiresAt)}</span>}
                      <span className="text-[10px] text-muted-foreground">{formatDate(l.createdAt)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {l.status !== "active" && (
                    <button onClick={() => setListingStatus(l.id, "active")} className="text-[10px] flex items-center gap-0.5 px-2 py-1 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors">
                      <CheckCircle className="w-3 h-3" /> Onayla
                    </button>
                  )}
                  {l.status !== "rejected" && (
                    <button onClick={() => setListingStatus(l.id, "rejected")} className="text-[10px] flex items-center gap-0.5 px-2 py-1 bg-destructive/20 text-destructive rounded-lg hover:bg-destructive/30 transition-colors">
                      <XCircle className="w-3 h-3" /> Reddet
                    </button>
                  )}
                  <button onClick={() => toggleFeatured(l.id, l.isFeatured)} className={`text-[10px] flex items-center gap-0.5 px-2 py-1 rounded-lg transition-colors ${l.isFeatured ? "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30" : "bg-white/10 text-muted-foreground hover:bg-white/20"}`}>
                    {l.isFeatured ? <><StarOff className="w-3 h-3" /> Öne çıkarmayı kaldır</> : <><Star className="w-3 h-3" /> Öne çıkar</>}
                  </button>
                  <button onClick={() => deleteListing(l.id)} className="text-[10px] flex items-center gap-0.5 px-2 py-1 bg-destructive/10 text-destructive/80 rounded-lg hover:bg-destructive/20 transition-colors ml-auto">
                    <Trash2 className="w-3 h-3" /> Sil
                  </button>
                </div>
              </div>
            ))}
            {!listingsData?.listings?.length && (
              <p className="text-xs text-muted-foreground text-center py-4">İlan bulunamadı</p>
            )}
          </div>
        </Section>
      </div>
    </Layout>
  );
}

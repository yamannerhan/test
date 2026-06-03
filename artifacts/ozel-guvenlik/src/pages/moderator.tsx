import React, { useState, useEffect, useRef } from "react";
import { Layout } from "@/components/layout";
import { useAuth } from "@/contexts/AuthContext";
import { Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Briefcase, MapPin, CheckCircle, User, Phone, Search,
  Shield, ChevronDown, Sparkles, RefreshCw, Trash2,
  ToggleLeft, ToggleRight, Ban, UserCheck, Clock, Eye,
} from "lucide-react";

function getToken() { return localStorage.getItem("auth_token") ?? ""; }

function useModApi<T>(path: string, deps: unknown[] = []) {
  const { user } = useAuth();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);

  const refetch = () => {
    if (!user) return;
    setLoading(true);
    fetch(`/api${path}`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { if (user) refetch(); }, [user, ...deps]);
  return { data, loading, refetch };
}

function Section({ title, icon: Icon, children, defaultOpen = false }: { title: string; icon: React.ElementType; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl mb-4 overflow-hidden shadow-lg">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-5 py-4 text-left">
        <div className="flex items-center gap-2.5 font-bold text-sm text-white">
          <Icon className="w-4 h-4 text-amber-400" />
          {title}
        </div>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="px-5 pb-5 pt-1">{children}</div>}
    </div>
  );
}

interface ParsedField {
  value: string;
  source: "ai" | "manual";
}
interface ParsedListing {
  title: ParsedField;
  company: ParsedField;
  city: ParsedField;
  district?: ParsedField;
  workType: ParsedField;
  salary?: ParsedField;
  description?: ParsedField;
  requirements?: ParsedField;
  gender?: ParsedField;
  contactName?: ParsedField;
  contactPhone?: ParsedField;
  applyUrl?: ParsedField;
  imageUrl?: ParsedField;
  isFeatured?: boolean;
}

function ParseField({ label, field, onChange }: { label: string; field: ParsedField; onChange: (v: string) => void }) {
  return (
    <div className="mb-2">
      <label className="text-xs text-muted-foreground flex items-center gap-1 mb-0.5">
        {label}
        <span className={`ml-1 text-[10px] px-1 rounded ${field.source === "ai" ? "bg-violet-500/20 text-violet-300" : "bg-white/10 text-muted-foreground"}`}>
          {field.source === "ai" ? "AI" : "manuel"}
        </span>
      </label>
      <Input
        value={field.value}
        onChange={e => onChange(e.target.value)}
        className="h-8 text-sm bg-white/5 border-white/10"
      />
    </div>
  );
}

function SmartListingSection({ apiCall, toast, refetchListings }: {
  apiCall: (path: string, method: string, body?: unknown) => Promise<unknown>;
  toast: (opts: { title: string; description?: string; variant?: "default" | "destructive" }) => void;
  refetchListings: () => void;
}) {
  const [rawText, setRawText] = useState("");
  const [parsed, setParsed] = useState<ParsedListing | null>(null);
  const [parsing, setParsing] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const update = (key: keyof ParsedListing, value: string) => {
    setParsed(p => p ? { ...p, [key]: { value, source: "manual" as const } } : p);
  };

  const parseText = async () => {
    if (!rawText.trim()) return;
    setParsing(true);
    try {
      const data = await apiCall("/admin/listings/parse", "POST", { text: rawText }) as ParsedListing;
      setParsed(data);
    } catch (e: unknown) {
      toast({ title: "Ayıklama başarısız", description: (e as Error).message, variant: "destructive" });
    } finally { setParsing(false); }
  };

  const publish = async () => {
    if (!parsed) return;
    const missing: string[] = [];
    if (!parsed.title?.value) missing.push("Başlık");
    if (!parsed.company?.value) missing.push("Şirket");
    if (!parsed.city?.value) missing.push("Şehir");
    if (!parsed.workType?.value) missing.push("Çalışma şekli");
    if (missing.length > 0) {
      toast({ title: "Zorunlu alanlar boş", description: missing.join(", ") + " doldurulmalıdır.", variant: "destructive" });
      return;
    }
    setPublishing(true);
    try {
      await apiCall("/admin/listings", "POST", {
        title: parsed.title.value,
        company: parsed.company.value,
        city: parsed.city.value,
        district: parsed.district?.value || null,
        workType: parsed.workType.value,
        salary: parsed.salary?.value || null,
        description: parsed.description?.value || null,
        requirements: parsed.requirements?.value || null,
        gender: parsed.gender?.value || null,
        contactName: parsed.contactName?.value || null,
        contactPhone: parsed.contactPhone?.value || null,
        applyUrl: parsed.applyUrl?.value || null,
        imageUrl: parsed.imageUrl?.value || null,
        isFeatured: false,
      });
      toast({ title: "İlan yayınlandı!" });
      setParsed(null);
      setRawText("");
      refetchListings();
    } catch (e: unknown) {
      toast({ title: "Yayınlama başarısız", description: (e as Error).message, variant: "destructive" });
    } finally { setPublishing(false); }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">İlan metnini yapıştır</label>
        <Textarea
          value={rawText}
          onChange={e => setRawText(e.target.value)}
          rows={5}
          placeholder="İlan metnini buraya yapıştır..."
          className="bg-white/5 border-white/10 text-sm resize-none"
        />
      </div>
      <Button onClick={parseText} disabled={parsing || !rawText.trim()} className="w-full bg-violet-600 hover:bg-violet-700">
        <Sparkles className="w-4 h-4 mr-2" />
        {parsing ? "Ayıklanıyor..." : "AI ile Ayıkla"}
      </Button>

      {parsed && (
        <div className="mt-4 space-y-1 border border-white/10 rounded-xl p-4 bg-white/5">
          <p className="text-xs font-semibold text-amber-400 mb-3">Ayıklanan Veriler — Düzenleyebilirsiniz</p>
          <ParseField label="Başlık *" field={parsed.title} onChange={v => update("title", v)} />
          <ParseField label="Şirket *" field={parsed.company} onChange={v => update("company", v)} />
          <ParseField label="Şehir *" field={parsed.city} onChange={v => update("city", v)} />
          {parsed.district && <ParseField label="İlçe" field={parsed.district} onChange={v => update("district", v)} />}
          <ParseField label="Çalışma Şekli *" field={parsed.workType} onChange={v => update("workType", v)} />
          {parsed.salary && <ParseField label="Maaş" field={parsed.salary} onChange={v => update("salary", v)} />}
          {parsed.gender && <ParseField label="Cinsiyet" field={parsed.gender} onChange={v => update("gender", v)} />}
          {parsed.contactName && <ParseField label="İletişim Kişisi" field={parsed.contactName} onChange={v => update("contactName", v)} />}
          {parsed.contactPhone && <ParseField label="Telefon" field={parsed.contactPhone} onChange={v => update("contactPhone", v)} />}
          {parsed.applyUrl && <ParseField label="Başvuru URL" field={parsed.applyUrl} onChange={v => update("applyUrl", v)} />}
          {parsed.imageUrl && <ParseField label="Görsel URL" field={parsed.imageUrl} onChange={v => update("imageUrl", v)} />}
          <div className="mb-2">
            <label className="text-xs text-muted-foreground mb-0.5 block">Açıklama</label>
            <Textarea
              value={parsed.description?.value ?? ""}
              onChange={e => update("description", e.target.value)}
              rows={4}
              className="bg-white/5 border-white/10 text-sm resize-none"
            />
          </div>
          {parsed.requirements && (
            <div className="mb-2">
              <label className="text-xs text-muted-foreground mb-0.5 block">Gereksinimler</label>
              <Textarea
                value={parsed.requirements.value}
                onChange={e => update("requirements", e.target.value)}
                rows={3}
                className="bg-white/5 border-white/10 text-sm resize-none"
              />
            </div>
          )}
          <Button onClick={publish} disabled={publishing} className="w-full mt-2 bg-green-600 hover:bg-green-700">
            <CheckCircle className="w-4 h-4 mr-2" />
            {publishing ? "Yayınlanıyor..." : "Yayınla"}
          </Button>
        </div>
      )}
    </div>
  );
}

export default function ModeratorDashboard() {
  const { user, isModerator, isAdmin, isLoading } = useAuth();
  const { toast } = useToast();

  const { data: listingsData, refetch: refetchListings } = useModApi<{
    listings: { id: number; title: string; company: string; city: string; status: string; isFeatured: boolean; createdAt: string; expiresAt: string | null }[];
    total: number;
  }>("/admin/listings");

  const [userSearch, setUserSearch] = useState("");
  const [userPage] = useState(1);
  const { data: usersData, refetch: refetchUsers } = useModApi<{
    users: { id: number; username: string; email: string; role: string; isBanned: boolean; banReason: string | null; banExpiresAt: string | null; createdAt: string }[];
    total: number;
  }>(`/admin/users?page=${userPage}&search=${encodeURIComponent(userSearch)}`);

  const [banReason, setBanReason] = useState("");
  const [banTarget, setBanTarget] = useState<number | null>(null);
  const [banExpiry, setBanExpiry] = useState("");
  const banInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (banTarget && banInputRef.current) banInputRef.current.focus();
  }, [banTarget]);

  if (isLoading) return null;
  if (!user || (!isModerator && !isAdmin)) return <Redirect to="/" />;

  const apiCall = async (path: string, method: string, body?: unknown): Promise<unknown> => {
    const r = await fetch(`/api${path}`, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({ error: "Bilinmeyen hata" }));
      throw new Error(err.error ?? "İstek başarısız");
    }
    return r.status === 204 ? null : r.json();
  };

  const changeListingStatus = async (id: number, status: string) => {
    try {
      await apiCall(`/admin/listings/${id}/status`, "PATCH", { status });
      toast({ title: "İlan durumu güncellendi" });
      refetchListings();
    } catch (e: unknown) { toast({ title: "Hata", description: (e as Error).message, variant: "destructive" }); }
  };

  const deleteListing = async (id: number) => {
    if (!confirm("Bu ilan silinecek. Emin misiniz?")) return;
    try {
      await apiCall(`/admin/listings/${id}`, "DELETE");
      toast({ title: "İlan silindi" });
      refetchListings();
    } catch (e: unknown) { toast({ title: "Hata", description: (e as Error).message, variant: "destructive" }); }
  };

  const banUser = async (id: number) => {
    if (!banReason.trim()) { toast({ title: "Ban sebebi giriniz", variant: "destructive" }); return; }
    try {
      await apiCall(`/admin/users/${id}/ban`, "POST", { reason: banReason, expiresAt: banExpiry || null });
      toast({ title: "Kullanıcı yasaklandı" });
      setBanTarget(null); setBanReason(""); setBanExpiry("");
      refetchUsers();
    } catch (e: unknown) { toast({ title: "Hata", description: (e as Error).message, variant: "destructive" }); }
  };

  const unbanUser = async (id: number) => {
    try {
      await apiCall(`/admin/users/${id}/unban`, "POST");
      toast({ title: "Yasak kaldırıldı" });
      refetchUsers();
    } catch (e: unknown) { toast({ title: "Hata", description: (e as Error).message, variant: "destructive" }); }
  };

  const listings = listingsData?.listings ?? [];
  const usersList = usersData?.users ?? [];

  return (
    <Layout>
      <div className="px-4 py-6">
        <div className="mb-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
            <Shield className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h1 className="font-extrabold text-xl text-white">Moderatör Paneli</h1>
            <p className="text-xs text-muted-foreground">{user.username} · Moderatör</p>
          </div>
        </div>

        <Section title="Akıllı İlan Oluştur" icon={Sparkles} defaultOpen={true}>
          <SmartListingSection
            apiCall={apiCall}
            toast={toast}
            refetchListings={refetchListings}
          />
        </Section>

        <Section title={`İlan Yönetimi${listingsData ? ` (${listingsData.total})` : ""}`} icon={Briefcase}>
          <div className="flex justify-end mb-3">
            <Button size="sm" variant="ghost" onClick={refetchListings}>
              <RefreshCw className="w-3 h-3 mr-1" /> Yenile
            </Button>
          </div>
          <div className="space-y-2">
            {listings.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">İlan bulunamadı</p>}
            {listings.map(l => (
              <div key={l.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{l.title}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="w-3 h-3" />{l.company} · {l.city}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                        l.status === "active" ? "bg-green-500/20 text-green-400" :
                        l.status === "pending" ? "bg-yellow-500/20 text-yellow-400" :
                        "bg-red-500/20 text-red-400"
                      }`}>
                        {l.status === "active" ? "Aktif" : l.status === "pending" ? "Bekliyor" : "Reddedildi"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {l.status !== "active" && (
                      <button onClick={() => changeListingStatus(l.id, "active")} title="Onayla" className="text-green-400 hover:text-green-300">
                        <ToggleRight className="w-4 h-4" />
                      </button>
                    )}
                    {l.status === "active" && (
                      <button onClick={() => changeListingStatus(l.id, "pending")} title="Askıya Al" className="text-yellow-400 hover:text-yellow-300">
                        <ToggleLeft className="w-4 h-4" />
                      </button>
                    )}
                    <button onClick={() => deleteListing(l.id)} title="Sil" className="text-red-400 hover:text-red-300">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {new Date(l.createdAt).toLocaleDateString("tr-TR")}
                  {l.expiresAt && ` · Bitiş: ${new Date(l.expiresAt).toLocaleDateString("tr-TR")}`}
                </p>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Kullanıcı Yönetimi" icon={User}>
          <div className="flex gap-2 mb-3">
            <Input
              value={userSearch}
              onChange={e => setUserSearch(e.target.value)}
              placeholder="Kullanıcı ara..."
              className="h-8 text-sm bg-white/5 border-white/10"
            />
            <Button size="sm" variant="ghost" onClick={refetchUsers}>
              <Search className="w-3 h-3" />
            </Button>
          </div>
          <div className="space-y-2">
            {usersList.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Kullanıcı bulunamadı</p>}
            {usersList.map(u => {
              const canModerate = u.role === "user";
              return (
                <div key={u.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-semibold text-white">{u.username}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                          u.role === "admin" ? "bg-red-500/20 text-red-400" :
                          u.role === "moderator" ? "bg-amber-500/20 text-amber-400" :
                          "bg-blue-500/20 text-blue-400"
                        }`}>
                          {u.role === "admin" ? "Admin" : u.role === "moderator" ? "Moderatör" : "Kullanıcı"}
                        </span>
                        {u.isBanned && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-800/40 text-red-300">Yasaklı</span>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{u.email}</p>
                      {u.isBanned && u.banReason && (
                        <p className="text-xs text-red-400 mt-0.5">Sebep: {u.banReason}</p>
                      )}
                    </div>
                    {canModerate && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        {u.isBanned ? (
                          <button onClick={() => unbanUser(u.id)} title="Yasağı Kaldır" className="text-green-400 hover:text-green-300">
                            <UserCheck className="w-4 h-4" />
                          </button>
                        ) : (
                          <button onClick={() => setBanTarget(banTarget === u.id ? null : u.id)} title="Yasakla" className="text-red-400 hover:text-red-300">
                            <Ban className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  {banTarget === u.id && !u.isBanned && canModerate && (
                    <div className="mt-2 space-y-1.5 border-t border-white/10 pt-2">
                      <Input
                        ref={banInputRef}
                        value={banReason}
                        onChange={e => setBanReason(e.target.value)}
                        placeholder="Ban sebebi *"
                        className="h-7 text-xs bg-white/5 border-white/10"
                      />
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-muted-foreground shrink-0" />
                        <Input
                          type="datetime-local"
                          value={banExpiry}
                          onChange={e => setBanExpiry(e.target.value)}
                          className="h-7 text-xs bg-white/5 border-white/10 flex-1"
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground">Bitiş tarihi boş = kalıcı yasak</p>
                      <div className="flex gap-1.5">
                        <Button size="sm" onClick={() => banUser(u.id)} className="flex-1 h-7 text-xs bg-red-700 hover:bg-red-600">
                          Yasakla
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setBanTarget(null); setBanReason(""); setBanExpiry(""); }} className="h-7 text-xs">
                          Vazgec
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {usersData && usersData.total > usersList.length && (
            <p className="text-xs text-muted-foreground text-center mt-3">
              {usersList.length} / {usersData.total} kullanıcı gösteriliyor
            </p>
          )}
        </Section>

        <div className="text-center mt-6">
          <div className="inline-flex items-center gap-2 text-xs text-muted-foreground bg-white/5 px-3 py-2 rounded-full border border-white/10">
            <Eye className="w-3 h-3" />
            <span>Sadece yetkili işlemler gösterilmektedir</span>
          </div>
        </div>
      </div>
    </Layout>
  );
}

import React, { useState, useEffect, useRef } from "react";
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
  ChevronDown, ChevronUp, Calendar, Infinity, Headphones, ChevronLeft, Send,
  Sparkles, Eye, RefreshCw, Phone, User, MapPin, Building2, Lock, Shield, Search
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

interface ParsedListing {
  title: string; company: string; city: string; district: string;
  salary: string; workType: string; description: string;
  contactPhone: string; contactName: string; applyUrl: string;
}

function SmartListingSection({ apiCall, toast, refetchListings, refetchStats, hasOpenaiKey }: {
  apiCall: (path: string, method: string, body?: unknown) => Promise<unknown>;
  toast: (opts: { title: string; description?: string; variant?: "default" | "destructive" }) => void;
  refetchListings: () => void;
  refetchStats: () => void;
  hasOpenaiKey: boolean;
}) {
  const [step, setStep] = useState<"input" | "preview" | "done">("input");
  const [rawText, setRawText] = useState("");
  const [parsed, setParsed] = useState<ParsedListing | null>(null);
  const [loading, setLoading] = useState(false);
  const [isFeatured, setIsFeatured] = useState(false);
  const [isTimed, setIsTimed] = useState(false);
  const [expiresAt, setExpiresAt] = useState("");

  const parseText = async () => {
    if (!rawText.trim()) return;
    setLoading(true);
    try {
      const data = await apiCall("/admin/listings/parse", "POST", { text: rawText }) as ParsedListing;
      setParsed(data);
      setStep("preview");
    } catch (e: any) {
      toast({ title: "Ayıklama başarısız", description: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  const publish = async () => {
    if (!parsed) return;
    setLoading(true);
    try {
      const city = parsed.city || (parsed.district ? "Belirtilmedi" : "Türkiye");
      await apiCall("/admin/listings", "POST", {
        title: parsed.title || "İlan",
        company: parsed.company || "Belirtilmedi",
        city,
        workType: parsed.workType || "Tam Zamanlı",
        salary: parsed.salary || null,
        description: [
          parsed.description,
          parsed.contactName ? `İletişim: ${parsed.contactName}` : null,
          parsed.contactPhone ? `Tel: ${parsed.contactPhone}` : null,
          parsed.district ? `İlçe: ${parsed.district}` : null,
        ].filter(Boolean).join("\n\n") || null,
        applyUrl: parsed.applyUrl || null,
        isFeatured,
        expiresAt: isTimed && expiresAt ? new Date(expiresAt).toISOString() : null,
      });
      toast({ title: "İlan yayınlandı!" });
      setStep("done");
      setRawText("");
      setParsed(null);
      setIsFeatured(false);
      setIsTimed(false);
      setExpiresAt("");
      refetchListings();
      refetchStats();
      setTimeout(() => setStep("input"), 1500);
    } catch (e: any) {
      toast({ title: "Yayınlama başarısız", description: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  const Field = ({ icon: Icon, label, value, onChange }: { icon: React.ElementType; label: string; value: string; onChange: (v: string) => void }) => (
    <div>
      <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-1 flex items-center gap-1">
        <Icon className="w-3 h-3" /> {label}
      </label>
      <input value={value} onChange={e => onChange(e.target.value)}
        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50" />
    </div>
  );

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-white/5">
        <div className="flex items-center gap-2 font-semibold text-sm">
          <Sparkles className="w-4 h-4 text-primary" />
          Akıllı İlan Oluştur
          {hasOpenaiKey && <span className="text-[9px] font-bold bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full">AKTİF</span>}
        </div>
        {step !== "input" && (
          <button onClick={() => { setStep("input"); setParsed(null); }}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
            <RefreshCw className="w-3 h-3" /> Sıfırla
          </button>
        )}
      </div>

      <div className="p-4 space-y-3">
        {!hasOpenaiKey ? (
          <div className="flex items-center gap-2 p-3 bg-amber-500/10 rounded-xl text-xs text-amber-400">
            <Lock className="w-4 h-4 shrink-0" />
            <span>Bu özelliği kullanmak için Genel Ayarlar bölümünden OpenAI API anahtarı girin.</span>
          </div>
        ) : step === "input" ? (
          <>
            <p className="text-xs text-muted-foreground">WhatsApp mesajı, Telegram gönderisi veya herhangi bir iş ilanı metnini yapıştırın. Yapay zeka otomatik olarak tüm bilgileri çıkaracak.</p>
            <textarea
              value={rawText}
              onChange={e => setRawText(e.target.value)}
              placeholder={"Örnek:\n\"Acil! İstanbul Kadıköy'de güvenlik şirketi arıyor. Silahlı güvenlik görevlisi. 25.000 TL maaş. Tam zamanlı. İletişim: Ahmet Bey 0532 123 45 67\""}
              rows={6}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 resize-none"
            />
            <Button
              onClick={parseText}
              disabled={loading || !rawText.trim()}
              className="w-full bg-gradient-to-r from-primary to-secondary text-white text-sm disabled:opacity-40"
            >
              {loading ? (
                <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Ayıklanıyor...</>
              ) : (
                <><Sparkles className="w-4 h-4 mr-2" /> AI ile Ayıkla</>
              )}
            </Button>
          </>
        ) : step === "preview" && parsed ? (
          <>
            <div className="flex items-center gap-2 p-2.5 bg-green-500/10 rounded-xl text-xs text-green-400 font-medium">
              <Eye className="w-3.5 h-3.5 shrink-0" /> Bilgiler ayıklandı — kontrol edip düzenleyebilirsiniz
            </div>
            <div className="space-y-2">
              <Field icon={Briefcase} label="İlan Başlığı" value={parsed.title} onChange={v => setParsed(p => p ? { ...p, title: v } : p)} />
              <div className="grid grid-cols-2 gap-2">
                <Field icon={Building2} label="Şirket" value={parsed.company} onChange={v => setParsed(p => p ? { ...p, company: v } : p)} />
                <Field icon={MapPin} label="Şehir (İl)" value={parsed.city} onChange={v => setParsed(p => p ? { ...p, city: v } : p)} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field icon={MapPin} label="İlçe" value={parsed.district} onChange={v => setParsed(p => p ? { ...p, district: v } : p)} />
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-1 flex items-center gap-1">
                    <Briefcase className="w-3 h-3" /> Çalışma Tipi
                  </label>
                  <select value={parsed.workType} onChange={e => setParsed(p => p ? { ...p, workType: e.target.value } : p)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary/50">
                    <option value="Tam Zamanlı">Tam Zamanlı</option>
                    <option value="Yarı Zamanlı">Yarı Zamanlı</option>
                    <option value="Vardiyalı">Vardiyalı</option>
                    <option value="Proje Bazlı">Proje Bazlı</option>
                  </select>
                </div>
              </div>
              <Field icon={Star} label="Maaş" value={parsed.salary} onChange={v => setParsed(p => p ? { ...p, salary: v } : p)} />
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-1 flex items-center gap-1">
                  <MessageSquare className="w-3 h-3" /> Açıklama
                </label>
                <textarea value={parsed.description} onChange={e => setParsed(p => p ? { ...p, description: e.target.value } : p)}
                  rows={3} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary/50 resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field icon={User} label="İletişim Kişisi" value={parsed.contactName} onChange={v => setParsed(p => p ? { ...p, contactName: v } : p)} />
                <Field icon={Phone} label="Telefon" value={parsed.contactPhone} onChange={v => setParsed(p => p ? { ...p, contactPhone: v } : p)} />
              </div>
              <Field icon={CheckCircle} label="Başvuru / Telefon URL" value={parsed.applyUrl} onChange={v => setParsed(p => p ? { ...p, applyUrl: v } : p)} />

              {/* Yayınlama seçenekleri */}
              <div className="flex gap-2 pt-1">
                <button onClick={() => setIsTimed(false)}
                  className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl border text-xs font-medium transition-all ${!isTimed ? "border-primary bg-primary/20 text-primary" : "border-white/10 text-muted-foreground"}`}>
                  <Infinity className="w-3 h-3" /> Süresiz
                </button>
                <button onClick={() => setIsTimed(true)}
                  className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl border text-xs font-medium transition-all ${isTimed ? "border-accent bg-accent/20 text-accent" : "border-white/10 text-muted-foreground"}`}>
                  <Clock className="w-3 h-3" /> Süreli
                </button>
              </div>
              {isTimed && (
                <input type="datetime-local" value={expiresAt} onChange={e => setExpiresAt(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none" />
              )}
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={isFeatured} onChange={e => setIsFeatured(e.target.checked)}
                  className="w-4 h-4 rounded accent-amber-400" />
                <span className="text-sm flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" /> Öne çıkarılsın
                </span>
              </label>

              <Button onClick={publish} disabled={loading}
                className="w-full bg-gradient-to-r from-primary to-secondary text-white text-sm disabled:opacity-40">
                {loading ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Yayınlanıyor...</> : <><CheckCircle className="w-4 h-4 mr-2" /> İlanı Yayınla</>}
              </Button>
            </div>
          </>
        ) : (
          <div className="text-center py-6 text-green-400 font-semibold text-sm">
            <CheckCircle className="w-10 h-10 mx-auto mb-2" />
            İlan başarıyla yayınlandı!
          </div>
        )}
      </div>
    </div>
  );
}

interface AdminSupportTicket {
  id: number; subject: string; status: string; userId: number;
  username: string | null; msgCount: number; createdAt: string; updatedAt: string;
}
interface AdminSupportMessage {
  id: number; message: string; isStaff: boolean; userId: number;
  username: string | null; createdAt: string;
}
interface AdminSupportDetail extends AdminSupportTicket { messages: AdminSupportMessage[]; }

function SupportAdminSection({ apiCall, toast }: {
  apiCall: (path: string, method: string, body?: unknown) => Promise<unknown>;
  toast: (opts: { title: string; description?: string; variant?: "default" | "destructive" }) => void;
}) {
  const [tickets, setTickets] = useState<AdminSupportTicket[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("all");
  const [activeTicket, setActiveTicket] = useState<AdminSupportDetail | null>(null);
  const [reply, setReply] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadTickets = async () => {
    setLoading(true);
    try {
      const path = filter === "all" ? "/admin/support" : `/admin/support?status=${filter}`;
      const data = await apiCall(path, "GET") as AdminSupportTicket[];
      setTickets(data);
    } catch {} finally { setLoading(false); }
  };

  const loadTicketDetail = async (id: number) => {
    try {
      const data = await apiCall(`/support/${id}`, "GET") as AdminSupportDetail;
      setActiveTicket(data);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch {}
  };

  const sendReply = async () => {
    if (!reply.trim() || !activeTicket) return;
    try {
      const msg = await apiCall(`/support/${activeTicket.id}/reply`, "POST", { message: reply.trim() }) as AdminSupportMessage;
      setReply("");
      setActiveTicket(prev => prev ? { ...prev, status: "answered", messages: [...prev.messages, msg] } : prev);
      loadTickets();
    } catch (e: any) { toast({ title: "Hata", description: e.message, variant: "destructive" }); }
  };

  const changeStatus = async (id: number, status: string) => {
    try {
      await apiCall(`/support/${id}/status`, "PATCH", { status });
      toast({ title: "Durum güncellendi" });
      if (activeTicket?.id === id) setActiveTicket(prev => prev ? { ...prev, status } : prev);
      loadTickets();
    } catch (e: any) { toast({ title: "Hata", description: e.message, variant: "destructive" }); }
  };

  const formatTime = (iso: string) => new Date(iso).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

  const StatusBadge = ({ status }: { status: string }) => {
    const cfg = { waiting: "bg-amber-500/20 text-amber-400", answered: "bg-blue-500/20 text-blue-400", resolved: "bg-green-500/20 text-green-400" }[status] ?? "bg-white/10 text-muted-foreground";
    const labels = { waiting: "Bekliyor", answered: "Yanıtlandı", resolved: "Çözüldü" } as Record<string, string>;
    return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg}`}>{labels[status] ?? status}</span>;
  };

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <button onClick={() => { loadTickets(); }}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-white/5 transition-colors">
        <div className="flex items-center gap-2 font-semibold text-sm">
          <Headphones className="w-4 h-4 text-primary" />
          Destek Talepleri
        </div>
        <ChevronDown className="w-4 h-4 text-muted-foreground" />
      </button>

      <div className="px-4 pb-4 border-t border-white/5 pt-4 space-y-3">
        {activeTicket ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <button onClick={() => setActiveTicket(null)} className="text-muted-foreground hover:text-foreground">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold line-clamp-1">{activeTicket.subject}</p>
                <p className="text-[10px] text-muted-foreground">{activeTicket.username} · #{ activeTicket.id}</p>
              </div>
              <StatusBadge status={activeTicket.status} />
            </div>

            <div className="space-y-1.5 flex gap-1 flex-wrap">
              {["waiting", "answered", "resolved"].map(s => (
                <button key={s} onClick={() => changeStatus(activeTicket.id, s)}
                  disabled={activeTicket.status === s}
                  className={`text-[10px] px-2 py-1 rounded-lg font-medium disabled:opacity-40 transition-colors ${
                    s === "waiting" ? "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30" :
                    s === "answered" ? "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30" :
                    "bg-green-500/20 text-green-400 hover:bg-green-500/30"
                  }`}>
                  { { waiting: "Bekliyor", answered: "Yanıtlandı", resolved: "Çözüldü" }[s] }
                </button>
              ))}
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2 bg-white/5 rounded-xl p-3">
              {activeTicket.messages.map(m => (
                <div key={m.id} className={`flex ${m.isStaff ? "justify-start" : "justify-end"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                    m.isStaff ? "bg-primary/20 text-foreground rounded-tl-sm" : "bg-white/10 text-foreground rounded-tr-sm"
                  }`}>
                    <p className="text-[9px] font-bold text-muted-foreground mb-0.5">{m.username ?? "Kullanıcı"}{m.isStaff ? " · Ekip" : ""}</p>
                    <p>{m.message}</p>
                    <p className="text-[9px] text-muted-foreground mt-0.5">{formatTime(m.createdAt)}</p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {activeTicket.status !== "resolved" && (
              <div className="flex gap-2">
                <textarea value={reply} onChange={e => setReply(e.target.value)}
                  placeholder="Yanıt yaz..."
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply(); }}}
                  rows={2} className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-primary/50 resize-none text-foreground placeholder:text-muted-foreground" />
                <button onClick={sendReply} disabled={!reply.trim()}
                  className="w-9 h-9 self-end rounded-xl bg-primary flex items-center justify-center disabled:opacity-40">
                  <Send className="w-3.5 h-3.5 text-white" />
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="flex gap-1.5 flex-wrap">
              {[["all","Tümü"],["waiting","Bekliyor"],["answered","Yanıtlandı"],["resolved","Çözüldü"]].map(([v,l]) => (
                <button key={v} onClick={() => { setFilter(v!); }}
                  className={`text-[10px] px-2.5 py-1 rounded-full font-medium transition-colors ${filter === v ? "bg-primary text-white" : "bg-white/10 text-muted-foreground hover:bg-white/15"}`}>
                  {l}
                </button>
              ))}
              <button onClick={loadTickets} className="text-[10px] px-2.5 py-1 rounded-full bg-white/10 text-muted-foreground hover:bg-white/15 ml-auto">
                Yenile
              </button>
            </div>

            {loading ? (
              <p className="text-xs text-center text-muted-foreground py-4">Yükleniyor...</p>
            ) : tickets.length === 0 ? (
              <p className="text-xs text-center text-muted-foreground py-4">Destek talebi bulunamadı.</p>
            ) : (
              <div className="space-y-2">
                {tickets.map(t => (
                  <button key={t.id} onClick={() => loadTicketDetail(t.id)}
                    className="w-full text-left bg-white/5 hover:bg-white/10 rounded-xl p-3 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold line-clamp-1">{t.subject}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{t.username} · {t.msgCount} mesaj · {formatTime(t.updatedAt)}</p>
                      </div>
                      <StatusBadge status={t.status} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

interface AdminUser {
  id: number; username: string; email: string; displayName: string | null; role: string;
  isBanned: boolean; createdAt: string; avatarUrl: string | null;
}

function UserManagementSection({ apiCall, toast }: {
  apiCall: (path: string, method: string, body?: unknown) => Promise<unknown>;
  toast: ReturnType<typeof useToast>["toast"];
}) {
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [newMod, setNewMod] = useState({ username: "", email: "", password: "" });
  const [creating, setCreating] = useState(false);

  // Per-user expanded state: password reset
  const [resetPw, setResetPw] = useState<Record<number, string>>({});
  const [resetLoading, setResetLoading] = useState<number | null>(null);
  // Per-user display name edit
  const [editDN, setEditDN] = useState<Record<number, string>>({});
  const [dnLoading, setDnLoading] = useState<number | null>(null);

  const searchUsers = async () => {
    setLoading(true);
    try {
      const q = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : "";
      const d = await apiCall(`/admin/users${q}`, "GET") as { users: AdminUser[] };
      setUsers(d.users ?? []);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { searchUsers(); }, []);

  const changeRole = async (id: number, role: string) => {
    try {
      await apiCall(`/admin/users/${id}/role`, "PATCH", { role });
      toast({ title: "Rol güncellendi" });
      setUsers(prev => prev.map(u => u.id === id ? { ...u, role } : u));
    } catch (e: any) { toast({ title: "Hata", description: e.message, variant: "destructive" }); }
  };

  const banUser = async (id: number, isBanned: boolean) => {
    try {
      if (isBanned) {
        await apiCall(`/admin/users/${id}/unban`, "POST");
        setUsers(prev => prev.map(u => u.id === id ? { ...u, isBanned: false } : u));
        toast({ title: "Yasak kaldırıldı" });
      } else {
        await apiCall(`/admin/users/${id}/ban`, "POST", { reason: "Admin tarafından engellendi" });
        setUsers(prev => prev.map(u => u.id === id ? { ...u, isBanned: true } : u));
        toast({ title: "Kullanıcı yasaklandı" });
      }
    } catch (e: any) { toast({ title: "Hata", description: e.message, variant: "destructive" }); }
  };

  const resetPassword = async (id: number) => {
    const pw = resetPw[id]?.trim();
    if (!pw || pw.length < 6) { toast({ title: "Şifre en az 6 karakter olmalıdır", variant: "destructive" }); return; }
    setResetLoading(id);
    try {
      await apiCall(`/admin/users/${id}/reset-password`, "POST", { newPassword: pw });
      toast({ title: "Şifre sıfırlandı" });
      setResetPw(prev => { const n = { ...prev }; delete n[id]; return n; });
    } catch (e: any) { toast({ title: "Hata", description: e.message, variant: "destructive" }); }
    finally { setResetLoading(null); }
  };

  const saveDisplayName = async (id: number) => {
    const dn = editDN[id] ?? "";
    setDnLoading(id);
    try {
      await apiCall(`/admin/users/${id}/display-name`, "PATCH", { displayName: dn.trim() || null });
      toast({ title: "İsim güncellendi" });
      setUsers(prev => prev.map(u => u.id === id ? { ...u, displayName: dn.trim() || null } : u));
      setEditDN(prev => { const n = { ...prev }; delete n[id]; return n; });
    } catch (e: any) { toast({ title: "Hata", description: e.message, variant: "destructive" }); }
    finally { setDnLoading(null); }
  };

  const createModerator = async () => {
    if (!newMod.username.trim() || !newMod.email.trim() || !newMod.password.trim()) {
      toast({ title: "Tüm alanlar zorunlu", variant: "destructive" }); return;
    }
    setCreating(true);
    try {
      await apiCall("/admin/create-staff", "POST", { ...newMod, role: "moderator" });
      toast({ title: "Moderatör oluşturuldu" });
      setNewMod({ username: "", email: "", password: "" });
      searchUsers();
    } catch (e: any) { toast({ title: "Hata", description: e.message, variant: "destructive" }); }
    finally { setCreating(false); }
  };

  const roleLabel: Record<string, string> = { admin: "Admin", moderator: "Moderatör", user: "Üye" };
  const roleBg: Record<string, string> = { admin: "text-red-400 bg-red-500/20", moderator: "text-blue-400 bg-blue-500/20", user: "text-muted-foreground bg-white/10" };

  return (
    <Section title="Kullanıcı Yönetimi" icon={Users}>
      <div className="space-y-4">
        {/* Create moderator */}
        <div className="bg-white/5 rounded-xl p-3 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-blue-400" /> Yeni Moderatör Ekle
          </p>
          <input value={newMod.username} onChange={e => setNewMod(m => ({ ...m, username: e.target.value }))}
            placeholder="Kullanıcı adı" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50" />
          <input value={newMod.email} onChange={e => setNewMod(m => ({ ...m, email: e.target.value }))}
            placeholder="E-posta" type="email" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50" />
          <input value={newMod.password} onChange={e => setNewMod(m => ({ ...m, password: e.target.value }))}
            placeholder="Şifre" type="password" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50" />
          <button onClick={createModerator} disabled={creating}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
            style={{ background: "linear-gradient(135deg,#3B82F6,#2563EB)" }}>
            {creating ? "Oluşturuluyor..." : "Moderatör Oluştur"}
          </button>
        </div>

        {/* Search */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === "Enter" && searchUsers()}
              placeholder="Kullanıcı ara..." className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50" />
          </div>
          <button onClick={searchUsers} disabled={loading}
            className="px-3 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-50"
            style={{ background: "linear-gradient(135deg,#4F46E5,#7C3AED)" }}>
            Ara
          </button>
        </div>

        {/* User list */}
        <div className="space-y-2">
          {loading ? (
            <div className="flex justify-center py-4"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>
          ) : users.length === 0 ? (
            <p className="text-xs text-center text-muted-foreground py-4">Kullanıcı bulunamadı</p>
          ) : users.map(u => (
            <div key={u.id} className={`bg-white/5 rounded-xl p-3 space-y-2 ${u.isBanned ? "opacity-60" : ""}`}>
              {/* Header row */}
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold shrink-0">
                  {u.username.substring(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-sm font-semibold truncate">{u.displayName || u.username}</p>
                    {u.displayName && <p className="text-[10px] text-muted-foreground">@{u.username}</p>}
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${roleBg[u.role] ?? "bg-white/10 text-muted-foreground"}`}>
                      {roleLabel[u.role] ?? u.role}
                    </span>
                    {u.isBanned && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-destructive/20 text-destructive">Yasaklı</span>}
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate">{u.email}</p>
                </div>
              </div>

              {/* Display name edit */}
              <div className="flex gap-1.5">
                <input
                  value={editDN[u.id] ?? u.displayName ?? ""}
                  onChange={e => setEditDN(prev => ({ ...prev, [u.id]: e.target.value }))}
                  placeholder="Sohbet adı (displayName)"
                  className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40"
                />
                <button
                  onClick={() => saveDisplayName(u.id)}
                  disabled={dnLoading === u.id}
                  className="text-[10px] px-2 py-1 bg-primary/20 text-primary rounded-lg hover:bg-primary/30 transition-colors disabled:opacity-50"
                >
                  {dnLoading === u.id ? "..." : "Kaydet"}
                </button>
              </div>

              {/* Password reset */}
              <div className="flex gap-1.5">
                <input
                  type="password"
                  value={resetPw[u.id] ?? ""}
                  onChange={e => setResetPw(prev => ({ ...prev, [u.id]: e.target.value }))}
                  placeholder="Yeni şifre (en az 6 karakter)"
                  className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-amber-500/40"
                />
                <button
                  onClick={() => resetPassword(u.id)}
                  disabled={resetLoading === u.id}
                  className="text-[10px] px-2 py-1 bg-amber-500/20 text-amber-400 rounded-lg hover:bg-amber-500/30 transition-colors disabled:opacity-50 flex items-center gap-0.5"
                >
                  <Lock className="w-3 h-3" />
                  {resetLoading === u.id ? "..." : "Şifre"}
                </button>
              </div>

              {/* Role + ban buttons */}
              {u.role !== "admin" && (
                <div className="flex gap-1.5 flex-wrap">
                  {u.role !== "moderator" ? (
                    <button onClick={() => changeRole(u.id, "moderator")}
                      className="text-[10px] px-2 py-1 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors flex items-center gap-0.5">
                      <Shield className="w-3 h-3" /> Moderatör Yap
                    </button>
                  ) : (
                    <button onClick={() => changeRole(u.id, "user")}
                      className="text-[10px] px-2 py-1 bg-white/10 text-muted-foreground rounded-lg hover:bg-white/20 transition-colors flex items-center gap-0.5">
                      <User className="w-3 h-3" /> Üye Yap
                    </button>
                  )}
                  <button onClick={() => banUser(u.id, u.isBanned)}
                    className={`text-[10px] px-2 py-1 rounded-lg transition-colors flex items-center gap-0.5 ml-auto ${u.isBanned ? "bg-green-500/20 text-green-400 hover:bg-green-500/30" : "bg-destructive/20 text-destructive hover:bg-destructive/30"}`}>
                    {u.isBanned ? <><CheckCircle className="w-3 h-3" /> Yasağı Kaldır</> : <><XCircle className="w-3 h-3" /> Yasakla</>}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </Section>
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
    chatLocked: boolean; fakeOnlineBonus: number; maintenanceMode: boolean; welcomeMessage: string | null; hasOpenaiKey: boolean;
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
  const [openaiKey, setOpenaiKey] = useState("");
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);
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
      const body: Record<string, unknown> = {
        fakeOnlineBonus: parseInt(fakeBonus, 10) || 0,
        welcomeMessage: welcomeMsg || null,
      };
      if (openaiKey) body.openaiApiKey = openaiKey;
      await apiCall("/admin/settings", "PATCH", body);
      toast({ title: "Ayarlar kaydedildi" });
      setOpenaiKey("");
      refetchSettings();
      refetchStats();
    } catch (e: any) { toast({ title: "Hata", description: e.message, variant: "destructive" }); }
  };

  const removeOpenaiKey = async () => {
    try {
      await apiCall("/admin/settings", "PATCH", { openaiApiKey: "" });
      toast({ title: "API anahtarı silindi" });
      refetchSettings();
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

            {/* OpenAI API Key */}
            <div className="bg-white/5 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full inline-block" style={{ background: settings?.hasOpenaiKey ? "#22c55e" : "#ef4444" }} />
                  OpenAI API Anahtarı
                </label>
                {settings?.hasOpenaiKey && (
                  <button onClick={removeOpenaiKey} className="text-[10px] text-destructive hover:text-destructive/80">Sil</button>
                )}
              </div>
              {settings?.hasOpenaiKey ? (
                <p className="text-xs text-green-400">API anahtarı kayıtlı. Akıllı ilan oluşturma aktif.</p>
              ) : (
                <p className="text-xs text-amber-400">API anahtarı yok — akıllı ilan oluşturma devre dışı.</p>
              )}
              <div className="flex gap-2">
                <input
                  type={showOpenaiKey ? "text" : "password"}
                  value={openaiKey}
                  onChange={e => setOpenaiKey(e.target.value)}
                  placeholder={settings?.hasOpenaiKey ? "Yeni anahtar gir (değiştirmek için)" : "sk-..."}
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
                />
                <button onClick={() => setShowOpenaiKey(v => !v)}
                  className="px-2.5 py-1.5 bg-white/10 rounded-xl text-xs text-muted-foreground hover:bg-white/15">
                  {showOpenaiKey ? "Gizle" : "Göster"}
                </button>
              </div>
            </div>

            <Button onClick={saveSettings} className="w-full bg-primary/80 hover:bg-primary text-sm">
              Kaydet
            </Button>
          </div>
        </Section>

        <SmartListingSection apiCall={apiCall} toast={toast} refetchListings={refetchListings} refetchStats={refetchStats} hasOpenaiKey={settings?.hasOpenaiKey ?? false} />

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

        <SupportAdminSection apiCall={apiCall} toast={toast} />

        <UserManagementSection apiCall={apiCall} toast={toast} />

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

import React, { useState, useRef, useCallback } from "react";
import { Layout } from "@/components/layout";
import { ChevronRight, ChevronLeft, Sparkles, Download, Eye, Plus, Trash2, Upload, Check, Wand2 } from "lucide-react";

// ── Tipler ────────────────────────────────────────────────────────────────────
interface Experience { id: number; title: string; company: string; period: string; desc: string; }
interface Skill { id: number; name: string; level: number; }
interface CVData {
  ad: string; soyad: string; pozisyon: string; dogumTarihi: string;
  medeniDurum: string; boy: string; kilo: string; adres: string;
  telefon: string; email: string; hakkimda: string;
  deneyimler: Experience[]; yetenekler: Skill[];
  hobiler: string; ozellikler: string[]; motto: string;
}

const INITIAL: CVData = {
  ad: "", soyad: "", pozisyon: "Güvenlik Görevlisi", dogumTarihi: "",
  medeniDurum: "Bekar", boy: "", kilo: "", adres: "", telefon: "", email: "",
  hakkimda: "", deneyimler: [{ id: 1, title: "", company: "", period: "", desc: "" }],
  yetenekler: [{ id: 1, name: "", level: 4 }], hobiler: "",
  ozellikler: ["Disiplinli", "Güvenilir", "Ekip Uyumlu"], motto: "",
};

const POZISYONLAR = [
  "Güvenlik Görevlisi", "Başgüvenlik", "VIP Koruma", "Silahlı Güvenlik",
  "Güvenlik Şefi", "Özel Dedektif", "Elektronik Güvenlik", "Güvenlik Danışmanı",
  "Fabrika / Tesis Güvenlik", "Sahil Güvenlik",
];

const OZELLIK_LISTESI = [
  "Disiplinli", "Güvenilir", "Ekip Uyumlu", "Sorumluluk Sahibi", "Çalışkan",
  "Güler Yüzlü", "Planlı & Organize", "İletişime Açık", "Çabuk Karar Veren",
  "Analitik Düşünen", "Güçlü İrade", "Öz Denetimli",
];

// ── AI İçerik Veritabanı ─────────────────────────────────────────────────────
const SUMMARIES: Record<string, string[]> = {
  "Güvenlik Görevlisi": ["Disiplinli, sorumluluk sahibi ve güvenilir bir özel güvenlik profesyoneliyim. Görevimi titizlikle yerine getirir, kurumun güvenliğini en üst düzeyde sağlarım. Kriz anlarında soğukkanlılığımı koruyarak doğru kararlar alırım.", "Özel güvenlik alanında deneyimli, çalışkan ve dürüst bir bireyim. Tüm güvenlik protokollerini eksiksiz uygular, kurumun ve çalışanların emniyetini önceliğim olarak görürüm."],
  "Başgüvenlik": ["Özel güvenlik sektöründe liderlik deneyimine sahip, ekibimi etkin yöneten ve güvenlik protokollerini başarıyla uygulayan bir profesyonelim. Vardiya planlaması ve personel koordinasyonunda tam yetkinliğe sahibim.", "Ekip yönetimi ve güvenlik koordinasyonunda deneyimli, sorumluluk sahibi bir başgüvenlik uzmanıyım. Güvenlik raporlaması ve acil müdahale prosedürleri konularında yetkinim."],
  "VIP Koruma": ["VIP ve özel koruma alanında uzmanlaşmış, taktiksel eğitim almış, gizlilik ilkelerine tam bağlı bir koruma uzmanıyım. Stres altında soğukkanlılığımı koruyarak müvekkile zarar gelmesini önlerim.", "Bireysel ve grup VIP koruma görevlerinde deneyimli, hızlı karar verebilen bir koruma uzmanıyım. Fiziksel yeterlilik, protokol bilgisi ve takım koordinasyonu güçlü yönlerimdir."],
  "Silahlı Güvenlik": ["Silahlı güvenlik ruhsatına sahip, silah kullanımı ve taktik güvenlik protokolleri konusunda yetkin bir güvenlik uzmanıyım. Yasalara ve kurumsal kurallara tam uyum içinde, sorumlu biçimde görev yaparım.", "Silahlı koruma operasyonlarında görev yapmış, taktiksel eğitim almış, disiplinli bir güvenlik profesyoneliyim."],
  "Güvenlik Şefi": ["Güvenlik operasyonlarını planlama ve yönetme konusunda kapsamlı deneyime sahip, stratejik düşünen bir güvenlik lideri olarak görev yapıyorum. Ekip motivasyonu ve operasyonel mükemmellik önceliklerimdir.", "Büyük tesislerde kapsamlı güvenlik sistemleri kuran ve yöneten, liderlik vasıflarına sahip, sonuç odaklı bir güvenlik şefiyim."],
  "Elektronik Güvenlik": ["CCTV, alarm ve erişim kontrol sistemleri konusunda uzmanlaşmış, teknik yeterliliğe sahip bir elektronik güvenlik uzmanıyım. Sistem kurulumu, bakımı ve entegrasyonunda geniş deneyimim bulunmaktadır.", "Elektronik güvenlik sistemleri kurulum ve arıza tespiti konularında deneyimli, güvenlik teknolojilerine hakim bir profesyonelim."],
  "Özel Dedektif": ["Gözetleme, takip ve delil toplama konularında uzmanlaşmış, analitik düşünce yeteneğine sahip bir özel dedektifim. Gizlilik ve mesleki etik ilkelerine tam bağlılıkla görev yaparım."],
  "Güvenlik Danışmanı": ["Güvenlik risk analizi, strateji geliştirme ve kurumsal güvenlik danışmanlığı alanlarında kapsamlı deneyime sahip bir uzmanım. Güvenlik açıklarını tespit eder ve bütüncül çözümler sunarım."],
  "Fabrika / Tesis Güvenlik": ["Endüstriyel tesis ve fabrika güvenliği konusunda deneyimli, OHS ve güvenlik protokollerine hakim bir güvenlik profesyoneliyim. Tesis güvenliği ve acil müdahale süreçlerinde yetkinim."],
  "Sahil Güvenlik": ["Kıyı ve deniz güvenliği operasyonlarında görev yapmış, su kurtarma ve sahil gözetleme konularında eğitim almış bir güvenlik uzmanıyım."],
};

const EXPERIENCES: Record<string, Omit<Experience, "id">[]> = {
  "Güvenlik Görevlisi": [
    { title: "Kıdemli Güvenlik Görevlisi", company: "ProGüvenlik A.Ş.", period: "2021 – Halen", desc: "Tesis güvenliği, giriş-çıkış kontrolü, devriye görevi ve olay tutanaklarının düzenlenmesi. CCTV izleme sistemleri ve acil müdahale protokolleri." },
    { title: "Güvenlik Görevlisi", company: "Güven AVM / Alışveriş Merkezi", period: "2018 – 2021", desc: "Müşteri ve personel güvenliğinin sağlanması, kayıp önleme, kamera izleme ve güvenlik raporlaması." },
  ],
  "Başgüvenlik": [
    { title: "Başgüvenlik Amiri", company: "Metropol Güvenlik Ltd.", period: "2019 – Halen", desc: "25 kişilik güvenlik ekibinin yönetimi, vardiya planlaması, personel eğitimi ve güvenlik operasyonlarının koordinasyonu." },
    { title: "Kıdemli Güvenlik Görevlisi", company: "Akıncı Güvenlik A.Ş.", period: "2015 – 2019", desc: "Tesis güvenliği, acil müdahale prosedürleri ve güvenlik ekipmanlarının bakım takibi." },
  ],
  "VIP Koruma": [
    { title: "VIP Koruma Uzmanı", company: "Elite Koruma & Güvenlik Ltd.", period: "2020 – Halen", desc: "Üst düzey yöneticilerin ve iş insanlarının yakın koruma hizmetleri, güzergah planlaması ve risk değerlendirmesi." },
    { title: "Sözleşmeli Uzman Erbaş", company: "Türk Silahlı Kuvvetleri", period: "2013 – 2020", desc: "Taktiksel eğitim, müdahale prosedürleri, fiziksel kondisyon ve ekip liderliği görevleri." },
  ],
  "Silahlı Güvenlik": [
    { title: "Silahlı Güvenlik Uzmanı", company: "Türk Telekom / Enerji Tesisi", period: "2020 – Halen", desc: "Kritik altyapı güvenliği, silahlı devriye, tehdit değerlendirmesi ve müdahale protokolleri." },
    { title: "Sözleşmeli Er", company: "Türk Silahlı Kuvvetleri", period: "2015 – 2020", desc: "Silah eğitimi, birlik güvenliği ve operasyonel görevler." },
  ],
  "Güvenlik Şefi": [
    { title: "Güvenlik Müdürü", company: "AVM Yönetim / 5 Yıldızlı Otel", period: "2018 – Halen", desc: "50+ kişilik güvenlik departmanının yönetimi, güvenlik bütçesi, tesis risk analizi ve kriz yönetimi." },
    { title: "Başgüvenlik Amiri", company: "Sanayi Bölgesi / OSB", period: "2013 – 2018", desc: "Tesis güvenlik protokollerinin oluşturulması, personel eğitimi ve güvenlik altyapısının modernizasyonu." },
  ],
  "Elektronik Güvenlik": [
    { title: "Elektronik Güvenlik Teknisyeni", company: "Securtec Güvenlik Sistemleri", period: "2019 – Halen", desc: "IP CCTV, dijital kayıt sistemleri, erişim kontrol ve alarm sistemleri kurulum ve bakımı." },
    { title: "Güvenlik Sistemleri Teknisyeni", company: "Hikvision / Dahua Bayi", period: "2016 – 2019", desc: "Müşteri tesis analizi, güvenlik sistemi proje tasarımı ve sahaya kurulum çalışmaları." },
  ],
  "Özel Dedektif": [
    { title: "Lisanslı Özel Dedektif", company: "Bağımsız / Freelance", period: "2019 – Halen", desc: "Sigorta dolandırıcılığı soruşturması, kayıp kişi takibi, gizli gözetleme ve delil derleme." },
    { title: "Güvenlik & İstihbarat Görevlisi", company: "Büyük Ölçekli Şirket", period: "2015 – 2019", desc: "Kurumsal güvenlik soruşturmaları, iç denetim ve personel güvenilirlik araştırmaları." },
  ],
  "Güvenlik Danışmanı": [
    { title: "Kıdemli Güvenlik Danışmanı", company: "GüvenDanış & Ortakları", period: "2018 – Halen", desc: "Kurumsal risk analizi, güvenlik denetimi, politika geliştirme ve güvenlik eğitimi programları." },
    { title: "Güvenlik Operasyon Müdürü", company: "Uluslararası Firma", period: "2013 – 2018", desc: "Çoklu lokasyon güvenlik yönetimi, ISO 27001 uyumluluk ve kriz simülasyonları." },
  ],
  "Fabrika / Tesis Güvenlik": [
    { title: "Tesis Güvenlik Amiri", company: "Büyük Fabrika / Sanayi Tesisi", period: "2020 – Halen", desc: "Fabrika güvenlik protokolleri, yangın önleme, çalışan güvenliği ve vardiya yönetimi." },
    { title: "Güvenlik Görevlisi", company: "OSB / Organize Sanayi Bölgesi", period: "2016 – 2020", desc: "Giriş-çıkış kontrol, araç takibi, güvenlik kamerası izleme ve olay raporlaması." },
  ],
  "Sahil Güvenlik": [
    { title: "Sahil Güvenlik Botu Personeli", company: "Sahil Güvenlik Komutanlığı", period: "2016 – Halen", desc: "Deniz devriye, arama-kurtarma operasyonları, kaçakçılık önleme ve deniz trafiği denetimi." },
    { title: "Su Ürünleri Denetçisi", company: "İl Jandarma Komutanlığı", period: "2012 – 2016", desc: "Kıyı güvenliği, balıkçı denetimi ve deniz kazası müdahale protokolleri." },
  ],
};

const HOBBIES: Record<string, string> = {
  "Güvenlik Görevlisi": "Spor Yapmak, Yürüyüş, Araba Sürme",
  "Başgüvenlik": "Spor Yapmak, Okumak, Takım Sporları",
  "VIP Koruma": "Dövüş Sanatları, Spor Atıcılık, Yüzme",
  "Silahlı Güvenlik": "Spor Atıcılık, Fitness, Açık Hava Aktiviteleri",
  "Güvenlik Şefi": "Golf, Okumak, Strateji Oyunları",
  "Elektronik Güvenlik": "Elektronik, Fotoğrafçılık, Teknoloji",
  "Özel Dedektif": "Satranç, Okumak, Fotoğrafçılık",
  "Güvenlik Danışmanı": "Okumak, Seyahat, Golf",
  "Fabrika / Tesis Güvenlik": "Spor, Bahçecilik, Araba Bakımı",
  "Sahil Güvenlik": "Dalış, Balık Tutmak, Yüzme",
};

const MOTTOS: Record<string, string> = {
  "Güvenlik Görevlisi": "GÜVEN, SADAKAT VE ONUR EN BÜYÜK GÜÇTÜr.",
  "Başgüvenlik": "GÜÇLÜ LİDERLİK, SAĞLAM GÜVENLİK.",
  "VIP Koruma": "HAYAT KIYMETLİDİR — KORUMAK ONURDUR.",
  "Silahlı Güvenlik": "KARARLIYIM, DİSİPLİNLİYİM, GÜVENİLİRİM.",
  "Güvenlik Şefi": "STRATEJİK DÜŞÜN, GÜVENLİ YÖNET.",
  "Elektronik Güvenlik": "TEKNOLOJİ İLE GÜVENLİĞİ GELECEĞE TAŞIYORUM.",
  "Özel Dedektif": "GERÇEK HER ZAMAN ORTAYA ÇIKAR.",
  "Güvenlik Danışmanı": "GÜVENLİK BİR YATIRIM, RİSK BİR SEÇİMDİR.",
  "Fabrika / Tesis Güvenlik": "GÜVENLİ TESİS, BAŞARILI ÜRETİM.",
  "Sahil Güvenlik": "DENİZLER GÜVENDE — VATANI KORUYORUM.",
};

const OZELLIKLER: Record<string, string[]> = {
  "Güvenlik Görevlisi": ["Disiplinli", "Güvenilir", "Ekip Uyumlu", "Sorumluluk Sahibi", "Güler Yüzlü"],
  "Başgüvenlik": ["Liderlik", "Disiplinli", "Sorumluluk Sahibi", "Planlı & Organize", "İletişime Açık"],
  "VIP Koruma": ["Disiplinli", "Güçlü İrade", "Çabuk Karar Veren", "Güvenilir", "Öz Denetimli"],
  "Silahlı Güvenlik": ["Disiplinli", "Güvenilir", "Güçlü İrade", "Sorumluluk Sahibi", "Çabuk Karar Veren"],
  "Güvenlik Şefi": ["Liderlik", "Analitik Düşünen", "Planlı & Organize", "İletişime Açık", "Sorumluluk Sahibi"],
  "Elektronik Güvenlik": ["Analitik Düşünen", "Planlı & Organize", "Güvenilir", "Çalışkan", "İletişime Açık"],
  "Özel Dedektif": ["Analitik Düşünen", "Öz Denetimli", "Güvenilir", "Güçlü İrade", "Disiplinli"],
  "Güvenlik Danışmanı": ["Analitik Düşünen", "İletişime Açık", "Planlı & Organize", "Liderlik", "Sorumluluk Sahibi"],
  "Fabrika / Tesis Güvenlik": ["Disiplinli", "Güvenilir", "Çalışkan", "Ekip Uyumlu", "Sorumluluk Sahibi"],
  "Sahil Güvenlik": ["Disiplinli", "Güvenilir", "Güçlü İrade", "Ekip Uyumlu", "Çabuk Karar Veren"],
};

const SKILLS_MAP: Record<string, string[]> = {
  "Güvenlik Görevlisi": ["Güvenlik Protokolleri", "İlk Yardım", "Gözlem Yeteneği", "İletişim", "Stres Yönetimi"],
  "Başgüvenlik": ["Ekip Yönetimi", "Vardiya Planlama", "Güvenlik Protokolleri", "Raporlama", "Kriz Yönetimi"],
  "VIP Koruma": ["Taktiksel Düşünce", "VIP Protokolü", "Savunma Sanatları", "Araç Takibi", "Risk Analizi"],
  "Silahlı Güvenlik": ["Silah Kullanımı", "Güvenlik Protokolleri", "Taktik Hareket", "İlk Yardım", "Hukuki Mevzuat"],
  "Güvenlik Şefi": ["Liderlik", "Stratejik Planlama", "Ekip Yönetimi", "Operasyon Kontrolü", "Risk Değerlendirme"],
  "Elektronik Güvenlik": ["CCTV Sistemleri", "Alarm Sistemleri", "Erişim Kontrolü", "Teknik Bakım", "Sistem Entegrasyonu"],
  "Özel Dedektif": ["Gözetleme", "Veri Analizi", "Raporlama", "Araştırma Teknikleri", "Gizli Takip"],
  "Güvenlik Danışmanı": ["Risk Analizi", "Denetim", "Strateji Geliştirme", "Eğitim Yönetimi", "Protokol Hazırlama"],
  "Fabrika / Tesis Güvenlik": ["Tesis Güvenliği", "Yangın Önleme", "Acil Müdahale", "OHS Standartları", "Erişim Kontrolü"],
  "Sahil Güvenlik": ["Deniz Güvenliği", "Su Kurtarma", "Gözetleme", "İlk Yardım", "Navigasyon"],
};

function generateSummary(poz: string): string {
  const list = SUMMARIES[poz] || SUMMARIES["Güvenlik Görevlisi"]!;
  return list[Math.floor(Math.random() * list.length)] ?? list[0]!;
}

function getSuggestedSkills(poz: string): Skill[] {
  return (SKILLS_MAP[poz] || SKILLS_MAP["Güvenlik Görevlisi"]!).map((n, i) => ({ id: i + 1, name: n, level: Math.max(3, 5 - (i % 2)) }));
}

// Tüm alanları otomatik doldurur (kişisel bilgiler korunur)
function fullAutoFill(poz: string, cur: CVData): CVData {
  const exps = (EXPERIENCES[poz] || EXPERIENCES["Güvenlik Görevlisi"]!).map((e, i) => ({ ...e, id: i + 1 }));
  const summary = generateSummary(poz);
  return {
    ...cur,
    pozisyon: poz,
    hakkimda: summary,
    deneyimler: exps,
    yetenekler: getSuggestedSkills(poz),
    hobiler: HOBBIES[poz] || "Spor, Okumak, Yürüyüş",
    ozellikler: OZELLIKLER[poz] || ["Disiplinli", "Güvenilir", "Ekip Uyumlu"],
    motto: MOTTOS[poz] || "GÜVEN, SADAKAT VE ONUR EN BÜYÜK GÜÇTÜr.",
  };
}

// ── Renk Seçenekleri ──────────────────────────────────────────────────────────
const PALETTE = [
  { label: "Altın",      c: "#D4AF37" },
  { label: "Gümüş",     c: "#A8B2BC" },
  { label: "Kırmızı",   c: "#C0392B" },
  { label: "Lacivert",  c: "#009EDB" },
  { label: "Mor",       c: "#7C3AED" },
  { label: "Cyan",      c: "#06B6D4" },
  { label: "Yeşil",     c: "#16A34A" },
  { label: "Turuncu",   c: "#EA580C" },
  { label: "Pembe",     c: "#EC4899" },
  { label: "Indigo",    c: "#4F46E5" },
];

// ── Şablon Bileşenleri (ana bileşen DIŞINDA) ──────────────────────────────────
interface TP { data: CVData; photo: string; color: string; }

function PhotoBox({ photo, name, color, circle }: { photo: string; name: string; color: string; circle?: boolean }) {
  const initials = (name.trim() || "ÖG").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const base: React.CSSProperties = circle
    ? { width: 92, height: 92, borderRadius: "50%", border: `3px solid ${color}`, flexShrink: 0, objectFit: "cover" as const }
    : { width: 95, height: 118, borderRadius: 4, border: `3px solid ${color}`, flexShrink: 0, objectFit: "cover" as const };
  if (photo) return <img src={photo} alt="" style={base} />;
  return <div style={{ ...base, background: `${color}22`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: circle ? 28 : 32, fontWeight: 900, color, fontFamily: "Arial" }}>{initials}</div>;
}

function Sec({ title, c, children }: { title: string; c: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 7 }}>
        <div style={{ width: 14, height: 1, background: c }} />
        <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" as const, color: c }}>{title}</span>
        <div style={{ flex: 1, height: 1, background: `${c}40` }} />
      </div>
      {children}
    </div>
  );
}

function Inf({ l, v, dark }: { l: string; v: string; dark?: boolean }) {
  return (
    <div style={{ marginBottom: 5 }}>
      <span style={{ fontSize: 8, color: dark ? "#64748b" : "#666", display: "block" }}>{l}</span>
      <span style={{ fontSize: 9, color: dark ? "#94a3b8" : "#ddd" }}>{v}</span>
    </div>
  );
}

function Bar({ level, c }: { level: number; c: string }) {
  return <div style={{ height: 4, background: "#33333360", borderRadius: 2 }}><div style={{ width: `${level / 5 * 100}%`, height: "100%", background: c, borderRadius: 2 }} /></div>;
}

// ── Şablon 1: Komando ────────────────────────────────────────────────────────
function TKomando({ data, photo, color }: TP) {
  const full = `${data.ad} ${data.soyad}`.trim() || "AD SOYAD";
  const parts = full.split(" "); const sn = parts.pop() || ""; const fn = parts.join(" ");
  return (
    <div style={{ background: "#0D0D1A", color: "#fff", fontFamily: "Arial,sans-serif", width: "210mm", minHeight: "297mm", boxSizing: "border-box" }}>
      {/* Header */}
      <div style={{ background: `linear-gradient(135deg,#1a1a2e,#0D0D1A)`, padding: "20px 24px", borderBottom: `3px solid ${color}`, display: "flex", gap: 18 }}>
        <PhotoBox photo={photo} name={full} color={color} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 30, fontWeight: 900, textTransform: "uppercase" as const, letterSpacing: 2, lineHeight: 1.1 }}>
            {fn && <span style={{ color: "#fff" }}>{fn} </span>}<span style={{ color }}>{sn}</span>
          </div>
          <div style={{ fontSize: 11, color, letterSpacing: 3, textTransform: "uppercase" as const, marginTop: 4, fontWeight: 600 }}>{data.pozisyon}</div>
          {data.hakkimda && <p style={{ fontSize: 9, color: "#aaa", marginTop: 8, lineHeight: 1.6, maxWidth: 340, margin: "8px 0 0" }}>{data.hakkimda}</p>}
          <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 10, marginTop: 10 }}>
            {data.ozellikler.slice(0, 5).map(o => (
              <div key={o} style={{ textAlign: "center" as const }}>
                <div style={{ width: 28, height: 28, background: `${color}20`, border: `1px solid ${color}`, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 2px", fontSize: 12 }}>🛡</div>
                <span style={{ fontSize: 7, color, textTransform: "uppercase" as const }}>{o}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Body */}
      <div style={{ display: "flex" }}>
        <div style={{ width: "36%", background: "#111122", padding: "16px 14px", borderRight: `1px solid ${color}30` }}>
          <Sec title="KİŞİSEL BİLGİLER" c={color}>
            {data.dogumTarihi && <Inf l="Doğum Tarihi" v={data.dogumTarihi} />}
            {data.medeniDurum && <Inf l="Medeni Durum" v={data.medeniDurum} />}
            {(data.boy || data.kilo) && <Inf l="Boy / Kilo" v={`${data.boy} cm / ${data.kilo} kg`} />}
            {data.adres && <Inf l="Adres" v={data.adres} />}
          </Sec>
          <Sec title="İLETİŞİM" c={color}>
            {data.telefon && <Inf l="📞 Telefon" v={data.telefon} />}
            {data.email && <Inf l="✉ E-posta" v={data.email} />}
          </Sec>
          <Sec title="YETENEKLER" c={color}>
            {data.yetenekler.filter(s => s.name).map(s => (
              <div key={s.id} style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 9, color: "#ccc", marginBottom: 2 }}>{s.name}</div>
                <Bar level={s.level} c={color} />
              </div>
            ))}
          </Sec>
          {data.hobiler && <Sec title="HOBİLER" c={color}><div style={{ display: "flex", flexWrap: "wrap" as const, gap: 4 }}>{data.hobiler.split(",").map(h => h.trim()).filter(Boolean).map(h => <span key={h} style={{ fontSize: 8, background: `${color}18`, border: `1px solid ${color}40`, color, padding: "2px 7px", borderRadius: 10 }}>{h}</span>)}</div></Sec>}
        </div>
        <div style={{ flex: 1, padding: "16px 18px" }}>
          {data.deneyimler.some(d => d.title) && (
            <Sec title="DENEYİM" c={color}>
              {data.deneyimler.filter(d => d.title).map((d, i, arr) => (
                <div key={d.id} style={{ display: "flex", gap: 10, marginBottom: 14 }}>
                  <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "center" }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0 }} />
                    {i < arr.length - 1 && <div style={{ width: 1, flex: 1, background: `${color}40`, marginTop: 3 }} />}
                  </div>
                  <div style={{ flex: 1, paddingBottom: i < arr.length - 1 ? 6 : 0 }}>
                    <div style={{ fontSize: 8, color: "#888" }}>{d.period}</div>
                    <div style={{ fontSize: 11, fontWeight: 700 }}>{d.title}</div>
                    <div style={{ fontSize: 9, color, marginBottom: 3 }}>{d.company}</div>
                    {d.desc && <p style={{ fontSize: 9, color: "#aaa", margin: 0, lineHeight: 1.5 }}>{d.desc}</p>}
                  </div>
                </div>
              ))}
            </Sec>
          )}
          {data.ozellikler.length > 0 && (
            <Sec title="ÖZELLİKLERİM" c={color}>
              <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 5 }}>
                {data.ozellikler.map(o => <span key={o} style={{ fontSize: 8, background: `${color}15`, border: `1px solid ${color}50`, color: "#ccc", padding: "3px 8px", borderRadius: 4 }}>✔ {o}</span>)}
              </div>
            </Sec>
          )}
        </div>
      </div>
      <div style={{ background: "#0a0a16", borderTop: `2px solid ${color}`, padding: "9px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color, fontSize: 13 }}>★★★★★</span>
        <span style={{ fontSize: 9, color, letterSpacing: 2 }}>{data.motto}</span>
        <span style={{ color, fontSize: 13 }}>★★★★★</span>
      </div>
    </div>
  );
}

// ── Şablon 2: VIP Koruma (Lüks) ──────────────────────────────────────────────
function TVIP({ data, photo, color }: TP) {
  const full = `${data.ad} ${data.soyad}`.trim() || "AD SOYAD";
  return (
    <div style={{ background: "#080808", color: "#fff", fontFamily: "Georgia,serif", width: "210mm", minHeight: "297mm", boxSizing: "border-box" }}>
      <div style={{ background: `linear-gradient(180deg,${color}18,#080808)`, padding: "28px 28px 20px", borderBottom: `1px solid ${color}`, display: "flex", gap: 24, alignItems: "center" }}>
        <PhotoBox photo={photo} name={full} color={color} />
        <div>
          <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: 4, textTransform: "uppercase" as const, color, lineHeight: 1.1 }}>{full}</div>
          <div style={{ width: 60, height: 2, background: color, margin: "10px 0" }} />
          <div style={{ fontSize: 11, letterSpacing: 5, textTransform: "uppercase" as const, color: "#888" }}>{data.pozisyon}</div>
          {data.hakkimda && <p style={{ fontSize: 10, color: "#aaa", marginTop: 12, lineHeight: 1.7, maxWidth: 360, fontStyle: "italic" }}>"{data.hakkimda}"</p>}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
        <div style={{ padding: "20px 18px", borderRight: "1px solid #222" }}>
          <Sec title="KİŞİSEL" c={color}>
            {data.dogumTarihi && <Inf l="Doğum Tarihi" v={data.dogumTarihi} />}
            {data.medeniDurum && <Inf l="Medeni Durum" v={data.medeniDurum} />}
            {(data.boy || data.kilo) && <Inf l="Boy / Kilo" v={`${data.boy} cm / ${data.kilo} kg`} />}
            {data.adres && <Inf l="Adres" v={data.adres} />}
            {data.telefon && <Inf l="Telefon" v={data.telefon} />}
            {data.email && <Inf l="E-posta" v={data.email} />}
          </Sec>
          <Sec title="YETENEKLER" c={color}>
            {data.yetenekler.filter(s => s.name).map(s => (
              <div key={s.id} style={{ marginBottom: 7 }}>
                <div style={{ fontSize: 9, color: "#ccc", marginBottom: 2 }}>{s.name}</div>
                <Bar level={s.level} c={color} />
              </div>
            ))}
          </Sec>
          <Sec title="HOBİLER" c={color}><p style={{ fontSize: 9, color: "#aaa", lineHeight: 1.6, margin: 0 }}>{data.hobiler || "—"}</p></Sec>
        </div>
        <div style={{ padding: "20px 18px" }}>
          <Sec title="DENEYİM" c={color}>
            {data.deneyimler.filter(d => d.title).map(d => (
              <div key={d.id} style={{ borderLeft: `2px solid ${color}`, paddingLeft: 10, marginBottom: 14 }}>
                <div style={{ fontSize: 9, color }}>{d.period}</div>
                <div style={{ fontSize: 11, fontWeight: 700 }}>{d.title}</div>
                <div style={{ fontSize: 9, color: "#888", marginBottom: 3 }}>{d.company}</div>
                {d.desc && <p style={{ fontSize: 9, color: "#aaa", margin: 0, lineHeight: 1.5 }}>{d.desc}</p>}
              </div>
            ))}
          </Sec>
          <Sec title="ÖZELLİKLER" c={color}><div style={{ display: "flex", flexWrap: "wrap" as const, gap: 5 }}>{data.ozellikler.map(o => <span key={o} style={{ fontSize: 8, color: "#888" }}>◆ {o}</span>)}</div></Sec>
        </div>
      </div>
      <div style={{ borderTop: `1px solid ${color}`, padding: "8px 28px", textAlign: "center" as const }}><span style={{ fontSize: 9, color: `${color}90`, letterSpacing: 3 }}>{data.motto}</span></div>
    </div>
  );
}

// ── Şablon 3: Mavi Baret (Profesyonel) ───────────────────────────────────────
function TMaviBaret({ data, photo, color }: TP) {
  const full = `${data.ad} ${data.soyad}`.trim() || "AD SOYAD";
  return (
    <div style={{ background: "#0A1628", color: "#fff", fontFamily: "Arial,sans-serif", width: "210mm", minHeight: "297mm", boxSizing: "border-box" }}>
      <div style={{ background: color, padding: "20px 26px", display: "flex", gap: 18, alignItems: "center" }}>
        <PhotoBox photo={photo} name={full} color="#fff" circle />
        <div>
          <div style={{ fontSize: 24, fontWeight: 900, textTransform: "uppercase" as const, color: "#fff" }}>{data.ad} {data.soyad}</div>
          <div style={{ fontSize: 10, color: "#ffffffcc", letterSpacing: 2, textTransform: "uppercase" as const, marginTop: 4 }}>{data.pozisyon}</div>
          {data.hakkimda && <p style={{ fontSize: 9, color: "#ffffffcc", marginTop: 8, lineHeight: 1.5, maxWidth: 380, margin: "8px 0 0" }}>{data.hakkimda}</p>}
        </div>
      </div>
      <div style={{ background: `${color}18`, padding: "6px 22px", display: "flex", gap: 16, borderBottom: `1px solid ${color}40` }}>
        {data.telefon && <span style={{ fontSize: 9, color }}>📞 {data.telefon}</span>}
        {data.email && <span style={{ fontSize: 9, color }}>✉ {data.email}</span>}
        {data.adres && <span style={{ fontSize: 9, color }}>📍 {data.adres}</span>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "38% 62%" }}>
        <div style={{ background: "#0d1e35", padding: "14px 13px" }}>
          <Sec title="KİŞİSEL" c={color}>
            {data.dogumTarihi && <Inf l="Doğum" v={data.dogumTarihi} />}
            {data.medeniDurum && <Inf l="Medeni" v={data.medeniDurum} />}
            {(data.boy || data.kilo) && <Inf l="Boy/Kilo" v={`${data.boy}/${data.kilo}`} />}
          </Sec>
          <Sec title="YETENEKLER" c={color}>
            {data.yetenekler.filter(s => s.name).map(s => (
              <div key={s.id} style={{ marginBottom: 7 }}>
                <div style={{ fontSize: 9, color: "#ccc", marginBottom: 2 }}>{s.name}</div>
                <div style={{ height: 5, background: "#1a3a5c", borderRadius: 3 }}><div style={{ width: `${s.level / 5 * 100}%`, height: "100%", background: color, borderRadius: 3 }} /></div>
              </div>
            ))}
          </Sec>
          <Sec title="HOBİLER" c={color}><div style={{ display: "flex", flexWrap: "wrap" as const, gap: 4 }}>{(data.hobiler || "").split(",").map(h => h.trim()).filter(Boolean).map(h => <span key={h} style={{ fontSize: 8, background: `${color}22`, border: `1px solid ${color}50`, color, padding: "2px 7px", borderRadius: 10 }}>{h}</span>)}</div></Sec>
        </div>
        <div style={{ padding: "14px 16px" }}>
          <Sec title="DENEYİM" c={color}>
            {data.deneyimler.filter(d => d.title).map(d => (
              <div key={d.id} style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                <div style={{ width: 3, background: color, borderRadius: 2, flexShrink: 0, margin: "2px 0" }} />
                <div><div style={{ fontSize: 9, color }}>{d.period}</div><div style={{ fontSize: 11, fontWeight: 700 }}>{d.title}</div><div style={{ fontSize: 9, color: "#888" }}>{d.company}</div>{d.desc && <p style={{ fontSize: 9, color: "#aaa", margin: "2px 0 0", lineHeight: 1.5 }}>{d.desc}</p>}</div>
              </div>
            ))}
          </Sec>
          <Sec title="ÖZELLİKLERİM" c={color}><div style={{ display: "flex", flexWrap: "wrap" as const, gap: 5 }}>{data.ozellikler.map(o => <span key={o} style={{ fontSize: 8, background: `${color}18`, border: `1px solid ${color}40`, color: "#ccc", padding: "3px 8px", borderRadius: 4 }}>✔ {o}</span>)}</div></Sec>
        </div>
      </div>
      <div style={{ background: color, padding: "8px 24px", textAlign: "center" as const }}><span style={{ fontSize: 9, color: "#fff", fontWeight: 700, letterSpacing: 2 }}>{data.motto}</span></div>
    </div>
  );
}

// ── Şablon 4: Kurumsal (Açık Zemin) ──────────────────────────────────────────
function TKurumsal({ data, photo, color }: TP) {
  const full = `${data.ad} ${data.soyad}`.trim() || "AD SOYAD";
  return (
    <div style={{ background: "#f0f4f8", color: "#1e293b", fontFamily: "Arial,sans-serif", width: "210mm", minHeight: "297mm", boxSizing: "border-box" }}>
      <div style={{ background: "#1e293b", padding: "20px 26px", display: "flex", gap: 20, alignItems: "center" }}>
        <PhotoBox photo={photo} name={full} color={color} />
        <div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "#fff" }}>{data.ad} <span style={{ color }}>{data.soyad}</span></div>
          <div style={{ fontSize: 10, color, letterSpacing: 2, textTransform: "uppercase" as const, marginTop: 4 }}>{data.pozisyon}</div>
          {data.hakkimda && <p style={{ fontSize: 9, color: "#94a3b8", marginTop: 8, lineHeight: 1.5, maxWidth: 380, margin: "8px 0 0" }}>{data.hakkimda}</p>}
        </div>
      </div>
      <div style={{ background: "#e2e8f0", padding: "6px 22px", display: "flex", gap: 16, borderBottom: "1px solid #cbd5e1" }}>
        {data.telefon && <span style={{ fontSize: 9, color }}>📞 {data.telefon}</span>}
        {data.email && <span style={{ fontSize: 9, color }}>✉ {data.email}</span>}
        {data.adres && <span style={{ fontSize: 9, color }}>📍 {data.adres}</span>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "35% 65%" }}>
        <div style={{ background: "#1e293b", padding: "14px 13px" }}>
          <Sec title="KİŞİSEL" c={color}>
            {data.dogumTarihi && <Inf l="Doğum" v={data.dogumTarihi} />}
            {data.medeniDurum && <Inf l="Medeni" v={data.medeniDurum} />}
            {(data.boy || data.kilo) && <Inf l="Boy/Kilo" v={`${data.boy}cm/${data.kilo}kg`} />}
          </Sec>
          <Sec title="YETENEKLER" c={color}>
            {data.yetenekler.filter(s => s.name).map(s => (
              <div key={s.id} style={{ marginBottom: 7 }}>
                <div style={{ fontSize: 9, color: "#94a3b8", marginBottom: 2 }}>{s.name}</div>
                <div style={{ height: 4, background: "#334155", borderRadius: 2 }}><div style={{ width: `${s.level / 5 * 100}%`, height: "100%", background: color, borderRadius: 2 }} /></div>
              </div>
            ))}
          </Sec>
          <Sec title="HOBİLER" c={color}><div style={{ display: "flex", flexWrap: "wrap" as const, gap: 4 }}>{(data.hobiler || "").split(",").map(h => h.trim()).filter(Boolean).map(h => <div key={h} style={{ fontSize: 9, color: "#94a3b8" }}>▸ {h}</div>)}</div></Sec>
        </div>
        <div style={{ padding: "14px 16px" }}>
          <Sec title="DENEYİM" c={color}>
            {data.deneyimler.filter(d => d.title).map(d => (
              <div key={d.id} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 6, padding: "9px 12px", marginBottom: 10, borderLeft: `3px solid ${color}` }}>
                <div style={{ fontSize: 9, color, fontWeight: 700 }}>{d.period}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#1e293b" }}>{d.title}</div>
                <div style={{ fontSize: 9, color: "#64748b" }}>{d.company}</div>
                {d.desc && <p style={{ fontSize: 9, color: "#475569", margin: "4px 0 0", lineHeight: 1.5 }}>{d.desc}</p>}
              </div>
            ))}
          </Sec>
          <Sec title="ÖZELLİKLER" c={color}><div style={{ display: "flex", flexWrap: "wrap" as const, gap: 5 }}>{data.ozellikler.map(o => <div key={o} style={{ fontSize: 9, color: "#475569" }}>✔ {o}</div>)}</div></Sec>
        </div>
      </div>
      <div style={{ background: color, padding: "8px 24px", textAlign: "center" as const }}><span style={{ fontSize: 9, color: "#fff", letterSpacing: 2 }}>{data.motto}</span></div>
    </div>
  );
}

// ── Şablon 5: Dikey Çizgili (Premium) ────────────────────────────────────────
function TPremium({ data, photo, color }: TP) {
  const full = `${data.ad} ${data.soyad}`.trim() || "AD SOYAD";
  return (
    <div style={{ background: "#111827", color: "#fff", fontFamily: "Arial,sans-serif", width: "210mm", minHeight: "297mm", boxSizing: "border-box", display: "flex" }}>
      {/* Sol şerit */}
      <div style={{ width: "38%", background: `linear-gradient(180deg,${color}22,#0a0a14)`, padding: "24px 16px", borderRight: `2px solid ${color}50` }}>
        <div style={{ textAlign: "center" as const, marginBottom: 18 }}>
          <PhotoBox photo={photo} name={full} color={color} circle />
          <div style={{ fontSize: 16, fontWeight: 900, color, textTransform: "uppercase" as const, marginTop: 10, letterSpacing: 1 }}>{data.ad}</div>
          <div style={{ fontSize: 16, fontWeight: 900, color: "#fff", textTransform: "uppercase" as const, letterSpacing: 1 }}>{data.soyad}</div>
          <div style={{ fontSize: 9, color: `${color}cc`, letterSpacing: 2, textTransform: "uppercase" as const, marginTop: 4 }}>{data.pozisyon}</div>
        </div>
        <Sec title="KİŞİSEL" c={color}>
          {data.dogumTarihi && <Inf l="Doğum" v={data.dogumTarihi} />}
          {data.medeniDurum && <Inf l="Medeni" v={data.medeniDurum} />}
          {(data.boy || data.kilo) && <Inf l="Boy/Kilo" v={`${data.boy} / ${data.kilo}`} />}
          {data.adres && <Inf l="Adres" v={data.adres} />}
          {data.telefon && <Inf l="Tel" v={data.telefon} />}
          {data.email && <Inf l="E-posta" v={data.email} />}
        </Sec>
        <Sec title="YETENEKLER" c={color}>
          {data.yetenekler.filter(s => s.name).map(s => (
            <div key={s.id} style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between" as const, fontSize: 9, color: "#ccc", marginBottom: 2 }}><span>{s.name}</span><span style={{ color }}>{"★".repeat(s.level)}{"☆".repeat(5 - s.level)}</span></div>
              <Bar level={s.level} c={color} />
            </div>
          ))}
        </Sec>
        <Sec title="HOBİLER" c={color}><div style={{ display: "flex", flexWrap: "wrap" as const, gap: 4 }}>{(data.hobiler || "").split(",").map(h => h.trim()).filter(Boolean).map(h => <span key={h} style={{ fontSize: 8, background: `${color}20`, color, padding: "2px 7px", borderRadius: 10, border: `1px solid ${color}40` }}>{h}</span>)}</div></Sec>
      </div>
      {/* Sağ ana */}
      <div style={{ flex: 1, padding: "24px 18px" }}>
        {data.hakkimda && (
          <div style={{ background: `${color}15`, border: `1px solid ${color}30`, borderRadius: 8, padding: "12px 14px", marginBottom: 16 }}>
            <div style={{ fontSize: 8, color, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" as const, marginBottom: 6 }}>HAKKIMDA</div>
            <p style={{ fontSize: 9, color: "#aaa", lineHeight: 1.6, margin: 0 }}>{data.hakkimda}</p>
          </div>
        )}
        <Sec title="DENEYİM" c={color}>
          {data.deneyimler.filter(d => d.title).map((d, i, arr) => (
            <div key={d.id} style={{ display: "flex", gap: 10, marginBottom: 14 }}>
              <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "center" }}>
                <div style={{ width: 12, height: 12, borderRadius: "50%", background: color, border: `2px solid ${color}`, flexShrink: 0 }} />
                {i < arr.length - 1 && <div style={{ width: 1, flex: 1, background: `${color}30`, marginTop: 3 }} />}
              </div>
              <div style={{ flex: 1, paddingBottom: i < arr.length - 1 ? 6 : 0 }}>
                <div style={{ fontSize: 9, color: `${color}cc` }}>{d.period}</div>
                <div style={{ fontSize: 12, fontWeight: 700 }}>{d.title}</div>
                <div style={{ fontSize: 9, color, marginBottom: 3 }}>{d.company}</div>
                {d.desc && <p style={{ fontSize: 9, color: "#aaa", margin: 0, lineHeight: 1.5 }}>{d.desc}</p>}
              </div>
            </div>
          ))}
        </Sec>
        <Sec title="ÖZELLİKLERİM" c={color}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {data.ozellikler.map(o => (
              <div key={o} style={{ display: "flex", alignItems: "center", gap: 5, background: `${color}10`, borderRadius: 6, padding: "5px 8px" }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
                <span style={{ fontSize: 9, color: "#ccc" }}>{o}</span>
              </div>
            ))}
          </div>
        </Sec>
      </div>
    </div>
  );
}

// ── Şablon 6: Modern Tech ─────────────────────────────────────────────────────
function TModern({ data, photo, color }: TP) {
  const full = `${data.ad} ${data.soyad}`.trim() || "AD SOYAD";
  return (
    <div style={{ background: "#0F172A", color: "#fff", fontFamily: "Arial,sans-serif", width: "210mm", minHeight: "297mm", boxSizing: "border-box" }}>
      <div style={{ background: `linear-gradient(135deg,${color},${color}88)`, padding: "20px 26px", display: "flex", gap: 18, alignItems: "center" }}>
        <PhotoBox photo={photo} name={full} color="#fff" circle />
        <div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "#fff" }}>{data.ad} <span style={{ color: "#ffffffcc" }}>{data.soyad}</span></div>
          <div style={{ fontSize: 10, color: "#ffffffcc", letterSpacing: 3, textTransform: "uppercase" as const, marginTop: 4 }}>{data.pozisyon}</div>
          {data.hakkimda && <p style={{ fontSize: 9, color: "#ffffffcc", marginTop: 8, lineHeight: 1.6, maxWidth: 380, margin: "8px 0 0" }}>{data.hakkimda}</p>}
          <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 5, marginTop: 8 }}>{data.ozellikler.slice(0, 4).map(o => <span key={o} style={{ fontSize: 8, background: "rgba(255,255,255,0.18)", color: "#fff", padding: "2px 8px", borderRadius: 10 }}>{o}</span>)}</div>
        </div>
      </div>
      <div style={{ background: "#0a0f1e", padding: "6px 22px", display: "flex", gap: 16, borderBottom: `1px solid ${color}40` }}>
        {data.telefon && <span style={{ fontSize: 9, color }}>📞 {data.telefon}</span>}
        {data.email && <span style={{ fontSize: 9, color }}>✉ {data.email}</span>}
        {data.adres && <span style={{ fontSize: 9, color }}>📍 {data.adres}</span>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "38% 62%" }}>
        <div style={{ background: "#1e1b4b", padding: "14px 13px" }}>
          <Sec title="KİŞİSEL" c={color}>
            {data.dogumTarihi && <Inf l="Doğum" v={data.dogumTarihi} />}
            {data.medeniDurum && <Inf l="Medeni" v={data.medeniDurum} />}
            {(data.boy || data.kilo) && <Inf l="Boy/Kilo" v={`${data.boy} / ${data.kilo}`} />}
          </Sec>
          <Sec title="YETENEKLER" c={color}>
            {data.yetenekler.filter(s => s.name).map(s => (
              <div key={s.id} style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 9, color: "#a5b4fc", marginBottom: 2 }}>{s.name}</div>
                <div style={{ height: 5, background: "#312e81", borderRadius: 3 }}><div style={{ width: `${s.level / 5 * 100}%`, height: "100%", background: color, borderRadius: 3 }} /></div>
              </div>
            ))}
          </Sec>
          <Sec title="HOBİLER" c={color}><div style={{ display: "flex", flexWrap: "wrap" as const, gap: 4 }}>{(data.hobiler || "").split(",").map(h => h.trim()).filter(Boolean).map(h => <span key={h} style={{ fontSize: 8, background: "#312e81", color: "#a5b4fc", padding: "2px 7px", borderRadius: 8 }}>{h}</span>)}</div></Sec>
        </div>
        <div style={{ padding: "14px 16px" }}>
          <Sec title="DENEYİM" c={color}>
            {data.deneyimler.filter(d => d.title).map(d => (
              <div key={d.id} style={{ background: "#1e293b", borderRadius: 8, padding: "9px 12px", marginBottom: 10, borderLeft: `3px solid ${color}` }}>
                <div style={{ fontSize: 9, color }}>{d.period}</div>
                <div style={{ fontSize: 11, fontWeight: 700 }}>{d.title}</div>
                <div style={{ fontSize: 9, color: "#64748b" }}>{d.company}</div>
                {d.desc && <p style={{ fontSize: 9, color: "#94a3b8", margin: "4px 0 0", lineHeight: 1.5 }}>{d.desc}</p>}
              </div>
            ))}
          </Sec>
          <Sec title="ÖZELLİKLERİM" c={color}><div style={{ display: "flex", flexWrap: "wrap" as const, gap: 5 }}>{data.ozellikler.map(o => <span key={o} style={{ fontSize: 8, background: `${color}20`, border: `1px solid ${color}40`, color, padding: "2px 8px", borderRadius: 8 }}>✦ {o}</span>)}</div></Sec>
        </div>
      </div>
      <div style={{ background: color, padding: "8px 24px", textAlign: "center" as const }}><span style={{ fontSize: 9, color: "#fff", letterSpacing: 2 }}>{data.motto}</span></div>
    </div>
  );
}

const TEMPLATES = [
  { id: 0, name: "Komando",   desc: "Askeri koyu",       C: TKomando  },
  { id: 1, name: "VIP Koruma", desc: "Lüks siyah",       C: TVIP      },
  { id: 2, name: "Baret",     desc: "Renkli header",      C: TMaviBaret },
  { id: 3, name: "Kurumsal",  desc: "Açık zemin",         C: TKurumsal },
  { id: 4, name: "Premium",   desc: "Dikey iki sütun",    C: TPremium  },
  { id: 5, name: "Modern",    desc: "Gradient teknoloji", C: TModern   },
];

// ── Stabil input bileşeni ─────────────────────────────────────────────────────
const FInput = React.memo(function FI({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder || ""}
        className="w-full bg-card border border-white/10 rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary/50 transition-colors" />
    </div>
  );
});

// ── Ana Bileşen ───────────────────────────────────────────────────────────────
export default function CvOlustur() {
  const [step, setStep]                     = useState(1);
  const [selTpl, setSelTpl]                 = useState(0);
  const [selColor, setSelColor]             = useState(0);   // PALETTE index
  const [photo, setPhoto]                   = useState("");
  const [data, setData]                     = useState<CVData>(INITIAL);
  const [isAutoFilling, setIsAutoFilling]   = useState(false);
  const [isDownloading, setIsDownloading]   = useState(false);
  const [showPreview, setShowPreview]       = useState(false);
  const cvRef = useRef<HTMLDivElement>(null);

  const color = PALETTE[selColor]!.c;
  const Tmpl  = TEMPLATES[selTpl]!.C;

  const upd = useCallback(<K extends keyof CVData>(key: K, val: CVData[K]) =>
    setData(p => ({ ...p, [key]: val })), []);

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setPhoto(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  // ── Yapay Zeka ile Otomatik Doldur ─────────────────────────────────────────
  const handleAutoFill = useCallback(() => {
    setIsAutoFilling(true);
    setTimeout(() => {
      setData(prev => fullAutoFill(prev.pozisyon, prev));
      setIsAutoFilling(false);
    }, 900);
  }, []);

  // ── İndir ────────────────────────────────────────────────────────────────────
  const handleDownload = async () => {
    if (!cvRef.current) return;
    setIsDownloading(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const jsPDF       = (await import("jspdf")).default;
      const canvas = await html2canvas(cvRef.current, { scale: 2, useCORS: true });
      const pdf    = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, 210, 210 * (canvas.height / canvas.width));
      pdf.save(`${data.ad || "CV"}_${data.soyad || "Guvenlik"}.pdf`);
    } catch { window.print(); }
    finally { setIsDownloading(false); }
  };

  // ── Deneyim İşlemleri ──────────────────────────────────────────────────────
  const addDeneyim    = useCallback(() => setData(p => ({ ...p, deneyimler: [...p.deneyimler, { id: Date.now(), title: "", company: "", period: "", desc: "" }] })), []);
  const removeDeneyim = useCallback((id: number) => setData(p => ({ ...p, deneyimler: p.deneyimler.filter(d => d.id !== id) })), []);
  const updDeneyim    = useCallback((id: number, field: keyof Experience, val: string) => setData(p => ({ ...p, deneyimler: p.deneyimler.map(d => d.id === id ? { ...d, [field]: val } : d) })), []);

  // ── Yetenek İşlemleri ──────────────────────────────────────────────────────
  const addSkill    = useCallback(() => setData(p => ({ ...p, yetenekler: [...p.yetenekler, { id: Date.now(), name: "", level: 4 }] })), []);
  const removeSkill = useCallback((id: number) => setData(p => ({ ...p, yetenekler: p.yetenekler.filter(s => s.id !== id) })), []);
  const updSkill    = useCallback((id: number, field: keyof Skill, val: string | number) => setData(p => ({ ...p, yetenekler: p.yetenekler.map(s => s.id === id ? { ...s, [field]: val } : s) })), []);
  const toggleOzellik = useCallback((o: string) => setData(p => ({ ...p, ozellikler: p.ozellikler.includes(o) ? p.ozellikler.filter(x => x !== o) : p.ozellikler.length < 8 ? [...p.ozellikler, o] : p.ozellikler })), []);

  const STEP_LABELS = ["Kişisel", "Deneyim", "Yetenekler", "Önizleme"];

  return (
    <Layout>
      <div className="p-4 pb-8">

        {/* Adım Göstergesi */}
        <div className="flex items-center justify-between mb-4">
          {STEP_LABELS.map((lbl, i) => (
            <React.Fragment key={i}>
              <div className="flex flex-col items-center gap-1 cursor-pointer" onClick={() => setStep(i + 1)}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${step === i + 1 ? "bg-primary text-white" : step > i + 1 ? "bg-green-500/20 text-green-400 border border-green-500/40" : "bg-card border border-white/10 text-muted-foreground"}`}>
                  {step > i + 1 ? <Check className="w-4 h-4" /> : i + 1}
                </div>
                <span className={`text-[10px] ${step === i + 1 ? "text-primary font-semibold" : "text-muted-foreground"}`}>{lbl}</span>
              </div>
              {i < STEP_LABELS.length - 1 && <div className={`h-px flex-1 mx-1 mb-4 ${step > i + 1 ? "bg-green-500/40" : "bg-white/10"}`} />}
            </React.Fragment>
          ))}
        </div>

        {/* ─── Yapay Zeka Banner ─── */}
        <button onClick={handleAutoFill} disabled={isAutoFilling}
          className="w-full mb-4 flex items-center justify-center gap-2 py-3.5 rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 to-secondary/10 hover:from-primary/20 hover:to-secondary/20 transition-all disabled:opacity-60">
          <Wand2 className={`w-4 h-4 text-primary ${isAutoFilling ? "animate-spin" : ""}`} />
          <span className="text-sm font-bold text-primary">{isAutoFilling ? "Yapay Zeka Dolduruyor..." : "Yapay Zeka ile Otomatik Doldur"}</span>
          <Sparkles className="w-3.5 h-3.5 text-secondary" />
        </button>

        <h1 className="text-lg font-extrabold mb-4">{step < 4 ? `${step}. Adım — ${STEP_LABELS[step - 1]}` : "Şablon & Önizleme"}</h1>

        {/* ── ADIM 1 ─────────────────────────────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-2">
              <label className="cursor-pointer">
                <div className="w-24 h-28 rounded-xl border-2 border-dashed border-primary/40 flex flex-col items-center justify-center bg-card overflow-hidden hover:border-primary transition-colors">
                  {photo ? <img src={photo} className="w-full h-full object-cover" alt="foto" /> : <><Upload className="w-6 h-6 text-muted-foreground mb-1" /><span className="text-[10px] text-muted-foreground text-center px-2">Fotoğraf Ekle</span></>}
                </div>
                <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
              </label>
              {photo && <button onClick={() => setPhoto("")} className="text-[11px] text-destructive">Kaldır</button>}
              <p className="text-[10px] text-muted-foreground">Fotoğraf zorunlu değil — fotoğrafsız da oluşturulur</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FInput label="Ad" value={data.ad} onChange={v => upd("ad", v)} />
              <FInput label="Soyad" value={data.soyad} onChange={v => upd("soyad", v)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Pozisyon</label>
              <select value={data.pozisyon} onChange={e => upd("pozisyon", e.target.value)}
                className="w-full bg-card border border-white/10 rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary/50">
                {POZISYONLAR.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FInput label="Doğum Tarihi" value={data.dogumTarihi} onChange={v => upd("dogumTarihi", v)} placeholder="10.09.1990" />
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Medeni Durum</label>
                <select value={data.medeniDurum} onChange={e => upd("medeniDurum", e.target.value)}
                  className="w-full bg-card border border-white/10 rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary/50">
                  {["Bekar", "Evli", "Boşanmış"].map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FInput label="Boy (cm)" value={data.boy} onChange={v => upd("boy", v)} placeholder="175" />
              <FInput label="Kilo (kg)" value={data.kilo} onChange={v => upd("kilo", v)} placeholder="80" />
            </div>
            <FInput label="Adres" value={data.adres} onChange={v => upd("adres", v)} placeholder="Mahalle, İlçe / Şehir" />
            <div className="grid grid-cols-2 gap-3">
              <FInput label="Telefon" value={data.telefon} onChange={v => upd("telefon", v)} placeholder="0555 555 55 55" />
              <FInput label="E-posta" value={data.email} onChange={v => upd("email", v)} placeholder="ornek@mail.com" />
            </div>
          </div>
        )}

        {/* ── ADIM 2 ─────────────────────────────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Hakkımda</label>
              <textarea value={data.hakkimda} onChange={e => upd("hakkimda", e.target.value)} rows={4}
                placeholder="'Yapay Zeka ile Otomatik Doldur' butonuna basın veya kendiniz yazın..."
                className="w-full bg-card border border-white/10 rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary/50 resize-none" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold">Deneyimler</label>
                <button onClick={addDeneyim} className="flex items-center gap-1 text-[11px] text-accent"><Plus className="w-3.5 h-3.5" /> Ekle</button>
              </div>
              {data.deneyimler.map((d, i) => (
                <div key={d.id} className="glass-card rounded-xl p-3 mb-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">{i + 1}. Deneyim</span>
                    {data.deneyimler.length > 1 && <button onClick={() => removeDeneyim(d.id)} className="text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className="block text-[10px] text-muted-foreground mb-1">Görev/Unvan</label><input value={d.title} onChange={e => updDeneyim(d.id, "title", e.target.value)} className="w-full bg-background/50 border border-white/10 rounded-lg px-2.5 py-2 text-sm text-foreground outline-none" /></div>
                    <div><label className="block text-[10px] text-muted-foreground mb-1">Şirket/Kurum</label><input value={d.company} onChange={e => updDeneyim(d.id, "company", e.target.value)} className="w-full bg-background/50 border border-white/10 rounded-lg px-2.5 py-2 text-sm text-foreground outline-none" /></div>
                  </div>
                  <div><label className="block text-[10px] text-muted-foreground mb-1">Dönem</label><input value={d.period} onChange={e => updDeneyim(d.id, "period", e.target.value)} className="w-full bg-background/50 border border-white/10 rounded-lg px-2.5 py-2 text-sm text-foreground outline-none" /></div>
                  <div><label className="block text-[10px] text-muted-foreground mb-1">Açıklama</label><textarea value={d.desc} onChange={e => updDeneyim(d.id, "desc", e.target.value)} rows={2} className="w-full bg-background/50 border border-white/10 rounded-lg px-2.5 py-2 text-sm text-foreground outline-none resize-none" /></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── ADIM 3 ─────────────────────────────────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-5">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold">Yetenekler</label>
                <button onClick={addSkill} className="flex items-center gap-1 text-[11px] text-accent"><Plus className="w-3.5 h-3.5" /> Ekle</button>
              </div>
              {data.yetenekler.map(s => (
                <div key={s.id} className="flex items-center gap-2 mb-2">
                  <input value={s.name} onChange={e => updSkill(s.id, "name", e.target.value)} placeholder="Yetenek adı"
                    className="flex-1 bg-card border border-white/10 rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50" />
                  <select value={s.level} onChange={e => updSkill(s.id, "level", Number(e.target.value))}
                    className="bg-card border border-white/10 rounded-lg px-2 py-2 text-sm text-foreground outline-none w-20">
                    {[1, 2, 3, 4, 5].map(l => <option key={l} value={l}>{l}/5</option>)}
                  </select>
                  {data.yetenekler.length > 1 && <button onClick={() => removeSkill(s.id)} className="text-destructive shrink-0"><Trash2 className="w-4 h-4" /></button>}
                </div>
              ))}
            </div>
            <FInput label="Hobiler (virgülle ayırın)" value={data.hobiler} onChange={v => upd("hobiler", v)} placeholder="Spor Yapmak, Müzik, Yüzme" />
            <div>
              <label className="text-xs font-bold block mb-2">Kişilik Özellikleri (en fazla 8)</label>
              <div className="flex flex-wrap gap-2">
                {OZELLIK_LISTESI.map(o => {
                  const sel = data.ozellikler.includes(o);
                  return (
                    <button key={o} onClick={() => toggleOzellik(o)}
                      className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border transition-all ${sel ? "bg-primary/20 border-primary text-primary" : "bg-card border-white/10 text-muted-foreground hover:border-primary/30"}`}>
                      {sel && <Check className="w-3 h-3" />}{o}
                    </button>
                  );
                })}
              </div>
            </div>
            <FInput label="Motto / İmza Cümlesi" value={data.motto} onChange={v => upd("motto", v)} />
          </div>
        )}

        {/* ── ADIM 4 ─────────────────────────────────────────────────────────── */}
        {step === 4 && (
          <div className="space-y-4">
            {/* Şablon Seç */}
            <div>
              <p className="text-xs font-bold mb-2">CV Şablonu</p>
              <div className="grid grid-cols-3 gap-2">
                {TEMPLATES.map(t => (
                  <button key={t.id} onClick={() => setSelTpl(t.id)}
                    className={`p-2.5 rounded-xl border text-left transition-all ${selTpl === t.id ? "border-primary bg-primary/10" : "border-white/10 glass-card hover:border-primary/30"}`}>
                    <div className="text-xs font-semibold leading-tight">{t.name}</div>
                    <div className="text-[10px] text-muted-foreground">{t.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Renk Seç */}
            <div>
              <p className="text-xs font-bold mb-2">Vurgu Rengi</p>
              <div className="flex flex-wrap gap-2">
                {PALETTE.map((p, i) => (
                  <button key={i} onClick={() => setSelColor(i)}
                    title={p.label}
                    className={`w-9 h-9 rounded-full border-2 transition-all ${selColor === i ? "border-white scale-110 shadow-lg" : "border-transparent"}`}
                    style={{ background: p.c }}>
                    {selColor === i && <Check className="w-4 h-4 text-white mx-auto" style={{ filter: "drop-shadow(0 0 2px rgba(0,0,0,0.8))" }} />}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">{PALETTE[selColor]?.label} seçildi</p>
            </div>

            {/* Butonlar */}
            <div className="flex gap-2">
              <button onClick={() => setShowPreview(true)}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-card border border-white/10 rounded-xl text-sm font-medium hover:border-primary/40 transition-all">
                <Eye className="w-4 h-4 text-accent" /> Önizle
              </button>
              <button onClick={handleDownload} disabled={isDownloading}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-primary rounded-xl text-sm font-bold text-white hover:bg-primary/80 transition-all disabled:opacity-60">
                <Download className="w-4 h-4" />{isDownloading ? "Hazırlanıyor..." : "PDF İndir"}
              </button>
            </div>

            {/* Küçük Önizleme */}
            <div className="glass-card rounded-2xl overflow-hidden" style={{ maxHeight: "56vh" }}>
              <div style={{ transform: "scale(0.45)", transformOrigin: "top left", width: "222%", pointerEvents: "none" }}>
                <Tmpl data={data} photo={photo} color={color} />
              </div>
            </div>
          </div>
        )}

        {/* Navigasyon */}
        <div className="flex gap-3 mt-6">
          {step > 1 && (
            <button onClick={() => setStep(s => s - 1)}
              className="flex items-center gap-2 px-5 py-3 glass-card rounded-xl text-sm font-medium border border-white/10 hover:border-primary/30 transition-all">
              <ChevronLeft className="w-4 h-4" /> Geri
            </button>
          )}
          {step < 4 && (
            <button onClick={() => setStep(s => s + 1)}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-primary rounded-xl text-sm font-bold text-white hover:bg-primary/80 transition-all">
              İleri <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Gizli PDF render alanı */}
      <div style={{ position: "absolute", left: "-9999px", top: 0, pointerEvents: "none" }}>
        <div ref={cvRef}><Tmpl data={data} photo={photo} color={color} /></div>
      </div>

      {/* Tam Ekran Önizleme */}
      {showPreview && (
        <div className="fixed inset-0 z-[200] bg-black/90 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 bg-card border-b border-white/10 shrink-0">
            <span className="font-bold text-sm">{TEMPLATES[selTpl]?.name} · {PALETTE[selColor]?.label}</span>
            <div className="flex gap-2">
              <button onClick={handleDownload} disabled={isDownloading}
                className="flex items-center gap-1.5 text-xs bg-primary px-3 py-1.5 rounded-lg font-medium text-white disabled:opacity-60">
                <Download className="w-3 h-3" />{isDownloading ? "..." : "PDF İndir"}
              </button>
              <button onClick={() => setShowPreview(false)} className="text-xs border border-white/20 px-3 py-1.5 rounded-lg">Kapat</button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-2">
            <div style={{ transform: "scale(0.47)", transformOrigin: "top left", width: "213%", pointerEvents: "none" }}>
              <Tmpl data={data} photo={photo} color={color} />
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

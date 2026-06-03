import React, { useState, useRef, useCallback } from "react";
import { Layout } from "@/components/layout";
import { ChevronRight, ChevronLeft, Sparkles, Download, Eye, Plus, Trash2, Upload, Check } from "lucide-react";

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
  hakkimda: "",
  deneyimler: [{ id: 1, title: "", company: "", period: "", desc: "" }],
  yetenekler: [{ id: 1, name: "", level: 4 }],
  hobiler: "",
  ozellikler: ["Disiplinli", "Güvenilir", "Ekip Uyumlu"],
  motto: "GÜVEN, SADAKAT VE ONUR EN BÜYÜK GÜÇTÜr.",
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

// ── Akıllı Metin Üretici ──────────────────────────────────────────────────────
const SUMMARIES: Record<string, string[]> = {
  "Güvenlik Görevlisi": [
    "Disiplinli, sorumluluk sahibi ve güvenilir bir özel güvenlik profesyoneliyim. Görevimi titizlikle yerine getirir, kurumun güvenliğini en üst düzeyde sağlarım. Ekip çalışmasına önem verir, kriz anlarında soğukkanlılığımı koruyarak doğru kararlar alırım.",
    "Özel güvenlik alanında deneyimli, çalışkan ve dürüst bir bireyim. Tüm güvenlik protokollerini eksiksiz uygular, kurumun ve çalışanların emniyetini önceliğim olarak görürüm. Yeni bilgiler öğrenmeye her zaman açık, ekip odaklı bir güvenlik uzmanıyım.",
  ],
  "Başgüvenlik": [
    "Özel güvenlik sektöründe liderlik deneyimine sahip, ekibimi etkin yöneten ve güvenlik protokollerini başarıyla uygulayan bir profesyonelim. Sorunları hızlı analiz eder, kriz anlarında doğru kararlar alırım. Vardiya planlaması ve personel koordinasyonunda yetkinim.",
    "Ekip yönetimi ve güvenlik koordinasyonunda deneyimli, sorumluluk sahibi bir başgüvenlik uzmanıyım. Güvenlik raporlaması, personel disiplini ve acil müdahale prosedürleri konularında tam yeterliliğe sahibim.",
  ],
  "VIP Koruma": [
    "VIP ve özel koruma alanında uzmanlaşmış, taktiksel eğitim almış, gizlilik ilkelerine tam bağlı bir koruma uzmanıyım. Stres altında soğukkanlılığımı koruyarak müvekkile zarar gelmesini önlerim. Risk analizi ve güzergah planlaması konularında yetkinim.",
    "Bireysel ve grup VIP koruma görevlerinde deneyimli, hızlı karar verebilen bir koruma uzmanıyım. Fiziksel yeterlilik, protokol bilgisi ve takım koordinasyonu güçlü yönlerimdir.",
  ],
  "Silahlı Güvenlik": [
    "Silahlı güvenlik ruhsatına sahip, silah kullanımı ve taktik güvenlik protokolleri konusunda yetkin bir güvenlik uzmanıyım. Yasalara ve kurumsal kurallara tam uyum içinde, sorumlu biçimde görev yaparım.",
    "Silahlı koruma operasyonlarında görev yapmış, taktiksel eğitim almış, disiplinli bir güvenlik profesyoneliyim. Tehdit değerlendirmesi ve müdahale prosedürleri konularında deneyimliyim.",
  ],
  "Güvenlik Şefi": [
    "Güvenlik operasyonlarını planlama ve yönetme konusunda kapsamlı deneyime sahip, stratejik düşünen bir güvenlik lideri olarak görev yapıyorum. Ekip motivasyonu, bütçe yönetimi ve operasyonel mükemmellik önceliklerimdir.",
    "Büyük tesislerde kapsamlı güvenlik sistemleri kuran ve yöneten, liderlik vasıflarına sahip, sonuç odaklı bir güvenlik şefiyim. Teknik güvenlik sistemleri ve insan yönetimi konularında deneyimliyim.",
  ],
  "Elektronik Güvenlik": [
    "CCTV, alarm ve erişim kontrol sistemleri konusunda uzmanlaşmış, teknik yeterliliğe sahip bir elektronik güvenlik uzmanıyım. Sistem kurulumu, bakımı ve entegrasyonunda geniş deneyimim bulunmaktadır.",
    "Elektronik güvenlik sistemleri kurulum, arıza tespiti ve izleme konularında deneyimli, sürekli gelişime açık bir güvenlik teknisyeniyim. Güvenlik teknolojilerine hakim ve uygulamaya dönük düşünce yapısına sahibim.",
  ],
  "Özel Dedektif": [
    "Gözetleme, takip ve delil toplama konularında uzmanlaşmış, analitik düşünce yeteneğine sahip bir özel dedektifim. Gizlilik ve mesleki etik ilkelerine tam bağlılıkla görev yaparım.",
    "Vaka araştırması, istihbarat toplama ve raporlama konularında deneyimli, yüksek gözlem yeteneğine sahip bir özel güvenlik araştırmacısıyım.",
  ],
  "Güvenlik Danışmanı": [
    "Güvenlik risk analizi, strateji geliştirme ve kurumsal güvenlik danışmanlığı alanlarında kapsamlı deneyime sahip bir uzmanım. Güvenlik açıklarını tespit eder ve bütüncül çözümler sunarım.",
  ],
  "Fabrika / Tesis Güvenlik": [
    "Endüstriyel tesis ve fabrika güvenliği konusunda deneyimli, OHS ve güvenlik protokollerine hakim bir güvenlik profesyoneliyim. Tesis güvenliği, yangın önleme ve acil müdahale süreçlerinde yetkinim.",
  ],
  "Sahil Güvenlik": [
    "Kıyı ve deniz güvenliği operasyonlarında görev yapmış, su kurtarma ve sahil gözetleme konularında eğitim almış bir güvenlik uzmanıyım. Disiplinli çalışma anlayışı ve güçlü gözlem yeteneğiyle görevimi eksiksiz yerine getiririm.",
  ],
};

const SKILLS_MAP: Record<string, string[]> = {
  "Güvenlik Görevlisi": ["Güvenlik Protokolleri", "İlk Yardım", "Gözlem Yeteneği", "İletişim", "Stres Yönetimi"],
  "Başgüvenlik": ["Ekip Yönetimi", "Vardiya Planlama", "Güvenlik Protokolleri", "Raporlama", "Kriz Yönetimi"],
  "VIP Koruma": ["Taktiksel Düşünce", "VIP Protokolü", "Savunma Sanatları", "Araç Takibi", "Risk Analizi"],
  "Silahlı Güvenlik": ["Silah Kullanımı", "Güvenlik Protokolleri", "Taktik Hareket", "İlk Yardım", "Hukuki Mevzuat"],
  "Güvenlik Şefi": ["Liderlik", "Stratejik Planlama", "Ekip Yönetimi", "Operasyon Kontrolü", "Risk Değerlendirme"],
  "Elektronik Güvenlik": ["CCTV Sistemleri", "Alarm Sistemleri", "Erişim Kontrolü", "Teknik Bakım", "Sistem Entegrasyonu"],
  "Özel Dedektif": ["Gözetleme", "Veri Analizi", "Raporlama", "Araştırma Teknikleri", "Gizli Takip"],
  "Güvenlik Danışmanı": ["Risk Analizi", "Denetim", "Strateji Geliştirme", "Eğitim", "Protokol Hazırlama"],
  "Fabrika / Tesis Güvenlik": ["Tesis Güvenliği", "Yangın Önleme", "Acil Müdahale", "OHS Standartları", "Erişim Kontrolü"],
  "Sahil Güvenlik": ["Deniz Güvenliği", "Su Kurtarma", "Gözetleme", "İlk Yardım", "Navigasyon"],
};

function generateSummary(pozisyon: string): string {
  const list = SUMMARIES[pozisyon] || SUMMARIES["Güvenlik Görevlisi"]!;
  return list[Math.floor(Math.random() * list.length)] ?? list[0]!;
}

function getSuggestedSkills(pozisyon: string): Skill[] {
  const skills = SKILLS_MAP[pozisyon] || SKILLS_MAP["Güvenlik Görevlisi"]!;
  return skills.map((name, i) => ({ id: i + 1, name, level: Math.max(3, 5 - (i % 2)) }));
}

// ── Şablon Bileşenleri (Ana bileşen dışında tanımlanmış) ──────────────────────
interface TP { data: CVData; photo: string; }

function PhotoBox({ photo, name, color, circle }: { photo: string; name: string; color: string; circle?: boolean }) {
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() || "ÖG";
  const style: React.CSSProperties = circle
    ? { width: 90, height: 90, borderRadius: "50%", border: `3px solid ${color}`, objectFit: "cover" as const, flexShrink: 0 }
    : { width: 95, height: 120, border: `3px solid ${color}`, objectFit: "cover" as const, flexShrink: 0, borderRadius: 4 };
  const placeholderStyle: React.CSSProperties = {
    ...style,
    background: `${color}20`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: circle ? 28 : 32,
    fontWeight: 900,
    color,
    fontFamily: "Arial, sans-serif",
  };
  if (photo) return <img src={photo} alt="foto" style={style} />;
  return <div style={placeholderStyle}>{initials}</div>;
}

// Şablon 1: Komando
function TKomando({ data, photo }: TP) {
  const fullName = `${data.ad} ${data.soyad}`.trim() || "AD SOYAD";
  const parts = fullName.split(" "); const sn = parts.pop() || ""; const fn = parts.join(" ");
  return (
    <div style={{ background: "#0D0D1A", color: "#fff", fontFamily: "Arial,sans-serif", width: "210mm", minHeight: "297mm", boxSizing: "border-box" }}>
      <div style={{ background: "linear-gradient(135deg,#1a1a2e,#0D0D1A)", padding: "20px 24px", borderBottom: "3px solid #D4AF37", display: "flex", gap: 18, alignItems: "flex-start" }}>
        <PhotoBox photo={photo} name={fullName} color="#D4AF37" />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 28, fontWeight: 900, textTransform: "uppercase", letterSpacing: 2, lineHeight: 1.1 }}>
            {fn && <span style={{ color: "#fff" }}>{fn} </span>}<span style={{ color: "#D4AF37" }}>{sn}</span>
          </div>
          <div style={{ fontSize: 11, color: "#D4AF37", letterSpacing: 3, textTransform: "uppercase", marginTop: 4, fontWeight: 600 }}>{data.pozisyon}</div>
          {data.hakkimda && <p style={{ fontSize: 9, color: "#aaa", marginTop: 8, lineHeight: 1.6, maxWidth: 340, margin: "8px 0 0" }}>{data.hakkimda}</p>}
          <div style={{ display: "flex", gap: 14, marginTop: 10 }}>
            {data.ozellikler.slice(0, 4).map(o => (
              <div key={o} style={{ textAlign: "center" }}>
                <div style={{ width: 28, height: 28, background: "#D4AF3720", border: "1px solid #D4AF37", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 3px", fontSize: 12 }}>🛡</div>
                <span style={{ fontSize: 7, color: "#D4AF37", textTransform: "uppercase" }}>{o}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{ display: "flex" }}>
        <div style={{ width: "36%", background: "#111122", padding: "16px 14px", borderRight: "1px solid #D4AF3730" }}>
          <Sec title="KİŞİSEL BİLGİLER" c="#D4AF37">
            {data.dogumTarihi && <Inf l="Doğum" v={data.dogumTarihi} />}
            {data.medeniDurum && <Inf l="Medeni" v={data.medeniDurum} />}
            {(data.boy || data.kilo) && <Inf l="Boy/Kilo" v={`${data.boy}cm/${data.kilo}kg`} />}
            {data.adres && <Inf l="Adres" v={data.adres} />}
          </Sec>
          <Sec title="İLETİŞİM" c="#D4AF37">
            {data.telefon && <Inf l="Tel" v={data.telefon} />}
            {data.email && <Inf l="E-posta" v={data.email} />}
          </Sec>
          <Sec title="YETENEKLER" c="#D4AF37">
            {data.yetenekler.filter(s => s.name).map(s => (
              <div key={s.id} style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 9, color: "#ccc", marginBottom: 2 }}>{s.name}</div>
                <div style={{ height: 4, background: "#333", borderRadius: 2 }}><div style={{ width: `${s.level / 5 * 100}%`, height: "100%", background: "#D4AF37", borderRadius: 2 }} /></div>
              </div>
            ))}
          </Sec>
        </div>
        <div style={{ flex: 1, padding: "16px 18px" }}>
          {data.deneyimler.some(d => d.title) && (
            <Sec title="DENEYİM" c="#D4AF37">
              {data.deneyimler.filter(d => d.title).map((d, i, arr) => (
                <div key={d.id} style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#D4AF37", flexShrink: 0 }} />
                    {i < arr.length - 1 && <div style={{ width: 1, flex: 1, background: "#D4AF3740", marginTop: 3 }} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 9, color: "#888" }}>{d.period}</div>
                    <div style={{ fontSize: 11, fontWeight: 700 }}>{d.title}</div>
                    <div style={{ fontSize: 9, color: "#D4AF37", marginBottom: 2 }}>{d.company}</div>
                    {d.desc && <p style={{ fontSize: 9, color: "#aaa", margin: 0, lineHeight: 1.5 }}>{d.desc}</p>}
                  </div>
                </div>
              ))}
            </Sec>
          )}
          {data.hobiler && <Sec title="HOBİLER" c="#D4AF37"><div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>{data.hobiler.split(",").map(h => h.trim()).filter(Boolean).map(h => <span key={h} style={{ fontSize: 9, background: "#D4AF3720", border: "1px solid #D4AF3740", color: "#D4AF37", padding: "2px 8px", borderRadius: 10 }}>{h}</span>)}</div></Sec>}
          {data.ozellikler.length > 0 && <Sec title="ÖZELLİKLERİM" c="#D4AF37"><div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{data.ozellikler.map(o => <span key={o} style={{ fontSize: 8, background: "#D4AF3715", border: "1px solid #D4AF3750", color: "#ccc", padding: "3px 8px", borderRadius: 4 }}>✔ {o}</span>)}</div></Sec>}
        </div>
      </div>
      <div style={{ background: "#0a0a16", borderTop: "2px solid #D4AF37", padding: "8px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: "#D4AF37", fontSize: 13 }}>★★★★★</span>
        <span style={{ fontSize: 9, color: "#D4AF37", letterSpacing: 2 }}>{data.motto}</span>
        <span style={{ color: "#D4AF37", fontSize: 13 }}>★★★★★</span>
      </div>
    </div>
  );
}

// Şablon 2: VIP Koruma
function TVIP({ data, photo }: TP) {
  const fullName = `${data.ad} ${data.soyad}`.trim() || "AD SOYAD";
  return (
    <div style={{ background: "#0a0900", color: "#fff", fontFamily: "Georgia,serif", width: "210mm", minHeight: "297mm", boxSizing: "border-box" }}>
      <div style={{ background: "linear-gradient(180deg,#1a1200,#0a0900)", padding: "28px", borderBottom: "1px solid #D4AF37", display: "flex", gap: 24, alignItems: "center" }}>
        <PhotoBox photo={photo} name={fullName} color="#D4AF37" />
        <div>
          <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: 4, textTransform: "uppercase", color: "#D4AF37", lineHeight: 1 }}>{fullName}</div>
          <div style={{ width: 60, height: 2, background: "#D4AF37", margin: "10px 0" }} />
          <div style={{ fontSize: 11, letterSpacing: 5, textTransform: "uppercase", color: "#888" }}>{data.pozisyon}</div>
          {data.hakkimda && <p style={{ fontSize: 10, color: "#aaa", marginTop: 12, lineHeight: 1.7, maxWidth: 360, fontStyle: "italic" }}>"{data.hakkimda}"</p>}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
        <div style={{ padding: "20px 18px", borderRight: "1px solid #222" }}>
          <Sec title="KİŞİSEL" c="#D4AF37">
            {data.dogumTarihi && <Inf l="Doğum Tarihi" v={data.dogumTarihi} />}
            {data.medeniDurum && <Inf l="Medeni Durum" v={data.medeniDurum} />}
            {(data.boy || data.kilo) && <Inf l="Boy / Kilo" v={`${data.boy} cm / ${data.kilo} kg`} />}
            {data.adres && <Inf l="Adres" v={data.adres} />}
          </Sec>
          <Sec title="İLETİŞİM" c="#D4AF37">
            {data.telefon && <Inf l="Tel" v={data.telefon} />}
            {data.email && <Inf l="E-mail" v={data.email} />}
          </Sec>
          <Sec title="HOBİLER" c="#D4AF37">
            <p style={{ fontSize: 9, color: "#aaa", lineHeight: 1.6, margin: 0 }}>{data.hobiler || "—"}</p>
          </Sec>
          <Sec title="ÖZELLİKLER" c="#D4AF37">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>{data.ozellikler.map(o => <span key={o} style={{ fontSize: 8, color: "#888" }}>◆ {o}</span>)}</div>
          </Sec>
        </div>
        <div style={{ padding: "20px 18px" }}>
          <Sec title="DENEYİM" c="#D4AF37">
            {data.deneyimler.filter(d => d.title).map(d => (
              <div key={d.id} style={{ borderLeft: "2px solid #D4AF37", paddingLeft: 10, marginBottom: 12 }}>
                <div style={{ fontSize: 9, color: "#D4AF37" }}>{d.period}</div>
                <div style={{ fontSize: 11, fontWeight: 700 }}>{d.title}</div>
                <div style={{ fontSize: 9, color: "#888", marginBottom: 3 }}>{d.company}</div>
                {d.desc && <p style={{ fontSize: 9, color: "#aaa", margin: 0, lineHeight: 1.5 }}>{d.desc}</p>}
              </div>
            ))}
          </Sec>
          <Sec title="YETENEKLER" c="#D4AF37">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>{data.yetenekler.filter(s => s.name).map(s => <span key={s.id} style={{ fontSize: 8, border: "1px solid #D4AF37", color: "#D4AF37", padding: "2px 8px" }}>{s.name}</span>)}</div>
          </Sec>
        </div>
      </div>
      <div style={{ borderTop: "1px solid #D4AF37", padding: "8px 28px", textAlign: "center" }}>
        <span style={{ fontSize: 9, color: "#D4AF3780", letterSpacing: 3 }}>{data.motto}</span>
      </div>
    </div>
  );
}

// Şablon 3: Mavi Baret
function TMaviBaret({ data, photo }: TP) {
  const fullName = `${data.ad} ${data.soyad}`.trim() || "AD SOYAD";
  return (
    <div style={{ background: "#0A1628", color: "#fff", fontFamily: "Arial,sans-serif", width: "210mm", minHeight: "297mm", boxSizing: "border-box" }}>
      <div style={{ background: "#009EDB", padding: "22px 28px", display: "flex", gap: 20, alignItems: "center" }}>
        <PhotoBox photo={photo} name={fullName} color="#fff" circle />
        <div>
          <div style={{ fontSize: 26, fontWeight: 900, textTransform: "uppercase", color: "#fff" }}>{data.ad || "AD"} {data.soyad || "SOYAD"}</div>
          <div style={{ fontSize: 11, color: "#d4eeff", letterSpacing: 2, textTransform: "uppercase", marginTop: 4 }}>{data.pozisyon}</div>
          {data.hakkimda && <p style={{ fontSize: 9, color: "#d4eeff", marginTop: 8, lineHeight: 1.5, maxWidth: 380, margin: "8px 0 0" }}>{data.hakkimda}</p>}
        </div>
      </div>
      <div style={{ background: "#009EDB15", padding: "8px 24px", display: "flex", gap: 20, borderBottom: "1px solid #009EDB30" }}>
        {data.telefon && <span style={{ fontSize: 9, color: "#009EDB" }}>📞 {data.telefon}</span>}
        {data.email && <span style={{ fontSize: 9, color: "#009EDB" }}>✉ {data.email}</span>}
        {data.adres && <span style={{ fontSize: 9, color: "#009EDB" }}>📍 {data.adres}</span>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "38% 62%" }}>
        <div style={{ background: "#0d1e35", padding: "16px 14px" }}>
          <Sec title="KİŞİSEL" c="#009EDB">
            {data.dogumTarihi && <Inf l="Doğum" v={data.dogumTarihi} />}
            {data.medeniDurum && <Inf l="Medeni" v={data.medeniDurum} />}
            {(data.boy || data.kilo) && <Inf l="Boy/Kilo" v={`${data.boy}/${data.kilo}`} />}
          </Sec>
          <Sec title="YETENEKLER" c="#009EDB">
            {data.yetenekler.filter(s => s.name).map(s => (
              <div key={s.id} style={{ marginBottom: 7 }}>
                <div style={{ fontSize: 9, color: "#ccc", marginBottom: 2 }}>{s.name}</div>
                <div style={{ height: 5, background: "#1a3a5c", borderRadius: 3 }}><div style={{ width: `${s.level / 5 * 100}%`, height: "100%", background: "#009EDB", borderRadius: 3 }} /></div>
              </div>
            ))}
          </Sec>
          <Sec title="HOBİLER" c="#009EDB">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>{(data.hobiler || "").split(",").map(h => h.trim()).filter(Boolean).map(h => <span key={h} style={{ fontSize: 9, background: "#009EDB20", border: "1px solid #009EDB50", color: "#009EDB", padding: "2px 8px", borderRadius: 10 }}>{h}</span>)}</div>
          </Sec>
        </div>
        <div style={{ padding: "16px 18px" }}>
          <Sec title="DENEYİM" c="#009EDB">
            {data.deneyimler.filter(d => d.title).map(d => (
              <div key={d.id} style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                <div style={{ width: 3, background: "#009EDB", borderRadius: 2, flexShrink: 0, margin: "2px 0" }} />
                <div><div style={{ fontSize: 9, color: "#009EDB" }}>{d.period}</div><div style={{ fontSize: 11, fontWeight: 700 }}>{d.title}</div><div style={{ fontSize: 9, color: "#888" }}>{d.company}</div>{d.desc && <p style={{ fontSize: 9, color: "#aaa", margin: "3px 0 0", lineHeight: 1.5 }}>{d.desc}</p>}</div>
              </div>
            ))}
          </Sec>
          <Sec title="ÖZELLİKLERİM" c="#009EDB"><div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>{data.ozellikler.map(o => <span key={o} style={{ fontSize: 8, background: "#009EDB20", border: "1px solid #009EDB50", color: "#7ec8d6", padding: "3px 8px", borderRadius: 4 }}>✔ {o}</span>)}</div></Sec>
        </div>
      </div>
      <div style={{ background: "#009EDB", padding: "8px 24px", textAlign: "center" }}><span style={{ fontSize: 9, color: "#001F3F", fontWeight: 700, letterSpacing: 2 }}>{data.motto}</span></div>
    </div>
  );
}

// Şablon 4: Kurumsal (açık arka plan)
function TKurumsal({ data, photo }: TP) {
  const fullName = `${data.ad} ${data.soyad}`.trim() || "AD SOYAD";
  return (
    <div style={{ background: "#f0f4f8", color: "#1e293b", fontFamily: "Arial,sans-serif", width: "210mm", minHeight: "297mm", boxSizing: "border-box" }}>
      <div style={{ background: "#1e293b", padding: "22px 28px", display: "flex", gap: 20, alignItems: "center" }}>
        <PhotoBox photo={photo} name={fullName} color="#818cf8" />
        <div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "#fff" }}>{data.ad || "Ad"} <span style={{ color: "#818cf8" }}>{data.soyad || "Soyad"}</span></div>
          <div style={{ fontSize: 11, color: "#818cf8", letterSpacing: 2, textTransform: "uppercase", marginTop: 4 }}>{data.pozisyon}</div>
          {data.hakkimda && <p style={{ fontSize: 9, color: "#94a3b8", marginTop: 8, lineHeight: 1.5, maxWidth: 380, margin: "8px 0 0" }}>{data.hakkimda}</p>}
        </div>
      </div>
      <div style={{ background: "#e2e8f0", padding: "7px 24px", display: "flex", gap: 20, borderBottom: "1px solid #cbd5e1" }}>
        {data.telefon && <span style={{ fontSize: 9, color: "#4F46E5" }}>📞 {data.telefon}</span>}
        {data.email && <span style={{ fontSize: 9, color: "#4F46E5" }}>✉ {data.email}</span>}
        {data.adres && <span style={{ fontSize: 9, color: "#4F46E5" }}>📍 {data.adres}</span>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "35% 65%" }}>
        <div style={{ background: "#1e293b", padding: "16px 14px" }}>
          <Sec title="KİŞİSEL" c="#818cf8">
            {data.dogumTarihi && <Inf l="Doğum" v={data.dogumTarihi} d />}
            {data.medeniDurum && <Inf l="Medeni" v={data.medeniDurum} d />}
            {(data.boy || data.kilo) && <Inf l="Boy/Kilo" v={`${data.boy}cm / ${data.kilo}kg`} d />}
          </Sec>
          <Sec title="YETENEKLER" c="#818cf8">
            {data.yetenekler.filter(s => s.name).map(s => (
              <div key={s.id} style={{ marginBottom: 7 }}>
                <div style={{ fontSize: 9, color: "#94a3b8", marginBottom: 2 }}>{s.name}</div>
                <div style={{ height: 4, background: "#334155", borderRadius: 2 }}><div style={{ width: `${s.level / 5 * 100}%`, height: "100%", background: "#4F46E5", borderRadius: 2 }} /></div>
              </div>
            ))}
          </Sec>
          <Sec title="HOBİLER" c="#818cf8">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>{(data.hobiler || "").split(",").map(h => h.trim()).filter(Boolean).map(h => <div key={h} style={{ fontSize: 9, color: "#94a3b8" }}>▸ {h}</div>)}</div>
          </Sec>
        </div>
        <div style={{ padding: "16px 18px" }}>
          <Sec title="DENEYİM" c="#4F46E5">
            {data.deneyimler.filter(d => d.title).map(d => (
              <div key={d.id} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 6, padding: "10px 12px", marginBottom: 10, borderLeft: "3px solid #4F46E5" }}>
                <div style={{ fontSize: 9, color: "#4F46E5", fontWeight: 700 }}>{d.period}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#1e293b" }}>{d.title}</div>
                <div style={{ fontSize: 9, color: "#64748b" }}>{d.company}</div>
                {d.desc && <p style={{ fontSize: 9, color: "#475569", margin: "4px 0 0", lineHeight: 1.5 }}>{d.desc}</p>}
              </div>
            ))}
          </Sec>
          <Sec title="ÖZELLİKLER" c="#4F46E5"><div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>{data.ozellikler.map(o => <div key={o} style={{ fontSize: 9, color: "#475569" }}>✔ {o}</div>)}</div></Sec>
        </div>
      </div>
      <div style={{ background: "#4F46E5", padding: "8px 24px", textAlign: "center" }}><span style={{ fontSize: 9, color: "#fff", letterSpacing: 2 }}>{data.motto}</span></div>
    </div>
  );
}

// Şablon 5: Sahil Güvenlik
function TSahil({ data, photo }: TP) {
  const fullName = `${data.ad} ${data.soyad}`.trim() || "AD SOYAD";
  return (
    <div style={{ background: "#001F3F", color: "#fff", fontFamily: "Arial,sans-serif", width: "210mm", minHeight: "297mm", boxSizing: "border-box" }}>
      <div style={{ background: "linear-gradient(135deg,#003366,#001F3F)", padding: "22px 28px", borderBottom: "3px solid #00A9CE", display: "flex", gap: 20, alignItems: "center" }}>
        <PhotoBox photo={photo} name={fullName} color="#00A9CE" />
        <div>
          <div style={{ fontSize: 24, fontWeight: 900, textTransform: "uppercase", color: "#00A9CE" }}>{data.ad} <span style={{ color: "#fff" }}>{data.soyad}</span></div>
          <div style={{ fontSize: 11, letterSpacing: 3, color: "#7ec8d6", textTransform: "uppercase", marginTop: 4 }}>{data.pozisyon}</div>
          {data.hakkimda && <p style={{ fontSize: 9, color: "#93c5d1", marginTop: 10, lineHeight: 1.6, maxWidth: 370, margin: "10px 0 0" }}>{data.hakkimda}</p>}
        </div>
      </div>
      <div style={{ background: "#00A9CE15", padding: "7px 24px", display: "flex", gap: 20, borderBottom: "1px solid #00A9CE30" }}>
        {data.telefon && <span style={{ fontSize: 9, color: "#7ec8d6" }}>📞 {data.telefon}</span>}
        {data.email && <span style={{ fontSize: 9, color: "#7ec8d6" }}>✉ {data.email}</span>}
        {data.adres && <span style={{ fontSize: 9, color: "#7ec8d6" }}>📍 {data.adres}</span>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
        <div style={{ padding: "16px 18px", borderRight: "1px solid #00A9CE30" }}>
          <Sec title="KİŞİSEL BİLGİLER" c="#00A9CE">
            {data.dogumTarihi && <Inf l="Doğum" v={data.dogumTarihi} />}
            {data.medeniDurum && <Inf l="Medeni" v={data.medeniDurum} />}
            {(data.boy || data.kilo) && <Inf l="Boy/Kilo" v={`${data.boy} / ${data.kilo}`} />}
          </Sec>
          <Sec title="YETENEKLER" c="#00A9CE">
            {data.yetenekler.filter(s => s.name).map(s => (
              <div key={s.id} style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#ccc", marginBottom: 2 }}>
                  <span>{s.name}</span><span style={{ color: "#00A9CE" }}>{"★".repeat(s.level)}{"☆".repeat(5 - s.level)}</span>
                </div>
                <div style={{ height: 4, background: "#003366", borderRadius: 2 }}><div style={{ width: `${s.level / 5 * 100}%`, height: "100%", background: "#00A9CE", borderRadius: 2 }} /></div>
              </div>
            ))}
          </Sec>
          <Sec title="HOBİLER" c="#00A9CE"><div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>{(data.hobiler || "").split(",").map(h => h.trim()).filter(Boolean).map(h => <span key={h} style={{ fontSize: 9, background: "#00A9CE20", border: "1px solid #00A9CE40", color: "#00A9CE", padding: "2px 8px", borderRadius: 10 }}>{h}</span>)}</div></Sec>
        </div>
        <div style={{ padding: "16px 18px" }}>
          <Sec title="DENEYİM" c="#00A9CE">
            {data.deneyimler.filter(d => d.title).map(d => (
              <div key={d.id} style={{ borderLeft: "2px solid #00A9CE", paddingLeft: 12, marginBottom: 14 }}>
                <div style={{ fontSize: 9, color: "#00A9CE" }}>{d.period}</div>
                <div style={{ fontSize: 11, fontWeight: 700 }}>{d.title}</div>
                <div style={{ fontSize: 9, color: "#7ec8d6", marginBottom: 3 }}>{d.company}</div>
                {d.desc && <p style={{ fontSize: 9, color: "#93c5d1", margin: 0, lineHeight: 1.5 }}>{d.desc}</p>}
              </div>
            ))}
          </Sec>
          <Sec title="ÖZELLİKLERİM" c="#00A9CE"><div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{data.ozellikler.map(o => <span key={o} style={{ fontSize: 8, background: "#00A9CE15", border: "1px solid #00A9CE30", color: "#7ec8d6", padding: "3px 8px", borderRadius: 4 }}>✔ {o}</span>)}</div></Sec>
        </div>
      </div>
      <div style={{ background: "#00A9CE", padding: "8px 24px", textAlign: "center" }}><span style={{ fontSize: 9, color: "#001F3F", fontWeight: 700, letterSpacing: 2 }}>{data.motto}</span></div>
    </div>
  );
}

// Şablon 6: Modern
function TModern({ data, photo }: TP) {
  const fullName = `${data.ad} ${data.soyad}`.trim() || "AD SOYAD";
  return (
    <div style={{ background: "#0F172A", color: "#fff", fontFamily: "Arial,sans-serif", width: "210mm", minHeight: "297mm", boxSizing: "border-box" }}>
      <div style={{ background: "linear-gradient(135deg,#4F46E5,#7C3AED)", padding: "22px 28px", display: "flex", gap: 20, alignItems: "center" }}>
        <PhotoBox photo={photo} name={fullName} color="rgba(255,255,255,0.6)" circle />
        <div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "#fff" }}>{data.ad} <span style={{ color: "#c4b5fd" }}>{data.soyad}</span></div>
          <div style={{ fontSize: 11, color: "#c4b5fd", letterSpacing: 3, textTransform: "uppercase", marginTop: 4 }}>{data.pozisyon}</div>
          {data.hakkimda && <p style={{ fontSize: 9, color: "#e2d9ff", marginTop: 10, lineHeight: 1.6, maxWidth: 370, margin: "10px 0 0" }}>{data.hakkimda}</p>}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 10 }}>{data.ozellikler.slice(0, 4).map(o => <span key={o} style={{ fontSize: 8, background: "rgba(255,255,255,0.15)", color: "#fff", padding: "2px 8px", borderRadius: 10 }}>{o}</span>)}</div>
        </div>
      </div>
      <div style={{ background: "#0a0f1e", padding: "7px 24px", display: "flex", gap: 20, borderBottom: "1px solid #4F46E530" }}>
        {data.telefon && <span style={{ fontSize: 9, color: "#818cf8" }}>📞 {data.telefon}</span>}
        {data.email && <span style={{ fontSize: 9, color: "#818cf8" }}>✉ {data.email}</span>}
        {data.adres && <span style={{ fontSize: 9, color: "#818cf8" }}>📍 {data.adres}</span>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "38% 62%" }}>
        <div style={{ background: "#1e1b4b", padding: "16px 14px" }}>
          <Sec title="KİŞİSEL" c="#818cf8">
            {data.dogumTarihi && <Inf l="Doğum" v={data.dogumTarihi} />}
            {data.medeniDurum && <Inf l="Medeni" v={data.medeniDurum} />}
            {(data.boy || data.kilo) && <Inf l="Boy/Kilo" v={`${data.boy} / ${data.kilo}`} />}
          </Sec>
          <Sec title="YETENEKLER" c="#818cf8">
            {data.yetenekler.filter(s => s.name).map(s => (
              <div key={s.id} style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 9, color: "#a5b4fc", marginBottom: 2 }}>{s.name}</div>
                <div style={{ height: 5, background: "#312e81", borderRadius: 3 }}><div style={{ width: `${s.level / 5 * 100}%`, height: "100%", background: "linear-gradient(90deg,#4F46E5,#06B6D4)", borderRadius: 3 }} /></div>
              </div>
            ))}
          </Sec>
          <Sec title="HOBİLER" c="#818cf8"><div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>{(data.hobiler || "").split(",").map(h => h.trim()).filter(Boolean).map(h => <span key={h} style={{ fontSize: 8, background: "#312e81", color: "#a5b4fc", padding: "2px 7px", borderRadius: 8 }}>{h}</span>)}</div></Sec>
        </div>
        <div style={{ padding: "16px 18px" }}>
          <Sec title="DENEYİM" c="#06B6D4">
            {data.deneyimler.filter(d => d.title).map(d => (
              <div key={d.id} style={{ background: "#1e293b", borderRadius: 8, padding: "10px 12px", marginBottom: 10, borderLeft: "3px solid #06B6D4" }}>
                <div style={{ fontSize: 9, color: "#06B6D4" }}>{d.period}</div>
                <div style={{ fontSize: 11, fontWeight: 700 }}>{d.title}</div>
                <div style={{ fontSize: 9, color: "#64748b" }}>{d.company}</div>
                {d.desc && <p style={{ fontSize: 9, color: "#94a3b8", margin: "4px 0 0", lineHeight: 1.5 }}>{d.desc}</p>}
              </div>
            ))}
          </Sec>
          <Sec title="ÖZELLİKLERİM" c="#06B6D4"><div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>{data.ozellikler.map(o => <span key={o} style={{ fontSize: 8, background: "#06B6D420", border: "1px solid #06B6D440", color: "#06B6D4", padding: "2px 8px", borderRadius: 8 }}>✦ {o}</span>)}</div></Sec>
        </div>
      </div>
      <div style={{ background: "linear-gradient(135deg,#4F46E5,#06B6D4)", padding: "8px 24px", textAlign: "center" }}><span style={{ fontSize: 9, color: "#fff", letterSpacing: 2 }}>{data.motto}</span></div>
    </div>
  );
}

// Yardımcı bileşenler
function Sec({ title, c, children }: { title: string; c: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 7 }}>
        <div style={{ width: 14, height: 1, background: c }} />
        <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: c }}>{title}</span>
        <div style={{ flex: 1, height: 1, background: `${c}40` }} />
      </div>
      {children}
    </div>
  );
}

function Inf({ l, v, d }: { l: string; v: string; d?: boolean }) {
  return (
    <div style={{ marginBottom: 5 }}>
      <span style={{ fontSize: 8, color: d ? "#64748b" : "#666", display: "block" }}>{l}</span>
      <span style={{ fontSize: 9, color: d ? "#94a3b8" : "#ddd" }}>{v}</span>
    </div>
  );
}

const TEMPLATES = [
  { id: 0, name: "Komando", desc: "Askeri koyu altın", color: "#D4AF37", C: TKomando },
  { id: 1, name: "VIP Koruma", desc: "Siyah altın lüks", color: "#D4AF37", C: TVIP },
  { id: 2, name: "Mavi Baret", desc: "Lacivert profesyonel", color: "#009EDB", C: TMaviBaret },
  { id: 3, name: "Kurumsal", desc: "Açık & kurumsal", color: "#4F46E5", C: TKurumsal },
  { id: 4, name: "Sahil Güvenlik", desc: "Okyanus laciverd", color: "#00A9CE", C: TSahil },
  { id: 5, name: "Modern Tech", desc: "Mor-Cyan teknoloji", color: "#7C3AED", C: TModern },
];

// ── Yardımcı input bileşeni (stabil referans) ─────────────────────────────────
const FInput = React.memo(function FInput({
  label, value, onChange, placeholder, type
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      <input
        type={type || "text"}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder || ""}
        className="w-full bg-card border border-white/10 rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary/50 transition-colors"
      />
    </div>
  );
});

// ── Ana Bileşen ───────────────────────────────────────────────────────────────
export default function CvOlustur() {
  const [step, setStep] = useState(1);
  const [selectedTemplate, setSelectedTemplate] = useState(0);
  const [photo, setPhoto] = useState("");
  const [data, setData] = useState<CVData>(INITIAL);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const cvRef = useRef<HTMLDivElement>(null);

  const upd = useCallback(<K extends keyof CVData>(key: K, val: CVData[K]) => {
    setData(prev => ({ ...prev, [key]: val }));
  }, []);

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setPhoto(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleAiSuggest = useCallback(() => {
    setIsGenerating(true);
    setTimeout(() => {
      setData(prev => ({ ...prev, hakkimda: generateSummary(prev.pozisyon) }));
      setIsGenerating(false);
    }, 700);
  }, []);

  const handleSkillSuggest = useCallback(() => {
    setData(prev => ({ ...prev, yetenekler: getSuggestedSkills(prev.pozisyon) }));
  }, []);

  const handleDownload = async () => {
    if (!cvRef.current) return;
    setIsDownloading(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const jsPDF = (await import("jspdf")).default;
      const canvas = await html2canvas(cvRef.current, { scale: 2, useCORS: true });
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const ratio = canvas.height / canvas.width;
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, 210, 210 * ratio);
      pdf.save(`${data.ad || "CV"}_${data.soyad || "Guvenlik"}.pdf`);
    } catch { window.print(); }
    finally { setIsDownloading(false); }
  };

  // Deneyim işlemleri
  const addDeneyim = useCallback(() => setData(p => ({ ...p, deneyimler: [...p.deneyimler, { id: Date.now(), title: "", company: "", period: "", desc: "" }] })), []);
  const removeDeneyim = useCallback((id: number) => setData(p => ({ ...p, deneyimler: p.deneyimler.filter(d => d.id !== id) })), []);
  const updDeneyim = useCallback((id: number, field: keyof Experience, val: string) =>
    setData(p => ({ ...p, deneyimler: p.deneyimler.map(d => d.id === id ? { ...d, [field]: val } : d) })), []);

  // Yetenek işlemleri
  const addSkill = useCallback(() => setData(p => ({ ...p, yetenekler: [...p.yetenekler, { id: Date.now(), name: "", level: 4 }] })), []);
  const removeSkill = useCallback((id: number) => setData(p => ({ ...p, yetenekler: p.yetenekler.filter(s => s.id !== id) })), []);
  const updSkill = useCallback((id: number, field: keyof Skill, val: string | number) =>
    setData(p => ({ ...p, yetenekler: p.yetenekler.map(s => s.id === id ? { ...s, [field]: val } : s) })), []);

  const toggleOzellik = useCallback((o: string) =>
    setData(p => ({
      ...p,
      ozellikler: p.ozellikler.includes(o)
        ? p.ozellikler.filter(x => x !== o)
        : p.ozellikler.length < 8 ? [...p.ozellikler, o] : p.ozellikler
    })), []);

  const Tmpl = TEMPLATES[selectedTemplate]!.C;

  const STEP_LABELS = ["Kişisel", "Deneyim", "Yetenekler", "Önizleme"];

  return (
    <Layout>
      <div className="p-4 pb-8">
        {/* Adım göstergesi */}
        <div className="flex items-center justify-between mb-5">
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

        <h1 className="text-xl font-extrabold mb-4">
          {step < 4 ? `${step}. Adım — ${STEP_LABELS[step - 1]}` : "Şablon & Önizleme"}
        </h1>

        {/* ── Adım 1: Kişisel Bilgiler ── */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-2">
              <label className="cursor-pointer group">
                <div className="w-24 h-28 rounded-xl border-2 border-dashed border-primary/40 flex flex-col items-center justify-center bg-card overflow-hidden hover:border-primary transition-colors">
                  {photo
                    ? <img src={photo} className="w-full h-full object-cover" alt="foto" />
                    : <><Upload className="w-6 h-6 text-muted-foreground mb-1" /><span className="text-[10px] text-muted-foreground text-center px-2">Fotoğraf Ekle</span></>}
                </div>
                <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
              </label>
              {photo && <button onClick={() => setPhoto("")} className="text-[11px] text-destructive">Fotoğrafı Kaldır</button>}
              <p className="text-[10px] text-muted-foreground">Fotoğraf zorunlu değil</p>
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

        {/* ── Adım 2: Hakkımda & Deneyim ── */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-muted-foreground">Hakkımda</label>
                <button onClick={handleAiSuggest} disabled={isGenerating}
                  className="flex items-center gap-1.5 text-[11px] bg-primary/20 text-primary px-3 py-1.5 rounded-lg hover:bg-primary/30 transition-colors disabled:opacity-60">
                  <Sparkles className="w-3 h-3" />
                  {isGenerating ? "Üretiliyor..." : "Yapay Zeka Öner"}
                </button>
              </div>
              <textarea
                value={data.hakkimda}
                onChange={e => upd("hakkimda", e.target.value)}
                rows={4}
                placeholder="Kendinizi kısaca tanıtın veya 'Yapay Zeka Öner' butonuna basın..."
                className="w-full bg-card border border-white/10 rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary/50 resize-none"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold">Deneyimler</label>
                <button onClick={addDeneyim} className="flex items-center gap-1 text-[11px] text-accent">
                  <Plus className="w-3.5 h-3.5" /> Deneyim Ekle
                </button>
              </div>
              {data.deneyimler.map((d, i) => (
                <div key={d.id} className="glass-card rounded-xl p-3 mb-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">{i + 1}. Deneyim</span>
                    {data.deneyimler.length > 1 && (
                      <button onClick={() => removeDeneyim(d.id)} className="text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-muted-foreground mb-1">Görev/Unvan</label>
                      <input value={d.title} onChange={e => updDeneyim(d.id, "title", e.target.value)}
                        className="w-full bg-background/50 border border-white/10 rounded-lg px-2.5 py-2 text-sm text-foreground outline-none" />
                    </div>
                    <div>
                      <label className="block text-[10px] text-muted-foreground mb-1">Şirket/Kurum</label>
                      <input value={d.company} onChange={e => updDeneyim(d.id, "company", e.target.value)}
                        className="w-full bg-background/50 border border-white/10 rounded-lg px-2.5 py-2 text-sm text-foreground outline-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] text-muted-foreground mb-1">Dönem (ör: 2020 – 2024)</label>
                    <input value={d.period} onChange={e => updDeneyim(d.id, "period", e.target.value)}
                      className="w-full bg-background/50 border border-white/10 rounded-lg px-2.5 py-2 text-sm text-foreground outline-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-muted-foreground mb-1">Açıklama</label>
                    <textarea value={d.desc} onChange={e => updDeneyim(d.id, "desc", e.target.value)} rows={2}
                      className="w-full bg-background/50 border border-white/10 rounded-lg px-2.5 py-2 text-sm text-foreground outline-none resize-none" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Adım 3: Yetenekler & Özellikler ── */}
        {step === 3 && (
          <div className="space-y-5">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold">Yetenekler</label>
                <div className="flex gap-2">
                  <button onClick={handleSkillSuggest}
                    className="flex items-center gap-1 text-[11px] bg-secondary/20 text-secondary px-2.5 py-1 rounded-lg hover:bg-secondary/30 transition-colors">
                    <Sparkles className="w-3 h-3" /> Otomatik Öner
                  </button>
                  <button onClick={addSkill} className="flex items-center gap-1 text-[11px] text-accent">
                    <Plus className="w-3.5 h-3.5" /> Ekle
                  </button>
                </div>
              </div>
              {data.yetenekler.map(s => (
                <div key={s.id} className="flex items-center gap-2 mb-2">
                  <input value={s.name} onChange={e => updSkill(s.id, "name", e.target.value)} placeholder="Yetenek adı"
                    className="flex-1 bg-card border border-white/10 rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50" />
                  <select value={s.level} onChange={e => updSkill(s.id, "level", Number(e.target.value))}
                    className="bg-card border border-white/10 rounded-lg px-2 py-2 text-sm text-foreground outline-none w-20">
                    {[1, 2, 3, 4, 5].map(l => <option key={l} value={l}>{l}/5</option>)}
                  </select>
                  {data.yetenekler.length > 1 && (
                    <button onClick={() => removeSkill(s.id)} className="text-destructive shrink-0"><Trash2 className="w-4 h-4" /></button>
                  )}
                </div>
              ))}
            </div>
            <FInput label="Hobiler (virgülle ayırın)" value={data.hobiler} onChange={v => upd("hobiler", v)} placeholder="Balık Tutmak, Müzik, Yüzme" />
            <div>
              <label className="text-xs font-bold block mb-2">Kişilik Özellikleri (en fazla 8 seçin)</label>
              <div className="flex flex-wrap gap-2">
                {OZELLIK_LISTESI.map(o => {
                  const selected = data.ozellikler.includes(o);
                  return (
                    <button key={o} onClick={() => toggleOzellik(o)}
                      className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border transition-all ${selected ? "bg-primary/20 border-primary text-primary" : "bg-card border-white/10 text-muted-foreground hover:border-primary/30"}`}>
                      {selected && <Check className="w-3 h-3" />}
                      {o}
                    </button>
                  );
                })}
              </div>
            </div>
            <FInput label="Motto / İmza Cümlesi" value={data.motto} onChange={v => upd("motto", v)} />
          </div>
        )}

        {/* ── Adım 4: Şablon & Önizleme ── */}
        {step === 4 && (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-bold mb-2">Şablon Seç</p>
              <div className="grid grid-cols-3 gap-2">
                {TEMPLATES.map(t => (
                  <button key={t.id} onClick={() => setSelectedTemplate(t.id)}
                    className={`p-3 rounded-xl border text-left transition-all ${selectedTemplate === t.id ? "border-primary bg-primary/10" : "border-white/10 glass-card hover:border-primary/30"}`}>
                    <div className="w-5 h-5 rounded-full mb-2" style={{ background: t.color }} />
                    <div className="text-xs font-semibold leading-tight">{t.name}</div>
                    <div className="text-[10px] text-muted-foreground">{t.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setShowPreview(true)}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-card border border-white/10 rounded-xl text-sm font-medium hover:border-primary/40 transition-all">
                <Eye className="w-4 h-4 text-accent" /> Önizle
              </button>
              <button onClick={handleDownload} disabled={isDownloading}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-primary rounded-xl text-sm font-bold text-white hover:bg-primary/80 transition-all disabled:opacity-60">
                <Download className="w-4 h-4" />
                {isDownloading ? "Hazırlanıyor..." : "PDF İndir"}
              </button>
            </div>

            {/* Küçük önizleme */}
            <div className="glass-card rounded-2xl overflow-hidden" style={{ maxHeight: "55vh" }}>
              <div style={{ transform: "scale(0.45)", transformOrigin: "top left", width: "222%", pointerEvents: "none" }}>
                <Tmpl data={data} photo={photo} />
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

      {/* Gizli PDF render */}
      <div style={{ position: "absolute", left: "-9999px", top: 0, pointerEvents: "none" }}>
        <div ref={cvRef}><Tmpl data={data} photo={photo} /></div>
      </div>

      {/* Tam Ekran Önizleme */}
      {showPreview && (
        <div className="fixed inset-0 z-[200] bg-black/90 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 bg-card border-b border-white/10 shrink-0">
            <span className="font-bold text-sm">{TEMPLATES[selectedTemplate]?.name} — Önizleme</span>
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
              <Tmpl data={data} photo={photo} />
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

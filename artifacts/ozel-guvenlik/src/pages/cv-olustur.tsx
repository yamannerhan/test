import React, { useState, useRef, useCallback } from "react";
import { Layout } from "@/components/layout";
import { ChevronRight, ChevronLeft, Sparkles, Download, Eye, Plus, Trash2, Upload, Check } from "lucide-react";

// ── Tipler ───────────────────────────────────────────────────────────────────
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
  ozellikler: ["Disiplinli", "Güvenilir", "Ekip Uyumlu"],
  motto: "GÜVEN, SADAKAT, ONUR EN BÜYÜK GÜÇTÜRr.",
};

const POZISYONLAR = [
  "Güvenlik Görevlisi", "Başgüvenlik", "VIP Koruma", "Silahlı Güvenlik",
  "Güvenlik Şefi", "Özel Dedektif", "Elektronik Güvenlik", "Güvenlik Danışmanı",
  "Fabrika Güvenlik", "Sahil Güvenlik",
];

const OZELLIK_LISTESI = [
  "Disiplinli", "Güvenilir", "Ekip Uyumlu", "Sorumluluk Sahibi", "Çalışkan",
  "Güler Yüzlü", "Planlı & Organize", "İletişime Açık", "Çabuk Karar Veren",
  "Analitik Düşünen", "Güçlü İrade", "Öz Denetimli",
];

// ── Akıllı Metin Üretici (API gerektirmez) ────────────────────────────────────
const SUMMARIES: Record<string, string[]> = {
  "Güvenlik Görevlisi": [
    "Disiplinli, sorumluluk sahibi ve güvenilir bir güvenlik profesyoneliyim. Görevimi titizlikle yerine getirir, kurumun güvenliğini en üst düzeyde sağlarım. Ekip çalışmasına önem verir, kriz anlarında soğukkanlılığımı koruyarak doğru kararlar alırım.",
    "Güvenlik alanında deneyimli, çalışkan ve dürüst bir bireyim. Verilen tüm sorumlulukları eksiksiz yerine getirir, protokollere tam uyum sağlarım. Yeni bilgiler öğrenmeye her zaman açık, ekip odaklı bir çalışanım.",
    "Kurumsal güvenlik alanında görev yapan, iletişim becerileri güçlü ve disiplinli bir güvenlik uzmanıyım. Görev bilinciyle hareket eder, tüm güvenlik protokollerini eksiksiz uygularım.",
  ],
  "Başgüvenlik": [
    "Güvenlik sektöründe liderlik deneyimine sahip, ekibimi etkin yöneten ve güvenlik protokollerini başarıyla uygulayan bir profesyonelim. Sorunları analiz eder, kısa sürede çözüm üretirim.",
    "Ekip yönetimi ve güvenlik koordinasyonunda deneyimli, sorumluluk sahibi bir başgüvenlik uzmanıyım. Vardiya planlaması, personel yönetimi ve güvenlik raporlaması konularında yetkinim.",
  ],
  "VIP Koruma": [
    "VIP ve özel koruma alanında uzmanlaşmış, taktiksel eğitim almış, gizlilik ilkelerine bağlı bir koruma uzmanıyım. Stres altında soğukkanlılığımı koruyarak müvekkile zarar gelmesini engelerim.",
    "Bireysel ve grup koruma görevlerinde deneyimli, risk analizi yapabilen ve hızlı karar verebilen bir VIP koruma uzmanıyım. Protokol bilgisi ve fiziksel yeterliliğim üst düzeydedir.",
  ],
  "Silahlı Güvenlik": [
    "Silahlı güvenlik eğitimi almış, silah kullanımı ve güvenlik protokolleri konusunda yetkin, sorumluluk sahibi bir güvenlik uzmanıyım. Yasalara ve kurumsal kurallara tam uyum içinde görev yaparım.",
    "Silahlı koruma ve güvenlik operasyonlarında görev yapmış, taktiksel eğitim almış, disiplinli bir güvenlik profesyoneliyim.",
  ],
  "Güvenlik Şefi": [
    "Güvenlik operasyonlarını planlama ve yönetme konusunda kapsamlı deneyime sahip, stratejik düşünen bir güvenlik lideri olarak görev yapıyorum. Ekip motivasyonu ve operasyonel mükemmellik önceliklerimdir.",
    "Büyük tesislerde kapsamlı güvenlik sistemleri kuran ve yöneten, liderlik vasıflarına sahip, sonuç odaklı bir güvenlik şefiyim.",
  ],
  "Elektronik Güvenlik": [
    "CCTV sistemleri, alarm sistemleri ve elektronik güvenlik teknolojileri konusunda uzmanlaşmış, teknik yeterliliğe sahip bir güvenlik teknisyeniyim.",
    "Elektronik güvenlik sistemleri kurulum, bakım ve izleme konularında deneyimli, sürekli gelişime açık bir elektronik güvenlik uzmanıyım.",
  ],
  "Özel Dedektif": [
    "Gözlem, takip ve istihbarat toplama konularında uzmanlaşmış, analitik düşünce yeteneğine sahip bir araştırmacıyım. Gizlilik ve etik ilkelere tam bağlılıkla görev yaparım.",
  ],
};

const SKILLS_MAP: Record<string, string[]> = {
  "Güvenlik Görevlisi": ["Güvenlik Protokolleri", "İlk Yardım", "Gözlem Yeteneği", "İletişim", "Stres Yönetimi"],
  "Başgüvenlik": ["Ekip Yönetimi", "Vardiya Planlama", "Güvenlik Protokolleri", "Raporlama", "Kriz Yönetimi"],
  "VIP Koruma": ["Taktiksel Düşünce", "VIP Protokolü", "Savunma Sanatları", "Araç Takibi", "Risk Analizi"],
  "Silahlı Güvenlik": ["Silah Kullanımı", "Güvenlik Protokolleri", "Taktik Hareket", "İlk Yardım", "Hukuki Mevzuat"],
  "Güvenlik Şefi": ["Liderlik", "Stratejik Planlama", "Ekip Yönetimi", "Operasyon Kontrolü", "Risk Değerlendirme"],
  "Elektronik Güvenlik": ["CCTV Sistemleri", "Alarm Sistemleri", "Ağ Güvenliği", "Teknik Bakım", "Sistem Entegrasyonu"],
  "Özel Dedektif": ["Gözetleme", "Veri Analizi", "Raporlama", "Araştırma Teknikleri", "Gizli Takip"],
};

function generateSummary(pozisyon: string, ozellikler: string[]): string {
  const list = SUMMARIES[pozisyon] || SUMMARIES["Güvenlik Görevlisi"]!;
  const idx = Math.floor(Math.random() * list.length);
  return list[idx] || list[0]!;
}

function getSuggestedSkills(pozisyon: string): Skill[] {
  const skills = SKILLS_MAP[pozisyon] || SKILLS_MAP["Güvenlik Görevlisi"]!;
  return skills.map((name, i) => ({ id: i + 1, name, level: 4 - (i % 2) }));
}

// ── Şablon Tipleri ────────────────────────────────────────────────────────────
interface TemplateProps { data: CVData; photo: string; }

// ─── Şablon 1: Komando (Askeri Koyu) ──────────────────────────────────────────
function TemplateKomando({ data, photo }: TemplateProps) {
  const fullName = `${data.ad} ${data.soyad}`.trim() || "AD SOYAD";
  const nameParts = fullName.split(" ");
  const surname = nameParts.pop() || "";
  const firstName = nameParts.join(" ");

  return (
    <div style={{ background: "#0D0D1A", color: "#fff", fontFamily: "Arial, sans-serif", width: "210mm", minHeight: "297mm", position: "relative", boxSizing: "border-box" }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg,#1a1a2e,#0D0D1A)", padding: "20px 24px 0 24px", borderBottom: "3px solid #D4AF37", display: "flex", gap: "20px", alignItems: "flex-start" }}>
        {photo ? (
          <img src={photo} alt="foto" style={{ width: "100px", height: "130px", objectFit: "cover", border: "3px solid #D4AF37", borderRadius: "4px", flexShrink: 0 }} />
        ) : (
          <div style={{ width: "100px", height: "130px", border: "3px solid #D4AF37", borderRadius: "4px", background: "#1a1a2e", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "36px", color: "#D4AF37" }}>👤</div>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "28px", fontWeight: 900, textTransform: "uppercase", letterSpacing: "2px", lineHeight: 1.1 }}>
            {firstName && <span style={{ color: "#fff" }}>{firstName}{" "}</span>}
            <span style={{ color: "#D4AF37" }}>{surname}</span>
          </div>
          <div style={{ fontSize: "13px", color: "#D4AF37", letterSpacing: "3px", textTransform: "uppercase", marginTop: "4px", fontWeight: 600 }}>{data.pozisyon || "POZİSYON"}</div>
          {data.hakkimda && <p style={{ fontSize: "9px", color: "#aaa", marginTop: "8px", lineHeight: 1.5, maxWidth: "340px" }}>{data.hakkimda}</p>}
          <div style={{ display: "flex", gap: "16px", marginTop: "10px", marginBottom: "8px" }}>
            {data.ozellikler.slice(0, 4).map(o => (
              <div key={o} style={{ textAlign: "center" }}>
                <div style={{ width: "30px", height: "30px", background: "#D4AF3720", border: "1px solid #D4AF37", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 3px", fontSize: "14px" }}>⚔</div>
                <span style={{ fontSize: "7px", color: "#D4AF37", textTransform: "uppercase", letterSpacing: "0.5px" }}>{o}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ display: "flex", gap: 0 }}>
        {/* Left Column */}
        <div style={{ width: "36%", background: "#111122", padding: "16px 14px", borderRight: "1px solid #D4AF3730" }}>
          <Section title="KİŞİSEL BİLGİLER" gold>
            {data.dogumTarihi && <Info label="Doğum Tarihi" value={data.dogumTarihi} />}
            {data.medeniDurum && <Info label="Medeni Durum" value={data.medeniDurum} />}
            {(data.boy || data.kilo) && <Info label="Boy / Kilo" value={`${data.boy} cm / ${data.kilo} kg`} />}
            {data.adres && <Info label="Adres" value={data.adres} />}
          </Section>
          <Section title="İLETİŞİM" gold>
            {data.telefon && <Info label="Telefon" value={data.telefon} />}
            {data.email && <Info label="E-posta" value={data.email} />}
          </Section>
          <Section title="YETENEKLER" gold>
            {data.yetenekler.filter(s => s.name).map(skill => (
              <div key={skill.id} style={{ marginBottom: "8px" }}>
                <div style={{ fontSize: "9px", color: "#ccc", marginBottom: "3px" }}>{skill.name}</div>
                <div style={{ height: "4px", background: "#333", borderRadius: "2px" }}>
                  <div style={{ width: `${(skill.level / 5) * 100}%`, height: "100%", background: "#D4AF37", borderRadius: "2px" }} />
                </div>
              </div>
            ))}
          </Section>
        </div>

        {/* Right Column */}
        <div style={{ flex: 1, padding: "16px 18px" }}>
          {data.deneyimler.some(d => d.title) && (
            <Section title="DENEYİM" gold>
              {data.deneyimler.filter(d => d.title).map((d, i) => (
                <div key={d.id} style={{ display: "flex", gap: "12px", marginBottom: "12px" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#D4AF37", flexShrink: 0 }} />
                    {i < data.deneyimler.filter(d2 => d2.title).length - 1 && <div style={{ width: "1px", flex: 1, background: "#D4AF3740", marginTop: "3px" }} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "10px", color: "#888" }}>{d.period}</div>
                    <div style={{ fontSize: "12px", fontWeight: 700, color: "#fff" }}>{d.title}</div>
                    <div style={{ fontSize: "10px", color: "#D4AF37", marginBottom: "3px" }}>{d.company}</div>
                    {d.desc && <p style={{ fontSize: "9px", color: "#aaa", lineHeight: 1.5, margin: 0 }}>{d.desc}</p>}
                  </div>
                </div>
              ))}
            </Section>
          )}
          {data.hobiler && (
            <Section title="HOBİLER" gold>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {data.hobiler.split(",").map(h => h.trim()).filter(Boolean).map(h => (
                  <span key={h} style={{ fontSize: "9px", background: "#D4AF3720", border: "1px solid #D4AF3740", color: "#D4AF37", padding: "2px 8px", borderRadius: "10px" }}>{h}</span>
                ))}
              </div>
            </Section>
          )}
          {data.ozellikler.length > 0 && (
            <Section title="ÖZELLİKLERİM" gold>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {data.ozellikler.map(o => (
                  <div key={o} style={{ textAlign: "center", width: "52px" }}>
                    <div style={{ width: "36px", height: "36px", background: "#D4AF3715", border: "1px solid #D4AF3750", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 3px", fontSize: "16px" }}>🛡</div>
                    <span style={{ fontSize: "7px", color: "#ccc" }}>{o}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{ background: "#0a0a16", borderTop: "2px solid #D4AF37", padding: "10px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", gap: "4px" }}>{"★★★★★".split("").map((s, i) => <span key={i} style={{ color: "#D4AF37", fontSize: "14px" }}>{s}</span>)}</div>
        <span style={{ fontSize: "9px", color: "#D4AF37", letterSpacing: "2px", textTransform: "uppercase" }}>{data.motto}</span>
        <div style={{ display: "flex", gap: "4px" }}>{"★★★★★".split("").map((s, i) => <span key={i} style={{ color: "#D4AF37", fontSize: "14px" }}>{s}</span>)}</div>
      </div>
    </div>
  );
}

// ─── Şablon 2: VIP Koruma (Siyah Altın) ───────────────────────────────────────
function TemplateVIP({ data, photo }: TemplateProps) {
  const fullName = `${data.ad} ${data.soyad}`.trim() || "AD SOYAD";
  return (
    <div style={{ background: "#000", color: "#fff", fontFamily: "'Georgia', serif", width: "210mm", minHeight: "297mm", boxSizing: "border-box" }}>
      <div style={{ background: "linear-gradient(180deg,#1a1200,#000)", padding: "30px 28px 20px", borderBottom: "1px solid #D4AF37" }}>
        <div style={{ display: "flex", gap: "24px", alignItems: "center" }}>
          {photo ? (
            <img src={photo} alt="foto" style={{ width: "110px", height: "140px", objectFit: "cover", border: "2px solid #D4AF37", flexShrink: 0 }} />
          ) : (
            <div style={{ width: "110px", height: "140px", border: "2px solid #D4AF37", background: "#111", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "40px" }}>👤</div>
          )}
          <div>
            <div style={{ fontSize: "32px", fontWeight: 700, letterSpacing: "4px", textTransform: "uppercase", color: "#D4AF37", lineHeight: 1 }}>{fullName}</div>
            <div style={{ width: "60px", height: "2px", background: "#D4AF37", margin: "10px 0" }} />
            <div style={{ fontSize: "13px", letterSpacing: "5px", textTransform: "uppercase", color: "#888" }}>{data.pozisyon}</div>
            {data.hakkimda && <p style={{ fontSize: "10px", color: "#aaa", marginTop: "12px", lineHeight: 1.7, maxWidth: "360px", fontStyle: "italic" }}>" {data.hakkimda} "</p>}
          </div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0" }}>
        <div style={{ padding: "20px 18px", borderRight: "1px solid #222" }}>
          <Section title="KİŞİSEL BİLGİLER" gold><InfoList data={data} /></Section>
          <Section title="İLETİŞİM" gold>
            {data.telefon && <Info label="Tel" value={data.telefon} />}
            {data.email && <Info label="E-mail" value={data.email} />}
          </Section>
          <Section title="HOBİLER" gold>
            <p style={{ fontSize: "9px", color: "#aaa", lineHeight: 1.6 }}>{data.hobiler || "—"}</p>
          </Section>
        </div>
        <div style={{ padding: "20px 18px" }}>
          <Section title="DENEYİM" gold>
            {data.deneyimler.filter(d => d.title).map(d => (
              <div key={d.id} style={{ borderLeft: "2px solid #D4AF37", paddingLeft: "10px", marginBottom: "12px" }}>
                <div style={{ fontSize: "9px", color: "#D4AF37" }}>{d.period}</div>
                <div style={{ fontSize: "11px", fontWeight: 700 }}>{d.title}</div>
                <div style={{ fontSize: "9px", color: "#888", marginBottom: "3px" }}>{d.company}</div>
                {d.desc && <p style={{ fontSize: "9px", color: "#aaa", margin: 0, lineHeight: 1.5 }}>{d.desc}</p>}
              </div>
            ))}
          </Section>
          <Section title="YETENEKLER" gold>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {data.yetenekler.filter(s => s.name).map(s => (
                <span key={s.id} style={{ fontSize: "8px", border: "1px solid #D4AF37", color: "#D4AF37", padding: "3px 8px" }}>{s.name}</span>
              ))}
            </div>
          </Section>
          <Section title="ÖZELLİKLER" gold>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {data.ozellikler.map(o => <span key={o} style={{ fontSize: "8px", color: "#888" }}>◆ {o}</span>)}
            </div>
          </Section>
        </div>
      </div>
      <div style={{ borderTop: "1px solid #D4AF37", padding: "8px 28px", textAlign: "center" }}>
        <span style={{ fontSize: "9px", color: "#D4AF3780", letterSpacing: "3px" }}>{data.motto}</span>
      </div>
    </div>
  );
}

// ─── Şablon 3: Mavi Baret (Profesyonel Lacivert) ──────────────────────────────
function TemplateMaviBaret({ data, photo }: TemplateProps) {
  return (
    <div style={{ background: "#0A1628", color: "#fff", fontFamily: "Arial, sans-serif", width: "210mm", minHeight: "297mm", boxSizing: "border-box" }}>
      <div style={{ background: "#009EDB", padding: "24px 28px", display: "flex", gap: "20px", alignItems: "center" }}>
        {photo ? (
          <img src={photo} alt="foto" style={{ width: "90px", height: "110px", objectFit: "cover", border: "3px solid #fff", borderRadius: "50%", flexShrink: 0 }} />
        ) : (
          <div style={{ width: "90px", height: "90px", border: "3px solid #fff", borderRadius: "50%", background: "#0077aa", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "32px" }}>👤</div>
        )}
        <div>
          <div style={{ fontSize: "28px", fontWeight: 900, textTransform: "uppercase", color: "#fff" }}>{data.ad || "AD"} {data.soyad || "SOYAD"}</div>
          <div style={{ fontSize: "13px", color: "#d4eeff", letterSpacing: "2px", textTransform: "uppercase" }}>{data.pozisyon}</div>
          {data.hakkimda && <p style={{ fontSize: "9px", color: "#d4eeff", marginTop: "8px", lineHeight: 1.5, maxWidth: "380px" }}>{data.hakkimda}</p>}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "38% 62%" }}>
        <div style={{ background: "#0d1e35", padding: "16px 14px" }}>
          <Section title="KİŞİSEL" accent="#009EDB"><InfoList data={data} /></Section>
          <Section title="İLETİŞİM" accent="#009EDB">
            {data.telefon && <Info label="📞" value={data.telefon} />}
            {data.email && <Info label="✉" value={data.email} />}
            {data.adres && <Info label="📍" value={data.adres} />}
          </Section>
          <Section title="YETENEKLER" accent="#009EDB">
            {data.yetenekler.filter(s => s.name).map(s => (
              <div key={s.id} style={{ marginBottom: "7px" }}>
                <div style={{ fontSize: "9px", color: "#ccc", marginBottom: "2px" }}>{s.name}</div>
                <div style={{ height: "5px", background: "#1a3a5c", borderRadius: "3px" }}>
                  <div style={{ width: `${(s.level / 5) * 100}%`, height: "100%", background: "#009EDB", borderRadius: "3px" }} />
                </div>
              </div>
            ))}
          </Section>
        </div>
        <div style={{ padding: "16px 18px" }}>
          <Section title="DENEYİM" accent="#009EDB">
            {data.deneyimler.filter(d => d.title).map(d => (
              <div key={d.id} style={{ display: "flex", gap: "10px", marginBottom: "12px" }}>
                <div style={{ width: "3px", background: "#009EDB", borderRadius: "2px", flexShrink: 0, margin: "2px 0" }} />
                <div>
                  <div style={{ fontSize: "9px", color: "#009EDB" }}>{d.period}</div>
                  <div style={{ fontSize: "11px", fontWeight: 700 }}>{d.title}</div>
                  <div style={{ fontSize: "9px", color: "#888" }}>{d.company}</div>
                  {d.desc && <p style={{ fontSize: "9px", color: "#aaa", margin: "3px 0 0", lineHeight: 1.5 }}>{d.desc}</p>}
                </div>
              </div>
            ))}
          </Section>
          <Section title="HOBİLER" accent="#009EDB">
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {(data.hobiler || "").split(",").map(h => h.trim()).filter(Boolean).map(h => (
                <span key={h} style={{ fontSize: "9px", background: "#009EDB20", border: "1px solid #009EDB50", color: "#009EDB", padding: "2px 8px", borderRadius: "10px" }}>{h}</span>
              ))}
            </div>
          </Section>
          <Section title="ÖZELLİKLERİM" accent="#009EDB">
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {data.ozellikler.map(o => <span key={o} style={{ fontSize: "8px", color: "#aaa" }}>✔ {o}</span>)}
            </div>
          </Section>
        </div>
      </div>
      <div style={{ background: "#009EDB", padding: "8px 24px", textAlign: "center" }}>
        <span style={{ fontSize: "9px", color: "#fff", letterSpacing: "2px" }}>{data.motto}</span>
      </div>
    </div>
  );
}

// ─── Şablon 4: Kurumsal (İndigo) ──────────────────────────────────────────────
function TemplateKurumsal({ data, photo }: TemplateProps) {
  return (
    <div style={{ background: "#f8f8f8", color: "#1e293b", fontFamily: "Arial, sans-serif", width: "210mm", minHeight: "297mm", boxSizing: "border-box" }}>
      <div style={{ background: "#1e293b", padding: "24px 28px", display: "flex", gap: "20px", alignItems: "center" }}>
        {photo ? (
          <img src={photo} alt="foto" style={{ width: "90px", height: "110px", objectFit: "cover", border: "3px solid #4F46E5", flexShrink: 0 }} />
        ) : (
          <div style={{ width: "90px", height: "110px", border: "3px solid #4F46E5", background: "#334155", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "36px" }}>👤</div>
        )}
        <div>
          <div style={{ fontSize: "26px", fontWeight: 900, color: "#fff" }}>{data.ad || "Ad"} <span style={{ color: "#818cf8" }}>{data.soyad || "Soyad"}</span></div>
          <div style={{ fontSize: "12px", color: "#818cf8", letterSpacing: "2px", textTransform: "uppercase", marginTop: "4px" }}>{data.pozisyon}</div>
          {data.hakkimda && <p style={{ fontSize: "9px", color: "#94a3b8", marginTop: "8px", lineHeight: 1.5, maxWidth: "380px" }}>{data.hakkimda}</p>}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "35% 65%", background: "#f8f8f8" }}>
        <div style={{ background: "#1e293b", padding: "16px 14px" }}>
          <Section title="KİŞİSEL" accent="#818cf8" dark><InfoList data={data} dark /></Section>
          <Section title="İLETİŞİM" accent="#818cf8" dark>
            {data.telefon && <Info label="Tel" value={data.telefon} dark />}
            {data.email && <Info label="E-mail" value={data.email} dark />}
          </Section>
          <Section title="YETENEKLER" accent="#818cf8" dark>
            {data.yetenekler.filter(s => s.name).map(s => (
              <div key={s.id} style={{ marginBottom: "7px" }}>
                <div style={{ fontSize: "9px", color: "#94a3b8", marginBottom: "2px" }}>{s.name}</div>
                <div style={{ height: "4px", background: "#334155", borderRadius: "2px" }}>
                  <div style={{ width: `${(s.level / 5) * 100}%`, height: "100%", background: "#4F46E5", borderRadius: "2px" }} />
                </div>
              </div>
            ))}
          </Section>
        </div>
        <div style={{ padding: "16px 18px" }}>
          <Section title="DENEYİM" accent="#4F46E5">
            {data.deneyimler.filter(d => d.title).map(d => (
              <div key={d.id} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "10px 12px", marginBottom: "10px" }}>
                <div style={{ fontSize: "9px", color: "#4F46E5", fontWeight: 700 }}>{d.period}</div>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#1e293b" }}>{d.title}</div>
                <div style={{ fontSize: "9px", color: "#64748b" }}>{d.company}</div>
                {d.desc && <p style={{ fontSize: "9px", color: "#475569", margin: "4px 0 0", lineHeight: 1.5 }}>{d.desc}</p>}
              </div>
            ))}
          </Section>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <Section title="HOBİLER" accent="#4F46E5">
              {(data.hobiler || "").split(",").map(h => h.trim()).filter(Boolean).map(h => (
                <div key={h} style={{ fontSize: "9px", color: "#475569", padding: "2px 0" }}>▸ {h}</div>
              ))}
            </Section>
            <Section title="ÖZELLİKLER" accent="#4F46E5">
              {data.ozellikler.map(o => <div key={o} style={{ fontSize: "9px", color: "#475569", padding: "2px 0" }}>✔ {o}</div>)}
            </Section>
          </div>
        </div>
      </div>
      <div style={{ background: "#4F46E5", padding: "8px 24px", textAlign: "center" }}>
        <span style={{ fontSize: "9px", color: "#fff", letterSpacing: "2px" }}>{data.motto}</span>
      </div>
    </div>
  );
}

// ─── Şablon 5: Sahil Güvenlik (Okyanus Laciverd) ──────────────────────────────
function TemplateSahil({ data, photo }: TemplateProps) {
  return (
    <div style={{ background: "#001F3F", color: "#fff", fontFamily: "Arial, sans-serif", width: "210mm", minHeight: "297mm", boxSizing: "border-box" }}>
      <div style={{ background: "linear-gradient(135deg,#003366,#001F3F)", padding: "24px 28px", borderBottom: "3px solid #00A9CE" }}>
        <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
          {photo ? (
            <img src={photo} alt="foto" style={{ width: "100px", height: "120px", objectFit: "cover", borderRadius: "8px", border: "3px solid #00A9CE", flexShrink: 0 }} />
          ) : (
            <div style={{ width: "100px", height: "120px", border: "3px solid #00A9CE", borderRadius: "8px", background: "#003366", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "36px" }}>👤</div>
          )}
          <div>
            <div style={{ fontSize: "26px", fontWeight: 900, textTransform: "uppercase", color: "#00A9CE" }}>{data.ad} <span style={{ color: "#fff" }}>{data.soyad}</span></div>
            <div style={{ fontSize: "11px", letterSpacing: "3px", color: "#7ec8d6", textTransform: "uppercase", marginTop: "4px" }}>{data.pozisyon}</div>
            {data.hakkimda && <p style={{ fontSize: "9px", color: "#93c5d1", marginTop: "10px", lineHeight: 1.6, maxWidth: "370px" }}>{data.hakkimda}</p>}
          </div>
        </div>
        <div style={{ display: "flex", gap: "20px", marginTop: "14px", borderTop: "1px solid #00A9CE30", paddingTop: "12px" }}>
          {data.telefon && <span style={{ fontSize: "9px", color: "#7ec8d6" }}>📞 {data.telefon}</span>}
          {data.email && <span style={{ fontSize: "9px", color: "#7ec8d6" }}>✉ {data.email}</span>}
          {data.adres && <span style={{ fontSize: "9px", color: "#7ec8d6" }}>📍 {data.adres}</span>}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0" }}>
        <div style={{ padding: "16px 18px", borderRight: "1px solid #00A9CE30" }}>
          <Section title="KİŞİSEL BİLGİLER" accent="#00A9CE"><InfoList data={data} /></Section>
          <Section title="YETENEKLER" accent="#00A9CE">
            {data.yetenekler.filter(s => s.name).map(s => (
              <div key={s.id} style={{ marginBottom: "8px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9px", color: "#ccc", marginBottom: "2px" }}>
                  <span>{s.name}</span><span style={{ color: "#00A9CE" }}>{"★".repeat(s.level)}{"☆".repeat(5 - s.level)}</span>
                </div>
                <div style={{ height: "4px", background: "#003366", borderRadius: "2px" }}>
                  <div style={{ width: `${(s.level / 5) * 100}%`, height: "100%", background: "#00A9CE", borderRadius: "2px" }} />
                </div>
              </div>
            ))}
          </Section>
          <Section title="HOBİLER" accent="#00A9CE">
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {(data.hobiler || "").split(",").map(h => h.trim()).filter(Boolean).map(h => (
                <span key={h} style={{ fontSize: "9px", background: "#00A9CE20", border: "1px solid #00A9CE40", color: "#00A9CE", padding: "2px 8px", borderRadius: "10px" }}>{h}</span>
              ))}
            </div>
          </Section>
        </div>
        <div style={{ padding: "16px 18px" }}>
          <Section title="DENEYİM" accent="#00A9CE">
            {data.deneyimler.filter(d => d.title).map((d, i) => (
              <div key={d.id} style={{ borderLeft: "2px solid #00A9CE", paddingLeft: "12px", marginBottom: "14px" }}>
                <div style={{ fontSize: "9px", color: "#00A9CE" }}>{d.period}</div>
                <div style={{ fontSize: "11px", fontWeight: 700 }}>{d.title}</div>
                <div style={{ fontSize: "9px", color: "#7ec8d6", marginBottom: "3px" }}>{d.company}</div>
                {d.desc && <p style={{ fontSize: "9px", color: "#93c5d1", margin: 0, lineHeight: 1.5 }}>{d.desc}</p>}
              </div>
            ))}
          </Section>
          <Section title="ÖZELLİKLERİM" accent="#00A9CE">
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {data.ozellikler.map(o => (
                <span key={o} style={{ fontSize: "8px", background: "#00A9CE15", border: "1px solid #00A9CE30", color: "#7ec8d6", padding: "3px 8px", borderRadius: "4px" }}>✔ {o}</span>
              ))}
            </div>
          </Section>
        </div>
      </div>
      <div style={{ background: "#00A9CE", padding: "8px 24px", textAlign: "center" }}>
        <span style={{ fontSize: "9px", color: "#001F3F", fontWeight: 700, letterSpacing: "2px" }}>{data.motto}</span>
      </div>
    </div>
  );
}

// ─── Şablon 6: Modern Tech (Mor-Cyan Gradient) ────────────────────────────────
function TemplateModern({ data, photo }: TemplateProps) {
  return (
    <div style={{ background: "#0F172A", color: "#fff", fontFamily: "Arial, sans-serif", width: "210mm", minHeight: "297mm", boxSizing: "border-box" }}>
      <div style={{ background: "linear-gradient(135deg,#4F46E5,#7C3AED)", padding: "24px 28px", display: "flex", gap: "20px", alignItems: "center" }}>
        {photo ? (
          <img src={photo} alt="foto" style={{ width: "90px", height: "110px", objectFit: "cover", borderRadius: "12px", border: "3px solid rgba(255,255,255,0.3)", flexShrink: 0 }} />
        ) : (
          <div style={{ width: "90px", height: "110px", border: "3px solid rgba(255,255,255,0.3)", borderRadius: "12px", background: "#6366f1", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "36px" }}>👤</div>
        )}
        <div>
          <div style={{ fontSize: "26px", fontWeight: 900, color: "#fff" }}>{data.ad} <span style={{ color: "#c4b5fd" }}>{data.soyad}</span></div>
          <div style={{ fontSize: "11px", color: "#c4b5fd", letterSpacing: "3px", textTransform: "uppercase", marginTop: "4px" }}>{data.pozisyon}</div>
          {data.hakkimda && <p style={{ fontSize: "9px", color: "#e2d9ff", marginTop: "10px", lineHeight: 1.6, maxWidth: "370px" }}>{data.hakkimda}</p>}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "10px" }}>
            {data.ozellikler.slice(0, 4).map(o => <span key={o} style={{ fontSize: "8px", background: "rgba(255,255,255,0.15)", color: "#fff", padding: "2px 8px", borderRadius: "10px" }}>{o}</span>)}
          </div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "38% 62%" }}>
        <div style={{ background: "#1e1b4b", padding: "16px 14px" }}>
          <Section title="KİŞİSEL" accent="#818cf8"><InfoList data={data} /></Section>
          <Section title="İLETİŞİM" accent="#818cf8">
            {data.telefon && <Info label="📞" value={data.telefon} />}
            {data.email && <Info label="✉" value={data.email} />}
            {data.adres && <Info label="📍" value={data.adres} />}
          </Section>
          <Section title="YETENEKLER" accent="#818cf8">
            {data.yetenekler.filter(s => s.name).map(s => (
              <div key={s.id} style={{ marginBottom: "8px" }}>
                <div style={{ fontSize: "9px", color: "#a5b4fc", marginBottom: "2px" }}>{s.name}</div>
                <div style={{ height: "5px", background: "#312e81", borderRadius: "3px" }}>
                  <div style={{ width: `${(s.level / 5) * 100}%`, height: "100%", background: "linear-gradient(90deg,#4F46E5,#06B6D4)", borderRadius: "3px" }} />
                </div>
              </div>
            ))}
          </Section>
          <Section title="HOBİLER" accent="#818cf8">
            <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
              {(data.hobiler || "").split(",").map(h => h.trim()).filter(Boolean).map(h => (
                <span key={h} style={{ fontSize: "8px", background: "#312e81", color: "#a5b4fc", padding: "2px 7px", borderRadius: "8px" }}>{h}</span>
              ))}
            </div>
          </Section>
        </div>
        <div style={{ padding: "16px 18px" }}>
          <Section title="DENEYİM" accent="#06B6D4">
            {data.deneyimler.filter(d => d.title).map(d => (
              <div key={d.id} style={{ background: "#1e293b", borderRadius: "8px", padding: "10px 12px", marginBottom: "10px", borderLeft: "3px solid #06B6D4" }}>
                <div style={{ fontSize: "9px", color: "#06B6D4" }}>{d.period}</div>
                <div style={{ fontSize: "11px", fontWeight: 700 }}>{d.title}</div>
                <div style={{ fontSize: "9px", color: "#64748b" }}>{d.company}</div>
                {d.desc && <p style={{ fontSize: "9px", color: "#94a3b8", margin: "4px 0 0", lineHeight: 1.5 }}>{d.desc}</p>}
              </div>
            ))}
          </Section>
          <Section title="ÖZELLİKLERİM" accent="#06B6D4">
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {data.ozellikler.map(o => (
                <span key={o} style={{ fontSize: "8px", background: "#06B6D420", border: "1px solid #06B6D440", color: "#06B6D4", padding: "2px 8px", borderRadius: "8px" }}>✦ {o}</span>
              ))}
            </div>
          </Section>
        </div>
      </div>
      <div style={{ background: "linear-gradient(135deg,#4F46E5,#06B6D4)", padding: "8px 24px", textAlign: "center" }}>
        <span style={{ fontSize: "9px", color: "#fff", letterSpacing: "2px" }}>{data.motto}</span>
      </div>
    </div>
  );
}

// ─── Yardımcı alt bileşenler ──────────────────────────────────────────────────
function Section({ title, children, gold, accent, dark }: { title: string; children: React.ReactNode; gold?: boolean; accent?: string; dark?: boolean; }) {
  const color = gold ? "#D4AF37" : accent || "#888";
  return (
    <div style={{ marginBottom: "14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
        <div style={{ width: "16px", height: "1px", background: color }} />
        <span style={{ fontSize: "8px", fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", color }}>{title}</span>
        <div style={{ flex: 1, height: "1px", background: `${color}40` }} />
      </div>
      {children}
    </div>
  );
}

function Info({ label, value, dark }: { label: string; value: string; dark?: boolean }) {
  return (
    <div style={{ marginBottom: "5px" }}>
      <span style={{ fontSize: "8px", color: dark ? "#64748b" : "#666", display: "block" }}>{label}</span>
      <span style={{ fontSize: "9px", color: dark ? "#94a3b8" : "#ddd" }}>{value}</span>
    </div>
  );
}

function InfoList({ data, dark }: { data: CVData; dark?: boolean }) {
  return (
    <>
      {data.dogumTarihi && <Info label="Doğum Tarihi" value={data.dogumTarihi} dark={dark} />}
      {data.medeniDurum && <Info label="Medeni Durum" value={data.medeniDurum} dark={dark} />}
      {(data.boy || data.kilo) && <Info label="Boy / Kilo" value={`${data.boy} cm / ${data.kilo} kg`} dark={dark} />}
    </>
  );
}

// ─── Şablon Listesi ──────────────────────────────────────────────────────────
const TEMPLATES = [
  { id: 0, name: "Komando", desc: "Askeri koyu tema", color: "#D4AF37", component: TemplateKomando },
  { id: 1, name: "VIP Koruma", desc: "Siyah altın lüks", color: "#FFD700", component: TemplateVIP },
  { id: 2, name: "Mavi Baret", desc: "Profesyonel lacivert", color: "#009EDB", component: TemplateMaviBaret },
  { id: 3, name: "Kurumsal", desc: "Temiz kurumsal", color: "#4F46E5", component: TemplateKurumsal },
  { id: 4, name: "Sahil Güvenlik", desc: "Okyanus laciverd", color: "#00A9CE", component: TemplateSahil },
  { id: 5, name: "Modern", desc: "Mor-Cyan teknoloji", color: "#7C3AED", component: TemplateModern },
];

// ─── Ana Bileşen ─────────────────────────────────────────────────────────────
export default function CvOlustur() {
  const [step, setStep] = useState(1);
  const [selectedTemplate, setSelectedTemplate] = useState(0);
  const [photo, setPhoto] = useState("");
  const [data, setData] = useState<CVData>(INITIAL);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const cvRef = useRef<HTMLDivElement>(null);

  const upd = useCallback(<K extends keyof CVData>(key: K, value: CVData[K]) => {
    setData(prev => ({ ...prev, [key]: value }));
  }, []);

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setPhoto(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleAiSuggest = () => {
    setIsGenerating(true);
    setTimeout(() => {
      const text = generateSummary(data.pozisyon, data.ozellikler);
      upd("hakkimda", text);
      setIsGenerating(false);
    }, 800);
  };

  const handleSkillSuggest = () => {
    const skills = getSuggestedSkills(data.pozisyon);
    upd("yetenekler", skills);
  };

  const handleDownload = async () => {
    if (!cvRef.current) return;
    setIsDownloading(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const jsPDF = (await import("jspdf")).default;
      const canvas = await html2canvas(cvRef.current, { scale: 2, useCORS: true, backgroundColor: null });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const ratio = canvas.height / canvas.width;
      pdf.addImage(imgData, "PNG", 0, 0, 210, 210 * ratio);
      pdf.save(`${data.ad || "CV"}_${data.soyad || ""}.pdf`);
    } catch {
      window.print();
    } finally {
      setIsDownloading(false);
    }
  };

  const addDeneyim = () => upd("deneyimler", [...data.deneyimler, { id: Date.now(), title: "", company: "", period: "", desc: "" }]);
  const removeDeneyim = (id: number) => upd("deneyimler", data.deneyimler.filter(d => d.id !== id));
  const updDeneyim = (id: number, field: keyof Experience, val: string) =>
    upd("deneyimler", data.deneyimler.map(d => d.id === id ? { ...d, [field]: val } : d));

  const addSkill = () => upd("yetenekler", [...data.yetenekler, { id: Date.now(), name: "", level: 4 }]);
  const removeSkill = (id: number) => upd("yetenekler", data.yetenekler.filter(s => s.id !== id));
  const updSkill = (id: number, field: keyof Skill, val: string | number) =>
    upd("yetenekler", data.yetenekler.map(s => s.id === id ? { ...s, [field]: val } : s));

  const toggleOzellik = (o: string) => {
    if (data.ozellikler.includes(o)) upd("ozellikler", data.ozellikler.filter(x => x !== o));
    else if (data.ozellikler.length < 8) upd("ozellikler", [...data.ozellikler, o]);
  };

  const TemplateComponent = TEMPLATES[selectedTemplate]!.component;

  // ── Adım 1: Kişisel Bilgiler ───────────────────────────────────────────────
  const Step1 = () => (
    <div className="space-y-4">
      {/* Fotoğraf */}
      <div className="flex flex-col items-center gap-3">
        <label className="cursor-pointer group">
          <div className="w-24 h-28 rounded-xl border-2 border-dashed border-primary/40 flex flex-col items-center justify-center bg-card overflow-hidden group-hover:border-primary transition-colors">
            {photo ? <img src={photo} className="w-full h-full object-cover" alt="foto" /> : (
              <>
                <Upload className="w-6 h-6 text-muted-foreground mb-1" />
                <span className="text-[10px] text-muted-foreground text-center px-2">Fotoğraf Ekle</span>
              </>
            )}
          </div>
          <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
        </label>
        {photo && <button onClick={() => setPhoto("")} className="text-[11px] text-destructive">Fotoğrafı Kaldır</button>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Ad" value={data.ad} onChange={v => upd("ad", v)} />
        <Field label="Soyad" value={data.soyad} onChange={v => upd("soyad", v)} />
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">Pozisyon</label>
        <select value={data.pozisyon} onChange={e => upd("pozisyon", e.target.value)}
          className="w-full bg-card border border-white/10 rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary/50">
          {POZISYONLAR.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Doğum Tarihi" value={data.dogumTarihi} onChange={v => upd("dogumTarihi", v)} placeholder="gg.aa.yyyy" />
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Medeni Durum</label>
          <select value={data.medeniDurum} onChange={e => upd("medeniDurum", e.target.value)}
            className="w-full bg-card border border-white/10 rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary/50">
            {["Bekar", "Evli", "Boşanmış"].map(m => <option key={m}>{m}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Boy (cm)" value={data.boy} onChange={v => upd("boy", v)} placeholder="175" />
        <Field label="Kilo (kg)" value={data.kilo} onChange={v => upd("kilo", v)} placeholder="80" />
      </div>

      <Field label="Adres" value={data.adres} onChange={v => upd("adres", v)} placeholder="Mahalle, İlçe / Şehir" />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Telefon" value={data.telefon} onChange={v => upd("telefon", v)} placeholder="0555 555 55 55" />
        <Field label="E-posta" value={data.email} onChange={v => upd("email", v)} placeholder="ornek@mail.com" />
      </div>
    </div>
  );

  // ── Adım 2: Hakkımda & Deneyim ────────────────────────────────────────────
  const Step2 = () => (
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
        <textarea value={data.hakkimda} onChange={e => upd("hakkimda", e.target.value)} rows={4}
          placeholder="Kendinizi kısaca tanıtın veya 'Yapay Zeka Öner' butonuna basın..."
          className="w-full bg-card border border-white/10 rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary/50 resize-none" />
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
              <Field label="Görev/Unvan" value={d.title} onChange={v => updDeneyim(d.id, "title", v)} />
              <Field label="Şirket/Kurum" value={d.company} onChange={v => updDeneyim(d.id, "company", v)} />
            </div>
            <Field label="Dönem (ör: 2020-2023)" value={d.period} onChange={v => updDeneyim(d.id, "period", v)} />
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Açıklama</label>
              <textarea value={d.desc} onChange={e => updDeneyim(d.id, "desc", e.target.value)} rows={2}
                className="w-full bg-background/50 border border-white/10 rounded-lg px-2.5 py-2 text-sm text-foreground outline-none resize-none" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // ── Adım 3: Yetenekler & Özellikler ──────────────────────────────────────
  const Step3 = () => (
    <div className="space-y-5">
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-bold">Yetenekler</label>
          <div className="flex gap-2">
            <button onClick={handleSkillSuggest} className="flex items-center gap-1 text-[11px] bg-secondary/20 text-secondary px-2.5 py-1 rounded-lg hover:bg-secondary/30 transition-colors">
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

      <Field label="Hobiler (virgülle ayırın)" value={data.hobiler} onChange={v => upd("hobiler", v)} placeholder="Balık Tutmak, Müzik, Yüzme" />

      <div>
        <label className="text-xs font-bold block mb-2">Kişilik Özellikleri (en fazla 8)</label>
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

      <Field label="Motto / İmza Cümlesi" value={data.motto} onChange={v => upd("motto", v)} />
    </div>
  );

  // ── Adım 4: Şablon & Önizleme ──────────────────────────────────────────────
  const Step4 = () => (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-bold mb-2">Şablon Seç ({TEMPLATES.length} seçenek)</p>
        <div className="grid grid-cols-3 gap-2">
          {TEMPLATES.map(t => (
            <button key={t.id} onClick={() => setSelectedTemplate(t.id)}
              className={`p-3 rounded-xl border text-left transition-all ${selectedTemplate === t.id ? "border-primary bg-primary/10" : "border-white/10 glass-card hover:border-primary/30"}`}>
              <div className="w-6 h-6 rounded-full mb-2" style={{ background: t.color }} />
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

      {/* Gizli render alanı (PDF için) */}
      <div style={{ position: "absolute", left: "-9999px", top: 0 }}>
        <div ref={cvRef}>
          <TemplateComponent data={data} photo={photo} />
        </div>
      </div>

      <div className="glass-card rounded-2xl overflow-auto" style={{ maxHeight: "50vh" }}>
        <div style={{ transform: "scale(0.45)", transformOrigin: "top left", width: "222%", pointerEvents: "none" }}>
          <TemplateComponent data={data} photo={photo} />
        </div>
      </div>
    </div>
  );

  const STEPS = [
    { label: "Kişisel", component: <Step1 /> },
    { label: "Deneyim", component: <Step2 /> },
    { label: "Yetenekler", component: <Step3 /> },
    { label: "Önizleme", component: <Step4 /> },
  ];

  return (
    <Layout>
      <div className="p-4 pb-8">
        {/* Adım göstergesi */}
        <div className="flex items-center justify-between mb-6">
          {STEPS.map((s, i) => (
            <React.Fragment key={i}>
              <div className="flex flex-col items-center gap-1" onClick={() => setStep(i + 1)} style={{ cursor: "pointer" }}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${step === i + 1 ? "bg-primary text-white" : step > i + 1 ? "bg-green-500/20 text-green-400 border border-green-500/40" : "bg-card border border-white/10 text-muted-foreground"}`}>
                  {step > i + 1 ? <Check className="w-4 h-4" /> : i + 1}
                </div>
                <span className={`text-[10px] ${step === i + 1 ? "text-primary font-semibold" : "text-muted-foreground"}`}>{s.label}</span>
              </div>
              {i < STEPS.length - 1 && <div className={`h-px flex-1 mx-1 mb-4 ${step > i + 1 ? "bg-green-500/40" : "bg-white/10"}`} />}
            </React.Fragment>
          ))}
        </div>

        <h1 className="text-xl font-extrabold mb-4">
          {STEPS[step - 1]?.label === "Önizleme" ? "Şablon & Önizleme" : `${step}. Adım — ${STEPS[step - 1]?.label}`}
        </h1>

        {STEPS[step - 1]?.component}

        {/* Navigasyon butonları */}
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

      {/* Tam Ekran Önizleme Modal */}
      {showPreview && (
        <div className="fixed inset-0 z-[200] bg-black/90 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 bg-card border-b border-white/10">
            <span className="font-bold text-sm">Önizleme — {TEMPLATES[selectedTemplate]?.name}</span>
            <div className="flex gap-2">
              <button onClick={handleDownload} disabled={isDownloading}
                className="flex items-center gap-1.5 text-xs bg-primary px-3 py-1.5 rounded-lg font-medium text-white">
                <Download className="w-3 h-3" /> {isDownloading ? "..." : "PDF İndir"}
              </button>
              <button onClick={() => setShowPreview(false)} className="text-xs border border-white/20 px-3 py-1.5 rounded-lg">Kapat</button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-4">
            <div style={{ transform: "scale(0.48)", transformOrigin: "top left", width: "208%", pointerEvents: "none" }}>
              <TemplateComponent data={data} photo={photo} />
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

// ─── Yardımcı Field bileşeni ──────────────────────────────────────────────────
function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder || ""}
        className="w-full bg-card border border-white/10 rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary/50 transition-colors" />
    </div>
  );
}

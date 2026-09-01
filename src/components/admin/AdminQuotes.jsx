import React, { useState, useEffect } from "react";

function AdminSection({ title, icon, T, onBack, onSave, children }) {
  const [saved, setSaved] = useState(false);

  const save = async () => {
    await onSave();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="app-shell" style={{ minHeight: "100vh", background: T.bg, fontFamily: "'Cairo',sans-serif", direction: "rtl", paddingBottom: "80px" }}>
      <div style={{ background: T.card, backdropFilter: "blur(16px)", borderBottom: `1px solid ${T.cardBorder}`, padding: "16px", display: "flex", alignItems: "center", gap: "12px" }}>
        <button onClick={onBack} style={{ background: T.accent, color: "#fff", border: "none", borderRadius: "12px", padding: "8px 18px", fontSize: "14px", fontWeight: "700", cursor: "pointer", fontFamily: "'Cairo',sans-serif" }}>← رجوع</button>
        <h2 style={{ margin: 0, color: T.text, fontSize: "18px", fontWeight: "800" }}>{icon} {title}</h2>
      </div>
      <div style={{ padding: "16px" }}>{children}</div>
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, maxWidth: "1200px", margin: "0 auto", background: T.navBg, backdropFilter: "blur(16px)", borderTop: `1px solid ${T.cardBorder}`, padding: "12px 16px" }}>
        <button onClick={save} style={{ width: "100%", background: saved ? "#238636" : `linear-gradient(135deg,${T.accent},${T.accent2})`, color: "#fff", border: "none", borderRadius: "14px", padding: "14px", fontSize: "15px", fontWeight: "700", cursor: "pointer", fontFamily: "'Cairo',sans-serif" }}>
          {saved ? "✅ تم الحفظ!" : "💾 حفظ التغييرات"}
        </button>
      </div>
    </div>
  );
}

export default function AdminQuotes({ config, saveConfig, T, onBack }) {
  const [quotes, setQuotes] = useState([...(config.motivationalQuotes || [])]);
  const [fixed, setFixed] = useState(Boolean(config.motivationalFixed));
  const [form, setForm] = useState({ text: "", duration: 60 });

  useEffect(() => {
    setQuotes(Array.isArray(config.motivationalQuotes) ? [...config.motivationalQuotes] : []);
    setFixed(Boolean(config.motivationalFixed));
  }, [config.motivationalQuotes, config.motivationalFixed]);

  const inp = { background: T.inputBg, border: `1.5px solid ${T.cardBorder}`, borderRadius: "12px", padding: "10px 12px", fontSize: "13px", color: T.text, width: "100%", outline: "none", fontFamily: "'Cairo',sans-serif", direction: "rtl", boxSizing: "border-box" };

  return (
    <AdminSection title="العبارات التحفيزية" icon="💬" T={T} onBack={onBack} onSave={() => saveConfig({ ...config, motivationalQuotes: quotes, motivationalFixed: fixed })}>
      <label style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px", color: T.text, fontSize: "14px" }}>
        <input type="checkbox" checked={fixed} onChange={e => setFixed(e.target.checked)} style={{ accentColor: T.accent }} />
        عبارة ثابتة (لا تتغير)
      </label>
      <div style={{ background: T.sectionBg, borderRadius: "14px", padding: "12px", marginBottom: "12px" }}>
        <textarea value={form.text} onChange={e => setForm(f => ({ ...f, text: e.target.value }))} placeholder="نص العبارة..." style={{ ...inp, height: "70px", resize: "vertical", marginBottom: "8px" }} />
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
          <span style={{ color: T.subtext, fontSize: "13px" }}>مدة الظهور (دقيقة):</span>
          <input type="number" value={form.duration} onChange={e => setForm(f => ({ ...f, duration: +e.target.value }))} style={{ ...inp, width: "80px" }} />
        </div>
        <button onClick={() => { if (!form.text) return; setQuotes(q => [...q, { ...form }]); setForm({ text: "", duration: 60 }); }} style={{ background: `linear-gradient(135deg,${T.accent},${T.accent2})`, color: "#fff", border: "none", borderRadius: "10px", padding: "10px 18px", cursor: "pointer", fontFamily: "'Cairo',sans-serif" }}>+ إضافة</button>
      </div>
      {quotes.map((q, i) => (
        <div key={i} style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: "12px", padding: "10px 12px", marginBottom: "8px", display: "flex", gap: "10px", alignItems: "center" }}>
          <div style={{ flex: 1 }}>
            <p style={{ margin: "0 0 3px", color: T.text, fontSize: "13px" }}>{q.text}</p>
            <p style={{ margin: 0, color: T.subtext, fontSize: "11px" }}>كل {q.duration} دقيقة</p>
          </div>
          <button onClick={() => setQuotes(q => q.filter((_, j) => j !== i))} style={{ background: "#e5533322", border: "1px solid #e55", color: "#e55", borderRadius: "8px", padding: "6px 10px", cursor: "pointer" }}>🗑️</button>
        </div>
      ))}
    </AdminSection>
  );
}

import React, { useState } from "react";

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

export default function AdminContact({ config, saveConfig, T, onBack }) {
  const [links, setLinks] = useState([...(config.contactLinks || [])]);
  const [form, setForm] = useState({ label: "", url: "", icon: "💬" });

  const inp = { background: T.inputBg, border: `1.5px solid ${T.cardBorder}`, borderRadius: "12px", padding: "10px 12px", fontSize: "13px", color: T.text, flex: 1, outline: "none", fontFamily: "'Cairo',sans-serif", direction: "rtl" };

  return (
    <AdminSection title="روابط التواصل" icon="📞" T={T} onBack={onBack} onSave={() => saveConfig({ ...config, contactLinks: links })}>
      <div style={{ background: T.sectionBg, borderRadius: "14px", padding: "12px", marginBottom: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <input value={form.icon} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))} placeholder="أيقونة" style={inp} />
        <input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="اسم الرابط" style={inp} />
        <input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="الرابط" style={inp} />
        <button onClick={() => { if (!form.label || !form.url) return; setLinks(l => [...l, { ...form }]); setForm({ label: "", url: "", icon: "💬" }); }} style={{ background: `linear-gradient(135deg,${T.accent},${T.accent2})`, color: "#fff", border: "none", borderRadius: "10px", padding: "10px", cursor: "pointer", fontFamily: "'Cairo',sans-serif" }}>+ إضافة</button>
      </div>
      {links.map((l, i) => (
        <div key={i} style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: "12px", padding: "10px 12px", marginBottom: "8px", display: "flex", alignItems: "center", gap: "10px" }}>
          <span>{l.icon}</span>
          <span style={{ flex: 1, color: T.text, fontSize: "13px" }}>{l.label}</span>
          <button onClick={() => setLinks(l => l.filter((_, j) => j !== i))} style={{ background: "#e5533322", border: "1px solid #e55", color: "#e55", borderRadius: "8px", padding: "6px 10px", cursor: "pointer" }}>🗑️</button>
        </div>
      ))}
    </AdminSection>
  );
}

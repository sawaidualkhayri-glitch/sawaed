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

export default function AdminNews({ config, saveConfig, T, onBack, getNews, addNewsItem, deleteNewsItem, normalizeNewsItem, formatNewsDate }) {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pinnedIds, setPinnedIds] = useState(() => {
    const raw = config.pinnedNews;
    return raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : [];
  });
  const [form, setForm] = useState({ title: "", content: "", source: "", link: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    getNews().then(d => {
      if (!isMounted) return;
      setNews(d);
      setLoading(false);
    }).catch(err => {
      console.error("Failed to load news:", err);
      if (isMounted) setLoading(false);
    });
    return () => { isMounted = false; };
  }, [getNews]);

  const addNews = async () => {
    if (!form.title.trim() || !form.content.trim()) return;
    setSaving(true);
    setError("");

    const payload = {
      title: form.title.trim(),
      content: form.content.trim(),
      source: form.source.trim(),
      link: form.link.trim(),
    };

    const item = await addNewsItem(payload);
    if (item) {
      setNews(n => [normalizeNewsItem(item), ...n]);
      setForm({ title: "", content: "", source: "", link: "" });
    } else {
      setError("تعذّر نشر الخبر. تحقق من اتصالك بالإنترنت وحاول مرة أخرى.");
    }
    setSaving(false);
  };

  const deleteNews = async (id) => {
    const success = await deleteNewsItem(id);
    if (success) {
      setNews(n => n.filter(x => x.id !== id));
    } else {
      alert("⚠️ تعذّر حذف الخبر. حاول مرة أخرى.");
    }
  };

  const inp = { background: T.inputBg, border: `1.5px solid ${T.cardBorder}`, borderRadius: "12px", padding: "10px 12px", fontSize: "13px", color: T.text, width: "100%", outline: "none", fontFamily: "'Cairo',sans-serif", direction: "rtl", boxSizing: "border-box", marginBottom: "8px" };

  return (
    <AdminSection title="الأخبار" icon="📰" T={T} onBack={onBack} onSave={() => {}}>
      <div style={{ background: T.sectionBg, borderRadius: "14px", padding: "12px", marginBottom: "14px" }}>
        <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="عنوان الخبر *" style={inp} />
        <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} placeholder="محتوى الخبر..." style={{ ...inp, height: "100px", resize: "vertical" }} />
        <input value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))} placeholder="المصدر" style={inp} />
        <input value={form.link} onChange={e => setForm(f => ({ ...f, link: e.target.value }))} placeholder="رابط الخبر (اختياري)" style={inp} />
        <button onClick={addNews} disabled={saving || !form.title.trim() || !form.content.trim()} style={{ background: `linear-gradient(135deg,${T.accent},${T.accent2})`, color: "#fff", border: "none", borderRadius: "10px", padding: "10px 18px", cursor: saving ? "not-allowed" : "pointer", fontFamily: "'Cairo',sans-serif" }}>
          {saving ? "⏳ جاري النشر..." : "📢 نشر الخبر"}
        </button>
        {error ? <p style={{ color: "#f88", margin: "10px 0 0", fontSize: "13px" }}>{error}</p> : null}
      </div>
      {loading ? (
        <div style={{ textAlign: "center", padding: "40px" }}>
          <div style={{ fontSize: "24px" }}>⏳</div>
          <p style={{ color: T.subtext }}>جاري تحميل الأخبار...</p>
        </div>
      ) : news.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px" }}>
          <div style={{ fontSize: "48px" }}>📭</div>
          <p style={{ color: T.subtext }}>لا توجد أخبار بعد</p>
        </div>
      ) : news.map(n => (
        <div key={n.id} style={{ background: T.card, border: `1px solid ${pinnedIds.includes(n.id) ? T.accent + "66" : T.cardBorder}`, borderRadius: "14px", padding: "14px", marginBottom: "12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: "0 0 6px", fontWeight: "700", color: T.text, fontSize: "15px" }}>{n.title}</p>
              <p style={{ margin: "0 4px 8px", color: T.subtext, fontSize: "12px" }}>{n.source || "بدون مصدر"} · {formatNewsDate(n.createdAt)}</p>
              <p style={{ margin: 0, color: T.text, fontSize: "14px", lineHeight: "1.75" }}>{n.content}</p>
            </div>
            <div style={{ display: "flex", gap: "10px", alignItems: "flex-start", marginTop: "4px" }}>
              {n.link ? (
                <a href={n.link} target="_blank" rel="noreferrer" style={{ background: `linear-gradient(135deg,${T.accent},${T.accent2})`, color: "#fff", borderRadius: "10px", padding: "8px 12px", textDecoration: "none", fontSize: "13px" }}>فتح الرابط</a>
              ) : null}
              <button onClick={() => deleteNews(n.id)} style={{ background: "#e5533322", border: "1px solid #e55", color: "#e55", borderRadius: "10px", padding: "8px 12px", cursor: "pointer", fontSize: "13px" }}>حذف</button>
            </div>
          </div>
        </div>
      ))}
    </AdminSection>
  );
}

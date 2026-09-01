import { useState } from "react";
import AdminSection from "./AdminSection.jsx";

function AdminNav({ config, saveConfig, T, onBack }) {
  const [pages, setPages] = useState([...(config.navPages || [])]);
  const [form, setForm] = useState({ id: "", label: "", icon: "📄" });
  const [editingId, setEditingId] = useState(null);
  const [blockForm, setBlockForm] = useState({ type: "text", value: "", url: "" });

  const BUILTIN_IDS = ["home", "foundation", "news", "saved", "settings"];

  const inp = { background: T.inputBg, border: `1.5px solid ${T.cardBorder}`, borderRadius: "12px", padding: "10px 12px", fontSize: "13px", color: T.text, flex: 1, outline: "none", fontFamily: "'Cairo',sans-serif", direction: "rtl" };

  const movePage = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= pages.length) return;
    const updated = [...pages];
    [updated[i], updated[j]] = [updated[j], updated[i]];
    setPages(updated);
  };

  const addPage = () => {
    if (!form.label || !form.id) return;
    if (pages.some(p => p.id === form.id)) { alert("المعرف مستخدم مسبقاً"); return; }
    setPages(p => [...p, { ...form, custom: !BUILTIN_IDS.includes(form.id), content: [] }]);
    setForm({ id: "", label: "", icon: "📄" });
  };

  const addBlock = (pageId) => {
    if (!blockForm.value.trim()) return;
    setPages(ps => ps.map(p => p.id === pageId ? { ...p, content: [...(p.content || []), { ...blockForm }] } : p));
    setBlockForm({ type: "text", value: "", url: "" });
  };

  const removeBlock = (pageId, idx) => {
    setPages(ps => ps.map(p => p.id === pageId ? { ...p, content: (p.content || []).filter((_, i) => i !== idx) } : p));
  };

  return (
    <AdminSection title="الصفحات والتنقل" icon="🧭" T={T} onBack={onBack} onSave={() => saveConfig({ ...config, navPages: pages })}>
      <p style={{ color: T.subtext, fontSize: "12px", margin: "0 0 12px" }}>استخدم الأسهم لإعادة ترتيب الأزرار كما تظهر في الشريط السفلي. الصفحات الجديدة (غير الأساسية) يمكنك إضافة محتوى نصي/روابط لها مباشرة.</p>
      <div style={{ background: T.sectionBg, borderRadius: "14px", padding: "12px", marginBottom: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <input value={form.icon} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))} placeholder="أيقونة (إيموجي)" style={inp} />
        <input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="اسم الصفحة" style={inp} />
        <input value={form.id} onChange={e => setForm(f => ({ ...f, id: e.target.value.replace(/\s+/g, "_") }))} placeholder="معرف (بالإنجليزي)" style={inp} />
        <button onClick={addPage} style={{ background: `linear-gradient(135deg,${T.accent},${T.accent2})`, color: "#fff", border: "none", borderRadius: "10px", padding: "10px", cursor: "pointer", fontFamily: "'Cairo',sans-serif" }}>+ إضافة</button>
      </div>
      {pages.map((p, i) => (
        <div key={p.id} style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: "12px", padding: "10px 12px", marginBottom: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <button onClick={() => movePage(i, -1)} disabled={i === 0} style={{ background: "transparent", border: "none", cursor: i === 0 ? "default" : "pointer", opacity: i === 0 ? 0.3 : 1, fontSize: "14px" }}>▲</button>
              <button onClick={() => movePage(i, 1)} disabled={i === pages.length - 1} style={{ background: "transparent", border: "none", cursor: i === pages.length - 1 ? "default" : "pointer", opacity: i === pages.length - 1 ? 0.3 : 1, fontSize: "14px" }}>▼</button>
            </div>
            <span style={{ fontSize: "22px" }}>{p.icon}</span>
            <span style={{ flex: 1, color: T.text, fontSize: "14px" }}>{p.label}</span>
            {p.custom && <button onClick={() => setEditingId(editingId === p.id ? null : p.id)} style={{ background: `${T.accent}22`, border: "none", borderRadius: "8px", padding: "6px 10px", cursor: "pointer", fontSize: "14px" }}>✏️ محتوى</button>}
            {!BUILTIN_IDS.includes(p.id) && <button onClick={() => setPages(ps => ps.filter((_, j) => j !== i))} style={{ background: "#e5533322", border: "1px solid #e55", color: "#e55", borderRadius: "8px", padding: "6px 10px", cursor: "pointer" }}>🗑️</button>}
          </div>
          {p.custom && editingId === p.id && (
            <div style={{ marginTop: "10px", background: T.sectionBg, borderRadius: "10px", padding: "10px" }}>
              {(p.content || []).map((b, bi) => (
                <div key={bi} style={{ display: "flex", alignItems: "center", gap: "8px", background: T.card, borderRadius: "8px", padding: "8px 10px", marginBottom: "6px" }}>
                  <span style={{ flex: 1, fontSize: "13px", color: T.text }}>{b.type === "link" ? `🔗 ${b.value} → ${b.url}` : `📝 ${b.value}`}</span>
                  <button onClick={() => removeBlock(p.id, bi)} style={{ background: "transparent", border: "none", color: "#e55", cursor: "pointer" }}>✕</button>
                </div>
              ))}
              <select value={blockForm.type} onChange={e => setBlockForm(f => ({ ...f, type: e.target.value }))} style={{ ...inp, width: "100%", marginBottom: "6px" }}>
                <option value="text">فقرة نصية</option>
                <option value="link">رابط</option>
              </select>
              <input value={blockForm.value} onChange={e => setBlockForm(f => ({ ...f, value: e.target.value }))} placeholder={blockForm.type === "link" ? "اسم الرابط" : "النص"} style={{ ...inp, width: "100%", marginBottom: "6px", boxSizing: "border-box" }} />
              {blockForm.type === "link" && <input value={blockForm.url} onChange={e => setBlockForm(f => ({ ...f, url: e.target.value }))} placeholder="عنوان الرابط (https://...)" style={{ ...inp, width: "100%", marginBottom: "6px", boxSizing: "border-box" }} />}
              <button onClick={() => addBlock(p.id)} style={{ background: T.accent, color: "#fff", border: "none", borderRadius: "8px", padding: "8px 14px", cursor: "pointer", fontFamily: "'Cairo',sans-serif" }}>+ إضافة للمحتوى</button>
            </div>
          )}
        </div>
      ))}
    </AdminSection>
  );
}

export default AdminNav;

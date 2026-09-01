import { useState, useEffect } from "react";
import AdminSection from "./AdminSection.jsx";
import {
  normalizeSubjectsMap,
  findMatchingSubjectEntries,
  normalizeSubjectList,
  getCanonicalSubjectKey,
} from "../../constants";

export default function AdminSubjects({ config, saveConfig, T, onBack }) {
  const subjectKeyOptions = (config.grades || []).flatMap(g =>
    (config.branches || []).map(b => ({
      value: getCanonicalSubjectKey(g, b),
      label: `${g} --- ${b}`,
    }))
  );
  const [selKey, setSelKey] = useState(subjectKeyOptions[0]?.value || "");
  const [selSemester, setSelSemester] = useState("1");
  const [subs, setSubs] = useState(() => normalizeSubjectsMap(config.subjects || {}));
  const [newSub, setNewSub] = useState("");

  useEffect(() => {
    setSubs(normalizeSubjectsMap(config.subjects || {}));
  }, [config.subjects]);

  useEffect(() => {
    if (!subjectKeyOptions.some(option => option.value === selKey)) {
      setSelKey(subjectKeyOptions[0]?.value || "");
    }
  }, [subjectKeyOptions, selKey]);

  const currentCompoundKey = selKey;

  const inp = { 
    background: T.inputBg, 
    border: `1.5px solid ${T.cardBorder}`, 
    borderRadius: "12px", 
    padding: "10px 12px", 
    fontSize: "14px", 
    color: T.text, 
    flex: 1, 
    outline: "none", 
    fontFamily: "'Cairo',sans-serif", 
    direction: "rtl" 
  };

  const currentSubjects = normalizeSubjectList(findMatchingSubjectEntries(subs, currentCompoundKey));
  const activeSubjects = currentSubjects.filter(item => item.active);
  const hiddenSubjects = currentSubjects.filter(item => !item.active);

  const addSubject = () => {
    const trimmed = newSub.trim();
    if (!trimmed) return;
    const existingNames = currentSubjects.map(item => item.name);
    if (existingNames.includes(trimmed)) {
      setNewSub("");
      return;
    }
    setSubs(p => ({
      ...p,
      [currentCompoundKey]: [...currentSubjects, { name: trimmed, active: true }],
    }));
    setNewSub("");
  };

  const toggleSubjectActive = (subjectName) => {
    setSubs(p => ({
      ...p,
      [currentCompoundKey]: normalizeSubjectList(p[currentCompoundKey] || []).map(item =>
        item.name === subjectName ? { ...item, active: !item.active } : item
      ),
    }));
  };

  return (
    <AdminSection title="المواد الدراسية" icon="📚" T={T} onBack={onBack} onSave={() => saveConfig({ ...config, subjects: subs })}>
      
      <label style={{ fontSize: "13px", color: T.subtext, display: "block", marginBottom: "4px" }}>اختر الصف والفرع:</label>
      <select value={selKey} onChange={e => setSelKey(e.target.value)} style={{ ...inp, flex: "unset", width: "100%", marginBottom: "14px", padding: "12px" }}>
        {subjectKeyOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>

      <label style={{ fontSize: "13px", color: T.subtext, display: "block", marginBottom: "4px" }}>اختر الفصل الدراسي للمادة:</label>
      <select value={selSemester} onChange={e => setSelSemester(e.target.value)} style={{ ...inp, flex: "unset", width: "100%", marginBottom: "20px", padding: "12px" }}>
        <option value="1">الفصل الدراسي الأول</option>
        <option value="2">الفصل الدراسي الثاني</option>
      </select>

      <hr style={{ border: `0.5px solid ${T.cardBorder}`, marginBottom: "20px" }} />

      <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
        <input value={newSub} onChange={e => setNewSub(e.target.value)} placeholder="اسم المادة الجديدة..." style={inp} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addSubject(); } }} />
        <button onClick={addSubject} style={{ background: `linear-gradient(135deg,${T.accent},${T.accent2})`, color: "#fff", border: "none", borderRadius: "12px", padding: "10px 16px", cursor: "pointer", fontSize: "18px", flexShrink: 0 }}>+</button>
      </div>

      {currentSubjects.length === 0 ? (
        <div style={{ textAlign: "center", padding: "30px", background: T.card, borderRadius: "16px", border: `1px solid ${T.cardBorder}` }}>
          <p style={{ margin: 0, color: T.subtext }}>لم يتم إضافة مواد لهذا الصف بعد.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {activeSubjects.map(item => (
            <div key={item.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", padding: "10px 14px", background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: "14px" }}>
              <span style={{ color: T.text, fontWeight: "700", fontSize: "14px" }}>{item.name}</span>
              <button onClick={() => toggleSubjectActive(item.name)} style={{ background: "#e5533322", border: "1px solid #e55", color: "#e55", borderRadius: "10px", padding: "8px 12px", cursor: "pointer", fontSize: "13px" }}>إخفاء / ✕</button>
            </div>
          ))}
          {hiddenSubjects.length > 0 && (
            <div style={{ padding: "10px 14px", background: T.sectionBg, borderRadius: "14px", border: `1px solid ${T.cardBorder}` }}>
              <p style={{ margin: "0 0 10px", color: T.subtext, fontSize: "13px" }}>المواد المخفية</p>
              {hiddenSubjects.map(item => (
                <div key={item.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", padding: "10px", background: "rgba(255,255,255,0.04)", borderRadius: "12px" }}>
                  <span style={{ color: T.subtext, fontSize: "14px", opacity: 0.7 }}>{item.name}</span>
                  <button onClick={() => toggleSubjectActive(item.name)} style={{ background: "#36a4f022", border: `1px solid ${T.accent}`, color: T.accent, borderRadius: "10px", padding: "8px 12px", cursor: "pointer", fontSize: "13px" }}>استرجاع / 👁️</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </AdminSection>
  );
}

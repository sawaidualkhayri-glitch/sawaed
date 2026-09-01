import { useState, useEffect } from "react";
import AdminSection from "./AdminSection.jsx";

export default function AdminSections({ config, saveConfig, T, onBack, getSubjectNames }) {
  const [sections, setSections] = useState([...(config.subjectSections || [])]);
  const [newSec, setNewSec] = useState("");

  const grades = config.grades || [];
  const branches = config.branches || [];
  const [selectedGrade, setSelectedGrade] = useState(grades[0] || "");
  const [selectedBranch, setSelectedBranch] = useState(branches[0] || "");
  const [selectedSemester, setSelectedSemester] = useState("فصل أول");
  const [selectedSubject, setSelectedSubject] = useState("");

  const getAvailableSubjects = () => {
    const allSubs = new Set();
    const brs = config.branches || branches;
    brs.forEach(br => {
      const k = `${selectedGrade}_${br}`;
      getSubjectNames(config.subjects?.[k] || [], true).forEach(sub => allSubs.add(sub));
    });
    return Array.from(allSubs);
  };

  const availableSubjects = getAvailableSubjects();

  const getSubjectKey = () => {
    const isGrade11 = selectedGrade.includes("حادي عشر");
    const semesterKey = isGrade11 ? selectedSemester : "فصل واحد";
    return `${selectedGrade}_${selectedBranch}${isGrade11 ? `_${semesterKey}` : ""}`;
  };

  const subjectKey = getSubjectKey();

  useEffect(() => {
    if (availableSubjects.length > 0 && !selectedSubject) {
      setSelectedSubject(availableSubjects[0]);
    }
  }, [selectedGrade, subjectKey, availableSubjects]);

  const inp = { background: T.inputBg, border: `1.5px solid ${T.cardBorder}`, borderRadius: "12px", padding: "10px 12px", fontSize: "14px", color: T.text, flex: 1, outline: "none", fontFamily: "'Cairo',sans-serif", direction: "rtl" };
  const selectStyle = { ...inp, flex: "unset", width: "100%", marginBottom: "8px" };

  return (
    <AdminSection title="أقسام المادة" icon="📑" T={T} onBack={onBack} onSave={() => saveConfig({ ...config, subjectSections: sections })}>
      <p style={{ color: T.subtext, fontSize: "13px", margin: "0 0 14px" }}>اختر الصف والفرع والفصل والمادة ثم أضف الأقسام. (تم الإصلاح: كل المواد مرئية عبر الفروع والفصول)</p>

      <select value={selectedGrade} onChange={e => { setSelectedGrade(e.target.value); setSelectedSubject(""); }} style={selectStyle}>
        {grades.map(g => <option key={g} value={g}>{g}</option>)}
      </select>

      <select value={selectedBranch} onChange={e => { setSelectedBranch(e.target.value); setSelectedSubject(""); }} style={selectStyle}>
        {branches.map(b => <option key={b} value={b}>{b}</option>)}
      </select>

      {selectedGrade.includes("حادي عشر") && (
        <select value={selectedSemester} onChange={e => { setSelectedSemester(e.target.value); setSelectedSubject(""); }} style={selectStyle}>
          <option value="فصل أول">فصل أول</option>
          <option value="فصل ثان">فصل ثان</option>
        </select>
      )}

            <select value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)} style={selectStyle}>
        {availableSubjects.length > 0 ? (
          availableSubjects.map(s => <option key={s} value={s}>{s}</option>)
        ) : (
          <option value="">لا توجد مواد</option>
        )}
      </select>

      <div style={{ background: T.sectionBg, borderRadius: "14px", padding: "12px", marginBottom: "12px" }}>
        <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
          <input value={newSec} onChange={e => setNewSec(e.target.value)} placeholder="اسم القسم الجديد..." style={inp} />
          <button onClick={() => {
            if (newSec.trim()) {
              const updated = [...sections, newSec.trim()];
              setSections(updated);
              setNewSec("");
            }
          }} style={{ background: T.accent, color: "#fff", border: "none", borderRadius: "10px", padding: "10px 20px", cursor: "pointer" }}>إضافة</button>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
          {sections.map((sec, idx) => (
            <div key={idx} style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: "20px", padding: "6px 14px", display: "flex", alignItems: "center", gap: "6px" }}>
              <span>{sec}</span>
              <button onClick={() => {
                const updated = sections.filter((_, i) => i !== idx);
                setSections(updated);
              }} style={{ background: "transparent", border: "none", color: T.danger, cursor: "pointer", fontSize: "14px" }}>✕</button>
            </div>
          ))}
        </div>
      </div>
    </AdminSection>
  );
}
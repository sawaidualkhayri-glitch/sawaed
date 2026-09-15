import { useState, useEffect } from "react";
import AdminSection from "./AdminSection.jsx";
import IconSelect from "../ui/IconSelect.jsx";
import { getSectionIcon, getSubjectIcon } from "../../utils/dropdownIcons.js";

const DEFAULT_SECTIONS = ["الرزم", "الكتب", "حلول الكتب", "مواد تعليمية", "ملخصات", "أسئلة واختبارات سابقة", "اختبارات إلكترونية", "عروض تقديمية", "الدراسة للامتحانات", "قنوات يوتيوب شارحة"];

export default function AdminSections({ config, saveConfig, T, onBack, getSubjectNames, role }) {
  const [sections, setSections] = useState([]);
  const [newSec, setNewSec] = useState("");

  const grades = config.grades || [];
  const branches = config.branches || [];
  const [selectedGrade, setSelectedGrade] = useState(grades[0] || "");
  const [selectedBranch, setSelectedBranch] = useState(branches[0] || "");
  const [selectedSemester, setSelectedSemester] = useState("فصل أول");
  const [selectedSubject, setSelectedSubject] = useState("");

  const getAvailableSubjects = () => {
    const subjectKey = `${selectedGrade}_${selectedBranch}`;
    return getSubjectNames(config.subjects?.[subjectKey] || [], true);
  };

  const availableSubjects = getAvailableSubjects();

  const getSubjectKey = () => {
    const isGrade11 = selectedGrade.includes("حادي عشر");
    const semesterKey = isGrade11 ? selectedSemester : "فصل واحد";
    return `${selectedGrade}_${selectedBranch}${isGrade11 ? `_${semesterKey}` : ""}`;
  };

  const subjectKey = getSubjectKey();
  const isSuperAdmin = role === "super_admin" || role === "superadmin";

  const normalizeSections = (value) => (Array.isArray(value) ? value : DEFAULT_SECTIONS)
    .map(section => typeof section === "string" ? { name: section, hidden: false } : { name: String(section?.name || "").trim(), hidden: section?.hidden === true })
    .filter(section => section.name);

  const getSectionsForSubject = () => {
    const storedSections = config.subjectSections;
    if (Array.isArray(storedSections)) return normalizeSections(storedSections);
    return normalizeSections(storedSections?.[subjectKey]?.[selectedSubject]);
  };

  useEffect(() => {
    if (!availableSubjects.includes(selectedSubject)) {
      setSelectedSubject(availableSubjects[0] || "");
    }
  }, [selectedGrade, selectedBranch, JSON.stringify(availableSubjects)]);

  useEffect(() => {
    if (selectedSubject) setSections([...getSectionsForSubject()]);
  }, [selectedSubject, subjectKey]);

  const saveSections = () => {
    if (!selectedSubject || !subjectKey) return saveConfig(config);
    const storedSections = Array.isArray(config.subjectSections) ? {} : (config.subjectSections || {});
    const updatedSubjectSections = {
      ...storedSections,
      [subjectKey]: {
        ...(storedSections[subjectKey] || {}),
        [selectedSubject]: sections,
      },
    };
    return saveConfig({ ...config, subjectSections: updatedSubjectSections });
  };

  const inp = { background: T.inputBg, border: `1.5px solid ${T.cardBorder}`, borderRadius: "12px", padding: "10px 12px", fontSize: "14px", color: T.text, flex: 1, outline: "none", fontFamily: "'Cairo',sans-serif", direction: "rtl" };
  const selectStyle = { ...inp, flex: "unset", width: "100%", marginBottom: "8px" };
  const subjectOptions = availableSubjects.map(subjectName => ({ value: subjectName, label: subjectName, icon: getSubjectIcon(config, subjectName) }));

  return (
    <AdminSection title="أقسام المادة" icon="📑" T={T} onBack={onBack} onSave={saveSections}>
      <p style={{ color: T.subtext, fontSize: "13px", margin: "0 0 14px" }}>اختر الصف والفرع والفصل والمادة ثم أضف الأقسام. (تم الإصلاح: كل المواد مرئية عبر الفروع والفصول)</p>

      <select value={selectedGrade} onChange={e => setSelectedGrade(e.target.value)} style={selectStyle}>
        {grades.map(g => <option key={g} value={g}>{g}</option>)}
      </select>

      <select value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)} style={selectStyle}>
        {branches.map(b => <option key={b} value={b}>{b}</option>)}
      </select>

      {selectedGrade.includes("حادي عشر") && (
        <select value={selectedSemester} onChange={e => setSelectedSemester(e.target.value)} style={selectStyle}>
          <option value="فصل أول">فصل أول</option>
          <option value="فصل ثان">فصل ثان</option>
        </select>
      )}

            <IconSelect value={selectedSubject} onChange={setSelectedSubject} options={subjectOptions} style={selectStyle} ariaLabel="المادة" />

      <div style={{ background: T.sectionBg, borderRadius: "14px", padding: "12px", marginBottom: "12px" }}>
        <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
          <input value={newSec} onChange={e => setNewSec(e.target.value)} placeholder="اسم القسم الجديد..." style={inp} />
          <button onClick={() => {
            if (newSec.trim()) {
              const updated = [...sections, { name: newSec.trim(), hidden: false }];
              setSections(updated);
              setNewSec("");
            }
          }} style={{ background: T.accent, color: "#fff", border: "none", borderRadius: "10px", padding: "10px 20px", cursor: "pointer" }}>إضافة</button>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
          {sections.map((sec, idx) => (
            <div key={`${sec.name}-${idx}`} style={{ background: T.card, border: `1.5px solid ${T.cardBorder}`, borderRadius: "24px", padding: "6px 14px", display: "flex", alignItems: "center", gap: "8px", opacity: sec.hidden ? 0.5 : 1 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}><span aria-hidden="true">{getSectionIcon(sec.name)}</span><span>{sec.name}</span></span>
              <button type="button" onClick={() => setSections(current => current.map((item, itemIndex) => itemIndex === idx ? { ...item, hidden: !item.hidden } : item))} title={sec.hidden ? "إظهار القسم" : "إخفاء القسم"} aria-label={sec.hidden ? `إظهار ${sec.name}` : `إخفاء ${sec.name}`} style={{ width: "26px", height: "26px", borderRadius: "50%", border: `1px solid ${(T.accent || "#7c73f5")}55`, background: `${T.accent || "#7c73f5"}22`, color: T.accent || "#a89af5", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "12px", cursor: "pointer", padding: 0, lineHeight: 1 }}>{sec.hidden ? "👁️‍🗨️" : "👁️"}</button>
              {isSuperAdmin && <button type="button" onClick={() => setSections(current => current.filter((_, itemIndex) => itemIndex !== idx))} title="حذف القسم نهائيا" aria-label={`حذف ${sec.name}`} style={{ width: "26px", height: "26px", borderRadius: "50%", border: `1px solid ${(T.danger || "#ef4444")}55`, background: `${T.danger || "#ef4444"}22`, color: T.danger || "#f87171", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "12px", cursor: "pointer", padding: 0, lineHeight: 1 }}>✕</button>}
            </div>
          ))}
        </div>
      </div>
    </AdminSection>
  );
}
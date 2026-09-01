import { useEffect, useState } from "react";
import confetti from "canvas-confetti";

export default function SubjectPage({ config, saveConfig, T, darkMode, currentUser, updateUser, subject, onBack, isEditorSession, onOpenFolder, canonicalizeGrade, canonicalizeBranch, EMOJI, SEC_EMOJI }) {
  const { subject: sub, grade, branch } = subject;
  const canonicalGrade = canonicalizeGrade(grade);
  const canonicalBranch = canonicalizeBranch(branch);
  const isGrade11 = canonicalGrade.includes("حادي عشر");
  const [selectedSemester, setSelectedSemester] = useState(null);

  useEffect(() => {
    const savedSemester = localStorage.getItem(`sawaed_semester_${grade}_${branch}_${sub}`);
    if (savedSemester) {
      setSelectedSemester(savedSemester);
    } else if (isGrade11) {
      setSelectedSemester("فصل أول");
    } else {
      // For Tawjihi (ثاني عشر) and other grades: use single unified semester
      setSelectedSemester("فصل واحد");
    }
  }, []);

  const handleSemesterChange = (semester) => {
    setSelectedSemester(semester);
    localStorage.setItem(`sawaed_semester_${grade}_${branch}_${sub}`, semester);
  };

  const semesterKey = isGrade11 ? selectedSemester : "فصل واحد";

  const getSubjectKey = () => {
    if (isGrade11 && selectedSemester) {
      return `${canonicalGrade}_${canonicalBranch}_${selectedSemester}`;
    } else if (!isGrade11) {
      return `${canonicalGrade}_${canonicalBranch}`;
    }
    return null;
  };

  const subjectKey = getSubjectKey();

  // Resolve lessons key using multiple fallbacks to match AdminLessons saving patterns
  const gb = `${canonicalGrade}_${canonicalBranch}`;
  const semLabel = selectedSemester;
  const semNumeric = semLabel === "فصل أول" ? "1" : semLabel === "فصل ثان" ? "2" : semLabel;
  const candidateKeys = [
    `lessons_${subjectKey}_${sub}`,
    `lessons_${canonicalGrade}_${canonicalBranch}_${selectedSemester}_${sub}`,
    `lessons_${gb}_sem${semLabel}_${sub}`,
    `lessons_${gb}_sem${semNumeric}_${sub}`,
    `lessons_${gb}_${sub}`,
  ];

  let lessons = [];
  for (const k of candidateKeys) {
    const raw = config[k];
    if (raw && ((typeof raw === "string" && raw.trim() !== "") || Array.isArray(raw))) {
      try {
        lessons = typeof raw === "string" ? JSON.parse(raw) : raw;
        break;
      } catch (e) {
        console.warn(`Failed to parse lessons at key ${k}:`, e);
      }
    }
  }
  const progressKey = `${subjectKey}_${sub}`;
  const rawDoneLessons = Array.isArray(currentUser?.progress?.[progressKey]) ? currentUser.progress[progressKey] : [];
  const doneLessons = lessons.filter((lesson) => rawDoneLessons.includes(lesson));
  const done = doneLessons.length;
  const total = lessons.length;
  const pct = total ? Math.min(Math.round((done / total) * 100), 100) : 0;
  const [celebrated, setCelebrated] = useState(false);
  const [showLessons, setShowLessons] = useState(false);

  const sections = config.subjectSections || [];

  const toggleLesson = async (l) => {
    const arr = [...doneLessons];
    const idx = arr.indexOf(l);
    if (idx >= 0) arr.splice(idx, 1); else arr.push(l);
    await updateUser({ progress: { ...currentUser.progress, [progressKey]: arr } });
  };

  useEffect(() => {
    if (!currentUser) return;
    if (!Array.isArray(rawDoneLessons)) return;
    const hasStaleItems = rawDoneLessons.some((lesson) => !lessons.includes(lesson));
    if (hasStaleItems) {
      updateUser({ progress: { ...currentUser.progress, [progressKey]: doneLessons } }).catch(console.error);
    }
  }, [currentUser, lessons, progressKey, rawDoneLessons, doneLessons, updateUser]);

  useEffect(() => {
    if (total > 0 && pct === 100 && !celebrated) {
      setCelebrated(true);
      confetti({ particleCount: 120, spread: 90, origin: { y: 0.45 } });
      confetti({ particleCount: 80, angle: 60, spread: 70, origin: { x: 0.2, y: 0.4 } });
      confetti({ particleCount: 80, angle: 120, spread: 70, origin: { x: 0.8, y: 0.4 } });
    }
    if (pct < 100 && celebrated) {
      setCelebrated(false);
    }
  }, [pct, total, celebrated]);

  if (isGrade11 && !selectedSemester) {
    return (
      <div className="app-shell" style={{ minHeight: "100vh", background: T.bg, fontFamily: "'Cairo',sans-serif", direction: "rtl", padding: "20px", boxSizing: "border-box" }}>
        <button onClick={onBack} style={{ background: T.accent, color: "#fff", border: "none", borderRadius: "12px", padding: "8px 18px", fontSize: "14px", fontWeight: "700", cursor: "pointer", fontFamily: "'Cairo',sans-serif", marginBottom: "16px" }}>← رجوع</button>
        <h2 style={{ color: T.text, fontSize: "20px", fontWeight: "800", marginBottom: "16px" }}>📚 {sub}</h2>
        <p style={{ color: T.subtext, marginBottom: "20px" }}>اختر الفصل الدراسي:</p>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <button onClick={() => handleSemesterChange("فصل أول")} style={{ flex: 1, minWidth: 0, background: T.card, border: `2px solid ${T.accent}`, borderRadius: "16px", padding: "20px", cursor: "pointer", textAlign: "center", backdropFilter: "blur(12px)" }}>
            <div style={{ fontSize: "32px", marginBottom: "8px" }}>📖</div>
            <div style={{ fontSize: "16px", fontWeight: "700", color: T.text }}>الفصل الأول</div>
          </button>
          <button onClick={() => handleSemesterChange("فصل ثان")} style={{ flex: 1, minWidth: 0, background: T.card, border: `2px solid ${T.accent}`, borderRadius: "16px", padding: "20px", cursor: "pointer", textAlign: "center", backdropFilter: "blur(12px)" }}>
            <div style={{ fontSize: "32px", marginBottom: "8px" }}>📖</div>
            <div style={{ fontSize: "16px", fontWeight: "700", color: T.text }}>الفصل الثاني</div>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell" style={{ minHeight: "100vh", background: T.bg, fontFamily: "'Cairo',sans-serif", direction: "rtl", paddingBottom: "30px" }}>
      <div style={{ background: T.card, backdropFilter: "blur(16px)", borderBottom: `1px solid ${T.cardBorder}`, padding: "16px" }}>
        <button onClick={onBack} style={{ background: T.accent, color: "#fff", border: "none", borderRadius: "12px", padding: "8px 18px", fontSize: "14px", fontWeight: "700", cursor: "pointer", fontFamily: "'Cairo',sans-serif", marginBottom: "8px" }}>← رجوع</button>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "36px" }}>{config.subjectIcons?.[sub] || EMOJI[sub] || "📌"}</span>
          <div>
            <h2 style={{ margin: 0, color: T.text, fontSize: "20px", fontWeight: "800" }}>{sub}</h2>
            <p style={{ margin: 0, fontSize: "12px", color: T.subtext }}>{grade} --- {branch} {isGrade11 ? `- ${selectedSemester}` : ""}</p>
          </div>
        </div>
        {isGrade11 && (
          <div style={{ display: "flex", gap: "8px", marginTop: "12px", flexWrap: "wrap" }}>
            <button onClick={() => handleSemesterChange("فصل أول")} style={{ flex: 1, minWidth: 0, background: selectedSemester === "فصل أول" ? `linear-gradient(135deg,${T.accent},${T.accent2})` : T.inputBg, color: selectedSemester === "فصل أول" ? "#fff" : T.text, border: `1.5px solid ${selectedSemester === "فصل أول" ? T.accent : T.cardBorder}`, borderRadius: "10px", padding: "8px 12px", fontSize: "13px", fontWeight: selectedSemester === "فصل أول" ? "700" : "400", cursor: "pointer", fontFamily: "'Cairo',sans-serif" }}>📖 الفصل الأول</button>
            <button onClick={() => handleSemesterChange("فصل ثان")} style={{ flex: 1, minWidth: 0, background: selectedSemester === "فصل ثان" ? `linear-gradient(135deg,${T.accent},${T.accent2})` : T.inputBg, color: selectedSemester === "فصل ثان" ? "#fff" : T.text, border: `1.5px solid ${selectedSemester === "فصل ثان" ? T.accent : T.cardBorder}`, borderRadius: "10px", padding: "8px 12px", fontSize: "13px", fontWeight: selectedSemester === "فصل ثان" ? "700" : "400", cursor: "pointer", fontFamily: "'Cairo',sans-serif" }}>📖 الفصل الثاني</button>
          </div>
        )}
        <div onClick={() => setShowLessons(prev => !prev)} style={{ marginTop: "14px", background: T.sectionBg, borderRadius: "12px", padding: "12px", cursor: "pointer", border: `1px solid ${T.cardBorder}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}><span style={{ fontSize: "13px", color: T.text, fontWeight: "600" }}>معدّل الإنجاز</span><span style={{ fontSize: "14px", fontWeight: "800", color: config.progressBarColor || T.accent }}>{pct}%</span></div>
          <div style={{ background: darkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)", borderRadius: "6px", height: "8px", overflow: "hidden" }}><div style={{ height: "100%", width: `${pct}%`, background: config.progressBarColor || T.accent, borderRadius: "6px" }} /></div>
          <p style={{ margin: "6px 0 0", fontSize: "11px", color: T.subtext }}>{done}/{total} درس ✓ اضغط لعرض الدروس</p>
          {showLessons && <div onClick={e => e.stopPropagation()} style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "8px" }}>
            {lessons.length === 0 && <p style={{ color: T.subtext, fontSize: "13px", textAlign: "center" }}>لا يوجد دروس</p>}
            {lessons.map(l => <label key={l} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", background: T.inputBg, borderRadius: "12px", padding: "12px 16px", cursor: "pointer", border: `1px solid ${doneLessons.includes(l) ? T.accent : T.cardBorder}`, direction: "ltr", width: "100%", boxSizing: "border-box", overflow: "hidden" }}><input type="checkbox" checked={doneLessons.includes(l)} onChange={(e) => { e.stopPropagation(); toggleLesson(l); }} style={{ accentColor: T.accent, width: "18px", height: "18px", flex: "0 0 auto", marginLeft: 0 }} /><span style={{ fontSize: "14px", color: doneLessons.includes(l) ? "gray" : T.text, textDecoration: doneLessons.includes(l) ? "line-through" : "none", opacity: doneLessons.includes(l) ? 0.65 : 1, textAlign: "right", flex: "1 1 auto" }}>{l}</span></label>)}
          </div>}
        </div>
      </div>
      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "10px", width: "100%" }}>
        {sections.length === 0 ? <div style={{ textAlign: "center", padding: "40px", background: T.card, borderRadius: "16px", border: `1px solid ${T.cardBorder}`, width: "100%" }}><div style={{ fontSize: "48px" }}>📭</div><p style={{ color: T.subtext }}>لا توجد أقسام مضافة لهذه المادة</p><p style={{ color: T.subtext, fontSize: "12px" }}>يمكنك إضافة أقسام من لوحة الإدارة → أقسام المادة</p></div> : sections.map((sec) => {
          const handleOpenFolder = () => { if (onOpenFolder) onOpenFolder({ subject: sub, grade: canonicalGrade, branch: canonicalBranch, semester: semesterKey, section: sec, folderPath: [] }); };
          return <button key={sec} onClick={handleOpenFolder} style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: "16px", padding: "10px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: "54px", gap: "12px", cursor: "pointer", backdropFilter: "blur(10px)", textAlign: "right", width: "100%" }}><span style={{ fontSize: "22px" }}>{SEC_EMOJI?.[sec] || "📌"}</span><span style={{ fontSize: "15px", fontWeight: "600", color: T.text, flex: 1, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{sec}</span><span style={{ color: T.subtext, fontSize: "16px" }}>‹</span></button>;
        })}
      </div>
    </div>
  );
}

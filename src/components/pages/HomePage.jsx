import { useState } from "react";

export default function HomePage({ config, T, darkMode, currentUser, flame, onSubject, getCanonicalSubjectKey, getSubjectsByGradeBranch, EMOJI }) {
  if (!currentUser) {
    return <div style={{ padding: "20px", color: T.text, textAlign: "center" }}>جارٍ إعادة التوجيه...</div>;
  }
  const userBranch = currentUser.branch || currentUser.stream || "";
  const key = getCanonicalSubjectKey(currentUser.grade || "", userBranch);
  const subjects = getSubjectsByGradeBranch(config.subjects, currentUser.grade, userBranch);

  const getProgress = (sub) => {
  const lessonKey = `lessons_${key}_${sub}`;
  let lessons = [];
  try {
    const raw = config[lessonKey];
    if (raw) {
      if (typeof raw === "string") {
        lessons = JSON.parse(raw);
      } else if (Array.isArray(raw)) {
        lessons = raw;
      }
    }
  } catch (e) {
    console.warn(`فشل في تحليل الدروس لـ ${sub}:`, e);
    lessons = [];
  }

  const rawDoneLessons = Array.isArray(currentUser.progress?.[`${key}_${sub}`]) ? currentUser.progress[`${key}_${sub}`] : [];
  const done = lessons.filter((lesson) => rawDoneLessons.includes(lesson)).length;
  const total = lessons.length;
  const pct = total ? Math.min(Math.round((done / total) * 100), 100) : 0;

  return { pct, done, total };
};

  return (
    <div style={{ padding: "20px 16px" }}>
      <style>{`
        @keyframes flameFlicker {
          0%,100%{transform:scaleY(1) scaleX(1);}
          25%{transform:scaleY(1.08) scaleX(0.95);}
          50%{transform:scaleY(0.95) scaleX(1.05);}
          75%{transform:scaleY(1.05) scaleX(0.97);}
        }
        .flame-icon{animation:flameFlicker 0.8s ease-in-out infinite;display:inline-block;transform-origin:bottom center;}
      `}</style>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "800", color: T.text }}>مرحباً، {currentUser.nickname || currentUser.username} 👋</h2>
          <p style={{ margin: "2px 0 0", fontSize: "13px", color: T.subtext }}>{currentUser.grade} — {currentUser.branch}</p>
        </div>
        <div style={{ background: darkMode ? "rgba(255,120,0,0.18)" : "rgba(255,100,0,0.1)", borderRadius: "20px", padding: "10px 16px", textAlign: "center", border: `2px solid ${flame >= 3 ? "rgba(255,120,0,0.5)" : "rgba(200,200,200,0.3)"}`, display: "flex", alignItems: "center", gap: "6px", cursor: "default" }}>
          <span className="flame-icon" style={{ fontSize: "26px", filter: flame >= 3 ? "drop-shadow(0 0 6px #ff6600)" : "none" }}>
            {flame >= 3 ? "🔥" : flame >= 1 ? "🔥" : "✨"}
          </span>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "18px", fontWeight: "900", color: flame >= 3 ? (darkMode ? "#ff9800" : "#e65100") : T.subtext, lineHeight: 1 }}>{flame}</div>
            <div style={{ fontSize: "10px", color: T.subtext, fontWeight: "600" }}>يوم</div>
          </div>
        </div>
      </div>
      <h3 style={{ margin: "0 0 14px", fontSize: "16px", fontWeight: "800", color: T.text }}>📚 موادك الدراسية</h3>
      {subjects.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 20px", background: T.card, borderRadius: "20px", border: `1px solid ${T.cardBorder}` }}>
          <span style={{ fontSize: "40px" }}>📅</span>
          <p style={{ margin: "10px 0 0", color: T.subtext, fontSize: "14px" }}>لم يتم إضافة مواد لصفك بعد.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", width: "100%" }}>
          {subjects.map(sub => {
            const { pct, done, total } = getProgress(sub);
            return (
              <div key={sub} onClick={() => onSubject({ subject: sub, grade: currentUser.grade, branch: currentUser.branch })} style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: "16px", padding: "10px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: "54px", gap: "14px", cursor: "pointer", boxShadow: T.shadow, transition: "transform 0.2s" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0, flex: 1 }}>
                  <div style={{ width: "40px", height: "40px", borderRadius: "12px", background: darkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", flexShrink: 0 }}>
                    {config.subjectIcons?.[sub] || EMOJI[sub] || "📖"}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
                    <span style={{ display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontSize: "15px", fontWeight: "700", color: T.text }}>{sub}</span>
                    <span style={{ fontSize: "11px", color: T.subtext, marginTop: "2px" }}>{done}/{total} درس مكتمل · {pct}%</span>
                  </div>
                </div>
                <span style={{ color: T.subtext, fontSize: "18px", paddingRight: "4px" }}>‹</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

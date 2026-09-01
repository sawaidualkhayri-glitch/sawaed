import { useState } from "react";

export default function OnboardingPage({ config, T, darkMode, currentUser, updateUser, onComplete, appMaxWidth }) {
  const [grade, setGrade] = useState(currentUser?.grade || config.grades?.[0] || "");
  const [branch, setBranch] = useState(currentUser?.branch || currentUser?.stream || config.branches?.[0] || "");
  const [stream, setStream] = useState(currentUser?.stream || currentUser?.branch || "");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const inp = { background: T.inputBg, border: `1.5px solid ${T.cardBorder}`, borderRadius: "14px", padding: "14px 16px", fontSize: "16px", color: T.text, width: "100%", outline: "none", fontFamily: "'Cairo',sans-serif", direction: "rtl", boxSizing: "border-box" };

  const handleSave = async () => {
    const selectedStream = (stream || branch || "").trim();
    const selectedBranch = (branch || selectedStream || "").trim();
    if (!grade || !selectedStream) { setErr("اختر الصف والشعبة."); return; }
    setLoading(true);
    setErr("");
    try {
      await updateUser({
        grade,
        branch: selectedBranch,
        stream: selectedStream,
        profileCompleted: true,
        onboardingCompletedAt: new Date().toISOString(),
      });
      if (onComplete) onComplete();
    } catch (e) {
      setErr("فشل تحديث البيانات. حاول مرة أخرى.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", width: "100%", maxWidth: appMaxWidth, margin: "0 auto", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", direction: "rtl", fontFamily: "'Cairo',sans-serif", boxSizing: "border-box" }}>
      <div style={{ background: T.card, border: `1.5px solid ${T.cardBorder}`, borderRadius: "24px", padding: "32px 24px", width: "100%", maxWidth: "360px", backdropFilter: "blur(16px)" }}>
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <div style={{ fontSize: "48px" }}>📝</div>
          <h2 style={{ color: T.accent, margin: "8px 0 0", fontSize: "22px", fontWeight: "800" }}>أكمل ملفك الشخصي</h2>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: T.subtext }}>لكي نعرض لك المواد الصحيحة والمحتوى المناسب.</p>
        </div>

        {err ? <div style={{ background: `${T.danger}15`, border: `1px solid ${T.danger}44`, borderRadius: "10px", padding: "10px 14px", marginBottom: "12px" }}><p style={{ color: T.danger, fontSize: "13px", margin: 0 }}>{err}</p></div> : null}

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <select value={grade} onChange={e => { setGrade(e.target.value); setErr(""); }} style={inp}>
            <option value="">اختر صفك</option>
            {config.grades?.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <select value={branch} onChange={e => { setBranch(e.target.value); setErr(""); }} style={inp}>
            <option value="">اختر فرعك</option>
            {config.branches?.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          <button onClick={handleSave} disabled={loading || !grade || !(stream || branch)} style={{ background: loading ? "#ccc" : `linear-gradient(135deg,${T.accent},${T.accent2})`, color: "#fff", border: "none", borderRadius: "14px", padding: "14px", fontSize: "16px", fontWeight: "700", cursor: loading ? "not-allowed" : "pointer", fontFamily: "'Cairo',sans-serif" }}>
            {loading ? "⏳ جاري الحفظ..." : "✅ حفظ وابدأ"}
          </button>
        </div>
      </div>
    </div>
  );
}

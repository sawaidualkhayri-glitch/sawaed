export default function FoundationPage({ config, T, onSubject, EMOJI }) {
  return (
    <div className="app-shell-fluid" style={{ fontFamily: "'Cairo',sans-serif", direction: "rtl", padding: "20px 0" }}>
      <h2 style={{ color: T.text, fontSize: "20px", fontWeight: "800", margin: "0 0 24px" }}>🏗️ صفحة التأسيس</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%", maxWidth: "800px", margin: "0 auto", padding: "0 16px", boxSizing: "border-box" }}>
        {config.foundationSubjects?.map(sub => (
          <div key={sub} role="button" tabIndex={0} onClick={() => onSubject({ subject: sub })} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") onSubject({ subject: sub }); }} style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: "16px", padding: "10px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: "54px", width: "100%", boxSizing: "border-box", gap: "14px", cursor: "pointer", boxShadow: T.shadow, transition: "transform 0.2s" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0, flex: 1 }}>
              <div style={{ width: "40px", height: "40px", borderRadius: "12px", background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", flexShrink: 0 }}>
                {EMOJI[sub] || "📖"}
              </div>
              <div style={{ display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
                <span style={{ display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontSize: "15px", fontWeight: "700", color: T.text, textAlign: "right" }}>
                  {sub}
                </span>
              </div>
            </div>
            <span style={{ color: T.subtext, fontSize: "18px", paddingRight: "4px", flexShrink: 0 }}>‹</span>
          </div>
        ))}
      </div>
    </div>
  );
}

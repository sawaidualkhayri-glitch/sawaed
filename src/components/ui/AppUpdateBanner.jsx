import React from "react";

export default function AppUpdateBanner({ visible, onUpdate }) {
  if (!visible) return null;

  return (
    <div style={{ position: "fixed", bottom: "20px", right: "20px", left: "20px", maxWidth: "400px", margin: "0 auto", background: "linear-gradient(135deg,#1e1e2f,#2d2d44)", color: "#fff", padding: "12px 18px", borderRadius: "12px", boxShadow: "0 8px 24px rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", zIndex: 9999, border: "1px solid rgba(255,255,255,0.1)", fontFamily: "'Cairo',sans-serif" }}>
      <span style={{ fontSize: "13px" }}>🚀 يتوفر تحديث جديد للموقع</span>
      <button onClick={onUpdate} style={{ background: "#6c5ce7", color: "#fff", border: "none", borderRadius: "8px", padding: "6px 14px", cursor: "pointer", fontWeight: "bold", fontSize: "12px", whiteSpace: "nowrap" }}>
        تحديث الآن
      </button>
    </div>
  );
}

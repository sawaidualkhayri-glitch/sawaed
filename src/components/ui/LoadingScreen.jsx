import React from "react";

export default function LoadingScreen({ T }) {
  return (
    <div style={{ minHeight: "100vh", width: "100%", margin: "0 auto", background: T.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Cairo',sans-serif", boxSizing: "border-box", padding: "24px" }}>
      <div style={{ fontSize: "48px", marginBottom: "16px", animation: "pulse 1.5s infinite" }}>🌟</div>
      <p style={{ color: T.accent, fontSize: "16px" }}>جاري التحميل...</p>
      <style>{`@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.1)}}`}</style>
    </div>
  );
}

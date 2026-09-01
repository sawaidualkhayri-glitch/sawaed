import React from "react";

export default function SplashPage({ config, T, onNext }) {
  return (
    <div className="app-shell" style={{ minHeight: "100vh", background: T.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", padding: "120px 24px 40px", direction: "rtl", fontFamily: "'Cairo',sans-serif", boxSizing: "border-box" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "60px", marginBottom: "50px" }}>🌟</div>
        <h1 style={{ fontSize: "34px", fontWeight: "900", color: T.accent, margin: "0 0 6px", letterSpacing: "1px" }}>{config.splashTitle}</h1>
        <p style={{ fontSize: "16px", color: T.subtext, margin: 0 }}>{config.splashSubtitle}</p>
      </div>
      <button onClick={onNext} style={{ background: `linear-gradient(135deg,${T.accent},${T.accent2})`, color: "#fff", border: "none", borderRadius: "20px", padding: "18px 70px", fontSize: "18px", fontWeight: "700", cursor: "pointer", boxShadow: T.shadow, fontFamily: "'Cairo',sans-serif" }}>
        ابدأ →
      </button>
      <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: "18px", padding: "18px 20px", maxWidth: "320px", textAlign: "center", backdropFilter: "blur(12px)" }}>
        <p style={{ fontSize: "14px", color: T.text, margin: "0 0 6px", lineHeight: "1.8", fontStyle: "italic" }}>
0"{config.splashQuote}"</p>
        <p style={{ fontSize: "12px", color: T.subtext, margin: 0 }}>--- {config.splashQuoteSource}</p>
      </div>
    </div>
  );
}

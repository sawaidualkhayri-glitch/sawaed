import React from "react";

export default function QuoteBanner({ quote, T, darkMode }) {
  if (!quote) return null;

  return (
    <div style={{ background: darkMode ? "rgba(124,115,245,0.12)" : "rgba(91,82,212,0.07)", borderBottom: `1px solid ${T.cardBorder}`, padding: "9px 16px", textAlign: "center" }}>
      <p style={{ margin: 0, fontSize: "12px", color: T.accent, fontStyle: "italic" }}>✨ {quote.text}</p>
    </div>
  );
}

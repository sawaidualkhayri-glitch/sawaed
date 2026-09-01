import React from "react";

export default function CustomPage({ page, T }) {
  if (!page) return null;

  return (
    <div style={{ padding: "20px 16px", fontFamily: "'Cairo',sans-serif", direction: "rtl" }}>
      <h2 style={{ color: T.text, fontSize: "20px", fontWeight: "800", margin: "0 0 16px" }}>{page.icon} {page.label}</h2>
      {(!page.content || page.content.length === 0) && (
        <div style={{ textAlign: "center", padding: "40px" }}>
          <div style={{ fontSize: "48px" }}>📄</div>
          <p style={{ color: T.subtext }}>لم يُضف محتوى لهذه الصفحة بعد</p>
        </div>
      )}
      {(page.content || []).map((block, index) => (
        <div key={index} style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: "14px", padding: "14px", marginBottom: "10px" }}>
          {block.type === "link" ? (
            <a href={block.url} target="_blank" rel="noreferrer" style={{ color: T.accent, fontWeight: "700", fontSize: "14px", textDecoration: "none" }}>🔗 {block.value}</a>
          ) : (
            <p style={{ margin: 0, color: T.text, fontSize: "14px", lineHeight: "1.8" }}>{block.value}</p>
          )}
        </div>
      ))}
    </div>
  );
}

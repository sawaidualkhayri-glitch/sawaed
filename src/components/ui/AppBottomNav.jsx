import React from "react";

export default function AppBottomNav({ config, activePage, T, APP_MAX_WIDTH, setActivePage }) {
  const navPages = [...(config.navPages || [])];
  if (!navPages.some(page => page.id === "storage")) {
    const settingsIndex = navPages.findIndex(page => page.id === "settings");
    navPages.splice(settingsIndex >= 0 ? settingsIndex + 1 : navPages.length, 0, { id: "storage", label: "التخزين", icon: "📥" });
  }

  return (
    <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, width: "100%", maxWidth: APP_MAX_WIDTH, margin: "0 auto", background: T.navBg, backdropFilter: "blur(20px)", borderTop: `1px solid ${T.cardBorder}`, display: "flex", padding: "6px 0 10px", zIndex: 100 }}>
      {navPages.map(p => (
        <button key={p.id} onClick={() => setActivePage(p.id)} style={{ flex: 1, background: "transparent", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", padding: "4px 0" }}>
          <span style={{ fontSize: "22px", opacity: activePage === p.id ? 1 : 0.5 }}>{p.icon}</span>
          <span style={{ fontSize: "10px", color: activePage === p.id ? T.accent : T.subtext, fontWeight: activePage === p.id ? "700" : "400", fontFamily: "'Cairo',sans-serif" }}>{p.label}</span>
          {activePage === p.id && <div style={{ width: "4px", height: "4px", borderRadius: "50%", background: T.accent }} />}
        </button>
      ))}
    </nav>
  );
}

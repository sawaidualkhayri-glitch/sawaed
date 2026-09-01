export default function NewsDetailPage({ T, news, currentUser, updateUser, onBack }) {
  const toggleStar = async () => {
    const saved = [...(currentUser.savedItems || [])];
    const idx = saved.findIndex(s => s.newsId === news.id);
    if (idx >= 0) saved.splice(idx, 1);
    else saved.push({ title: news.title, newsId: news.id, type: "خبر من الأخبار", category: "مميز بنجمة", addedAt: Date.now() });
    await updateUser({ savedItems: saved });
  };

  const isStarred = (currentUser.savedItems || []).some(s => s.newsId === news.id);

  return (
    <div className="app-shell" style={{ minHeight: "100vh", fontFamily: "'Cairo',sans-serif", direction: "rtl", paddingBottom: "30px" }}>
      <div style={{ background: T.card, backdropFilter: "blur(16px)", borderBottom: `1px solid ${T.cardBorder}`, padding: "16px", display: "flex", alignItems: "center", gap: "12px" }}>
        <button onClick={onBack} style={{ background: T.accent, color: "#fff", border: "none", borderRadius: "12px", padding: "8px 18px", fontSize: "14px", fontWeight: "700", cursor: "pointer", fontFamily: "'Cairo',sans-serif" }}>← رجوع</button>
        <h2 style={{ margin: 0, flex: 1, color: T.text, fontSize: "17px" }}>{news.title}</h2>
        <button onClick={toggleStar} style={{ background: "transparent", border: "none", fontSize: "22px", cursor: "pointer" }}>{isStarred ? "⭐" : "☆"}</button>
      </div>
      <div style={{ padding: "16px" }}>
        <p style={{ fontSize: "12px", color: T.subtext, marginBottom: "16px" }}>المصدر: {news.source} --- {news.date}</p>
        <p style={{ color: T.text, fontSize: "15px", lineHeight: "1.8" }}>{news.content}</p>
        {news.url && <a href={news.url} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: "16px", background: `linear-gradient(135deg,${T.accent},${T.accent2})`, color: "#fff", borderRadius: "12px", padding: "12px 20px", textDecoration: "none" }}>فتح المصدر ←</a>}
      </div>
    </div>
  );
}

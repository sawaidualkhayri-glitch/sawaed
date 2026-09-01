import { useState, useEffect } from "react";

export default function NewsPage({ config, saveConfig, T, currentUser, updateUser, onDetail, getNews }) {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const pinnedByAdmin = config.pinnedNews ? (typeof config.pinnedNews === "string" ? JSON.parse(config.pinnedNews) : config.pinnedNews) : [];

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    getNews().then(data => {
      if (!isMounted) return;
      setNews(data);
      setLoading(false);
    }).catch(err => {
      console.error("Failed to load news:", err);
      if (isMounted) setLoading(false);
    });
    return () => { isMounted = false; };
  }, []);

  const togglePin = async (newsId) => {
    const pins = [...(currentUser.pinnedNews || [])];
    const idx = pins.indexOf(newsId);
    if (idx >= 0) pins.splice(idx, 1); else pins.push(newsId);
    await updateUser({ pinnedNews: pins });
  };

  const adminPinned = news.filter(n => pinnedByAdmin.includes(n.id));
  const userPinned = news.filter(n => (currentUser.pinnedNews || []).includes(n.id) && !pinnedByAdmin.includes(n.id));
  const regular = news.filter(n => !pinnedByAdmin.includes(n.id) && !(currentUser.pinnedNews || []).includes(n.id));

  const Card = ({ n, pinned }) => (
    <div style={{ background: T.card, border: `1px solid ${pinned ? T.accent + "66" : T.cardBorder}`, borderRadius: "16px", padding: "14px", backdropFilter: "blur(10px)", marginBottom: "10px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "10px" }}>
        <div style={{ flex: 1, cursor: "pointer" }} onClick={() => onDetail(n)}>
          {pinned && <span style={{ background: `${T.accent}22`, color: T.accent, fontSize: "11px", padding: "2px 8px", borderRadius: "8px", fontWeight: "700" }}>📌 مثبّت</span>}
          <p style={{ margin: "6px 0 4px", fontWeight: "700", color: T.text, fontSize: "14px" }}>{n.title}</p>
          <p style={{ margin: 0, fontSize: "12px", color: T.subtext }}>{n.source} --- {n.date}</p>
        </div>
        <button onClick={() => togglePin(n.id)} style={{ background: "transparent", border: "none", fontSize: "20px", cursor: "pointer", flexShrink: 0 }}>
          {(currentUser.pinnedNews || []).includes(n.id) ? "📌" : "📍"}
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ padding: "20px 16px", fontFamily: "'Cairo',sans-serif", direction: "rtl" }}>
      <h2 style={{ color: T.text, fontSize: "20px", fontWeight: "800", margin: "0 0 16px" }}>📰 الأخبار والمستجدات</h2>
      {loading ? (
        <div style={{ textAlign: "center", padding: "40px" }}>
          <div style={{ fontSize: "24px" }}>⏳</div>
          <p style={{ color: T.subtext }}>جاري تحميل الأخبار...</p>
        </div>
      ) : news.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px" }}><div style={{ fontSize: "48px" }}>📭</div><p style={{ color: T.subtext }}>لا توجد أخبار بعد</p></div>
      ) : (
        <>
          {adminPinned.map(n => <Card key={n.id} n={n} pinned={true} />)}
          {userPinned.map(n => <Card key={n.id} n={n} pinned={true} />)}
          {regular.map(n => <Card key={n.id} n={n} pinned={false} />)}
        </>
      )}
    </div>
  );
}

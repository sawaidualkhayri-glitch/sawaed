import { useState } from "react";
import AdminSection from "./AdminSection.jsx";

export default function AdminSplash({ config, saveConfig, T, onBack }) {
  const [title, setTitle] = useState(config.splashTitle);
  const [subtitle, setSubtitle] = useState(config.splashSubtitle);
  const [quote, setQuote] = useState(config.splashQuote);
  const [source, setSource] = useState(config.splashQuoteSource);
  const [enabled, setEnabled] = useState(config.splashEnabled);

  const inp = { background: T.inputBg, border: `1.5px solid ${T.cardBorder}`, borderRadius: "12px", padding: "12px", fontSize: "14px", color: T.text, width: "100%", outline: "none", fontFamily: "'Cairo',sans-serif", direction: "rtl", boxSizing: "border-box", marginBottom: "10px" };

  return (
    <AdminSection title="شاشة البداية" icon="🌟" T={T} onBack={onBack} onSave={() => saveConfig({ ...config, splashTitle: title, splashSubtitle: subtitle, splashQuote: quote, splashQuoteSource: source, splashEnabled: enabled })}>
      <label style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px", color: T.text }}>
        <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} style={{ accentColor: T.accent, width: "18px", height: "18px" }} />
        عرض شاشة البداية
      </label>
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="العنوان" style={inp} />
      <input value={subtitle} onChange={e => setSubtitle(e.target.value)} placeholder="العنوان الفرعي" style={inp} />
      <textarea value={quote} onChange={e => setQuote(e.target.value)} placeholder="الاقتباس" style={{ ...inp, height: "80px", resize: "vertical" }} />
      <input value={source} onChange={e => setSource(e.target.value)} placeholder="المصدر" style={inp} />
    </AdminSection>
  );
}

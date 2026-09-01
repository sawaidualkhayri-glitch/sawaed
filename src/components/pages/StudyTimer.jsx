import { useEffect, useRef, useState } from "react";

const TIMER_AUDIO_B64 = "/timer.mp3";

export const timerState = {
  running: false, secondsLeft: 0, totalSeconds: 0, started: false, interval: null, listeners: new Set(),
  notify(s) { this.listeners.forEach(fn => fn(s)); },
  startTimer(total) {
    if (this.interval) clearInterval(this.interval);
    if (!this.started) { this.totalSeconds = total; this.secondsLeft = total; this.started = true; }
    this.running = true; this.notify({ ...this });
    this.interval = setInterval(() => {
      this.secondsLeft = Math.max(0, this.secondsLeft - 1); this.notify({ ...this });
      if (this.secondsLeft <= 0) {
        clearInterval(this.interval); this.running = false; this.notify({ ...this });
        if (Notification.permission === "granted") new Notification("⏰ سواعد الخير", { body: "انتهى وقت الدراسة! 🎉 خذ راحة." });
        try { const audio = new Audio(TIMER_AUDIO_B64); audio.volume = 1; audio.play().catch(() => {}); } catch(e) {}
      }
    }, 1000);
  },
  pauseTimer() { if (this.interval) clearInterval(this.interval); this.running = false; this.notify({ ...this }); },
  resetTimer() { if (this.interval) clearInterval(this.interval); this.running = false; this.started = false; this.secondsLeft = this.totalSeconds; this.notify({ ...this }); },
};

export function useTimerState() {
  const [state, setState] = useState({ ...timerState });
  useEffect(() => { const fn = s => setState({ ...s }); timerState.listeners.add(fn); return () => timerState.listeners.delete(fn); }, []);
  return state;
}

export function TimerMiniWidget({ T, onOpen }) {
  const s = useTimerState();
  if (!s.started) return null;
  const mins = Math.floor(s.secondsLeft / 60); const secs = s.secondsLeft % 60;
  const pct = s.totalSeconds > 0 ? ((s.totalSeconds - s.secondsLeft) / s.totalSeconds) * 100 : 0;
  const isLast3 = s.secondsLeft <= 3 && s.secondsLeft > 0 && s.running;
  return <div onClick={onOpen} style={{ position: "fixed", bottom: "90px", left: "12px", zIndex: 150, background: isLast3 ? "#e55333" : T.accent, borderRadius: "20px", padding: "8px 14px", display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", boxShadow: "0 4px 16px rgba(0,0,0,0.3)", fontFamily: "'Cairo',sans-serif", direction: "rtl", transition: "background 0.3s", animation: isLast3 ? "timerPulse 0.5s infinite" : "none" }}><style>{`@keyframes timerPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}`}</style><span style={{ fontSize: "16px" }}>{s.running ? "⏱️" : "⏸"}</span><span style={{ color: "#fff", fontWeight: "800", fontSize: "15px", fontVariantNumeric: "tabular-nums" }}>{String(mins).padStart(2,"0")}:{String(secs).padStart(2,"0")}</span><svg width="28" height="28" style={{ transform: "rotate(-90deg)" }}><circle cx="14" cy="14" r="11" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="3"/><circle cx="14" cy="14" r="11" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeDasharray={2 * Math.PI * 11} strokeDashoffset={2 * Math.PI * 11 * (1 - pct/100)} style={{ transition: "stroke-dashoffset 0.8s ease" }}/></svg></div>;
}

export default function StudyTimer({ T, onClose }) {
  const PRESETS = [{ label: "25 دقيقة", mins: 25, emoji: "🍅" }, { label: "45 دقيقة", mins: 45, emoji: "📚" }, { label: "60 دقيقة", mins: 60, emoji: "🎯" }, { label: "مخصص", mins: 0, emoji: "⚙️" }];
  const [selected, setSelected] = useState(0); const [customMins, setCustomMins] = useState(30); const s = useTimerState();
  const totalSeconds = selected === 3 ? customMins * 60 : PRESETS[selected].mins * 60; const displayMins = Math.floor(s.secondsLeft / 60); const displaySecs = s.secondsLeft % 60; const pct = s.totalSeconds > 0 ? ((s.totalSeconds - s.secondsLeft) / s.totalSeconds) * 100 : 0; const circumference = 2 * Math.PI * 80; const strokeDashoffset = circumference - (pct / 100) * circumference; const isLast3 = s.secondsLeft <= 3 && s.secondsLeft > 0 && s.running;
  const playRef = useRef(false);
  useEffect(() => { if (isLast3 && !playRef.current) playRef.current = true; else if (!isLast3) playRef.current = false; }, [isLast3]);
  return <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }} onClick={e => e.target === e.currentTarget && onClose()}><div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: "28px", padding: "28px 24px", width: "100%", maxWidth: "340px", backdropFilter: "blur(20px)", fontFamily: "'Cairo',sans-serif", direction: "rtl" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}><h3 style={{ margin: 0, color: T.text, fontSize: "18px", fontWeight: "800" }}>⏱️ تايمر الدراسة</h3><button onClick={onClose} style={{ background: "transparent", border: "none", fontSize: "20px", cursor: "pointer", color: T.subtext }}>✕</button></div>{!s.started && <><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "16px" }}>{PRESETS.map((p, i) => <button key={i} onClick={() => setSelected(i)} style={{ background: selected === i ? `linear-gradient(135deg,${T.accent},${T.accent2})` : T.sectionBg, color: selected === i ? "#fff" : T.text, border: `1.5px solid ${selected === i ? T.accent : T.cardBorder}`, borderRadius: "12px", padding: "10px 8px", fontSize: "13px", cursor: "pointer", fontFamily: "'Cairo',sans-serif", fontWeight: "700" }}>{p.emoji} {p.label}</button>)}</div>{selected === 3 && <input type="number" value={customMins} onChange={e => setCustomMins(Number(e.target.value))} min="1" max="180" style={{ background: T.inputBg, border: `1.5px solid ${T.cardBorder}`, borderRadius: "12px", padding: "10px 14px", fontSize: "16px", color: T.text, width: "100%", boxSizing: "border-box", textAlign: "center" }} />}</>}
  <div style={{ display: "flex", justifyContent: "center", marginBottom: "20px", position: "relative" }}><svg width="190" height="190" style={{ transform: "rotate(-90deg)" }}><circle cx="95" cy="95" r="80" fill="none" stroke="rgba(0,0,0,0.1)" strokeWidth="12"/><circle cx="95" cy="95" r="80" fill="none" stroke={isLast3 ? "#e55333" : T.accent} strokeWidth="12" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}/></svg><div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}><span style={{ fontSize: "40px", fontWeight: "900", color: isLast3 ? "#e55333" : T.text }}>{String(displayMins).padStart(2,"0")}:{String(displaySecs).padStart(2,"0")}</span><span style={{ fontSize: "12px", color: T.subtext }}>{Math.round(pct)}% مكتمل</span></div></div><div style={{ display: "flex", gap: "10px" }}>{!s.running ? <button onClick={() => timerState.startTimer(totalSeconds)} style={{ flex: 2, background: `linear-gradient(135deg,${T.accent},${T.accent2})`, color: "#fff", border: "none", borderRadius: "14px", padding: "14px", fontSize: "16px", fontWeight: "700" }}> {s.started ? "▶ استمرار" : "▶ ابدأ"}</button> : <button onClick={() => timerState.pauseTimer()} style={{ flex: 2 }}>⏸ إيقاف</button>}{s.started && <button onClick={() => timerState.resetTimer()} style={{ flex: 1 }}>↺</button>}</div>{s.secondsLeft === 0 && s.started && !s.running && <div style={{ marginTop: "14px", textAlign: "center" }}><p style={{ margin: 0, color: "#238636", fontWeight: "700" }}>🎉 أحسنت! انتهى الجلسة</p></div>}</div></div>;
}

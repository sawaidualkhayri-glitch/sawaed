import { useEffect, useRef, useState } from "react";

const EXIT_DURATION_MS = 180;

export default function NotificationToast({ toast, onClose }) {
  const [displayedToast, setDisplayedToast] = useState(toast);
  const [visible, setVisible] = useState(Boolean(toast));
  const closeTimerRef = useRef(null);

  useEffect(() => {
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);

    if (toast) {
      closeTimerRef.current = window.setTimeout(() => {
        setDisplayedToast(toast);
        setVisible(true);
        closeTimerRef.current = null;
      }, 0);
      return () => {
        if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
      };
    }

    closeTimerRef.current = window.setTimeout(() => {
      setVisible(false);
      closeTimerRef.current = window.setTimeout(() => {
        setDisplayedToast(null);
        closeTimerRef.current = null;
      }, EXIT_DURATION_MS);
    }, 0);

    return () => {
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    };
  }, [toast]);

  if (!displayedToast) return null;

  const dismiss = () => {
    setVisible(false);
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(() => {
      setDisplayedToast(null);
      closeTimerRef.current = null;
      onClose?.();
    }, EXIT_DURATION_MS);
  };

  return (
    <div dir="rtl" style={{ position: "fixed", left: "50%", bottom: "92px", transform: `translate(-50%, ${visible ? "0" : "8px"})`, opacity: visible ? 1 : 0, transition: `opacity ${EXIT_DURATION_MS}ms ease, transform ${EXIT_DURATION_MS}ms ease`, maxWidth: "420px", width: "calc(100% - 24px)", background: "rgba(15, 18, 30, 0.96)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "14px", padding: "38px 14px 12px", boxShadow: "0 18px 32px rgba(0,0,0,0.28)", zIndex: 99998, color: "#fff" }}>
      <button type="button" onClick={dismiss} aria-label="إغلاق الإشعار" style={{ position: "absolute", top: "8px", right: "10px", width: "28px", height: "28px", display: "grid", placeItems: "center", background: "transparent", border: "none", color: "#dfe3ff", fontSize: "18px", lineHeight: 1, cursor: "pointer" }}>
        ✕
      </button>
      <div style={{ fontWeight: "800", marginBottom: "4px", fontSize: "13px" }}>{displayedToast.title}</div>
      <div style={{ fontSize: "12px", color: "#dfe3ff", lineHeight: 1.5 }}>{displayedToast.body}</div>
    </div>
  );
}

import { useEffect, useState } from "react";

export default function OfflineSyncBanner({ onSync }) {
  const [isOffline, setIsOffline] = useState(() => typeof navigator !== "undefined" && navigator.onLine === false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    let hideTimer;

    const checkRealConnection = async () => {
      if (navigator.onLine === false) {
        setIsOffline(true);
        return false;
      }

      try {
        const response = await fetch(`${window.location.origin}/manifest.json?network_probe=${Date.now()}`, {
          method: "HEAD",
          cache: "no-store",
        });
        const connected = response.ok;
        setIsOffline(!connected);
        return connected;
      } catch {
        setIsOffline(true);
        return false;
      }
    };

    const handleOffline = () => {
      window.clearTimeout(hideTimer);
      setIsOffline(true);
      setIsSyncing(false);
      setIsDismissed(false);
    };

    const handleOnline = async () => {
      const connected = await checkRealConnection();
      if (!connected) return;

      setIsSyncing(true);
      setIsDismissed(false);

      try {
        window.dispatchEvent(new Event("sawaed:sync"));
        const registration = await navigator.serviceWorker?.ready;
        if (registration?.sync) {
          await registration.sync.register("sync-app-data");
        }
        if (typeof onSync === "function") await onSync();
      } catch (error) {
        console.warn("Background data sync registration failed:", error);
      } finally {
        setIsSyncing(false);
        hideTimer = window.setTimeout(() => setIsDismissed(true), 3000);
      }
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    checkRealConnection();
    const probeTimer = window.setInterval(checkRealConnection, 5000);
    return () => {
      window.clearTimeout(hideTimer);
      window.clearInterval(probeTimer);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [onSync]);

  useEffect(() => {
    if (isOffline) setIsDismissed(false);
  }, [isOffline]);

  if (isDismissed || (!isOffline && !isSyncing)) return null;

  const message = isOffline
    ? "⚡ أنت تعمل حالياً بوضع الأوفلاين الكامل - سيتم حفظ وتحديث كافة بياناتك تلقائياً عند عودة الاتصال."
    : "🟢 تم إعادة الاتصال! جاري مزامنة البيانات والإحصائيات...";

  return (
    <div role="status" aria-live="polite" style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100000, background: isOffline ? "rgba(120, 53, 15, 0.88)" : "rgba(6, 78, 59, 0.88)", backdropFilter: "blur(12px)", color: "#fff", padding: "9px 14px", display: "flex", alignItems: "center", gap: "10px", fontFamily: "'Cairo',sans-serif", fontSize: "12px", fontWeight: "700", direction: "rtl", boxSizing: "border-box" }}>
      <span style={{ flex: 1, textAlign: "center", lineHeight: 1.5 }}>{message}</span>
      <button type="button" aria-label="إخفاء التنبيه" onClick={() => setIsDismissed(true)} style={{ background: "transparent", border: "none", color: "#fff", fontSize: "22px", lineHeight: 1, padding: "0 4px", cursor: "pointer", flexShrink: 0 }}>×</button>
    </div>
  );
}

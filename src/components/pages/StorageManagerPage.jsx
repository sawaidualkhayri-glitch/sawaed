import { useCallback, useEffect, useState } from "react";

const DATABASE_NAME = "sawaed_downloads";
const STORE_NAME = "files";

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 MB";
  const megabytes = bytes / (1024 * 1024);
  if (megabytes < 1024) return `${megabytes.toFixed(1)} MB`;
  return `${(megabytes / 1024).toFixed(2)} GB`;
}

function clearLocalPdfFiles() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onsuccess = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.close();
        resolve();
        return;
      }
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).clear();
      transaction.oncomplete = () => {
        database.close();
        resolve();
      };
      transaction.onerror = () => {
        database.close();
        reject(transaction.error);
      };
    };
    request.onerror = () => reject(request.error);
  });
}

export default function StorageManagerPage({ T }) {
  const [usage, setUsage] = useState({ used: 0, quota: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isClearing, setIsClearing] = useState(false);
  const [message, setMessage] = useState("");

  const refreshUsage = useCallback(async () => {
    if (!navigator.storage?.estimate) {
      setIsLoading(false);
      return;
    }
    const estimate = await navigator.storage.estimate();
    setUsage({ used: estimate.usage || 0, quota: estimate.quota || 0 });
    setIsLoading(false);
  }, []);

  useEffect(() => {
    refreshUsage().catch(() => setIsLoading(false));
  }, [refreshUsage]);

  const handleClear = async () => {
    if (!window.confirm("هل تريد حذف ملفات PDF المخزنة محلياً؟")) return;
    setIsClearing(true);
    setMessage("");
    try {
      await clearLocalPdfFiles();
      await refreshUsage();
      setMessage("تم تفريغ مساحة التخزين بنجاح");
    } catch (error) {
      console.error("Failed to clear local PDF storage:", error);
      setMessage("تعذر حذف الملفات المخزنة محلياً");
    } finally {
      setIsClearing(false);
    }
  };

  const percentage = usage.quota > 0 ? Math.min(100, Math.round((usage.used / usage.quota) * 100)) : 0;

  return (
    <div className="app-shell-fluid" style={{ minHeight: "100vh", padding: "20px 16px", background: T.bg, color: T.text, fontFamily: "'Cairo',sans-serif", direction: "rtl", boxSizing: "border-box" }}>
      <h2 style={{ margin: "0 0 8px", color: T.text, fontSize: "20px", fontWeight: "800" }}>📥 إدارة التخزين</h2>
      <p style={{ margin: "0 0 18px", color: T.subtext, fontSize: "13px" }}>تحكم بالملفات المحفوظة محلياً على هذا الجهاز.</p>
      <section style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: "16px", padding: "18px", marginBottom: "14px", backdropFilter: "blur(12px)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "baseline", marginBottom: "12px" }}>
          <strong style={{ color: T.text, fontSize: "15px" }}>استخدام مساحة التطبيق</strong>
          <span style={{ color: T.accent, fontSize: "18px", fontWeight: "800" }}>{isLoading ? "..." : `${percentage}%`}</span>
        </div>
        <div aria-label={`استخدام التخزين ${percentage}%`} role="progressbar" aria-valuenow={percentage} aria-valuemin="0" aria-valuemax="100" style={{ height: "12px", background: T.sectionBg, borderRadius: "999px", overflow: "hidden" }}>
          <div style={{ width: `${percentage}%`, height: "100%", background: `linear-gradient(90deg,${T.accent},${T.accent2})`, borderRadius: "999px", transition: "width 0.4s ease" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "10px", color: T.subtext, fontSize: "12px" }}>
          <span>المستخدم: {formatBytes(usage.used)}</span>
          <span>المتاح الكلي: {formatBytes(usage.quota)}</span>
        </div>
      </section>
      <section style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: "16px", padding: "18px", marginBottom: "14px", backdropFilter: "blur(12px)" }}>
        <h3 style={{ margin: "0 0 8px", color: T.text, fontSize: "15px" }}>ملفات PDF المحلية</h3>
        <p style={{ margin: "0 0 14px", color: T.subtext, fontSize: "12px", lineHeight: 1.6 }}>احذف نسخ PDF المحفوظة للقراءة بدون إنترنت لتوفير مساحة الجهاز.</p>
        <button type="button" onClick={handleClear} disabled={isClearing} style={{ width: "100%", background: isClearing ? "#777" : "#b42318", color: "#fff", border: "none", borderRadius: "10px", padding: "11px 14px", fontSize: "13px", fontWeight: "700", cursor: isClearing ? "not-allowed" : "pointer", fontFamily: "'Cairo',sans-serif" }}>{isClearing ? "جارٍ الحذف..." : "حذف ملفات الـ PDF المخزنة محلياً"}</button>
        {message && <p role="status" style={{ margin: "12px 0 0", color: message.startsWith("تم") ? "#22c55e" : T.danger, fontSize: "12px", textAlign: "center" }}>{message}</p>}
      </section>
    </div>
  );
}

import { useEffect, useState } from "react";
import FileViewer from "./FileViewer.jsx";
import { cloudflareWorkerBaseUrl } from "../../config.js";
import { fetchBinaryBlob } from "../../utils/downloadUtils.js";

function extractDriveId(url) {
  if (!url) return null;
  const fileMatch = String(url).match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch) return fileMatch[1];
  const queryMatch = String(url).match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (queryMatch) return queryMatch[1];
  return /^[a-zA-Z0-9_-]{25,}$/.test(String(url).trim()) ? String(url).trim() : null;
}

function getFileId(item) {
  const driveId = extractDriveId(item?.url);
  return driveId ? `drive_${driveId}` : String(item?.id || item?.url || item?.title || "file").replace(/[^a-zA-Z0-9]/g, "").slice(0, 80);
}

function getWorkerUrl(url) {
  const fileId = extractDriveId(url);
  if (!fileId) return url;
  const workerUrl = new URL(`${cloudflareWorkerBaseUrl}/`);
  workerUrl.searchParams.set("fileId", fileId);
  return workerUrl.toString();
}

function openDB() {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open("sawaed_downloads", 1);
    request.onupgradeneeded = (event) => {
      if (!event.target.result.objectStoreNames.contains("files")) {
        event.target.result.createObjectStore("files", { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveOfflineFile(id, blob, metadata) {
  const db = await openDB();
  await new Promise((resolve, reject) => {
    const request = db.transaction("files", "readwrite").objectStore("files").put({ id, blob, ...metadata, size: blob.size, addedAt: Date.now() });
    request.onsuccess = resolve;
    request.onerror = () => reject(request.error);
  });
}

function downloadBlobToDevice(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function SavedPage({ config, T, currentUser, updateUser, idbGetAllFiles, idbDeleteFile, formatSize }) {
  const [cat, setCat] = useState("مميز بنجمة");
  const [type, setType] = useState(null);
  const [offlineFiles, setOfflineFiles] = useState([]);
  const [viewingFile, setViewingFile] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState({});
  const [savingActions, setSavingActions] = useState({});
  const isOfflineTab = cat === "الملفات بدون انترنت";

  useEffect(() => {
    if (isOfflineTab) {
      idbGetAllFiles().then(files => setOfflineFiles(files.sort((a, b) => b.addedAt - a.addedAt)));
    }
  }, [isOfflineTab, idbGetAllFiles]);

  const refreshOfflineFiles = async () => {
    const files = await idbGetAllFiles();
    setOfflineFiles(files.sort((a, b) => b.addedAt - a.addedAt));
  };

  const toggleStar = async (item) => {
    const saved = (currentUser.savedItems || []).filter(entry => !(entry.url === item.url && entry.title === item.title && entry.newsId === item.newsId));
    await updateUser({ savedItems: saved });
  };

  const saveOffline = async (item) => {
    const fileId = getFileId(item);
    const actionKey = `${fileId}_offline`;
    if (savingActions[actionKey]) return;
    setSavingActions(previous => ({ ...previous, [actionKey]: true }));
    setDownloadProgress(previous => ({ ...previous, [actionKey]: 0 }));
    try {
      const blob = await fetchBinaryBlob(getWorkerUrl(item.url), ["application/pdf", "image/", "application/octet-stream"], percent => {
        setDownloadProgress(previous => ({ ...previous, [actionKey]: percent }));
      });
      await saveOfflineFile(fileId, blob, { title: item.title, url: item.url, type: blob.type || item.type || "application/pdf", category: item.category, sourceItemId: item.id || null });
      await refreshOfflineFiles();
    } catch (error) {
      console.error("Saved item offline download failed:", error);
    } finally {
      setSavingActions(previous => { const next = { ...previous }; delete next[actionKey]; return next; });
      setDownloadProgress(previous => { const next = { ...previous }; delete next[actionKey]; return next; });
    }
  };

  const saveToDevice = async (item) => {
    const fileId = getFileId(item);
    const actionKey = `${fileId}_device`;
    if (savingActions[actionKey]) return;
    setSavingActions(previous => ({ ...previous, [actionKey]: true }));
    setDownloadProgress(previous => ({ ...previous, [actionKey]: 0 }));
    try {
      const blob = await fetchBinaryBlob(getWorkerUrl(item.url), ["application/pdf", "image/", "application/octet-stream"], percent => {
        setDownloadProgress(previous => ({ ...previous, [actionKey]: percent }));
      });
      const filename = `${String(item.title || "sawaed-file").replace(/[^a-zA-Z0-9\u0600-\u06FF.\-_]/g, "_")}.pdf`;
      downloadBlobToDevice(blob, filename);
    } catch (error) {
      console.error("Saved item device download failed:", error);
    } finally {
      setSavingActions(previous => { const next = { ...previous }; delete next[actionKey]; return next; });
      setDownloadProgress(previous => { const next = { ...previous }; delete next[actionKey]; return next; });
    }
  };

  const items = (currentUser.savedItems || []).filter(item => item.category === cat && (!type || item.type === type));

  if (viewingFile) {
    return <FileViewer url={viewingFile.url} title={viewingFile.title} T={T} mimeType={viewingFile.type || "application/pdf"} onClose={() => setViewingFile(null)} />;
  }

  return (
    <div className="app-shell-fluid" style={{ fontFamily: "'Cairo',sans-serif", direction: "rtl", padding: "20px 0" }}>
      <h2 style={{ color: T.text, fontSize: "20px", fontWeight: "800", margin: "0 0 14px" }}>🔖 المحفوظات</h2>
      <div style={{ display: "flex", gap: "8px", marginBottom: "12px", overflowX: "auto" }}>
        <button onClick={() => setCat("مميز بنجمة")} style={{ background: cat === "مميز بنجمة" ? `linear-gradient(135deg,${T.accent},${T.accent2})` : T.card, color: cat === "مميز بنجمة" ? "#fff" : T.text, border: `1px solid ${cat === "مميز بنجمة" ? "transparent" : T.cardBorder}`, borderRadius: "12px", padding: "8px 14px", fontSize: "13px", cursor: "pointer", whiteSpace: "nowrap", fontFamily: "'Cairo',sans-serif" }}>⭐ مميز بنجمة</button>
        <button onClick={() => setCat("الملفات بدون انترنت")} style={{ background: cat === "الملفات بدون انترنت" ? `linear-gradient(135deg,${T.accent},${T.accent2})` : T.card, color: cat === "الملفات بدون انترنت" ? "#fff" : T.text, border: `1px solid ${cat === "الملفات بدون انترنت" ? "transparent" : T.cardBorder}`, borderRadius: "12px", padding: "8px 14px", fontSize: "13px", cursor: "pointer", whiteSpace: "nowrap", fontFamily: "'Cairo',sans-serif" }}>📴 ملفات أوفلاين</button>
      </div>
      {isOfflineTab ? (
        <div>{offlineFiles.length === 0 ? <div style={{ textAlign: "center", padding: "40px" }}><div style={{ fontSize: "48px" }}>📴</div><p style={{ color: T.subtext }}>لا توجد ملفات محفوظة أوفلاين بعد</p></div> : offlineFiles.map(file => <div key={file.id} style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: "16px", padding: "14px", marginBottom: "10px", display: "flex", alignItems: "center", gap: "12px" }}><div style={{ flex: 1 }}><p style={{ margin: "0 0 2px", fontWeight: "700", color: T.text }}>{file.title}</p><p style={{ margin: 0, fontSize: "11px", color: T.subtext }}>{file.category || file.subject || "ملف محفوظ"} | {formatSize(file.size)}</p></div><button onClick={() => setViewingFile({ url: URL.createObjectURL(file.blob), title: file.title, type: file.type })} style={{ background: T.accent, color: "#fff", border: "none", borderRadius: "10px", padding: "7px 14px", cursor: "pointer" }}>فتح</button><button onClick={async () => { await idbDeleteFile(file.id); await refreshOfflineFiles(); }} style={{ background: "#e5533322", border: "1px solid #e55", color: "#e55", borderRadius: "8px", padding: "6px 10px", cursor: "pointer" }}>🗑️</button></div>)}</div>
      ) : (
        <div>
          <div style={{ display: "flex", gap: "6px", marginBottom: "12px", flexWrap: "wrap" }}><button onClick={() => setType(null)} style={{ background: !type ? T.accent : T.sectionBg, color: !type ? "#fff" : T.subtext, border: `1px solid ${T.cardBorder}`, borderRadius: "10px", padding: "6px 12px", fontSize: "12px", cursor: "pointer" }}>الكل</button>{config.savedTypes?.map(savedType => <button key={savedType} onClick={() => setType(savedType)} style={{ background: type === savedType ? T.accent : T.sectionBg, color: type === savedType ? "#fff" : T.subtext, border: `1px solid ${T.cardBorder}`, borderRadius: "10px", padding: "6px 12px", fontSize: "12px", cursor: "pointer", fontFamily: "'Cairo',sans-serif" }}>{savedType}</button>)}</div>
          {items.length === 0 ? <div style={{ textAlign: "center", padding: "40px" }}><div style={{ fontSize: "48px" }}>🗂️</div><p style={{ color: T.subtext }}>لا يوجد محفوظات</p></div> : items.map((item, index) => {
            const fileId = getFileId(item);
            const offlineKey = `${fileId}_offline`;
            const deviceKey = `${fileId}_device`;
            const offlinePercent = downloadProgress[offlineKey];
            const devicePercent = downloadProgress[deviceKey];
            const offlineSaving = typeof offlinePercent === "number";
            const deviceSaving = typeof devicePercent === "number";
            return <div key={`${fileId}-${index}`} style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: "16px", padding: "14px", marginBottom: "10px", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ fontSize: "26px", flexShrink: 0 }}>{item.type?.includes("pdf") || item.title?.toLowerCase().endsWith(".pdf") ? "📄" : "🔗"}</div>
              <div style={{ flex: 1, minWidth: 0 }}><p style={{ margin: "0 0 4px", fontWeight: "700", color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title || item.name || "ملف محفوظ"}</p><p style={{ margin: 0, fontSize: "12px", color: T.subtext }}>{item.category || item.type || "ملف من المواد"}</p></div>
              {item.url && <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "flex-start" }}><button onClick={() => setViewingFile(item)} style={{ background: `linear-gradient(135deg,${T.accent},${T.accent2})`, color: "#fff", border: "none", borderRadius: "10px", padding: "7px 12px", fontSize: "12px", cursor: "pointer", fontFamily: "'Cairo',sans-serif", fontWeight: "600" }}>🌐 أونلاين</button><button onClick={() => saveOffline(item)} disabled={offlineSaving || deviceSaving} style={{ background: T.sectionBg, color: T.accent, border: `1.5px solid ${T.accent}`, borderRadius: "10px", padding: "7px 12px", fontSize: "12px", cursor: offlineSaving || deviceSaving ? "not-allowed" : "pointer", opacity: offlineSaving || deviceSaving ? 0.65 : 1, fontFamily: "'Cairo',sans-serif", fontWeight: "700" }}>{offlineSaving ? `⏳ ${offlinePercent}%` : "⬇️ حفظ للمعاينة أوفلاين"}</button><button onClick={() => saveToDevice(item)} disabled={offlineSaving || deviceSaving} style={{ background: deviceSaving ? "#555" : `linear-gradient(135deg,${T.accent},${T.accent2})`, color: "#fff", border: "none", borderRadius: "10px", padding: "7px 12px", fontSize: "12px", cursor: offlineSaving || deviceSaving ? "not-allowed" : "pointer", opacity: offlineSaving || deviceSaving ? 0.65 : 1, fontFamily: "'Cairo',sans-serif", fontWeight: "700" }}>{deviceSaving ? `⏳ ${devicePercent}%` : "💾 حفظ للجهاز"}</button></div>}
              <button onClick={() => toggleStar(item)} aria-label="إزالة من المفضلة" style={{ background: "transparent", border: "none", fontSize: "20px", cursor: "pointer" }}>⭐</button>
            </div>;
          })}
        </div>
      )}
    </div>
  );
}

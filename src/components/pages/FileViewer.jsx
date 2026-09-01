import React, { useState, useEffect } from "react";
import PDFViewer from "../../PDFViewer.jsx";
import { cloudflareWorkerBaseUrl } from "../../config.js";
import { fetchBinaryBlob } from "../../utils/downloadUtils.js";
import { getLessonNote, saveLessonNote } from "../../utils/bookmarksDB.js";

const CF_WORKER_URL = `${cloudflareWorkerBaseUrl}/`;

function extractDriveId(url) {
  if (!url) return null;
  const m1 = url.match(/\/file\/d\/([a-zA-Z0-9_\-]+)/);
  if (m1) return m1[1];
  const m2 = url.match(/[?&]id=([a-zA-Z0-9_\-]+)/);
  if (m2) return m2[1];
  if (/^[a-zA-Z0-9_\-]{25,}$/.test(url.trim())) return url.trim();
  return null;
}

function getDirectGoogleImageUrl(fileId) {
  if (!fileId) return null;
  return `https://lh3.googleusercontent.com/d/${fileId}`;
}

function getDriveDirectUrl(url) {
  if (!url || typeof url !== "string") return url;
  const id = extractDriveId(url);
  if (id) {
    return `https://drive.google.com/uc?export=download&id=${id}&confirm=t`;
  }
  return url;
}

function driveDownloadUrl(url) {
  const id = extractDriveId(url);
  if (!id) return url;
  return `https://drive.google.com/uc?export=download&id=${id}&confirm=t`;
}

function driveEmbedUrl(url) {
  const id = extractDriveId(url);
  if (!id) return url;
  return `https://drive.google.com/file/d/${id}/preview`;
}

function isDriveUrl(url) {
  return url && (url.includes("drive.google.com") || url.includes("docs.google.com/uc"));
}

function isImageFile(url, mimeType, title) {
  const imageExtensionRegex = /\.(png|jpe?g|webp|gif|svg)(\?|#|$)/i;
  const imageMimeRegex = /^image\//i;
  return (mimeType && imageMimeRegex.test(mimeType)) || (url && imageExtensionRegex.test(url)) || (title && imageExtensionRegex.test(title));
}

function getOnlineViewUrl(inputUrl, mimeType, title) {
  if (!inputUrl) return "";
  if (typeof isDriveUrl === "function" && isDriveUrl(inputUrl)) {
    if (isImageFile(inputUrl, mimeType, title)) {
      const fileId = extractDriveId(inputUrl);
      if (fileId) {
        return getDirectGoogleImageUrl(fileId);
      }
    }
    return driveEmbedUrl(inputUrl);
  }
  return inputUrl;
}

function getDownloadUrl(inputUrl) {
  if (!inputUrl) return "";
  if (typeof isDriveUrl === "function" && isDriveUrl(inputUrl)) return getDriveDirectUrl(inputUrl);
  return inputUrl;
}

function normalizeFetchUrl(inputUrl) {
  if (!inputUrl || typeof inputUrl !== "string") return inputUrl;
  if (inputUrl.startsWith("blob:")) return inputUrl;
  if (inputUrl.includes(cloudflareWorkerBaseUrl) && inputUrl.includes("fileId=")) return inputUrl;
  if (typeof isDriveUrl === "function" && isDriveUrl(inputUrl)) return driveProxyUrl(inputUrl) || inputUrl;
  return inputUrl;
}

function pdfSource(url) {
  if (!url) return url;
  if (isDriveUrl(url)) {
    const proxy = driveProxyUrl(url, cloudflareWorkerBaseUrl);
    return proxy || getDriveDirectUrl(url) || url;
  }
  return getDownloadUrl(url);
}

function driveProxyUrl(urlOrId, workerBase = cloudflareWorkerBaseUrl) {
  const id = extractDriveId(urlOrId) || urlOrId;
  if (!id) return null;
  const proxyBase = String(workerBase || cloudflareWorkerBaseUrl || CF_WORKER_URL || "").replace(/\/+$/, "");
  if (!proxyBase) return null;
  const proxyUrl = new URL(`${proxyBase}/`);
  proxyUrl.searchParams.set("fileId", String(id));
  return proxyUrl.toString();
}

function isPdfMimeType(mime) {
  return typeof mime === "string" && mime.toLowerCase().includes("pdf");
}

function isImageMimeType(mime) {
  return typeof mime === "string" && mime.toLowerCase().startsWith("image/");
}

function getOfflineFileId(inputUrl) {
  if (typeof extractDriveId === "function") {
    const driveId = extractDriveId(inputUrl);
    if (driveId) return `drive_${driveId}`;
  }
  try {
    return btoa(unescape(encodeURIComponent(inputUrl || "")))
      .replace(/[^a-zA-Z0-9]/g, "")
      .slice(0, 80);
  } catch {
    return String(inputUrl || "file").replace(/[^a-zA-Z0-9]/g, "").slice(0, 80);
  }
}

async function openDB() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = window.indexedDB.open("sawaed_downloads", 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("files")) {
        const store = db.createObjectStore("files", { keyPath: "id" });
        store.createIndex("addedAt", "addedAt");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGetFile(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("files", "readonly");
    const store = tx.objectStore("files");
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function idbDeleteFile(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("files", "readwrite");
    const store = tx.objectStore("files");
    const req = store.delete(id);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

function downloadBlobToDevice(blob, filename) {
  if (!blob) throw new Error("No blob available to download");
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function downloadItemToDevice(item, onProgress) {
  if (!item?.url) return;
  const isDriveLink = typeof isDriveUrl === "function" && isDriveUrl(item.url);
  const directDriveUrl = getDriveDirectUrl(item.url);
  const targets = isDriveLink ? [driveProxyUrl(item.url), directDriveUrl, driveDownloadUrl(item.url)] : [getDownloadUrl(item.url)];

  let blob = null;
  for (const targetUrl of targets) {
    if (!targetUrl) continue;
    try {
      blob = await fetchBinaryBlob(targetUrl, ["application/pdf", "image/", "application/octet-stream"], onProgress);
      if (blob && blob.size > 0) break;
    } catch (err) {
      console.warn("downloadItemToDevice candidate failed:", err?.message || err);
    }
  }

  if (!blob) {
    window.open(getDownloadUrl(item.url), "_blank");
    return;
  }

  const rawName = ((item?.title || item?.name || "sawaed-file") + "").trim();
  const sanitizedBase = rawName.replace(/[^a-zA-Z0-9\u0600-\u06FF.\-_]/g, "_");
  const extension = isPdfMimeType(item?.type) ? ".pdf" : (item?.type || "").includes("image") ? ".png" : ".pdf";
  const filename = sanitizedBase.endsWith(extension) ? sanitizedBase : `${sanitizedBase}${extension}`;
  downloadBlobToDevice(blob, filename);
}

function getFileMimeType(resource = {}, blob) {
  if (blob?.type && blob.type.trim()) return blob.type;
  const type = (resource.type || "").toLowerCase();
  const url = (resource.url || "").toLowerCase();
  if (type.includes("image") || /\.(png|jpe?g|webp|gif|svg)(\?|#|$)/.test(url)) {
    if (url.includes(".png")) return "image/png";
    if (url.match(/\.jpe?g/)) return "image/jpeg";
    if (url.includes(".webp")) return "image/webp";
    if (url.includes(".gif")) return "image/gif";
    if (url.includes(".svg")) return "image/svg+xml";
    return "image/png";
  }
  if (type.includes("pdf") || url.includes(".pdf")) return "application/pdf";
  return "application/octet-stream";
}

export default function FileViewer({ url, title, T, fileId: providedFileId, onClose, isBlobDirect = false, mimeType = "application/pdf", onStatusChange }) {
  const [localUrl, setLocalUrl] = useState(isBlobDirect ? url : null);
  const [savedBlob, setSavedBlob] = useState(null);
  const [loading, setLoading] = useState(!isBlobDirect);
  const [error, setError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savePending, setSavePending] = useState(false);
  const [isSavedOffline, setIsSavedOffline] = useState(isBlobDirect);
  const [saveFeedback, setSaveFeedback] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState(null);
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteSaved, setNoteSaved] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [useIframeFallback, setUseIframeFallback] = useState(false);
  const [iframeFileId, setIframeFileId] = useState(null);

  const fileId = providedFileId || getOfflineFileId(url);

  useEffect(() => {
    let cancelled = false;
    getLessonNote(fileId).then((note) => {
      if (!cancelled) setNoteText(note?.noteText || "");
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [fileId]);

  const handleSaveNote = async () => {
    await saveLessonNote(fileId, noteText, []);
    setNoteSaved(true);
    window.setTimeout(() => setNoteSaved(false), 2000);
  };

  const handleSaveToDevice = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (e?.stopPropagation) e.stopPropagation();
    if (savePending) return;

    setSavePending(true);

    try {
      if (savedBlob) {
        const filename = (title || "sawaed-file").replace(/[^a-zA-Z0-9\u0600-\u06FF.\-_]/g, "_");
        downloadBlobToDevice(savedBlob, `${filename}.pdf`);
        return;
      }

      const downloadUrl = getDownloadUrl(url);
      const downloadedBlob = await fetchBinaryBlob(downloadUrl, [mimeType || "application/pdf"], setDownloadProgress);
      const filename = (title || "sawaed-file").replace(/[^a-zA-Z0-9\u0600-\u06FF.\-_]/g, "_");
      downloadBlobToDevice(downloadedBlob, `${filename}.pdf`);
    } catch (err) {
      console.error("Download to device failed:", err);
      const msg = (err?.message || "").toString();
      if (msg.startsWith("HTML_RESPONSE:") || msg.startsWith("NETWORK_ERROR:") || msg.includes("Invalid response type")) {
        const fallbackUrl = getDownloadUrl(url);
        try {
          window.open(fallbackUrl, "_blank");
          setSaveFeedback({ type: "warning", text: "⚠️ يتعذّر تنزيل الملف آلياً، سيفتح الرابط ليتولى المتصفح التحميل." });
          return;
        } catch (oerr) {
          console.error("Fallback open failed", oerr);
        }
      }
      setSaveFeedback({ type: "warning", text: "⚠️ فشل تنزيل الملف. تأكد من الرابط أو الاتصال." });
    } finally {
      setSavePending(false);
      setDownloadProgress(null);
    }
  };

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  useEffect(() => {
    if (isBlobDirect) {
      setLocalUrl(url);
      setIsSavedOffline(true);
      setLoading(false);
      return;
    }

    let cancelled = false;
    let objectUrl = null;

    const init = async () => {
      setLoading(true);
      setError(false);
      try {
        const saved = await idbGetFile(fileId);
        if (saved?.blob && saved.blob.size > 0) {
          const savedType = saved.blob && saved.blob.type ? String(saved.blob.type).toLowerCase() : "";
          if (savedType.includes("text/html") || savedType.includes("application/xhtml+xml") || savedType.includes("application/json")) {
            try { await idbDeleteFile(fileId); } catch (e) { console.warn("Failed to delete invalid cached file", e); }
          } else {
            objectUrl = URL.createObjectURL(saved.blob);
            if (!cancelled) {
              setLocalUrl(objectUrl);
              setSavedBlob(saved.blob);
              setIsSavedOffline(true);
              setLoading(false);
              return;
            }
          }
        }
      } catch (e) {
        console.error("Error reading from IDB:", e);
      }

      if (!cancelled) {
        if (!navigator.onLine) {
          setError(true);
        } else {
          setLocalUrl(null);
        }
        setLoading(false);
      }
    };

    init();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileId, isBlobDirect, url]);

  const handleSaveOffline = async () => {
    if (isSavedOffline) return;
    setSaveFeedback(null);
    setIsSaving(true);

    const isDriveLink = typeof isDriveUrl === "function" && isDriveUrl(url);
    const directDriveUrl = getDriveDirectUrl(url);
    const targets = isDriveLink ? [driveProxyUrl(url, cloudflareWorkerBaseUrl), directDriveUrl, driveDownloadUrl(url)] : [getDownloadUrl(url)];

    let blob = null;

    try {
      for (const targetUrl of targets) {
        if (!targetUrl) continue;
        try {
          blob = await fetchBinaryBlob(targetUrl, [mimeType || "application/pdf"], setDownloadProgress);
          if (blob && blob.size > 0) break;
        } catch (innerErr) {
          console.warn("saveOffline candidate failed:", innerErr.message || innerErr);
        }
      }

      if (!blob) throw new Error("fetch failed");
      let finalBlob = blob;
      try {
        const arr = await blob.arrayBuffer();
        const enforcedType = isPdfMimeType(mimeType) ? "application/pdf" : (blob.type || mimeType || "application/octet-stream");
        finalBlob = new Blob([arr], { type: enforcedType });
      } catch (e) {
        finalBlob = blob;
      }

      const recordId = getOfflineFileId(url);
      await window.indexedDB ? Promise.resolve() : Promise.resolve();

      const db = await openDB();
      await new Promise((resolve, reject) => {
        const tx = db.transaction("files", "readwrite");
        const store = tx.objectStore("files");
        const req = store.put({
          id: recordId,
          blob: finalBlob,
          title: title || "ملف محفوظ محلياً",
          url,
          type: finalBlob.type || mimeType,
          savedAt: Date.now(),
          isFallback: false,
        });
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
      });

      setSavedBlob(finalBlob);
      const objectUrl = URL.createObjectURL(finalBlob);
      setLocalUrl(objectUrl);
      setIsSavedOffline(true);
      setSaveFeedback({ type: "success", text: "✅ تم حفظ الملف بنجاح للوضع الأوفلاين. يمكنك فتحه لاحقاً بدون إنترنت." });
      if (onStatusChange) onStatusChange(fileId, true);
    } catch (err) {
      console.warn("Offline save failed:", err);
      setSaveFeedback({ type: "warning", text: "⚠️ الملف متوفر أونلاين فقط حالياً." });
    } finally {
      setIsSaving(false);
      setDownloadProgress(null);
    }
  };

  const handleDeleteOffline = async () => {
    try {
      await idbDeleteFile(fileId);
      if (localUrl && localUrl.startsWith("blob:")) URL.revokeObjectURL(localUrl);
      setLocalUrl(null);
      setIsSavedOffline(false);
      if (!navigator.onLine) setError(true);
      setSaveFeedback({ type: "success", text: "✅ تم إزالة النسخة المحلية بنجاح." });
      if (onStatusChange) onStatusChange(fileId, false);
    } catch {
      setSaveFeedback({ type: "warning", text: "⚠️ فشل حذف النسخة المحفوظة." });
    }
  };

  const isPdf = isPdfMimeType(mimeType) || (typeof title === "string" && title.toLowerCase().endsWith(".pdf"));
  const isImageContent = !isPdf && isImageFile(url, mimeType, title);
  const viewUrl = localUrl || getOnlineViewUrl(url, mimeType, title);
  const imageSrc = localUrl || viewUrl;

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000", zIndex: 99999, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 14px", background: "#1a1a1a", flexShrink: 0 }}>
        <button onClick={onClose} style={{ background: "#e55353", color: "#fff", border: "none", borderRadius: "8px", padding: "8px 16px", fontSize: "13px", cursor: "pointer", fontFamily: "'Cairo',sans-serif" }}>إغلاق</button>
        <span style={{ color: "#fff", fontSize: "13px", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>

        {isSavedOffline && <span style={{ background: "#238636", color: "#fff", fontSize: "11px", padding: "4px 10px", borderRadius: "8px" }}>محفوظ محلياً ومتاح أوفلاين ✓</span>}
        {!isOnline && <span style={{ background: "#ff9800", color: "#fff", fontSize: "11px", padding: "4px 10px", borderRadius: "8px" }}>وضع الأوفلاين</span>}

        <button onClick={handleSaveToDevice} disabled={savePending} style={{ background: savePending ? "#555" : "#2f59d9", color: "#fff", border: "none", borderRadius: "8px", padding: "7px 14px", fontSize: "12px", fontWeight: "700", cursor: savePending ? "not-allowed" : "pointer", opacity: savePending ? 0.7 : 1 }}>
          {savePending ? `⏳ ${downloadProgress ?? 0}%` : "حفظ للجهاز"}
        </button>
        <button type="button" onClick={() => setIsNotesOpen(true)} style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: "8px", padding: "7px 12px", fontSize: "12px", cursor: "pointer", fontFamily: "'Cairo',sans-serif", whiteSpace: "nowrap" }}>📝 ملاحظاتي</button>

        {isOnline && !loading && !error && isSavedOffline && (
          <button onClick={handleDeleteOffline} style={{ background: "#6e1a1a", color: "#fff", border: "none", borderRadius: "8px", padding: "7px 12px", fontSize: "12px", cursor: "pointer" }}>حذف الأوفلاين</button>
        )}
      </div>

      {saveFeedback?.text && (
        <div style={{ padding: "12px 16px", background: saveFeedback.type === "warning" ? "#3a2015" : "#1a3a1a", color: "#fff", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
          {saveFeedback.text}
        </div>
      )}

      {isNotesOpen && (
        <div role="presentation" onClick={() => setIsNotesOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 100001, background: "rgba(0,0,0,0.58)", backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-start", justifyContent: "flex-start", padding: "78px 18px 18px", boxSizing: "border-box" }}>
          <aside role="dialog" aria-modal="true" aria-labelledby="notes-title" onClick={(event) => event.stopPropagation()} style={{ width: "min(380px, 100%)", background: "rgba(15,23,42,0.98)", border: "1px solid rgba(255,255,255,0.18)", borderRadius: "14px", padding: "16px", boxSizing: "border-box", boxShadow: "0 24px 60px rgba(0,0,0,0.4)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", marginBottom: "10px" }}>
              <h3 id="notes-title" style={{ color: "#fff", margin: 0, fontSize: "16px" }}>📝 ملاحظاتي</h3>
              <button type="button" aria-label="إغلاق الملاحظات" onClick={() => setIsNotesOpen(false)} style={{ background: "transparent", border: "none", color: "#fff", fontSize: "22px", cursor: "pointer", lineHeight: 1 }}>×</button>
            </div>
            <textarea autoFocus value={noteText} onChange={(event) => setNoteText(event.target.value)} placeholder="اكتب ملاحظتك هنا..." style={{ width: "100%", minHeight: "150px", resize: "vertical", boxSizing: "border-box", borderRadius: "8px", border: "1px solid #475569", background: "#0f172a", color: "#fff", padding: "10px", fontFamily: "'Cairo',sans-serif", direction: "rtl" }} />
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "10px" }}>
              <button type="button" onClick={handleSaveNote} style={{ flex: 1, background: "#16a34a", color: "#fff", border: "none", borderRadius: "8px", padding: "9px 12px", cursor: "pointer", fontFamily: "'Cairo',sans-serif" }}>حفظ الملاحظة</button>
              <button type="button" onClick={() => setIsNotesOpen(false)} style={{ background: "#334155", color: "#fff", border: "none", borderRadius: "8px", padding: "9px 12px", cursor: "pointer", fontFamily: "'Cairo',sans-serif" }}>إغلاق</button>
            </div>
            {noteSaved && <div style={{ color: "#86efac", fontSize: "12px", marginTop: "8px", textAlign: "center" }}>تم الحفظ محلياً</div>}
          </aside>
        </div>
      )}

      {loading ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "#111" }}>
          <p style={{ color: "#fff", fontSize: "16px" }}>جاري تحميل الملف...</p>
        </div>
      ) : error ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#111", padding: "20px", textAlign: "center" }}>
          <div style={{ fontSize: "64px", marginBottom: "20px" }}>📴</div>
          <h3 style={{ color: "#fff", fontSize: "20px", margin: "0 0 12px" }}>هذا الملف غير متوفر بدون إنترنت</h3>
          <p style={{ color: "#ccc", fontSize: "14px", maxWidth: "340px", margin: "0 0 26px" }}>يرجى الاتصال بالشبكة لفتح الملف أونلاين أولاً، ثم اضغط على زر "تحميل للوضع أوفلاين" ليتم تخزينه وحفظه بذاكرة التطبيق.</p>
        </div>
      ) : useIframeFallback && iframeFileId ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#111" }}>
          <div style={{ padding: "12px", background: "#1a3a1a", color: "#90ee90", fontSize: "13px", textAlign: "center" }}>
            ℹ️ يتم عرض الملف عبر Google Drive Preview
          </div>
          <iframe
            src={`https://drive.google.com/file/d/${iframeFileId}/preview`}
            style={{ flex: 1, border: "none", width: "100%", height: "100%" }}
            title={title || "PDF Document"}
            allow="autoplay; fullscreen"
            sandbox="allow-same-origin allow-scripts allow-popups allow-popups-to-escape-sandbox"
          />
        </div>
      ) : (
        isPdf ? (
          <div style={{ flex: 1, overflowY: "auto", maxHeight: "calc(100vh - 100px)", background: "#111", padding: "18px" }}>
            <PDFViewer fileUrl={isSavedOffline && localUrl ? localUrl : pdfSource(url)} title={title || "PDF Document"} fileId={fileId} />
          </div>
        ) : isImageContent ? (
          <div style={{ flex: "1 1 0%", display: "flex", alignItems: "center", justifyContent: "center", background: "#000", width: "100%", height: "100%", minHeight: "0px", minWidth: "0px", overflow: "auto", padding: "16px", boxSizing: "border-box" }}>
            <img
              alt={title || "صورة"}
              src={imageSrc}
              referrerPolicy="no-referrer"
              style={{ maxWidth: "100%", maxHeight: "100%", width: "auto", height: "auto", objectFit: "contain", display: "block", borderRadius: "12px" }}
              onError={(e) => {
                const fileId = extractDriveId(url);
                if (fileId && e.target.src === getDirectGoogleImageUrl(fileId)) {
                  e.target.src = `https://drive.google.com/uc?export=view&id=${fileId}`;
                }
              }}
            />
          </div>
        ) : (
          <div style={{ flex: 1, position: "relative", display: "flex", flexDirection: "column", background: "#111", minHeight: 0, minWidth: 0 }}>
            <iframe src={viewUrl} title={title || "file-viewer"} style={{ flex: 1, width: "100%", height: "100%", border: "none", background: "#111" }} sandbox="allow-scripts allow-same-origin allow-popups allow-forms" />
          </div>
        )
      )}
    </div>
  );
}

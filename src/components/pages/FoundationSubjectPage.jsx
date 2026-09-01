import React, { useEffect, useState } from "react";
import { cloudflareWorkerBaseUrl } from "../../config.js";
import FileViewer from "./FileViewer.jsx";
import { fetchBinaryBlob } from "../../utils/downloadUtils.js";

const CF_WORKER_URL = `${cloudflareWorkerBaseUrl}/`;

function normalizeKeyPart(value) {
  return String(value || "").trim().replace(/\s+/g, " ").replace(/_+/g, "_");
}

function canonicalizeBranch(branch) {
  if (!branch || typeof branch !== "string") return branch || "";
  const normalized = branch.trim().replace(/\s+/g, " ");
  return normalized === "ادبي" || normalized === "أدبي" ? "أدبي" : normalized;
}

function normalizeFoundKey({ subject = "", branch = "", type = "", sub = "" } = {}) {
  return `found_${normalizeKeyPart(subject)}_${normalizeKeyPart(canonicalizeBranch(branch || "عام"))}_${normalizeKeyPart(type)}_${normalizeKeyPart(sub)}`;
}

function normalizeItemTree(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => {
    if (!item || typeof item !== "object") return item;
    if (item.type === "folder" || item.isFolder) {
      return {
        ...item,
        id: item.id || `folder_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        children: normalizeItemTree(item.children || item.items || []),
        items: normalizeItemTree(item.children || item.items || []),
      };
    }
    return {
      ...item,
      id: item.id || `file_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    };
  });
}

function getNodeTitle(item) {
  if (!item || typeof item !== "object") return "عنصر";
  return item.title || item.name || "عنصر";
}

function hasFolderChildren(item) {
  if (!item || typeof item !== "object") return false;
  return Boolean(item.type === "folder" || item.isFolder || Array.isArray(item.children) || Array.isArray(item.items));
}

function getFolderChildren(item) {
  if (!item || typeof item !== "object") return [];
  if (Array.isArray(item.children)) return item.children;
  if (Array.isArray(item.items)) return item.items;
  return [];
}

function getOfflineItemId(item) {
  if (!item) return "";
  if (item.id) return item.id;
  return String(item.url || item.title || item.name || item.description || "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 80) || "item";
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

function driveProxyUrl(urlOrId, workerBase = cloudflareWorkerBaseUrl) {
  const id = extractDriveId(urlOrId) || urlOrId;
  if (!id) return null;
  const proxyBase = String(workerBase || cloudflareWorkerBaseUrl || CF_WORKER_URL || "").replace(/\/+$/, "");
  if (!proxyBase) return null;
  const proxy = new URL(`${proxyBase}/`);
  proxy.searchParams.set("fileId", String(id));
  return proxy.toString();
}

function extractDriveId(url) {
  if (!url) return null;
  const m1 = url.match(/\/file\/d\/([a-zA-Z0-9_\-]+)/);
  if (m1) return m1[1];
  const m2 = url.match(/[?&]id=([a-zA-Z0-9_\-]+)/);
  if (m2) return m2[1];
  if (/^[a-zA-Z0-9_\-]{25,}$/.test(url.trim())) return url.trim();
  return null;
}

function getDriveDirectUrl(url) {
  if (!url || typeof url !== "string") return url;
  const id = extractDriveId(url);
  if (id) {
    return `https://drive.google.com/uc?export=download&id=${id}&confirm=t`;
  }
  return url;
}

function getDownloadUrl(url) {
  if (!url) return "";
  return typeof url === "string" && url.includes("drive.google.com") ? getDriveDirectUrl(url) : url;
}

async function downloadItemToDevice(item, onProgress) {
  if (!item?.url) return;
  const isDriveLink = item.url.includes("drive.google.com");
  const targets = isDriveLink
    ? [driveProxyUrl(item.url), getDriveDirectUrl(item.url)]
    : [getDownloadUrl(item.url)];
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

  const filename = `${String(item.title || item.name || "sawaed-file").trim().replace(/[^a-zA-Z0-9\u0600-\u06FF.\-_]/g, "_") || "sawaed-file"}.pdf`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function idbSaveFile(id, blob, meta) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("files", "readwrite");
    const store = tx.objectStore("files");
    const req = store.put({ id, blob, ...meta, addedAt: Date.now(), size: blob.size });
    req.onsuccess = () => resolve(true);
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

async function idbGetAllFiles() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("files", "readonly");
    const store = tx.objectStore("files");
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

function openDB() {
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

export default function FoundationSubjectPage({ config, saveConfig, T, darkMode, data, onBack }) {
  const { subject } = data;
  const branches = config.foundationBranches?.[subject] || [];
  const [selBranch, setSelBranch] = useState(branches.length ? null : "عام");
  const [selType, setSelType] = useState(null);
  const [selSub, setSelSub] = useState(null);
  const [viewerData, setViewerData] = useState(null);
  const [savedIds, setSavedIds] = useState(new Set());
  const [dlProgress, setDlProgress] = useState({});
  const [downloadingIds, setDownloadingIds] = useState({});
  const [savingOfflineIds, setSavingOfflineIds] = useState({});
  const [expandedFolderIds, setExpandedFolderIds] = useState(new Set());
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" ? window.innerWidth < 640 : false);

  useEffect(() => {
    idbGetAllFiles().then(files => setSavedIds(new Set(files.map(f => f.id))));
  }, []);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const getFolderChildren = (item) => {
    if (!item || typeof item !== "object") return [];
    if (Array.isArray(item.items)) return item.items;
    if (Array.isArray(item.children)) return item.children;
    return [];
  };

  const isFolderItem = (item) => !!item && typeof item === "object" && (item.type === "folder" || item.isFolder || Array.isArray(item.items) || Array.isArray(item.children));

  const toggleFolder = (folderId) => {
    setExpandedFolderIds(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  const renderTreeItems = (list, depth = 0) => {
    if (!Array.isArray(list)) return null;
    return list.map((item, index) => {
      if (!item || typeof item !== "object") return null;

      if (isFolderItem(item)) {
        const folderId = item.id || `${subject}-${depth}-${index}`;
        const children = getFolderChildren(item);
        const isExpanded = expandedFolderIds.has(folderId);

        return (
          <div key={folderId} style={{ marginTop: "8px", width: "100%", boxSizing: "border-box", paddingLeft: "16px", paddingRight: `${16 + depth * 16}px` }}>
            <div
              onClick={() => toggleFolder(folderId)}
              style={{
                background: T.card,
                border: `1px solid ${T.cardBorder}`,
                borderRadius: "16px",
                padding: isMobile ? "12px" : "12px 14px",
                display: "flex",
                alignItems: isMobile ? "stretch" : "center",
                justifyContent: "space-between",
                gap: "10px",
                cursor: "pointer",
                direction: "rtl",
                flexDirection: isMobile ? "column" : "row",
                width: "100%",
                boxSizing: "border-box"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0, flex: 1, width: isMobile ? "100%" : "auto", justifyContent: isMobile ? "center" : "flex-start" }}>
                <span style={{ fontSize: "22px", flexShrink: 0 }}>{isExpanded ? "📂" : "📁"}</span>
                <span style={{ fontSize: "16px", color: T.accent, fontWeight: "700", flexShrink: 0 }}>{isExpanded ? "▼" : "▶"}</span>
                <div style={{ minWidth: 0, flex: 1, overflow: "hidden" }}>
                  <p style={{ margin: 0, color: T.text, fontWeight: "700", fontSize: isMobile ? "13px" : "14px", textAlign: isMobile ? "center" : "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.title || item.name || "مجلد"}
                  </p>
                </div>
              </div>
            </div>

            {isExpanded && (
              <div style={{ marginTop: "8px", width: "100%", boxSizing: "border-box", paddingLeft: "16px", paddingRight: "16px" }}>
                {children.length > 0 ? renderTreeItems(children, depth + 1) : (
                  <div style={{ background: T.sectionBg, borderRadius: "12px", padding: "12px", color: T.subtext, fontSize: "12px", textAlign: "center" }}>
                    المجلد فارغ
                  </div>
                )}
              </div>
            )}
          </div>
        );
      }

      const fileId = getOfflineItemId(item);
      const isOfflineSaved = savedIds.has(fileId);
      const offlineKey = `${fileId}_offline`;
      const deviceKey = `${fileId}_device`;
      const offlineProgress = dlProgress[offlineKey];
      const deviceProgress = dlProgress[deviceKey];
      const isOfflineDownloading = typeof offlineProgress === "number";
      const isDeviceDownloading = typeof deviceProgress === "number";

      return (
        <div key={item.id || `${subject}-file-${index}`} style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: "16px", padding: isMobile ? "12px" : "10px 16px", backdropFilter: "blur(10px)", display: "flex", alignItems: isMobile ? "stretch" : "center", justifyContent: "space-between", minHeight: "54px", gap: isMobile ? "10px" : "12px", marginTop: "8px", width: "100%", boxSizing: "border-box", flexDirection: isMobile ? "column" : "row" }}>
          <div style={{ minWidth: 0, overflow: "hidden", flex: isMobile ? "unset" : 1, width: isMobile ? "100%" : "auto" }}>
            <div style={{ minWidth: 0, overflow: "hidden", flex: 1 }}>
            {item.teacher && <p style={{ margin: "0 0 4px", fontSize: "12px", color: T.accent, fontWeight: "700", textAlign: isMobile ? "center" : "right" }}>المدرس: {item.teacher}</p>}
            <p style={{ margin: "0 0 2px", fontWeight: "700", color: T.text, fontSize: isMobile ? "13px" : "14px", whiteSpace: isMobile ? "normal" : "nowrap", overflow: "hidden", textOverflow: isMobile ? "clip" : "ellipsis", wordBreak: isMobile ? "break-word" : "normal", textAlign: isMobile ? "center" : "right" }}>{item.title}</p>
            {item.description && <p style={{ margin: 0, fontSize: "12px", color: T.subtext, whiteSpace: isMobile ? "normal" : "nowrap", overflow: "hidden", textOverflow: isMobile ? "clip" : "ellipsis", wordBreak: isMobile ? "break-word" : "normal", textAlign: isMobile ? "center" : "right" }}>{item.description}</p>}
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center", justifyContent: isMobile ? "center" : "flex-start", paddingLeft: isMobile ? 0 : "12px", flexShrink: 0, width: isMobile ? "100%" : "auto" }}>
            {item.url && (
              <>
                <button onClick={() => handleFoundationOpen(item)} style={{ background: `linear-gradient(135deg,${T.accent},${T.accent2})`, color: "#fff", border: "none", borderRadius: "10px", padding: "8px 14px", fontSize: "13px", cursor: "pointer", fontFamily: "'Cairo',sans-serif", fontWeight: "600", flexShrink: 0 }}>
                  🌐 أونلاين
                </button>
                <button onClick={() => isOfflineSaved ? handleFoundationOpenOffline(item) : handleFoundationSave(item)} disabled={isOfflineDownloading || isDeviceDownloading || Boolean(savingOfflineIds[offlineKey])} style={{ background: isOfflineSaved ? "#23863615" : T.sectionBg, color: isOfflineSaved ? "#238636" : T.accent, border: `1.5px solid ${isOfflineSaved ? "#238636" : T.accent}`, borderRadius: "10px", padding: "8px 14px", fontSize: "13px", cursor: (isOfflineDownloading || isDeviceDownloading || savingOfflineIds[offlineKey]) ? "not-allowed" : "pointer", opacity: (isOfflineDownloading || isDeviceDownloading || savingOfflineIds[offlineKey]) ? 0.65 : 1, fontFamily: "'Cairo',sans-serif", fontWeight: "700", flexShrink: 0 }}>
                  {isOfflineDownloading ? `⏳ ${offlineProgress}%` : (savingOfflineIds[offlineKey] ? "⏳ جاري الحفظ..." : (isOfflineSaved ? "📂 بدون نت" : "⬇️ حفظ للمعاينة أوفلاين"))}
                </button>
                {isOfflineSaved && (
                  <button onClick={async () => { await idbDeleteFile(fileId); setSavedIds(s => { const n = new Set(s); n.delete(fileId); return n; }); }} style={{ background: "rgba(239,68,68,0.08)", color: "#dc2626", border: "1px solid #ef4444", borderRadius: "10px", padding: "8px 10px", fontSize: "13px", cursor: "pointer", fontFamily: "'Cairo',sans-serif", fontWeight: "700", flexShrink: 0 }}>
                    🗑️
                  </button>
                )}
                <button onClick={() => handleFoundationSaveToDevice(item)} disabled={isDeviceDownloading || isOfflineDownloading || Boolean(downloadingIds[deviceKey]) || Boolean(savingOfflineIds[offlineKey])} style={{ background: isDeviceDownloading || isOfflineDownloading || savingOfflineIds[offlineKey] ? "#555" : `linear-gradient(135deg,${T.accent},${T.accent2})`, color: "#fff", border: "none", borderRadius: "10px", padding: "8px 14px", fontSize: "13px", cursor: isDeviceDownloading || isOfflineDownloading || savingOfflineIds[offlineKey] ? "not-allowed" : "pointer", opacity: isDeviceDownloading || isOfflineDownloading || savingOfflineIds[offlineKey] ? 0.65 : 1, fontFamily: "'Cairo',sans-serif", fontWeight: "700", whiteSpace: "nowrap", flexShrink: 0 }}>
                  {isDeviceDownloading ? `⏳ ${deviceProgress}%` : (downloadingIds[deviceKey] ? "⏳ جاري التحميل..." : (savingOfflineIds[offlineKey] ? "⏳ جاري الحفظ..." : "💾 حفظ للجهاز"))}
                </button>
              </>
            )}
            {offlineProgress === "offline_missing" && <span style={{ fontSize: "12px", color: "#dc2626", fontWeight: "600" }}>⚠️ الملف غير محفوظ أوفلاين</span>}
            {offlineProgress === "error" && <span style={{ fontSize: "12px", color: "#dc2626", fontWeight: "600" }}>❌ خطأ في الحفظ</span>}
          </div>
        </div>
      );
    });
  };

  const foundKey = selSub ? normalizeFoundKey({ subject, branch: selBranch || "عام", type: selType, sub: selSub }) : null;
  const raw = foundKey ? config[foundKey] : null;

  const items = (() => {
    if (!raw) return [];
    try { return typeof raw === "string" ? JSON.parse(raw) : (Array.isArray(raw) ? raw : []); }
    catch { return []; }
  })();

  const handleFoundationSave = async (item) => {
    const fileId = getOfflineItemId(item);
    const actionKey = `${fileId}_offline`;
    setSavingOfflineIds(p => ({ ...p, [actionKey]: true }));
    setDlProgress(p => ({ ...p, [actionKey]: 0 }));
    try {
      const proxyUrl = driveProxyUrl(item.url, cloudflareWorkerBaseUrl);
      const directUrl = getDriveDirectUrl(item.url);
      const blob = await fetchBinaryBlob(proxyUrl || directUrl || item.url, ["application/pdf", "image/", "application/octet-stream"], (percent) => {
        setDlProgress(p => ({ ...p, [actionKey]: percent }));
      });
      if (!blob || blob.size < 500) throw new Error("empty blob");
      const effectiveMimeType = blob.type || item.type || getFileMimeType(item, blob);
      await idbSaveFile(fileId, blob, {
        title: item.title,
        description: item.description || "",
        url: item.url,
        type: effectiveMimeType,
        sourceItemId: item.id || null,
        sourceUrl: item.url,
        isFallback: false,
      });
      setSavedIds(s => new Set([...s, fileId]));
      setDlProgress(p => { const n = { ...p }; delete n[actionKey]; return n; });
    } catch (err) {
      console.warn("Foundation save failed:", err);
      setDlProgress(p => ({ ...p, [actionKey]: "error" }));
      setTimeout(() => setDlProgress(p => { const n = { ...p }; delete n[actionKey]; return n; }), 5000);
    } finally {
      setSavingOfflineIds(p => {
        const next = { ...p };
        delete next[actionKey];
        return next;
      });
    }
  };

  const handleFoundationSaveToDevice = async (item) => {
    const fileId = getOfflineItemId(item);
    const actionKey = `${fileId}_device`;
    if (!fileId || downloadingIds[actionKey]) return;
    setDownloadingIds(previous => ({ ...previous, [actionKey]: true }));
    try {
      await downloadItemToDevice(item, (percent) => setDlProgress(p => ({ ...p, [actionKey]: percent })));
    } catch (err) {
      console.error("Error downloading foundation file to device:", err);
    } finally {
      setDownloadingIds(previous => {
        const next = { ...previous };
        delete next[actionKey];
        return next;
      });
      setDlProgress(previous => {
        const next = { ...previous };
        delete next[actionKey];
        return next;
      });
    }
  };

  const handleFoundationOpen = async (item) => {
    const fileId = getOfflineItemId(item);

    try {
      const savedRecord = await idbGetFile(fileId);
      if (savedRecord?.blob && savedRecord.blob.size > 0) {
        const blobUrl = URL.createObjectURL(savedRecord.blob);
        setViewerData({
          url: blobUrl,
          title: item.title,
          mimeType: savedRecord.blob.type || savedRecord.type || getFileMimeType(item, savedRecord.blob),
          id: item.id,
          isBlob: true
        });
        return;
      }
    } catch (err) {
      console.warn("Failed to check offline fallback for foundation online button:", err);
    }

    setViewerData({
      url: item.url,
      title: item.title,
      mimeType: getFileMimeType(item),
      id: item.id
    });
  };

  const handleFoundationOpenOffline = async (item) => {
    const fileId = getOfflineItemId(item);
    const saved = await idbGetFile(fileId);
    if (saved?.blob && saved.blob.size > 0) {
      const blobUrl = URL.createObjectURL(saved.blob);
      const effectiveMimeType = saved.blob.type || saved.type || getFileMimeType(item, saved.blob) || "application/pdf";
      setViewerData({ url: blobUrl, title: item.title, isBlob: true, mimeType: effectiveMimeType });
      return;
    }
    const actionKey = `${fileId}_offline`;
    setDlProgress(p => ({ ...p, [actionKey]: "offline_missing" }));
    setTimeout(() => setDlProgress(p => { const n = { ...p }; delete n[actionKey]; return n; }), 5000);
  };

  if (viewerData) return <FileViewer url={viewerData.url} title={viewerData.title} T={T} fileId={viewerData.id || getOfflineItemId(viewerData.url)} isBlobDirect={viewerData.isBlob} mimeType={viewerData.mimeType || "application/pdf"} onClose={() => { if (viewerData.isBlob) URL.revokeObjectURL(viewerData.url); setViewerData(null); }} onStatusChange={(fileId, isDownloaded) => { if (isDownloaded) setSavedIds(s => new Set([...s, fileId])); else setSavedIds(s => { const n = new Set(s); n.delete(fileId); return n; }); }} />;

  return (
    <div className="app-shell" style={{ minHeight: "100vh", background: T.bg, fontFamily: "'Cairo',sans-serif", direction: "rtl", paddingBottom: "30px" }}>
      <div style={{ background: T.card, backdropFilter: "blur(16px)", borderBottom: `1px solid ${T.cardBorder}`, padding: "16px" }}>
        <button onClick={onBack} style={{ background: T.accent, color: "#fff", border: "none", borderRadius: "12px", padding: "8px 18px", fontSize: "14px", fontWeight: "700", cursor: "pointer", fontFamily: "'Cairo',sans-serif" }}>← رجوع</button>
        <h2 style={{ margin: "8px 0 0", color: T.text, fontSize: "20px" }}>{"🏗️"} {subject}</h2>
      </div>
      <div style={{ padding: "16px" }}>
        {config.foundationBranches?.[subject]?.length > 0 && !selBranch && (
          <div>
            <p style={{ color: T.text, fontWeight: "700", marginBottom: "12px" }}>اختر الفرع:</p>
            <div style={{ display: "flex", gap: "10px" }}>
              {config.foundationBranches[subject].map(b => <button key={b} onClick={() => setSelBranch(b)} style={{ flex: 1, background: T.card, border: `1.5px solid ${T.accent}`, borderRadius: "14px", padding: "14px", fontSize: "15px", fontWeight: "700", color: T.accent, cursor: "pointer", fontFamily: "'Cairo',sans-serif" }}>{b}</button>)}
            </div>
          </div>
        )}
        {(selBranch || !config.foundationBranches?.[subject]?.length) && !selType && (
          <div>
            <p style={{ color: T.text, fontWeight: "700", marginBottom: "12px" }}>نوع التأسيس:</p>
            {[ ["electronic", "💻 إلكتروني"], ["inPerson", "🏫 وجاهي"] ].map(([k, l]) => (
              <button key={k} onClick={() => setSelType(k)} style={{ display: "block", width: "100%", background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: "16px", padding: "16px", fontSize: "15px", fontWeight: "700", color: T.text, cursor: "pointer", fontFamily: "'Cairo',sans-serif", marginBottom: "10px", textAlign: "right", backdropFilter: "blur(10px)" }}>{l}</button>
            ))}
          </div>
        )}
        {selType && !selSub && (
          <div>
            <button onClick={() => setSelType(null)} style={{ background: "transparent", border: "none", color: T.accent, cursor: "pointer", fontSize: "14px", fontFamily: "'Cairo',sans-serif", marginBottom: "12px" }}>← رجوع</button>
            <p style={{ color: T.text, fontWeight: "700", marginBottom: "12px" }}>{selType === "electronic" ? "اختر النوع:" : "اختر المنطقة:"}</p>
            {(config.foundationTypes?.[selType] || []).map(s => (
              <button key={s} onClick={() => setSelSub(s)} style={{ display: "block", width: "100%", background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: "14px", padding: "14px 16px", fontSize: "14px", color: T.text, cursor: "pointer", fontFamily: "'Cairo',sans-serif", textAlign: "right", backdropFilter: "blur(10px)", marginBottom: "8px" }}>{s}</button>
            ))}
          </div>
        )}
        {selSub && (
          <div className="subpage-grid" style={{ padding: "0 16px", width: "100%", boxSizing: "border-box" }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <button onClick={() => setSelSub(null)} style={{ background: "transparent", border: "none", color: T.accent, cursor: "pointer", fontSize: "14px", fontFamily: "'Cairo',sans-serif", marginBottom: "12px" }}>← رجوع</button>
              <h3 style={{ color: T.text, marginBottom: "12px" }}>{selSub}</h3>
            </div>
            {(() => {
              const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];
              return safeItems.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px" }}>
                  <div style={{ fontSize: "48px" }}>📭</div>
                  <p style={{ color: T.subtext }}>لا يوجد محتوى بعد</p>
                </div>
              ) : (
                renderTreeItems(safeItems)
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}

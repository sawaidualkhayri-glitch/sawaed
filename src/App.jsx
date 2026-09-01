import React, { useState, useEffect, useRef, useCallback } from "react";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updatePassword, signOut } from "firebase/auth";
import { addDoc, collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { onMessage } from "firebase/messaging";
import confetti from "canvas-confetti";
import PDFViewer from "./PDFViewer.jsx";
import { useAuth, normalizeUserRole, isAnyEditor, canManageEditors, canManageMalazem, canManageTaasees, canManageNews } from "./AuthContext.jsx";
import { loginWithEmail, signUpWithEmail, loginWithGoogle, loginWithUsername, loginWithIdentifier, ensureEditorAccountsSeeded } from "./firebaseAuth";
import { db, getEditorProvisioningAuth, firebaseConfig, auth, messaging, requestFCMToken } from "./firebase";
import { cloudflareWorkerBaseUrl } from "./config";
import Modal from "./components/ui/Modal.jsx";
import LoadingScreen from "./components/ui/LoadingScreen.jsx";
import SplashPage from "./components/ui/SplashPage.jsx";
import AddFolderModal from "./components/modals/AddFolderModal.jsx";
import AddFileModal from "./components/modals/AddFileModal.jsx";
import DriveImportModal from "./components/modals/DriveImportModal.jsx";
import AdminNews from "./components/admin/AdminNews.jsx";
import AdminAnnouncements from "./components/admin/AdminAnnouncements.jsx";
import AdminQuotes from "./components/admin/AdminQuotes.jsx";
import AdminContact from "./components/admin/AdminContact.jsx";
import AdminEditors from "./components/admin/AdminEditors.jsx";
import AdminSplash from "./components/admin/AdminSplash.jsx";
import AdminPassword from "./components/admin/AdminPassword.jsx";
import AdminGrades from "./components/admin/AdminGrades.jsx";
import AdminSubjects from "./components/admin/AdminSubjects.jsx";
import AdminNav from "./components/admin/AdminNav.jsx";
import AdminPanel from "./components/admin/AdminPanel.jsx";
import AdminLessons from "./components/admin/AdminLessons.jsx";
import AdminFoundation from "./components/admin/AdminFoundation.jsx";
import AdminSection from "./components/admin/AdminSection.jsx";
import FolderPage from "./components/pages/FolderPage.jsx";
import FoundationSubjectPage from "./components/pages/FoundationSubjectPage.jsx";
import CustomPage from "./components/pages/CustomPage.jsx";
import FileViewer from "./components/pages/FileViewer.jsx";
import RegisterPage from "./components/pages/RegisterPage.jsx";
import OnboardingPage from "./components/pages/OnboardingPage.jsx";
import HomePage from "./components/pages/HomePage.jsx";
import ExtractedSubjectPage from "./components/pages/SubjectPage.jsx";
import ExtractedFoundationPage from "./components/pages/FoundationPage.jsx";
import ExtractedNewsPage from "./components/pages/NewsPage.jsx";
import NewsDetailPage from "./components/pages/NewsDetailPage.jsx";
import SavedPage from "./components/pages/SavedPage.jsx";
import StudyTimer, { TimerMiniWidget } from "./components/pages/StudyTimer.jsx";
import SettingsPage from "./components/pages/SettingsPage.jsx";
import ErrorBoundary from "./components/ui/ErrorBoundary.jsx";
import AdminSections from "./components/admin/AdminSections.jsx";
import AdminFolders from "./components/admin/AdminFolders.jsx";
import AppRedirectNotice from "./components/ui/AppRedirectNotice.jsx";
import AppNotificationSystem from "./components/ui/AppNotificationSystem.jsx";
import AppPageTopBar from "./components/ui/AppPageTopBar.jsx";
import AppMainContent from "./components/ui/AppMainContent.jsx";
import AppBottomNav from "./components/ui/AppBottomNav.jsx";
import { DEFAULT_CONFIG, LIGHT, DARK, EMOJI, ls, lsSet, pushNav, popNav, resetNav, sendLocalNotification, calcFlame, initFlame } from "./utils/appShellHelpers.js";

// ============================================================
// IN-APP DOWNLOAD SYSTEM
// ============================================================

const IDB_NAME = "sawaed_downloads";
const IDB_VERSION = 1;
const IDB_STORE = "files";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        const store = db.createObjectStore(IDB_STORE, { keyPath: "id" });
        store.createIndex("addedAt", "addedAt");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSaveFile(id, blob, meta) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    const store = tx.objectStore(IDB_STORE);
    const record = { id, blob, ...meta, addedAt: Date.now(), size: blob.size };
    const req = store.put(record);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

async function idbGetFile(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const store = tx.objectStore(IDB_STORE);
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function idbGetAllFiles() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const store = tx.objectStore(IDB_STORE);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function idbDeleteFile(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    const store = tx.objectStore(IDB_STORE);
    const req = store.delete(id);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

// ============================================================
// GOOGLE DRIVE HELPERS
// ============================================================

function extractDriveId(url) {
  if (!url) return null;
  const m1 = url.match(/\/file\/d\/([a-zA-Z0-9_\-]+)/);
  if (m1) return m1[1];
  const m2 = url.match(/[?&]id=([a-zA-Z0-9_\-]+)/);
  if (m2) return m2[1];
  if (/^[a-zA-Z0-9_\-]{25,}$/.test(url.trim())) return url.trim();
  return null;
}

function normalizeDriveFolderInput(input = "") {
  const value = String(input || "").trim();
  if (!value) return null;

  if (/^[A-Za-z0-9_-]{10,}$/.test(value)) {
    return value;
  }

  const directFolderMatch = value.match(/(?:drive\.google\.com\/)(?:drive(?:\/u\/\d+)?\/)?folders\/([A-Za-z0-9_-]{10,})/i);
  if (directFolderMatch?.[1]) return directFolderMatch[1];

  const openFolderMatch = value.match(/[?&]id=([A-Za-z0-9_-]{10,})/i);
  if (openFolderMatch?.[1]) return openFolderMatch[1];

  const fileFolderMatch = value.match(/\/file\/d\/([A-Za-z0-9_-]{10,})/i);
  if (fileFolderMatch?.[1]) return fileFolderMatch[1];

  return null;
}

function extractDriveFolderId(inputUrl) {
  return normalizeDriveFolderInput(inputUrl);
}

function validateRequiredFields(values, requiredKeys = []) {
  const missing = requiredKeys.filter((key) => {
    const value = values?.[key];
    if (typeof value === "string") return !value.trim();
    return value === undefined || value === null || value === "";
  });

  return {
    isValid: missing.length === 0,
    missing,
  };
}

// رابط Cloudflare Worker للـ proxy — يحل مشكلة CORS بشكل نهائي عند التحميل داخل التطبيق
// أقصى عرض للتطبيق — يبقيه بشكل بطاقة أنيقة متوسّطة على الشاشات الكبيرة (لابتوب/كمبيوتر)
// بدلاً من التمدد حافة لحافة أو البقاء بعرض هاتف ثابت
const APP_MAX_WIDTH = "1200px";

const CF_WORKER_URL = `${cloudflareWorkerBaseUrl}/`;

function driveDownloadUrl(url) {
  const id = extractDriveId(url);
  if (!id) return url;
  return `https://drive.google.com/uc?export=download&id=${id}&confirm=t`;
}

// تحميل عبر Cloudflare Worker (يحل CORS) — يقبل إمّا رابط جوجل درايف كامل أو الـ File ID مباشرة
function driveProxyUrl(urlOrId) {
  const id = extractDriveId(urlOrId) || urlOrId;
  if (!id) return null;
  const proxyUrl = new URL(CF_WORKER_URL);
  proxyUrl.searchParams.set("fileId", String(id));
  return proxyUrl.toString();
}

function normalizeFetchUrl(inputUrl) {
  if (!inputUrl || typeof inputUrl !== "string") return inputUrl;
  if (inputUrl.startsWith("blob:")) return inputUrl;
  if (inputUrl.includes(cloudflareWorkerBaseUrl) && inputUrl.includes("fileId=")) return inputUrl;
  if (typeof isDriveUrl === "function" && isDriveUrl(inputUrl)) return driveProxyUrl(inputUrl) || inputUrl;
  return inputUrl;
}

function getDriveDirectUrl(url) {
  if (!url || typeof url !== "string") return url;
  const id = extractDriveId(url);
  if (id) {
    return `https://drive.google.com/uc?export=download&id=${id}&confirm=t`;
  }
  return url;
}

function driveEmbedUrl(url) {
  const id = extractDriveId(url);
  if (!id) return url;
  return `https://drive.google.com/file/d/${id}/preview`;
}

function isDriveUrl(url) {
  return url && (url.includes("drive.google.com") || url.includes("docs.google.com/uc"));
}

// Check if a file is an image based on MIME type or extension
function isImageFile(url, mimeType, title) {
  const imageExtensionRegex = /\.(png|jpe?g|webp|gif|svg)(\?|#|$)/i;
  const imageMimeRegex = /^image\//i;
  
  return (
    (mimeType && imageMimeRegex.test(mimeType)) ||
    (url && imageExtensionRegex.test(url)) ||
    (title && imageExtensionRegex.test(title))
  );
}

// Get direct Google image URL (using lh3.googleusercontent.com)
function getDirectGoogleImageUrl(fileId) {
  if (!fileId) return null;
  return `https://lh3.googleusercontent.com/d/${fileId}`;
}

// Get alternative direct Google Drive image URL (using drive.google.com/uc export)
function getDirectDriveImageUrl(fileId) {
  if (!fileId) return null;
  return `https://drive.google.com/uc?export=view&id=${fileId}`;
}

function formatSize(bytes) {
  if (!bytes) return "غير معروف";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
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

function getOfflineItemId(item) {
  if (!item) return getOfflineFileId("");
  if (item.id) return item.id;
  return getOfflineFileId(item.url || item.title || item.name || item.description || "");
}

function getFileMimeType(resource = {}, blob) {
  // Priority 1: Use blob's actual Content-Type from server response
  if (blob?.type && blob.type.trim()) return blob.type;
  
  const type = (resource.type || "").toLowerCase();
  const url = (resource.url || "").toLowerCase();
  
  // Priority 2: Check resource type and URL for detection
  if (type.includes("image") || /\.(png|jpe?g|webp|gif|svg)(\?|#|$)/.test(url)) {
    // Return proper MIME type based on extension
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

function getOnlineViewUrl(inputUrl, mimeType, title) {
  if (!inputUrl) return "";
  if (typeof isDriveUrl === "function" && isDriveUrl(inputUrl)) {
    // For images: use direct Google image URL to avoid CORB errors
    // /preview endpoint returns HTML, not image data, causing CORB to block
    if (isImageFile(inputUrl, mimeType, title)) {
      const fileId = extractDriveId(inputUrl);
      if (fileId) {
        // Return lh3.googleusercontent.com URL which serves raw image data
        return getDirectGoogleImageUrl(fileId);
      }
    }
    // For PDFs and documents: use /preview endpoint
    return driveEmbedUrl(inputUrl);
  }
  return inputUrl;
}

function getDownloadUrl(inputUrl) {
  if (!inputUrl) return "";
  if (typeof isDriveUrl === "function" && isDriveUrl(inputUrl)) return getDriveDirectUrl(inputUrl);
  return inputUrl;
}

function hasFileExtension(name) {
  return typeof name === "string" && /\.[a-zA-Z0-9]{1,6}$/.test(name.trim());
}

function getExtensionFromUrl(url) {
  if (!url || typeof url !== "string") return null;
  const match = url.match(/\.([a-zA-Z0-9]{1,6})(?:[?#]|$)/);
  if (!match) return null;
  return match[1].toLowerCase();
}

function getExtensionFromMime(mime) {
  if (!mime || typeof mime !== "string") return null;
  const type = mime.split(";")[0].trim().toLowerCase();
  if (type === "application/pdf") return "pdf";
  if (type === "image/jpeg") return "jpg";
  if (type === "image/png") return "png";
  if (type === "image/gif") return "gif";
  if (type === "image/webp") return "webp";
  if (type === "image/svg+xml") return "svg";
  if (type === "application/msword") return "doc";
  if (type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "docx";
  if (type === "application/vnd.ms-excel") return "xls";
  if (type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") return "xlsx";
  if (type === "text/plain") return "txt";
  if (type.startsWith("image/")) return type.split("/")[1] || null;
  if (type.startsWith("video/")) return type.split("/")[1] || null;
  return null;
}

function ensureFileNameWithExtension(item, blob) {
  const rawName = ((item?.title || item?.name || "sawaed-file") + "").trim();
  const sanitizedBase = rawName.replace(/[^a-zA-Z0-9\u0600-\u06FF.\-_]/g, "_");
  if (hasFileExtension(sanitizedBase)) return sanitizedBase;

  const extFromUrl = getExtensionFromUrl(item?.url);
  const extFromMime = getExtensionFromMime(getFileMimeType(item, blob));
  const extension = extFromUrl || extFromMime || "pdf";
  return `${sanitizedBase}.${extension}`;
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

async function downloadItemToDevice(item) {
  if (!item?.url) return;
  const isDriveLink = typeof isDriveUrl === "function" && isDriveUrl(item.url);
  const directDriveUrl = getDriveDirectUrl(item.url);
  const targets = isDriveLink
    ? [driveProxyUrl(item.url), directDriveUrl, driveDownloadUrl(item.url)]
    : [getDownloadUrl(item.url)];

  const expectedTypes = ["application/pdf", "image/", "application/octet-stream"];
  let blob = null;

  for (const targetUrl of targets) {
    if (!targetUrl) continue;
    try {
      blob = await fetchBinaryBlob(targetUrl, expectedTypes);
      if (blob && blob.size > 0) break;
    } catch (err) {
      console.warn("downloadItemToDevice candidate failed:", err?.message || err);
    }
  }

  if (!blob) {
    window.open(getDownloadUrl(item.url), "_blank");
    return;
  }

  const filename = ensureFileNameWithExtension(item, blob);
  downloadBlobToDevice(blob, filename);
}

async function fetchBinaryBlob(url, expectedTypes = ["application/pdf"]) {
  const safeUrl = normalizeFetchUrl(url);
  if (typeof isDriveUrl === "function" && isDriveUrl(url) && safeUrl === url) {
    throw new Error("Direct Google Drive fetch blocked; Cloudflare proxy is required.");
  }

  // Try to fetch the resource and ensure it's binary (not an HTML fallback page).
  let response;
  try {
    response = await fetch(safeUrl, { mode: "cors", cache: "no-store" });
  } catch (err) {
    throw new Error("NETWORK_ERROR:" + (err?.message || err));
  }

  // Handle Cloudflare Worker 403 response with requireIframe flag
  if (response.status === 403) {
    const contentType = (response.headers.get("Content-Type") || "").toLowerCase();
    if (contentType.includes("application/json")) {
      try {
        const jsonData = await response.json();
        if (jsonData.requireIframe === true && jsonData.fileId) {
          const error = new Error("REQUIRE_IFRAME:" + jsonData.fileId);
          error.fileId = jsonData.fileId;
          error.requireIframe = true;
          throw error;
        }
      } catch (parseErr) {
        if (parseErr.requireIframe) throw parseErr;
        console.warn("Failed to parse 403 JSON response:", parseErr);
      }
    }
    throw new Error(`HTTP 403 when fetching ${safeUrl} - File not available for direct download`);
  }

  if (!response.ok) throw new Error(`HTTP ${response.status} when fetching ${safeUrl}`);
  const contentType = (response.headers.get("Content-Type") || "").toLowerCase();

  // If the server returned HTML (Drive confirmation pages, 404 SPA page, etc.), read the text and abort.
  if (contentType.includes("text/html") || contentType.includes("application/xhtml+xml")) {
    const text = await response.text().catch(() => "");
    // Provide the returned HTML in the error message for debugging (trimmed).
    const snippet = (text || "").slice(0, 512).replace(/\s+/g, " ");
    throw new Error("HTML_RESPONSE:" + snippet);
  }

  const isAllowed = expectedTypes.some(type => contentType.includes(type)) || contentType.includes("octet-stream") || contentType.includes("application/pdf") || contentType.includes("image/");
  if (!isAllowed) throw new Error(`Invalid response type: ${contentType}`);

  const blob = await response.blob();
  if (!blob || blob.size === 0) throw new Error("Empty binary response");
  return new Blob([blob], { type: response.headers.get("Content-Type") || expectedTypes[0] });
}

// ============================================================
// SERVICE WORKER REGISTRATION
// ============================================================
// ============================================================
// FIREBASE SDK OVER FETCH SIMULATION
// ============================================================

const FB_BASE = firebaseConfig?.projectId
  ? `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents`
  : "";

function hasFirestoreBackend() {
  return Boolean(FB_BASE);
}

async function fbGet(collection, docId) {
  if (!hasFirestoreBackend()) return null;
  try {
    const url = docId ? `${FB_BASE}/${collection}/${docId}` : `${FB_BASE}/${collection}`;
    const headers = await getFirestoreAuthHeaders();
    const res = await fetch(url, { headers });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      if (res.status === 403) {
        console.warn("[Firestore 403] fbGet denied. Check Firestore Security Rules or Google Cloud IAM permissions.", { collection, docId, status: res.status, statusText: res.statusText, body: text });
      } else {
        console.error("fbGet failed", { collection, docId, status: res.status, statusText: res.statusText, body: text });
      }
      return null;
    }
    const data = await res.json();
    if (docId) return parseFirestoreDoc(data);
    return (data.documents || []).map(d => ({ id: d.name.split("/").pop(), ...parseFirestoreDoc(d) }));
  } catch (err) {
    console.error("fbGet exception", { collection, docId, error: err });
    return null;
  }
}

async function fbSet(collection, docId, fields) {
  if (!hasFirestoreBackend()) return false;
  try {
    const body = { fields: toFirestoreFields(fields) };
    const url = `${FB_BASE}/${collection}/${docId}`;
    const headers = { "Content-Type": "application/json", ...(await getFirestoreAuthHeaders()) };
    const res = await fetch(url, {
      method: "PATCH",
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("fbSet failed", { collection, docId, status: res.status, statusText: res.statusText, body: text });
      return false;
    }
    return true;
  } catch (err) {
    console.error("fbSet exception", { collection, docId, error: err });
    return false;
  }
}

async function fbAdd(collection, fields) {
  if (!hasFirestoreBackend()) return null;
  try {
    const body = { fields: toFirestoreFields(fields) };
    const url = `${FB_BASE}/${collection}`;
    const headers = { "Content-Type": "application/json", ...(await getFirestoreAuthHeaders()) };
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      if (res.status === 403) {
        console.warn("[Firestore 403] fbAdd denied. Check Firestore Security Rules or Google Cloud IAM permissions.", { collection, status: res.status, statusText: res.statusText, body: text });
      } else {
        console.error("fbAdd failed", { collection, status: res.status, statusText: res.statusText, body: text });
      }
      return null;
    }
    const data = await res.json();
    return data.name.split("/").pop();
  } catch (err) {
    console.error("fbAdd exception", { collection, error: err });
    return null;
  }
}

async function fbDelete(collection, docId) {
  if (!hasFirestoreBackend()) return false;
  try {
    const headers = await getFirestoreAuthHeaders();
    const res = await fetch(`${FB_BASE}/${collection}/${docId}`, { method: "DELETE", headers });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("fbDelete failed", { collection, docId, status: res.status, statusText: res.statusText, body: text });
      return false;
    }
    return true;
  } catch (err) {
    console.error("fbDelete exception", { collection, docId, error: err });
    return false;
  }
}

async function fbQuery(collection, structuredQuery) {
  if (!hasFirestoreBackend()) return null;
  try {
    const url = `${FB_BASE}:runQuery`;
    const headers = { "Content-Type": "application/json", ...(await getFirestoreAuthHeaders()) };
    const body = {
      structuredQuery: {
        from: [{ collectionId: collection }],
        ...structuredQuery,
      },
    };
    const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("fbQuery failed", { collection, status: res.status, statusText: res.statusText, body: text });
      return null;
    }
    const result = await res.json();
    return result
      .filter(row => row.document)
      .map(row => ({ id: row.document.name.split("/").pop(), ...parseFirestoreDoc(row.document) }));
  } catch (err) {
    console.error("fbQuery exception", { collection, error: err });
    return null;
  }
}

async function getNews() {
  const docs = await fbQuery("news", {
    orderBy: [{ field: { fieldPath: "createdAt" }, direction: "DESCENDING" }],
  });
  return docs ? docs.map(normalizeNewsItem) : [];
}

async function addNewsItem(fields) {
  const createdAt = Date.now();
  const id = await fbAdd("news", { ...fields, createdAt });
  return id ? { id, ...fields, createdAt } : null;
}

async function deleteNewsItem(id) {
  return fbDelete("news", id);
}

function normalizeNewsItem(item) {
  if (!item) return item;
  const normalized = { ...item };
  if (normalized.link && !normalized.url) normalized.url = normalized.link;
  if (normalized.url && !normalized.link) normalized.link = normalized.url;
  if (!normalized.createdAt && normalized.date) {
    normalized.createdAt = typeof normalized.date === "number" ? normalized.date : Date.parse(normalized.date) || Date.now();
  }
  return normalized;
}

function formatNewsDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return date.toLocaleDateString("ar", { day: "numeric", month: "long", year: "numeric" });
}

function parseFirestoreDoc(doc) {
  if (!doc || !doc.fields) return {};
  const result = {};
  for (const [k, v] of Object.entries(doc.fields)) {
    try {
      result[k] = parseFirestoreValue(v);
    } catch (err) {
      console.error("Error parsing Firestore doc field:", k, err);
      result[k] = null;
    }
  }
  return result;
}

function parseFirestoreValue(v) {
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.integerValue !== undefined) return parseInt(v.integerValue);
  if (v.doubleValue !== undefined) return parseFloat(v.doubleValue);
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.timestampValue !== undefined) return Date.parse(v.timestampValue);
  if (v.arrayValue !== undefined) return (v.arrayValue.values || []).map(parseFirestoreValue);
  if (v.mapValue !== undefined) return parseFirestoreDoc(v.mapValue);
  if (v.nullValue !== undefined) return null;
  return null;
}

function toFirestoreFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    fields[k] = toFirestoreValue(v, k);
  }
  return fields;
}

function toFirestoreValue(v, key = "") {
  if (v === null || v === undefined) return { nullValue: null };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (typeof v === "number" && typeof key === "string" && key.toLowerCase().endsWith("at")) {
    return { timestampValue: new Date(v).toISOString() };
  }
  if (typeof v === "string") return { stringValue: v };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: v } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map((item) => toFirestoreValue(item, key)) } };
  if (typeof v === "object") return { mapValue: { fields: toFirestoreFields(v) } };
  return { stringValue: String(v) };
}

async function getFirestoreAuthHeaders() {
  try {
    const token = auth?.currentUser ? await auth.currentUser.getIdToken() : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch (err) {
    console.warn("Failed to obtain Firestore auth token:", err);
    return {};
  }
}

function normalizeKeyPart(value) {
  return String(value || "").trim().replace(/\s+/g, " ").replace(/_+/g, "_");
}

function canonicalizeGrade(grade) {
  if (!grade || typeof grade !== "string") return grade || "";
  const normalized = grade.trim().replace(/\s+/g, " ");
  if (normalized === "ثاني عشر" || normalized === "ثاني عشر (توجيهي)" || normalized.includes("ثاني عشر")) {
    return "ثاني عشر (توجيهي)";
  }
  return normalized;
}

function canonicalizeBranch(branch) {
  if (!branch || typeof branch !== "string") return branch || "";
  const normalized = branch.trim().replace(/\s+/g, " ");
  if (normalized === "ادبي" || normalized === "أدبي") return "أدبي";
  return normalized;
}

function canonicalizeSemester(grade, semester) {
  const canonicalGrade = canonicalizeGrade(grade);
  if (canonicalGrade.includes("حادي عشر")) {
    return String(semester || "").trim() || "فصل أول";
  }
  return "فصل واحد";
}

function normalizeFolderKey({ grade = "", branch = "", semester = "", subject = "", section = "" } = {}) {
  return `folder_${normalizeKeyPart(canonicalizeGrade(grade))}_${normalizeKeyPart(canonicalizeBranch(branch))}_${normalizeKeyPart(canonicalizeSemester(grade, semester))}_${normalizeKeyPart(subject)}_${normalizeKeyPart(section)}`;
}

function getFolderKeyCandidates({ grade = "", branch = "", semester = "", subject = "", section = "", storageKey = "" } = {}) {
  const candidates = new Set();
  if (storageKey) candidates.add(storageKey);
  getFolderKeyVariants({ grade, branch, semester, subject, section }).forEach((key) => candidates.add(key));
  return Array.from(candidates);
}

function normalizeSubjectList(subjects) {
  if (!Array.isArray(subjects)) return [];
  return subjects.map(item => {
    if (typeof item === "string") return { name: item, active: true };
    return {
      name: String(item?.name || "").trim(),
      active: item?.active !== false,
    };
  });
}

function getSubjectNames(subjects, includeHidden = false) {
  return normalizeSubjectList(subjects)
    .filter(item => includeHidden || item.active)
    .map(item => item.name)
    .filter(Boolean);
}

function normalizeSubjectsMap(subjectsMap) {
  const normalized = {};
  for (const [key, subjects] of Object.entries(subjectsMap || {})) {
    normalized[key] = normalizeSubjectList(subjects);
  }
  return normalized;
}

function getCanonicalSubjectKey(grade = "", branch = "") {
  return `${canonicalizeGrade(grade)}_${canonicalizeBranch(branch)}`;
}

function findMatchingSubjectEntries(subjectsMap = {}, gradeBranchKey = "") {
  if (!subjectsMap || !gradeBranchKey) return [];
  if (subjectsMap[gradeBranchKey]) return subjectsMap[gradeBranchKey];

  const [grade = "", branch = ""] = gradeBranchKey.split("_");
  const targetGrade = canonicalizeGrade(grade);
  const targetBranch = canonicalizeBranch(branch);

  for (const key of Object.keys(subjectsMap)) {
    const [kGrade = "", kBranch = ""] = key.split("_");
    if (canonicalizeGrade(kGrade) === targetGrade && canonicalizeBranch(kBranch) === targetBranch) {
      return subjectsMap[key];
    }
  }

  return [];
}

function getSubjectsByGradeBranch(subjectsMap = {}, grade = "", branch = "", includeHidden = false) {
  return getSubjectNames(findMatchingSubjectEntries(subjectsMap, getCanonicalSubjectKey(grade, branch)), includeHidden);
}

function normalizeFoundKey({ subject = "", branch = "", type = "", sub = "" } = {}) {
  return `found_${normalizeKeyPart(subject)}_${normalizeKeyPart(canonicalizeBranch(branch || "عام"))}_${normalizeKeyPart(type)}_${normalizeKeyPart(sub)}`;
}

function getFolderKeyVariants({ grade = "", branch = "", semester = "", subject = "", section = "" } = {}) {
  const canonicalGrade = canonicalizeGrade(grade);
  const canonicalBranch = canonicalizeBranch(branch);
  const canonicalSemesterValue = canonicalizeSemester(grade, semester);
  const variants = new Set();
  variants.add(`folder_${normalizeKeyPart(canonicalGrade)}_${normalizeKeyPart(canonicalBranch)}_${normalizeKeyPart(canonicalSemesterValue)}_${normalizeKeyPart(subject)}_${normalizeKeyPart(section)}`);
  if (canonicalGrade === "ثاني عشر (توجيهي)") {
    variants.add(`folder_${normalizeKeyPart("ثاني عشر")}_${normalizeKeyPart(canonicalBranch)}_${normalizeKeyPart(canonicalSemesterValue)}_${normalizeKeyPart(subject)}_${normalizeKeyPart(section)}`);
  }
  if (canonicalSemesterValue === "فصل واحد") {
    variants.add(`folder_${normalizeKeyPart(canonicalGrade)}_${normalizeKeyPart(canonicalBranch)}_${normalizeKeyPart(subject)}_${normalizeKeyPart(section)}`);
    if (canonicalGrade === "ثاني عشر (توجيهي)") {
      variants.add(`folder_${normalizeKeyPart("ثاني عشر")}_${normalizeKeyPart(canonicalBranch)}_${normalizeKeyPart(subject)}_${normalizeKeyPart(section)}`);
    }
  }
  return Array.from(variants);
}

function parseStoredItems(value) {
  try {
    if (!value) return [];
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error("Error parsing stored items:", e);
    return [];
  }
}

function createItemId(prefix = "item") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeItemTree(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => {
    if (!item || typeof item !== "object") return item;
    if (item.type === "folder") {
      return {
        ...item,
        id: item.id || createItemId("folder"),
        children: normalizeItemTree(item.children || []),
      };
    }
    return {
      ...item,
      id: item.id || createItemId("file"),
    };
  });
}

function dissolveFolderInTree(items, folderId) {
  if (!Array.isArray(items)) return { items: [], found: false };

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const isFolder = item?.type === "folder" || item?.isFolder || Array.isArray(item?.children) || Array.isArray(item?.items);
    if (isFolder && item?.id === folderId) {
      const children = Array.isArray(item.children) ? item.children : item.items || [];
      return { items: [...items.slice(0, index), ...children, ...items.slice(index + 1)], found: true };
    }

    if (isFolder) {
      const childItems = Array.isArray(item.children) ? item.children : item.items;
      if (Array.isArray(childItems)) {
        const result = dissolveFolderInTree(childItems, folderId);
        if (result.found) {
          const updatedItem = { ...item, ...(Array.isArray(item.children) ? { children: result.items } : { items: result.items }) };
          return { items: [...items.slice(0, index), updatedItem, ...items.slice(index + 1)], found: true };
        }
      }
    }
  }

  return { items, found: false };
}

function addFolderToTree(items, parentId, newFolder) {
  if (!Array.isArray(items)) return items;

  return items.map(item => {
    if (!item || typeof item !== "object") return item;
    if (item.id === parentId) {
      const children = Array.isArray(item.children) ? item.children : Array.isArray(item.items) ? item.items : [];
      const nextChildren = [...children, newFolder];
      return { ...item, children: nextChildren, items: nextChildren };
    }
    if (item.type === "folder" || item.isFolder || Array.isArray(item.children) || Array.isArray(item.items)) {
      const children = Array.isArray(item.children) ? item.children : Array.isArray(item.items) ? item.items : [];
      const nextChildren = addFolderToTree(children, parentId, newFolder);
      if (nextChildren !== children) {
        return { ...item, children: nextChildren, items: nextChildren };
      }
    }
    return item;
  });
}


const SEC_EMOJI = { "الرزم": "📦", "الكتب": "📚", "حلول الكتب": "✅", "مواد تعليمية": "🎬", "ملخصات": "📝", "أسئلة واختبارات سابقة": "❓", "اختبارات إلكترونية": "💡", "عروض تقديمية": "📊", "الدراسة للامتحانات": "📅", "قنوات يوتيوب شارحة": "▶️" };

// ============================================================
// MAIN APP COMPONENT
// ============================================================

export default function App() {
  const [config, setConfig] = useState(() => {
    const saved = ls("sawaed_config", DEFAULT_CONFIG);
    if (saved && typeof saved === "object" && "adminPassword" in saved) {
      const { adminPassword, ...rest } = saved;
      return rest;
    }
    return saved;
  });
  const [darkMode, setDarkMode] = useState(() => {
    const saved = ls("sawaed_dark", null);
    return saved === null ? true : saved;
  });
  const [oledModeEnabled, setOledModeEnabled] = useState(() => ls("oled_mode_enabled", false) === true);
  const [page, setPage] = useState("loading");
  const [notificationToast, setNotificationToast] = useState(null);
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);
  const pendingWorkerRef = useRef(null);
  const { currentUser, authLoading, logout: authLogout, updateUserProfile, needsOnboarding: authNeedsOnboarding } = useAuth();
  const role = normalizeUserRole(currentUser?.role || "user");
  const isFullAdmin = role === "super_admin";
  const isAdminLike = isFullAdmin || ["editor_full", "editor_malazem", "editor_news", "editor_taasees"].includes(role);
  const [activePage, setActivePage] = useState("home");
  const [quoteIdx, setQuoteIdx] = useState(0);
  const [flame, setFlame] = useState(() => initFlame());
  const openAdminPanel = () => setPage("admin");
  const shouldForceOnboarding = Boolean(authNeedsOnboarding && currentUser && !isAdminLike);
  const handleOnboardingComplete = () => setPage("main");

  const requestNotifications = useCallback(async () => {
    if (typeof Notification === "undefined") return;

    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        const token = await requestFCMToken();
        console.info("FCM token registration result:", token ? "success" : "no token");

        if (token) {
          new Notification("سواعد الخير ✅", { body: "تم تفعيل الإشعارات بنجاح!" });
        } else {
          console.warn("FCM token registration returned null. Check SW registration, VAPID key and Firestore rules.");
        }

        if (currentUser?.uid) {
          localStorage.setItem(`notification_prompt_handled_${currentUser.uid}`, "true");
        }
        setShowNotificationPrompt(false);
        return;
      }

      console.warn("Notification permission denied or quiet-blocked by browser:", permission);
      if (currentUser?.uid) {
        localStorage.setItem(`notification_prompt_handled_${currentUser.uid}`, "true");
      }
      setShowNotificationPrompt(false);
      setNotificationToast({
        title: "تفعيل الإشعارات",
        body: "إذا لم تظهر نافذة التفعيل، يرجى الضغط على أيقونة الجرس 🔔 بجانب رابط الموقع (URL) أعلى الصفحة واختيار Allow.",
      });
      window.setTimeout(() => setNotificationToast(null), 6000);
    } catch (err) {
      console.error("Notification toggle failed:", err);
      if (currentUser?.uid) {
        localStorage.setItem(`notification_prompt_handled_${currentUser.uid}`, "true");
      }
      setShowNotificationPrompt(false);
      setNotificationToast({
        title: "تفعيل الإشعارات",
        body: "إذا لم تظهر نافذة التفعيل، يرجى الضغط على أيقونة الجرس 🔔 بجانب رابط الموقع (URL) أعلى الصفحة واختيار Allow.",
      });
      window.setTimeout(() => setNotificationToast(null), 6000);
    }
  }, [currentUser?.uid]);

  const dismissNotificationPrompt = useCallback((persist = true) => {
    if (persist && currentUser?.uid) {
      localStorage.setItem(`notification_prompt_handled_${currentUser.uid}`, "true");
    }
    setShowNotificationPrompt(false);
  }, [currentUser?.uid]);

  useEffect(() => {
    if (!currentUser || typeof Notification === "undefined") {
      setShowNotificationPrompt(false);
      return;
    }

    const promptKey = `notification_prompt_handled_${currentUser.uid}`;
    const alreadyHandled = localStorage.getItem(promptKey) === "true";
    if (!alreadyHandled && Notification.permission === "default") {
      setShowNotificationPrompt(true);
    } else {
      setShowNotificationPrompt(false);
    }
  }, [currentUser?.uid, currentUser?.email]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return undefined;

    let disposed = false;
    let registration;

    const watchInstallingWorker = (worker) => {
      if (!worker) return;
      worker.addEventListener("statechange", () => {
        if (!disposed && worker.state === "installed" && navigator.serviceWorker.controller) {
          pendingWorkerRef.current = worker;
          setShowUpdateBanner(true);
        }
      });
    };

    const handleControllerChange = () => {
      if (pendingWorkerRef.current) window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);
    navigator.serviceWorker.ready.then((readyRegistration) => {
      if (disposed) return;
      registration = readyRegistration;
      registration.update().catch(() => {});
      registration.addEventListener("updatefound", () => watchInstallingWorker(registration.installing));
      watchInstallingWorker(registration.installing);
    }).catch(() => {});

    return () => {
      disposed = true;
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, []);

  const handleAppUpdate = () => {
    const worker = pendingWorkerRef.current;
    setShowUpdateBanner(false);
    if (worker) {
      worker.postMessage({ type: "SKIP_WAITING" });
    } else {
      window.location.reload();
    }
  };

  const [subjectNav, setSubjectNav] = useState(null);
  const [folderNav, setFolderNav] = useState(null);
  const [foundNav, setFoundNav] = useState(null);
  const [newsDetail, setNewsDetail] = useState(null);
  const [configLoaded, setConfigLoaded] = useState(false);
  const T = oledModeEnabled
    ? { ...(darkMode ? DARK : LIGHT), bg: "#000000", card: "#080808", sectionBg: "#0d0d0d", inputBg: "#0d0d0d", navBg: "#000000" }
    : (darkMode ? DARK : LIGHT);

  // Sync a theme class on the document element so native widgets (select/options) can be themed via CSS
  useEffect(() => {
    try {
      const el = document.documentElement;
      el.classList.remove("light", "dark");
      el.classList.add(darkMode ? "dark" : "light");
      if (!el.classList.contains("dark") && !el.classList.contains("light")) {
        el.classList.add("dark");
      }
      document.body.classList.remove("light", "dark");
      document.body.classList.add(darkMode ? "dark" : "light");
    } catch (e) {
      // ignore (e.g., during SSR or non-browser env)
    }
  }, [darkMode]);

  useEffect(() => {
    document.documentElement.classList.toggle("oled-mode", oledModeEnabled);
    document.body.classList.toggle("oled-mode", oledModeEnabled);
    lsSet("oled_mode_enabled", oledModeEnabled);
  }, [oledModeEnabled]);

  const logout = async () => {
    // Immediately reset UI to welcome/landing before attempting sign-out
    setPage("welcome");
    setActivePage("home");
    setSubjectNav(null);
    setFolderNav(null);
    setFoundNav(null);
    setNewsDetail(null);
    resetNav();
    try {
      await authLogout();
      // after successful sign-out, ensure app shows landing
      setPage(config.splashEnabled ? "splash" : "register");
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  // Global auth guard: if auth finished loading and there's no user, force landing/welcome
  useEffect(() => {
    if (!authLoading && !currentUser) {
      // preserve a stable UI state to avoid rendering protected pages
      setPage("welcome");
      setActivePage("home");
      setSubjectNav(null);
      setFolderNav(null);
      setFoundNav(null);
      setNewsDetail(null);
      resetNav();
    }
  }, [authLoading, currentUser]);

  // ============================================================
  // تصحيح البيانات إذا كانت مفقودة أو فاسدة
  // ============================================================
  useEffect(() => {
    let needsUpdate = false;
    let newConfig = { ...config };

    if (!config.subjects || Object.keys(config.subjects).length === 0) {
      console.warn("المواد مفقودة أو فارغة، جاري إعادة تعيينها بالكامل...");
      newConfig.subjects = { ...DEFAULT_CONFIG.subjects };
      needsUpdate = true;
    } else {
      const defaultSubjects = DEFAULT_CONFIG.subjects || {};
      const currentSubjects = { ...config.subjects };
      let merged = false;

      // ترحيل: مفاتيح قديمة كانت تحمل الفصل ضمن اسم المادة (حادي عشر_علمي_فصل أول) — ندمجها في مفتاح واحد
      const legacySuffixes = ["_فصل أول", "_فصل ثان"];
      Object.keys(currentSubjects).forEach(key => {
        const legacySuffix = legacySuffixes.find(s => key.endsWith(s));
        if (legacySuffix) {
          const newKey = key.slice(0, -legacySuffix.length);
          const merged1 = new Set([...(currentSubjects[newKey] || []), ...(currentSubjects[key] || [])]);
          currentSubjects[newKey] = Array.from(merged1);
          delete currentSubjects[key];
          merged = true;
        }
      });

      Object.keys(defaultSubjects).forEach(key => {
        if (!currentSubjects[key] || currentSubjects[key].length === 0) {
          currentSubjects[key] = defaultSubjects[key];
          merged = true;
        }
      });

      if (merged) {
        console.warn("تم دمج مفاتيح المواد الناقصة للصف الحادي عشر...");
        newConfig.subjects = currentSubjects;
        needsUpdate = true;
      }
    }

    // ترحيل: مجلدات الصفوف غير "حادي عشر" كانت تُحفظ أحياناً بدون فاصل "فصل واحد" الثابت
    // مما يمنع الطالب من رؤية الملفات التي أضافها المحرر لنفس المادة والقسم
    (config.grades || []).forEach(g => {
      if (g.includes("حادي عشر")) return;
      (config.branches || []).forEach(b => {
        const oldPrefix = `folder_${g}_${b}_`;
        const fixedMarker = `_فصل واحد_`;
        Object.keys(config).forEach(k => {
          if (k.startsWith(oldPrefix) && !k.includes(fixedMarker) && !k.includes("_فصل أول_") && !k.includes("_فصل ثان_")) {
            const newKey = `folder_${g}_${b}_فصل واحد_${k.slice(oldPrefix.length)}`;
            if (newConfig[newKey] === undefined) {
              newConfig[newKey] = config[k];
              needsUpdate = true;
            }
          }
        });
      });
    });

    if (config && (!config.grades || config.grades.length === 0)) {
      newConfig.grades = DEFAULT_CONFIG.grades;
      newConfig.branches = DEFAULT_CONFIG.branches;
      needsUpdate = true;
    }

    if (config.editors === undefined) {
      newConfig.editors = [...DEFAULT_CONFIG.editors];
      needsUpdate = true;
    }

    if (needsUpdate) {
      setConfig(newConfig);
      lsSet("sawaed_config", newConfig);
    }
  }, [config]);

  // ============================================================
  // مراقبة شبكة الاتصال
  // ============================================================
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !firebaseConfig?.projectId) return;
    navigator.serviceWorker.register("/firebase-messaging-sw.js").catch(() => {});
  }, []);

  useEffect(() => {
    if (!currentUser?.uid || !messaging) return;
    if (Notification.permission !== "granted") return;
    console.info("Registering FCM token for active user");
    requestFCMToken().catch((err) => {
      console.warn("App-level FCM registration failed:", err);
    });
  }, [currentUser?.uid]);

  useEffect(() => {
    if (!messaging) return;

    const unsubscribe = onMessage(messaging, (payload) => {
      const title = payload?.notification?.title || "إشعار جديد";
      const body = payload?.notification?.body || "";
      setNotificationToast({ title, body });
      if (typeof sendLocalNotification === "function") sendLocalNotification(title, body);
      const timer = window.setTimeout(() => setNotificationToast(null), 5000);
      return () => window.clearTimeout(timer);
    });

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!db) return;

    let isFirstSnapshot = true;
    const lastSeenBroadcastId = ls("sawaed_last_broadcast_id", null);
    const unsubscribe = onSnapshot(collection(db, "broadcast_notifications"), (snapshot) => {
      const docs = [...snapshot.docs].sort((a, b) => {
        const aTime = a.data()?.createdAt?.toDate ? a.data().createdAt.toDate().getTime() : Number(a.data()?.createdAt || 0);
        const bTime = b.data()?.createdAt?.toDate ? b.data().createdAt.toDate().getTime() : Number(b.data()?.createdAt || 0);
        return bTime - aTime;
      });

      const newest = docs[0];
      if (!newest) return;

      const newestId = newest.id;
      if (isFirstSnapshot) {
        isFirstSnapshot = false;
        if (lastSeenBroadcastId !== newestId) {
          lsSet("sawaed_last_broadcast_id", newestId);
        }
        return;
      }

      if (lastSeenBroadcastId && newestId === lastSeenBroadcastId) return;

      const payload = newest.data() || {};
      const title = payload.title || "إشعار جديد";
      const body = payload.body || "";
      setNotificationToast({ title, body });
      lsSet("sawaed_last_broadcast_id", newestId);
      if (typeof sendLocalNotification === "function") sendLocalNotification(title, body);
    }, (error) => {
      console.warn("broadcast_notifications listener failed:", error);
    });

    return () => unsubscribe && unsubscribe();
  }, []);

  // ============================================================
  // الإشعارات الفورية (Announcements) — يتحقق كل جهاز دورياً من وجود إعلان جديد
  // ملاحظة: لا يوجد أي قفل "جلسة واحدة" في التطبيق — أي حساب (طالب أو محرر) يبقى
  // مسجلاً ونشطاً على أي عدد من الأجهزة في نفس الوقت دون أي تسجيل خروج تلقائي
  // ============================================================
  useEffect(() => {
    const checkAnnouncements = async () => {
      const list = await fbGet("announcements");
      if (!list || list.length === 0) return;
      const latest = list.sort((a, b) => b.createdAt - a.createdAt)[0];
      const lastSeenId = ls("sawaed_last_announcement_id", null);
      if (latest.id !== lastSeenId) {
        lsSet("sawaed_last_announcement_id", latest.id);
        if (lastSeenId !== null) sendLocalNotification(`📢 ${latest.title}`, latest.body || "");
      }
    };
    checkAnnouncements();
    const t = setInterval(checkAnnouncements, 45000);
    return () => clearInterval(t);
  }, []);

  // ============================================================
  // العبارات التحفيزية بفاصل زمني (متسلسلة حسب اختيار الطالب من الإعدادات)
  // ============================================================
  useEffect(() => {
    const tick = () => {
      const intervalMin = ls("sawaed_quote_interval_min", 0);
      const quotes = config.motivationalQuotes || [];
      if (!intervalMin || quotes.length === 0) return;
      const lastSent = ls("sawaed_quote_last_sent", 0);
      const now = Date.now();
      if (now - lastSent >= intervalMin * 60 * 1000) {
        const ptr = ls("sawaed_quote_ptr", 0) % quotes.length;
        const q = quotes[ptr];
        if (q?.text) sendLocalNotification("💬 عبارة تحفيزية", q.text);
        lsSet("sawaed_quote_ptr", (ptr + 1) % quotes.length);
        lsSet("sawaed_quote_last_sent", now);
      }
    };
    const t = setInterval(tick, 30000);
    return () => clearInterval(t);
  }, [config.motivationalQuotes]);

  // ============================================================
  // تذكيرات المذاكرة المجدولة (تاريخ ووقت محددان بالدقيقة)
  // ============================================================
  useEffect(() => {
    const tick = () => {
      const reminders = ls("sawaed_study_reminders", []);
      if (!reminders.length) return;
      const now = Date.now();
      let changed = false;
      const updated = reminders.map(r => {
        if (!r.fired && new Date(r.time).getTime() <= now) {
          sendLocalNotification("⏰ تذكير المذاكرة", r.label || "حان وقت المذاكرة الذي حددته!");
          changed = true;
          return { ...r, fired: true };
        }
        return r;
      }).filter(r => !r.fired || Date.now() - new Date(r.time).getTime() < 24 * 60 * 60 * 1000); // تنظيف التذكيرات القديمة بعد يوم
      if (changed) lsSet("sawaed_study_reminders", updated);
    };
    const t = setInterval(tick, 20000);
    tick();
    return () => clearInterval(t);
  }, []);

  const handleBack = useCallback(() => {
    if (folderNav) { setFolderNav(null); popNav(); return; }
    if (subjectNav) { setSubjectNav(null); popNav(); return; }
    if (foundNav) { setFoundNav(null); popNav(); return; }
    if (newsDetail) { setNewsDetail(null); popNav(); return; }
    if (page === "admin") { setPage(currentUser ? "main" : "register"); popNav(); return; }
    if (activePage !== "home" && page === "main") {
      setActivePage("home");
    }
  }, [folderNav, subjectNav, foundNav, newsDetail, page, activePage, currentUser]);

  useEffect(() => {
    const onPopState = (e) => {
      handleBack();
      if (navStack.length > 0 || folderNav || subjectNav || foundNav || newsDetail || page === "admin") {
        window.history.pushState({ sawaed: true }, "");
      }
    };
    window.addEventListener("popstate", onPopState);
    window.history.pushState({ sawaed: true }, "");
    return () => window.removeEventListener("popstate", onPopState);
  }, [handleBack, folderNav, subjectNav, foundNav, newsDetail, page]);

  useEffect(() => {
    fbGet("app_config", "main").then(data => {
      if (data && Object.keys(data).length > 0) {
        const merged = { ...DEFAULT_CONFIG };
        for (const [k, v] of Object.entries(data)) {
          try {
            merged[k] = typeof v === "string" && (v.startsWith("[") || v.startsWith("{")) ? JSON.parse(v) : v;
          } catch { merged[k] = v; }
        }
        setConfig(merged);
        lsSet("sawaed_config", merged);
      }
      setConfigLoaded(true);
    });
  }, []);

  const prevUserRef = useRef(null);

  useEffect(() => {
    if (!configLoaded || authLoading) return;
    const prev = prevUserRef.current;
    const significantChange = !prev || prev.uid !== currentUser?.uid || prev.role !== currentUser?.role || prev.grade !== currentUser?.grade || prev.branch !== currentUser?.branch;

    if (currentUser) {
      const { streak } = calcFlame();
      setFlame(streak);

      // If this update only contains non-significant fields (e.g., progress), don't auto-navigate
      if (!significantChange) {
        prevUserRef.current = currentUser;
        return;
      }

      if (shouldForceOnboarding) {
        setPage("onboarding");
      } else if (isAdminLike) {
        // Only auto-enter admin on a significant user change (role change or initial load)
        setPage("admin");
      } else {
        setPage("main");
      }
    } else {
      setPage(config.splashEnabled ? "splash" : "register");
      setActivePage("home");
      setSubjectNav(null);
      setFolderNav(null);
      setFoundNav(null);
      setNewsDetail(null);
    }

    prevUserRef.current = currentUser;
  }, [configLoaded, authLoading, currentUser, config.splashEnabled, authNeedsOnboarding, isAdminLike]);

  useEffect(() => {
    if (config.motivationalFixed || !config.motivationalQuotes?.length) return;
    const mins = config.motivationalQuotes[quoteIdx]?.duration || 60;
    const t = setTimeout(() => setQuoteIdx(i => (i + 1) % config.motivationalQuotes.length), mins * 60 * 1000);
    return () => clearTimeout(t);
  }, [quoteIdx, config]);

  useEffect(() => {
    ensureEditorAccountsSeeded().catch(() => {});
  }, []);

  const saveConfig = async (newCfg) => {
    const cfg = { ...newCfg };
    delete cfg.adminPassword;
    setConfig(cfg);
    lsSet("sawaed_config", cfg);
    const flat = {};
    for (const [k, v] of Object.entries(cfg)) {
      flat[k] = typeof v === "object" ? JSON.stringify(v) : v;
    }
    await fbSet("app_config", "main", flat);
  };

  const updateUser = async (data) => {
    return await updateUserProfile(data);
  };

  const openSubject = (data) => { pushNav("subject"); setSubjectNav(data); };
  const openFolder = (data) => { pushNav("folder"); setFolderNav(data); };
  const openFound = (data) => { pushNav("found"); setFoundNav(data); };
  const openNews = (data) => { pushNav("news"); setNewsDetail(data); };
  const [showTimerModal, setShowTimerModal] = useState(false);

  const quote = config.motivationalFixed ? config.motivationalQuotes?.[0] : config.motivationalQuotes?.[quoteIdx];

  if (page === "loading" || authLoading || !configLoaded) return <LoadingScreen T={T} />;
  if (page === "splash") return <SplashPage config={config} T={T} onNext={() => setPage("register")} />;
  if (page === "register") return <RegisterPage config={config} T={T} darkMode={darkMode} appMaxWidth={APP_MAX_WIDTH} />;
  if (page === "onboarding") return <OnboardingPage config={config} T={T} darkMode={darkMode} currentUser={currentUser} updateUser={updateUser} onComplete={handleOnboardingComplete} appMaxWidth={APP_MAX_WIDTH} />;
  // Prevent protected components from rendering when auth finished and there's no user
  if (!authLoading && !currentUser) {
    return <AppRedirectNotice T={T} />;
  }

  if (page === "admin") return <AdminPanel config={config} saveConfig={saveConfig} T={T} darkMode={darkMode} editorRole={role} editorPermissions={null} onBack={() => { setPage(currentUser ? "main" : "register"); popNav(); }} getSubjectsByGradeBranch={getSubjectsByGradeBranch} normalizeFoundKey={normalizeFoundKey} validateRequiredFields={validateRequiredFields} normalizeDriveFolderInput={normalizeDriveFolderInput} extractDriveFolderId={extractDriveFolderId} cloudflareWorkerBaseUrl={cloudflareWorkerBaseUrl} addFolderToTree={addFolderToTree} dissolveFolderInTree={dissolveFolderInTree} getSubjectNames={getSubjectNames} canonicalizeGrade={canonicalizeGrade} canonicalizeBranch={canonicalizeBranch} normalizeFolderKey={normalizeFolderKey} getFolderKeyCandidates={getFolderKeyCandidates} fbGet={fbGet} fbSet={fbSet} fbAdd={fbAdd} fbDelete={fbDelete} getNews={getNews} addNewsItem={addNewsItem} deleteNewsItem={deleteNewsItem} normalizeNewsItem={normalizeNewsItem} formatNewsDate={formatNewsDate} sendLocalNotification={sendLocalNotification} />;
  if (folderNav) return <FolderPage config={config} saveConfig={saveConfig} T={T} darkMode={darkMode} currentUser={currentUser} updateUser={updateUser} data={folderNav} onBack={() => { setFolderNav(null); popNav(); }} isEditorSession={false} editorRole={null} editorPermissions={null} />;
  if (subjectNav) return <ExtractedSubjectPage config={config} saveConfig={saveConfig} T={T} darkMode={darkMode} currentUser={currentUser} updateUser={updateUser} subject={subjectNav} onBack={() => { setSubjectNav(null); setPage(currentUser ? "main" : "register"); setActivePage("home"); }} isEditorSession={false} onOpenFolder={openFolder} canonicalizeGrade={canonicalizeGrade} canonicalizeBranch={canonicalizeBranch} EMOJI={EMOJI} SEC_EMOJI={SEC_EMOJI} />;
  if (foundNav) return <FoundationSubjectPage config={config} saveConfig={saveConfig} T={T} darkMode={darkMode} data={foundNav} onBack={() => { setFoundNav(null); popNav(); }} />;
  if (newsDetail) return <NewsDetailPage T={T} news={newsDetail} currentUser={currentUser} updateUser={updateUser} onBack={() => { setNewsDetail(null); popNav(); }} />;

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: "'Cairo',sans-serif", direction: "rtl", paddingBottom: "80px", boxSizing: "border-box", width: "100%", paddingInline: "16px" }}>
      <AppNotificationSystem showNotificationPrompt={showNotificationPrompt} dismissNotificationPrompt={dismissNotificationPrompt} requestNotifications={requestNotifications} notificationToast={notificationToast} showUpdateBanner={showUpdateBanner} handleAppUpdate={handleAppUpdate} T={T} />

      <div style={{ maxWidth: APP_MAX_WIDTH, margin: "0 auto", width: "100%" }}>
        <AppPageTopBar TimerMiniWidget={TimerMiniWidget} showTimerModal={showTimerModal} setShowTimerModal={setShowTimerModal} StudyTimer={StudyTimer} T={T} quote={quote} darkMode={darkMode} />
        <AppMainContent activePage={activePage} config={config} T={T} darkMode={darkMode} currentUser={currentUser} flame={flame} openSubject={openSubject} openFound={openFound} openNews={openNews} saveConfig={saveConfig} updateUser={updateUser} getNews={getNews} getCanonicalSubjectKey={getCanonicalSubjectKey} getSubjectsByGradeBranch={getSubjectsByGradeBranch} EMOJI={EMOJI} setDarkMode={setDarkMode} oledModeEnabled={oledModeEnabled} setOledModeEnabled={setOledModeEnabled} logout={logout} openAdminPanel={openAdminPanel} showTimerModal={showTimerModal} setShowTimerModal={setShowTimerModal} setActivePage={setActivePage} idbGetAllFiles={idbGetAllFiles} idbDeleteFile={idbDeleteFile} formatSize={formatSize} requestFCMToken={requestFCMToken} ls={ls} lsSet={lsSet} />
      </div>
      <AppBottomNav config={config} activePage={activePage} T={T} APP_MAX_WIDTH={APP_MAX_WIDTH} setActivePage={setActivePage} />
    </div>
  );
}

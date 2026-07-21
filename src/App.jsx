// ============================================================
// IN-APP DOWNLOAD SYSTEM
// ============================================================

const IDB_NAME = "sawaed_downloads";
const IDB_VERSION = 1;
const IDB_STORE = "files";
import confetti from 'canvas-confetti';

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
    const record = {
      id,
      blob,
      ...meta,
      addedAt: Date.now(),
      size: blob.size,
    };
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

// رابط Cloudflare Worker للـ proxy — يحل مشكلة CORS بشكل نهائي عند التحميل داخل التطبيق
// أقصى عرض للتطبيق — يبقيه بشكل بطاقة أنيقة متوسّطة على الشاشات الكبيرة (لابتوب/كمبيوتر)
// بدلاً من التمدد حافة لحافة أو البقاء بعرض هاتف ثابت
const APP_MAX_WIDTH = "900px";

const CF_WORKER_URL = "https://files.sawaidualkhayri.workers.dev/";

function driveDownloadUrl(url) {
  const id = extractDriveId(url);
  if (!id) return url;
  return `https://drive.google.com/uc?export=download&id=${id}&confirm=t`;
}

// تحميل عبر Cloudflare Worker (يحل CORS) — يقبل إمّا رابط جوجل درايف كامل أو الـ File ID مباشرة
function driveProxyUrl(urlOrId) {
  const id = extractDriveId(urlOrId) || urlOrId;
  if (!id) return null;
  return `${CF_WORKER_URL}${id}`;
}

function driveEmbedUrl(url) {
  const id = extractDriveId(url);
  if (!id) return url;
  return `https://drive.google.com/file/d/${id}/preview`;
}

function isDriveUrl(url) {
  return url && (url.includes("drive.google.com") || url.includes("docs.google.com/uc"));
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

function getFileMimeType(resource = {}, blob) {
  if (blob?.type) return blob.type;
  const type = (resource.type || "").toLowerCase();
  const url = (resource.url || "").toLowerCase();
  if (type.includes("image") || /\.(png|jpe?g|webp|gif|svg)(\?|#|$)/.test(url)) return "image/*";
  if (type.includes("pdf") || url.includes(".pdf")) return "application/pdf";
  return "application/octet-stream";
}

function getOnlineViewUrl(inputUrl) {
  if (!inputUrl) return "";
  if (typeof isDriveUrl === "function" && isDriveUrl(inputUrl)) return driveEmbedUrl(inputUrl);
  return inputUrl;
}

function getDownloadUrl(inputUrl) {
  if (!inputUrl) return "";
  if (typeof isDriveUrl === "function" && isDriveUrl(inputUrl)) return driveDownloadUrl(inputUrl);
  return inputUrl;
}

import { useState, useEffect, useRef, useCallback } from "react";

// ============================================================
// SERVICE WORKER REGISTRATION
// ============================================================

// ============================================================
// SERVICE WORKER + PUSH NOTIFICATIONS
// ============================================================

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      window.__swReg = reg;
      reg.addEventListener("updatefound", () => {
        const nw = reg.installing;
        nw?.addEventListener("statechange", () => {
          if (nw.state === "installed" && navigator.serviceWorker.controller) {
            console.log("[PWA] تحديث جديد — أعد تحميل الصفحة");
          }
        });
      });
    } catch (err) {
      console.warn("[PWA] SW failed:", err);
    }
  });
}

// ============================================================
// PWA APP NAME — يضمن ظهور "سواعد الخير" كاسم عند التثبيت من Google Chrome
// ============================================================
(function ensurePwaAppName() {
  const APP_NAME = "سواعد الخير";
  try {
    document.title = APP_NAME;

    // meta name للمتصفحات المبنية على WebKit (اختصار الشاشة الرئيسية)
    let appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    if (!appleTitle) {
      appleTitle = document.createElement("meta");
      appleTitle.setAttribute("name", "apple-mobile-web-app-title");
      document.head.appendChild(appleTitle);
    }
    appleTitle.setAttribute("content", APP_NAME);

    // نولّد Web App Manifest جديدًا في الذاكرة باسم "سواعد الخير" ونستبدل به أي manifest سابق
    // حتى تعرض نافذة "تثبيت التطبيق" في جوجل كروم هذا الاسم بالضبط
    const existingLink = document.querySelector('link[rel="manifest"]');
    fetch(existingLink ? existingLink.href : "/manifest.json")
      .then(res => (res.ok ? res.json() : {}))
      .catch(() => ({}))
      .then(baseManifest => {
        const manifest = {
          ...baseManifest,
          name: APP_NAME,
          short_name: APP_NAME,
          lang: "ar",
          dir: "rtl",
        };
        const blob = new Blob([JSON.stringify(manifest)], { type: "application/json" });
        const manifestURL = URL.createObjectURL(blob);
        let link = document.querySelector('link[rel="manifest"]');
        if (!link) {
          link = document.createElement("link");
          link.setAttribute("rel", "manifest");
          document.head.appendChild(link);
        }
        link.setAttribute("href", manifestURL);
      });
  } catch (err) {
    console.warn("[PWA] تعذر ضبط اسم التطبيق:", err);
  }
})();

// إرسال إشعار محلي (يعمل حتى بدون push server)
function sendLocalNotification(title, body) {
  if (Notification.permission !== "granted") return;
  const opts = { body, icon: "/icon-192.png", badge: "/icon-192.png", dir: "rtl", lang: "ar" };
  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready.then(reg => reg.showNotification(title, opts));
  } else {
    new Notification(title, opts);
  }
}

// ============================================================
// NAVIGATION HISTORY
// ============================================================

const navStack = [];

function pushNav(id) {
  navStack.push(id);
  window.history.pushState({ navId: id, stackLen: navStack.length }, "");
}

function popNav() {
  navStack.pop();
}

// ============================================================
// FIREBASE CONFIG
// ============================================================

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCUK5D8fCqxlDPk5_4u_HZBt0-j_QCE_gc",
  authDomain: "sawaidualkhayr.firebaseapp.com",
  projectId: "sawaidualkhayr",
  storageBucket: "sawaidualkhayr.firebasestorage.app",
  messagingSenderId: "504547862189",
  appId: "1:504547862189:web:aae65198e304894c7c0824",
};

// ============================================================
// FIREBASE SDK OVER FETCH SIMULATION
// ============================================================

const FB_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents`;

async function fbGet(collection, docId) {
  try {
    const url = docId ? `${FB_BASE}/${collection}/${docId}` : `${FB_BASE}/${collection}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (docId) return parseFirestoreDoc(data);
    return (data.documents || []).map(d => ({ id: d.name.split("/").pop(), ...parseFirestoreDoc(d) }));
  } catch { return null; }
}

async function fbSet(collection, docId, fields) {
  try {
    const body = { fields: toFirestoreFields(fields) };
    const url = `${FB_BASE}/${collection}/${docId}`;
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch { return false; }
}

async function fbAdd(collection, fields) {
  try {
    const body = { fields: toFirestoreFields(fields) };
    const res = await fetch(`${FB_BASE}/${collection}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.name.split("/").pop();
  } catch { return null; }
}

async function fbDelete(collection, docId) {
  try {
    const res = await fetch(`${FB_BASE}/${collection}/${docId}`, { method: "DELETE" });
    return res.ok;
  } catch { return false; }
}

function parseFirestoreDoc(doc) {
  if (!doc.fields) return {};
  const result = {};
  for (const [k, v] of Object.entries(doc.fields)) {
    result[k] = parseFirestoreValue(v);
  }
  return result;
}

function parseFirestoreValue(v) {
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.integerValue !== undefined) return parseInt(v.integerValue);
  if (v.doubleValue !== undefined) return parseFloat(v.doubleValue);
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.arrayValue !== undefined) return (v.arrayValue.values || []).map(parseFirestoreValue);
  if (v.mapValue !== undefined) return parseFirestoreDoc(v.mapValue);
  if (v.nullValue !== undefined) return null;
  return null;
}

function toFirestoreFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    fields[k] = toFirestoreValue(v);
  }
  return fields;
}

function toFirestoreValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "string") return { stringValue: v };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: v } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFirestoreValue) } };
  if (typeof v === "object") return { mapValue: { fields: toFirestoreFields(v) } };
  return { stringValue: String(v) };
}

// ============================================================
// LOCAL STORAGE HELPERS
// ============================================================

function ls(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}

function lsSet(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }

// ============================================================
// FLAME HELPER
// ============================================================

// ============================================================
// FLAME — يحسب يوم كل 24 ساعة من منتصف الليل
//         يُفقد بعد 48 ساعة من عدم الفتح
// ============================================================

function getMidnightKey() {
  const d = new Date();
  // key = YYYY-MM-DD (وقت محلي)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function calcFlame() {
  const now = Date.now();
  const saved = ls("sawaed_flame_data", null);
  const todayKey = getMidnightKey();

  if (!saved) {
    const data = { streak: 1, lastKey: todayKey, lastOpenMs: now };
    lsSet("sawaed_flame_data", data);
    return data;
  }

  const msSinceLast = now - (saved.lastOpenMs || 0);
  const hoursSinceLast = msSinceLast / (1000 * 60 * 60);

  // إذا فتح نفس اليوم → لا يزيد
  if (saved.lastKey === todayKey) {
    const updated = { ...saved, lastOpenMs: now };
    lsSet("sawaed_flame_data", updated);
    return updated;
  }

  // إذا مضى أكثر من 48 ساعة → تصفير
  if (hoursSinceLast >= 48) {
    const data = { streak: 1, lastKey: todayKey, lastOpenMs: now };
    lsSet("sawaed_flame_data", data);
    return data;
  }

  // يوم جديد بدون تصفير → زيادة
  const data = { streak: (saved.streak || 1) + 1, lastKey: todayKey, lastOpenMs: now };
  lsSet("sawaed_flame_data", data);
  return data;
}

function initFlame() {
  const saved = ls("sawaed_flame_data", null);
  if (!saved) {
    const data = { streak: 1, lastKey: getMidnightKey(), lastOpenMs: Date.now() };
    lsSet("sawaed_flame_data", data);
    return 1;
  }
  // تحقق من الـ 48 ساعة عند فتح التطبيق
  const msSinceLast = Date.now() - (saved.lastOpenMs || 0);
  if (msSinceLast >= 48 * 60 * 60 * 1000) {
    const data = { streak: 1, lastKey: getMidnightKey(), lastOpenMs: Date.now() };
    lsSet("sawaed_flame_data", data);
    return 1;
  }
  return saved.streak || 1;
}

// ============================================================
// DEFAULT CONFIGURATION
// ============================================================

const DEFAULT_CONFIG = {
  splashEnabled: true,
  splashTitle: "سَـواعِـدُ الخَـيْـر",
  splashSubtitle: "منكم و إليكم",
  splashQuote: "من سلك طريقًا يلتمس فيه علمًا، سهل الله له به طريقًا إلى الجنة.",
  splashQuoteSource: "رواه صحيح مسلم",
  extraFields: [],
  grades: ["حادي عشر", "ثاني عشر (توجيهي)"],
  branches: ["علمي", "أدبي"],
  subjects: {
    "حادي عشر_علمي": ["اللغة العربية", "اللغة الإنجليزية", "الرياضيات", "التربية الإسلامية", "التكنولوجيا", "الفيزياء", "الكيمياء", "الأحياء"],
    "حادي عشر_أدبي": ["اللغة العربية", "اللغة الإنجليزية", "الرياضيات", "التربية الإسلامية", "التكنولوجيا", "الدراسات الجغرافية", "الدراسات التاريخية", "الثقافة العلمية"],
    "ثاني عشر (توجيهي)_علمي": ["اللغة العربية", "اللغة الإنجليزية", "الرياضيات", "التربية الإسلامية", "التكنولوجيا", "الفيزياء", "الكيمياء", "الأحياء"],
    "ثاني عشر (توجيهي)_أدبي": ["اللغة العربية", "اللغة الإنجليزية", "الرياضيات", "التربية الإسلامية", "التكنولوجيا", "الدراسات الجغرافية", "الدراسات التاريخية", "الثقافة العلمية"],
  },
  subjectIcons: {
    "اللغة العربية": "📖",
    "اللغة الإنجليزية": "🌍",
    "الرياضيات": "🔢",
    "التربية الإسلامية": "🕌",
    "التكنولوجيا": "💻",
    "الفيزياء": "⚛️",
    "الكيمياء": "🧪",
    "الأحياء": "🧬",
    "الدراسات الجغرافية": "🗺️",
    "الدراسات التاريخية": "📜",
    "الثقافة العلمية": "🔬"
  },
  folderStructure: {},
  subjectSections: ["الرزم", "الكتب", "حلول الكتب", "مواد تعليمية", "ملخصات", "أسئلة واختبارات سابقة", "اختبارات إلكترونية", "عروض تقديمية", "الدراسة للامتحانات", "قنوات يوتيوب شارحة"],
  foundationSubjects: ["لغة عربية", "لغة إنجليزية", "رياضيات", "فيزياء", "كيمياء", "أحياء"],
  foundationBranches: {
    "لغة عربية": ["علمي", "أدبي"],
    "لغة إنجليزية": ["علمي", "أدبي"],
    "رياضيات": ["علمي", "أدبي"],
    "فيزياء": [],
    "كيمياء": [],
    "أحياء": []
  },
  foundationTypes: {
    electronic: ["مباشر", "دروس مسجلة"],
    inPerson: ["غزة", "دير البلح", "النصيرات", "البريج", "المغازي", "خانيونس البلد", "المواصي"]
  },
  navPages: [
    { id: "home", label: "الرئيسية", icon: "🏠" },
    { id: "foundation", label: "التأسيس", icon: "📚" },
    { id: "news", label: "الأخبار", icon: "📰" },
    { id: "saved", label: "المحفوظات", icon: "⭐" },
    { id: "settings", label: "الإعدادات", icon: "⚙️" },
  ],
  savedCategories: ["مميز بنجمة"],
  savedTypes: ["ملف من المواد", "روابط من أي مكان", "خبر من الأخبار", "ملفات من التأسيس"],
  contactLinks: [{ label: "تواصل معنا عبر واتساب", url: "https://whatsapp.com/channel/0029VbCYtmCKwqSKQllr5w3p", icon: "💬" }],
  adminPassword: "2027",
  // ============================================================
  // حسابات المحررين الافتراضية (يمكن للمحرر "admin" فقط إضافة/حذف محررين)
  // ============================================================
  editors: [
    { username: "محرر سواعد الخير 1", password: "34778", role: "all" },
    { username: "Nadosh The Top", password: "hello its me", role: "admin" },
    { username: "محرر سواعد الخير ملازم 2", password: "732663", role: "notes" },
    { username: "محرر سواعد الخير تأسيس 3", password: "84473", role: "foundation" },
    { username: "محرر سواعد الخير تنسيق 4", password: "368784", role: "content" },
  ],
};

// ============================================================
// THEME COLORS
// ============================================================

const LIGHT = {
  bg: "linear-gradient(160deg,#c8d8f0 0%,#dcd6f7 40%,#b8cfe8 70%,#e8e0f5 100%)",
  card: "rgba(255,255,255,0.6)",
  cardBorder: "rgba(255,255,255,0.85)",
  text: "#1a1a3e", subtext: "#4a4a7a",
  accent: "#5B52D4", accent2: "#8B82E8",
  navBg: "rgba(255,255,255,0.8)",
  inputBg: "rgba(255,255,255,0.75)",
  shadow: "0 8px 32px rgba(91,82,212,0.15)",
  sectionBg: "rgba(255,255,255,0.4)",
  danger: "#e55353",
};

const DARK = {
  bg: "linear-gradient(160deg,#0d1333 0%,#1a1040 40%,#0e1a3a 70%,#15103a 100%)",
  card: "rgba(255,255,255,0.08)",
  cardBorder: "rgba(255,255,255,0.15)",
  text: "#e8e8ff", subtext: "#9898cc",
  accent: "#7C73F5", accent2: "#a89af5",
  navBg: "rgba(15,10,40,0.9)",
  inputBg: "rgba(255,255,255,0.1)",
  shadow: "0 8px 32px rgba(0,0,0,0.4)",
  sectionBg: "rgba(255,255,255,0.05)",
  danger: "#ff6b6b",
};

const EMOJI = { "اللغة العربية": "📖", "اللغة الإنجليزية": "🌐", "الرياضيات": "📐", "التربية الإسلامية": "☪️", "التكنولوجيا": "💻", "الفيزياء": "⚛️", "الكيمياء": "🧪", "الأحياء": "🌿", "الدراسات الجغرافية": "🗺️", "الدراسات التاريخية": "🏛️", "الثقافة العلمية": "🔬", "لغة عربية": "📖", "لغة إنجليزية": "🌐", "فيزياء": "⚛️", "كيمياء": "🧪", "أحياء": "🌿" };

const SEC_EMOJI = { "الرزم": "📦", "الكتب": "📚", "حلول الكتب": "✅", "مواد تعليمية": "🎬", "ملخصات": "📝", "أسئلة واختبارات سابقة": "❓", "اختبارات إلكترونية": "💡", "عروض تقديمية": "📊", "الدراسة للامتحانات": "📅", "قنوات يوتيوب شارحة": "▶️" };

// ============================================================
// MAIN APP COMPONENT
// ============================================================

export default function App() {
  const [config, setConfig] = useState(() => ls("sawaed_config", DEFAULT_CONFIG));
  const [darkMode, setDarkMode] = useState(() => ls("sawaed_dark", false));
  const [page, setPage] = useState("loading");
  const [currentUser, setCurrentUser] = useState(() => ls("sawaed_user", null));
  const [activePage, setActivePage] = useState("home");
  const [quoteIdx, setQuoteIdx] = useState(0);
  const [flame, setFlame] = useState(() => initFlame());
  const [subjectNav, setSubjectNav] = useState(null);
  const [folderNav, setFolderNav] = useState(null);
  const [foundNav, setFoundNav] = useState(null);
  const [newsDetail, setNewsDetail] = useState(null);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isEditorSession, setIsEditorSession] = useState(false);

  const T = darkMode ? DARK : LIGHT;

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

    if (!config.editors || config.editors.length === 0) {
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
    const on = () => setIsOffline(false);
    const off = () => setIsOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
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
    if (page === "admin") { setIsEditorSession(false); setPage(currentUser ? "main" : "register"); popNav(); return; }
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

  useEffect(() => {
    if (!configLoaded) return;
    if (currentUser) {
      const { streak } = calcFlame();
      setFlame(streak);
      setPage("main");
    } else if (!config.splashEnabled) setPage("register");
    else setPage("splash");
  }, [configLoaded]);

  useEffect(() => {
    if (config.motivationalFixed || !config.motivationalQuotes?.length) return;
    const mins = config.motivationalQuotes[quoteIdx]?.duration || 60;
    const t = setTimeout(() => setQuoteIdx(i => (i + 1) % config.motivationalQuotes.length), mins * 60 * 1000);
    return () => clearTimeout(t);
  }, [quoteIdx, config]);

  const saveConfig = async (newCfg) => {
    setConfig(newCfg);
    lsSet("sawaed_config", newCfg);
    const flat = {};
    for (const [k, v] of Object.entries(newCfg)) {
      flat[k] = typeof v === "object" ? JSON.stringify(v) : v;
    }
    await fbSet("app_config", "main", flat);
  };

  const login = (user) => {
    setCurrentUser(user);
    lsSet("sawaed_user", user);
    const { streak } = calcFlame();
    setFlame(streak);
    setPage("main");
  };

  const logout = () => {
    setCurrentUser(null);
    lsSet("sawaed_user", null);
    setIsEditorSession(false);
    setPage("splash");
  };

  const updateUser = async (data) => {
    const updated = { ...currentUser, ...data };
    setCurrentUser(updated);
    lsSet("sawaed_user", updated);
    await fbSet("users", updated.id || updated.username, updated);
  };

  const openSubject = (data) => { pushNav("subject"); setSubjectNav(data); };
  const openFolder = (data) => { pushNav("folder"); setFolderNav(data); };
  const openFound = (data) => { pushNav("found"); setFoundNav(data); };
  const openNews = (data) => { pushNav("news"); setNewsDetail(data); };
  const [editorRole, setEditorRole] = useState(null);
  const [editorPermissions, setEditorPermissions] = useState(null);
  const [editorUsername, setEditorUsername] = useState(null);
  const [showTimerModal, setShowTimerModal] = useState(false);
  const openAdmin = (role, permissions, uname) => { pushNav("admin"); setIsEditorSession(true); setEditorRole(role || "all"); setEditorPermissions(permissions || null); setEditorUsername(uname || null); setPage("admin"); };

  const quote = config.motivationalFixed ? config.motivationalQuotes?.[0] : config.motivationalQuotes?.[quoteIdx];

  if (page === "loading") return <LoadingScreen T={T} />;
  if (page === "splash") return <SplashPage config={config} T={T} onNext={() => setPage("register")} />;
  if (page === "register") return <RegisterPage config={config} T={T} darkMode={darkMode} onLogin={login} onAdmin={openAdmin} />;
  if (page === "admin") return <AdminPanel config={config} saveConfig={saveConfig} T={T} darkMode={darkMode} editorRole={editorRole} editorPermissions={editorPermissions} onBack={() => { setIsEditorSession(false); setPage(currentUser ? "main" : "register"); popNav(); }} />;
  if (folderNav) return <FolderPage config={config} saveConfig={saveConfig} T={T} darkMode={darkMode} currentUser={currentUser} updateUser={updateUser} data={folderNav} onBack={() => { setFolderNav(null); popNav(); }} isEditorSession={isEditorSession} editorRole={editorRole} editorPermissions={editorPermissions} />;
  if (subjectNav) return <SubjectPage config={config} saveConfig={saveConfig} T={T} darkMode={darkMode} currentUser={currentUser} updateUser={updateUser} subject={subjectNav} onBack={() => { setSubjectNav(null); popNav(); }} isEditorSession={isEditorSession} editorRole={editorRole} onOpenFolder={openFolder} />;
  if (foundNav) return <FoundationSubjectPage config={config} saveConfig={saveConfig} T={T} darkMode={darkMode} data={foundNav} onBack={() => { setFoundNav(null); popNav(); }} />;
  if (newsDetail) return <NewsDetailPage T={T} news={newsDetail} currentUser={currentUser} updateUser={updateUser} onBack={() => { setNewsDetail(null); popNav(); }} />;

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: "'Cairo',sans-serif", direction: "rtl", paddingBottom: "80px" }}>
      <div style={{ maxWidth: APP_MAX_WIDTH, margin: "0 auto", width: "100%" }}>
      {/* ─── Mini Timer يشتغل في الخلفية طول وقت استخدام التطبيق ─── */}
      <TimerMiniWidget T={T} onOpen={() => setShowTimerModal(true)} />
      {showTimerModal && <StudyTimer T={T} onClose={() => setShowTimerModal(false)} />}

      {isOffline && (
        <div style={{ background: "#f0a500", color: "#fff", padding: "8px 16px", textAlign: "center", fontSize: "13px", fontWeight: "700" }}>
          📶 أنت غير متصل بالإنترنت — المحتوى المحفوظ متاح بدون إنترنت
        </div>
      )}
      {quote && (
        <div style={{ background: darkMode ? "rgba(124,115,245,0.12)" : "rgba(91,82,212,0.07)", borderBottom: `1px solid ${T.cardBorder}`, padding: "9px 16px", textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: "12px", color: T.accent, fontStyle: "italic" }}>✨ {quote.text}</p>
        </div>
      )}
      {activePage === "home" && <HomePage config={config} T={T} darkMode={darkMode} currentUser={currentUser} flame={flame} onSubject={openSubject} />}
      {activePage === "foundation" && <FoundationPage config={config} T={T} onSubject={openFound} />}
      {activePage === "news" && <NewsPage config={config} saveConfig={saveConfig} T={T} currentUser={currentUser} updateUser={updateUser} onDetail={openNews} />}
      {activePage === "saved" && <SavedPage config={config} T={T} currentUser={currentUser} updateUser={updateUser} />}
      {activePage === "settings" && <SettingsPage config={config} T={T} darkMode={darkMode} setDarkMode={v => { setDarkMode(v); lsSet("sawaed_dark", v); }} currentUser={currentUser} updateUser={updateUser} logout={logout} onAdmin={openAdmin} onOpenTimer={() => setShowTimerModal(true)} />}
      {!["home", "foundation", "news", "saved", "settings"].includes(activePage) && <CustomPage page={config.navPages?.find(p => p.id === activePage)} T={T} />}
      </div>
      <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, maxWidth: APP_MAX_WIDTH, margin: "0 auto", background: T.navBg, backdropFilter: "blur(20px)", borderTop: `1px solid ${T.cardBorder}`, display: "flex", padding: "6px 0 10px", zIndex: 100 }}> 
        {config.navPages?.map(p => ( 
         <button key={p.id} onClick={() => setActivePage(p.id)} style={{ flex: 1, background: "transparent", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", padding: "4px 0" }}> 
          <span style={{ fontSize: "22px", opacity: activePage === p.id ? 1 : 0.5 }}>{p.icon}</span> 
          <span style={{ fontSize: "10px", color: activePage === p.id ? T.accent : T.subtext, fontWeight: activePage === p.id ? "700" : "400", fontFamily: "'Cairo',sans-serif" }}>{p.label}</span> 
          {activePage === p.id && <div style={{ width: "4px", height: "4px", borderRadius: "50%", background: T.accent }} />} 
        </button> 
       ))} 
     </nav>

    </div>
  );
}

function LoadingScreen({ T }) {
  return (
    <div style={{ minHeight: "100vh", maxWidth: APP_MAX_WIDTH, margin: "0 auto", background: T.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Cairo',sans-serif" }}>
      <div style={{ fontSize: "48px", marginBottom: "16px", animation: "pulse 1.5s infinite" }}>🌟</div>
      <p style={{ color: T.accent, fontSize: "16px" }}>جاري التحميل...</p>
      <style>{`@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.1)}}`}</style>
    </div>
  );
}

function SplashPage({ config, T, onNext }) {
  return (
    <div style={{ minHeight: "100vh", maxWidth: APP_MAX_WIDTH, margin: "0 auto", background: T.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", padding: "120px 24px 40px", direction: "rtl", fontFamily: "'Cairo',sans-serif" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "60px", marginBottom: "50px" }}>🌟</div>
        <h1 style={{ fontSize: "34px", fontWeight: "900", color: T.accent, margin: "0 0 6px", letterSpacing: "1px" }}>{config.splashTitle}</h1>
        <p style={{ fontSize: "16px", color: T.subtext, margin: 0 }}>{config.splashSubtitle}</p>
      </div>
      <button onClick={onNext} style={{ background: `linear-gradient(135deg,${T.accent},${T.accent2})`, color: "#fff", border: "none", borderRadius: "20px", padding: "18px 70px", fontSize: "18px", fontWeight: "700", cursor: "pointer", boxShadow: T.shadow, fontFamily: "'Cairo',sans-serif" }}>
        ابدأ →
      </button>
      <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: "18px", padding: "18px 20px", maxWidth: "320px", textAlign: "center", backdropFilter: "blur(12px)" }}>
        <p style={{ fontSize: "14px", color: T.text, margin: "0 0 6px", lineHeight: "1.8", fontStyle: "italic" }}>"{config.splashQuote}"</p>
        <p style={{ fontSize: "12px", color: T.subtext, margin: 0 }}>--- {config.splashQuoteSource}</p>
      </div>
    </div>
  );
}

// ============================================================
// REGISTER PAGE
// ============================================================

// ============================================================
// REGISTER PAGE — تسجيل بالإيميل + كلمة سر
// أول مرة: يختار كلمة سر → تُحفظ مع حسابه
// المرات التالية: يدخل إيميل + كلمة السر فقط
// ============================================================

// hash كلمة السر
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + "sawaed_salt_2024");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("").substring(0, 32);
}

// قاعدة اسم المستخدم: حروف إنجليزية وأرقام و _ و . فقط، بدون مسافات أو رموز أخرى (لحسابات الطلاب الجديدة)
const USERNAME_REGEX = /^[A-Za-z0-9_.]+$/;

// تطبيع اسم المستخدم للمقارنة: يزيل محارف الاتجاه الخفية (RTL/LTR marks) ومسافات Unicode
// غير القياسية التي قد تُلصق عند النسخ من ملفات Word/PDF، ويوحّد حالة الأحرف والمسافات
// هذا يمنع مشكلة عدم التعرف على حسابات المحررين بسبب اختلافات غير مرئية في النص
function normalizeUsername(s) {
  if (!s) return "";
  return s
    .normalize("NFKC")
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g, "") // إزالة المحارف الخفية/اتجاه النص
    .replace(/[\s\u00A0]+/g, " ") // توحيد كل أنواع المسافات إلى مسافة عادية واحدة
    .trim()
    .toLowerCase();
}

// تحقق من محرر — يستخدم المقارنة المطبّعة لضمان تسجيل الدخول الصحيح دائماً
function findEditor(config, username, password) {
  const editors = config.editors || [];
  const uname = normalizeUsername(username);
  return editors.find(e => normalizeUsername(e.username) === uname && e.password === password) || null;
}

function isEditorUsername(config, username) {
  const uname = normalizeUsername(username);
  return (config.editors || []).some(e => normalizeUsername(e.username) === uname);
}

function RegisterPage({ config, T, darkMode, onLogin, onAdmin }) {
  const savedLogin = ls("sawaed_saved_login", null);
  const [username, setUsername] = useState(savedLogin?.username || "");
  const [nickname, setNickname] = useState(savedLogin?.nickname || "");
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [grade, setGrade]       = useState(savedLogin?.grade || "");
  const [branch, setBranch]     = useState(savedLogin?.branch || "");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPw, setShowPw]     = useState(false);
  const [mode, setMode]         = useState("start"); // start|login|register|grade|editor_pw
  const [existingUser, setExistingUser] = useState(null);
  const [editorPw, setEditorPw] = useState("");
  const [err, setErr]           = useState("");
  const [loading, setLoading]   = useState(false);
  const [checking, setChecking] = useState(false);

  const inp = { background: T.inputBg, border: `1.5px solid ${T.cardBorder}`, borderRadius: "14px", padding: "14px 16px", fontSize: "16px", color: T.text, width: "100%", outline: "none", fontFamily: "'Cairo',sans-serif", direction: "rtl", boxSizing: "border-box" };

  const pwRow = (val, setVal, ph, show, setShow) => (
    <div style={{ position: "relative" }}>
      <input value={val} onChange={e => { setVal(e.target.value); setErr(""); }} type={show ? "text" : "password"} placeholder={ph} style={inp} />
      <button onClick={() => setShow(v => !v)} style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: "18px", color: T.subtext }}>{show ? "🙈" : "👁️"}</button>
    </div>
  );

  const checkUsername = async () => {
    const uname = username.trim();
    if (!uname) { setErr("أدخل اسم المستخدم"); return; }
    if (isEditorUsername(config, uname)) { setMode("editor_pw"); setErr(""); return; }
    setChecking(true); setErr("");
    const userId = uname.replace(/\s+/g, "_").toLowerCase();
    const existing = await fbGet("users", userId);
    setChecking(false);
    if (existing?.passwordHash) { setExistingUser(existing); setMode("login"); }
    else { setExistingUser(null); setMode("register"); }
  };

  const handleEditorLogin = () => {
    const editor = findEditor(config, username, editorPw);
    if (!editor) { setErr("كلمة السر غير صحيحة"); return; }
    lsSet("sawaed_editor_session", { username: editor.username, role: editor.role });
    onAdmin(editor.role, editor.permissions || null, editor.username);
  };

  const handleLogin = async () => {
    if (!password) { setErr("أدخل كلمة السر"); return; }
    setLoading(true); setErr("");
    const hashed = await hashPassword(password);
    if (hashed !== existingUser.passwordHash) { setLoading(false); setErr("كلمة السر غير صحيحة"); return; }
    if (rememberMe) lsSet("sawaed_saved_login", { username: existingUser.username, nickname: existingUser.nickname, grade: existingUser.grade, branch: existingUser.branch });
    else lsSet("sawaed_saved_login", null);
    setLoading(false);
    onLogin(existingUser);
  };

  const handleRegisterNext = async () => {
    const uname = username.trim();
    if (uname.length < 3) { setErr("اسم المستخدم قصير (3 أحرف+)"); return; }
    if (!USERNAME_REGEX.test(uname)) { setErr("اسم المستخدم يجب أن يحتوي فقط على حروف إنجليزية وأرقام و _ و . بدون مسافات أو رموز"); return; }
    if (!password || password.length < 6) { setErr("كلمة السر قصيرة (6 أحرف+)"); return; }
    if (password !== confirmPw) { setErr("كلمتا السر غير متطابقتين"); return; }
    setLoading(true); setErr("");
    const userId = uname.replace(/\s+/g, "_").toLowerCase();
    const existing = await fbGet("users", userId);
    if (existing?.passwordHash) { setLoading(false); setErr("اسم المستخدم مأخوذ، اختر غيره"); return; }
    setLoading(false); setMode("grade");
  };

  const handleRegisterFinish = async () => {
    if (!grade || !branch) { setErr("اختر الصف والفرع"); return; }
    setLoading(true); setErr("");
    const uname = username.trim();
    const userId = uname.replace(/\s+/g, "_").toLowerCase();
    const hashed = await hashPassword(password);
    const userData = { id: userId, username: uname, nickname: nickname.trim() || uname, grade, branch, progress: {}, savedItems: [], pinnedNews: [], joinedAt: new Date().toISOString(), passwordHash: hashed };
    await fbSet("users", userId, userData);
    if (rememberMe) lsSet("sawaed_saved_login", { username: uname, nickname: userData.nickname, grade, branch });
    else lsSet("sawaed_saved_login", null);
    setLoading(false);
    onLogin(userData);
  };

  const errBox = err ? <div style={{ background: `${T.danger}15`, border: `1px solid ${T.danger}44`, borderRadius: "10px", padding: "10px 14px", marginBottom: "12px" }}><p style={{ color: T.danger, fontSize: "13px", margin: 0 }}>{err}</p></div> : null;

  return (
    <div style={{ minHeight: "100vh", maxWidth: APP_MAX_WIDTH, margin: "0 auto", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", direction: "rtl", fontFamily: "'Cairo',sans-serif" }}>
      <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: "24px", padding: "32px 24px", width: "100%", maxWidth: "360px", backdropFilter: "blur(16px)" }}>
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <div style={{ fontSize: "48px" }}>🌟</div>
          <h2 style={{ color: T.accent, margin: "8px 0 0", fontSize: "22px", fontWeight: "800" }}>سواعد الخير</h2>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: T.subtext }}>
            {mode === "start" ? "أهلاً بك!" : mode === "login" ? `مرحباً ${existingUser?.nickname || username} 👋` : mode === "register" ? "إنشاء حساب جديد" : mode === "grade" ? "اختر صفك وفرعك" : "دخول المحرر 🛡️"}
          </p>
        </div>
        {errBox}

        {mode === "start" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <input value={username} onChange={e => { setUsername(e.target.value); setErr(""); }} placeholder="اسم المستخدم" style={inp} onKeyDown={e => e.key === "Enter" && checkUsername()} />
            <button onClick={checkUsername} disabled={checking || !username.trim()} style={{ background: username.trim() ? `linear-gradient(135deg,${T.accent},${T.accent2})` : "#ccc", color: "#fff", border: "none", borderRadius: "14px", padding: "14px", fontSize: "16px", fontWeight: "700", cursor: username.trim() ? "pointer" : "not-allowed", fontFamily: "'Cairo',sans-serif" }}>
              {checking ? "⏳ جاري التحقق..." : "التالي →"}
            </button>
          </div>
        )}

        {mode === "editor_pw" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ background: `${T.accent}15`, borderRadius: "12px", padding: "10px 14px", textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: "13px", color: T.accent, fontWeight: "700" }}>🛡️ {username}</p>
            </div>
            {pwRow(editorPw, setEditorPw, "كلمة سر المحرر", showPw, setShowPw)}
            <button onClick={handleEditorLogin} style={{ background: `linear-gradient(135deg,${T.accent},${T.accent2})`, color: "#fff", border: "none", borderRadius: "14px", padding: "14px", fontSize: "16px", fontWeight: "700", cursor: "pointer", fontFamily: "'Cairo',sans-serif" }}>🚀 دخول</button>
            <button onClick={() => { setMode("start"); setEditorPw(""); setErr(""); }} style={{ background: "transparent", border: "none", color: T.subtext, fontSize: "13px", cursor: "pointer", fontFamily: "'Cairo',sans-serif" }}>← رجوع</button>
          </div>
        )}

        {mode === "login" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ background: `${T.accent}15`, borderRadius: "12px", padding: "10px 14px", textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: "13px", color: T.accent, fontWeight: "700" }}>👤 {existingUser?.nickname || username}</p>
            </div>
            {pwRow(password, setPassword, "كلمة السر", showPw, setShowPw)}
            <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
              <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} style={{ accentColor: T.accent, width: "16px", height: "16px" }} />
              <span style={{ fontSize: "13px", color: T.subtext }}>تذكرني على هذا الجهاز</span>
            </label>
            <button onClick={handleLogin} disabled={loading} style={{ background: loading ? "#ccc" : `linear-gradient(135deg,${T.accent},${T.accent2})`, color: "#fff", border: "none", borderRadius: "14px", padding: "14px", fontSize: "16px", fontWeight: "700", cursor: loading ? "not-allowed" : "pointer", fontFamily: "'Cairo',sans-serif" }}>
              {loading ? "⏳ جاري..." : "🚀 دخول"}
            </button>
            <button onClick={() => { setMode("start"); setPassword(""); setErr(""); }} style={{ background: "transparent", border: "none", color: T.subtext, fontSize: "12px", cursor: "pointer", fontFamily: "'Cairo',sans-serif" }}>← تغيير اسم المستخدم</button>
          </div>
        )}

        {mode === "register" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ background: "#23863615", borderRadius: "12px", padding: "8px 14px", textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: "12px", color: "#238636" }}>✨ حساب جديد — {username}</p>
            </div>
            <input value={nickname} onChange={e => { setNickname(e.target.value); setErr(""); }} placeholder="لقبك (يظهر في الموقع — اختياري)" style={inp} />
            {pwRow(password, setPassword, "كلمة سر (6 أحرف+)", showPw, setShowPw)}
            <input value={confirmPw} onChange={e => { setConfirmPw(e.target.value); setErr(""); }} onPaste={e => { e.preventDefault(); setErr("لصق كلمة السر غير مسموح — يجب كتابتها يدوياً"); }} onCopy={e => e.preventDefault()} type="password" placeholder="تأكيد كلمة السر" style={{ ...inp, borderColor: confirmPw && confirmPw !== password ? T.danger : T.cardBorder }} />
            <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
              <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} style={{ accentColor: T.accent, width: "16px", height: "16px" }} />
              <span style={{ fontSize: "13px", color: T.subtext }}>تذكرني على هذا الجهاز</span>
            </label>
            <button onClick={handleRegisterNext} disabled={loading} style={{ background: `linear-gradient(135deg,${T.accent},${T.accent2})`, color: "#fff", border: "none", borderRadius: "14px", padding: "14px", fontSize: "16px", fontWeight: "700", cursor: "pointer", fontFamily: "'Cairo',sans-serif" }}>
              {loading ? "⏳..." : "التالي → اختيار الصف"}
            </button>
            <button onClick={() => { setMode("start"); setPassword(""); setConfirmPw(""); setErr(""); }} style={{ background: "transparent", border: "none", color: T.subtext, fontSize: "12px", cursor: "pointer", fontFamily: "'Cairo',sans-serif" }}>← تغيير اسم المستخدم</button>
          </div>
        )}

        {mode === "grade" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <p style={{ color: T.text, fontSize: "15px", margin: 0, fontWeight: "700" }}>اختر صفك:</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {config.grades?.map(g => <button key={g} onClick={() => setGrade(g)} style={{ background: grade === g ? `linear-gradient(135deg,${T.accent},${T.accent2})` : T.inputBg, color: grade === g ? "#fff" : T.text, border: `1.5px solid ${grade === g ? T.accent : T.cardBorder}`, borderRadius: "12px", padding: "10px 16px", fontSize: "13px", cursor: "pointer", fontFamily: "'Cairo',sans-serif", flex: 1, minWidth: "130px" }}>{g}</button>)}
            </div>
            <p style={{ color: T.text, fontSize: "15px", margin: "4px 0 0", fontWeight: "700" }}>اختر فرعك:</p>
            <div style={{ display: "flex", gap: "8px" }}>
              {config.branches?.map(b => <button key={b} onClick={() => setBranch(b)} style={{ background: branch === b ? `linear-gradient(135deg,${T.accent},${T.accent2})` : T.inputBg, color: branch === b ? "#fff" : T.text, border: `1.5px solid ${branch === b ? T.accent : T.cardBorder}`, borderRadius: "12px", padding: "10px 16px", fontSize: "14px", cursor: "pointer", fontFamily: "'Cairo',sans-serif", flex: 1 }}>{b}</button>)}
            </div>
            <button onClick={handleRegisterFinish} disabled={!grade || !branch || loading} style={{ marginTop: "4px" }}>
              {loading ? "...جاري" : existingUser ? " تسجيل الدخول " : " إنشاء الحساب "}
            </button>

            <button onClick={() => setMode("register")} style={{ background: "transparent", border: "none", color: T.subtext, cursor: "pointer", fontSize: "13px", fontFamily: "'Cairo',sans-serif" }}>← رجوع</button>
          </div>
        )}
      </div>
    </div>
  );
}


function HomePage({ config, T, darkMode, currentUser, flame, onSubject }) {
  const key = `${currentUser.grade}_${currentUser.branch}`;
  const subjects = config.subjects?.[key] || [];

  const getProgress = (sub) => {
  const lessonKey = `lessons_${key}_${sub}`;
  let lessons = [];
  try {
    const raw = config[lessonKey];
    if (raw) {
      if (typeof raw === "string") {
        lessons = JSON.parse(raw);
      } else if (Array.isArray(raw)) {
        lessons = raw;
      }
    }
  } catch (e) {
    console.warn(`فشل في تحليل الدروس لـ ${sub}:`, e);
    lessons = [];
  }
  
  const done = (currentUser.progress?.[`${key}_${sub}`] || []).length;
  const total = lessons.length;
  
  // حساب النسبة المئوية هنا بدقة
  const pct = total ? Math.round((done / total) * 100) : 0;

  // 👇 شرط إطلاق المفرقعات الاحتفالية عند وصول الإنجاز إلى 100%
  if (pct === 100 && total > 0) {
    confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    setTimeout(() => {
      confetti({ particleCount: 50, angle: 60, spread: 55, origin: { x: 0 } });
      confetti({ particleCount: 50, angle: 120, spread: 55, origin: { x: 1 } });
    }, 250);
  }

  return { pct, done, total };
};

  return (
    <div style={{ padding: "20px 16px" }}>
      <style>{`
        @keyframes flameFlicker {
          0%,100%{transform:scaleY(1) scaleX(1);}
          25%{transform:scaleY(1.08) scaleX(0.95);}
          50%{transform:scaleY(0.95) scaleX(1.05);}
          75%{transform:scaleY(1.05) scaleX(0.97);}
        }
        .flame-icon{animation:flameFlicker 0.8s ease-in-out infinite;display:inline-block;transform-origin:bottom center;}
      `}</style>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "800", color: T.text }}>مرحباً، {currentUser.nickname || currentUser.username} 👋</h2>
          <p style={{ margin: "2px 0 0", fontSize: "13px", color: T.subtext }}>{currentUser.grade} — {currentUser.branch}</p>
        </div>
        <div style={{ background: darkMode ? "rgba(255,120,0,0.18)" : "rgba(255,100,0,0.1)", borderRadius: "20px", padding: "10px 16px", textAlign: "center", border: `2px solid ${flame >= 3 ? "rgba(255,120,0,0.5)" : "rgba(200,200,200,0.3)"}`, display: "flex", alignItems: "center", gap: "6px", cursor: "default" }}>
          <span className="flame-icon" style={{ fontSize: "26px", filter: flame >= 3 ? "drop-shadow(0 0 6px #ff6600)" : "none" }}>
            {flame >= 3 ? "🔥" : flame >= 1 ? "🔥" : "✨"}
          </span>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "18px", fontWeight: "900", color: flame >= 3 ? (darkMode ? "#ff9800" : "#e65100") : T.subtext, lineHeight: 1 }}>{flame}</div>
            <div style={{ fontSize: "10px", color: T.subtext, fontWeight: "600" }}>يوم</div>
          </div>
        </div>
      </div>
      <h3 style={{ margin: "0 0 14px", fontSize: "16px", fontWeight: "800", color: T.text }}>📚 موادك الدراسية</h3>
      {subjects.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 20px", background: T.card, borderRadius: "20px", border: `1px solid ${T.cardBorder}` }}>
          <span style={{ fontSize: "40px" }}>📅</span>
          <p style={{ margin: "10px 0 0", color: T.subtext, fontSize: "14px" }}>لم يتم إضافة مواد لصفك بعد.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "14px" }}>
          {subjects.map(sub => {
            const { pct, done, total } = getProgress(sub);
            return (
              <div key={sub} onClick={() => onSubject({ subject: sub, grade: currentUser.grade, branch: currentUser.branch })} style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: "20px", padding: "16px", display: "flex", alignItems: "center", gap: "14px", cursor: "pointer", boxShadow: T.shadow, transition: "transform 0.2s" }}>
                <div style={{ width: "56px", height: "56px", borderRadius: "16px", background: darkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px" }}>
                  {config.subjectIcons?.[sub] || EMOJI[sub] || "📖"}
                </div>
                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: 0, fontSize: "15px", fontWeight: "800", color: T.text }}>{sub}</h4>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "8px", marginBottom: "4px" }}>
                    <span style={{ fontSize: "11px", color: T.subtext }}>{done}/{total} درس مكتمل</span>
                    <span style={{ fontSize: "11px", fontWeight: "800", color: config.progressBarColor || T.accent }}>{pct}%</span>
                  </div>
                  <div style={{ background: darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)", height: "6px", borderRadius: "3px", overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: config.progressBarColor || T.accent, borderRadius: "3px" }} />
                  </div>
                </div>
                <span style={{ color: T.subtext, fontSize: "18px", paddingRight: "4px" }}>‹</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================
// FILE VIEWER - أونلاين طبيعي + أوفلاين من IndexedDB
// ============================================================

function FileViewer({ url, title, T, onClose, isBlobDirect = false, mimeType = "application/pdf" }) {
  const [localUrl, setLocalUrl] = useState(isBlobDirect ? url : null);
  const [loading, setLoading] = useState(!isBlobDirect);
  const [error, setError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavedOffline, setIsSavedOffline] = useState(isBlobDirect);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const fileId = getOfflineFileId(url);

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
          objectUrl = URL.createObjectURL(saved.blob);
          if (!cancelled) {
            setLocalUrl(objectUrl);
            setIsSavedOffline(true);
            setLoading(false);
            return;
          }
        }
      } catch (e) {
        console.error("Error reading from IDB:", e);
      }

      if (!cancelled) {
        if (!navigator.onLine) {
          setError(true);
        } else {
          setLocalUrl(null); // يضمن الفتح أونلاين بشكل طبيعي
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
  // كشف تلقائي إذا كان الرابط من Google Drive → مرّره عبر Cloudflare Worker لتفادي CORS نهائياً
  const isDriveLink = typeof isDriveUrl === "function" && isDriveUrl(url);

  if (isDriveLink) {
    try {
      setIsSaving(true);
      const proxyUrl = driveProxyUrl(url);
      const response = await fetch(proxyUrl, { mode: "cors" }).catch(() => null);
      if (!response || !response.ok) throw new Error("proxy failed");
      const blob = await response.blob();
      if (!blob || blob.size === 0) throw new Error("Empty data");

      await idbSaveFile(fileId, blob, {
        title: title || "ملف محفوظ محلياً",
        url,
        type: mimeType,
        savedAt: Date.now(),
        isFallback: false,
      });

      setIsSavedOffline(true);
      setIsSaving(false);
      alert(
        "✅ تم حفظ الملف بنجاح للوضع الأوفلاين!\n\n" +
        "يمكنك استخدامه بدون إنترنت من زر 'فتح أوفلاين' في القائمة."
      );
    } catch (err) {
      setIsSaving(false);
      const openDownload = window.confirm(
        "📌 تعذّر التحميل التلقائي عبر الخادم الوسيط.\n\n" +
        "هل تريد فتح رابط التحميل المباشر في تبويب جديد؟\n" +
        "(يمكنك تحميل الملف يدوياً من هناك)"
      );
      if (openDownload) {
        const downloadUrl = getDownloadUrl(url);
        window.open(downloadUrl, "_blank");
      }
    }
    return;
  }

  // إذا كان الرابط عادي (ليس من Google Drive)
  try {
    setIsSaving(true);
    const downloadUrl = getDownloadUrl(url);

    const response = await fetch(downloadUrl, { mode: "cors" }).catch(() => null);

    if (!response || !response.ok) {
      throw new Error("CORS blockage");
    }

    const blob = await response.blob();
    if (!blob || blob.size === 0) throw new Error("Empty data");

    await idbSaveFile(fileId, blob, {
      title: title || "ملف محفوظ محلياً",
      url,
      type: mimeType,
      savedAt: Date.now(),
      isFallback: false,
    });

    setIsSavedOffline(true);
    alert(
      "✅ تم حفظ الملف بنجاح للوضع الأوفلاين!\n\n" +
      "يمكنك استخدامه بدون إنترنت من زر 'فتح أوفلاين' في القائمة."
    );
  } catch (err) {
    alert(
      "⚠️ فشل الحفظ الأوفلاين.\n\n" +
      "الرابط يجب أن يدعم التحميل المباشر بدون قيود CORS.\n" +
      "يمكنك فتح الملف وتصفحه بشكل طبيعي أونلاين."
    );
  } finally {
    setIsSaving(false);
  }
};

  const handleDeleteOffline = async () => {
    try {
      await idbDeleteFile(fileId);
      if (localUrl && localUrl.startsWith("blob:")) URL.revokeObjectURL(localUrl);
      setLocalUrl(null);
      setIsSavedOffline(false);
      if (!navigator.onLine) setError(true);
      alert("تم إزالة النسخة المحلية بنجاح.");
    } catch {
      alert("فشل حذف النسخة المحفوظة.");
    }
  };

  const viewUrl = localUrl || getOnlineViewUrl(url);

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000", zIndex: 99999, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 14px", background: "#1a1a1a", flexShrink: 0 }}>
        <button onClick={onClose} style={{ background: "#e55353", color: "#fff", border: "none", borderRadius: "8px", padding: "8px 16px", fontSize: "13px", cursor: "pointer", fontFamily: "'Cairo',sans-serif" }}>إغلاق</button>
        <span style={{ color: "#fff", fontSize: "13px", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>

        {isSavedOffline && <span style={{ background: "#238636", color: "#fff", fontSize: "11px", padding: "4px 10px", borderRadius: "8px" }}>محفوظ محلياً ومتاح أوفلاين ✓</span>}
        {!isOnline && <span style={{ background: "#ff9800", color: "#fff", fontSize: "11px", padding: "4px 10px", borderRadius: "8px" }}>وضع الأوفلاين</span>}

        {isOnline && !loading && !error && (
          isSavedOffline ? (
            <button onClick={handleDeleteOffline} style={{ background: "#6e1a1a", color: "#fff", border: "none", borderRadius: "8px", padding: "7px 12px", fontSize: "12px", cursor: "pointer" }}>حذف الأوفلاين</button>
          ) : (
            <button onClick={handleSaveOffline} disabled={isSaving} style={{ background: isSaving ? "#555" : "linear-gradient(135deg, #5B52D4, #8B82E8)", color: "#fff", border: "none", borderRadius: "8px", padding: "7px 14px", fontSize: "12px", fontWeight: "700", cursor: "pointer" }}>
              {isSaving ? "جاري التنزيل..." : "تحميل للوضع أوفلاين"}
            </button>
          )
        )}
      </div>

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
      ) : (
        <iframe src={viewUrl} title={title || "file-viewer"} style={{ flex: 1, width: "100%", border: "none", background: "#fff" }} sandbox="allow-scripts allow-same-origin allow-popups allow-forms" />
      )}
    </div>
  );
}

// ============================================================
// SUBJECT PAGE
// ============================================================

function SubjectPage({ config, saveConfig, T, darkMode, currentUser, updateUser, subject, onBack, isEditorSession, onOpenFolder }) {
  const { subject: sub, grade, branch } = subject;
  const isGrade11 = grade.includes("حادي عشر");
  const [selectedSemester, setSelectedSemester] = useState(null);

  useEffect(() => {
    const savedSemester = localStorage.getItem(`sawaed_semester_${grade}_${branch}_${sub}`);
    if (savedSemester) {
      setSelectedSemester(savedSemester);
    } else if (isGrade11) {
      setSelectedSemester("فصل أول");
    }
  }, []);

  const handleSemesterChange = (semester) => {
    setSelectedSemester(semester);
    localStorage.setItem(`sawaed_semester_${grade}_${branch}_${sub}`, semester);
  };

  const semesterKey = isGrade11 ? selectedSemester : "فصل واحد";

  const getSubjectKey = () => {
    if (isGrade11 && selectedSemester) {
      return `${grade}_${branch}_${selectedSemester}`;
    } else if (!isGrade11) {
      return `${grade}_${branch}`;
    }
    return null;
  };

  const subjectKey = getSubjectKey();

  const lessonsKey = `lessons_${subjectKey}_${sub}`;
  const lessonsRaw = config[lessonsKey];
  const lessons = lessonsRaw ? (typeof lessonsRaw === "string" ? JSON.parse(lessonsRaw) : lessonsRaw) : [];
  const doneLessons = currentUser?.progress?.[`${subjectKey}_${sub}`] || [];
  const done = doneLessons.length;
  const total = lessons.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const [showLessons, setShowLessons] = useState(false);

  const sections = config.subjectSections || [];

  const toggleLesson = async (l) => {
    const arr = [...doneLessons];
    const idx = arr.indexOf(l);
    if (idx >= 0) arr.splice(idx, 1); else arr.push(l);
    await updateUser({ progress: { ...currentUser.progress, [`${subjectKey}_${sub}`]: arr } });
  };

  if (isGrade11 && !selectedSemester) {
    return (
      <div style={{ minHeight: "100vh", maxWidth: APP_MAX_WIDTH, margin: "0 auto", background: T.bg, fontFamily: "'Cairo',sans-serif", direction: "rtl", padding: "20px" }}>
        <button onClick={onBack} style={{ background: T.accent, color: "#fff", border: "none", borderRadius: "12px", padding: "8px 18px", fontSize: "14px", fontWeight: "700", cursor: "pointer", fontFamily: "'Cairo',sans-serif", marginBottom: "16px" }}>← رجوع</button>
        <h2 style={{ color: T.text, fontSize: "20px", fontWeight: "800", marginBottom: "16px" }}>📚 {sub}</h2>
        <p style={{ color: T.subtext, marginBottom: "20px" }}>اختر الفصل الدراسي:</p>
        <div style={{ display: "flex", gap: "12px" }}>
          <button onClick={() => handleSemesterChange("فصل أول")} style={{ flex: 1, background: T.card, border: `2px solid ${T.accent}`, borderRadius: "16px", padding: "20px", cursor: "pointer", textAlign: "center", backdropFilter: "blur(12px)" }}>
            <div style={{ fontSize: "32px", marginBottom: "8px" }}>📖</div>
            <div style={{ fontSize: "16px", fontWeight: "700", color: T.text }}>الفصل الأول</div>
          </button>
          <button onClick={() => handleSemesterChange("فصل ثان")} style={{ flex: 1, background: T.card, border: `2px solid ${T.accent}`, borderRadius: "16px", padding: "20px", cursor: "pointer", textAlign: "center", backdropFilter: "blur(12px)" }}>
            <div style={{ fontSize: "32px", marginBottom: "8px" }}>📖</div>
            <div style={{ fontSize: "16px", fontWeight: "700", color: T.text }}>الفصل الثاني</div>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", maxWidth: APP_MAX_WIDTH, margin: "0 auto", background: T.bg, fontFamily: "'Cairo',sans-serif", direction: "rtl", paddingBottom: "30px" }}>
      <div style={{ background: T.card, backdropFilter: "blur(16px)", borderBottom: `1px solid ${T.cardBorder}`, padding: "16px" }}>
        <button onClick={onBack} style={{ background: T.accent, color: "#fff", border: "none", borderRadius: "12px", padding: "8px 18px", fontSize: "14px", fontWeight: "700", cursor: "pointer", fontFamily: "'Cairo',sans-serif", marginBottom: "8px" }}>← رجوع</button>
        
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "36px" }}>{config.subjectIcons?.[sub] || EMOJI[sub] || "📌"}</span>
          <div>
            <h2 style={{ margin: 0, color: T.text, fontSize: "20px", fontWeight: "800" }}>{sub}</h2>
            <p style={{ margin: 0, fontSize: "12px", color: T.subtext }}>{grade} --- {branch} {isGrade11 ? `- ${selectedSemester}` : ""}</p>
          </div>
        </div>

        {isGrade11 && (
          <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
            <button onClick={() => handleSemesterChange("فصل أول")} style={{ flex: 1, background: selectedSemester === "فصل أول" ? `linear-gradient(135deg,${T.accent},${T.accent2})` : T.inputBg, color: selectedSemester === "فصل أول" ? "#fff" : T.text, border: `1.5px solid ${selectedSemester === "فصل أول" ? T.accent : T.cardBorder}`, borderRadius: "10px", padding: "8px 12px", fontSize: "13px", fontWeight: selectedSemester === "فصل أول" ? "700" : "400", cursor: "pointer", fontFamily: "'Cairo',sans-serif" }}>
              📖 الفصل الأول
            </button>
            <button onClick={() => handleSemesterChange("فصل ثان")} style={{ flex: 1, background: selectedSemester === "فصل ثان" ? `linear-gradient(135deg,${T.accent},${T.accent2})` : T.inputBg, color: selectedSemester === "فصل ثان" ? "#fff" : T.text, border: `1.5px solid ${selectedSemester === "فصل ثان" ? T.accent : T.cardBorder}`, borderRadius: "10px", padding: "8px 12px", fontSize: "13px", fontWeight: selectedSemester === "فصل ثان" ? "700" : "400", cursor: "pointer", fontFamily: "'Cairo',sans-serif" }}>
              📖 الفصل الثاني
            </button>
          </div>
        )}

        <div onClick={() => setShowLessons(!showLessons)} style={{ marginTop: "14px", background: T.sectionBg, borderRadius: "12px", padding: "12px", cursor: "pointer", border: `1px solid ${T.cardBorder}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
            <span style={{ fontSize: "13px", color: T.text, fontWeight: "600" }}>معدّل الإنجاز</span>
            <span style={{ fontSize: "14px", fontWeight: "800", color: config.progressBarColor || T.accent }}>{pct}%</span>
          </div>
          <div style={{ background: darkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)", borderRadius: "6px", height: "8px", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pct}%`, background: config.progressBarColor || T.accent, borderRadius: "6px" }} />
          </div>
          <p style={{ margin: "6px 0 0", fontSize: "11px", color: T.subtext }}>{done}/{total} درس ✓ اضغط لعرض الدروس</p>
        </div>

        {showLessons && (
          <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "6px" }}>
            {lessons.length === 0 && <p style={{ color: T.subtext, fontSize: "13px", textAlign: "center" }}>لا يوجد دروس</p>}
            {lessons.map(l => (
              <label key={l} style={{ display: "flex", alignItems: "center", gap: "10px", background: T.inputBg, borderRadius: "10px", padding: "10px 12px", cursor: "pointer" }}>
                <input type="checkbox" checked={doneLessons.includes(l)} onChange={() => toggleLesson(l)} style={{ accentColor: T.accent, width: "16px", height: "16px" }} />
                <span style={{ fontSize: "13px", color: doneLessons.includes(l) ? T.subtext : T.text, textDecoration: doneLessons.includes(l) ? "line-through" : "none" }}>{l}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
        {sections.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px", background: T.card, borderRadius: "16px", border: `1px solid ${T.cardBorder}` }}>
            <div style={{ fontSize: "48px" }}>📭</div>
            <p style={{ color: T.subtext }}>لا توجد أقسام مضافة لهذه المادة</p>
            <p style={{ color: T.subtext, fontSize: "12px" }}>يمكنك إضافة أقسام من لوحة الإدارة → أقسام المادة</p>
          </div>
        ) : (
          sections.map((sec) => {
            const handleOpenFolder = () => {
              if (onOpenFolder) {
                onOpenFolder({
                  subject: sub,
                  grade: grade,
                  branch: branch,
                    semester: semesterKey,
                  section: sec,
                  folderPath: []
                });
              }
            };

            return (
              <button key={sec} onClick={handleOpenFolder} style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: "16px", padding: "16px", display: "flex", alignItems: "center", gap: "14px", cursor: "pointer", backdropFilter: "blur(10px)", textAlign: "right" }}>
                <span style={{ fontSize: "26px" }}>{SEC_EMOJI?.[sec] || "📌"}</span>
                <span style={{ fontSize: "15px", fontWeight: "600", color: T.text, flex: 1 }}>{sec}</span>
                <span style={{ color: T.subtext, fontSize: "16px" }}>‹</span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

// ============================================================
// FOLDER PAGE
// ============================================================

function FolderPage({ config, saveConfig, T, darkMode, currentUser, updateUser, data, onBack, isEditorSession, editorRole, editorPermissions }) {
  const { subject, grade, branch, semester, section, folderPath = [] } = data;
  const storageKey = `folder_${grade}_${branch}_${semester}_${subject}_${section}`;

  const [folderData, setFolderData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPath, setCurrentPath] = useState(folderPath);
  const [currentItems, setCurrentItems] = useState([]);
  const [viewerData, setViewerData] = useState(null);
  const [savedIds, setSavedIds] = useState(new Set());
  const [editorMode, setEditorMode] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [form, setForm] = useState({ title: "", url: "", description: "", type: "link" });
  const fileRef = useRef();

  useEffect(() => {
    idbGetAllFiles().then(files => {
      setSavedIds(new Set(files.map(f => f.id)));
    });
  }, []);

  useEffect(() => {
    const raw = config[storageKey];
    if (raw) {
      try {
        const parsed = typeof raw === "string" ? JSON.parse(raw) : (Array.isArray(raw) ? raw : []);
        setFolderData(parsed);
      } catch { setFolderData([]); }
    } else {
      setFolderData([]);
    }
    setLoading(false);
  }, [storageKey]);

  useEffect(() => {
    let items = [...folderData];
    for (const segment of currentPath) {
      const found = items.find(item => item.type === "folder" && item.name === segment);
      if (found && found.children) {
        items = found.children;
      } else {
        items = [];
        break;
      }
    }
    setCurrentItems(items);
  }, [folderData, currentPath]);

  const isEditor = isEditorSession;
  // محرر كامل / مسؤول (admin) لهما صلاحية كاملة على كل شيء، ومحرر "الملازم" له صلاحية إدارة الملفات والمجلدات فقط
  // كما تُحترم الصلاحيات المخصّصة (custom permissions) التي يضبطها المسؤول لكل محرر على حدة
  const canEditStructure = isEditor && (
    editorRole === "all" || editorRole === "admin" || editorRole === "super" || editorRole === "notes" ||
    (editorRole === "custom" && Array.isArray(editorPermissions) && editorPermissions.includes("folders"))
  );

  const saveFolderData = async (newData) => {
    const newConfig = { ...config, [storageKey]: JSON.stringify(newData) };
    await saveConfig(newConfig);
    setFolderData(newData);
  };

  const saveCurrentItems = async (newItems) => {
    let newFolderData = [...folderData];
    let currentLevel = newFolderData;
    let parent = null;
    let parentIndex = -1;

    for (const segment of currentPath) {
      const foundIndex = currentLevel.findIndex(item => item.type === "folder" && item.name === segment);
      if (foundIndex === -1) break;
      parent = currentLevel;
      parentIndex = foundIndex;
      currentLevel = currentLevel[foundIndex].children;
    }

    if (currentPath.length === 0) {
      await saveFolderData(newItems);
    } else if (parent && parentIndex !== -1) {
      parent[parentIndex].children = newItems;
      await saveFolderData(newFolderData);
    }
  };

  const createFolder = async () => {
    if (!newFolderName.trim()) return;
    const newItems = [...currentItems, { type: "folder", name: newFolderName.trim(), children: [] }];
    await saveCurrentItems(newItems);
    setNewFolderName("");
  };

  const deleteItem = async (index) => {
    const newItems = currentItems.filter((_, i) => i !== index);
    await saveCurrentItems(newItems);
  };

  const renameItem = async (index, newName) => {
    if (!newName.trim()) return;
    const newItems = [...currentItems];
    newItems[index].name = newName.trim();
    await saveCurrentItems(newItems);
  };

  const navigateToFolder = (folderName) => {
    setCurrentPath([...currentPath, folderName]);
  };

  const navigateBack = () => {
    if (currentPath.length === 0) return onBack();
    setCurrentPath(currentPath.slice(0, -1));
  };

  // state لتتبع التقدم لكل ملف: { fileId: 0-100 | "saving" | "done" | "error" }
  const [dlProgress, setDlProgress] = useState({});

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // downloadInApp v3 — 4 مسارات للحفظ الأوفلاين
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const downloadInApp = async (resource) => {
    const fileId = getOfflineFileId(resource.url);

    // ─── إذا محفوظ مسبقاً → افتحه مباشرة ───
    if (savedIds.has(fileId)) {
      const saved = await idbGetFile(fileId);
      if (saved?.blob && saved.blob.size > 500 && !saved.isFallback) {
        const blobUrl = URL.createObjectURL(saved.blob);
        setViewerData({ url: blobUrl, title: resource.title, isBlob: true, mimeType: saved.type || getFileMimeType(resource) });
        return;
      }
    }

    setDlProgress(p => ({ ...p, [fileId]: 0 }));

    // دالة fetch مع تتبع تقدم
    const fetchWithProgress = async (fetchUrl, progressCallback) => {
      const resp = await fetch(fetchUrl, { mode: "cors" });
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      const total = parseInt(resp.headers.get("Content-Length") || "0");
      const reader = resp.body.getReader();
      const chunks = [];
      let received = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        if (total > 0) progressCallback(Math.round((received / total) * 85));
      }
      return new Blob(chunks, { type: resp.headers.get("Content-Type") || "application/pdf" });
    };

    const saveBlob = async (blob) => {
      if (!blob || blob.size < 500) throw new Error("blob فارغ");
      await idbSaveFile(fileId, blob, {
        title: resource.title, description: resource.description || "",
        type: resource.type || "pdf", url: resource.url,
        subject, grade, branch, semester, section, isFallback: false,
      });
      setSavedIds(s => new Set([...s, fileId]));
      setDlProgress(p => ({ ...p, [fileId]: "done" }));
      setTimeout(() => setDlProgress(p => { const n={...p}; delete n[fileId]; return n; }), 3000);
    };

    const progressCb = (pct) => setDlProgress(p => ({ ...p, [fileId]: pct }));

    // ─── المسار 1: Cloudflare Worker proxy (الأفضل لـ Drive) ───
    try {
      const proxyUrl = driveProxyUrl ? driveProxyUrl(resource.url) : null;
      if (proxyUrl) {
        const blob = await fetchWithProgress(proxyUrl, progressCb);
        await saveBlob(blob);
        return;
      }
    } catch (e1) { console.log("[DL] CF Worker failed:", e1.message); }

    // ─── المسار 2: fetch مباشر (للروابط العادية) ───
    try {
      const blob = await fetchWithProgress(getDownloadUrl(resource.url), progressCb);
      await saveBlob(blob);
      return;
    } catch (e2) { console.log("[DL] Direct fetch failed:", e2.message); }

    // ─── المسار 3: allorigins proxy ───
    try {
      const proxyUrl2 = `https://api.allorigins.win/raw?url=${encodeURIComponent(getDownloadUrl(resource.url))}`;
      const blob = await fetchWithProgress(proxyUrl2, progressCb);
      await saveBlob(blob);
      return;
    } catch (e3) { console.log("[DL] allorigins failed:", e3.message); }

    // ─── المسار 4: تحميل يدوي كحل أخير ───
    setDlProgress(p => ({ ...p, [fileId]: "error" }));
    setTimeout(() => setDlProgress(p => { const n={...p}; delete n[fileId]; return n; }), 5000);
    if (window.confirm(
      "⚠️ لا يمكن الحفظ التلقائي\n\nGoogle Drive يمنع التحميل المباشر.\n\nاضغط موافق لفتح رابط التحميل وحفظه يدوياً."
    )) {
      window.open(getDownloadUrl(resource.url), "_blank");
    }
  };

  const toggleStar = async (item) => {
    const saved = [...(currentUser.savedItems || [])];
    const idx = saved.findIndex(s => s.url === item.url && s.title === item.title);
    if (idx >= 0) saved.splice(idx, 1);
    else saved.push({ ...item, type: "ملف من المواد", category: "مميز بنجمة", addedAt: Date.now() });
    await updateUser({ savedItems: saved });
  };

  const isStarred = (item) => (currentUser.savedItems || []).some(s => s.url === item.url && s.title === item.title);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadPct(0);
    try {
      const driveLink = prompt("أدخل رابط Google Drive للملف:");
      if (driveLink) {
        const fileType = file.type.includes("pdf") ? "pdf" : file.type.includes("image") ? "image" : "link";
        setForm(f => ({ ...f, title: f.title || file.name.replace(/\.[^/.]+$/, ""), url: driveLink, type: fileType }));
      }
    } catch { alert("فشل رفع الملف"); }
    setUploading(false);
  };

  const addResource = async () => {
    if (!form.title || !form.url) return;
    const newItems = [...currentItems, { ...form }];
    await saveCurrentItems(newItems);
    setForm({ title: "", url: "", description: "", type: "link" });
  };

  const inputStyle = {
    background: T.inputBg,
    border: `1.5px solid ${T.cardBorder}`,
    borderRadius: "10px",
    padding: "9px 12px",
    fontSize: "13px",
    color: T.text,
    width: "100%",
    outline: "none",
    fontFamily: "'Cairo',sans-serif",
    direction: "rtl",
    boxSizing: "border-box",
    marginBottom: "7px"
  };

  if (viewerData) {
  return <FileViewer 
    url={viewerData.url} 
    title={viewerData.title} 
    T={T} 
    isBlobDirect={viewerData.isBlob}
    mimeType={viewerData.mimeType || "application/pdf"}
    onClose={() => {
      if (viewerData.isBlob) URL.revokeObjectURL(viewerData.url);
      setViewerData(null);
    }} 
  />;
}

  const renderBreadcrumb = () => {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", marginTop: "8px" }}>
        <span style={{ color: T.subtext, fontSize: "13px", cursor: "pointer" }} onClick={() => setCurrentPath([])}>📁 {section}</span>
        {currentPath.map((seg, idx) => (
          <span key={idx}>
            <span style={{ color: T.subtext }}> › </span>
            <span style={{ color: idx === currentPath.length - 1 ? T.accent : T.subtext, fontSize: "13px", cursor: idx === currentPath.length - 1 ? "default" : "pointer" }} onClick={() => idx !== currentPath.length - 1 && setCurrentPath(currentPath.slice(0, idx + 1))}>{seg}</span>
          </span>
        ))}
      </div>
    );
  };

  const renderItem = (item, index) => {
    if (item.type === "folder") {
      return (
        <div key={index} style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: "16px", padding: "14px", marginBottom: "10px", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ fontSize: "28px" }}>📁</div>
          <div style={{ flex: 1, cursor: "pointer" }} onClick={() => navigateToFolder(item.name)}>
            <p style={{ margin: 0, fontWeight: "700", color: T.text }}>{item.name}</p>
          </div>
          {canEditStructure && editorMode && (
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => { const newName = prompt("أدخل الاسم الجديد:", item.name); if (newName) renameItem(index, newName); }} style={{ background: `${T.accent}22`, border: "none", borderRadius: "8px", padding: "6px 10px", cursor: "pointer", fontSize: "14px" }}>✏️</button>
              <button onClick={() => deleteItem(index)} style={{ background: "#e5533322", border: "1px solid #e55", color: "#e55", borderRadius: "8px", padding: "6px 10px", cursor: "pointer", fontSize: "13px" }}>🗑️</button>
            </div>
          )}
        </div>
      );
    } else {
      const fileId = getOfflineFileId(item.url || "");
      const isOfflineSaved = savedIds.has(fileId);
      const prog = dlProgress[fileId];
      const isDownloading = typeof prog === "number";

      const handleOfflineBtn = async () => {
        if (isDownloading) return;
        if (isOfflineSaved) {
          const saved = await idbGetFile(fileId);
          if (saved?.blob && saved.blob.size > 0) {
            const blobUrl = URL.createObjectURL(saved.blob);
            setViewerData({ url: blobUrl, title: item.title, isBlob: true, mimeType: saved.type || getFileMimeType(item, saved.blob) });
          } else {
            await idbDeleteFile(fileId);
            setSavedIds(s => { const n = new Set(s); n.delete(fileId); return n; });
            await downloadInApp(item);
          }
        } else {
          await downloadInApp(item);
        }
      };

      return (
        <div key={index} style={{ background: T.card, border: `1.5px solid ${prog === "done" ? "#23863688" : isOfflineSaved ? "#23863644" : prog === "error" ? "#e5533344" : T.cardBorder}`, borderRadius: "16px", padding: "14px", marginBottom: "10px", backdropFilter: "blur(10px)", transition: "border-color 0.3s" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
            <div style={{ fontSize: "28px", flexShrink: 0 }}>{item.type === "pdf" ? "📄" : item.type === "image" ? "🖼️" : "🔗"}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: "0 0 4px", fontWeight: "700", color: T.text, fontSize: "14px" }}>{item.title}</p>
              {item.description && <p style={{ margin: "0 0 6px", fontSize: "12px", color: T.subtext }}>{item.description}</p>}

              {/* شارة الحالة */}
              {(isOfflineSaved && prog !== "done") && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", background: "#23863618", color: "#238636", fontSize: "11px", padding: "3px 10px", borderRadius: "20px", fontWeight: "700", marginBottom: "8px", border: "1px solid #23863630" }}>✅ متاح بدون إنترنت</span>
              )}
              {prog === "done" && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", background: "#23863618", color: "#238636", fontSize: "11px", padding: "3px 10px", borderRadius: "20px", fontWeight: "700", marginBottom: "8px" }}>✅ تم الحفظ بنجاح!</span>
              )}
              {prog === "error" && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", background: "#e5533318", color: "#e55333", fontSize: "11px", padding: "3px 10px", borderRadius: "20px", fontWeight: "700", marginBottom: "8px" }}>⚠️ تعذّر الحفظ التلقائي</span>
              )}

              {/* شريط التقدم */}
              {isDownloading && (
                <div style={{ marginBottom: "8px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
                    <span style={{ fontSize: "11px", color: T.subtext }}>جاري الحفظ للأوفلاين...</span>
                    <span style={{ fontSize: "11px", fontWeight: "700", color: T.accent }}>{prog}%</span>
                  </div>
                  <div style={{ background: "rgba(0,0,0,0.1)", height: "5px", borderRadius: "3px", overflow: "hidden" }}>
                    <div style={{ width: `${prog}%`, height: "100%", background: `linear-gradient(90deg,${T.accent},${T.accent2})`, borderRadius: "3px", transition: "width 0.3s" }} />
                  </div>
                </div>
              )}

              <div style={{ display: "flex", gap: "7px", flexWrap: "wrap", alignItems: "center" }}>
                {item.url && !isDownloading && (
                  <>
                    <button onClick={() => setViewerData({ url: item.url, title: item.title, mimeType: getFileMimeType(item) })} style={{ background: T.accent, color: "#fff", border: "none", borderRadius: "10px", padding: "7px 12px", fontSize: "12px", cursor: "pointer", fontFamily: "'Cairo',sans-serif", fontWeight: "600" }}>
                      🌐 أونلاين
                    </button>
                    <button onClick={handleOfflineBtn} style={{ background: isOfflineSaved ? "#23863615" : T.sectionBg, color: isOfflineSaved ? "#238636" : T.accent, border: `1.5px solid ${isOfflineSaved ? "#238636" : T.accent}`, borderRadius: "10px", padding: "7px 12px", fontSize: "12px", cursor: "pointer", fontFamily: "'Cairo',sans-serif", fontWeight: "700" }}>
                      {isOfflineSaved ? "📂 بدون نت" : "⬇️ حفظ"}
                    </button>
                    {isOfflineSaved && (
                      <button onClick={async () => {
                        if (!window.confirm(`حذف النسخة الأوفلاين من "${item.title}"؟`)) return;
                        await idbDeleteFile(fileId);
                        setSavedIds(s => { const n = new Set(s); n.delete(fileId); return n; });
                      }} title="حذف من التخزين المحلي" style={{ background: "#e5533310", color: "#e55333", border: "1px solid #e5533330", borderRadius: "10px", padding: "7px 9px", fontSize: "12px", cursor: "pointer" }}>🗑️</button>
                    )}
                  </>
                )}
                {isDownloading && <span style={{ fontSize: "12px", color: T.subtext }}>يرجى الانتظار...</span>}
                <button onClick={() => toggleStar(item)} style={{ background: "transparent", border: "none", fontSize: "20px", cursor: "pointer", marginRight: "auto" }}>{isStarred(item) ? "⭐" : "☆"}</button>
                {canEditStructure && editorMode && <button onClick={() => deleteItem(index)} style={{ background: "#e5533322", border: "1px solid #e55", color: "#e55", borderRadius: "8px", padding: "6px 10px", cursor: "pointer", fontSize: "13px" }}>🗑️</button>}
              </div>
            </div>
          </div>
        </div>
      );
    }
  };

  return (
    <div style={{ minHeight: "100vh", maxWidth: APP_MAX_WIDTH, margin: "0 auto", background: T.bg, fontFamily: "'Cairo',sans-serif", direction: "rtl", paddingBottom: "30px" }}>
      <div style={{ background: T.card, backdropFilter: "blur(16px)", borderBottom: `1px solid ${T.cardBorder}`, padding: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button onClick={navigateBack} style={{ background: T.accent, color: "#fff", border: "none", borderRadius: "12px", padding: "8px 18px", fontSize: "14px", fontWeight: "700", cursor: "pointer", fontFamily: "'Cairo',sans-serif" }}>← رجوع</button>
          {canEditStructure && <button onClick={() => setEditorMode(e => !e)} style={{ background: editorMode ? "#238636" : `${T.accent}22`, border: `1px solid ${editorMode ? "#238636" : T.accent}`, color: editorMode ? "#fff" : T.accent, borderRadius: "12px", padding: "8px 14px", fontSize: "13px", fontWeight: "700", cursor: "pointer", fontFamily: "'Cairo',sans-serif" }}>{editorMode ? "✅ وضع التحرير" : "✏️ تحرير"}</button>}
        </div>
        <h2 style={{ margin: "8px 0 0", color: T.text, fontSize: "19px", fontWeight: "800" }}>{config.subjectIcons?.[subject] || EMOJI[subject] || "📌"} {subject}</h2>
        <p style={{ margin: "2px 0 0", fontSize: "12px", color: T.subtext }}>{grade} --- {branch} {semester} - {section}</p>
        {renderBreadcrumb()}
      </div>

      {canEditStructure && editorMode && (
        <div style={{ margin: "12px 16px", background: T.card, border: `1.5px dashed ${T.accent}`, borderRadius: "16px", padding: "14px" }}>
          <p style={{ color: T.accent, fontWeight: "700", fontSize: "14px", margin: "0 0 10px" }}>➕ إضافة محتوى</p>
          <button onClick={() => { const name = prompt("أدخل اسم المجلد الجديد:"); if (name) { setNewFolderName(name); createFolder(); } }} style={{ width: "100%", background: `${T.accent}15`, border: `2px dashed ${T.accent}`, borderRadius: "10px", padding: "12px", color: T.accent, fontSize: "13px", fontWeight: "700", cursor: "pointer", fontFamily: "'Cairo',sans-serif", marginBottom: "8px" }}>📁 إنشاء مجلد جديد</button>
          <button onClick={() => fileRef.current?.click()} style={{ width: "100%", background: `${T.accent}15`, border: `2px dashed ${T.accent}`, borderRadius: "10px", padding: "12px", color: T.accent, fontSize: "13px", fontWeight: "700", cursor: "pointer", fontFamily: "'Cairo',sans-serif", marginBottom: "8px" }}>{uploading ? `⏳ ${uploadPct}%` : "📤 إضافة رابط Google Drive"}</button>
          <input ref={fileRef} type="file" accept=".pdf,image/*" onChange={handleFileUpload} style={{ display: "none" }} />
          <input value={form.title} onChange={(e) => { setForm(prev => ({ ...prev, title: e.target.value })); }} placeholder="العنوان *" style={inputStyle} />
          <input value={form.url} onChange={(e) => { setForm(prev => ({ ...prev, url: e.target.value })); }} placeholder="رابط Google Drive" style={inputStyle} />
          <input value={form.description} onChange={(e) => { setForm(prev => ({ ...prev, description: e.target.value })); }} placeholder="وصف (اختياري)" style={inputStyle} />
          <button onClick={addResource} disabled={!form.title || !form.url} style={{ background: (form.title && form.url) ? `linear-gradient(135deg,${T.accent},${T.accent2})` : "#ccc", color: "#fff", border: "none", borderRadius: "10px", padding: "10px 18px", cursor: (form.title && form.url) ? "pointer" : "not-allowed", fontFamily: "'Cairo',sans-serif", fontSize: "13px", fontWeight: "700" }}>+ إضافة</button>
        </div>
      )}

      <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: "10px" }}>
        {loading && <p style={{ color: T.subtext, textAlign: "center" }}>جاري التحميل...</p>}
        {!loading && currentItems.length === 0 && <div style={{ textAlign: "center", padding: "40px" }}><div style={{ fontSize: "48px" }}>📭</div><p style={{ color: T.subtext }}>هذا المجلد فارغ</p></div>}
        {currentItems.map((item, index) => renderItem(item, index))}
      </div>
    </div>
  );
}

// ============================================================
// FOUNDATION
// ============================================================

function FoundationPage({ config, T, onSubject }) {
  return (
    <div style={{ padding: "20px 16px", fontFamily: "'Cairo',sans-serif", direction: "rtl" }}>
      <h2 style={{ color: T.text, fontSize: "20px", fontWeight: "800", margin: "0 0 16px" }}>🏗️ صفحة التأسيس</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "12px" }}>
        {config.foundationSubjects?.map(sub => (
          <button key={sub} onClick={() => onSubject({ subject: sub })} style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: "18px", padding: "20px 12px", cursor: "pointer", textAlign: "center", backdropFilter: "blur(12px)", boxShadow: T.shadow }}>
            <div style={{ fontSize: "32px", marginBottom: "8px" }}>{EMOJI[sub] || "📌"}</div>
            <div style={{ fontSize: "14px", fontWeight: "700", color: T.text }}>{sub}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function FoundationSubjectPage({ config, saveConfig, T, darkMode, data, onBack }) {
  const { subject } = data;
  const branches = config.foundationBranches?.[subject] || [];
  const [selBranch, setSelBranch] = useState(branches.length ? null : "عام");
  const [selType, setSelType] = useState(null);
  const [selSub, setSelSub] = useState(null);
  const [viewerData, setViewerData] = useState(null);
  const [savedIds, setSavedIds] = useState(new Set());
  const [dlProgress, setDlProgress] = useState({});

  useEffect(() => {
    idbGetAllFiles().then(files => setSavedIds(new Set(files.map(f => f.id))));
  }, []);

  const foundKey = selSub ? `found_${subject}_${selBranch || "عام"}_${selType}_${selSub}` : null;
  const raw = foundKey ? config[foundKey] : null;

  const items = (() => {
    if (!raw) return [];
    try { return typeof raw === "string" ? JSON.parse(raw) : (Array.isArray(raw) ? raw : []); }
    catch { return []; }
  })();

  const handleFoundationSave = async (item) => {
    const fileId = getOfflineFileId(item.url);
    setDlProgress(p => ({ ...p, [fileId]: 0 }));
    try {
      const proxyUrl = driveProxyUrl(item.url);
      const resp = await fetch(proxyUrl || item.url, { mode: "cors" });
      if (!resp.ok) throw new Error("fetch failed");
      const blob = await resp.blob();
      if (!blob || blob.size < 500) throw new Error("empty blob");
      await idbSaveFile(fileId, blob, { title: item.title, description: item.description || "", url: item.url, type: item.type || getFileMimeType(item), isFallback: false });
      setSavedIds(s => new Set([...s, fileId]));
      setDlProgress(p => { const n = { ...p }; delete n[fileId]; return n; });
    } catch (err) {
      setDlProgress(p => { const n = { ...p }; delete n[fileId]; return n; });
      alert("⚠️ تعذّر الحفظ التلقائي بدون إنترنت لهذا الملف. جرّب فتحه أونلاين بدلاً من ذلك.");
    }
  };

  const handleFoundationOpen = async (item) => {
    const fileId = getOfflineFileId(item.url);
    if (savedIds.has(fileId)) {
      const saved = await idbGetFile(fileId);
      if (saved?.blob && saved.blob.size > 0) {
        const blobUrl = URL.createObjectURL(saved.blob);
        setViewerData({ url: blobUrl, title: item.title, isBlob: true, mimeType: saved.type || getFileMimeType(item, saved.blob) });
        return;
      }
    }
    setViewerData({ url: item.url, title: item.title, mimeType: getFileMimeType(item) });
  };

  if (viewerData) return <FileViewer url={viewerData.url} title={viewerData.title} T={T} isBlobDirect={viewerData.isBlob} mimeType={viewerData.mimeType || "application/pdf"} onClose={() => { if (viewerData.isBlob) URL.revokeObjectURL(viewerData.url); setViewerData(null); }} />;

  return (
    <div style={{ minHeight: "100vh", maxWidth: APP_MAX_WIDTH, margin: "0 auto", background: T.bg, fontFamily: "'Cairo',sans-serif", direction: "rtl", paddingBottom: "30px" }}>
      <div style={{ background: T.card, backdropFilter: "blur(16px)", borderBottom: `1px solid ${T.cardBorder}`, padding: "16px" }}>
        <button onClick={onBack} style={{ background: T.accent, color: "#fff", border: "none", borderRadius: "12px", padding: "8px 18px", fontSize: "14px", fontWeight: "700", cursor: "pointer", fontFamily: "'Cairo',sans-serif" }}>← رجوع</button>
        <h2 style={{ margin: "8px 0 0", color: T.text, fontSize: "20px" }}>{EMOJI[subject]} {subject}</h2>
      </div>
      <div style={{ padding: "16px" }}>
        {branches.length > 0 && !selBranch && (
          <div>
            <p style={{ color: T.text, fontWeight: "700", marginBottom: "12px" }}>اختر الفرع:</p>
            <div style={{ display: "flex", gap: "10px" }}>
              {branches.map(b => <button key={b} onClick={() => setSelBranch(b)} style={{ flex: 1, background: T.card, border: `1.5px solid ${T.accent}`, borderRadius: "14px", padding: "14px", fontSize: "15px", fontWeight: "700", color: T.accent, cursor: "pointer", fontFamily: "'Cairo',sans-serif" }}>{b}</button>)}
            </div>
          </div>
        )}
        {(selBranch || !branches.length) && !selType && (
          <div>
            <p style={{ color: T.text, fontWeight: "700", marginBottom: "12px" }}>نوع التأسيس:</p>
            {[["electronic", "💻 إلكتروني"], ["inPerson", "🏫 وجاهي"]].map(([k, l]) => (
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
          <div>
            <button onClick={() => setSelSub(null)} style={{ background: "transparent", border: "none", color: T.accent, cursor: "pointer", fontSize: "14px", fontFamily: "'Cairo',sans-serif", marginBottom: "12px" }}>← رجوع</button>
            <h3 style={{ color: T.text, marginBottom: "12px" }}>{selSub}</h3>
            {items.length === 0 ? <div style={{ textAlign: "center", padding: "40px" }}><div style={{ fontSize: "48px" }}>📭</div><p style={{ color: T.subtext }}>لا يوجد محتوى بعد</p></div> :
              items.map((item, i) => (
                <div key={i} style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: "16px", padding: "14px", marginBottom: "10px", backdropFilter: "blur(10px)" }}>
                  {item.teacher && <p style={{ margin: "0 0 4px", fontSize: "12px", color: T.accent, fontWeight: "700" }}>المدرس: {item.teacher}</p>}
                  <p style={{ margin: "0 0 6px", fontWeight: "700", color: T.text }}>{item.title}</p>
                  {item.description && <p style={{ margin: "0 0 8px", fontSize: "13px", color: T.subtext }}>{item.description}</p>}
                  {item.url && (() => {
                    const fileId = getOfflineFileId(item.url);
                    const isOfflineSaved = savedIds.has(fileId);
                    const prog = dlProgress[fileId];
                    const isDownloading = typeof prog === "number";
                    return (
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                        <button onClick={() => handleFoundationOpen(item)} style={{ background: `linear-gradient(135deg,${T.accent},${T.accent2})`, color: "#fff", border: "none", borderRadius: "10px", padding: "8px 14px", fontSize: "13px", cursor: "pointer", fontFamily: "'Cairo',sans-serif", fontWeight: "600" }}>
                          {isOfflineSaved ? "📂 فتح" : "🌐 أونلاين"}
                        </button>
                        {!isOfflineSaved && !isDownloading && (
                          <button onClick={() => handleFoundationSave(item)} style={{ background: T.sectionBg, color: T.accent, border: `1.5px solid ${T.accent}`, borderRadius: "10px", padding: "8px 14px", fontSize: "13px", cursor: "pointer", fontFamily: "'Cairo',sans-serif", fontWeight: "700" }}>⬇️ حفظ بدون إنترنت</button>
                        )}
                        {isDownloading && <span style={{ fontSize: "12px", color: T.subtext }}>⏳ جاري الحفظ...</span>}
                        {isOfflineSaved && <span style={{ fontSize: "11px", color: "#238636", fontWeight: "700" }}>✅ متاح بدون إنترنت</span>}
                      </div>
                    );
                  })()}
                </div>
              ))
            }
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// NEWS
// ============================================================

function NewsPage({ config, saveConfig, T, currentUser, updateUser, onDetail }) {
  const [news, setNews] = useState([]);
  const pinnedByAdmin = config.pinnedNews ? (typeof config.pinnedNews === "string" ? JSON.parse(config.pinnedNews) : config.pinnedNews) : [];

  useEffect(() => {
    fbGet("news").then(data => { if (data) setNews(data.sort((a, b) => b.createdAt - a.createdAt)); });
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
      {news.length === 0 && <div style={{ textAlign: "center", padding: "40px" }}><div style={{ fontSize: "48px" }}>📭</div><p style={{ color: T.subtext }}>لا توجد أخبار بعد</p></div>}
      {adminPinned.map(n => <Card key={n.id} n={n} pinned={true} />)}
      {userPinned.map(n => <Card key={n.id} n={n} pinned={true} />)}
      {regular.map(n => <Card key={n.id} n={n} pinned={false} />)}
    </div>
  );
}

function NewsDetailPage({ T, news, currentUser, updateUser, onBack }) {
  const toggleStar = async () => {
    const saved = [...(currentUser.savedItems || [])];
    const idx = saved.findIndex(s => s.newsId === news.id);
    if (idx >= 0) saved.splice(idx, 1);
    else saved.push({ title: news.title, newsId: news.id, type: "خبر من الأخبار", category: "مميز بنجمة", addedAt: Date.now() });
    await updateUser({ savedItems: saved });
  };

  const isStarred = (currentUser.savedItems || []).some(s => s.newsId === news.id);

  return (
    <div style={{ minHeight: "100vh", maxWidth: APP_MAX_WIDTH, margin: "0 auto", background: T.bg, fontFamily: "'Cairo',sans-serif", direction: "rtl", paddingBottom: "30px" }}>
      <div style={{ background: T.card, backdropFilter: "blur(16px)", borderBottom: `1px solid ${T.cardBorder}`, padding: "16px", display: "flex", alignItems: "center", gap: "12px" }}>
        <button onClick={onBack} style={{ background: T.accent, color: "#fff", border: "none", borderRadius: "12px", padding: "8px 18px", fontSize: "14px", fontWeight: "700", cursor: "pointer", fontFamily: "'Cairo',sans-serif" }}>← رجوع</button>
        <h2 style={{ margin: 0, flex: 1, color: T.text, fontSize: "17px" }}>{news.title}</h2>
        <button onClick={toggleStar} style={{ background: "transparent", border: "none", fontSize: "22px", cursor: "pointer" }}>{isStarred ? "⭐" : "☆"}</button>
      </div>
      <div style={{ padding: "16px" }}>
        <p style={{ fontSize: "12px", color: T.subtext, marginBottom: "16px" }}>المصدر: {news.source} --- {news.date}</p>
        <p style={{ color: T.text, fontSize: "15px", lineHeight: "1.8" }}>{news.content}</p>
        {news.url && <a href={news.url} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: "16px", background: `linear-gradient(135deg,${T.accent},${T.accent2})`, color: "#fff", borderRadius: "12px", padding: "12px 20px", textDecoration: "none" }}>فتح المصدر ←</a>}
      </div>
    </div>
  );
}

// ============================================================
// SAVED PAGE
// ============================================================

function SavedPage({ config, T, currentUser, updateUser }) {
  const [cat, setCat] = useState("مميز بنجمة");
  const [type, setType] = useState(null);
  const [offlineFiles, setOfflineFiles] = useState([]);
  const [viewingBlob, setViewingBlob] = useState(null);
  const isOfflineTab = cat === "الملفات بدون انترنت";

  useEffect(() => {
    if (isOfflineTab) {
      idbGetAllFiles().then(files => {
        setOfflineFiles(files.sort((a, b) => b.addedAt - a.addedAt));
      });
    }
  }, [isOfflineTab]);

  const openOfflineFile = (file) => {
  if (!file.isFallback && file.blob && file.blob.size > 10) {
    const blobUrl = URL.createObjectURL(file.blob);
    
    setViewingBlob(blobUrl);

    // لا نعمل revoke تلقائي بعد 60 ثانية
    // الـ revoke راح يتم عند إغلاق العارض
  } else {
    // fallback إذا ما كان فيه blob محفوظ
    fetch(file.url)
      .then(res => res.blob())
      .then(blob => {
        const localUrl = URL.createObjectURL(blob);
        setViewingBlob(localUrl);
      })
      .catch(() => {
        alert("عذراً، هذا الملف غير متوفر أوفلاين حالياً.");
      });
  }
};

  const deleteOfflineFile = async (id) => {
    await idbDeleteFile(id);
    setOfflineFiles(f => f.filter(x => x.id !== id));
  };

  const items = (currentUser.savedItems || []).filter(
    s => s.category === cat && (!type || s.type === type)
  );

  if (viewingBlob) return (
    <div style={{ position: "fixed", inset: 0, background: "#000", zIndex: 999, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 14px", background: "#1a1a2e" }}>
        <button onClick={() => setViewingBlob(null)} style={{ background: T.accent, color: "#fff", border: "none", borderRadius: "10px", padding: "8px 16px", cursor: "pointer", fontFamily: "'Cairo',sans-serif", fontSize: "14px" }}>← رجوع</button>
        <span style={{ color: "#fff", fontSize: "14px" }}>عرض الملف (أوفلاين)</span>
      </div>
      <iframe src={viewingBlob} style={{ flex: 1, border: "none", width: "100%" }} title="offline-view" />
    </div>
  );

  return (
    <div style={{ padding: "20px 16px", fontFamily: "'Cairo',sans-serif", direction: "rtl" }}>
      <h2 style={{ color: T.text, fontSize: "20px", fontWeight: "800", margin: "0 0 14px" }}>🔖 المحفوظات</h2>
      <div style={{ display: "flex", gap: "8px", marginBottom: "12px", overflowX: "auto" }}>
        <button onClick={() => setCat("مميز بنجمة")} style={{ background: cat === "مميز بنجمة" ? `linear-gradient(135deg,${T.accent},${T.accent2})` : T.card, color: cat === "مميز بنجمة" ? "#fff" : T.text, border: `1px solid ${cat === "مميز بنجمة" ? "transparent" : T.cardBorder}`, borderRadius: "12px", padding: "8px 14px", fontSize: "13px", cursor: "pointer", whiteSpace: "nowrap", fontFamily: "'Cairo',sans-serif", backdropFilter: "blur(10px)" }}>
          ⭐ مميز بنجمة
        </button>
        <button onClick={() => setCat("الملفات بدون انترنت")} style={{ background: cat === "الملفات بدون انترنت" ? `linear-gradient(135deg,${T.accent},${T.accent2})` : T.card, color: cat === "الملفات بدون انترنت" ? "#fff" : T.text, border: `1px solid ${cat === "الملفات بدون انترنت" ? "transparent" : T.cardBorder}`, borderRadius: "12px", padding: "8px 14px", fontSize: "13px", cursor: "pointer", whiteSpace: "nowrap", fontFamily: "'Cairo',sans-serif", backdropFilter: "blur(10px)" }}>
          📴 ملفات أوفلاين
        </button>
      </div>

      {isOfflineTab ? (
        <div>
          {offlineFiles.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px" }}>
              <div style={{ fontSize: "48px" }}>📴</div>
              <p style={{ color: T.subtext }}>لا توجد ملفات محفوظة أوفلاين بعد</p>
              <p style={{ color: T.subtext, fontSize: "12px" }}>اضغط "حفظ أوفلاين" على أي ملف في صفحة المادة</p>
            </div>
          ) : (
            offlineFiles.map(file => (
              <div key={file.id} style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: "16px", padding: "14px", marginBottom: "10px", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ fontSize: "28px" }}>{file.type === "pdf" ? "📄" : file.type === "image" ? "🖼️" : "🔗"}</div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: "0 0 2px", fontWeight: "700", color: T.text, fontSize: "14px" }}>{file.title}</p>
                  <p style={{ margin: "0 0 6px", fontSize: "11px", color: T.subtext }}>{file.subject} --- {file.section} | {formatSize(file.size)}</p>
                  <p style={{ margin: "0 0 8px", fontSize: "10px", color: T.accent }}>📴 يعمل بدون إنترنت</p>
                  <button onClick={() => openOfflineFile(file)} style={{ background: `linear-gradient(135deg,${T.accent},${T.accent2})`, color: "#fff", border: "none", borderRadius: "10px", padding: "7px 14px", fontSize: "12px", cursor: "pointer", fontFamily: "'Cairo',sans-serif" }}>فتح 👁️</button>
                </div>
                <button onClick={() => deleteOfflineFile(file.id)} style={{ background: "#e5533322", border: "1px solid #e55", color: "#e55", borderRadius: "8px", padding: "6px 10px", cursor: "pointer", fontSize: "13px" }}>🗑️</button>
              </div>
            ))
          )}
          {offlineFiles.length > 0 && (
            <div style={{ background: T.sectionBg, border: `1px solid ${T.cardBorder}`, borderRadius: "12px", padding: "12px", marginTop: "12px", textAlign: "center" }}>
              <p style={{ color: T.subtext, fontSize: "12px", margin: 0 }}>📦 {offlineFiles.length} ملف | الحجم الكلي: {formatSize(offlineFiles.reduce((s, f) => s + (f.size || 0), 0))}</p>
            </div>
          )}
        </div>
      ) : (
        <div>
          <div style={{ display: "flex", gap: "6px", marginBottom: "12px", flexWrap: "wrap" }}>
            <button onClick={() => setType(null)} style={{ background: !type ? T.accent : T.sectionBg, color: !type ? "#fff" : T.subtext, border: `1px solid ${T.cardBorder}`, borderRadius: "10px", padding: "6px 12px", fontSize: "12px", cursor: "pointer", fontFamily: "'Cairo',sans-serif" }}>الكل</button>
            {config.savedTypes?.map(t => (
              <button key={t} onClick={() => setType(t)} style={{ background: type === t ? T.accent : T.sectionBg, color: type === t ? "#fff" : T.subtext, border: `1px solid ${T.cardBorder}`, borderRadius: "10px", padding: "6px 12px", fontSize: "12px", cursor: "pointer", whiteSpace: "nowrap", fontFamily: "'Cairo',sans-serif" }}>{t}</button>
            ))}
          </div>
          {items.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px" }}>
              <div style={{ fontSize: "48px" }}>🗂️</div>
              <p style={{ color: T.subtext }}>لا يوجد محفوظات</p>
            </div>
          ) : (
            items.map((item, i) => (
              <div key={i} style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: "16px", padding: "14px", marginBottom: "10px", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: "0 0 4px", fontWeight: "700", color: T.text }}>{item.title}</p>
                  <p style={{ margin: 0, fontSize: "12px", color: T.subtext }}>{item.type}</p>
                  {item.url && (
                    <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                      <a href={item.url} target="_blank" rel="noreferrer" style={{ color: T.accent, fontSize: "13px", textDecoration: "none" }}>فتح ←</a>
                      <a href={item.url} download={item.title} style={{ color: T.accent, fontSize: "13px", textDecoration: "none" }}>تنزيل ⬇️</a>
                    </div>
                  )}
                </div>
                <button onClick={async () => {
                  const saved = (currentUser.savedItems || []).filter(s => !(s.url === item.url && s.title === item.title && s.newsId === item.newsId));
                  await updateUser({ savedItems: saved });
                }} style={{ background: "transparent", border: "none", fontSize: "20px", cursor: "pointer" }}>✕</button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}


// ============================================================
// STUDY TIMER — تايمر دراسة
// ============================================================

// ============================================================
// TIMER AUDIO — مُضمَّن مباشرة (يشتغل آخر 3 ثوانٍ)
// ============================================================
const TIMER_AUDIO_B64 = "/timer.mp3";

// ============================================================
// TIMER STATE — يعمل في الخلفية حتى عند إغلاق النافذة
// نخزن حالة التايمر خارج المكوّن
// ============================================================
const timerState = {
  running: false,
  secondsLeft: 0,
  totalSeconds: 0,
  started: false,
  interval: null,
  listeners: new Set(),
  notify(s) { this.listeners.forEach(fn => fn(s)); },
  startTimer(total) {
    if (this.interval) clearInterval(this.interval);
    if (!this.started) { this.totalSeconds = total; this.secondsLeft = total; this.started = true; }
    this.running = true;
    this.notify({ ...this });
    this.interval = setInterval(() => {
      this.secondsLeft = Math.max(0, this.secondsLeft - 1);
      this.notify({ ...this });
      if (this.secondsLeft <= 0) {
        clearInterval(this.interval);
        this.running = false;
        this.notify({ ...this });
        // إشعار
        if (Notification.permission === "granted") {
          new Notification("⏰ سواعد الخير", { body: "انتهى وقت الدراسة! 🎉 خذ راحة." });
        }
        // صوت
        try {
          const audio = new Audio(TIMER_AUDIO_B64);
          audio.volume = 1;
          audio.play().catch(() => {});
        } catch(e) {}
      }
    }, 1000);
  },
  pauseTimer() {
    if (this.interval) clearInterval(this.interval);
    this.running = false;
    this.notify({ ...this });
  },
  resetTimer() {
    if (this.interval) clearInterval(this.interval);
    this.running = false; this.started = false;
    this.secondsLeft = this.totalSeconds;
    this.notify({ ...this });
  },
};

function useTimerState() {
  const [state, setState] = useState({ ...timerState });
  useEffect(() => {
    const fn = (s) => setState({ ...s });
    timerState.listeners.add(fn);
    return () => timerState.listeners.delete(fn);
  }, []);
  return state;
}

// ── Mini PiP widget يظهر أثناء استخدام التطبيق ──
function TimerMiniWidget({ T, onOpen }) {
  const s = useTimerState();
  if (!s.started) return null;
  const mins = Math.floor(s.secondsLeft / 60);
  const secs = s.secondsLeft % 60;
  const pct = s.totalSeconds > 0 ? ((s.totalSeconds - s.secondsLeft) / s.totalSeconds) * 100 : 0;
  const isLast3 = s.secondsLeft <= 3 && s.secondsLeft > 0 && s.running;
  return (
    <div
      onClick={onOpen}
      style={{
        position: "fixed", bottom: "90px", left: "12px", zIndex: 150,
        background: isLast3 ? "#e55333" : T.accent,
        borderRadius: "20px", padding: "8px 14px",
        display: "flex", alignItems: "center", gap: "8px",
        cursor: "pointer", boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
        fontFamily: "'Cairo',sans-serif", direction: "rtl",
        transition: "background 0.3s",
        animation: isLast3 ? "timerPulse 0.5s infinite" : "none",
      }}
    >
      <style>{`@keyframes timerPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}`}</style>
      <span style={{ fontSize: "16px" }}>{s.running ? "⏱️" : "⏸"}</span>
      <span style={{ color: "#fff", fontWeight: "800", fontSize: "15px", fontVariantNumeric: "tabular-nums" }}>
        {String(mins).padStart(2,"0")}:{String(secs).padStart(2,"0")}
      </span>
      <svg width="28" height="28" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="14" cy="14" r="11" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="3"/>
        <circle cx="14" cy="14" r="11" fill="none" stroke="#fff" strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={2 * Math.PI * 11}
          strokeDashoffset={2 * Math.PI * 11 * (1 - pct/100)}
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
      </svg>
    </div>
  );
}

// ── النافذة الكاملة للتايمر ──
function StudyTimer({ T, onClose }) {
  const PRESETS = [
    { label: "25 دقيقة", mins: 25, emoji: "🍅" },
    { label: "45 دقيقة", mins: 45, emoji: "📚" },
    { label: "60 دقيقة", mins: 60, emoji: "🎯" },
    { label: "مخصص", mins: 0, emoji: "⚙️" },
  ];
  const [selected, setSelected] = useState(0);
  const [customMins, setCustomMins] = useState(30);
  const s = useTimerState();

  const totalSeconds = selected === 3 ? customMins * 60 : PRESETS[selected].mins * 60;
  const displayMins = Math.floor(s.secondsLeft / 60);
  const displaySecs = s.secondsLeft % 60;
  const pct = s.totalSeconds > 0 ? ((s.totalSeconds - s.secondsLeft) / s.totalSeconds) * 100 : 0;
  const circumference = 2 * Math.PI * 80;
  const strokeDashoffset = circumference - (pct / 100) * circumference;
  const isLast3 = s.secondsLeft <= 3 && s.secondsLeft > 0 && s.running;

  // صوت آخر 3 ثوانٍ — يشتغل داخل النافذة أيضاً
  const playRef = useRef(false);
  useEffect(() => {
    if (isLast3 && !playRef.current) {
      playRef.current = true;
    } else if (!isLast3) {
      playRef.current = false;
    }
  }, [isLast3]);

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: "28px", padding: "28px 24px", width: "100%", maxWidth: "340px", backdropFilter: "blur(20px)", fontFamily: "'Cairo',sans-serif", direction: "rtl" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h3 style={{ margin: 0, color: T.text, fontSize: "18px", fontWeight: "800" }}>⏱️ تايمر الدراسة</h3>
          <button onClick={onClose} style={{ background: "transparent", border: "none", fontSize: "20px", cursor: "pointer", color: T.subtext }}>✕</button>
        </div>

        {!s.started && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "16px" }}>
              {PRESETS.map((p, i) => (
                <button key={i} onClick={() => { setSelected(i); }} style={{ background: selected === i ? `linear-gradient(135deg,${T.accent},${T.accent2})` : T.sectionBg, color: selected === i ? "#fff" : T.text, border: `1.5px solid ${selected === i ? T.accent : T.cardBorder}`, borderRadius: "12px", padding: "10px 8px", fontSize: "13px", cursor: "pointer", fontFamily: "'Cairo',sans-serif", fontWeight: "700" }}>
                  {p.emoji} {p.label}
                </button>
              ))}
            </div>
            {selected === 3 && (
              <div style={{ marginBottom: "16px" }}>
                <input type="number" value={customMins} onChange={e => setCustomMins(Number(e.target.value))} min="1" max="180" style={{ background: T.inputBg, border: `1.5px solid ${T.cardBorder}`, borderRadius: "12px", padding: "10px 14px", fontSize: "16px", color: T.text, width: "100%", outline: "none", fontFamily: "'Cairo',sans-serif", direction: "rtl", boxSizing: "border-box", textAlign: "center" }} />
              </div>
            )}
          </>
        )}

        <div style={{ display: "flex", justifyContent: "center", marginBottom: "20px", position: "relative" }}>
          <svg width="190" height="190" style={{ transform: "rotate(-90deg)" }}>
            <circle cx="95" cy="95" r="80" fill="none" stroke="rgba(0,0,0,0.1)" strokeWidth="12"/>
            <circle cx="95" cy="95" r="80" fill="none" stroke={isLast3 ? "#e55333" : T.accent} strokeWidth="12" strokeLinecap="round"
              strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
              style={{ transition: "stroke-dashoffset 0.8s ease, stroke 0.3s" }}
            />
          </svg>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: "40px", fontWeight: "900", color: isLast3 ? "#e55333" : T.text, fontVariantNumeric: "tabular-nums", transition: "color 0.3s" }}>
              {String(displayMins).padStart(2,"0")}:{String(displaySecs).padStart(2,"0")}
            </span>
            <span style={{ fontSize: "12px", color: T.subtext }}>{Math.round(pct)}% مكتمل</span>
          </div>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          {!s.running ? (
            <button onClick={() => timerState.startTimer(totalSeconds)} style={{ flex: 2, background: `linear-gradient(135deg,${T.accent},${T.accent2})`, color: "#fff", border: "none", borderRadius: "14px", padding: "14px", fontSize: "16px", fontWeight: "700", cursor: "pointer", fontFamily: "'Cairo',sans-serif" }}>
              {s.started ? "▶ استمرار" : "▶ ابدأ"}
            </button>
          ) : (
            <button onClick={() => timerState.pauseTimer()} style={{ flex: 2, background: "rgba(255,193,7,0.2)", color: "#f0a500", border: "1.5px solid #f0a500", borderRadius: "14px", padding: "14px", fontSize: "16px", fontWeight: "700", cursor: "pointer", fontFamily: "'Cairo',sans-serif" }}>
              ⏸ إيقاف
            </button>
          )}
          {s.started && (
            <button onClick={() => timerState.resetTimer()} style={{ flex: 1, background: "rgba(229,83,51,0.15)", color: T.danger, border: `1.5px solid ${T.danger}`, borderRadius: "14px", padding: "14px", fontSize: "15px", fontWeight: "700", cursor: "pointer", fontFamily: "'Cairo',sans-serif" }}>
              ↺
            </button>
          )}
        </div>
        {s.secondsLeft === 0 && s.started && !s.running && (
          <div style={{ marginTop: "14px", background: "#23863618", border: "1px solid #23863644", borderRadius: "12px", padding: "12px", textAlign: "center" }}>
            <p style={{ margin: 0, color: "#238636", fontWeight: "700", fontSize: "15px" }}>🎉 أحسنت! انتهى الجلسة</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// SETTINGS
// ============================================================

function SettingsPage({ config, T, darkMode, setDarkMode, currentUser, updateUser, logout, onAdmin, onOpenTimer }) {
  const [editNickname, setEditNickname] = useState(currentUser.nickname || currentUser.username || "");
  const [editGrade, setEditGrade] = useState(currentUser.grade);
  const [editBranch, setEditBranch] = useState(currentUser.branch);
  const [saved, setSaved] = useState(false);

  const inp = { background: T.inputBg, border: `1.5px solid ${T.cardBorder}`, borderRadius: "12px", padding: "12px 14px", fontSize: "14px", color: T.text, width: "100%", outline: "none", fontFamily: "'Cairo',sans-serif", direction: "rtl", boxSizing: "border-box" };

  const handleSave = async () => {
    await updateUser({ nickname: editNickname.trim() || currentUser.username, grade: editGrade, branch: editBranch });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const [notifStatus, setNotifStatus] = useState(Notification.permission || "default");

  const requestNotifications = async () => {
    const perm = await Notification.requestPermission();
    setNotifStatus(perm);
    if (perm === "granted") new Notification("سواعد الخير ✅", { body: "تم تفعيل الإشعارات بنجاح!" });
  };

  // ─── تذكير المذاكرة المجدول (تاريخ + وقت بالدقيقة) ───
  const [reminders, setReminders] = useState(() => ls("sawaed_study_reminders", []));
  const [reminderTime, setReminderTime] = useState("");
  const [reminderLabel, setReminderLabel] = useState("");

  const addReminder = () => {
    if (!reminderTime) return;
    const newList = [...reminders, { id: Date.now(), time: reminderTime, label: reminderLabel.trim(), fired: false }];
    setReminders(newList);
    lsSet("sawaed_study_reminders", newList);
    setReminderTime(""); setReminderLabel("");
  };

  const deleteReminder = (id) => {
    const newList = reminders.filter(r => r.id !== id);
    setReminders(newList);
    lsSet("sawaed_study_reminders", newList);
  };

  // ─── العبارات التحفيزية بفاصل زمني ───
  const [quoteInterval, setQuoteInterval] = useState(() => ls("sawaed_quote_interval_min", 0));
  const setQuoteIntervalAndSave = (mins) => {
    setQuoteInterval(mins);
    lsSet("sawaed_quote_interval_min", mins);
    if (mins > 0) { lsSet("sawaed_quote_last_sent", Date.now()); } // تبدأ العد من الآن
  };

  return (
    <div style={{ padding: "20px 16px", fontFamily: "'Cairo',sans-serif", direction: "rtl" }}>
      <h2 style={{ color: T.text, fontSize: "20px", fontWeight: "800", margin: "0 0 20px" }}>⚙️ الإعدادات</h2>

      {/* تايمر دراسة */}
      <button onClick={() => onOpenTimer && onOpenTimer()} style={{ width: "100%", background: `linear-gradient(135deg,${T.accent}22,${T.accent2}22)`, border: `1.5px solid ${T.accent}55`, borderRadius: "16px", padding: "16px", display: "flex", alignItems: "center", gap: "14px", cursor: "pointer", marginBottom: "14px", fontFamily: "'Cairo',sans-serif", textAlign: "right" }}>
        <span style={{ fontSize: "28px" }}>⏱️</span>
        <div>
          <p style={{ margin: 0, fontWeight: "700", color: T.text, fontSize: "15px" }}>تايمر الدراسة</p>
          <p style={{ margin: "2px 0 0", fontSize: "12px", color: T.subtext }}>بومودورو، 45 دق، أو مخصص</p>
        </div>
      </button>

      {/* الإشعارات */}
      <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: "16px", padding: "16px", backdropFilter: "blur(12px)", marginBottom: "14px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p style={{ margin: 0, fontWeight: "700", color: T.text, fontSize: "14px" }}>🔔 الإشعارات</p>
            <p style={{ margin: "2px 0 0", fontSize: "12px", color: notifStatus === "granted" ? "#238636" : T.subtext }}>
              {notifStatus === "granted" ? "✅ مفعّلة" : notifStatus === "denied" ? "❌ محظورة من الإعدادات" : "غير مفعّلة"}
            </p>
          </div>
          {notifStatus !== "granted" && notifStatus !== "denied" && (
            <button onClick={requestNotifications} style={{ background: `linear-gradient(135deg,${T.accent},${T.accent2})`, color: "#fff", border: "none", borderRadius: "10px", padding: "8px 14px", fontSize: "13px", fontWeight: "700", cursor: "pointer", fontFamily: "'Cairo',sans-serif" }}>
              تفعيل
            </button>
          )}
        </div>
      </div>

      {/* تذكير المذاكرة المجدول */}
      <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: "20px", padding: "18px", backdropFilter: "blur(12px)", marginBottom: "14px" }}>
        <h3 style={{ color: T.text, margin: "0 0 14px", fontSize: "15px" }}>⏰ تذكير مذاكرة مجدول</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <input value={reminderLabel} onChange={e => setReminderLabel(e.target.value)} placeholder="عنوان التذكير (اختياري)" style={inp} />
          <input type="datetime-local" value={reminderTime} onChange={e => setReminderTime(e.target.value)} style={{ ...inp, direction: "ltr", textAlign: "right" }} />
          <button onClick={addReminder} disabled={!reminderTime} style={{ background: reminderTime ? `linear-gradient(135deg,${T.accent},${T.accent2})` : "#ccc", color: "#fff", border: "none", borderRadius: "12px", padding: "12px", fontSize: "14px", fontWeight: "700", cursor: reminderTime ? "pointer" : "not-allowed", fontFamily: "'Cairo',sans-serif" }}>
            ➕ جدولة التذكير
          </button>
          {reminders.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "6px" }}>
              {reminders.map(r => (
                <div key={r.id} style={{ display: "flex", alignItems: "center", gap: "10px", background: T.sectionBg, borderRadius: "10px", padding: "8px 12px" }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: "13px", color: T.text, fontWeight: "700" }}>{r.label || "تذكير مذاكرة"}</p>
                    <p style={{ margin: "2px 0 0", fontSize: "11px", color: T.subtext }}>{new Date(r.time).toLocaleString("ar")} {r.fired ? "· ✅ تم التنبيه" : ""}</p>
                  </div>
                  <button onClick={() => deleteReminder(r.id)} style={{ background: "#e5533322", border: "1px solid #e55", color: "#e55", borderRadius: "8px", padding: "6px 10px", cursor: "pointer", fontSize: "12px" }}>🗑️</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* العبارات التحفيزية بفاصل زمني */}
      <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: "20px", padding: "18px", backdropFilter: "blur(12px)", marginBottom: "14px" }}>
        <h3 style={{ color: T.text, margin: "0 0 14px", fontSize: "15px" }}>🔔 إشعارات تحفيز</h3>
        <p style={{ color: T.subtext, fontSize: "12px", margin: "0 0 10px" }}>حدد متى تريد أن نرسل لك الإشعار — ستصلك العبارات بالترتيب: الأولى، ثم الثانية في الفاصل التالي، وهكذا.</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {[
            { label: "إيقاف", value: 0 },
            { label: "كل 30 دقيقة", value: 30 },
            { label: "كل ساعة", value: 60 },
            { label: "كل ساعتين", value: 120 },
            { label: "كل 4 ساعات", value: 240 },
          ].map(opt => (
            <button key={opt.value} onClick={() => setQuoteIntervalAndSave(opt.value)} style={{ background: quoteInterval === opt.value ? `linear-gradient(135deg,${T.accent},${T.accent2})` : T.inputBg, color: quoteInterval === opt.value ? "#fff" : T.text, border: `1.5px solid ${quoteInterval === opt.value ? T.accent : T.cardBorder}`, borderRadius: "12px", padding: "8px 14px", fontSize: "13px", cursor: "pointer", fontFamily: "'Cairo',sans-serif" }}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {currentUser.email && (
        <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: "16px", padding: "14px 16px", backdropFilter: "blur(12px)", marginBottom: "14px" }}>
          <p style={{ margin: 0, fontSize: "13px", color: T.subtext }}>📧 {currentUser.email}</p>
        </div>
      )}
      <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: "20px", padding: "18px", backdropFilter: "blur(12px)", marginBottom: "14px" }}>
        <h3 style={{ color: T.text, margin: "0 0 14px", fontSize: "15px" }}>✏️ تعديل البيانات</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div>
            <label style={{ fontSize: "12px", color: T.subtext, marginBottom: "4px", display: "block" }}>اسم المستخدم (ثابت)</label>
            <input value={currentUser.username || ""} disabled style={{ ...inp, opacity: 0.6, cursor: "not-allowed" }} />
          </div>
          <div>
            <label style={{ fontSize: "12px", color: T.subtext, marginBottom: "4px", display: "block" }}>اللقب</label>
            <input value={editNickname} onChange={e => setEditNickname(e.target.value)} placeholder="لقبك (يظهر في الموقع)" style={inp} />
          </div>
          <select value={editGrade} onChange={e => setEditGrade(e.target.value)} style={inp}>
            {config.grades?.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <select value={editBranch} onChange={e => setEditBranch(e.target.value)} style={inp}>
            {config.branches?.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          <button onClick={handleSave} style={{ background: `linear-gradient(135deg,${T.accent},${T.accent2})`, color: "#fff", border: "none", borderRadius: "12px", padding: "12px", fontSize: "14px", fontWeight: "700", cursor: "pointer", fontFamily: "'Cairo',sans-serif" }}>
            {saved ? "✅ تم الحفظ!" : "حفظ التغييرات"}
          </button>
        </div>
      </div>
      <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: "20px", padding: "18px", backdropFilter: "blur(12px)", marginBottom: "14px" }}>
        <h3 style={{ color: T.text, margin: "0 0 14px", fontSize: "15px" }}>🎨 المظهر</h3>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ color: T.text, fontSize: "14px" }}>{darkMode ? "☀️ الوضع النهاري" : "🌙 الوضع الليلي"}</span>
          <button onClick={() => setDarkMode(!darkMode)} style={{ background: darkMode ? T.accent : "#ddd", border: "none", borderRadius: "20px", width: "50px", height: "26px", cursor: "pointer", position: "relative" }}>
            <div style={{ position: "absolute", top: "3px", left: darkMode ? "26px" : "3px", width: "20px", height: "20px", background: "#fff", borderRadius: "50%", transition: "left 0.3s" }} />
          </button>
        </div>
      </div>
      <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: "20px", padding: "18px", backdropFilter: "blur(12px)", marginBottom: "14px" }}>
        <h3 style={{ color: T.text, margin: "0 0 12px", fontSize: "15px" }}>📞 التواصل والاستفسارات</h3>
        {config.contactLinks?.map((c, i) => (
          <a key={i} href={c.url} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: "10px", background: T.sectionBg, borderRadius: "12px", padding: "12px", textDecoration: "none", marginBottom: "8px" }}>
            <span style={{ fontSize: "22px" }}>{c.icon}</span>
            <span style={{ color: T.text, fontSize: "14px" }}>{c.label}</span>
          </a>
        ))}
      </div>
      <button onClick={logout} style={{ width: "100%", background: "transparent", border: `1.5px solid ${T.danger}`, borderRadius: "14px", padding: "14px", fontSize: "15px", fontWeight: "700", color: T.danger, cursor: "pointer", fontFamily: "'Cairo',sans-serif" }}>
        🚪 تسجيل الخروج
      </button>
    </div>
  );
}

// ============================================================
// ADMIN PANEL
// ============================================================

function AdminPanel({ config, saveConfig, T, darkMode, editorRole, editorPermissions, onBack }) {
  const [section, setSection] = useState("main");

  // كل قسم يحدّد الأدوار المسموح لها بالوصول إليه
  // all/admin: صلاحية كاملة (Editor 1 و Editor 2)
  // notes: الملازم فقط (Editor 3) | foundation: التأسيس فقط (Editor 4) | content: أخبار/عبارات/دروس/إنجاز فقط (Editor 5)
  // custom: صلاحيات مخصّصة يحددها المسؤول (Nadosh The Top) لكل محرر على حدة عبر editorPermissions
  const allAdminSections = [
    { id: "splash", label: "شاشة البداية", icon: "🌟", roles: ["all", "admin"] },
    { id: "grades", label: "الصفوف والفروع", icon: "🏫", roles: ["all", "admin"] },
    { id: "subjects", label: "المواد الدراسية", icon: "📚", roles: ["all", "admin"] },
    { id: "sections", label: "أقسام المادة (الرزم، الكتب...)", icon: "📂", roles: ["all", "admin"] },
    { id: "folders", label: "إدارة المجلدات (الملازم والملفات)", icon: "📂", roles: ["all", "admin", "notes"] },
    { id: "lessons", label: "الدروس والإنجاز", icon: "✅", roles: ["all", "admin", "content"] },
    { id: "quotes", label: "العبارات التحفيزية", icon: "💬", roles: ["all", "admin", "content"] },
    { id: "foundation", label: "محتوى التأسيس", icon: "🏗️", roles: ["all", "admin", "foundation"] },
    { id: "news", label: "الأخبار", icon: "📰", roles: ["all", "admin", "content"] },
    { id: "announcements", label: "إشعارات وإعلانات فورية", icon: "📢", roles: ["all", "admin", "content"] },
    { id: "nav", label: "الصفحات والتنقل", icon: "🧭", roles: ["all", "admin"] },
    { id: "contact", label: "روابط التواصل", icon: "📞", roles: ["all", "admin"] },
    { id: "editors", label: "إدارة المحررين", icon: "🛡️", roles: ["admin"] },
    { id: "password", label: "تغيير كلمة السر", icon: "🔐", roles: ["all", "admin"] },
  ];

  const role = editorRole || "all";
  const isSectionAllowed = (id) => {
    if (role === "custom") return Array.isArray(editorPermissions) && editorPermissions.includes(id);
    return allAdminSections.find(s => s.id === id)?.roles.includes(role);
  };
  const adminSections = allAdminSections.filter(s => isSectionAllowed(s.id));

  useEffect(() => {
    if (section !== "main" && !isSectionAllowed(section)) setSection("main");
  }, [section, role]);

  if (section !== "main" && isSectionAllowed(section)) {
    if (section === "splash") return <AdminSplash config={config} saveConfig={saveConfig} T={T} onBack={() => setSection("main")} />;
    if (section === "grades") return <AdminGrades config={config} saveConfig={saveConfig} T={T} onBack={() => setSection("main")} />;
    if (section === "subjects") return <AdminSubjects config={config} saveConfig={saveConfig} T={T} onBack={() => setSection("main")} />;
    if (section === "sections") return <AdminSections config={config} saveConfig={saveConfig} T={T} onBack={() => setSection("main")} />;
    if (section === "folders") return <AdminFolders config={config} saveConfig={saveConfig} T={T} onBack={() => setSection("main")} />;
    if (section === "lessons") return <AdminLessons config={config} saveConfig={saveConfig} T={T} onBack={() => setSection("main")} />;
    if (section === "quotes") return <AdminQuotes config={config} saveConfig={saveConfig} T={T} onBack={() => setSection("main")} />;
    if (section === "foundation") return <AdminFoundation config={config} saveConfig={saveConfig} T={T} onBack={() => setSection("main")} />;
    if (section === "news") return <AdminNews config={config} saveConfig={saveConfig} T={T} onBack={() => setSection("main")} />;
    if (section === "announcements") return <AdminAnnouncements config={config} saveConfig={saveConfig} T={T} onBack={() => setSection("main")} />;
    if (section === "nav") return <AdminNav config={config} saveConfig={saveConfig} T={T} onBack={() => setSection("main")} />;
    if (section === "contact") return <AdminContact config={config} saveConfig={saveConfig} T={T} onBack={() => setSection("main")} />;
    if (section === "password") return <AdminPassword config={config} saveConfig={saveConfig} T={T} onBack={() => setSection("main")} />;
    if (section === "editors") return <AdminEditors config={config} saveConfig={saveConfig} T={T} onBack={() => setSection("main")} />;
  }

  return (
    <div style={{ minHeight: "100vh", maxWidth: APP_MAX_WIDTH, margin: "0 auto", background: T.bg, fontFamily: "'Cairo',sans-serif", direction: "rtl", paddingBottom: "30px" }}>
      <div style={{ background: T.card, backdropFilter: "blur(16px)", borderBottom: `1px solid ${T.cardBorder}`, padding: "16px", display: "flex", alignItems: "center", gap: "12px" }}>
        <button onClick={onBack} style={{ background: "transparent", border: "none", color: T.accent, fontSize: "15px", cursor: "pointer", fontFamily: "'Cairo',sans-serif" }}>← خروج</button>
        <div>
          <h2 style={{ margin: 0, color: T.accent, fontSize: "20px", fontWeight: "800" }}>🛡️ لوحة الإدارة</h2>
          <p style={{ margin: 0, fontSize: "12px", color: T.subtext }}>سواعد الخير</p>
        </div>
      </div>
      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
        {adminSections.map(s => (
          <button key={s.id} onClick={() => setSection(s.id)} style={{ background: T.card, border: `1px solid ${s.id === "password" ? T.danger + "44" : T.cardBorder}`, borderRadius: "16px", padding: "16px", display: "flex", alignItems: "center", gap: "14px", cursor: "pointer", backdropFilter: "blur(10px)", textAlign: "right" }}>
            <span style={{ fontSize: "26px" }}>{s.icon}</span>
            <span style={{ fontSize: "15px", fontWeight: "600", color: s.id === "password" ? T.danger : T.text, flex: 1 }}>{s.label}</span>
            <span style={{ color: T.subtext }}>‹</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// DRAG & DROP RESOURCE LIST
// ============================================================

function DraggableResourceList({ resources, setResources, T, onSave }) {
  const [editIdx, setEditIdx] = useState(null);
  const [editForm, setEditForm] = useState({});
  const dragItem = useRef(null);
  const dragOver = useRef(null);

  const handleDragStart = (i) => { dragItem.current = i; };
  const handleDragEnter = (i) => { dragOver.current = i; };
  const handleDragEnd = () => {
    if (dragItem.current === null || dragOver.current === null) return;
    const copy = [...resources];
    const dragged = copy.splice(dragItem.current, 1)[0];
    copy.splice(dragOver.current, 0, dragged);
    dragItem.current = null;
    dragOver.current = null;
    setResources(copy);
    onSave(copy);
  };

  const startEdit = (i) => {
    setEditIdx(i);
    setEditForm({ ...resources[i] });
  };

  const saveEdit = () => {
    const copy = [...resources];
    copy[editIdx] = { ...editForm };
    setResources(copy);
    onSave(copy);
    setEditIdx(null);
  };

  const deleteRes = (i) => {
    const copy = resources.filter((_, j) => j !== i);
    setResources(copy);
    onSave(copy);
  };

  const inp = { background: T.inputBg, border: `1.5px solid ${T.cardBorder}`, borderRadius: "10px", padding: "8px 10px", fontSize: "13px", color: T.text, width: "100%", outline: "none", fontFamily: "'Cairo',sans-serif", direction: "rtl", boxSizing: "border-box", marginBottom: "6px" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {resources.map((r, i) => (
        <div key={i} draggable onDragStart={() => handleDragStart(i)} onDragEnter={() => handleDragEnter(i)} onDragEnd={handleDragEnd} onDragOver={e => e.preventDefault()} style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: "12px", padding: "10px 12px", cursor: "grab", userSelect: "none" }}>
          {editIdx === i ? (
            <div>
              <input value={editForm.title || ""} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} placeholder="العنوان" style={inp} />
              <input value={editForm.url || ""} onChange={e => setEditForm(f => ({ ...f, url: e.target.value }))} placeholder="الرابط" style={inp} />
              <input value={editForm.description || ""} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} placeholder="الوصف" style={inp} />
              <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                <button onClick={saveEdit} style={{ background: `linear-gradient(135deg,${T.accent},${T.accent2})`, color: "#fff", border: "none", borderRadius: "8px", padding: "7px 14px", cursor: "pointer", fontFamily: "'Cairo',sans-serif", fontSize: "13px" }}>✅ حفظ</button>
                <button onClick={() => setEditIdx(null)} style={{ background: "transparent", border: `1px solid ${T.cardBorder}`, borderRadius: "8px", padding: "7px 14px", cursor: "pointer", color: T.subtext, fontFamily: "'Cairo',sans-serif", fontSize: "13px" }}>إلغاء</button>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "18px", color: T.subtext, cursor: "grab", flexShrink: 0 }}>☰</span>
              <span style={{ fontSize: "20px", flexShrink: 0 }}>{r.type === "pdf" ? "📄" : r.type === "image" ? "🖼️" : "🔗"}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: "700", color: T.text, fontSize: "13px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</p>
                {r.description && <p style={{ margin: "2px 0 0", fontSize: "11px", color: T.subtext, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.description}</p>}
              </div>
              <button onClick={() => startEdit(i)} style={{ background: `${T.accent}22`, border: "none", borderRadius: "8px", padding: "6px 10px", cursor: "pointer", fontSize: "14px", flexShrink: 0 }}>✏️</button>
              <button onClick={() => deleteRes(i)} style={{ background: "#e5533322", border: "1px solid #e55", color: "#e55", borderRadius: "8px", padding: "6px 10px", cursor: "pointer", fontSize: "13px", flexShrink: 0 }}>🗑️</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================================
// ADMIN PASSWORD
// ============================================================

function AdminPassword({ config, saveConfig, T, onBack }) {
  const OWNER_EMAIL = "sawaidualkhayri@gmail.com";
  const [step, setStep] = useState(1);
  const [sending, setSending] = useState(false);
  const [code, setCode] = useState("");
  const [inputCode, setInputCode] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const inp = { background: T.inputBg, border: `1.5px solid ${T.cardBorder}`, borderRadius: "12px", padding: "12px 14px", fontSize: "14px", color: T.text, width: "100%", outline: "none", fontFamily: "'Cairo',sans-serif", direction: "rtl", boxSizing: "border-box" };

  const generateCode = () => Math.floor(100000 + Math.random() * 900000).toString();

  const sendCode = async () => {
    setSending(true);
    setErr("");
    const generatedCode = generateCode();
    setCode(generatedCode);
    const expiresAt = Date.now() + 10 * 60 * 1000;
    await fbSet("admin_codes", "reset", { code: generatedCode, expiresAt });
    window.location.href = `mailto:${OWNER_EMAIL}?subject=كود تغيير كلمة السر - سواعد الخير&body=كود التحقق الخاص بك: ${generatedCode}%0A%0Aصالح لمدة 10 دقائق فقط.`;
    setSending(false);
    setStep(2);
    setMsg(`تم إرسال الكود إلى ${OWNER_EMAIL}`);
  };

  const verifyCode = async () => {
    setErr("");
    const stored = await fbGet("admin_codes", "reset");
    if (!stored) { setErr("انتهت صلاحية الكود، اطلب كوداً جديداً"); return; }
    if (Date.now() > stored.expiresAt) { setErr("انتهت صلاحية الكود (10 دقائق)"); return; }
    if (inputCode.trim() !== stored.code) { setErr("الكود غلط!"); return; }
    setStep(3);
  };

  const changePassword = async () => {
    setErr("");
    if (newPass.length < 4) { setErr("كلمة السر أقل من 4 أحرف"); return; }
    if (newPass !== confirmPass) { setErr("كلمتا السر غير متطابقتين"); return; }
    await saveConfig({ ...config, adminPassword: newPass });
    await fbDelete("admin_codes", "reset");
    setStep(4);
  };

  return (
    <AdminSection title="تغيير كلمة السر" icon="🔐" T={T} onBack={onBack} onSave={() => {}}>
      <div style={{ background: T.sectionBg, border: `1px solid ${T.cardBorder}`, borderRadius: "16px", padding: "16px", marginBottom: "16px" }}>
        <p style={{ color: T.subtext, fontSize: "13px", margin: 0 }}>🔒 لتغيير كلمة السر، سيتم إرسال كود تحقق إلى الإيميل الرسمي فقط:</p>
        <p style={{ color: T.accent, fontSize: "14px", fontWeight: "700", margin: "6px 0 0" }}>{OWNER_EMAIL}</p>
      </div>
      {step === 1 && (
        <div>
          <p style={{ color: T.text, fontSize: "14px", margin: "0 0 14px" }}>اضغط لإرسال كود التحقق إلى إيميلك:</p>
          <button onClick={sendCode} disabled={sending} style={{ width: "100%", background: `linear-gradient(135deg,${T.accent},${T.accent2})`, color: "#fff", border: "none", borderRadius: "14px", padding: "14px", fontSize: "15px", fontWeight: "700", cursor: "pointer", fontFamily: "'Cairo',sans-serif" }}>
            {sending ? "⏳ جاري الإرسال..." : "📧 إرسال كود التحقق"}
          </button>
        </div>
      )}
      {step === 2 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {msg && <p style={{ color: "#238636", fontSize: "13px", margin: 0 }}>✅ {msg}</p>}
          <p style={{ color: T.text, fontSize: "14px", margin: 0 }}>أدخل الكود المرسل للإيميل:</p>
          <input value={inputCode} onChange={e => { setInputCode(e.target.value); setErr(""); }} placeholder="الكود المكون من 6 أرقام" style={inp} type="number" />
          {err && <p style={{ color: "#e55", fontSize: "13px", margin: 0 }}>{err}</p>}
          <button onClick={verifyCode} style={{ background: `linear-gradient(135deg,${T.accent},${T.accent2})`, color: "#fff", border: "none", borderRadius: "12px", padding: "12px", fontSize: "14px", fontWeight: "700", cursor: "pointer", fontFamily: "'Cairo',sans-serif" }}>تحقق من الكود ✓</button>
          <button onClick={() => { setStep(1); setErr(""); setMsg(""); }} style={{ background: "transparent", border: "none", color: T.subtext, cursor: "pointer", fontSize: "13px", fontFamily: "'Cairo',sans-serif" }}>← إرسال كود جديد</button>
        </div>
      )}
      {step === 3 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <p style={{ color: "#238636", fontSize: "13px", margin: 0 }}>✅ تم التحقق! أدخل كلمة السر الجديدة:</p>
          <input value={newPass} onChange={e => { setNewPass(e.target.value); setErr(""); }} placeholder="كلمة السر الجديدة" type="password" style={inp} />
          <input value={confirmPass} onChange={e => { setConfirmPass(e.target.value); setErr(""); }} placeholder="تأكيد كلمة السر" type="password" style={inp} />
          {err && <p style={{ color: "#e55", fontSize: "13px", margin: 0 }}>{err}</p>}
          <button onClick={changePassword} style={{ background: `linear-gradient(135deg,${T.accent},${T.accent2})`, color: "#fff", border: "none", borderRadius: "12px", padding: "12px", fontSize: "14px", fontWeight: "700", cursor: "pointer", fontFamily: "'Cairo',sans-serif" }}>💾 حفظ كلمة السر الجديدة</button>
        </div>
      )}
      {step === 4 && (
        <div style={{ textAlign: "center", padding: "20px" }}>
          <div style={{ fontSize: "48px", marginBottom: "12px" }}>🎉</div>
          <p style={{ color: "#238636", fontWeight: "700", fontSize: "16px" }}>تم تغيير كلمة السر بنجاح!</p>
          <button onClick={onBack} style={{ marginTop: "14px", background: `linear-gradient(135deg,${T.accent},${T.accent2})`, color: "#fff", border: "none", borderRadius: "12px", padding: "12px 24px", fontSize: "14px", fontWeight: "700", cursor: "pointer", fontFamily: "'Cairo',sans-serif" }}>← رجوع للإدارة</button>
        </div>
      )}
    </AdminSection>
  );
}

// ============================================================
// OTHER ADMIN SECTIONS
// ============================================================

function AdminSplash({ config, saveConfig, T, onBack }) {
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

function AdminGrades({ config, saveConfig, T, onBack }) {
  const [grades, setGrades] = useState([...config.grades]);
  const [branches, setBranches] = useState([...config.branches]);
  const [ng, setNg] = useState("");
  const [nb, setNb] = useState("");

  const inp = { background: T.inputBg, border: `1.5px solid ${T.cardBorder}`, borderRadius: "12px", padding: "10px 12px", fontSize: "14px", color: T.text, flex: 1, outline: "none", fontFamily: "'Cairo',sans-serif", direction: "rtl" };

  return (
    <AdminSection title="الصفوف والفروع" icon="🏫" T={T} onBack={onBack} onSave={() => saveConfig({ ...config, grades, branches })}>
      <p style={{ color: T.text, fontWeight: "700", marginBottom: "10px" }}>الصفوف:</p>
      <ListEditor items={grades} setItems={setGrades} newItem={ng} setNewItem={setNg} T={T} inp={inp} placeholder="صف جديد..." />
      <p style={{ color: T.text, fontWeight: "700", margin: "16px 0 10px" }}>الفروع:</p>
      <ListEditor items={branches} setItems={setBranches} newItem={nb} setNewItem={setNb} T={T} inp={inp} placeholder="فرع جديد..." />
    </AdminSection>
  );
}

// ============================================================
// ADMIN EDITORS — إدارة المحررين (للـ super فقط)
// ============================================================
function AdminEditors({ config, saveConfig, T, onBack }) {
  const [editors, setEditors] = useState(config.editors || []);
  const [form, setForm] = useState({ username: "", password: "", role: "notes", permissions: [] });
  const [err, setErr] = useState("");
  const [flashSaved, setFlashSaved] = useState(false);
  const [editIdx, setEditIdx] = useState(null);
  const [editForm, setEditForm] = useState(null);

  const ROLES = [
    { value: "all",        label: "محرر كامل (كل الصلاحيات ما عدا إدارة المحررين)" },
    { value: "admin",      label: "مسؤول (كل الصلاحيات + إدارة المحررين)" },
    { value: "notes",      label: "الملازم فقط" },
    { value: "foundation", label: "تأسيس فقط" },
    { value: "content",    label: "أخبار + عبارات + دروس + إنجاز" },
    { value: "custom",     label: "صلاحيات مخصّصة (اختر بنفسك)" },
  ];

  // القوائم المتاحة للتخصيص اليدوي — قسم "إدارة المحررين" غير متاح هنا عن قصد ليبقى حصرياً على دور "مسؤول"
  const PERMISSION_OPTIONS = [
    { id: "splash", label: "شاشة البداية" },
    { id: "grades", label: "الصفوف والفروع" },
    { id: "subjects", label: "المواد الدراسية" },
    { id: "sections", label: "أقسام المادة" },
    { id: "folders", label: "إدارة المجلدات (الملازم والملفات)" },
    { id: "lessons", label: "الدروس والإنجاز" },
    { id: "quotes", label: "العبارات التحفيزية" },
    { id: "foundation", label: "محتوى التأسيس" },
    { id: "news", label: "الأخبار" },
    { id: "announcements", label: "إشعارات وإعلانات فورية" },
    { id: "nav", label: "الصفحات والتنقل" },
    { id: "contact", label: "روابط التواصل" },
    { id: "password", label: "تغيير كلمة السر" },
  ];

  const inp = { background: T.inputBg, border: `1.5px solid ${T.cardBorder}`, borderRadius: "12px", padding: "12px 14px", fontSize: "14px", color: T.text, width: "100%", outline: "none", fontFamily: "'Cairo',sans-serif", direction: "rtl", boxSizing: "border-box" };

  const togglePermission = (list, id) => list.includes(id) ? list.filter(p => p !== id) : [...list, id];

  const roleLabel = (e) => {
    if (e.role === "custom") {
      const names = (e.permissions || []).map(p => PERMISSION_OPTIONS.find(o => o.id === p)?.label || p);
      return names.length ? `مخصّصة: ${names.join("، ")}` : "مخصّصة (بدون صلاحيات محددة)";
    }
    return ROLES.find(r => r.value === e.role)?.label || e.role;
  };

  const addEditor = async () => {
    const uname = form.username.trim();
    if (!uname || !form.password.trim()) { setErr("أدخل الاسم وكلمة السر"); return; }
    if (editors.some(e => normalizeUsername(e.username) === normalizeUsername(uname))) { setErr("الاسم موجود مسبقاً"); return; }
    const newEditor = { username: uname, password: form.password.trim(), role: form.role, permissions: form.role === "custom" ? form.permissions : undefined };
    const updated = [...editors, newEditor];
    setEditors(updated);
    await saveConfig({ ...config, editors: updated });
    setForm({ username: "", password: "", role: "notes", permissions: [] });
    setErr(""); setFlashSaved(true); setTimeout(() => setFlashSaved(false), 2000);
  };

  const removeEditor = async (idx) => {
    if (!window.confirm("حذف هذا المحرر؟")) return;
    const updated = editors.filter((_, i) => i !== idx);
    setEditors(updated);
    await saveConfig({ ...config, editors: updated });
    if (editIdx === idx) { setEditIdx(null); setEditForm(null); }
  };

  const startEdit = (i) => {
    setEditIdx(i);
    setEditForm({ ...editors[i], permissions: editors[i].permissions || [] });
    setErr("");
  };

  const saveEdit = async () => {
    const uname = editForm.username.trim();
    if (!uname || !editForm.password.trim()) { setErr("أدخل الاسم وكلمة السر"); return; }
    if (editors.some((e, i) => i !== editIdx && normalizeUsername(e.username) === normalizeUsername(uname))) { setErr("الاسم موجود مسبقاً لمحرر آخر"); return; }
    const updated = [...editors];
    updated[editIdx] = { username: uname, password: editForm.password.trim(), role: editForm.role, permissions: editForm.role === "custom" ? editForm.permissions : undefined };
    setEditors(updated);
    await saveConfig({ ...config, editors: updated });
    setEditIdx(null); setEditForm(null); setErr("");
  };

  return (
    <div style={{ minHeight: "100vh", maxWidth: APP_MAX_WIDTH, margin: "0 auto", background: T.bg, fontFamily: "'Cairo',sans-serif", direction: "rtl" }}>
      <div style={{ background: T.card, backdropFilter: "blur(16px)", borderBottom: `1px solid ${T.cardBorder}`, padding: "16px", display: "flex", alignItems: "center", gap: "12px" }}>
        <button onClick={onBack} style={{ background: "transparent", border: "none", color: T.accent, fontSize: "15px", cursor: "pointer", fontFamily: "'Cairo',sans-serif" }}>← رجوع</button>
        <h2 style={{ margin: 0, color: T.accent, fontSize: "18px", fontWeight: "800" }}>🛡️ إدارة المحررين</h2>
      </div>
      <div style={{ padding: "16px" }}>
        {editors.map((e, i) => (
          <div key={i} style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: "14px", padding: "12px 14px", marginBottom: "8px" }}>
            {editIdx === i ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <input value={editForm.username} onChange={ev => setEditForm(f => ({ ...f, username: ev.target.value }))} placeholder="اسم المستخدم" style={inp} />
                <input value={editForm.password} onChange={ev => setEditForm(f => ({ ...f, password: ev.target.value }))} placeholder="كلمة السر" style={inp} />
                <select value={editForm.role} onChange={ev => setEditForm(f => ({ ...f, role: ev.target.value }))} style={inp}>
                  {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
                {editForm.role === "custom" && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", background: T.sectionBg, borderRadius: "10px", padding: "10px" }}>
                    {PERMISSION_OPTIONS.map(opt => (
                      <label key={opt.id} style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", color: T.text, background: editForm.permissions.includes(opt.id) ? `${T.accent}22` : "transparent", border: `1px solid ${editForm.permissions.includes(opt.id) ? T.accent : T.cardBorder}`, borderRadius: "8px", padding: "5px 8px", cursor: "pointer" }}>
                        <input type="checkbox" checked={editForm.permissions.includes(opt.id)} onChange={() => setEditForm(f => ({ ...f, permissions: togglePermission(f.permissions, opt.id) }))} style={{ accentColor: T.accent }} />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                )}
                {err && <p style={{ color: T.danger, fontSize: "12px", margin: 0 }}>{err}</p>}
                <div style={{ display: "flex", gap: "8px" }}>
                  <button onClick={saveEdit} style={{ flex: 1, background: `linear-gradient(135deg,${T.accent},${T.accent2})`, color: "#fff", border: "none", borderRadius: "10px", padding: "10px", cursor: "pointer", fontWeight: "700", fontFamily: "'Cairo',sans-serif" }}>✅ حفظ</button>
                  <button onClick={() => { setEditIdx(null); setEditForm(null); setErr(""); }} style={{ flex: 1, background: "transparent", border: `1px solid ${T.cardBorder}`, color: T.subtext, borderRadius: "10px", padding: "10px", cursor: "pointer", fontFamily: "'Cairo',sans-serif" }}>إلغاء</button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontWeight: "700", color: T.text, fontSize: "14px" }}>{e.username}</p>
                  <p style={{ margin: "2px 0 0", fontSize: "12px", color: T.subtext }}>{roleLabel(e)} · كلمة السر: {e.password}</p>
                </div>
                <button onClick={() => startEdit(i)} style={{ background: `${T.accent}22`, border: "none", borderRadius: "8px", padding: "6px 10px", cursor: "pointer", fontSize: "14px" }}>✏️</button>
                <button onClick={() => removeEditor(i)} style={{ background: "#e5533318", color: "#e55333", border: "1px solid #e5533340", borderRadius: "8px", padding: "6px 10px", cursor: "pointer", fontSize: "12px", fontFamily: "'Cairo',sans-serif" }}>🗑️ حذف</button>
              </div>
            )}
          </div>
        ))}
        <h3 style={{ color: T.text, margin: "16px 0 10px", fontSize: "15px" }}>➕ إضافة محرر جديد</h3>
        <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: "16px", padding: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
          <input value={form.username} onChange={e => { setForm(f => ({ ...f, username: e.target.value })); setErr(""); }} placeholder="اسم المستخدم للمحرر" style={inp} />
          <input value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="كلمة السر" style={inp} />
          <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} style={inp}>
            {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          {form.role === "custom" && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", background: T.sectionBg, borderRadius: "10px", padding: "10px" }}>
              {PERMISSION_OPTIONS.map(opt => (
                <label key={opt.id} style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", color: T.text, background: form.permissions.includes(opt.id) ? `${T.accent}22` : "transparent", border: `1px solid ${form.permissions.includes(opt.id) ? T.accent : T.cardBorder}`, borderRadius: "8px", padding: "5px 8px", cursor: "pointer" }}>
                  <input type="checkbox" checked={form.permissions.includes(opt.id)} onChange={() => setForm(f => ({ ...f, permissions: togglePermission(f.permissions, opt.id) }))} style={{ accentColor: T.accent }} />
                  {opt.label}
                </label>
              ))}
            </div>
          )}
          {err && <p style={{ color: T.danger, fontSize: "12px", margin: 0 }}>{err}</p>}
          <button onClick={addEditor} style={{ background: `linear-gradient(135deg,${T.accent},${T.accent2})`, color: "#fff", border: "none", borderRadius: "12px", padding: "12px", fontSize: "14px", fontWeight: "700", cursor: "pointer", fontFamily: "'Cairo',sans-serif" }}>
            {flashSaved ? "✅ تم الحفظ!" : "إضافة محرر"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AdminSubjects({ config, saveConfig, T, onBack }) {
  const keys = (config.grades || []).flatMap(g => (config.branches || []).map(b => `${g}_${b}`));
  const [selKey, setSelKey] = useState(keys[0] || "");
  const [selSemester, setSelSemester] = useState("1"); // الافتراضي: الفصل الأول
  const [subs, setSubs] = useState({ ...config.subjects });
  const [newSub, setNewSub] = useState("");

  // توليد مفتاح فريد مفرز يدمج (الصف + الفرع + الفصل الدراسي) لمنع تداخل المواد تماماً
  const currentCompoundKey = `${selKey}_sem${selSemester}`;

  const inp = { 
    background: T.inputBg, 
    border: `1.5px solid ${T.cardBorder}`, 
    borderRadius: "12px", 
    padding: "10px 12px", 
    fontSize: "14px", 
    color: T.text, 
    flex: 1, 
    outline: "none", 
    fontFamily: "'Cairo',sans-serif", 
    direction: "rtl" 
  };

  return (
    <AdminSection title="المواد الدراسية" icon="📚" T={T} onBack={onBack} onSave={() => saveConfig({ ...config, subjects: subs })}>
      
      {/* 1. اختيار الصف والفرع */}
      <label style={{ fontSize: "13px", color: T.subtext, display: "block", marginBottom: "4px" }}>اختر الصف والفرع:</label>
      <select value={selKey} onChange={e => setSelKey(e.target.value)} style={{ ...inp, flex: "unset", width: "100%", marginBottom: "14px", padding: "12px" }}>
        {keys.map(k => <option key={k} value={k}>{k.replace("_", " --- ")}</option>)}
      </select>

      {/* 2. إضافة قائمة اختيار الفصل الدراسي لحل مشكلة الفصل */}
      <label style={{ fontSize: "13px", color: T.subtext, display: "block", marginBottom: "4px" }}>اختر الفصل الدراسي للمادة:</label>
      <select value={selSemester} onChange={e => setSelSemester(e.target.value)} style={{ ...inp, flex: "unset", width: "100%", marginBottom: "20px", padding: "12px" }}>
        <option value="1">الفصل الدراسي الأول</option>
        <option value="2">الفصل الدراسي الثاني</option>
      </select>

      <hr style={{ border: `0.5px solid ${T.cardBorder}`, marginBottom: "20px" }} />

      {/* 3. إدارة المواد بناءً على المفتاح المركب الجديد */}
      <ListEditor 
        items={subs[currentCompoundKey] || []} 
        setItems={v => setSubs(p => ({ ...p, [currentCompoundKey]: v }))} 
        newItem={newSub} 
        setNewItem={setNewSub} 
        T={T} 
        inp={inp} 
        placeholder="اسم المادة الجديدة..." 
      />
    </AdminSection>
  );
}


function AdminLessons({ config, saveConfig, T, onBack }) {
  const keys = (config.grades || []).flatMap(g => (config.branches || []).map(b => `${g}_${b}`));
  const [selGB, setSelGB] = useState(keys[0] || "");
  const [selSemester, setSelSemester] = useState("1"); // إضافة حالة اختيار الفصل
  
  // المفتاح المركب لقراءة المواد الصحيحة المفصولة بالفصل الدراسي
  const subjectsKey = `${selGB}_sem${selSemester}`;
  const currentAvailableSubjects = config.subjects?.[subjectsKey] || [];

  const [selSub, setSelSub] = useState(currentAvailableSubjects[0] || "");
  const [color, setColor] = useState(config.progressBarColor || "#6C63FF");
  
  // تعديل مفتاح حفظ الدروس ليشمل الفصل الدراسي لمنع تداخل الدروس نهائياً
  const lKey = `lessons_${selGB}_sem${selSemester}_${selSub}`;
  
  const [lessons, setLessons] = useState([]);
  const [newL, setNewL] = useState("");

  // تحديث المادة المختارة تلقائياً عند تغيير الصف أو الفصل الدراسي
  useEffect(() => {
    setSelSub(currentAvailableSubjects[0] || "");
  }, [selGB, selSemester]);

  useEffect(() => {
    const raw = config[lKey];
    setLessons(raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : []);
  }, [lKey]);

  const inp = { 
    background: T.inputBg, 
    border: `1.5px solid ${T.cardBorder}`, 
    borderRadius: "12px", 
    padding: "10px 12px", 
    fontSize: "13px", 
    color: T.text, 
    flex: 1, 
    outline: "none", 
    fontFamily: "'Cairo',sans-serif", 
    direction: "rtl" 
  };
  
  const sel = { ...inp, flex: "unset", width: "100%", marginBottom: "8px", padding: "10px 12px" };

  return ( 
    <AdminSection title="الدروس والإنجاز" icon="✅" T={T} onBack={onBack} onSave={() => saveConfig({ ...config, [lKey]: JSON.stringify(lessons), progressBarColor: color })}> 
      
      <p style={{ color: T.text, fontWeight: "700", marginBottom: "8px" }}>لون شريط الإنجاز:</p> 
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}> 
        <input type="color" value={color} onChange={e => setColor(e.target.value)} style={{ width: "50px", height: "40px", border: "none", borderRadius: "10px", cursor: "pointer" }} /> 
        <div style={{ flex: 1, height: "10px", borderRadius: "6px", background: color }} /> 
      </div> 

      {/* 1. اختيار الصف والفرع */}
      <label style={{ fontSize: "12px", color: T.subtext, display: "block", marginBottom: "2px" }}>اختر الصف والفرع:</label>
      <select value={selGB} onChange={e => setSelGB(e.target.value)} style={sel}> 
        {keys.map(k => <option key={k} value={k}>{k.replace("_", " --- ")}</option>)} 
      </select> 

      {/* 2. إضافة قائمة تحديد الفصل الدراسي للدروس */}
      <label style={{ fontSize: "12px", color: T.subtext, display: "block", marginBottom: "2px" }}>اختر الفصل الدراسي:</label>
      <select value={selSemester} onChange={e => setSelSemester(e.target.value)} style={sel}>
        <option value="1">الفصل الدراسي الأول</option>
        <option value="2">الفصل الدراسي الثاني</option>
      </select>

      {/* 3. اختيار المادة (تظهر هنا المواد التابعة للفصل المختار فقط) */}
      <label style={{ fontSize: "12px", color: T.subtext, display: "block", marginBottom: "2px" }}>اختر المادة:</label>
      <select value={selSub} onChange={e => setSelSub(e.target.value)} style={sel}> 
        {currentAvailableSubjects.map(s => <option key={s} value={s}>{s}</option>)} 
      </select> 

      <hr style={{ border: `0.5px solid ${T.cardBorder}`, margin: "15px 0" }} />

      <ListEditor items={lessons} setItems={setLessons} newItem={newL} setNewItem={setNewL} T={T} inp={inp} placeholder="اسم الدرس الجديد..." /> 
    </AdminSection> 
  ); 
}


function AdminQuotes({ config, saveConfig, T, onBack }) {
  const [quotes, setQuotes] = useState([...(config.motivationalQuotes || [])]);
  const [fixed, setFixed] = useState(config.motivationalFixed);
  const [form, setForm] = useState({ text: "", duration: 60 });

  const inp = { background: T.inputBg, border: `1.5px solid ${T.cardBorder}`, borderRadius: "12px", padding: "10px 12px", fontSize: "13px", color: T.text, width: "100%", outline: "none", fontFamily: "'Cairo',sans-serif", direction: "rtl", boxSizing: "border-box" };

  return (
    <AdminSection title="العبارات التحفيزية" icon="💬" T={T} onBack={onBack} onSave={() => saveConfig({ ...config, motivationalQuotes: quotes, motivationalFixed: fixed })}>
      <label style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px", color: T.text, fontSize: "14px" }}>
        <input type="checkbox" checked={fixed} onChange={e => setFixed(e.target.checked)} style={{ accentColor: T.accent }} />
        عبارة ثابتة (لا تتغير)
      </label>
      <div style={{ background: T.sectionBg, borderRadius: "14px", padding: "12px", marginBottom: "12px" }}>
        <textarea value={form.text} onChange={e => setForm(f => ({ ...f, text: e.target.value }))} placeholder="نص العبارة..." style={{ ...inp, height: "70px", resize: "vertical", marginBottom: "8px" }} />
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
          <span style={{ color: T.subtext, fontSize: "13px" }}>مدة الظهور (دقيقة):</span>
          <input type="number" value={form.duration} onChange={e => setForm(f => ({ ...f, duration: +e.target.value }))} style={{ ...inp, width: "80px" }} />
        </div>
        <button onClick={() => { if (!form.text) return; setQuotes(q => [...q, { ...form }]); setForm({ text: "", duration: 60 }); }} style={{ background: `linear-gradient(135deg,${T.accent},${T.accent2})`, color: "#fff", border: "none", borderRadius: "10px", padding: "10px 18px", cursor: "pointer", fontFamily: "'Cairo',sans-serif" }}>+ إضافة</button>
      </div>
      {quotes.map((q, i) => (
        <div key={i} style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: "12px", padding: "10px 12px", marginBottom: "8px", display: "flex", gap: "10px", alignItems: "center" }}>
          <div style={{ flex: 1 }}>
            <p style={{ margin: "0 0 3px", color: T.text, fontSize: "13px" }}>{q.text}</p>
            <p style={{ margin: 0, color: T.subtext, fontSize: "11px" }}>كل {q.duration} دقيقة</p>
          </div>
          <button onClick={() => setQuotes(q => q.filter((_, j) => j !== i))} style={{ background: "#e5533322", border: "1px solid #e55", color: "#e55", borderRadius: "8px", padding: "6px 10px", cursor: "pointer" }}>🗑️</button>
        </div>
      ))}
    </AdminSection>
  );
}

function AdminFoundation({ config, saveConfig, T, onBack }) {
  const [selSub, setSelSub] = useState(config.foundationSubjects?.[0] || "");
  const [selBranch, setSelBranch] = useState("عام");
  const [selType, setSelType] = useState("electronic");
  const [selArea, setSelArea] = useState((config.foundationTypes?.electronic || [])[0] || "");
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [form, setForm] = useState({ title: "", url: "", description: "", teacher: "", type: "link" });
  const fileRef = useRef();

  const foundKey = `found_${selSub}_${selBranch}_${selType}_${selArea}`;
  const [items, setItems] = useState([]);

  useEffect(() => { const raw = config[foundKey]; setItems(raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : []); }, [foundKey]);

  const save = async (newItems) => {
    await saveConfig({ ...config, [foundKey]: JSON.stringify(newItems) });
    setItems(newItems);
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true); setUploadPct(0);
    try {
      const driveLink = prompt("أدخل رابط Google Drive للملف:");
      if (driveLink) {
        const fileType = file.type.includes("pdf") ? "pdf" : file.type.includes("image") ? "image" : "link";
        setForm(f => ({ ...f, title: f.title || file.name.replace(/\.[^/.]+$/, ""), url: driveLink, type: fileType }));
      }
    } catch { alert("فشل رفع الملف"); }
    setUploading(false);
  };

  const inp = { background: T.inputBg, border: `1.5px solid ${T.cardBorder}`, borderRadius: "12px", padding: "10px 12px", fontSize: "13px", color: T.text, width: "100%", outline: "none", fontFamily: "'Cairo',sans-serif", direction: "rtl", boxSizing: "border-box", marginBottom: "8px" };
  const sel = { ...inp };

  return (
    <AdminSection title="محتوى التأسيس" icon="🏗️" T={T} onBack={onBack} onSave={() => {}}>
      <select value={selSub} onChange={e => setSelSub(e.target.value)} style={sel}>{config.foundationSubjects?.map(s => <option key={s} value={s}>{s}</option>)}</select>
      <select value={selBranch} onChange={e => setSelBranch(e.target.value)} style={sel}>
        <option value="عام">عام</option>
        {(config.foundationBranches?.[selSub] || []).map(b => <option key={b} value={b}>{b}</option>)}
      </select>
      <select value={selType} onChange={e => { setSelType(e.target.value); setSelArea((config.foundationTypes?.[e.target.value] || [])[0] || ""); }} style={sel}>
        <option value="electronic">إلكتروني</option>
        <option value="inPerson">وجاهي</option>
      </select>
      <select value={selArea} onChange={e => setSelArea(e.target.value)} style={sel}>
        {(config.foundationTypes?.[selType] || []).map(a => <option key={a} value={a}>{a}</option>)}
      </select>
      <div style={{ background: T.sectionBg, borderRadius: "14px", padding: "12px", marginBottom: "12px", border: `1px solid ${T.cardBorder}` }}>
        <button onClick={() => fileRef.current?.click()} style={{ width: "100%", background: `linear-gradient(135deg,${T.accent}22,${T.accent2}22)`, border: `2px dashed ${T.accent}`, borderRadius: "12px", padding: "14px", color: T.accent, fontSize: "13px", fontWeight: "700", cursor: "pointer", fontFamily: "'Cairo',sans-serif", marginBottom: "10px" }}>
          {uploading ? `⏳ ${uploadPct}%` : "📤 رفع ملف (Google Drive)"}
        </button>
        <input ref={fileRef} type="file" accept=".pdf,image/*" onChange={handleFile} style={{ display: "none" }} />
        {uploading && <div style={{ background: T.inputBg, borderRadius: "8px", height: "6px", overflow: "hidden", marginBottom: "10px" }}><div style={{ height: "100%", width: `${uploadPct}%`, background: T.accent }} /></div>}
        <input value={form.teacher} onChange={e => setForm(f => ({ ...f, teacher: e.target.value }))} placeholder="اسم المدرس (اختياري)" style={inp} />
        <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="العنوان *" style={inp} />
        <input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="أو أدخل رابطاً" style={inp} />
        <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="وصف (اختياري)" style={inp} />
        <button onClick={async () => { if (!form.title || !form.url) return; await save([...items, { ...form }]); setForm({ title: "", url: "", description: "", teacher: "", type: "link" }); }} style={{ background: `linear-gradient(135deg,${T.accent},${T.accent2})`, color: "#fff", border: "none", borderRadius: "10px", padding: "10px 18px", cursor: "pointer", fontFamily: "'Cairo',sans-serif" }}>+ إضافة</button>
      </div>
      {items.length > 0 && (
        <div>
          <p style={{ color: T.subtext, fontSize: "12px", margin: "0 0 8px", textAlign: "center" }}>اسحب ↕ لتغيير الترتيب • ✏️ للتعديل • 🗑️ للحذف</p>
          <DraggableResourceList resources={items} setResources={setItems} T={T} onSave={save} />
        </div>
      )}
    </AdminSection>
  );
}

// ============================================================
// ADMIN ANNOUNCEMENTS — إشعارات فورية مستقلة عن الأخبار (محرر 1، محرر 5، ومسؤول Nadosh فقط)
// ============================================================
function AdminAnnouncements({ config, saveConfig, T, onBack }) {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ title: "", body: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    fbGet("announcements").then(d => { if (d) setItems(d.sort((a, b) => b.createdAt - a.createdAt)); });
  }, []);

  const inp = { background: T.inputBg, border: `1.5px solid ${T.cardBorder}`, borderRadius: "12px", padding: "10px 12px", fontSize: "13px", color: T.text, width: "100%", outline: "none", fontFamily: "'Cairo',sans-serif", direction: "rtl", boxSizing: "border-box", marginBottom: "8px" };

  const sendAnnouncement = async () => {
    if (!form.title.trim()) return;
    setSending(true);
    const payload = { title: form.title.trim(), body: form.body.trim(), createdAt: Date.now() };
    const id = await fbAdd("announcements", payload);
    if (id) {
      setItems(list => [{ id, ...payload }, ...list]);
      lsSet("sawaed_last_announcement_id", id); // حتى لا يستقبل المُرسِل نفسه إشعاراً مكرراً
      if (typeof sendLocalNotification === "function") sendLocalNotification(`📢 ${payload.title}`, payload.body);
      setForm({ title: "", body: "" });
      setSent(true);
      setTimeout(() => setSent(false), 2000);
    } else {
      alert("⚠️ تعذّر إرسال الإشعار. تحقق من اتصالك بالإنترنت وحاول مرة أخرى.");
    }
    setSending(false);
  };

  const deleteAnnouncement = async (id) => {
    await fbDelete("announcements", id);
    setItems(list => list.filter(x => x.id !== id));
  };

  return (
    <AdminSection title="إشعارات وإعلانات فورية" icon="📢" T={T} onBack={onBack} onSave={() => {}}>
      <p style={{ color: T.subtext, fontSize: "12px", margin: "0 0 12px" }}>
        أرسل إشعاراً فورياً لكل الطلاب مباشرة — مستقل تماماً عن قسم الأخبار.
      </p>
      <div style={{ background: T.sectionBg, borderRadius: "14px", padding: "12px", marginBottom: "14px" }}>
        <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="عنوان الإشعار *" style={inp} />
        <textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} placeholder="نص الإشعار (اختياري)..." style={{ ...inp, height: "70px", resize: "vertical" }} />
        <button onClick={sendAnnouncement} disabled={sending || !form.title.trim()} style={{ background: `linear-gradient(135deg,${T.accent},${T.accent2})`, color: "#fff", border: "none", borderRadius: "10px", padding: "10px 18px", cursor: "pointer", fontFamily: "'Cairo',sans-serif", fontWeight: "700" }}>
          {sending ? "⏳ جاري الإرسال..." : sent ? "✅ تم الإرسال!" : "📢 إرسال الآن"}
        </button>
      </div>
      {items.map(a => (
        <div key={a.id} style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: "12px", padding: "10px 12px", marginBottom: "8px", display: "flex", gap: "10px", alignItems: "center" }}>
          <div style={{ flex: 1 }}>
            <p style={{ margin: "0 0 2px", fontWeight: "700", color: T.text, fontSize: "13px" }}>{a.title}</p>
            {a.body && <p style={{ margin: 0, color: T.subtext, fontSize: "11px" }}>{a.body}</p>}
          </div>
          <button onClick={() => deleteAnnouncement(a.id)} style={{ background: "#e5533322", border: "1px solid #e55", color: "#e55", borderRadius: "8px", padding: "6px 10px", cursor: "pointer" }}>🗑️</button>
        </div>
      ))}
    </AdminSection>
  );
}

function AdminNews({ config, saveConfig, T, onBack }) { 
  const [news, setNews] = useState([]); 
  const [pinnedIds, setPinnedIds] = useState(() => { 
    const raw = config.pinnedNews; 
    return raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : []; 
  }); 
  const [form, setForm] = useState({ title: "", content: "", source: "", date: new Date().toLocaleDateString("ar"), url: "" }); 
  const [saving, setSaving] = useState(false); 

  useEffect(() => { 
    fbGet("news").then(d => { 
      if (d) setNews(d.sort((a, b) => b.createdAt - a.createdAt)); 
    }); 
  }, []); 

  // دالة النشر المحدثة لحل مشكلة تعليق السيرفر الوهمي "فش نت"
  const addNews = async () => { 
    if (!form.title) return; 
    setSaving(true); 
    
    let id = null;
    try {
      // المحاولة الأولى للنشر
      id = await fbAdd("news", { ...form, createdAt: Date.now() }); 
      
      // محاولة ثانية ذكية في خلفية التطبيق إذا تعطلت الاستجابة الأولى والإنترنت مستقر
      if (!id && navigator.onLine) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // انتظر ثانية واحدة
        id = await fbAdd("news", { ...form, createdAt: Date.now() });
      }
    } catch (error) {
      console.error("خطأ أثناء النشر:", error);
    }

    if (id) { 
      setNews(n => [{ id, ...form, createdAt: Date.now() }, ...n]); 
      if (typeof sendLocalNotification === "function") { 
        sendLocalNotification("📰 خبر جديد — سواعد الخير", form.title); 
      } 
      setForm({ title: "", content: "", source: "", date: new Date().toLocaleDateString("ar"), url: "" }); 
    } else { 
      alert("⚠️ تعذّر نشر الخبر. يرجى إعادة الضغط على الزر مجدداً لإعادة المحاولة فوراً."); 
    } 
    setSaving(false); 
  }; 

  const deleteNews = async (id) => { 
    await fbDelete("news", id); 
    setNews(n => n.filter(x => x.id !== id)); 
  }; 

  const togglePin = async (id) => { 
    const pins = pinnedIds.includes(id) ? pinnedIds.filter(x => x !== id) : [...pinnedIds, id]; 
    setPinnedIds(pins); 
    await saveConfig({ ...config, pinnedNews: JSON.stringify(pins) }); 
  }; 

  const inp = { background: T.inputBg, border: `1.5px solid ${T.cardBorder}`, borderRadius: "12px", padding: "10px 12px", fontSize: "13px", color: T.text, width: "100%", outline: "none", fontFamily: "'Cairo',sans-serif", direction: "rtl", boxSizing: "border-box", marginBottom: "8px" }; 
  
  return ( 
    <AdminSection title="الأخبار" icon="📰" T={T} onBack={onBack} onSave={() => {}}> 
      <div style={{ background: T.sectionBg, borderRadius: "14px", padding: "12px", marginBottom: "14px" }}> 
        <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="عنوان الخبر *" style={inp} /> 
        <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} placeholder="محتوى الخبر..." style={{ ...inp, height: "80px", resize: "vertical" }} /> 
        <input value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))} placeholder="المصدر" style={inp} /> 
        <input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="رابط الخبر (اختياري)" style={inp} /> 
        <button onClick={addNews} disabled={saving || !form.title} style={{ background: `linear-gradient(135deg,${T.accent},${T.accent2})`, color: "#fff", border: "none", borderRadius: "10px", padding: "10px 18px", cursor: "pointer", fontFamily: "'Cairo',sans-serif" }}> 
          {saving ? "⏳..." : "📢 نشر الخبر"} 
        </button> 
      </div> 
      {news.map(n => ( 
        <div key={n.id} style={{ background: T.card, border: `1px solid ${pinnedIds.includes(n.id) ? T.accent + "66" : T.cardBorder}`, borderRadius: "12px", padding: "10px 12px", marginBottom: "8px", display: "flex", gap: "10px", alignItems: "center" }}> 
          <div style={{ flex: 1 }}> 
            <p style={{ margin: "0 0 2px", fontWeight: "700", color: T.text, fontSize: "13px" }}>{n.title}</p> 
            <p style={{ margin: 0, color: T.subtext, fontSize: "11px" }}>{n.source} --- {n.date}</p> 
          </div> 
          <button onClick={() => togglePin(n.id)} style={{ background: "transparent", border: "none", fontSize: "18px", cursor: "pointer" }}>{pinnedIds.includes(n.id) ? "📌" : "📍"}</button> 
          <button onClick={() => deleteNews(n.id)} style={{ background: "#e5533322", border: "1px solid #e55", color: "#e55", borderRadius: "8px", padding: "6px 10px", cursor: "pointer" }}>🗑️</button> 
        </div> 
      ))} 
    </AdminSection> 
  ); 
}

function AdminNav({ config, saveConfig, T, onBack }) {
  const [pages, setPages] = useState([...(config.navPages || [])]);
  const [form, setForm] = useState({ id: "", label: "", icon: "📄" });
  const [editingId, setEditingId] = useState(null);
  const [blockForm, setBlockForm] = useState({ type: "text", value: "", url: "" });

  const BUILTIN_IDS = ["home", "foundation", "news", "saved", "settings"];

  const inp = { background: T.inputBg, border: `1.5px solid ${T.cardBorder}`, borderRadius: "12px", padding: "10px 12px", fontSize: "13px", color: T.text, flex: 1, outline: "none", fontFamily: "'Cairo',sans-serif", direction: "rtl" };

  const movePage = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= pages.length) return;
    const updated = [...pages];
    [updated[i], updated[j]] = [updated[j], updated[i]];
    setPages(updated);
  };

  const addPage = () => {
    if (!form.label || !form.id) return;
    if (pages.some(p => p.id === form.id)) { alert("المعرف مستخدم مسبقاً"); return; }
    setPages(p => [...p, { ...form, custom: !BUILTIN_IDS.includes(form.id), content: [] }]);
    setForm({ id: "", label: "", icon: "📄" });
  };

  const addBlock = (pageId) => {
    if (!blockForm.value.trim()) return;
    setPages(ps => ps.map(p => p.id === pageId ? { ...p, content: [...(p.content || []), { ...blockForm }] } : p));
    setBlockForm({ type: "text", value: "", url: "" });
  };

  const removeBlock = (pageId, idx) => {
    setPages(ps => ps.map(p => p.id === pageId ? { ...p, content: (p.content || []).filter((_, i) => i !== idx) } : p));
  };

  return (
    <AdminSection title="الصفحات والتنقل" icon="🧭" T={T} onBack={onBack} onSave={() => saveConfig({ ...config, navPages: pages })}>
      <p style={{ color: T.subtext, fontSize: "12px", margin: "0 0 12px" }}>استخدم الأسهم لإعادة ترتيب الأزرار كما تظهر في الشريط السفلي. الصفحات الجديدة (غير الأساسية) يمكنك إضافة محتوى نصي/روابط لها مباشرة.</p>
      <div style={{ background: T.sectionBg, borderRadius: "14px", padding: "12px", marginBottom: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <input value={form.icon} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))} placeholder="أيقونة (إيموجي)" style={inp} />
        <input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="اسم الصفحة" style={inp} />
        <input value={form.id} onChange={e => setForm(f => ({ ...f, id: e.target.value.replace(/\s+/g, "_") }))} placeholder="معرف (بالإنجليزي)" style={inp} />
        <button onClick={addPage} style={{ background: `linear-gradient(135deg,${T.accent},${T.accent2})`, color: "#fff", border: "none", borderRadius: "10px", padding: "10px", cursor: "pointer", fontFamily: "'Cairo',sans-serif" }}>+ إضافة</button>
      </div>
      {pages.map((p, i) => (
        <div key={p.id} style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: "12px", padding: "10px 12px", marginBottom: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <button onClick={() => movePage(i, -1)} disabled={i === 0} style={{ background: "transparent", border: "none", cursor: i === 0 ? "default" : "pointer", opacity: i === 0 ? 0.3 : 1, fontSize: "14px" }}>▲</button>
              <button onClick={() => movePage(i, 1)} disabled={i === pages.length - 1} style={{ background: "transparent", border: "none", cursor: i === pages.length - 1 ? "default" : "pointer", opacity: i === pages.length - 1 ? 0.3 : 1, fontSize: "14px" }}>▼</button>
            </div>
            <span style={{ fontSize: "22px" }}>{p.icon}</span>
            <span style={{ flex: 1, color: T.text, fontSize: "14px" }}>{p.label}</span>
            {p.custom && <button onClick={() => setEditingId(editingId === p.id ? null : p.id)} style={{ background: `${T.accent}22`, border: "none", borderRadius: "8px", padding: "6px 10px", cursor: "pointer", fontSize: "14px" }}>✏️ محتوى</button>}
            {!BUILTIN_IDS.includes(p.id) && <button onClick={() => setPages(ps => ps.filter((_, j) => j !== i))} style={{ background: "#e5533322", border: "1px solid #e55", color: "#e55", borderRadius: "8px", padding: "6px 10px", cursor: "pointer" }}>🗑️</button>}
          </div>
          {p.custom && editingId === p.id && (
            <div style={{ marginTop: "10px", background: T.sectionBg, borderRadius: "10px", padding: "10px" }}>
              {(p.content || []).map((b, bi) => (
                <div key={bi} style={{ display: "flex", alignItems: "center", gap: "8px", background: T.card, borderRadius: "8px", padding: "8px 10px", marginBottom: "6px" }}>
                  <span style={{ flex: 1, fontSize: "13px", color: T.text }}>{b.type === "link" ? `🔗 ${b.value} → ${b.url}` : `📝 ${b.value}`}</span>
                  <button onClick={() => removeBlock(p.id, bi)} style={{ background: "transparent", border: "none", color: "#e55", cursor: "pointer" }}>✕</button>
                </div>
              ))}
              <select value={blockForm.type} onChange={e => setBlockForm(f => ({ ...f, type: e.target.value }))} style={{ ...inp, width: "100%", marginBottom: "6px" }}>
                <option value="text">فقرة نصية</option>
                <option value="link">رابط</option>
              </select>
              <input value={blockForm.value} onChange={e => setBlockForm(f => ({ ...f, value: e.target.value }))} placeholder={blockForm.type === "link" ? "اسم الرابط" : "النص"} style={{ ...inp, width: "100%", marginBottom: "6px", boxSizing: "border-box" }} />
              {blockForm.type === "link" && <input value={blockForm.url} onChange={e => setBlockForm(f => ({ ...f, url: e.target.value }))} placeholder="عنوان الرابط (https://...)" style={{ ...inp, width: "100%", marginBottom: "6px", boxSizing: "border-box" }} />}
              <button onClick={() => addBlock(p.id)} style={{ background: T.accent, color: "#fff", border: "none", borderRadius: "8px", padding: "8px 14px", cursor: "pointer", fontFamily: "'Cairo',sans-serif" }}>+ إضافة للمحتوى</button>
            </div>
          )}
        </div>
      ))}
    </AdminSection>
  );
}

// صفحة عرض للصفحات المخصّصة التي أنشأها المسؤول (محتوى نصي/روابط بسيط)
function CustomPage({ page, T }) {
  if (!page) return null;
  return (
    <div style={{ padding: "20px 16px", fontFamily: "'Cairo',sans-serif", direction: "rtl" }}>
      <h2 style={{ color: T.text, fontSize: "20px", fontWeight: "800", margin: "0 0 16px" }}>{page.icon} {page.label}</h2>
      {(!page.content || page.content.length === 0) && (
        <div style={{ textAlign: "center", padding: "40px" }}><div style={{ fontSize: "48px" }}>📄</div><p style={{ color: T.subtext }}>لم يُضف محتوى لهذه الصفحة بعد</p></div>
      )}
      {(page.content || []).map((b, i) => (
        <div key={i} style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: "14px", padding: "14px", marginBottom: "10px" }}>
          {b.type === "link" ? (
            <a href={b.url} target="_blank" rel="noreferrer" style={{ color: T.accent, fontWeight: "700", fontSize: "14px", textDecoration: "none" }}>🔗 {b.value}</a>
          ) : (
            <p style={{ margin: 0, color: T.text, fontSize: "14px", lineHeight: "1.8" }}>{b.value}</p>
          )}
        </div>
      ))}
    </div>
  );
}

function AdminContact({ config, saveConfig, T, onBack }) {
  const [links, setLinks] = useState([...(config.contactLinks || [])]);
  const [form, setForm] = useState({ label: "", url: "", icon: "💬" });

  const inp = { background: T.inputBg, border: `1.5px solid ${T.cardBorder}`, borderRadius: "12px", padding: "10px 12px", fontSize: "13px", color: T.text, flex: 1, outline: "none", fontFamily: "'Cairo',sans-serif", direction: "rtl" };

  return (
    <AdminSection title="روابط التواصل" icon="📞" T={T} onBack={onBack} onSave={() => saveConfig({ ...config, contactLinks: links })}>
      <div style={{ background: T.sectionBg, borderRadius: "14px", padding: "12px", marginBottom: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <input value={form.icon} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))} placeholder="أيقونة" style={inp} />
        <input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="اسم الرابط" style={inp} />
        <input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="الرابط" style={inp} />
        <button onClick={() => { if (!form.label || !form.url) return; setLinks(l => [...l, { ...form }]); setForm({ label: "", url: "", icon: "💬" }); }} style={{ background: `linear-gradient(135deg,${T.accent},${T.accent2})`, color: "#fff", border: "none", borderRadius: "10px", padding: "10px", cursor: "pointer", fontFamily: "'Cairo',sans-serif" }}>+ إضافة</button>
      </div>
      {links.map((l, i) => (
        <div key={i} style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: "12px", padding: "10px 12px", marginBottom: "8px", display: "flex", alignItems: "center", gap: "10px" }}>
          <span>{l.icon}</span>
          <span style={{ flex: 1, color: T.text, fontSize: "13px" }}>{l.label}</span>
          <button onClick={() => setLinks(l => l.filter((_, j) => j !== i))} style={{ background: "#e5533322", border: "1px solid #e55", color: "#e55", borderRadius: "8px", padding: "6px 10px", cursor: "pointer" }}>🗑️</button>
        </div>
      ))}
    </AdminSection>
  );
}

// ============================================================
// SHARED COMPONENTS
// ============================================================

function AdminSection({ title, icon, T, onBack, onSave, children }) {
  const [saved, setSaved] = useState(false);

  const save = async () => { await onSave(); setSaved(true); setTimeout(() => setSaved(false), 2000); };

  return (
    <div style={{ minHeight: "100vh", maxWidth: APP_MAX_WIDTH, margin: "0 auto", background: T.bg, fontFamily: "'Cairo',sans-serif", direction: "rtl", paddingBottom: "80px" }}>
      <div style={{ background: T.card, backdropFilter: "blur(16px)", borderBottom: `1px solid ${T.cardBorder}`, padding: "16px", display: "flex", alignItems: "center", gap: "12px" }}>
        <button onClick={onBack} style={{ background: T.accent, color: "#fff", border: "none", borderRadius: "12px", padding: "8px 18px", fontSize: "14px", fontWeight: "700", cursor: "pointer", fontFamily: "'Cairo',sans-serif" }}>← رجوع</button>
        <h2 style={{ margin: 0, color: T.text, fontSize: "18px", fontWeight: "800" }}>{icon} {title}</h2>
      </div>
      <div style={{ padding: "16px" }}>{children}</div>
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, maxWidth: APP_MAX_WIDTH, margin: "0 auto", background: T.navBg, backdropFilter: "blur(16px)", borderTop: `1px solid ${T.cardBorder}`, padding: "12px 16px" }}>
        <button onClick={save} style={{ width: "100%", background: saved ? "#238636" : `linear-gradient(135deg,${T.accent},${T.accent2})`, color: "#fff", border: "none", borderRadius: "14px", padding: "14px", fontSize: "15px", fontWeight: "700", cursor: "pointer", fontFamily: "'Cairo',sans-serif" }}>
          {saved ? "✅ تم الحفظ!" : "💾 حفظ التغييرات"}
        </button>
      </div>
    </div>
  );
}

function ListEditor({ items, setItems, newItem, setNewItem, T, inp, placeholder }) {
  return (
    <div>
      <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
        <input value={newItem} onChange={e => setNewItem(e.target.value)} placeholder={placeholder} style={inp} onKeyDown={e => { if (e.key === "Enter" && newItem.trim()) { setItems(i => [...i, newItem.trim()]); setNewItem(""); } }} />
        <button onClick={() => { if (!newItem.trim()) return; setItems(i => [...i, newItem.trim()]); setNewItem(""); }} style={{ background: `linear-gradient(135deg,${T.accent},${T.accent2})`, color: "#fff", border: "none", borderRadius: "12px", padding: "10px 16px", cursor: "pointer", fontSize: "18px", flexShrink: 0 }}>+</button>
      </div>
      {items.map((item, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: "10px", padding: "10px 12px", marginBottom: "6px" }}>
          <span style={{ flex: 1, color: T.text, fontSize: "14px" }}>{item}</span>
          <button onClick={() => setItems(it => it.filter((_, j) => j !== i))} style={{ background: "transparent", border: "none", color: "#e55", cursor: "pointer", fontSize: "18px" }}>✕</button>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// ADMIN SECTIONS - FIXED (أقسام المادة)
// ============================================================

function AdminSections({ config, saveConfig, T, onBack }) {
  const [sections, setSections] = useState([...(config.subjectSections || [])]);
  const [newSec, setNewSec] = useState("");

  const grades = config.grades || [];
  const branches = config.branches || [];
  const [selectedGrade, setSelectedGrade] = useState(grades[0] || "");
  const [selectedBranch, setSelectedBranch] = useState(branches[0] || "");
  const [selectedSemester, setSelectedSemester] = useState("فصل أول");
  const [selectedSubject, setSelectedSubject] = useState("");

  const getAvailableSubjects = () => {
    const allSubs = new Set();
    const brs = config.branches || branches;
    brs.forEach(br => {
      const k = `${selectedGrade}_${br}`;
      (config.subjects?.[k] || []).forEach(sub => allSubs.add(sub));
    });
    return Array.from(allSubs);
  };

  const availableSubjects = getAvailableSubjects();

  const getSubjectKey = () => {
    const isGrade11 = selectedGrade.includes("حادي عشر");
    const semesterKey = isGrade11 ? selectedSemester : "فصل واحد";
    return `${selectedGrade}_${selectedBranch}${isGrade11 ? `_${semesterKey}` : ""}`;
  };

  const subjectKey = getSubjectKey();

  useEffect(() => {
    if (availableSubjects.length > 0 && !selectedSubject) {
      setSelectedSubject(availableSubjects[0]);
    }
  }, [selectedGrade, subjectKey, availableSubjects]);

  const inp = { background: T.inputBg, border: `1.5px solid ${T.cardBorder}`, borderRadius: "12px", padding: "10px 12px", fontSize: "14px", color: T.text, flex: 1, outline: "none", fontFamily: "'Cairo',sans-serif", direction: "rtl" };
  const selectStyle = { ...inp, flex: "unset", width: "100%", marginBottom: "8px" };

  return (
    <AdminSection title="أقسام المادة" icon="📑" T={T} onBack={onBack} onSave={() => saveConfig({ ...config, subjectSections: sections })}>
      <p style={{ color: T.subtext, fontSize: "13px", margin: "0 0 14px" }}>اختر الصف والفرع والفصل والمادة ثم أضف الأقسام. (تم الإصلاح: كل المواد مرئية عبر الفروع والفصول)</p>

      <select value={selectedGrade} onChange={e => { setSelectedGrade(e.target.value); setSelectedSubject(""); }} style={selectStyle}>
        {grades.map(g => <option key={g} value={g}>{g}</option>)}
      </select>

      <select value={selectedBranch} onChange={e => { setSelectedBranch(e.target.value); setSelectedSubject(""); }} style={selectStyle}>
        {branches.map(b => <option key={b} value={b}>{b}</option>)}
      </select>

      {selectedGrade.includes("حادي عشر") && (
        <select value={selectedSemester} onChange={e => { setSelectedSemester(e.target.value); setSelectedSubject(""); }} style={selectStyle}>
          <option value="فصل أول">فصل أول</option>
          <option value="فصل ثان">فصل ثان</option>
        </select>
      )}

            <select value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)} style={selectStyle}>
        {availableSubjects.length > 0 ? (
          availableSubjects.map(s => <option key={s} value={s}>{s}</option>)
        ) : (
          <option value="">لا توجد مواد</option>
        )}
      </select>

      <div style={{ background: T.sectionBg, borderRadius: "14px", padding: "12px", marginBottom: "12px" }}>
        <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
          <input value={newSec} onChange={e => setNewSec(e.target.value)} placeholder="اسم القسم الجديد..." style={inp} />
          <button onClick={() => {
            if (newSec.trim()) {
              const updated = [...sections, newSec.trim()];
              setSections(updated);
              setNewSec("");
            }
          }} style={{ background: T.accent, color: "#fff", border: "none", borderRadius: "10px", padding: "10px 20px", cursor: "pointer" }}>إضافة</button>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
          {sections.map((sec, idx) => (
            <div key={idx} style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: "20px", padding: "6px 14px", display: "flex", alignItems: "center", gap: "6px" }}>
              <span>{sec}</span>
              <button onClick={() => {
                const updated = sections.filter((_, i) => i !== idx);
                setSections(updated);
              }} style={{ background: "transparent", border: "none", color: T.danger, cursor: "pointer", fontSize: "14px" }}>✕</button>
            </div>
          ))}
        </div>
      </div>
    </AdminSection>
  );
}

// ============================================================
// ADMIN FOLDERS - FIXED (مع اختيار القسم + إصلاح الصف الحادي عشر + حذف)
// ============================================================

function AdminFolders({ config, saveConfig, T, onBack }) {
  const grades = config.grades || [];
  const branches = config.branches || [];
  const [selectedGrade, setSelectedGrade] = useState(grades[0] || "");
  const [selectedBranch, setSelectedBranch] = useState(branches[0] || "");
  const [selectedSemester, setSelectedSemester] = useState("فصل أول");
  const [selectedSubject, setSelectedSubject] = useState("");

  const sectionsList = config.subjectSections || [
    "الرزم", "الكتب", "حلول الكتب", "مواد تعليمية", "ملخصات",
    "أسئلة واختبارات سابقة", "اختبارات إلكترونية", "عروض تقديمية",
    "الدراسة للامتحانات", "قنوات يوتيوب شارحة"
  ];
  const [selectedSection, setSelectedSection] = useState(sectionsList[0] || "");

  const getSubjectKey = () => {
    if (!selectedGrade || !selectedBranch) return "";
    const isGrade11 = selectedGrade.includes("حادي عشر");
    const semesterKey = isGrade11 ? selectedSemester : "فصل واحد";
    return `${selectedGrade}_${selectedBranch}_${semesterKey}`;
  };

  const subjectKey = getSubjectKey();

  const storageKey = (selectedSubject && selectedSection) 
    ? `folder_${subjectKey}_${selectedSubject}_${selectedSection}` 
    : "";

  const getAvailableSubjects = () => {
    const allSubs = new Set();
    const brs = config.branches || branches;
    brs.forEach(br => {
      const k = `${selectedGrade}_${br}`;
      (config.subjects?.[k] || []).forEach(sub => allSubs.add(sub));
    });
    return Array.from(allSubs);
  };

  const availableSubjects = getAvailableSubjects();

  useEffect(() => {
    const isG11 = selectedGrade.includes("حادي عشر");
    if (isG11 && !["فصل أول", "فصل ثان"].includes(selectedSemester)) {
      setSelectedSemester("فصل أول");
    }
  }, [selectedGrade]);

  useEffect(() => {
    if (availableSubjects.length > 0) {
      if (!availableSubjects.includes(selectedSubject)) {
        setSelectedSubject(availableSubjects[0]);
        setSelectedSection(sectionsList[0] || "");
      }
    } else {
      setSelectedSubject("");
    }
  }, [subjectKey]);

  const [folderData, setFolderData] = useState([]);

  useEffect(() => {
    if (!storageKey) {
      setFolderData([]);
      return;
    }
    const raw = config[storageKey];
    if (raw) {
      try {
        setFolderData(typeof raw === "string" ? JSON.parse(raw) : raw);
      } catch {
        setFolderData([]);
      }
    } else {
      setFolderData([]);
    }
  }, [storageKey]);

  const saveFolderData = async (newData) => {
    if (!storageKey) return;
    const newConfig = { ...config, [storageKey]: JSON.stringify(newData) };
    await saveConfig(newConfig);
    setFolderData(newData);
  };

  const inp = {
    background: T.inputBg,
    border: `1.5px solid ${T.cardBorder}`,
    borderRadius: "12px",
    padding: "10px 12px",
    fontSize: "13px",
    color: T.text,
    width: "100%",
    outline: "none",
    fontFamily: "'Cairo',sans-serif",
    direction: "rtl",
    boxSizing: "border-box",
    marginBottom: "8px"
  };
  const selectStyle = { ...inp };

  const addFolder = () => {
    const name = prompt("أدخل اسم المجلد الجديد:");
    if (name && name.trim()) {
      const newData = [...folderData, { type: "folder", name: name.trim(), children: [] }];
      saveFolderData(newData);
    }
  };

  const addFile = () => {
    const title = prompt("أدخل اسم الملف:");
    if (title && title.trim()) {
      const url = prompt("أدخل رابط Google Drive:");
      if (url && url.trim()) {
        const type = prompt("نوع الملف (pdf, image, link):") || "link";
        const newData = [...folderData, { title: title.trim(), url: url.trim(), type, description: "" }];
        saveFolderData(newData);
      }
    }
  };

  const deleteItem = (index) => {
    const newData = folderData.filter((_, i) => i !== index);
    saveFolderData(newData);
  };

  return (
    <AdminSection title="إدارة المجلدات" icon="📁" T={T} onBack={onBack} onSave={() => {}}>
      <p style={{ color: T.subtext, fontSize: "13px", margin: "0 0 14px" }}>
        اختر الصف والفرع والفصل والمادة والقسم لإدارة مجلداتها. (تم إصلاح مشكلة الصف الحادي عشر + إضافة اختيار القسم + زر حذف)
      </p>

      <select value={selectedGrade} onChange={e => { setSelectedGrade(e.target.value); setSelectedSubject(""); setSelectedSection(sectionsList[0] || ""); }} style={selectStyle}>
        {grades.map(g => <option key={g} value={g}>{g}</option>)}
      </select>

      <select value={selectedBranch} onChange={e => { setSelectedBranch(e.target.value); setSelectedSubject(""); setSelectedSection(sectionsList[0] || ""); }} style={selectStyle}>
        {branches.map(b => <option key={b} value={b}>{b}</option>)}
      </select>

      {selectedGrade.includes("حادي عشر") && (
        <select value={selectedSemester} onChange={e => { setSelectedSemester(e.target.value); setSelectedSubject(""); setSelectedSection(sectionsList[0] || ""); }} style={selectStyle}>
          <option value="فصل أول">فصل أول</option>
          <option value="فصل ثان">فصل ثان</option>
        </select>
      )}

      <select value={selectedSubject} onChange={e => { setSelectedSubject(e.target.value); setSelectedSection(sectionsList[0] || ""); }} style={selectStyle}>
        {availableSubjects.length > 0 ? (
          availableSubjects.map(s => <option key={s} value={s}>{s}</option>)
        ) : (
          <option value="">لا توجد مواد لهذا الاختيار</option>
        )}
      </select>

      {/* ==================== اختيار القسم ==================== */}
      <select 
        value={selectedSection} 
        onChange={e => setSelectedSection(e.target.value)} 
        style={selectStyle}
        disabled={!selectedSubject}
      >
        {sectionsList.map(sec => (
          <option key={sec} value={sec}>{sec}</option>
        ))}
      </select>
      {/* ========================================================== */}

      {!selectedSubject || !selectedSection ? (
        <div style={{ 
          marginTop: "16px", 
          padding: "16px", 
          background: "rgba(255,193,7,0.15)", 
          border: "1px solid #ffc107", 
          borderRadius: "12px",
          color: T.text,
          fontSize: "14px",
          textAlign: "center"
        }}>
          ⚠️ الرجاء اختيار المادة والقسم أولاً لتتمكن من إضافة مجلدات وملفات.
        </div>
      ) : (
        <>
          <div style={{ marginTop: "16px", display: "flex", gap: "10px" }}>
            <button onClick={addFolder} style={{ flex: 1, background: T.accent, color: "#fff", border: "none", borderRadius: "12px", padding: "12px", fontWeight: "700", cursor: "pointer" }}>
              ➕ مجلد جديد
            </button>
            <button onClick={addFile} style={{ flex: 1, background: T.accent2, color: "#fff", border: "none", borderRadius: "12px", padding: "12px", fontWeight: "700", cursor: "pointer" }}>
              📄 ملف جديد
            </button>
          </div>

          <div style={{ marginTop: "20px", background: T.sectionBg, borderRadius: "16px", padding: "16px", minHeight: "200px" }}>
            {folderData.length === 0 ? (
              <p style={{ color: T.subtext, textAlign: "center", padding: "40px 0" }}>لا توجد مجلدات بعد. أضف مجلدًا أو ملفًا.</p>
            ) : (
              <div>
                {folderData.map((item, idx) => (
                  <div key={idx} style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: "12px", padding: "12px", marginBottom: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      {item.type === "folder" ? (
                        <div>📁 {item.name} ({item.children?.length || 0} عنصر)</div>
                      ) : (
                        <div>📄 {item.title}</div>
                      )}
                    </div>
                    <button onClick={() => deleteItem(idx)} style={{ background: "#e5533322", border: "1px solid #e55", color: "#e55", borderRadius: "8px", padding: "6px 10px", cursor: "pointer", fontSize: "13px" }}>🗑️ حذف</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </AdminSection>
  );
}

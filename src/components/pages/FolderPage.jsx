import React, { useEffect, useMemo, useRef, useState } from "react";
import { normalizeUserRole } from "../../AuthContext.jsx";
import { cloudflareWorkerBaseUrl } from "../../config.js";
import Modal from "../ui/Modal.jsx";
import FileViewer from "./FileViewer.jsx";
import { fetchBinaryBlob } from "../../utils/downloadUtils.js";

const CF_WORKER_URL = `${cloudflareWorkerBaseUrl}/`;

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
  return normalized === "ادبي" || normalized === "أدبي" ? "أدبي" : normalized;
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

function ls(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    if (v === null || v === undefined) return fallback;
    return JSON.parse(v);
  } catch {
    return fallback;
  }
}

function lsSet(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {}
}

async function fbGet(collectionName, docId) {
  try {
    const key = `${collectionName}:${docId}`;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function fbSet(collectionName, docId, fields) {
  try {
    const key = `${collectionName}:${docId}`;
    localStorage.setItem(key, JSON.stringify(fields));
    return true;
  } catch {
    return false;
  }
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

async function idbSaveFile(id, blob, meta) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("files", "readwrite");
    const store = tx.objectStore("files");
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

function extractDriveId(url) {
  if (!url) return null;
  const m1 = url.match(/\/file\/d\/([a-zA-Z0-9_\-]+)/);
  if (m1) return m1[1];
  const m2 = url.match(/[?&]id=([a-zA-Z0-9_\-]+)/);
  if (m2) return m2[1];
  if (/^[a-zA-Z0-9_\-]{25,}$/.test(url.trim())) return url.trim();
  return null;
}

function isDriveUrl(url) {
  return url && (url.includes("drive.google.com") || url.includes("docs.google.com/uc"));
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

function driveProxyUrl(urlOrId, workerBase = cloudflareWorkerBaseUrl) {
  const id = extractDriveId(urlOrId) || urlOrId;
  if (!id) return null;
  const proxyBase = String(workerBase || cloudflareWorkerBaseUrl || CF_WORKER_URL || "").replace(/\/+$/, "");
  if (!proxyBase) return null;
  const proxy = new URL(`${proxyBase}/`);
  proxy.searchParams.set("fileId", String(id));
  return proxy.toString();
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
  if (typeof isDriveUrl === "function" && isDriveUrl(inputUrl)) return driveProxyUrl(inputUrl, cloudflareWorkerBaseUrl) || inputUrl;
  return inputUrl;
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
  const filename = `${rawName.replace(/[^a-zA-Z0-9\u0600-\u06FF.\-_]/g, "_") || "sawaed-file"}.pdf`;

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const EMOJI = { "اللغة العربية": "📖", "اللغة الإنجليزية": "🌐", "الرياضيات": "📐", "التربية الإسلامية": "☪️", "التكنولوجيا": "💻", "الفيزياء": "⚛️", "الكيمياء": "🧪", "الأحياء": "🌿", "الدراسات الجغرافية": "🗺️", "الدراسات التاريخية": "🏛️", "الثقافة العلمية": "🔬", "لغة عربية": "📖", "لغة إنجليزية": "🌐", "فيزياء": "⚛️", "كيمياء": "🧪", "أحياء": "🌿" };

function getNodeTitle(item) {
  if (!item || typeof item !== "object") return "عنصر";
  return item.title || item.name || "عنصر";
}

function getNodeType(item) {
  if (!item || typeof item !== "object") return "link";
  if (item.type === "folder" || item.isFolder) return "folder";
  return item.type || "link";
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

export default function FolderPage({ config, saveConfig, T, darkMode, currentUser, updateUser, data, onBack, isEditorSession, editorRole, editorPermissions }) {
  const { subject, grade, branch, semester, section, folderPath = [] } = data;
  const storageKey = normalizeFolderKey({ grade, branch, semester, subject, section });

  const [folderData, setFolderData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPath, setCurrentPath] = useState(folderPath);
  const [currentItems, setCurrentItems] = useState([]);
  const [expandedFolderIds, setExpandedFolderIds] = useState(new Set());
  const [viewerData, setViewerData] = useState(null);
  const [savedIds, setSavedIds] = useState(new Set());
  const [editorMode, setEditorMode] = useState(false);
  const role = normalizeUserRole(currentUser?.role || "user");
  const [newFolderName, setNewFolderName] = useState("");
  const [showAddFolderModal, setShowAddFolderModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameIndex, setRenameIndex] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [pendingUploadFile, setPendingUploadFile] = useState(null);
  const [showDriveLinkModal, setShowDriveLinkModal] = useState(false);
  const [driveLink, setDriveLink] = useState("");
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
    let cancelled = false;

    const loadFolderData = async () => {
      setLoading(true);
      try {
        const variantKeys = getFolderKeyVariants({ grade, branch, semester, subject, section });
        let doc = await fbGet("folder_items", storageKey);
        if (!doc) {
          for (const altKey of variantKeys.filter(key => key !== storageKey)) {
            const altDoc = await fbGet("folder_items", altKey);
            if (altDoc) {
              doc = altDoc;
              break;
            }
          }
        }

        let parsedItems = [];
        if (doc && Array.isArray(doc.items)) {
          parsedItems = doc.items;
        } else if (doc && doc.items !== undefined) {
          parsedItems = parseStoredItems(doc.items);
        } else {
          let fallbackRaw = ls(`sawaed_folder_${storageKey}`, null);
          if (!fallbackRaw) {
            for (const altKey of variantKeys.filter(key => key !== storageKey)) {
              fallbackRaw = ls(`sawaed_folder_${altKey}`, null);
              if (fallbackRaw) break;
            }
          }
          if (!fallbackRaw) {
            for (const altKey of variantKeys) {
              if (config[altKey] !== undefined) {
                fallbackRaw = config[altKey];
                break;
              }
            }
          }
          parsedItems = fallbackRaw ? parseStoredItems(fallbackRaw) : [];
        }

        const normalizedItems = normalizeItemTree(Array.isArray(parsedItems) ? parsedItems : []);
        const shouldPersistNormalization = JSON.stringify(normalizedItems) !== JSON.stringify(parsedItems);

        if (!cancelled) {
          setFolderData(normalizedItems);
        }

        if (shouldPersistNormalization && !cancelled) {
          await saveFolderData(normalizedItems);
        }
      } catch (err) {
        console.warn("فشل تحميل بنية المجلدات من Firestore:", err);
        if (!cancelled) {
          let fallbackRaw = ls(`sawaed_folder_${storageKey}`, null);
          if (!fallbackRaw) {
            const variantKeys = getFolderKeyVariants({ grade, branch, semester, subject, section });
            for (const altKey of variantKeys.filter(key => key !== storageKey)) {
              fallbackRaw = ls(`sawaed_folder_${altKey}`, null);
              if (fallbackRaw) break;
            }
          }
          setFolderData(fallbackRaw ? parseStoredItems(fallbackRaw) : []);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadFolderData();
    return () => { cancelled = true; };
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
  const canEditStructure = isEditor && (role === "super_admin" || role === "editor_full" || role === "editor_malazem");

  const saveFolderData = async (newData) => {
    const normalizedKey = storageKey;
    const dataToSave = normalizeItemTree(Array.isArray(newData) ? newData : []);
    setFolderData(dataToSave);
    lsSet(`sawaed_folder_${normalizedKey}`, JSON.stringify(dataToSave));
    try {
      await fbSet("folder_items", normalizedKey, { items: dataToSave });
    } catch (err) {
      console.warn("فشل حفظ بنية المجلدات في Firestore:", err);
    }
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

  const openRenameModal = (index, currentName) => {
    setRenameIndex(index);
    setRenameValue(currentName);
    setShowRenameModal(true);
  };

  const handleRenameSubmit = async () => {
    if (renameIndex === null || !renameValue.trim()) return;
    await renameItem(renameIndex, renameValue.trim());
    setShowRenameModal(false);
    setRenameIndex(null);
    setRenameValue("");
  };

  const handleUploadLinkSubmit = () => {
    if (!pendingUploadFile || !driveLink.trim()) {
      setPendingUploadFile(null);
      setShowDriveLinkModal(false);
      setUploading(false);
      return;
    }

    const normalizedUrl = driveLink.trim();
    const fileType = pendingUploadFile.type?.includes("pdf")
      ? "pdf"
      : pendingUploadFile.type?.includes("image")
        ? "image"
        : normalizedUrl.toLowerCase().includes(".pdf")
          ? "pdf"
          : "link";
    setForm((f) => ({
      ...f,
      title: f.title || pendingUploadFile?.name?.replace(/\.[^/.]+$/, "") || "مورد جديد",
      url: normalizedUrl,
      type: fileType,
    }));
    setPendingUploadFile(null);
    setDriveLink("");
    setShowDriveLinkModal(false);
    setUploading(false);
  };

  const deleteItem = async (index) => {
    const newItems = currentItems.filter((_, i) => i !== index);
    await saveCurrentItems(newItems);
  };

  const handleDissolveFolder = async (folderId) => {
    if (!folderId) return;
    if (!window.confirm("هل أنت متأكد من حذف المجلد وإبقاء ملفاته داخل المجلد الأب؟")) return;

    const result = dissolveFolderInTree(folderData, folderId);
    if (!result.found) return;

    await saveFolderData(result.items);
    alert("تم تفريغ المجلد وحذفه بنجاح، وبقيت محتوياته في مستواه الأب.");
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

  const [dlProgress, setDlProgress] = useState({});
  const [downloadingIds, setDownloadingIds] = useState({});
  const [savingOfflineIds, setSavingOfflineIds] = useState({});
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" ? window.innerWidth < 640 : false);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const handleSaveToDevice = async (item) => {
    const fileId = getOfflineItemId(item);
    const actionKey = `${fileId}_device`;
    if (!fileId || downloadingIds[actionKey]) return;
    setDownloadingIds(previous => ({ ...previous, [actionKey]: true }));
    try {
      await downloadItemToDevice(item, (percent) => setDlProgress(previous => ({ ...previous, [actionKey]: percent })));
    } catch (err) {
      console.error("Error downloading file to device:", err);
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

  const downloadInApp = async (resource) => {
    const fileId = getOfflineItemId(resource);

    if (savedIds.has(fileId)) {
      const saved = await idbGetFile(fileId);
      if (saved?.blob && saved.blob.size > 500 && !saved.isFallback) {
        const blobUrl = URL.createObjectURL(saved.blob);
        const effectiveMimeType = saved.blob.type || saved.type || getFileMimeType(resource, saved.blob);
        setViewerData({ url: blobUrl, title: resource.title, isBlob: true, mimeType: effectiveMimeType });
        return;
      }
    }

    const actionKey = `${fileId}_offline`;
    setDlProgress(p => ({ ...p, [actionKey]: 0 }));

    const saveBlob = async (blob) => {
      if (!blob || blob.size < 500) throw new Error("blob فارغ");
      const effectiveMimeType = blob.type || resource.type || "application/pdf";
      await idbSaveFile(fileId, blob, {
        title: resource.title,
        description: resource.description || "",
        type: effectiveMimeType,
        url: resource.url,
        sourceItemId: resource.id || null,
        sourceUrl: resource.url,
        subject,
        grade,
        branch,
        semester,
        section,
        isFallback: false,
      });
      setSavedIds(s => new Set([...s, fileId]));
      setDlProgress(p => ({ ...p, [actionKey]: "done" }));
      setTimeout(() => setDlProgress(p => { const n={...p}; delete n[actionKey]; return n; }), 3000);
    };

    const progressCb = (pct) => setDlProgress(p => ({ ...p, [actionKey]: pct }));

    try {
      const proxyUrl = driveProxyUrl ? driveProxyUrl(resource.url, cloudflareWorkerBaseUrl) : null;
      if (proxyUrl) {
        const blob = await fetchBinaryBlob(proxyUrl, ["application/pdf", "image/", "application/octet-stream"], progressCb);
        await saveBlob(blob);
        return;
      }
    } catch (e1) { console.log("[DL] CF Worker failed:", e1.message); }

    try {
      const directUrl = getDriveDirectUrl(resource.url);
      const blob = await fetchBinaryBlob(directUrl, ["application/pdf", "image/", "application/octet-stream"], progressCb);
      await saveBlob(blob);
      return;
    } catch (e2) { console.log("[DL] Direct fetch failed:", e2.message); }

    try {
      const proxyUrl2 = `https://api.allorigins.win/raw?url=${encodeURIComponent(getDownloadUrl(resource.url))}`;
      const blob = await fetchBinaryBlob(proxyUrl2, ["application/pdf", "image/", "application/octet-stream"], progressCb);
      await saveBlob(blob);
      return;
    } catch (e3) { console.log("[DL] allorigins failed:", e3.message); }

    setDlProgress(p => ({ ...p, [actionKey]: "error" }));
    setTimeout(() => setDlProgress(p => { const n={...p}; delete n[actionKey]; return n; }), 5000);
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
    setUploadPct(100);
    setPendingUploadFile(file);
    setDriveLink("");
    setShowDriveLinkModal(true);
    if (fileRef.current) fileRef.current.value = "";
  };

  const addResource = async () => {
    if (!form.title || !form.url) return;
    const normalizedUrl = form.url.trim();
    const newItem = {
      id: createItemId("file"),
      ...form,
      url: normalizedUrl,
      title: form.title.trim(),
    };
    const newItems = [...currentItems, newItem];
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
    return <FileViewer url={viewerData.url} title={viewerData.title} T={T} fileId={viewerData.id || getOfflineItemId(viewerData.url)} isBlobDirect={viewerData.isBlob} mimeType={viewerData.mimeType || "application/pdf"} onClose={() => { if (viewerData.isBlob) URL.revokeObjectURL(viewerData.url); setViewerData(null); }} onStatusChange={(fileId, isDownloaded) => { if (isDownloaded) setSavedIds(s => new Set([...s, fileId])); else setSavedIds(s => { const n = new Set(s); n.delete(fileId); return n; }); }} />;
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

  const renderItem = (item, index, depth = 0) => {
    if (item && typeof item === "object" && (item.type === "folder" || item.isFolder || Array.isArray(item.items) || Array.isArray(item.children))) {
      const folderId = item.id || `${currentPath.join("-") || "root"}-${index}`;
      const children = getFolderChildren(item);
      const isExpanded = expandedFolderIds.has(folderId);

      return (
        <div key={folderId} style={{ marginTop: "8px", width: "100%", boxSizing: "border-box", paddingLeft: "16px", paddingRight: `${16 + depth * 16}px` }}>
          <div
            style={{
              background: T.card,
              border: `1px solid ${T.cardBorder}`,
              borderRadius: "16px",
              padding: isMobile ? "12px" : "12px 14px",
              display: "flex",
              alignItems: isMobile ? "stretch" : "center",
              justifyContent: "space-between",
              gap: "10px",
              backdropFilter: "blur(10px)",
              flexDirection: isMobile ? "column" : "row",
              width: "100%",
              boxSizing: "border-box"
            }}
          >
            <div
              style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0, flex: 1, cursor: "pointer", width: isMobile ? "100%" : "auto", justifyContent: isMobile ? "center" : "flex-start" }}
              onClick={(e) => {
                if (e.target.closest("button")) return;
                setExpandedFolderIds(prev => {
                  const next = new Set(prev);
                  if (next.has(folderId)) next.delete(folderId);
                  else next.add(folderId);
                  return next;
                });
              }}
            >
              <span style={{ fontSize: "22px", flexShrink: 0 }}>{isExpanded ? "📂" : "📁"}</span>
              <span style={{ fontSize: "16px", color: T.accent, fontWeight: "700", flexShrink: 0 }}>{isExpanded ? "▼" : "▶"}</span>
              <div style={{ minWidth: 0, flex: 1, overflow: "hidden" }}>
                <p style={{ margin: 0, color: T.text, fontWeight: "700", fontSize: isMobile ? "13px" : "14px", textAlign: isMobile ? "center" : "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: isMobile ? "normal" : "nowrap", wordBreak: isMobile ? "break-word" : "normal" }}>
                  {item.title || item.name || "مجلد"}
                </p>
              </div>
            </div>

            {canEditStructure && editorMode && (
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: isMobile ? "center" : "flex-end", width: isMobile ? "100%" : "auto" }}>
                <button onClick={() => handleDissolveFolder(item.id)} title="حذف المجلد وإبقاء الملفات بداخله" style={{ background: `${T.accent}22`, border: `1px solid ${T.accent}66`, color: T.accent, borderRadius: "8px", padding: "6px 10px", cursor: "pointer", fontSize: "12px", whiteSpace: "nowrap", flexShrink: 0 }}>📂🔓 تفريغ</button>
                <button onClick={() => deleteItem(index)} style={{ background: "#e5533322", border: "1px solid #e55", color: "#e55", borderRadius: "8px", padding: "6px 10px", cursor: "pointer", fontSize: "12px", flexShrink: 0 }}>🗑️</button>
              </div>
            )}
          </div>

          {isExpanded && (
            <div style={{ marginTop: "8px", width: "100%", boxSizing: "border-box", paddingLeft: "16px", paddingRight: "16px" }}>
              {children.length > 0 ? (
                children.map((child, childIndex) => renderItem(child, childIndex, depth + 1))
              ) : (
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
    const offlineKey = `${fileId}_offline`;
    const deviceKey = `${fileId}_device`;
    const isOfflineSaved = savedIds.has(fileId);
    const offlineProgress = dlProgress[offlineKey];
    const deviceProgress = dlProgress[deviceKey];
    const isOfflineDownloading = typeof offlineProgress === "number";
    const isDeviceDownloading = typeof deviceProgress === "number";

    const handleOfflineBtn = async () => {
      if (isOfflineDownloading || isDeviceDownloading || savingOfflineIds[offlineKey]) return;
      if (isOfflineSaved) {
        const saved = await idbGetFile(fileId);
        if (saved?.blob && saved.blob.size > 0) {
          const blobUrl = URL.createObjectURL(saved.blob);
          const effectiveMimeType = saved.blob.type || saved.type || getFileMimeType(item, saved.blob);
          setViewerData({ url: blobUrl, title: item.title, isBlob: true, mimeType: effectiveMimeType, id: item.id });
          return;
        }
      }

      setSavingOfflineIds(previous => ({ ...previous, [offlineKey]: true }));
      try {
        await downloadInApp(item);
      } finally {
        setSavingOfflineIds(previous => {
          const next = { ...previous };
          delete next[offlineKey];
          return next;
        });
      }
    };

    return (
      <div key={index} style={{ background: T.card, border: `1.5px solid ${offlineProgress === "done" ? "#23863688" : isOfflineSaved ? "#23863644" : offlineProgress === "error" ? "#e5533344" : T.cardBorder}`, borderRadius: "16px", padding: isMobile ? "12px" : "10px 18px", marginTop: "8px", backdropFilter: "blur(10px)", transition: "border-color 0.3s", display: "flex", alignItems: isMobile ? "stretch" : "center", justifyContent: "space-between", minHeight: "54px", gap: isMobile ? "10px" : "12px", width: "100%", boxSizing: "border-box", maxWidth: "100%", minWidth: 0, flexDirection: isMobile ? "column" : "row" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0, flex: isMobile ? "unset" : 1, width: isMobile ? "100%" : "auto", overflow: "hidden", justifyContent: isMobile ? "center" : "flex-start" }}>
          <div style={{ fontSize: "24px", flexShrink: 0 }}>{item.type === "pdf" ? "📄" : item.type === "image" ? "🖼️" : "🔗"}</div>
          <div style={{ minWidth: 0, overflow: "hidden", flex: 1, width: "100%" }}>
            <p style={{ margin: "0 0 2px", fontWeight: "700", color: T.text, fontSize: isMobile ? "13px" : "14px", whiteSpace: isMobile ? "normal" : "nowrap", overflow: "hidden", textOverflow: isMobile ? "clip" : "ellipsis", wordBreak: isMobile ? "break-word" : "normal", textAlign: isMobile ? "center" : "right" }}>{item.title}</p>
            {item.description && <p style={{ margin: 0, fontSize: "11px", color: T.subtext, whiteSpace: isMobile ? "normal" : "nowrap", overflow: "hidden", textOverflow: isMobile ? "clip" : "ellipsis", wordBreak: isMobile ? "break-word" : "normal", textAlign: isMobile ? "center" : "right" }}>{item.description}</p>}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", justifyContent: isMobile ? "center" : "flex-start", paddingLeft: isMobile ? 0 : "12px", flexShrink: 0, minWidth: 0, width: isMobile ? "100%" : "auto" }}>
          {item.url && (
            <>
              <button onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (item.type === "link") {
                  window.open(item.url, "_blank", "noopener,noreferrer");
                } else {
                  setViewerData({ url: item.url, title: item.title, mimeType: getFileMimeType(item), id: item.id });
                }
              }} style={{ background: T.accent, color: "#fff", border: "none", borderRadius: "10px", padding: "7px 12px", fontSize: "12px", cursor: "pointer", fontFamily: "'Cairo',sans-serif", fontWeight: "600", flexShrink: 0 }}>
                🌐 أونلاين
              </button>
              {item.type !== "link" && (
                <>
                  <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleOfflineBtn(); }} disabled={isOfflineDownloading || Boolean(savingOfflineIds[offlineKey]) || isDeviceDownloading} style={{ background: isOfflineSaved ? "#23863615" : T.sectionBg, color: isOfflineSaved ? "#238636" : T.accent, border: `1.5px solid ${isOfflineSaved ? "#238636" : T.accent}`, borderRadius: "10px", padding: "7px 12px", fontSize: "12px", cursor: isOfflineDownloading || savingOfflineIds[offlineKey] || isDeviceDownloading ? "not-allowed" : "pointer", opacity: isOfflineDownloading || savingOfflineIds[offlineKey] || isDeviceDownloading ? 0.65 : 1, fontFamily: "'Cairo',sans-serif", fontWeight: "700", flexShrink: 0 }}>
                    {isOfflineDownloading ? `⏳ ${offlineProgress}%` : (savingOfflineIds[offlineKey] ? "⏳ جاري الحفظ..." : (isOfflineSaved ? "📂 بدون نت" : "⬇️ حفظ للمعاينة أوفلاين"))}
                  </button>
                  {isOfflineSaved && (
                    <button onClick={async (e) => { e.preventDefault(); e.stopPropagation(); await idbDeleteFile(fileId); setSavedIds(s => { const n = new Set(s); n.delete(fileId); return n; }); }} style={{ background: "rgba(239,68,68,0.08)", color: "#dc2626", border: "1px solid #ef4444", borderRadius: "10px", padding: "7px 10px", fontSize: "12px", cursor: "pointer", fontFamily: "'Cairo',sans-serif", fontWeight: "700", flexShrink: 0 }}>
                      🗑️
                    </button>
                  )}
                  <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleSaveToDevice(item); }} disabled={isDeviceDownloading || Boolean(downloadingIds[deviceKey]) || Boolean(savingOfflineIds[offlineKey]) || isOfflineDownloading} style={{ background: isDeviceDownloading || savingOfflineIds[offlineKey] || isOfflineDownloading ? "#555" : `linear-gradient(135deg,${T.accent},${T.accent2})`, color: "#fff", border: "none", borderRadius: "10px", padding: "7px 12px", fontSize: "12px", cursor: isDeviceDownloading || savingOfflineIds[offlineKey] || isOfflineDownloading ? "not-allowed" : "pointer", opacity: isDeviceDownloading || savingOfflineIds[offlineKey] || isOfflineDownloading ? 0.65 : 1, fontFamily: "'Cairo',sans-serif", fontWeight: "700", whiteSpace: "nowrap", flexShrink: 0 }}>
                    {isDeviceDownloading ? `⏳ ${deviceProgress}%` : (downloadingIds[deviceKey] ? "⏳ جاري التحميل..." : (savingOfflineIds[offlineKey] ? "⏳ جاري الحفظ..." : "💾 حفظ للجهاز"))}
                  </button>
                </>
              )}
            </>
          )}
          <button onClick={() => toggleStar(item)} style={{ background: "transparent", border: "none", fontSize: "18px", cursor: "pointer", flexShrink: 0 }}>{isStarred(item) ? "⭐" : "☆"}</button>
          {canEditStructure && editorMode && <button onClick={() => deleteItem(index)} style={{ background: "#e5533322", border: "1px solid #e55", color: "#e55", borderRadius: "8px", padding: "6px 10px", cursor: "pointer", fontSize: "13px", flexShrink: 0 }}>🗑️</button>}
        </div>
      </div>
    );
  };

  return (
    <div className="app-shell" style={{ minHeight: "100vh", background: T.bg, fontFamily: "'Cairo',sans-serif", direction: "rtl", paddingBottom: "30px" }}>
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
          <button onClick={() => setShowAddFolderModal(true)} style={{ width: "100%", background: `${T.accent}15`, border: `2px dashed ${T.accent}`, borderRadius: "10px", padding: "12px", color: T.accent, fontSize: "13px", fontWeight: "700", cursor: "pointer", fontFamily: "'Cairo',sans-serif", marginBottom: "8px" }}>📁 إنشاء مجلد جديد</button>
          <button onClick={() => fileRef.current?.click()} style={{ width: "100%", background: `${T.accent}15`, border: `2px dashed ${T.accent}`, borderRadius: "10px", padding: "12px", color: T.accent, fontSize: "13px", fontWeight: "700", cursor: "pointer", fontFamily: "'Cairo',sans-serif", marginBottom: "8px" }}>{uploading ? `⏳ ${uploadPct}%` : "📤 إضافة رابط Google Drive"}</button>
          <input ref={fileRef} type="file" accept=".pdf,image/*" onChange={handleFileUpload} style={{ display: "none" }} />
          <input value={form.title} onChange={(e) => { setForm(prev => ({ ...prev, title: e.target.value })); }} placeholder="العنوان *" style={inputStyle} />
          <input value={form.url} onChange={(e) => { setForm(prev => ({ ...prev, url: e.target.value })); }} placeholder="رابط Google Drive" style={inputStyle} />
          <input value={form.description} onChange={(e) => { setForm(prev => ({ ...prev, description: e.target.value })); }} placeholder="وصف (اختياري)" style={inputStyle} />
          <button onClick={addResource} disabled={!form.title || !form.url} style={{ background: (form.title && form.url) ? `linear-gradient(135deg,${T.accent},${T.accent2})` : "#ccc", color: "#fff", border: "none", borderRadius: "10px", padding: "10px 18px", cursor: (form.title && form.url) ? "pointer" : "not-allowed", fontFamily: "'Cairo',sans-serif", fontSize: "13px", fontWeight: "700" }}>+ إضافة</button>
        </div>
      )}

      <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: "10px", width: "100%" }}>
        {loading && <p style={{ color: T.subtext, textAlign: "center" }}>جاري التحميل...</p>}
        {!loading && currentItems.length === 0 && <div style={{ textAlign: "center", padding: "40px" }}><div style={{ fontSize: "48px" }}>📭</div><p style={{ color: T.subtext }}>هذا المجلد فارغ</p></div>}
        {(() => {
          const safeItems = Array.isArray(currentItems) ? currentItems.filter(Boolean) : [];
          return safeItems.map((item, index) => renderItem(item, index, 0));
        })()}
      </div>

      <Modal open={showAddFolderModal} title="إنشاء مجلد جديد" onClose={() => setShowAddFolderModal(false)} footer={(
        <>
          <button onClick={() => setShowAddFolderModal(false)} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", borderRadius: "10px", padding: "10px 16px", cursor: "pointer" }}>إلغاء</button>
          <button onClick={() => { createFolder(); setShowAddFolderModal(false); }} style={{ background: `linear-gradient(135deg,${T.accent},${T.accent2})`, color: "#fff", border: "none", borderRadius: "10px", padding: "10px 16px", cursor: "pointer" }}>إنشاء</button>
        </>
      )}>
        <input value={newFolderName} onChange={e => setNewFolderName(e.target.value)} placeholder="اسم المجلد" style={inputStyle} />
      </Modal>

      <Modal open={showRenameModal} title="إعادة تسمية المجلد" onClose={() => setShowRenameModal(false)} footer={(
        <>
          <button onClick={() => setShowRenameModal(false)} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", borderRadius: "10px", padding: "10px 16px", cursor: "pointer" }}>إلغاء</button>
          <button onClick={handleRenameSubmit} style={{ background: `linear-gradient(135deg,${T.accent},${T.accent2})`, color: "#fff", border: "none", borderRadius: "10px", padding: "10px 16px", cursor: "pointer" }}>حفظ</button>
        </>
      )}>
        <input value={renameValue} onChange={e => setRenameValue(e.target.value)} placeholder="الاسم الجديد" style={inputStyle} />
      </Modal>

      <Modal open={showDriveLinkModal} title="أدخل رابط Google Drive" onClose={() => { setShowDriveLinkModal(false); setPendingUploadFile(null); setUploading(false); }} footer={(
        <>
          <button onClick={() => { setShowDriveLinkModal(false); setPendingUploadFile(null); setUploading(false); }} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", borderRadius: "10px", padding: "10px 16px", cursor: "pointer" }}>إلغاء</button>
          <button onClick={handleUploadLinkSubmit} style={{ background: `linear-gradient(135deg,${T.accent},${T.accent2})`, color: "#fff", border: "none", borderRadius: "10px", padding: "10px 16px", cursor: "pointer" }}>حفظ</button>
        </>
      )}>
        <p style={{ margin: 0, color: T.subtext, marginBottom: "12px" }}>{pendingUploadFile ? `حدد الرابط للملف: ${pendingUploadFile.name}` : "حدد ملفاً أولاً."}</p>
        <input value={driveLink} onChange={e => setDriveLink(e.target.value)} placeholder="رابط Google Drive" style={inputStyle} />
      </Modal>
    </div>
  );
}

// src/offlineHandler.js

// ⚠️ استبدل هذا الرابط برابط الوركر الخاص بك على Cloudflare
const WORKER_URL = "https://sawaed.hamodemsg.workers.dev/";
const CACHE_DB_NAME = "sawaed_offline_cache";
const CACHE_DB_VERSION = 1;
const CACHE_STORE = "cache";

function openCacheDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(CACHE_DB_NAME, CACHE_DB_VERSION);
    req.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(CACHE_STORE)) {
        db.createObjectStore(CACHE_STORE, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function cacheJson(key, value) {
  const db = await openCacheDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CACHE_STORE, "readwrite");
    const store = tx.objectStore(CACHE_STORE);
    const req = store.put({ key, value, cachedAt: Date.now() });
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

export async function getCachedJson(key) {
  const db = await openCacheDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CACHE_STORE, "readonly");
    const store = tx.objectStore(CACHE_STORE);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result?.value ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function clearCachedJson(key) {
  const db = await openCacheDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CACHE_STORE, "readwrite");
    const store = tx.objectStore(CACHE_STORE);
    const req = store.delete(key);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

export async function cacheBlob(key, blob, meta = {}) {
  const db = await openCacheDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CACHE_STORE, "readwrite");
    const store = tx.objectStore(CACHE_STORE);
    const req = store.put({
      key,
      value: blob,
      mimeType: blob?.type || meta.mimeType || "application/octet-stream",
      cachedAt: Date.now(),
      meta,
    });
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

export async function getCachedBlob(key) {
  const db = await openCacheDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CACHE_STORE, "readonly");
    const store = tx.objectStore(CACHE_STORE);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result?.value ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function clearCachedBlob(key) {
  return clearCachedJson(key);
}

export const checkIsFileCached = async (itemId) => {
  if (!("caches" in window)) return false;
  const cacheKey = `/offline-files/${itemId}`;
  const match = await caches.match(cacheKey);
  return !!match;
};

export const saveFileForOffline = (itemId) => {
  return new Promise((resolve, reject) => {
    if (!("serviceWorker" in navigator) || !navigator.serviceWorker.controller) {
      return reject(new Error("الـ Service Worker غير نشط حالياً"));
    }

    const targetUrl = `${WORKER_URL}?fileId=${itemId}`;
    const cacheKey = `/offline-files/${itemId}`;
    const channel = new MessageChannel();

    channel.port1.onmessage = (event) => {
      if (event.data?.success) resolve(cacheKey);
      else reject(new Error(event.data?.error || "فشل حفظ الملف"));
    };

    navigator.serviceWorker.controller.postMessage(
      { type: "CACHE_FILE", url: targetUrl, cacheKey },
      [channel.port2]
    );
  });
};

export const removeFileFromOffline = (itemId) => {
  return new Promise((resolve) => {
    if (!("serviceWorker" in navigator) || !navigator.serviceWorker.controller) {
      return resolve(false);
    }

    const cacheKey = `/offline-files/${itemId}`;
    const channel = new MessageChannel();

    channel.port1.onmessage = (event) => resolve(!!event.data?.success);

    navigator.serviceWorker.controller.postMessage(
      { type: "DELETE_CACHE", cacheKey },
      [channel.port2]
    );
  });
};

export const openOfflineFile = async (itemId) => {
  const cacheKey = `/offline-files/${itemId}`;
  const cachedResponse = await caches.match(cacheKey);

  if (cachedResponse) {
    const blob = await cachedResponse.blob();
    const fileUrl = URL.createObjectURL(blob);
    window.open(fileUrl, "_blank");
  } else {
    window.open(`${WORKER_URL}?fileId=${itemId}`, "_blank");
  }
};
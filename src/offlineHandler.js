/* ==========================================================================
   START SECTION: Offline Caching & Local Storage Handler
   ========================================================================== */

// src/offlineHandler.js
  import { buildCloudflareWorkerFileUrl, cloudflareWorkerBaseUrl } from "./config";

  /* --- START SUBSECTION: Cache Database Configuration --- */
  const CACHE_DB_NAME = "sawaed_offline_cache";
  const CACHE_DB_VERSION = 1;
  const CACHE_STORE = "cache";

  const normalizeCacheKey = (itemId) => `/offline-files/${String(itemId ?? "").trim()}`;
  const getWorkerFileUrl = (itemId) => buildCloudflareWorkerFileUrl(itemId);

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
  /* --- END SUBSECTION: Cache Database Configuration --- */

  /* --- START SUBSECTION: JSON Caching Operations --- */
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
  /* --- END SUBSECTION: JSON Caching Operations --- */

  /* --- START SUBSECTION: Blob Caching Operations (Unused) --- */
  /* NOTE: The following blob caching helper is retained for compatibility, but
     only clearCachedBlob is actively exposed and used by the application. */
  export async function clearCachedBlob(key) {
    return clearCachedJson(key);
  }
  /* --- END SUBSECTION: Blob Caching Operations (Unused) --- */

  /* --- START SUBSECTION: Offline File Access & Cleanup --- */
  export const openOfflineFile = async (itemId) => {
    const cacheKey = normalizeCacheKey(itemId);
    const cachedResponse = await caches.match(cacheKey);

    if (cachedResponse) {
      const blob = await cachedResponse.blob();
      const fileUrl = URL.createObjectURL(blob);
      return {
        url: fileUrl,
        blob,
        cached: true,
        cleanup: () => URL.revokeObjectURL(fileUrl),
      };
    }

    const proxyUrl = getWorkerFileUrl(itemId);
    return {
      url: proxyUrl,
      blob: null,
      cached: false,
      cleanup: () => undefined,
    };
  };

  /* --- END SUBSECTION: Offline File Access & Cleanup --- */

  export { cloudflareWorkerBaseUrl };

/* ==========================================================================
   END SECTION: Offline Caching & Local Storage Handler
   ========================================================================== */
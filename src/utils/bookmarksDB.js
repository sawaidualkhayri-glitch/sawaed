const DATABASE_NAME = "sawaed_bookmarks";
const DATABASE_VERSION = 1;
const BOOKMARKS_STORE = "pdf_bookmarks";
const NOTES_STORE = "lesson_notes";

function openBookmarksDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(BOOKMARKS_STORE)) {
        database.createObjectStore(BOOKMARKS_STORE, { keyPath: "fileId" });
      }
      if (!database.objectStoreNames.contains(NOTES_STORE)) {
        database.createObjectStore(NOTES_STORE, { keyPath: "fileId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getPdfBookmark(fileId) {
  if (!fileId) return null;
  const database = await openBookmarksDB();
  return new Promise((resolve, reject) => {
    const request = database.transaction(BOOKMARKS_STORE, "readonly").objectStore(BOOKMARKS_STORE).get(fileId);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function savePdfBookmark(fileId, lastPage) {
  if (!fileId || !Number.isFinite(lastPage)) return;
  const database = await openBookmarksDB();
  return new Promise((resolve, reject) => {
    const request = database.transaction(BOOKMARKS_STORE, "readwrite").objectStore(BOOKMARKS_STORE).put({ fileId, lastPage, updatedAt: Date.now() });
    request.onsuccess = resolve;
    request.onerror = () => reject(request.error);
  });
}

export async function getLessonNote(fileId) {
  if (!fileId) return null;
  const database = await openBookmarksDB();
  return new Promise((resolve, reject) => {
    const request = database.transaction(NOTES_STORE, "readonly").objectStore(NOTES_STORE).get(fileId);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function saveLessonNote(fileId, noteText, highlights = []) {
  if (!fileId) return;
  const database = await openBookmarksDB();
  return new Promise((resolve, reject) => {
    const request = database.transaction(NOTES_STORE, "readwrite").objectStore(NOTES_STORE).put({ fileId, noteText, highlights, updatedAt: Date.now() });
    request.onsuccess = resolve;
    request.onerror = () => reject(request.error);
  });
}

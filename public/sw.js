// ============================================================
// SERVICE WORKER - سواعد الخير PWA
// الإصدار: 2.0 - مع دعم Cache API + خط ثان لـ Google Drive
// ============================================================

const CACHE_NAME = "sawaed-v2";
const SHELL_CACHE = "sawaed-shell-v2";

// ملفات الشل الأساسية (الواجهة نفسها)
const SHELL_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
];

// ============================================================
// INSTALL - يحفظ ملفات الشل
// ============================================================
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => {
      return cache.addAll(SHELL_ASSETS).catch(() => {
        // لا توقف إذا فشل ملف ما
        console.log("[SW] Shell cache partial");
      });
    })
  );
  self.skipWaiting();
});

// ============================================================
// ACTIVATE - ينظف الكاشات القديمة
// ============================================================
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME && k !== SHELL_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ============================================================
// FETCH - منطق التعامل مع الطلبات
// ============================================================
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // ❶ طلبات Firestore → دائماً من الشبكة
  if (url.hostname.includes("firestore.googleapis.com")) {
    event.respondWith(fetchWithFallback(request));
    return;
  }

  // ❷ ملفات Google Drive → شبكة أولاً، ثم كاش
  if (
    url.hostname.includes("drive.google.com") ||
    url.hostname.includes("docs.google.com")
  ) {
    event.respondWith(networkFirstWithCache(request, CACHE_NAME));
    return;
  }

  // ❸ طلبات PROXY للملفات (من API داخلي)
  if (url.pathname.startsWith("/api/proxy")) {
    event.respondWith(proxyAndCache(request));
    return;
  }

  // ❹ ملفات الشل (HTML, JS, CSS) → كاش أولاً
  if (
    request.mode === "navigate" ||
    url.pathname.endsWith(".html") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css")
  ) {
    event.respondWith(cacheFirstWithNetwork(request, SHELL_CACHE));
    return;
  }

  // ❺ الباقي → شبكة عادية
  event.respondWith(fetchWithFallback(request));
});

// ============================================================
// رسائل من التطبيق
// ============================================================
self.addEventListener("message", (event) => {
  if (event.data?.type === "CACHE_FILE") {
    // التطبيق يطلب من SW حفظ ملف في الكاش
    const { url, cacheKey } = event.data;
    cacheFileFromURL(url, cacheKey)
      .then(() => event.ports[0]?.postMessage({ success: true }))
      .catch((err) => event.ports[0]?.postMessage({ success: false, error: err.message }));
  }

  if (event.data?.type === "DELETE_CACHE") {
    const { cacheKey } = event.data;
    deleteCachedFile(cacheKey)
      .then(() => event.ports[0]?.postMessage({ success: true }))
      .catch(() => event.ports[0]?.postMessage({ success: false }));
  }

  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// ============================================================
// استراتيجيات الكاش
// ============================================================

async function fetchWithFallback(request) {
  try {
    return await fetch(request);
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response("غير متصل بالإنترنت", { status: 503 });
  }
}

async function networkFirstWithCache(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(
      JSON.stringify({ error: "غير متاح بدون إنترنت" }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }
}

async function cacheFirstWithNetwork(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response("غير متصل", { status: 503 });
  }
}

async function proxyAndCache(request) {
  // هذا يُستدعى لو أضفت endpoint بروكسي خاص بك
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response("غير متاح", { status: 503 });
  }
}

// ============================================================
// دوال مساعدة للكاش
// ============================================================

async function cacheFileFromURL(url, cacheKey) {
  const cache = await caches.open(CACHE_NAME);
  const response = await fetch(url, { mode: "cors" });
  if (!response.ok) throw new Error("فشل التحميل: " + response.status);
  await cache.put(cacheKey || url, response);
}

async function deleteCachedFile(cacheKey) {
  const cache = await caches.open(CACHE_NAME);
  await cache.delete(cacheKey);
}

// ============================================================
// SERVICE WORKER — سواعد الخير v3
// ============================================================

const CACHE_NAME = "sawaed-v3";
const SHELL_CACHE = "sawaed-shell-v3";
const SHELL_ASSETS = ["/", "/index.html", "/manifest.json"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(SHELL_CACHE).then(c => c.addAll(SHELL_ASSETS).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME && k !== SHELL_CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.hostname.includes("firestore.googleapis.com") || url.hostname.includes("api.emailjs.com")) {
    e.respondWith(fetch(e.request).catch(() => new Response("{}", { status: 503 })));
    return;
  }
  if (e.request.mode === "navigate" || url.pathname.endsWith(".html")) {
    e.respondWith(
      caches.match(e.request).then(c => c || fetch(e.request).then(r => {
        if (r.ok) caches.open(SHELL_CACHE).then(cache => cache.put(e.request, r.clone()));
        return r;
      }))
    );
    return;
  }
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});

self.addEventListener("message", (e) => {
  if (e.data?.type === "SHOW_NOTIFICATION") {
    self.registration.showNotification(e.data.title || "سواعد الخير", {
      body: e.data.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      dir: "rtl",
      lang: "ar",
      tag: "sawaed-news",
    });
  }
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(clients.openWindow("/"));
});
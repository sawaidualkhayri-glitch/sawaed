// ============================================================
// SERVICE WORKER — سواعد الخير PWA (v3)
// ============================================================

const CACHE_NAME = "sawaed-files-v3";
const SHELL_CACHE = "sawaed-shell-v3";

// ملفات الشل الأساسية
const SHELL_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png"
];

// 1. INSTALL - حفظ ملفات الشل الأساسية
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => {
      return cache.addAll(SHELL_ASSETS).catch((err) => {
        console.warn("[SW] Shell asset caching issue:", err);
      });
    })
  );
  self.skipWaiting();
});

// 2. ACTIVATE - تنظيف الكاشات القديمة تلقائياً
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

// 3. FETCH - اعتراض وتوجيه الطلبات
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // استثناء خدمات Firebase و EmailJS من الكاش
  if (
    url.hostname.includes("firestore.googleapis.com") ||
    url.hostname.includes("api.emailjs.com") ||
    url.hostname.includes("identitytoolkit.googleapis.com")
  ) {
    event.respondWith(fetch(request).catch(() => new Response("{}", { status: 503 })));
    return;
  }

  // ملفات الشل وواجهة التطبيق (Cache First)
  if (request.mode === "navigate" || url.pathname.endsWith(".html")) {
    event.respondWith(
      caches.match(request).then((cached) => {
        return (
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          })
        );
      })
    );
    return;
  }

  // باقي الطلبات (Network First مع الرجوع للكاش)
  event.respondWith(
    caches.match(request).then((cached) => {
      return cached || fetch(request);
    })
  );
});

// 4. MESSAGE - استقبال الأوامر من التطبيق (حفظ وحذف ملفات الأوفلاين)
self.addEventListener("message", (event) => {
  const { type, url, cacheKey, title, body } = event.data || {};

  if (type === "CACHE_FILE") {
    caches.open(CACHE_NAME).then(async (cache) => {
      try {
        const response = await fetch(url, { mode: "cors" });
        if (response.ok) {
          await cache.put(cacheKey || url, response);
          event.ports[0]?.postMessage({ success: true });
        } else {
          throw new Error(`HTTP Error ${response.status}`);
        }
      } catch (err) {
        event.ports[0]?.postMessage({ success: false, error: err.message });
      }
    });
  }

  if (type === "DELETE_CACHE") {
    caches.open(CACHE_NAME).then((cache) => {
      cache.delete(cacheKey).then((success) => {
        event.ports[0]?.postMessage({ success });
      });
    });
  }

  if (type === "SHOW_NOTIFICATION") {
    self.registration.showNotification(title || "سواعد الخير", {
      body: body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      dir: "rtl",
      lang: "ar",
      tag: "sawaed-news",
    });
  }

  if (type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
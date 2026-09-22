importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: 'AIzaSyDDKXk9tihlBz7J4r7zJb7U4g3k43g8ZcA',
  authDomain: 'sawaed-da065.firebaseapp.com',
  projectId: 'sawaed-da065',
  storageBucket: 'sawaed-da065.firebasestorage.app',
  messagingSenderId: '132028772776',
  appId: '1:132028772776:web:1bc5d801d07a94122a2d9d',
  measurementId: 'G-717EEQ1Q0M',
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();
const notificationIconUrl = 'https://sawaidalkhayri.pages.dev/pwa-192x192.png';
const notificationBadgeUrl = 'https://sawaidalkhayri.pages.dev/badge-icon.png';
const notificationFallbackUrl = 'https://sawaidalkhayri.pages.dev/';

messaging.onBackgroundMessage((payload) => {
  const title = payload?.notification?.title || 'إشعار جديد';
  const body = payload?.notification?.body || '';

  self.registration.showNotification(title, {
    body,
    icon: notificationIconUrl,
    badge: notificationBadgeUrl,
    data: { ...(payload?.data || {}), url: payload?.data?.url || notificationFallbackUrl },
    dir: 'rtl',
    lang: 'ar',
    tag: 'sawaed-fcm',
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const rawTargetUrl = event.notification.data?.url || notificationFallbackUrl;
  const targetUrl = new URL(rawTargetUrl, notificationFallbackUrl).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes('sawaidalkhayri.pages.dev') && 'focus' in client) {
          return Promise.resolve(client.navigate(targetUrl)).then(() => client.focus());
        }
      }

      if (clients.openWindow) return clients.openWindow(targetUrl);
      return undefined;
    })
  );
});

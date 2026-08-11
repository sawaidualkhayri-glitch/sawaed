importScripts('/sw.js');
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

messaging.onBackgroundMessage((payload) => {
  const title = payload?.notification?.title || 'إشعار جديد';
  const body = payload?.notification?.body || '';

  self.registration.showNotification(title, {
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    dir: 'rtl',
    lang: 'ar',
    tag: 'sawaed-fcm',
  });
});

// firebase-messaging-sw.js — WR MusicPro v3 (2026-08-04)
// Service Worker dedicado para Firebase Cloud Messaging (background push)

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDhgSbEbtUmXMmgn0dnLoODM0sGS35-fzI",
  authDomain: "wr-music.firebaseapp.com",
  projectId: "wr-music",
  storageBucket: "wr-music.appspot.com",
  messagingSenderId: "357562439771",
  appId: "1:357562439771:web:9583a273539352d0cc877e"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[FCM-SW] Mensagem recebida em background:', payload);

  const title = payload.notification?.title || payload.data?.title || 'WR MusicPro 🎵';
  const body  = payload.notification?.body  || payload.data?.body  || 'Você tem um novo aviso.';

  self.registration.showNotification(title, {
    body,
    icon:  '/icon-192.png',
    badge: '/icon-badge.png',
    data:  { url: payload.fcmOptions?.link || payload.data?.url || '/' },
    vibrate: [300, 100, 300],
    requireInteraction: true,
    tag: 'wr-fcm-' + Date.now()
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.includes(url) && 'focus' in c) return c.focus();
      }
      return clients.openWindow(url);
    })
  );
});

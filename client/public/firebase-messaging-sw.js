// firebase-messaging-sw.js — WR MusicPro v2.1 (2026-08-04)
// IMPORTANTE: Alterar este comentário força o browser a reinstalar o Service Worker.
try {
  importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-messaging-compat.js');
} catch (e) {
  console.warn('[firebase-messaging-sw.js] Falha ao carregar scripts do Firebase via importScripts:', e);
}

const firebaseConfig = {
  apiKey: "AIzaSyDhgSbEbtUmXMmgn0dnLoODM0sGS35-fzI",
  authDomain: "wr-music.firebaseapp.com",
  projectId: "wr-music",
  storageBucket: "wr-music.appspot.com",
  messagingSenderId: "357562439771",
  appId: "1:357562439771:web:9583a273539352d0cc877e"
};

self.addEventListener('install', (event) => {
  console.log('[firebase-messaging-sw.js] Instalando Service Worker...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[firebase-messaging-sw.js] Ativando Service Worker...');
  event.waitUntil(self.clients.claim());
});

try {
  if (typeof firebase !== 'undefined') {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    if (firebase.messaging && firebase.messaging.isSupported()) {
      const messaging = firebase.messaging();
      messaging.onBackgroundMessage((payload) => {
        console.log('[firebase-messaging-sw.js] Background Push FCM recebido:', payload);
        const notificationTitle = payload.notification?.title || payload.data?.title || 'WR MusicPro';
        const notificationBody = payload.notification?.body || payload.data?.body || 'Você tem uma nova mensagem ou lembrete.';
        const notificationOptions = {
          body: notificationBody,
          icon: payload.notification?.icon || payload.data?.icon || '/icon-192.png',
          badge: payload.notification?.badge || payload.data?.badge || '/icon-badge.png',
          data: {
            url: payload.fcmOptions?.link || payload.data?.url || '/',
            ...payload.data
          },
          vibrate: [300, 100, 300, 100, 300],
          requireInteraction: true,
          renotify: true,
          tag: (payload.data?.tag || 'wr-music') + '-' + Date.now()
        };

        return self.registration.showNotification(notificationTitle, notificationOptions);
      });
    }
  }
} catch (err) {
  console.warn('[firebase-messaging-sw.js] Erro ao inicializar:', err);
}

self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notificação clicada:', event.notification);
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Listener Nativo Web Push (Garante exibição caso a mensagem venha via PushManager)
self.addEventListener('push', (event) => {
  console.log('[firebase-messaging-sw.js] Evento push nativo recebido:', event);
  if (!event.data) return;

  try {
    const payload = event.data.json();
    const notificationTitle = payload.notification?.title || payload.title || payload.data?.title || 'WR MusicPro 🎉';
    const notificationBody = payload.notification?.body || payload.body || payload.data?.body || 'Você tem um novo aviso ou lembrete.';
    
    const notificationOptions = {
      body: notificationBody,
      icon: payload.notification?.icon || payload.icon || '/icon-192.png',
      badge: '/icon-badge.png',
      data: {
        url: payload.data?.url || payload.url || '/',
        ...payload.data
      },
      vibrate: [300, 100, 300, 100, 300],
      requireInteraction: true,
      renotify: true,
      tag: 'wr-music-' + Date.now()
    };

    event.waitUntil(
      self.registration.showNotification(notificationTitle, notificationOptions)
    );
  } catch (err) {
    console.warn('[firebase-messaging-sw.js] Falha ao ler payload JSON do push nativo:', err);
  }
});


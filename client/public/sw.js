// WR MusicPro Service Worker — v5 (2026-08-04)
// SW unificado: PWA cache + Firebase Cloud Messaging

// ─── Firebase Messaging (FCM background push) ───────────────────────────────
try {
  importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-messaging-compat.js');
} catch (e) {
  console.warn('[sw.js] Falha ao carregar Firebase via importScripts:', e);
}

const firebaseConfig = {
  apiKey: "AIzaSyDhgSbEbtUmXMmgn0dnLoODM0sGS35-fzI",
  authDomain: "wr-music.firebaseapp.com",
  projectId: "wr-music",
  storageBucket: "wr-music.appspot.com",
  messagingSenderId: "357562439771",
  appId: "1:357562439771:web:9583a273539352d0cc877e"
};

let firebaseMessaging = null;

try {
  if (typeof firebase !== 'undefined') {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    if (firebase.messaging && firebase.messaging.isSupported()) {
      firebaseMessaging = firebase.messaging();
      firebaseMessaging.onBackgroundMessage((payload) => {
        console.log('[sw.js] Background Push FCM recebido:', payload);
        const notificationTitle = payload.notification?.title || payload.data?.title || 'WR MusicPro';
        const notificationBody = payload.notification?.body || payload.data?.body || 'Você tem um novo aviso.';
        const notificationOptions = {
          body: notificationBody,
          icon: '/icon-192.png',
          badge: '/icon-badge.png',
          data: {
            url: payload.fcmOptions?.link || payload.data?.url || '/',
            ...payload.data
          },
          vibrate: [300, 100, 300, 100, 300],
          requireInteraction: true,
          renotify: true,
          tag: 'wr-music-fcm-' + Date.now()
        };
        return self.registration.showNotification(notificationTitle, notificationOptions);
      });
      console.log('[sw.js] ✅ Firebase Messaging inicializado com sucesso.');
    }
  }
} catch (err) {
  console.warn('[sw.js] Erro ao inicializar Firebase:', err);
}

// ─── PWA Cache ───────────────────────────────────────────────────────────────
const CACHE_NAME = 'wr-music-cache-v6';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

self.addEventListener('install', (event) => {
  console.log('[sw.js] Instalando SW v5...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[sw.js] Ativando SW v5...');
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[sw.js] Removendo cache antigo:', cache);
            return caches.delete(cache);
          }
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // CRÍTICO: Não interceptar chamadas para APIs do Google/Firebase
  // O SW interceptando essas chamadas causa "Failed to fetch" no getToken()
  if (
    url.includes('/api/') ||
    url.startsWith('chrome-extension') ||
    url.includes('googleapis.com') ||
    url.includes('gstatic.com') ||
    url.includes('firebaseio.com') ||
    url.includes('firebaseapp.com') ||
    url.includes('firebase.com') ||
    url.includes('google.com')
  ) return;

  // Estratégia Network-First para navegação
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Cache-First para outros assets
  event.respondWith(
    caches.match(event.request).then((response) => response || fetch(event.request))
  );
});

// ─── Push nativo (fallback caso Firebase compat não capture) ─────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    // Se o Firebase compat já tratou, não duplicar
    if (firebaseMessaging) return;
    const title = data.notification?.title || data.title || 'WR MusicPro 🎵';
    const options = {
      body: data.notification?.body || data.body || 'Você tem um novo aviso.',
      icon: '/icon-192.png',
      badge: '/icon-badge.png',
      data: { url: data.fcmOptions?.link || data.url || '/', ...data },
      vibrate: [300, 100, 300],
      requireInteraction: true,
      tag: 'wr-music-push-' + Date.now()
    };
    event.waitUntil(self.registration.showNotification(title, options));
  } catch (e) {
    console.error('[sw.js] Erro ao processar push nativo:', e);
  }
});

// ─── Clique na notificação ────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(urlToOpen) && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(urlToOpen);
    })
  );
});

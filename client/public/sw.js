// WR MusicPro Service Worker — v6 Forense (2026-08-05)
// SW unificado com instrumentação forense completa para WebPush e FCM

function logSWEvent(eventName, data, startTime = null) {
  const duration = startTime ? `${(performance.now() - startTime).toFixed(2)}ms` : 'N/A';
  const timestamp = new Date().toISOString();
  console.log(`[SW-FORENSIC][${timestamp}][${eventName}][Duration: ${duration}]`, data || '');
}

// ─── Eventos de Ciclo de Vida do SW (Etapa 4) ──────────────────────────────────
self.addEventListener('install', (event) => {
  const start = performance.now();
  logSWEvent('install', { scope: self.registration?.scope });
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
      .then(() => logSWEvent('install_success', null, start))
      .catch((err) => logSWEvent('install_error', { error: err.message, stack: err.stack }, start))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  const start = performance.now();
  logSWEvent('activate', { scope: self.registration?.scope });
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            logSWEvent('cache_delete', { cache });
            return caches.delete(cache);
          }
        })
      )
    ).then(() => logSWEvent('activate_success', null, start))
     .catch((err) => logSWEvent('activate_error', { error: err.message, stack: err.stack }, start))
  );
  self.clients.claim();
});

self.addEventListener('message', (event) => {
  logSWEvent('message', { origin: event.origin, data: event.data, sourceId: event.source?.id });
});

self.addEventListener('messageerror', (event) => {
  logSWEvent('messageerror', { error: event });
});

self.addEventListener('sync', (event) => {
  logSWEvent('sync', { tag: event.tag });
});

// ─── Firebase Messaging (FCM background push) ───────────────────────────────
importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyAe_q-DK_wvORnjtd5Fhfj2RhdQgHYFgqc",
  authDomain: "music-novo.firebaseapp.com",
  projectId: "music-novo",
  storageBucket: "music-novo.firebasestorage.app",
  messagingSenderId: "491750077201",
  appId: "1:491750077201:web:5d5aa167a714330cf452b0"
};

let firebaseMessaging = null;

try {
  if (typeof firebase !== 'undefined') {
    if (!firebase.apps.length) {
      logSWEvent('firebase_initializeApp_start', firebaseConfig);
      firebase.initializeApp(firebaseConfig);
      logSWEvent('firebase_initializeApp_success', null);
    }
    if (firebase.messaging && firebase.messaging.isSupported()) {
      firebaseMessaging = firebase.messaging();
      logSWEvent('firebase_getMessaging_success', null);
      firebaseMessaging.onBackgroundMessage((payload) => {
        logSWEvent('fcm_background_message_received', payload);
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
    }
  }
} catch (err) {
  logSWEvent('firebase_init_error', { error: err.message, stack: err.stack });
}

// ─── PWA Cache ───────────────────────────────────────────────────────────────
const CACHE_NAME = 'wr-music-cache-v8';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  if (
    url.includes('/api/') ||
    url.startsWith('chrome-extension') ||
    url.includes('googleapis.com') ||
    url.includes('gstatic.com') ||
    url.includes('firebaseio.com') ||
    url.includes('firebaseapp.com') ||
    url.includes('firebase.com') ||
    url.includes('google.com')
  ) {
    logSWEvent('fetch_bypassed_google_api', { url, method: event.request.method });
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => response || fetch(event.request))
  );
});

// ─── Push nativo (fallback/monitoramento forense) ────────────────────────────
self.addEventListener('push', (event) => {
  const start = performance.now();
  logSWEvent('push_raw_event_received', { hasData: !!event.data });

  if (!event.data) return;
  try {
    const data = event.data.json();
    logSWEvent('push_payload_parsed', data);
    if (firebaseMessaging) {
      logSWEvent('push_handled_by_firebase_compat', null);
      return;
    }
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
    event.waitUntil(
      self.registration.showNotification(title, options)
        .then(() => logSWEvent('showNotification_success', null, start))
        .catch((err) => logSWEvent('showNotification_error', { error: err.message, stack: err.stack }, start))
    );
  } catch (e) {
    logSWEvent('push_event_error', { error: e.message, stack: e.stack }, start);
  }
});

// ─── Eventos de Notificação ──────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  logSWEvent('notificationclick', { title: event.notification?.title, tag: event.notification?.tag, action: event.action });
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

self.addEventListener('notificationclose', (event) => {
  logSWEvent('notificationclose', { title: event.notification?.title, tag: event.notification?.tag });
});


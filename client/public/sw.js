// Firebase Messaging Scripts para Web Push FCM
try {
  importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-messaging-compat.js');
} catch (e) {
  console.warn('[sw.js] Falha ao carregar scripts do Firebase via importScripts:', e);
}

const firebaseConfig = {
  apiKey: "AIzaSyDhgSbEbtUmXMmgn0dnLoODM0sGS35-fzI",
  authDomain: "wr-music.firebaseapp.com",
  projectId: "wr-music",
  storageBucket: "wr-music.appspot.com",
  messagingSenderId: "357562439771",
  appId: "1:357562439771:web:9583a273539352d0cc877e"
};

try {
  if (typeof firebase !== 'undefined') {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    if (firebase.messaging && firebase.messaging.isSupported()) {
      const messaging = firebase.messaging();
      messaging.onBackgroundMessage((payload) => {
        console.log('[sw.js] Background Push FCM recebido:', payload);
        const notificationTitle = payload.notification?.title || payload.data?.title || 'WR MusicPro';
        const notificationOptions = {
          body: payload.notification?.body || payload.data?.body || 'Você tem uma nova mensagem ou lembrete.',
          icon: payload.notification?.icon || payload.data?.icon || '/icon-192.png',
          badge: payload.notification?.badge || payload.data?.badge || '/icon-badge.png',
          data: {
            url: payload.fcmOptions?.link || payload.data?.url || '/',
            ...payload.data
          },
          vibrate: [200, 100, 200],
          tag: payload.data?.tag || 'wr-music-notification'
        };

        return self.registration.showNotification(notificationTitle, notificationOptions);
      });
    }
  }
} catch (err) {
  console.warn('[sw.js] Erro ao inicializar Firebase no SW:', err);
}

const CACHE_NAME = 'wr-music-cache-v4';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// Instalação do Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Ativação e limpeza de cache antigo
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Intercepter requisições
self.addEventListener('fetch', (event) => {
  // Ignorar requisições de API e extensões
  if (event.request.url.includes('/api/') || event.request.url.startsWith('chrome-extension')) return;

  // Estratégia Network-First para o index.html e navegação
  // Isso garante que sempre pegamos a versão mais nova do app se houver rede
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('/index.html');
      })
    );
    return;
  }

  // Para outros assets (imagens, etc), usa Cache-First com fallback para rede
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

// Escutar notificações push (preparação e fallback)
self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    const title = data.notification?.title || data.title || 'Novo Lembrete WR MusicPro';
    const options = {
      body: data.notification?.body || data.content || data.body || 'Você tem um novo aviso no sistema de música.',
      icon: data.notification?.icon || '/icon-192.png',
      badge: data.notification?.badge || '/icon-badge.png',
      data: {
        url: data.fcmOptions?.link || data.url || '/',
        ...data
      },
      vibrate: [300, 100, 300, 100, 300],
      requireInteraction: true,
      renotify: true,
      tag: 'wr-music-' + Date.now()
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (e) {
    console.error('[sw.js] Erro ao processar evento push:', e);
  }
});

self.addEventListener('notificationclick', (event) => {
  console.log('[sw.js] Notificação clicada:', event.notification);
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

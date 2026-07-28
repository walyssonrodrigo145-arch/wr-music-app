// Firebase Messaging Scripts para Web Push FCM
importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyDhgSbEbtUmXMmgn0dnLoODM0sGS35-fzI",
  authDomain: "wr-music.firebaseapp.com",
  projectId: "wr-music",
  storageBucket: "wr-music.appspot.com",
  messagingSenderId: "357562439771",
  appId: "1:357562439771:web:9583a273539352d0cc877e"
};

try {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();
  messaging.onBackgroundMessage((payload) => {
    console.log('[sw.js] Background Push FCM recebido:', payload);
  });
} catch (err) {
  console.warn('[sw.js] Erro ao inicializar Firebase no SW:', err);
}

const CACHE_NAME = 'wr-music-cache-v3';
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

// Escutar notificações push (preparação para o futuro)
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Novo Lembrete';
  const options = {
    body: data.content || 'Você tem um novo aviso no sistema de música.',
    icon: '/icon-192.png',
    badge: '/icon-badge.png',
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

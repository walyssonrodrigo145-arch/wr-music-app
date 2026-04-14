const CACHE_NAME = 'wr-music-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json'
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

// Interceptar requisições (offline parcial)
self.addEventListener('fetch', (event) => {
  // Ignorar requisições de API (queremos dados frescos)
  if (event.request.url.includes('/api/')) return;

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
    icon: 'https://cdn-icons-png.flaticon.com/512/3844/3844724.png',
    badge: 'https://cdn-icons-png.flaticon.com/512/3844/3844724.png',
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

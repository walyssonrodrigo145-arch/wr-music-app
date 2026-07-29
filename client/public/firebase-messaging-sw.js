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
    console.log('[firebase-messaging-sw.js] Background Push FCM recebido:', payload);
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


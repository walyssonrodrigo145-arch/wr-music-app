importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-messaging-compat.js');

// Configuração do Firebase no Service Worker
const firebaseConfig = {
  apiKey: "AIzaSyDhgSbEbtUmXMmgn0dnLoODM0sGS35-fzI",
  authDomain: "wr-music.firebaseapp.com",
  projectId: "wr-music",
  storageBucket: "wr-music.appspot.com",
  messagingSenderId: "357562439771",
  appId: "1:357562439771:web:9583a273539352d0cc877e"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Fica escutando por mensagens recebidas enquanto a aba estiver em background
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  // O Firebase SDK já exibe notificações automaticamente se o payload contiver 'notification'.
  // Se enviarmos apenas 'data', podemos chamar self.registration.showNotification aqui.
});

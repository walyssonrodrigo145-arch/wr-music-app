import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDhgSbEbtUmXMmgn0dnLoODM0sGS35-fzI",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "wr-music.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "wr-music",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "wr-music.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "357562439771",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:357562439771:web:9583a273539352d0cc877e"
};

const app = initializeApp(firebaseConfig);
const messaging = typeof window !== 'undefined' ? getMessaging(app) : null;

export const requestForToken = async () => {
  if (!messaging || typeof window === 'undefined') return null;
  try {
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY || "BPwWTFTQ0tHqNkipjYq4LtuaLDwQzkjdCuiQdj3IAtakqyJQ9i9XEWx16Vcorcgot6cqKYaaPiv-5hRO40SKIgo";

    let swRegistration: ServiceWorkerRegistration | undefined = undefined;
    if ('serviceWorker' in navigator) {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        if (regs.length > 0) {
          swRegistration = regs.find(r => r.active && (r.active.scriptURL.includes('firebase-messaging-sw.js') || r.active.scriptURL.includes('sw.js'))) || regs[0];
        }
        if (!swRegistration) {
          swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        }
      } catch (swErr) {
        console.warn('Busca de Service Worker falhou, usando navigator.serviceWorker.ready...', swErr);
        swRegistration = await navigator.serviceWorker.ready.catch(() => undefined);
      }
    }

    const currentToken = await getToken(messaging, { 
      vapidKey,
      ...(swRegistration ? { serviceWorkerRegistration: swRegistration } : {})
    });

    if (currentToken) {
      console.log('FCM Token gerado com sucesso:', currentToken);
      return currentToken;
    } else {
      console.warn('Nenhum token FCM retornado pelo Firebase.');
      return null;
    }
  } catch (err: any) {
    console.error('Erro ao buscar token FCM:', err);
    throw err;
  }
};

export const onMessageListener = () => {
  if (!messaging) return new Promise((resolve) => resolve(null));
  return new Promise((resolve) => {
    onMessage(messaging, (payload) => {
      resolve(payload);
    });
  });
};

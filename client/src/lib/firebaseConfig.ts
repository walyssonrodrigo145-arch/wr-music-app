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

const promiseWithTimeout = <T>(promise: Promise<T>, ms: number, errorMsg: string): Promise<T> => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(errorMsg)), ms);
    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
};

export const requestForToken = async () => {
  if (!messaging || typeof window === 'undefined') return null;

  return promiseWithTimeout(
    (async () => {
      const vapidKey =
        import.meta.env.VITE_FIREBASE_VAPID_KEY ||
        "BPwWTFTQ0tHqNkipjYq4LtuaLDwQzkjdCuiQdj3IAtakqyJQ9i9XEWx16Vcorcgot6cqKYaaPiv-5hRO40SKIgo";

      let swRegistration: ServiceWorkerRegistration | undefined = undefined;

      if ('serviceWorker' in navigator) {
        try {
          // Tenta pegar o Service Worker principal ativo (/sw.js)
          let reg = await navigator.serviceWorker.ready.catch(() => undefined);
          
          if (!reg) {
            reg = await navigator.serviceWorker.register('/sw.js').catch(() => undefined);
          }
          if (!reg) {
            reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' }).catch(() => undefined);
          }

          if (reg && !reg.active) {
            const startTime = Date.now();
            while (!reg.active && Date.now() - startTime < 3000) {
              await new Promise((r) => setTimeout(r, 100));
            }
          }
          swRegistration = reg;
        } catch (swErr) {
          console.warn('Falha ao obter Service Worker:', swErr);
        }
      }

      const currentToken = await getToken(messaging, {
        vapidKey,
        ...(swRegistration ? { serviceWorkerRegistration: swRegistration } : {}),
      });

      if (currentToken) {
        console.log('FCM Token gerado com sucesso:', currentToken);
        return currentToken;
      } else {
        console.warn('Nenhum token FCM retornado pelo Firebase.');
        return null;
      }
    })(),
    10000,
    "O serviço FCM não respondeu a tempo (timeout). Tente novamente."
  );
};

export const onMessageListener = () => {
  if (!messaging) return new Promise((resolve) => resolve(null));
  return new Promise((resolve) => {
    onMessage(messaging, (payload) => {
      resolve(payload);
    });
  });
};

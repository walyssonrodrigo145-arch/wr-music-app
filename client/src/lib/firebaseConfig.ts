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

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

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
          let reg = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
          if (!reg) {
            reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
          }
          if (reg && !reg.active) {
            const startTime = Date.now();
            while (!reg.active && Date.now() - startTime < 3000) {
              await new Promise((r) => setTimeout(r, 100));
            }
          }
          swRegistration = reg || (await navigator.serviceWorker.ready.catch(() => undefined));
        } catch (swErr) {
          console.warn('Falha ao obter Service Worker:', swErr);
          swRegistration = await navigator.serviceWorker.ready.catch(() => undefined);
        }
      }

      // Nível 1: Tenta obter token FCM com serviceWorkerRegistration explícito
      try {
        const token1 = await getToken(messaging, {
          vapidKey,
          ...(swRegistration ? { serviceWorkerRegistration: swRegistration } : {}),
        });
        if (token1) {
          console.log('FCM Token (Nível 1) gerado com sucesso:', token1);
          return token1;
        }
      } catch (err1) {
        console.warn('FCM Token (Nível 1) falhou:', err1);
      }

      // Nível 2: Tenta obter token FCM sem serviceWorkerRegistration explícito
      try {
        const token2 = await getToken(messaging, { vapidKey });
        if (token2) {
          console.log('FCM Token (Nível 2) gerado com sucesso:', token2);
          return token2;
        }
      } catch (err2) {
        console.warn('FCM Token (Nível 2) falhou:', err2);
      }

      // Nível 3: Fallback para assinatura Web Push nativa da API do navegador
      if (swRegistration && 'pushManager' in swRegistration) {
        try {
          console.log('Tentando assinatura Web Push nativa como fallback...');
          const sub = await swRegistration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidKey),
          });
          if (sub) {
            const nativeToken = JSON.stringify(sub);
            console.log('Token Web Push Nativo (Nível 3) gerado:', nativeToken);
            return nativeToken;
          }
        } catch (nativeErr) {
          console.warn('Fallback Web Push nativo (Nível 3) falhou:', nativeErr);
        }
      }

      console.warn('Não foi possível gerar chave de notificação por nenhum dos 3 métodos.');
      return null;
    })(),
    12000,
    "O serviço de notificações não respondeu a tempo. Verifique sua conexão e tente novamente."
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

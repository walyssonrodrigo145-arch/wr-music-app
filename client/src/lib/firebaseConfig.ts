import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage, deleteToken } from "firebase/messaging";

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

const VAPID_KEY =
  import.meta.env.VITE_FIREBASE_VAPID_KEY ||
  "BPwWTFTQ0tHqNkipjYq4LtuaLDwQzkjdCuiQdj3IAtakqyJQ9i9XEWx16Vcorcgot6cqKYaaPiv-5hRO40SKIgo";

const promiseWithTimeout = <T>(promise: Promise<T>, ms: number, errorMsg: string): Promise<T> => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(errorMsg)), ms);
    promise
      .then((res) => { clearTimeout(timer); resolve(res); })
      .catch((err) => { clearTimeout(timer); reject(err); });
  });
};

async function getOrRegisterServiceWorker(): Promise<ServiceWorkerRegistration | undefined> {
  if (!('serviceWorker' in navigator)) return undefined;

  try {
    // Remove TODOS os service workers antigos para evitar cache de token inválido
    const allRegs = await navigator.serviceWorker.getRegistrations();
    for (const reg of allRegs) {
      if (reg.scope.includes(window.location.origin)) {
        // Só remove se não for o firebase-messaging-sw.js atual
        const swUrl = reg.active?.scriptURL || reg.installing?.scriptURL || reg.waiting?.scriptURL || '';
        if (!swUrl.includes('firebase-messaging-sw.js')) {
          await reg.unregister();
          console.log('[FCM] SW antigo removido:', swUrl);
        }
      }
    }

    // Registra (ou reutiliza) o firebase-messaging-sw.js
    let reg = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
    if (!reg) {
      reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
      console.log('[FCM] SW registrado.');
    } else {
      // Força update para pegar a versão mais recente do SW
      await reg.update();
      console.log('[FCM] SW atualizado.');
    }

    // Aguarda o SW ficar ativo (máx 5s)
    if (reg && !reg.active) {
      const startTime = Date.now();
      while (!reg.active && Date.now() - startTime < 5000) {
        await new Promise((r) => setTimeout(r, 100));
      }
    }

    return reg ?? (await navigator.serviceWorker.ready.catch(() => undefined));
  } catch (err) {
    console.warn('[FCM] Erro ao gerenciar Service Worker:', err);
    return await navigator.serviceWorker.ready.catch(() => undefined);
  }
}

export const requestForToken = async (forceRefresh = false): Promise<string | null> => {
  if (!messaging || typeof window === 'undefined') return null;

  return promiseWithTimeout(
    (async () => {
      // Se forceRefresh, apaga o token existente para forçar geração de novo
      if (forceRefresh) {
        try {
          await deleteToken(messaging);
          console.log('[FCM] Token anterior deletado para forçar refresh.');
        } catch (e) {
          console.warn('[FCM] Não foi possível deletar token anterior:', e);
        }
      }

      const swRegistration = await getOrRegisterServiceWorker();

      // Nível 1: FCM token com serviceWorkerRegistration explícito (preferencial)
      try {
        const token1 = await getToken(messaging, {
          vapidKey: VAPID_KEY,
          ...(swRegistration ? { serviceWorkerRegistration: swRegistration } : {}),
        });
        if (token1 && !token1.startsWith('{')) {
          console.log('[FCM] ✅ Token FCM (Nível 1) gerado:', token1.substring(0, 30) + '...');
          return token1;
        }
      } catch (err1) {
        console.warn('[FCM] Token (Nível 1) falhou:', err1);
      }

      // Nível 2: FCM token sem serviceWorkerRegistration
      try {
        const token2 = await getToken(messaging, { vapidKey: VAPID_KEY });
        if (token2 && !token2.startsWith('{')) {
          console.log('[FCM] ✅ Token FCM (Nível 2) gerado:', token2.substring(0, 30) + '...');
          return token2;
        }
      } catch (err2) {
        console.warn('[FCM] Token (Nível 2) falhou:', err2);
      }

      // IMPORTANTE: Nível 3 (Web Push nativo) REMOVIDO.
      // O Firebase Admin SDK NÃO consegue enviar para tokens no formato PushSubscription JSON.
      // Apenas tokens FCM reais (strings longas) são aceitos pelo sendPushNotification().

      console.warn('[FCM] ❌ Não foi possível gerar token FCM. Verifique se o Service Worker está instalado corretamente.');
      return null;
    })(),
    15000,
    "O serviço de notificações não respondeu a tempo. Tente novamente."
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

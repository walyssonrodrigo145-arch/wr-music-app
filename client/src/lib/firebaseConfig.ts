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

/**
 * Obtém o SW ativo do Firebase.
 * ESTRATÉGIA: usa o sw.js principal (que já tem Firebase Messaging embutido)
 * como service worker para o FCM. Isso evita conflito entre dois SWs.
 */
async function getActiveServiceWorker(): Promise<ServiceWorkerRegistration | undefined> {
  if (!('serviceWorker' in navigator)) return undefined;

  try {
    // Aguarda o SW principal (sw.js) ficar pronto
    const ready = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000))
    ]);

    if (!ready) {
      console.warn('[FCM] SW não ficou pronto em 4s, tentando registro manual...');
    }

    // Retorna o SW que está controlando a página (sw.js)
    const controlling = navigator.serviceWorker.controller;
    if (controlling) {
      const reg = await navigator.serviceWorker.getRegistration(controlling.scriptURL);
      if (reg) {
        console.log('[FCM] Usando SW ativo:', controlling.scriptURL);
        return reg;
      }
    }

    // Fallback: pega qualquer registro disponível
    const regs = await navigator.serviceWorker.getRegistrations();
    if (regs.length > 0) {
      // Prefere sw.js (tem Firebase embutido)
      const swJs = regs.find(r =>
        (r.active?.scriptURL || r.installing?.scriptURL || '').includes('sw.js') &&
        !(r.active?.scriptURL || r.installing?.scriptURL || '').includes('firebase-messaging')
      );
      if (swJs) {
        console.log('[FCM] Usando sw.js como SW do FCM');
        return swJs;
      }
      return regs[0];
    }

    return undefined;
  } catch (err) {
    console.warn('[FCM] Erro ao obter SW:', err);
    return undefined;
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
          // Pode falhar se não havia token — é normal
          console.warn('[FCM] Nenhum token anterior para deletar:', e);
        }
      }

      const swRegistration = await getActiveServiceWorker();

      // Tentativa 1: com SW explícito (mais confiável em PWA instalado)
      if (swRegistration) {
        try {
          const token1 = await getToken(messaging, {
            vapidKey: VAPID_KEY,
            serviceWorkerRegistration: swRegistration,
          });
          if (token1 && token1.length > 50) {
            console.log('[FCM] ✅ Token FCM obtido com SW explícito:', token1.substring(0, 30) + '...');
            return token1;
          }
        } catch (err1: any) {
          console.warn('[FCM] Tentativa 1 (com SW) falhou:', err1?.message || err1);
        }
      }

      // Tentativa 2: sem SW explícito (Firebase escolhe o SW automaticamente)
      try {
        const token2 = await getToken(messaging, { vapidKey: VAPID_KEY });
        if (token2 && token2.length > 50) {
          console.log('[FCM] ✅ Token FCM obtido sem SW explícito:', token2.substring(0, 30) + '...');
          return token2;
        }
      } catch (err2: any) {
        console.warn('[FCM] Tentativa 2 (sem SW) falhou:', err2?.message || err2);
      }

      console.warn('[FCM] ❌ Não foi possível obter token FCM. Verifique permissões e conexão.');
      return null;
    })(),
    20000,
    "O serviço de notificações demorou muito para responder. Feche o app completamente e tente novamente."
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

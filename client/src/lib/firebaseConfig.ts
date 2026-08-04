import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage, deleteToken, isSupported } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyDhgSbEbtUmXMmgn0dnLoODM0sGS35-fzI",
  authDomain: "wr-music.firebaseapp.com",
  projectId: "wr-music",
  storageBucket: "wr-music.appspot.com",
  messagingSenderId: "357562439771",
  appId: "1:357562439771:web:9583a273539352d0cc877e"
};

const VAPID_KEY = "BPwWTFTQ0tHqNkipjYq4LtuaLDwQzkjdCuiQdj3IAtakqyJQ9i9XEWx16Vcorcgot6cqKYaaPiv-5hRO40SKIgo";

const app = initializeApp(firebaseConfig);

let _messaging: ReturnType<typeof getMessaging> | null = null;

async function getMsg() {
  if (_messaging) return _messaging;
  try {
    const ok = await isSupported();
    if (!ok) return null;
    _messaging = getMessaging(app);
    return _messaging;
  } catch { return null; }
}

/**
 * Obtém o service worker ativo (sw.js) para usar como SW do FCM.
 * Usa o sw.js principal que já funciona no PWA — evita registrar
 * o firebase-messaging-sw.js com escopo /firebase-cloud-messaging-push-scope
 * que crashava por causa do importScripts sem try/catch.
 */
async function getActiveSW(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    // Aguarda o SW principal estar pronto (máx 6s)
    const ready = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>(r => setTimeout(() => r(null), 6000))
    ]);
    if (ready && ready instanceof ServiceWorkerRegistration) {
      console.log('[FCM] SW ativo:', ready.active?.scriptURL || 'unknown');
      return ready;
    }
    return null;
  } catch (e) {
    console.warn('[FCM] Erro ao obter SW:', e);
    return null;
  }
}

export const requestForToken = async (forceRefresh = false): Promise<string | null> => {
  const msg = await getMsg();
  if (!msg) {
    throw new Error("Firebase Messaging não é suportado neste navegador/dispositivo.");
  }

  // Verifica permissão explicitamente
  if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
    throw new Error("Permissão de notificação não concedida. Vá nas configurações do navegador e permita notificações para este site.");
  }

  if (forceRefresh) {
    try { await deleteToken(msg); } catch { /* normal */ }
  }

  const swReg = await getActiveSW();

  // Tentativa 1: com SW explícito (sw.js que já funciona no PWA)
  if (swReg) {
    try {
      console.log('[FCM] getToken com SW explícito...');
      const token = await getToken(msg, { vapidKey: VAPID_KEY, serviceWorkerRegistration: swReg });
      if (token && token.length > 50) {
        console.log('[FCM] ✅ Token obtido:', token.substring(0, 30) + '...');
        return token;
      }
    } catch (e: any) {
      console.warn('[FCM] Tentativa 1 falhou:', e.message);
    }
  }

  // Tentativa 2: sem SW (Firebase usa firebase-messaging-sw.js por padrão,
  // agora com try/catch não vai mais crashar)
  try {
    console.log('[FCM] getToken sem SW explícito...');
    const token2 = await getToken(msg, { vapidKey: VAPID_KEY });
    if (token2 && token2.length > 50) {
      console.log('[FCM] ✅ Token obtido (sem SW):', token2.substring(0, 30) + '...');
      return token2;
    }
  } catch (e: any) {
    throw new Error(`Firebase falhou: ${e.message || e.code || String(e)}`);
  }

  throw new Error("Token FCM não gerado. Verifique se as notificações estão PERMITIDAS nas configurações do navegador.");
};

export const onMessageListener = async () => {
  const msg = await getMsg();
  if (!msg) return new Promise(r => r(null));
  return new Promise(resolve => {
    onMessage(msg, payload => resolve(payload));
  });
};

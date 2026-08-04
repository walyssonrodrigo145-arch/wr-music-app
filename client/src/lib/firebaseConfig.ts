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

async function registerDedicatedSW(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    console.log('[FCM] Dedicated SW registered:', reg.scope);
    return reg;
  } catch (e) {
    console.warn('[FCM] Dedicated SW registration failed:', e);
    return null;
  }
}

export const requestForToken = async (forceRefresh = false): Promise<string | null> => {
  const msg = await getMsg();
  if (!msg) {
    throw new Error("Firebase Messaging não é suportado neste navegador/dispositivo.");
  }

  if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
    throw new Error("Permissão de notificação não concedida. Vá nas configurações do navegador e permita notificações para este site.");
  }

  if (forceRefresh) {
    try { await deleteToken(msg); } catch { /* normal */ }
  }

  // Garantir que firebase-messaging-sw.js está registrado no escopo padrão '/'
  const swReg = await registerDedicatedSW();

  try {
    console.log('[FCM] Solicitando token ao Firebase com SW registrado...');
    const options: any = { vapidKey: VAPID_KEY };
    if (swReg) {
      options.serviceWorkerRegistration = swReg;
    }
    const token = await getToken(msg, options);
    if (token && token.length > 50) {
      console.log('[FCM] ✅ Token obtido:', token.substring(0, 30) + '...');
      return token;
    }
  } catch (e: any) {
    console.error('[FCM] Erro no getToken:', e);
    throw new Error(`Firebase falhou: ${e?.message || e?.code || String(e)}`);
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

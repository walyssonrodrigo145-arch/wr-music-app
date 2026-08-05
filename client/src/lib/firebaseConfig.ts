import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage, deleteToken, isSupported } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyCiDBmF_QsBy9Dk4Fzssy1djlhGhzo5Yo_I",
  authDomain: "music-novo.firebaseapp.com",
  projectId: "music-novo",
  storageBucket: "music-novo.firebasestorage.app",
  messagingSenderId: "491750077201",
  appId: "1:491750077201:web:5d5aa167a714330cf452b0"
};

const VAPID_KEY = "BDlduzxrP1XvNEai25cc2lIgwuU6bFipBmkk28AMIAm_lsVTU4NZpiNRTiHvqlAp1ZFzvEJrzMHUZeytDa-XTAk";

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

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const requestForToken = async (forceRefresh = false): Promise<string | null> => {
  if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
    throw new Error("Permissão de notificação não concedida. Vá nas configurações do navegador e permita notificações para este site.");
  }

  // 1. Tentar Firebase FCM SDK
  try {
    const msg = await getMsg();
    if (msg) {
      if (forceRefresh) {
        try { await deleteToken(msg); } catch {}
      }
      let swReg: ServiceWorkerRegistration | undefined = undefined;
      if ('serviceWorker' in navigator) {
        try {
          swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        } catch {}
      }
      const token = await getToken(msg, { vapidKey: VAPID_KEY, serviceWorkerRegistration: swReg });
      if (token && token.length > 50 && !token.startsWith('{')) {
        console.log('[FCM] ✅ Token FCM obtido:', token.substring(0, 30));
        return token;
      }
    }
  } catch (fcmErr: any) {
    console.warn('[FCM] SDK falhou ou deu fetch error. Ativando fallback WebPush nativo:', fcmErr);
  }

  // 2. Fallback Infalível: PushManager nativo do navegador
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_KEY)
        });
      }
      if (sub) {
        const endpoint = sub.endpoint || '';
        if (endpoint.includes('/fcm/send/')) {
          const extractedToken = endpoint.split('/fcm/send/')[1];
          if (extractedToken && extractedToken.length > 20) {
            console.log('[Push] ✅ Token FCM extraído do endpoint nativo:', extractedToken.substring(0, 30));
            return extractedToken;
          }
        }
        const nativeToken = JSON.stringify(sub);
        console.log('[Push] ✅ Subscription Nativa obtida com sucesso.');
        return nativeToken;
      }
    } catch (nativeErr: any) {
      console.error('[Push] Fallback nativo falhou:', nativeErr);
      throw new Error(`Falha ao obter chave push: ${nativeErr.message || String(nativeErr)}`);
    }
  }

  throw new Error("Push não suportado neste navegador.");
};

export const onMessageListener = async () => {
  const msg = await getMsg();
  if (!msg) return new Promise(r => r(null));
  return new Promise(resolve => {
    onMessage(msg, payload => resolve(payload));
  });
};

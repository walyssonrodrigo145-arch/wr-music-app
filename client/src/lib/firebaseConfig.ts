import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";

// AUD-002 FIX: Removido sistema forense que interceptava console.error/warn,
// window.fetch e PushManager globalmente — expondo tokens e dados internos em
// window.__PUSH_FORENSIC_LOGS__ acessível por qualquer script externo ou XSS.
//
// Firebase config agora lida de variáveis de ambiente VITE_FIREBASE_*.
// VAPID Key carregada de VITE_FIREBASE_VAPID_KEY.
// AUD-009 FIX: Removida duplicação hardcoded do firebaseConfig.

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string;

let app: ReturnType<typeof initializeApp>;
try {
  app = initializeApp(firebaseConfig);
} catch (err: any) {
  console.error("[Firebase] Falha ao inicializar:", err?.message || err);
  throw err;
}

let _messaging: ReturnType<typeof getMessaging> | null = null;

async function getMsg() {
  if (_messaging) return _messaging;
  try {
    const ok = await isSupported();
    if (!ok) return null;
    _messaging = getMessaging(app);
    return _messaging;
  } catch {
    return null;
  }
}

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const requestForToken = async (forceRefresh = false): Promise<string | null> => {
  if (typeof Notification !== "undefined" && Notification.permission !== "granted") {
    throw new Error("Permissão de notificação não concedida.");
  }

  if (!("serviceWorker" in navigator)) {
    throw new Error("Push não suportado neste navegador.");
  }

  let swReg: ServiceWorkerRegistration;
  try {
    if (navigator.serviceWorker.controller) {
      swReg = await navigator.serviceWorker.ready;
    } else {
      swReg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
    }
  } catch (err: any) {
    throw new Error(`Falha no Service Worker: ${err.message || String(err)}`);
  }

  // Limpar subscrição anterior se forceRefresh
  if (forceRefresh) {
    try {
      const existingSub = await swReg.pushManager.getSubscription();
      if (existingSub) {
        await existingSub.unsubscribe();
      }
    } catch {
      // Ignorar erro ao limpar subscrição anterior
    }
  }

  const msg = await getMsg();
  if (!msg) {
    throw new Error("Firebase Messaging não é suportado neste navegador.");
  }

  try {
    const token = await getToken(msg, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swReg,
    });

    if (token && token.length > 10) {
      return token;
    }
    throw new Error("Token retornado pelo Firebase veio vazio.");
  } catch (fcmErr: any) {
    const detail = fcmErr?.message || String(fcmErr);
    const isPushServiceError =
      detail.includes("push service error") ||
      detail.includes("AbortError") ||
      detail.includes("Registration failed");

    if (isPushServiceError) {
      // Auto-recovery: reset SW e retry
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));

        await new Promise((res) => setTimeout(res, 1500));

        const freshReg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        await navigator.serviceWorker.ready;

        _messaging = null;
        const freshMsg = await getMsg();
        if (!freshMsg) throw new Error("Firebase Messaging não disponível após reset.");

        const retryToken = await getToken(freshMsg, {
          vapidKey: VAPID_KEY,
          serviceWorkerRegistration: freshReg,
        });

        if (retryToken && retryToken.length > 10) return retryToken;
        throw new Error("Token vazio após retry.");
      } catch {
        throw new Error(
          "Seu navegador não conseguiu conectar ao serviço de Push do Google. " +
            "Tente: 1) Conectar ao WiFi; 2) Limpar dados do Chrome; 3) Reiniciar o celular."
        );
      }
    }

    throw new Error(`Falha no SDK Firebase: ${detail}`);
  }
};

export const onMessageListener = async () => {
  const msg = await getMsg();
  if (!msg) return new Promise((r) => r(null));
  return new Promise((resolve) => {
    onMessage(msg, (payload) => {
      resolve(payload);
    });
  });
};

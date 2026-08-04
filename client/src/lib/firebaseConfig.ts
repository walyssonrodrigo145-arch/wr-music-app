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

let messagingInstance: ReturnType<typeof getMessaging> | null = null;

async function getMessagingInstance() {
  if (messagingInstance) return messagingInstance;
  try {
    const supported = await isSupported();
    if (!supported) {
      console.warn('[FCM] Firebase Messaging não é suportado neste navegador.');
      return null;
    }
    messagingInstance = getMessaging(app);
    return messagingInstance;
  } catch (e) {
    console.warn('[FCM] Erro ao inicializar Firebase Messaging:', e);
    return null;
  }
}

/**
 * Registra e ativa o firebase-messaging-sw.js explicitamente.
 * ESTRATÉGIA: Usa o SW dedicado do FCM com skipWaiting para garantir ativação imediata.
 */
async function registerFCMServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;

  try {
    // Registra o firebase-messaging-sw.js (SW dedicado ao FCM)
    const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/firebase-cloud-messaging-push-scope',
      updateViaCache: 'none' // Sempre busca versão nova
    });

    console.log('[FCM] SW registrado, scope:', reg.scope);

    // Força update para pegar versão mais recente
    await reg.update();

    // Aguarda SW ficando ativo (máx 8 segundos)
    if (!reg.active) {
      console.log('[FCM] Aguardando SW ficar ativo...');
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('SW demorou para ativar')), 8000);
        const sw = reg.installing || reg.waiting;
        if (!sw) { clearTimeout(timeout); resolve(); return; }
        sw.addEventListener('statechange', (e: any) => {
          if (e.target.state === 'activated') {
            clearTimeout(timeout);
            resolve();
          }
        });
      });
    }

    return reg;
  } catch (err: any) {
    // Tenta com scope padrão se o scope customizado falhar
    console.warn('[FCM] Falha com scope customizado, tentando scope padrão:', err.message);
    try {
      const fallbackReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
        scope: '/',
        updateViaCache: 'none'
      });
      await fallbackReg.update();
      // Aguarda ativação
      if (!fallbackReg.active) {
        await navigator.serviceWorker.ready;
      }
      return fallbackReg;
    } catch (err2: any) {
      console.error('[FCM] Falha total no registro do SW:', err2.message);
      return null;
    }
  }
}

export const requestForToken = async (forceRefresh = false): Promise<string | null> => {
  const msgInstance = await getMessagingInstance();
  if (!msgInstance) return null;

  try {
    // Se forceRefresh, apaga o token existente
    if (forceRefresh) {
      try {
        await deleteToken(msgInstance);
        console.log('[FCM] Token anterior deletado.');
      } catch (e) {
        // Normal se não havia token cadastrado
      }
    }

    // Registra o SW dedicado do FCM
    const swReg = await registerFCMServiceWorker();

    // Tentativa 1: com SW explícito do FCM
    if (swReg) {
      try {
        console.log('[FCM] Tentando getToken com SW explícito...');
        const token = await getToken(msgInstance, {
          vapidKey: VAPID_KEY,
          serviceWorkerRegistration: swReg,
        });
        if (token && token.length > 50 && !token.startsWith('{')) {
          console.log('[FCM] ✅ Token obtido com SW explícito:', token.substring(0, 30) + '...');
          return token;
        }
        console.warn('[FCM] getToken retornou vazio ou inválido com SW explícito.');
      } catch (err: any) {
        console.warn('[FCM] Tentativa com SW explícito falhou:', err.message);
      }
    }

    // Tentativa 2: sem SW (Firebase encontra automaticamente)
    try {
      console.log('[FCM] Tentando getToken sem SW explícito...');
      const token2 = await getToken(msgInstance, { vapidKey: VAPID_KEY });
      if (token2 && token2.length > 50 && !token2.startsWith('{')) {
        console.log('[FCM] ✅ Token obtido sem SW explícito:', token2.substring(0, 30) + '...');
        return token2;
      }
      console.warn('[FCM] getToken retornou vazio ou inválido sem SW.');
    } catch (err2: any) {
      console.warn('[FCM] Tentativa sem SW falhou:', err2.message);
      // Propaga a mensagem de erro detalhada para o usuário
      throw new Error(`Firebase getToken falhou: ${err2.message || err2.code || String(err2)}`);
    }

    return null;
  } catch (outerErr: any) {
    throw outerErr;
  }
};

export const onMessageListener = async () => {
  const msgInstance = await getMessagingInstance();
  if (!msgInstance) return new Promise((resolve) => resolve(null));
  return new Promise((resolve) => {
    onMessage(msgInstance, (payload) => resolve(payload));
  });
};

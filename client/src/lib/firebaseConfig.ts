import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage, deleteToken, isSupported } from "firebase/messaging";

// ─── ESTRUTURA DE DIAGNÓSTICO FORENSE (ETAPA 11) ──────────────────────────────
export interface ForensicLogEntry {
  timestamp: string;
  category: 'FIREBASE' | 'INSTALLATIONS' | 'PUSH_MANAGER' | 'BROWSER' | 'VAPID' | 'HTTP' | 'CONSOLE' | 'ISOLATED_TEST';
  action: string;
  durationMs?: number;
  params?: any;
  result?: any;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
}

declare global {
  interface Window {
    __PUSH_FORENSIC_LOGS__: ForensicLogEntry[];
    runPushForensicAudit: () => Promise<any>;
  }
}

if (typeof window !== 'undefined') {
  window.__PUSH_FORENSIC_LOGS__ = window.__PUSH_FORENSIC_LOGS__ || [];
}

function addForensicLog(entry: Omit<ForensicLogEntry, 'timestamp'>) {
  const log: ForensicLogEntry = {
    timestamp: new Date().toISOString(),
    ...entry
  };
  if (typeof window !== 'undefined') {
    window.__PUSH_FORENSIC_LOGS__.push(log);
  }
  console.log(`[FORENSIC-AUDIT][${log.category}][${log.action}]`, log);
  return log;
}

// ─── ETAPA 9 — INTERCEPTAÇÃO DE CONSOLE E ERROS GLOBAIS ──────────────────────
if (typeof window !== 'undefined' && !(window as any).__FORENSIC_CONSOLE_PATCHED__) {
  (window as any).__FORENSIC_CONSOLE_PATCHED__ = true;

  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;

  console.error = function (...args: any[]) {
    addForensicLog({
      category: 'CONSOLE',
      action: 'console.error',
      params: args.map(a => (a instanceof Error ? { name: a.name, message: a.message, stack: a.stack } : String(a)))
    });
    originalConsoleError.apply(console, args);
  };

  console.warn = function (...args: any[]) {
    addForensicLog({
      category: 'CONSOLE',
      action: 'console.warn',
      params: args.map(a => String(a))
    });
    originalConsoleWarn.apply(console, args);
  };

  window.addEventListener('error', (event) => {
    addForensicLog({
      category: 'CONSOLE',
      action: 'window.onerror',
      error: {
        name: 'UncaughtError',
        message: event.message,
        stack: event.error?.stack,
      },
      params: { filename: event.filename, lineno: event.lineno, colno: event.colno }
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const err = event.reason;
    addForensicLog({
      category: 'CONSOLE',
      action: 'window.onunhandledrejection',
      error: {
        name: err?.name || 'UnhandledRejection',
        message: err?.message || String(err),
        stack: err?.stack,
        code: err?.code
      }
    });
  });
}

// ─── ETAPA 2 & 8 — INTERCEPTAÇÃO DE REQUISIÇÕES HTTP ─────────────────────────
if (typeof window !== 'undefined' && !(window as any).__FORENSIC_FETCH_PATCHED__) {
  (window as any).__FORENSIC_FETCH_PATCHED__ = true;
  const originalFetch = window.fetch;

  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const isTargetDomain = [
      'firebaseinstallations.googleapis.com',
      'fcmregistrations.googleapis.com',
      'fcm.googleapis.com',
      'googleapis.com',
      'mtalk.google.com'
    ].some(domain => url.includes(domain));

    if (!isTargetDomain) {
      return originalFetch.apply(this, [input, init]);
    }

    const start = performance.now();
    const method = init?.method || (typeof input === 'object' && 'method' in input ? input.method : 'GET');
    const headers = init?.headers || (typeof input === 'object' && 'headers' in input ? input.headers : {});
    let bodySent: any = init?.body;

    try {
      if (typeof bodySent === 'string') {
        try { bodySent = JSON.parse(bodySent); } catch {}
      }
    } catch {}

    addForensicLog({
      category: 'HTTP',
      action: 'HTTP_REQUEST_START',
      params: { url, method, headers, bodySent }
    });

    try {
      const response = await originalFetch.apply(this, [input, init]);
      const durationMs = performance.now() - start;
      const clone = response.clone();
      let responseBody: any = null;
      try {
        const text = await clone.text();
        try { responseBody = JSON.parse(text); } catch { responseBody = text; }
      } catch (e) {
        responseBody = '[Could not read response body]';
      }

      addForensicLog({
        category: 'HTTP',
        action: 'HTTP_REQUEST_RESPONSE',
        durationMs,
        params: { url, method, status: response.status, statusText: response.statusText, headers: Object.fromEntries(response.headers.entries()) },
        result: { body: responseBody }
      });

      return response;
    } catch (err: any) {
      const durationMs = performance.now() - start;
      addForensicLog({
        category: 'HTTP',
        action: 'HTTP_REQUEST_ERROR',
        durationMs,
        params: { url, method },
        error: { name: err.name, message: err.message, stack: err.stack }
      });
      throw err;
    }
  };
}

// ─── ETAPA 3 — INTERCEPTAÇÃO DO PUSHMANAGER.SUBSCRIBE ────────────────────────
if (typeof window !== 'undefined' && typeof PushManager !== 'undefined' && !(PushManager.prototype as any).__FORENSIC_SUBSCRIBE_PATCHED__) {
  const originalSubscribe = PushManager.prototype.subscribe;
  (PushManager.prototype as any).__FORENSIC_SUBSCRIBE_PATCHED__ = true;

  PushManager.prototype.subscribe = async function (options?: PushSubscriptionOptionsInit): Promise<PushSubscription> {
    const start = performance.now();
    const appKey = options?.applicationServerKey;
    let appKeyInfo: any = null;

    if (appKey) {
      if (appKey instanceof ArrayBuffer) {
        appKeyInfo = { type: 'ArrayBuffer', byteLength: appKey.byteLength };
      } else if (ArrayBuffer.isView(appKey)) {
        appKeyInfo = { type: appKey.constructor.name, byteLength: appKey.byteLength, length: (appKey as any).length };
      } else {
        appKeyInfo = { type: typeof appKey, value: String(appKey) };
      }
    }

    const callStack = new Error().stack;

    addForensicLog({
      category: 'PUSH_MANAGER',
      action: 'subscribe_called',
      params: {
        userVisibleOnly: options?.userVisibleOnly,
        applicationServerKeyInfo: appKeyInfo,
        callStack
      }
    });

    try {
      const subscription = await originalSubscribe.call(this, options);
      const durationMs = performance.now() - start;
      const json = subscription.toJSON();

      addForensicLog({
        category: 'PUSH_MANAGER',
        action: 'subscribe_success',
        durationMs,
        result: {
          endpoint: subscription.endpoint,
          expirationTime: subscription.expirationTime,
          keys: json.keys
        }
      });
      return subscription;
    } catch (err: any) {
      const durationMs = performance.now() - start;
      addForensicLog({
        category: 'PUSH_MANAGER',
        action: 'subscribe_error',
        durationMs,
        error: {
          name: err.name,
          message: err.message,
          stack: err.stack || callStack,
          code: err.code
        }
      });
      throw err;
    }
  };
}

// ─── CONFIGURAÇÃO FIREBASE E VAPID ───────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyAe_q-DK_wvORnjtd5Fhfj2RhdQgHYFgqc",
  authDomain: "music-novo.firebaseapp.com",
  projectId: "music-novo",
  storageBucket: "music-novo.firebasestorage.app",
  messagingSenderId: "491750077201",
  appId: "1:491750077201:web:5d5aa167a714330cf452b0"
};

export const VAPID_KEY = "BDlduzxrP1XvNEai25cc2lIgwuU6bFipBmkk28AMIAm_lsVTU4NZpiNRTiHvqlAp1ZFzvEJrzMHUZeytDa-XTAk";

// ETAPA 1: Instrumentar initializeApp
const startInitApp = performance.now();
let app: any;
try {
  app = initializeApp(firebaseConfig);
  addForensicLog({
    category: 'FIREBASE',
    action: 'initializeApp_success',
    durationMs: performance.now() - startInitApp,
    params: { projectId: firebaseConfig.projectId, appId: firebaseConfig.appId }
  });
} catch (err: any) {
  addForensicLog({
    category: 'FIREBASE',
    action: 'initializeApp_error',
    durationMs: performance.now() - startInitApp,
    error: { name: err.name, message: err.message, stack: err.stack }
  });
  throw err;
}

let _messaging: ReturnType<typeof getMessaging> | null = null;

async function getMsg() {
  if (_messaging) return _messaging;
  const start = performance.now();
  try {
    const ok = await isSupported();
    addForensicLog({
      category: 'FIREBASE',
      action: 'isSupported_check',
      durationMs: performance.now() - start,
      result: ok
    });
    if (!ok) return null;
    _messaging = getMessaging(app);
    addForensicLog({
      category: 'FIREBASE',
      action: 'getMessaging_success',
      result: { appName: _messaging.app.name }
    });
    return _messaging;
  } catch (err: any) {
    addForensicLog({
      category: 'FIREBASE',
      action: 'getMessaging_error',
      durationMs: performance.now() - start,
      error: { name: err.name, message: err.message, stack: err.stack }
    });
    return null;
  }
}

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// ─── ETAPA 7 — AUDITORIA DE VAPID E FINGERPRINT ──────────────────────────────
async function auditVAPIDKey(keyStr: string) {
  const start = performance.now();
  try {
    const bytes = urlBase64ToUint8Array(keyStr);
    let hexFingerprint = 'N/A';
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', bytes.buffer as ArrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      hexFingerprint = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
    const vapidAudit = {
      originalKey: keyStr,
      lengthChars: keyStr.length,
      byteLength: bytes.byteLength,
      uint8ArraySample: Array.from(bytes.slice(0, 10)),
      sha256Fingerprint: hexFingerprint
    };
    addForensicLog({
      category: 'VAPID',
      action: 'VAPID_AUDIT_RESULT',
      durationMs: performance.now() - start,
      result: vapidAudit
    });
    return vapidAudit;
  } catch (err: any) {
    addForensicLog({
      category: 'VAPID',
      action: 'VAPID_AUDIT_ERROR',
      durationMs: performance.now() - start,
      error: { name: err.name, message: err.message, stack: err.stack }
    });
    return null;
  }
}

// ─── ETAPA 5 & 12 — CAPTURA COMPLETA DE ESTADO DO NAVEGADOR E SW REGISTRATIONS ─
async function captureBrowserState() {
  if (typeof window === 'undefined') return null;

  let swRegistrations: any[] = [];
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    swRegistrations = regs.map(r => ({
      scope: r.scope,
      activeScriptURL: r.active?.scriptURL,
      activeState: r.active?.state,
      installingScriptURL: r.installing?.scriptURL,
      waitingScriptURL: r.waiting?.scriptURL,
    }));
  } catch (e: any) {
    swRegistrations = [{ error: e.message }];
  }

  let readyRegistrationInfo: any = null;
  let existingSubscriptionInfo: any = null;

  try {
    const readyReg = await navigator.serviceWorker.ready;
    readyRegistrationInfo = {
      scope: readyReg.scope,
      activeScriptURL: readyReg.active?.scriptURL,
      activeState: readyReg.active?.state
    };

    // ETAPA 6 — SUBSCRIPTION EXISTING AUDIT
    const sub = await readyReg.pushManager.getSubscription();
    if (sub) {
      const json = sub.toJSON();
      existingSubscriptionInfo = {
        exists: true,
        endpoint: sub.endpoint,
        expirationTime: sub.expirationTime,
        p256dh: json.keys?.p256dh,
        auth: json.keys?.auth
      };
    } else {
      existingSubscriptionInfo = { exists: false };
    }
  } catch (e: any) {
    readyRegistrationInfo = { error: e.message };
  }

  const browserState = {
    notificationPermission: typeof Notification !== 'undefined' ? Notification.permission : 'unsupported',
    onLine: navigator.onLine,
    userAgent: navigator.userAgent,
    hasController: !!navigator.serviceWorker.controller,
    controllerScriptURL: navigator.serviceWorker.controller?.scriptURL,
    controllerState: navigator.serviceWorker.controller?.state,
    swRegistrations,
    readyRegistration: readyRegistrationInfo,
    existingSubscription: existingSubscriptionInfo
  };

  addForensicLog({
    category: 'BROWSER',
    action: 'BROWSER_STATE_CAPTURED',
    result: browserState
  });

  return browserState;
}

// ─── ETAPA 13 — TESTE ISOLADO SEM SDK FIREBASE ───────────────────────────────
export async function runIsolatedPushTest() {
  const start = performance.now();
  addForensicLog({
    category: 'ISOLATED_TEST',
    action: 'START_ISOLATED_PUSH_TEST',
    params: { note: 'Tentando subscribe direto no PushManager sem Firebase SDK' }
  });

  try {
    const swReg = await navigator.serviceWorker.ready;
    const keyUint8 = urlBase64ToUint8Array(VAPID_KEY);

    const subscription = await swReg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyUint8 as BufferSource
    });

    const durationMs = performance.now() - start;
    const res = {
      success: true,
      endpoint: subscription.endpoint,
      keys: subscription.toJSON().keys
    };

    addForensicLog({
      category: 'ISOLATED_TEST',
      action: 'ISOLATED_PUSH_TEST_SUCCESS',
      durationMs,
      result: res
    });
    return res;
  } catch (err: any) {
    const durationMs = performance.now() - start;
    const res = {
      success: false,
      errorName: err.name,
      errorMessage: err.message,
      stack: err.stack
    };

    addForensicLog({
      category: 'ISOLATED_TEST',
      action: 'ISOLATED_PUSH_TEST_ERROR',
      durationMs,
      error: { name: err.name, message: err.message, stack: err.stack, code: err.code }
    });
    return res;
  }
}

// ─── FLUXO PRINCIPAL — REQUEST FOR TOKEN INSTRUMENTADO ────────────────────────
export const requestForToken = async (forceRefresh = false): Promise<string | null> => {
  const startRequest = performance.now();

  addForensicLog({
    category: 'FIREBASE',
    action: 'requestForToken_start',
    params: { forceRefresh }
  });

  // 1. Auditoria VAPID e Estado do Navegador
  await auditVAPIDKey(VAPID_KEY);
  await captureBrowserState();

  if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
    const err = new Error("Permissão de notificação não concedida.");
    addForensicLog({
      category: 'FIREBASE',
      action: 'requestForToken_aborted_permission',
      error: { name: err.name, message: err.message }
    });
    throw err;
  }

  if (!('serviceWorker' in navigator)) {
    const err = new Error("Push não suportado neste navegador.");
    addForensicLog({
      category: 'FIREBASE',
      action: 'requestForToken_aborted_no_sw',
      error: { name: err.name, message: err.message }
    });
    throw err;
  }

  // 2. Service Worker Registration
  let swReg: ServiceWorkerRegistration;
  try {
    if (navigator.serviceWorker.controller) {
      swReg = await navigator.serviceWorker.ready;
    } else {
      swReg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;
    }
  } catch (err: any) {
    addForensicLog({
      category: 'BROWSER',
      action: 'sw_registration_failed',
      error: { name: err.name, message: err.message, stack: err.stack }
    });
    throw new Error(`Falha no Service Worker: ${err.message || String(err)}`);
  }

  // 3. Inspeção e Limpeza da Subscrição Anterior (Etapa 6)
  try {
    const existingSub = await swReg.pushManager.getSubscription();
    if (existingSub) {
      addForensicLog({
        category: 'PUSH_MANAGER',
        action: 'cleaning_existing_subscription',
        params: { endpoint: existingSub.endpoint }
      });
      await existingSub.unsubscribe();
      addForensicLog({
        category: 'PUSH_MANAGER',
        action: 'cleaning_existing_subscription_success'
      });
    }
  } catch (e: any) {
    addForensicLog({
      category: 'PUSH_MANAGER',
      action: 'cleaning_existing_subscription_error',
      error: { name: e.name, message: e.message, stack: e.stack }
    });
  }

  // 4. Executar SDK Firebase getToken (com auto-recovery para push service error)
  const msg = await getMsg();
  if (!msg) {
    throw new Error("Firebase Messaging não é suportado neste navegador.");
  }

  // Helper interno para tentar getToken
  const tryGetToken = async (registration: ServiceWorkerRegistration): Promise<string> => {
    const startGetToken = performance.now();
    addForensicLog({
      category: 'FIREBASE',
      action: 'getToken_sdk_start',
      params: { vapidKeyLength: VAPID_KEY.length, swScope: registration.scope }
    });
    const token = await getToken(msg!, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration
    });
    const durationGetToken = performance.now() - startGetToken;
    if (token && token.length > 10) {
      addForensicLog({
        category: 'FIREBASE',
        action: 'getToken_sdk_success',
        durationMs: durationGetToken,
        result: { tokenLength: token.length, sample: token.substring(0, 30) }
      });
      return token;
    }
    throw new Error('Token retornado pelo SDK do Firebase veio vazio.');
  };

  try {
    const token = await tryGetToken(swReg);
    return token;
  } catch (fcmErr: any) {
    const detail = fcmErr?.message || fcmErr?.code || String(fcmErr);
    const isPushServiceError = detail.includes('push service error') ||
      detail.includes('AbortError') ||
      detail.includes('Registration failed');

    addForensicLog({
      category: 'FIREBASE',
      action: 'getToken_sdk_error_attempt1',
      error: { name: fcmErr?.name || 'FCMError', message: detail, stack: fcmErr?.stack, code: fcmErr?.code }
    });

    // ── AUTO-RECOVERY: Push Service Error → reset completo dos SWs e retry ──
    if (isPushServiceError) {
      addForensicLog({
        category: 'FIREBASE',
        action: 'push_service_error_auto_recovery_start',
        params: { detail }
      });

      try {
        // 1. Desregistrar TODOS os Service Workers
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister()));
        addForensicLog({ category: 'BROWSER', action: 'all_sw_unregistered', params: { count: regs.length } });

        // 2. Aguardar 1.5s para o navegador liberar o estado
        await new Promise(res => setTimeout(res, 1500));

        // 3. Re-registrar o Service Worker limpo
        const freshReg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        await navigator.serviceWorker.ready;
        addForensicLog({ category: 'BROWSER', action: 'sw_re_registered_fresh', params: { scope: freshReg.scope } });

        // 4. Limpar instância de messaging para forçar reinicialização
        _messaging = null;
        const freshMsg = await getMsg();
        if (!freshMsg) throw new Error('Firebase Messaging não disponível após reset.');

        // 5. Retry do getToken com SW limpo
        const retryToken = await tryGetToken(freshReg);
        addForensicLog({ category: 'FIREBASE', action: 'push_service_error_auto_recovery_success' });
        return retryToken;

      } catch (retryErr: any) {
        addForensicLog({
          category: 'FIREBASE',
          action: 'push_service_error_auto_recovery_failed',
          error: { name: retryErr?.name, message: retryErr?.message, stack: retryErr?.stack }
        });
        // Mensagem amigável para o usuário final
        throw new Error(
          'Seu navegador não conseguiu conectar ao serviço de Push do Google. ' +
          'Tente: 1) Conectar ao WiFi; 2) Limpar dados do app Chrome (Configurações > Apps > Chrome > Armazenamento > Limpar dados); 3) Reiniciar o celular.'
        );
      }
    }

    throw new Error(`Falha no SDK Firebase: ${detail}`);
  }
};

export const onMessageListener = async () => {
  const msg = await getMsg();
  if (!msg) return new Promise(r => r(null));
  return new Promise(resolve => {
    onMessage(msg, payload => {
      addForensicLog({
        category: 'FIREBASE',
        action: 'onMessage_foreground_received',
        result: payload
      });
      resolve(payload);
    });
  });
};

// ─── ETAPA 15 — GERADOR DE RELATÓRIO E SUITE AUDIT COMPLETA ────────────────
if (typeof window !== 'undefined') {
  window.runPushForensicAudit = async () => {
    console.log("=== INICIANDO AUDITORIA FORENSE NÍVEL 3 — WEB PUSH ===");
    const results: any = {};
    results.browserState = await captureBrowserState();
    results.vapidAudit = await auditVAPIDKey(VAPID_KEY);
    results.isolatedTest = await runIsolatedPushTest();
    try {
      results.firebaseTokenResult = await requestForToken(true);
    } catch (e: any) {
      results.firebaseTokenError = {
        name: e.name,
        message: e.message,
        stack: e.stack
      };
    }
    results.allLogs = window.__PUSH_FORENSIC_LOGS__;
    console.log("=== RESULTADOS FINAIS DA AUDITORIA FORENSE ===", results);
    return results;
  };
}


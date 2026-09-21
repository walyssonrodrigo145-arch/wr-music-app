// ─── Wake Lock do estudo (Screen Wake Lock API) ──────────────────────────────
// Responsabilidade ÚNICA: tentar manter a TELA LIGADA durante uma sessão ativa.
// NUNCA é fonte da verdade do tempo — o cronômetro usa timestamps reais.
// Funciona normalmente quando a API não existe ou o sistema libera o lock
// (troca de app, bloqueio, economia de energia): apenas perde-se a tela acesa.

export type WakeLockStatus = "unsupported" | "released" | "acquired" | "error";

export interface WakeLockState {
  supported: boolean;
  status: WakeLockStatus;
}

const DEBUG_KEY = "mp_study_debug";

function debugEnabled(): boolean {
  try {
    if (typeof import.meta !== "undefined" && (import.meta as any).env?.DEV) return true;
    return typeof localStorage !== "undefined" && localStorage.getItem(DEBUG_KEY) === "1";
  } catch {
    return false;
  }
}

function log(...args: unknown[]) {
  if (debugEnabled()) console.info(...args);
}

function warn(...args: unknown[]) {
  if (debugEnabled()) console.warn(...args);
}

function isSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    "wakeLock" in navigator &&
    typeof (navigator as Navigator & { wakeLock?: WakeLock }).wakeLock?.request === "function"
  );
}

let sentinel: WakeLockSentinel | null = null;
let pendingRequest: Promise<boolean> | null = null;
let state: WakeLockState = {
  supported: isSupported(),
  status: isSupported() ? "released" : "unsupported",
};

const listeners = new Set<() => void>();

function emit(next: Partial<WakeLockState>) {
  state = { ...state, ...next };
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* listener não pode derrubar o cronômetro */
    }
  });
}

export function subscribeWakeLock(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getWakeLockState(): WakeLockState {
  return state;
}

export function isWakeLockSupported(): boolean {
  return state.supported;
}

/** Tenta adquirir o Wake Lock. Nunca lança — retorna false em qualquer falha. */
export async function requestWakeLock(): Promise<boolean> {
  if (!isSupported()) {
    emit({ supported: false, status: "unsupported" });
    return false;
  }

  if (sentinel && state.status === "acquired") return true;
  if (pendingRequest) return pendingRequest;

  pendingRequest = (async () => {
    log("[WAKE_LOCK] REQUEST");
    try {
      const lock = await navigator.wakeLock.request("screen");
      sentinel = lock;
      emit({ supported: true, status: "acquired" });
      log("[WAKE_LOCK] ACQUIRED");
      lock.addEventListener("release", () => {
        sentinel = null;
        emit({ status: "released" });
        log("[WAKE_LOCK] RELEASED");
      });
      return true;
    } catch (error) {
      sentinel = null;
      emit({ supported: true, status: "error" });
      warn("[WAKE_LOCK] FAILED", error);
      return false;
    } finally {
      pendingRequest = null;
    }
  })();

  return pendingRequest;
}

/** Libera o Wake Lock (pausa, finalização, cancelamento, saída). Nunca lança. */
export async function releaseWakeLock(): Promise<void> {
  if (!sentinel) {
    if (state.supported && state.status === "acquired") emit({ status: "released" });
    return;
  }
  const lock = sentinel;
  sentinel = null;
  try {
    await lock.release();
  } catch (error) {
    warn("[WAKE_LOCK] FAILED ao liberar", error);
  } finally {
    emit({ status: "released" });
    log("[WAKE_LOCK] RELEASED");
  }
}

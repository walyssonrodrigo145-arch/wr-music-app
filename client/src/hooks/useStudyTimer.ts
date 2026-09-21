// ─── useStudyTimer — cronômetro de estudos do Plano Diário ───────────────────
// Arquitetura (regra de ouro):
//   WAKE LOCK   → mantém a tela ligada (nunca mede tempo)
//   TIMESTAMP   → mede o tempo real (Date.now), nunca contador incremental
//   VISIBILITY  → detecta saída/retorno; NÃO pausa ao esconder (§19)
//   PERSISTÊNCIA→ protege a sessão (localStorage por plano+dia + ponteiro global)
//
// O setInterval é usado SOMENTE para atualizar a interface (tick visual) e para
// snapshots periódicos de segurança — jamais como fonte da verdade do tempo.

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  MAX_SESSION_DURATION_MS,
  StudySession,
  StudySessionEvent,
  createStudySession,
  finishStudySession,
  getElapsedMs,
  getElapsedSeconds,
  isSessionFor,
  pauseStudySession,
  resumeStudySession,
  sanitizeStoredSession,
  snapshotStudySession,
} from "@shared/studySession";
import {
  getWakeLockState,
  releaseWakeLock,
  requestWakeLock,
  subscribeWakeLock,
  type WakeLockState,
} from "@/lib/wakeLock";

export interface StudySessionEventPayload {
  sessionId: string;
  planId: number;
  dayIndex: number;
  event: StudySessionEvent;
  sessionStartedAt: number;
  periodStartedAt: number | null;
  accumulatedTimeMs: number;
  occurredAt: number;
}

export interface FinishedStudySession {
  /** Tempo final em segundos (derivado de timestamps). */
  seconds: number;
  session: StudySession;
}

interface UseStudyTimerOptions {
  planId: number | null;
  dayIndex: number;
  studentId?: number;
  /** false quando o dia já foi concluído ou o plano está inativo. */
  enabled: boolean;
  onEvent?: (payload: StudySessionEventPayload) => void;
}

const STORAGE_PREFIX = "mp_study_session_v1";
const LEGACY_PREFIX = "mp_training_";
const ACTIVE_POINTER_KEY = "musicpro_active_timer";
const SNAPSHOT_INTERVAL_MS = 5000;
const DEBUG_KEY = "mp_study_debug";
// Só abre o modal de recuperação quando houve um afastamento real (app fechado/
// em segundo plano). Navegação interna e reload imediato retomam silenciosamente.
const RECOVERY_PROMPT_AFTER_MS = 30_000;

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

function sessionKey(planId: number, dayIndex: number): string {
  return `${STORAGE_PREFIX}_${planId}_${dayIndex}`;
}

function legacyKey(planId: number, dayIndex: number): string {
  return `${LEGACY_PREFIX}${planId}_${dayIndex}`;
}

function readSession(planId: number, dayIndex: number): StudySession | null {
  try {
    const raw = localStorage.getItem(sessionKey(planId, dayIndex));
    return raw ? sanitizeStoredSession(raw) : null;
  } catch {
    return null;
  }
}

/** Compatibilidade: converte o formato antigo (`mp_training_*` = segundos). */
function migrateLegacySession(planId: number, dayIndex: number): StudySession | null {
  try {
    const raw = localStorage.getItem(legacyKey(planId, dayIndex));
    if (!raw) return null;
    const seconds = Math.max(0, parseInt(raw, 10) || 0);
    localStorage.removeItem(legacyKey(planId, dayIndex));
    if (seconds <= 0) return null;
    const now = Date.now();
    const session: StudySession = {
      id: `legacy_${planId}_${dayIndex}_${now.toString(36)}`,
      planId,
      dayIndex,
      status: "PAUSED",
      startedAt: null,
      pausedAt: now,
      finishedAt: null,
      accumulatedTime: seconds * 1000,
      createdAt: now - seconds * 1000,
      updatedAt: now,
    };
    writeSession(session);
    log("[TIMER] SESSION_RECOVERED (formato anterior)", seconds, "s");
    return session;
  } catch {
    return null;
  }
}

function writeSession(session: StudySession): void {
  try {
    localStorage.setItem(sessionKey(session.planId, session.dayIndex), JSON.stringify(session));
    log("[TIMER] SESSION_SAVED", getElapsedSeconds(session), "s");
  } catch {
    /* storage indisponível (modo privado/quota) — o cronômetro segue em memória */
  }
}

function removeSession(planId: number, dayIndex: number): void {
  try {
    localStorage.removeItem(sessionKey(planId, dayIndex));
  } catch {
    /* storage indisponível */
  }
}

function readPointer(): StudySession | null {
  try {
    const raw = localStorage.getItem(ACTIVE_POINTER_KEY);
    return raw ? sanitizeStoredSession(raw) : null;
  } catch {
    return null;
  }
}

function writePointer(session: StudySession): void {
  try {
    const hasContent = session.status === "ACTIVE" || getElapsedMs(session) > 0;
    if (!hasContent) {
      localStorage.removeItem(ACTIVE_POINTER_KEY);
      return;
    }
    localStorage.setItem(ACTIVE_POINTER_KEY, JSON.stringify(session));
  } catch {
    /* storage indisponível */
  }
}

function clearPointerIf(sessionId: string): void {
  try {
    const pointer = readPointer();
    if (!pointer || pointer.id === sessionId) localStorage.removeItem(ACTIVE_POINTER_KEY);
  } catch {
    /* storage indisponível */
  }
}

export function useStudyTimer({ planId, dayIndex, studentId, enabled, onEvent }: UseStudyTimerOptions) {
  const [session, setSession] = useState<StudySession | null>(null);
  const [recovery, setRecovery] = useState<StudySession | null>(null);
  const [, setTick] = useState(0);

  const wakeLockState: WakeLockState = useSyncExternalStore(
    subscribeWakeLock,
    getWakeLockState,
    getWakeLockState
  );

  const sessionRef = useRef<StudySession | null>(null);
  sessionRef.current = session;
  const recoveryRef = useRef<StudySession | null>(null);
  recoveryRef.current = recovery;
  const planIdRef = useRef(planId);
  planIdRef.current = planId;
  const dayRef = useRef(dayIndex);
  dayRef.current = dayIndex;
  const studentIdRef = useRef(studentId);
  studentIdRef.current = studentId;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const loadedKeyRef = useRef<string | null>(null);
  const bootCheckedRef = useRef(false);

  const applySession = useCallback((next: StudySession | null) => {
    sessionRef.current = next;
    setSession(next);
    setTick((t) => t + 1);
  }, []);

  const emitEvent = useCallback(
    (target: StudySession, event: StudySessionEvent, now: number) => {
      const payload: StudySessionEventPayload = {
        sessionId: target.id,
        planId: target.planId,
        dayIndex: target.dayIndex,
        event,
        sessionStartedAt: target.createdAt,
        periodStartedAt: target.status === "ACTIVE" ? target.startedAt : null,
        // Clamp defensivo: o backend rejeita acima de 24h (zod) — evita perder o
        // evento por validação quando o app ficou aberto por muito tempo.
        accumulatedTimeMs: Math.min(getElapsedMs(target, now), MAX_SESSION_DURATION_MS),
        occurredAt: now,
      };
      try {
        onEventRef.current?.(payload);
      } catch (error) {
        console.warn("[TIMER] Falha ao enviar evento ao backend:", error);
      }
    },
    []
  );

  // Pausa (sem finalizar) qualquer sessão ATIVA de outro dia/plano — §23:
  // nunca manter duas sessões ativas simultâneas para o mesmo aluno.
  const pauseOtherActiveSessions = useCallback((currentId?: string) => {
    const pointer = readPointer();
    if (!pointer || pointer.status !== "ACTIVE" || pointer.id === currentId) return;
    if (planIdRef.current != null && pointer.planId !== planIdRef.current) return;
    const other = readSession(pointer.planId, pointer.dayIndex) ?? pointer;
    if (other.status !== "ACTIVE" || other.id === currentId) return;
    const now = Date.now();
    const paused = pauseStudySession(other, now);
    writeSession(paused);
    writePointer(paused);
    log("[TIMER] PAUSE (sessão anterior em outro dia)", paused.dayIndex);
    emitEvent(paused, "PAUSE", now);
  }, [emitEvent]);

  // Carrega a sessão do plano/dia atual; persiste o snapshot do dia anterior na troca.
  useEffect(() => {
    if (planId == null) {
      loadedKeyRef.current = null;
      applySession(null);
      return;
    }
    const key = sessionKey(planId, dayIndex);
    if (loadedKeyRef.current === key) return;

    const previous = sessionRef.current;
    const previousKey = loadedKeyRef.current;
    if (previous && previousKey && previousKey !== key && previous.status === "ACTIVE") {
      const snap = snapshotStudySession(previous);
      writeSession(snap);
      writePointer(snap);
    }
    loadedKeyRef.current = key;

    const restored = readSession(planId, dayIndex) ?? migrateLegacySession(planId, dayIndex);
    if (restored && (restored.status === "FINISHED" || restored.status === "CANCELLED")) {
      removeSession(planId, dayIndex);
      applySession(null);
      return;
    }
    applySession(restored);
  }, [planId, dayIndex, applySession]);

  // Boot: recupera sessão ACTIVE persistida (§16/§17) — o modal decide continuar/encerrar.
  useEffect(() => {
    if (planId == null || bootCheckedRef.current) return;
    bootCheckedRef.current = true;
    const pointer = readPointer();
    if (!pointer || pointer.status !== "ACTIVE" || pointer.planId !== planId) return;
    log("[TIMER] SESSION_RECOVERED", pointer.id);
    const awayMs = Date.now() - (pointer.updatedAt || pointer.startedAt || pointer.createdAt);
    if (awayMs >= RECOVERY_PROMPT_AFTER_MS) {
      setRecovery(pointer);
    }
  }, [planId]);

  // Tick visual (1s) — apenas re-render; o tempo é sempre recalculado por timestamp.
  useEffect(() => {
    if (session?.status !== "ACTIVE") return;
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [session?.status]);

  // Garante o Wake Lock sempre que há sessão ativa e a página está visível
  // (cobre remontagem do componente/retorno à página sem ação do usuário).
  useEffect(() => {
    if (session?.status === "ACTIVE" && document.visibilityState === "visible") {
      void requestWakeLock();
    }
  }, [session?.status, session?.startedAt]);

  // Snapshots periódicos de segurança (crash/fechamento forçado). Não é a cada segundo.
  useEffect(() => {
    if (session?.status !== "ACTIVE") return;
    const interval = setInterval(() => {
      const current = sessionRef.current;
      if (current?.status !== "ACTIVE") return;
      const snap = snapshotStudySession(current);
      writeSession(snap);
      writePointer(snap);
    }, SNAPSHOT_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [session?.status]);

  // VISIBILITY API — ao esconder NÃO pausa (§19); ao voltar recalcula e readquire o Wake Lock.
  useEffect(() => {
    const onVisibilityChange = () => {
      const current = sessionRef.current;
      if (document.visibilityState === "hidden") {
        log("[VISIBILITY] HIDDEN");
        if (current?.status === "ACTIVE") {
          const snap = snapshotStudySession(current);
          writeSession(snap);
          writePointer(snap);
        }
        return;
      }
      log("[VISIBILITY] VISIBLE");
      if (current?.status === "ACTIVE") {
        setTick((t) => t + 1);
        void requestWakeLock();
      }
    };
    const onPageHide = () => {
      const current = sessionRef.current;
      if (current?.status === "ACTIVE") {
        const snap = snapshotStudySession(current);
        writeSession(snap);
        writePointer(snap);
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, []);

  // Ao sair da página (unmount) com sessão ativa: persiste e libera o Wake Lock.
  // O tempo NÃO é perdido (timestamps) e a sessão é recuperável ao voltar.
  useEffect(() => {
    return () => {
      const current = sessionRef.current;
      if (current?.status === "ACTIVE") {
        const snap = snapshotStudySession(current);
        writeSession(snap);
        writePointer(snap);
      }
      void releaseWakeLock();
    };
  }, []);

  // Recalculado a cada render; o tick de 1s (acima) garante a atualização visual.
  const elapsedSeconds = session ? getElapsedSeconds(session) : 0;

  const start = useCallback(() => {
    const currentPlanId = planIdRef.current;
    if (currentPlanId == null || !enabledRef.current) return;
    const current = sessionRef.current;
    if (current?.status === "ACTIVE") return;
    if (current?.status === "PAUSED") {
      // Continua de onde parou (sessão restaurada) em vez de criar outra.
      const now = Date.now();
      pauseOtherActiveSessions(current.id);
      const resumed = resumeStudySession(current, now);
      applySession(resumed);
      writeSession(resumed);
      writePointer(resumed);
      if (document.visibilityState === "visible") void requestWakeLock();
      log("[TIMER] RESUME");
      emitEvent(resumed, "RESUME", now);
      return;
    }

    pauseOtherActiveSessions();
    const created = createStudySession({
      planId: currentPlanId,
      dayIndex: dayRef.current,
      studentId: studentIdRef.current,
    });
    applySession(created);
    writeSession(created);
    writePointer(created);
    if (document.visibilityState === "visible") void requestWakeLock();
    log("[TIMER] START");
    emitEvent(created, "START", created.createdAt);
  }, [applySession, emitEvent, pauseOtherActiveSessions]);

  const pause = useCallback(() => {
    const current = sessionRef.current;
    if (current?.status !== "ACTIVE") return;
    const now = Date.now();
    const paused = pauseStudySession(current, now);
    applySession(paused);
    writeSession(paused);
    writePointer(paused);
    void releaseWakeLock();
    log("[TIMER] PAUSE");
    emitEvent(paused, "PAUSE", now);
  }, [applySession, emitEvent]);

  const resume = useCallback(() => {
    const current = sessionRef.current;
    if (current?.status !== "PAUSED" || !enabledRef.current) return;
    const now = Date.now();
    pauseOtherActiveSessions(current.id);
    const resumed = resumeStudySession(current, now);
    applySession(resumed);
    writeSession(resumed);
    writePointer(resumed);
    if (document.visibilityState === "visible") void requestWakeLock();
    log("[TIMER] RESUME");
    emitEvent(resumed, "RESUME", now);
  }, [applySession, emitEvent, pauseOtherActiveSessions]);

  /**
   * Finaliza a sessão (ativa ou pausada). O tempo fica "estacionado" como PAUSED
   * no storage até o backend confirmar o progresso (`clear`) — assim um erro de
   * rede não apaga o treino do aluno.
   */
  const finalize = useCallback(
    (target: StudySession): FinishedStudySession => {
      const now = Date.now();
      const finished = finishStudySession(target, now);
      const seconds = getElapsedSeconds(finished, now);
      const parked: StudySession = {
        ...finished,
        status: "PAUSED",
        finishedAt: null,
        pausedAt: now,
      };
      writeSession(parked);
      clearPointerIf(finished.id);
      if (isSessionFor(target, planIdRef.current ?? -1, dayRef.current)) applySession(parked);
      void releaseWakeLock();
      log("[TIMER] FINISH", seconds, "s");
      emitEvent(finished, "FINISH", now);
      return { seconds, session: finished };
    },
    [applySession, emitEvent]
  );

  const finish = useCallback((): FinishedStudySession | null => {
    const current = sessionRef.current;
    if (!current || (current.status !== "ACTIVE" && current.status !== "PAUSED")) return null;
    if (getElapsedSeconds(current) <= 0) return null;
    return finalize(current);
  }, [finalize]);

  /** CONTINUAR do modal de recuperação: mantém a sessão ativa (tempo real segue). */
  const acceptRecovery = useCallback(() => {
    const current = recoveryRef.current;
    if (!current) return;
    writePointer(current);
    if (isSessionFor(current, planIdRef.current ?? -1, dayRef.current)) applySession(current);
    setRecovery(null);
    if (current.status === "ACTIVE" && document.visibilityState === "visible") {
      void requestWakeLock();
    }
  }, [applySession]);

  /** ENCERRAR SESSÃO do modal: finaliza e devolve o tempo para registro. */
  const finishRecovery = useCallback((): FinishedStudySession | null => {
    const current = recoveryRef.current;
    if (!current) return null;
    const result = finalize(current);
    setRecovery(null);
    return result;
  }, [finalize]);

  /** Remove a sessão persistida (após o backend confirmar o dia concluído). */
  const clear = useCallback((targetDay?: number) => {
    const current = sessionRef.current;
    const plan = planIdRef.current;
    if (plan != null) {
      const day = targetDay ?? current?.dayIndex ?? dayRef.current;
      removeSession(plan, day);
      if (!current || current.dayIndex === day) applySession(null);
    }
    if (current) clearPointerIf(current.id);
  }, [applySession]);

  const status = session?.status ?? "NOT_STARTED";

  return {
    status,
    isActive: status === "ACTIVE",
    isPaused: status === "PAUSED",
    elapsedSeconds,
    hasTime: elapsedSeconds > 0,
    wakeLockState,
    recovery,
    start,
    pause,
    resume,
    finish,
    acceptRecovery,
    finishRecovery,
    clear,
  };
}

export type StudyTimer = ReturnType<typeof useStudyTimer>;

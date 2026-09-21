// Núcleo do cronômetro de estudos do MusicPro — funções PURAS e isomórficas
// (client + server + testes). Regra de ouro:
//   - o TEMPO é medido por timestamps reais (Date.now), nunca por contador incremental;
//   - Wake Lock e setInterval NÃO são fonte da verdade do tempo.
//
// Estados: NOT_STARTED → ACTIVE ⇄ PAUSED → FINISHED | CANCELLED
// O `accumulatedTime` guarda o total de períodos JÁ encerrados (pausas/finalização)
// em MILISSEGUNDOS. Enquanto ACTIVE, o período corrente é calculado por
// `getElapsedMs()` usando `startedAt`.

export type StudySessionStatus =
  | "NOT_STARTED"
  | "ACTIVE"
  | "PAUSED"
  | "FINISHED"
  | "CANCELLED";

export type StudySessionEvent = "START" | "PAUSE" | "RESUME" | "FINISH" | "CANCEL";

export interface StudySession {
  id: string;
  planId: number;
  dayIndex: number;
  studentId?: number;
  status: StudySessionStatus;
  /** Timestamp (epoch ms) do início do período ATIVO corrente. null fora de ACTIVE. */
  startedAt: number | null;
  /** Timestamp (epoch ms) da última pausa. null quando não pausado. */
  pausedAt: number | null;
  /** Timestamp (epoch ms) da finalização/cancelamento. */
  finishedAt: number | null;
  /** Soma dos períodos já encerrados, em ms. */
  accumulatedTime: number;
  /** Início real da sessão (primeiro START) — usado na validação de plausibilidade. */
  createdAt: number;
  updatedAt: number;
}

export interface SessionDurationValidation {
  valid: boolean;
  reason?: string;
}

/** Tolerância (ms) entre o tempo informado e o período real transcorrido. */
export const SESSION_DURATION_TOLERANCE_MS = 2 * 60 * 1000;

/** Limite defensivo de duração de uma única sessão (24h em ms). */
export const MAX_SESSION_DURATION_MS = 24 * 60 * 60 * 1000;

export function generateSessionId(now = Date.now()): string {
  try {
    const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
    if (c?.randomUUID) return c.randomUUID();
  } catch {
    /* ambiente sem crypto.randomUUID */
  }
  return `sess_${now.toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

export function createStudySession(params: {
  planId: number;
  dayIndex: number;
  studentId?: number;
  now?: number;
  id?: string;
}): StudySession {
  const now = params.now ?? Date.now();
  return {
    id: params.id ?? generateSessionId(now),
    planId: params.planId,
    dayIndex: params.dayIndex,
    studentId: params.studentId,
    status: "ACTIVE",
    startedAt: now,
    pausedAt: null,
    finishedAt: null,
    accumulatedTime: 0,
    createdAt: now,
    updatedAt: now,
  };
}

/** Tempo total decorrido (ms) — SEMPRE derivado de timestamps. */
export function getElapsedMs(session: StudySession, now = Date.now()): number {
  const base = Math.max(0, Number(session.accumulatedTime) || 0);
  if (session.status === "ACTIVE" && typeof session.startedAt === "number") {
    return base + Math.max(0, now - session.startedAt);
  }
  return base;
}

export function getElapsedSeconds(session: StudySession, now = Date.now()): number {
  return Math.floor(getElapsedMs(session, now) / 1000);
}

/**
 * "Rebase" seguro para persistência periódica: congela o tempo corrente em
 * `accumulatedTime` e reinicia `startedAt` em `now`, SEM alterar o total.
 * Permite recuperar de crash/fechamento perdendo no máximo o intervalo desde o
 * último snapshot (nunca o período inteiro).
 */
export function snapshotStudySession(session: StudySession, now = Date.now()): StudySession {
  if (session.status !== "ACTIVE") return { ...session, updatedAt: now };
  return {
    ...session,
    accumulatedTime: getElapsedMs(session, now),
    startedAt: now,
    updatedAt: now,
  };
}

export function pauseStudySession(session: StudySession, now = Date.now()): StudySession {
  if (session.status !== "ACTIVE") return session;
  return {
    ...session,
    accumulatedTime: getElapsedMs(session, now),
    startedAt: null,
    pausedAt: now,
    status: "PAUSED",
    updatedAt: now,
  };
}

export function resumeStudySession(session: StudySession, now = Date.now()): StudySession {
  if (session.status !== "PAUSED") return session;
  return {
    ...session,
    startedAt: now,
    pausedAt: null,
    status: "ACTIVE",
    updatedAt: now,
  };
}

export function finishStudySession(session: StudySession, now = Date.now()): StudySession {
  if (session.status === "FINISHED" || session.status === "CANCELLED") return session;
  return {
    ...session,
    accumulatedTime: getElapsedMs(session, now),
    startedAt: null,
    pausedAt: null,
    finishedAt: now,
    status: "FINISHED",
    updatedAt: now,
  };
}

export function cancelStudySession(session: StudySession, now = Date.now()): StudySession {
  if (session.status === "FINISHED" || session.status === "CANCELLED") return session;
  return {
    ...session,
    accumulatedTime: getElapsedMs(session, now),
    startedAt: null,
    pausedAt: null,
    finishedAt: now,
    status: "CANCELLED",
    updatedAt: now,
  };
}

/**
 * Validação de plausibilidade (§22): o tempo acumulado informado não pode ser
 * maior que o período real entre o início da sessão e o evento, com tolerância.
 * Ex.: início 14:00, fim 14:30, informado 29:48 → válido; 4h35 → inválido.
 */
export function validateSessionDuration(params: {
  sessionStartedAt: number;
  finishedAt: number;
  accumulatedTime: number;
  toleranceMs?: number;
}): SessionDurationValidation {
  const { sessionStartedAt, finishedAt, accumulatedTime } = params;
  const tolerance = params.toleranceMs ?? SESSION_DURATION_TOLERANCE_MS;

  if (!Number.isFinite(sessionStartedAt) || !Number.isFinite(finishedAt)) {
    return { valid: false, reason: "timestamps inválidos" };
  }
  if (finishedAt < sessionStartedAt) {
    return { valid: false, reason: "horário final anterior ao início da sessão" };
  }
  if (!Number.isFinite(accumulatedTime) || accumulatedTime < 0) {
    return { valid: false, reason: "tempo acumulado inválido" };
  }
  if (accumulatedTime > MAX_SESSION_DURATION_MS) {
    return { valid: false, reason: "tempo acumulado acima do limite de 24h" };
  }
  const realElapsed = finishedAt - sessionStartedAt;
  if (accumulatedTime > realElapsed + tolerance) {
    return {
      valid: false,
      reason: "tempo acumulado maior que o período real transcorrido",
    };
  }
  return { valid: true };
}

const VALID_STATUSES: StudySessionStatus[] = [
  "NOT_STARTED",
  "ACTIVE",
  "PAUSED",
  "FINISHED",
  "CANCELLED",
];

function toFiniteNumber(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

/** Normaliza/valida uma sessão lida do storage (JSON corrompido → null). */
export function sanitizeStoredSession(raw: unknown): StudySession | null {
  let obj: unknown = raw;
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!obj || typeof obj !== "object") return null;
  const candidate = obj as Record<string, unknown>;

  const id = typeof candidate.id === "string" && candidate.id.length >= 8 ? candidate.id : null;
  const planId = toFiniteNumber(candidate.planId);
  const dayIndex = toFiniteNumber(candidate.dayIndex);
  const status = candidate.status as StudySessionStatus;
  const accumulatedTime = toFiniteNumber(candidate.accumulatedTime);
  const createdAt = toFiniteNumber(candidate.createdAt);
  const updatedAt = toFiniteNumber(candidate.updatedAt);

  if (!id) return null;
  if (planId === null || !Number.isInteger(planId) || planId <= 0) return null;
  if (dayIndex === null || !Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex > 14) return null;
  if (!VALID_STATUSES.includes(status)) return null;
  if (accumulatedTime === null || accumulatedTime < 0) return null;
  if (createdAt === null || updatedAt === null) return null;

  const startedAt = toFiniteNumber(candidate.startedAt);
  const pausedAt = toFiniteNumber(candidate.pausedAt);
  const finishedAt = toFiniteNumber(candidate.finishedAt);
  const studentId = toFiniteNumber(candidate.studentId);

  return {
    id,
    planId,
    dayIndex,
    studentId: studentId ?? undefined,
    status,
    startedAt: status === "ACTIVE" ? startedAt ?? createdAt : startedAt,
    pausedAt: pausedAt ?? null,
    finishedAt: finishedAt ?? null,
    accumulatedTime,
    createdAt,
    updatedAt,
  };
}

export function isSessionFor(session: StudySession, planId: number, dayIndex: number): boolean {
  return session.planId === planId && session.dayIndex === dayIndex;
}

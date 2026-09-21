import { describe, expect, it } from "vitest";
import {
  MAX_SESSION_DURATION_MS,
  SESSION_DURATION_TOLERANCE_MS,
  cancelStudySession,
  createStudySession,
  finishStudySession,
  getElapsedMs,
  getElapsedSeconds,
  pauseStudySession,
  resumeStudySession,
  sanitizeStoredSession,
  snapshotStudySession,
  validateSessionDuration,
} from "@shared/studySession";

const T0 = 1_700_000_000_000; // referência fixa (epoch ms)

describe("Cronômetro de estudos — medição por timestamps", () => {
  it("Teste 1: iniciar → 10s → finalizar ≈ 10 segundos", () => {
    const session = createStudySession({ planId: 1, dayIndex: 0, now: T0 });
    expect(session.status).toBe("ACTIVE");
    expect(session.startedAt).toBe(T0);
    expect(session.accumulatedTime).toBe(0);

    const finished = finishStudySession(session, T0 + 10_000);
    expect(finished.status).toBe("FINISHED");
    expect(getElapsedSeconds(finished, T0 + 10_000)).toBe(10);
  });

  it("Teste 4: 10s ativos + 30s pausado + 10s ativos ≈ 20 segundos (e não 50)", () => {
    const session = createStudySession({ planId: 1, dayIndex: 2, now: T0 });

    // 10 segundos de estudo
    const paused = pauseStudySession(session, T0 + 10_000);
    expect(paused.status).toBe("PAUSED");
    expect(paused.startedAt).toBeNull();
    expect(getElapsedSeconds(paused, T0 + 10_000)).toBe(10);

    // 30 segundos pausado — o tempo NÃO pode avançar
    expect(getElapsedSeconds(paused, T0 + 40_000)).toBe(10);

    // retoma e estuda mais 10 segundos
    const resumed = resumeStudySession(paused, T0 + 40_000);
    expect(resumed.status).toBe("ACTIVE");
    expect(resumed.startedAt).toBe(T0 + 40_000);

    const finished = finishStudySession(resumed, T0 + 50_000);
    expect(getElapsedSeconds(finished, T0 + 50_000)).toBe(20);
  });

  it("não depende de setInterval: o tempo aparece mesmo sem nenhum tick", () => {
    const session = createStudySession({ planId: 7, dayIndex: 1, now: T0 });
    // Simula o sistema suspendendo o JavaScript por 5 minutos (nenhum tick executou)
    expect(getElapsedSeconds(session, T0 + 5 * 60_000)).toBe(300);
    expect(getElapsedMs(session, T0 + 5 * 60_000)).toBe(5 * 60_000);
  });

  it("snapshot periódico não altera o total (proteção contra crash)", () => {
    const session = createStudySession({ planId: 3, dayIndex: 0, now: T0 });
    const snap1 = snapshotStudySession(session, T0 + 5_000);
    expect(getElapsedMs(snap1, T0 + 5_000)).toBe(5_000);

    const snap2 = snapshotStudySession(snap1, T0 + 12_000);
    expect(getElapsedMs(snap2, T0 + 12_000)).toBe(12_000);

    const finished = finishStudySession(snap2, T0 + 20_000);
    expect(getElapsedSeconds(finished, T0 + 20_000)).toBe(20);
  });

  it("cancelar mantém o tempo decorrido e não permite transições posteriores", () => {
    const session = createStudySession({ planId: 1, dayIndex: 0, now: T0 });
    const cancelled = cancelStudySession(session, T0 + 8_000);
    expect(cancelled.status).toBe("CANCELLED");
    expect(getElapsedSeconds(cancelled, T0 + 8_000)).toBe(8);
    expect(finishStudySession(cancelled, T0 + 60_000).status).toBe("CANCELLED");
    expect(getElapsedSeconds(cancelled, T0 + 60_000)).toBe(8);
  });
});

describe("Validação de plausibilidade do tempo (§22)", () => {
  it("aceita 29:48 informados em um intervalo real de 30 minutos", () => {
    const result = validateSessionDuration({
      sessionStartedAt: T0,
      finishedAt: T0 + 30 * 60_000,
      accumulatedTime: (29 * 60 + 48) * 1000,
    });
    expect(result.valid).toBe(true);
  });

  it("rejeita 4h35 informados em um intervalo real de 30 minutos", () => {
    const result = validateSessionDuration({
      sessionStartedAt: T0,
      finishedAt: T0 + 30 * 60_000,
      accumulatedTime: (4 * 60 + 35) * 60 * 1000,
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("período real");
  });

  it("aceita tempo dentro da tolerância de 2 minutos", () => {
    const result = validateSessionDuration({
      sessionStartedAt: T0,
      finishedAt: T0 + 10 * 60_000,
      accumulatedTime: 10 * 60_000 + SESSION_DURATION_TOLERANCE_MS - 1000,
    });
    expect(result.valid).toBe(true);
  });

  it("rejeita horário final anterior ao início", () => {
    const result = validateSessionDuration({
      sessionStartedAt: T0,
      finishedAt: T0 - 1000,
      accumulatedTime: 0,
    });
    expect(result.valid).toBe(false);
  });

  it("rejeita tempo acumulado negativo ou acima de 24h", () => {
    expect(
      validateSessionDuration({ sessionStartedAt: T0, finishedAt: T0 + 60_000, accumulatedTime: -1 }).valid
    ).toBe(false);
    expect(
      validateSessionDuration({
        sessionStartedAt: T0,
        finishedAt: T0 + MAX_SESSION_DURATION_MS + 60_000,
        accumulatedTime: MAX_SESSION_DURATION_MS + 1,
      }).valid
    ).toBe(false);
  });
});

describe("Persistência local (sanitizeStoredSession)", () => {
  it("recupera uma sessão ACTIVE válida do JSON persistido", () => {
    const session = createStudySession({ planId: 9, dayIndex: 3, now: T0, id: "session-abc-123" });
    const restored = sanitizeStoredSession(JSON.stringify(session));
    expect(restored).not.toBeNull();
    expect(restored?.id).toBe("session-abc-123");
    expect(restored?.planId).toBe(9);
    expect(restored?.dayIndex).toBe(3);
    expect(restored?.status).toBe("ACTIVE");
    expect(restored?.startedAt).toBe(T0);
  });

  it("ignora JSON corrompido, campos inválidos e status desconhecido", () => {
    expect(sanitizeStoredSession("{não é json")).toBeNull();
    expect(sanitizeStoredSession(JSON.stringify({ id: "curto" }))).toBeNull();
    expect(
      sanitizeStoredSession(
        JSON.stringify({ id: "session-abc-123", planId: 1, dayIndex: 0, status: "DORMINDO", accumulatedTime: 0, createdAt: T0, updatedAt: T0 })
      )
    ).toBeNull();
    expect(
      sanitizeStoredSession(
        JSON.stringify({ id: "session-abc-123", planId: 1, dayIndex: 99, status: "ACTIVE", accumulatedTime: 0, createdAt: T0, updatedAt: T0 })
      )
    ).toBeNull();
  });

  it("normaliza accumulatedTime ausente/negativo para rejeição", () => {
    expect(
      sanitizeStoredSession(
        JSON.stringify({ id: "session-abc-123", planId: 1, dayIndex: 0, status: "PAUSED", accumulatedTime: -5, createdAt: T0, updatedAt: T0 })
      )
    ).toBeNull();
  });
});

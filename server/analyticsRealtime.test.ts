import { describe, it, expect } from "vitest";
import { buildRealtimeSeries } from "./services/AnalyticsRealtime";

/**
 * Regressão do gráfico de acessos em tempo real:
 * ordenação, janela, preenchimento de lacunas e cálculo do pico.
 */
describe("buildRealtimeSeries", () => {
  const now = new Date("2026-09-19T18:00:00.000Z");

  it("sem dados retorna série vazia e pico nulo", () => {
    const r = buildRealtimeSeries([], { windowMs: 30 * 60_000, now });
    expect(r.points).toEqual([]);
    expect(r.peak).toBeNull();
  });

  it("ordena, limita à janela e calcula o pico", () => {
    const rows = [
      { capturedAt: "2026-09-19T17:59:30.000Z", onlineCount: 4, pageViews: 3, sessionsStarted: 1, eventsCount: 10 },
      { capturedAt: "2026-09-19T17:55:00.000Z", onlineCount: 2, pageViews: 1, sessionsStarted: 0, eventsCount: 4 },
      { capturedAt: "2026-09-19T17:59:00.000Z", onlineCount: 9, pageViews: 7, sessionsStarted: 2, eventsCount: 20 },
      { capturedAt: "2026-09-19T10:00:00.000Z", onlineCount: 99, pageViews: 99, sessionsStarted: 9, eventsCount: 99 },
    ];
    const r = buildRealtimeSeries(rows, { windowMs: 5 * 60_000, now });

    expect(r.points.length).toBeGreaterThan(0);
    // fora da janela não entra
    expect(r.points.some((p) => p.pageViews === 99)).toBe(false);
    // pico = maior pageViews da janela
    expect(r.peak?.pageViews).toBe(7);
    expect(r.peak?.online).toBe(9);
    // ordenação ascendente
    const times = r.points.map((p) => new Date(p.ts).getTime());
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it("preenche lacunas com zero e mantém o último online (linha contínua)", () => {
    const rows = [
      { capturedAt: "2026-09-19T17:57:00.000Z", onlineCount: 6, pageViews: 4, sessionsStarted: 1, eventsCount: 8 },
      { capturedAt: "2026-09-19T17:59:00.000Z", onlineCount: 3, pageViews: 2, sessionsStarted: 0, eventsCount: 5 },
    ];
    const r = buildRealtimeSeries(rows, { windowMs: 10 * 60_000, bucketMs: 30_000, now });
    const middle = r.points.find((p) => p.ts === "2026-09-19T17:58:00.000Z");
    expect(middle).toBeDefined();
    expect(middle?.pageViews).toBe(0);
    expect(middle?.online).toBe(6);
  });

  it("agrupa snapshots no mesmo bucket somando acessos", () => {
    const rows = [
      { capturedAt: "2026-09-19T17:58:05.000Z", onlineCount: 5, pageViews: 2, sessionsStarted: 0, eventsCount: 3 },
      { capturedAt: "2026-09-19T17:58:20.000Z", onlineCount: 8, pageViews: 3, sessionsStarted: 1, eventsCount: 4 },
    ];
    const r = buildRealtimeSeries(rows, { windowMs: 5 * 60_000, bucketMs: 30_000, now });
    const bucket = r.points.find((p) => p.ts === "2026-09-19T17:58:00.000Z");
    expect(bucket?.pageViews).toBe(5);
    expect(bucket?.online).toBe(8);
  });

  it("mapeia as linhas por perfil (admin/professor/aluno) e mantém nas lacunas", () => {
    const rows = [
      { capturedAt: "2026-09-19T17:57:00.000Z", onlineCount: 6, pageViews: 0, sessionsStarted: 0, eventsCount: 0, adminCount: 1, teacherCount: 2, studentCount: 3 },
      { capturedAt: "2026-09-19T17:59:00.000Z", onlineCount: 8, pageViews: 0, sessionsStarted: 0, eventsCount: 0, adminCount: 2, teacherCount: 1, studentCount: 5 },
    ];
    const r = buildRealtimeSeries(rows, { windowMs: 10 * 60_000, bucketMs: 30_000, now });

    const last = r.points[r.points.length - 1];
    expect(last.admin).toBe(2);
    expect(last.teacher).toBe(1);
    expect(last.student).toBe(5);

    // A lacuna entre os snapshots mantém o último valor conhecido de cada perfil
    const middle = r.points.find((p) => p.ts === "2026-09-19T17:58:00.000Z");
    expect(middle?.admin).toBe(1);
    expect(middle?.teacher).toBe(2);
    expect(middle?.student).toBe(3);
  });

  it("no mesmo bucket, perfis usam o MAIOR valor (contagem instantânea, não soma)", () => {
    const rows = [
      { capturedAt: "2026-09-19T17:58:05.000Z", onlineCount: 5, pageViews: 0, sessionsStarted: 0, eventsCount: 0, adminCount: 1, teacherCount: 0, studentCount: 4 },
      { capturedAt: "2026-09-19T17:58:20.000Z", onlineCount: 8, pageViews: 0, sessionsStarted: 0, eventsCount: 0, adminCount: 2, teacherCount: 1, studentCount: 5 },
    ];
    const r = buildRealtimeSeries(rows, { windowMs: 5 * 60_000, bucketMs: 30_000, now });
    const bucket = r.points.find((p) => p.ts === "2026-09-19T17:58:00.000Z");
    expect(bucket?.admin).toBe(2);
    expect(bucket?.teacher).toBe(1);
    expect(bucket?.student).toBe(5);
  });

  it("pico considera o total de online (não mais os page views)", () => {
    const rows = [
      { capturedAt: "2026-09-19T17:57:00.000Z", onlineCount: 2, pageViews: 50, sessionsStarted: 0, eventsCount: 0, adminCount: 2, teacherCount: 0, studentCount: 0 },
      { capturedAt: "2026-09-19T17:59:00.000Z", onlineCount: 10, pageViews: 1, sessionsStarted: 0, eventsCount: 0, adminCount: 4, teacherCount: 3, studentCount: 3 },
    ];
    const r = buildRealtimeSeries(rows, { windowMs: 10 * 60_000, now });
    expect(r.peak?.online).toBe(10);
    expect(r.peak?.admin).toBe(4);
    expect(r.peak?.teacher).toBe(3);
    expect(r.peak?.student).toBe(3);
  });

  it("snapshots antigos sem as colunas de perfil não quebram (perfis zerados)", () => {
    const rows = [
      { capturedAt: "2026-09-19T17:58:00.000Z", onlineCount: 3, pageViews: 2, sessionsStarted: 1, eventsCount: 4 },
    ];
    const r = buildRealtimeSeries(rows, { windowMs: 5 * 60_000, now });
    expect(r.points[0].admin).toBe(0);
    expect(r.points[0].teacher).toBe(0);
    expect(r.points[0].student).toBe(0);
    expect(r.points[0].online).toBe(3);
  });
});

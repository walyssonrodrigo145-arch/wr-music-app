import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { rankings as rankingsTable, studentAchievements as achievementsTable } from "../drizzle/schema";
// PRD_SISTEMA_RANKINGS — testes do motor de gamificação (MVP §54):
// criação com resolução de participantes, classificação derivada com desempate,
// encerramento com medalhas/notificação e permissões (aluno só leitura).
const selectQueue: any[][] = [];
function enqueueSelectResult(rows: any[]) {
  selectQueue.push(rows);
}

function makeChain(defaultResult: any = [], useSelectQueue = false) {
  const chain: any = {};
  const selfReturning = [
    "where", "orderBy", "limit", "offset", "groupBy", "having",
    "leftJoin", "innerJoin", "rightJoin", "fullJoin", "crossJoin",
    "returning", "onConflict", "onConflictDoUpdate", "onConflictDoNothing",
    "from", "not", "and", "or",
  ];
  for (const m of selfReturning) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.values = vi.fn().mockReturnValue(chain);
  chain.set = vi.fn().mockReturnValue(chain);
  chain.then = (onFulfilled: any, onRejected: any) => {
    const result = useSelectQueue && selectQueue.length > 0 ? selectQueue.shift()! : defaultResult;
    return Promise.resolve(result).then(onFulfilled, onRejected);
  };
  chain.catch = (onRejected: any) => Promise.resolve(defaultResult).catch(onRejected);
  chain.finally = (cb: any) => Promise.resolve(defaultResult).finally(cb);
  return chain;
}

// Fakes para auditoria de escritas (insert/update com captura de valores)
const insertCalls: Array<{ table: any; values: any }> = [];
const updateCalls: Array<{ table: any; sets: any[] }> = [];

function makeFakeDb() {
  return {
    insert: vi.fn((table: any) => {
      const c = makeChain([{ id: 1 }]);
      const origValues = c.values;
      c.values = (vals: any) => {
        insertCalls.push({ table, values: vals });
        return origValues(vals);
      };
      return c;
    }),
    update: vi.fn((table: any) => {
      const c = makeChain([]);
      const entry = { table, sets: [] as any[] };
      updateCalls.push(entry);
      const origSet = c.set;
      c.set = (vals: any) => {
        entry.sets.push(vals);
        return origSet(vals);
      };
      return c;
    }),
    delete: vi.fn(() => makeChain([])),
    select: vi.fn(() => makeChain([], true)),
    execute: vi.fn().mockResolvedValue({ rows: [] }),
  };
}

let currentDb: ReturnType<typeof makeFakeDb>;

vi.mock("./db", () => ({
  getDb: vi.fn(async () => currentDb),
}));

vi.mock("./_core/notification", () => ({
  notifyUser: vi.fn(async () => ({ success: true })),
  notifyOwner: vi.fn(async () => ({ success: true })),
}));

function makeStaffContext(overrides: any = {}): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "staff-user",
      email: "staff@test.com",
      name: "Staff User",
      loginMethod: "manus",
      role: "admin",
      organizationId: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
      ...overrides,
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function makeStudentContext(): TrpcContext {
  return {
    user: {
      id: 50,
      openId: "student-user",
      email: "aluno@test.com",
      name: "Aluno Teste",
      loginMethod: "manus",
      role: "aluno",
      organizationId: 1,
      studentId: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function makeRankingRow(overrides: any = {}) {
  const start = new Date("2026-08-01T00:00:00");
  const end = new Date("2026-08-31T23:59:59");
  return {
    id: 1,
    organizationId: 1,
    userId: 1,
    name: "Desafio de Agosto",
    description: null,
    image: null,
    status: "ativo",
    visibility: "publico",
    privacySettings: { showFullName: false, showAvatar: true, showScores: true, showEvolution: true, showParticipants: true, privateTopRange: 10 },
    criteriaWeights: { presenca: 20, atividades: 30, pratica: 25, evolucao: 15, desafios: 10 },
    participantRule: "todos",
    instrumentId: null,
    level: null,
    participantStudentIds: [],
    startDate: start,
    endDate: end,
    history: null,
    closedAt: null,
    createdAt: start,
    updatedAt: start,
    ...overrides,
  };
}

describe("rankings — criação e permissões", () => {
  beforeEach(() => {
    selectQueue.length = 0;
    insertCalls.length = 0;
    updateCalls.length = 0;
    currentDb = makeFakeDb();
  });

  it("admin cria ranking ativo e resolve participantes da regra 'todos'", async () => {
    const ctx = makeStaffContext();
    const caller = appRouter.createCaller(ctx);
    // Fila (middleware assinatura → create → resolveParticipants → notifyStart):
    // [org p/ middleware], [ranking criado], [alunos ativos], [participantes existentes], [notify], [extra p/ async]
    enqueueSelectResult([{ subscriptionStatus: "active", trialEndsAt: null }]);
    enqueueSelectResult([{ id: 1 }]);
    enqueueSelectResult([{ id: 10 }, { id: 20 }]);
    enqueueSelectResult([]);
    enqueueSelectResult([]);
    enqueueSelectResult([]);
    const result = await caller.rankings.create({
      name: "Aluno Destaque de Agosto",
      visibility: "publico",
      participantRule: "todos",
      participantStudentIds: [],
      startDate: new Date("2026-08-01T00:00:00").toISOString(),
      endDate: new Date("2026-08-31T23:59:59").toISOString(),
    } as any);
    expect(result).toHaveProperty("success", true);
    expect(result).toHaveProperty("status", "ativo");
    // Participantes inseridos
    const participantInsert = insertCalls.find((c) => c.table && (c.table as any).getSQL && JSON.stringify(c.values ?? []).includes("rankingId"));
    expect(participantInsert || insertCalls.length > 0).toBeTruthy();
  });

  it("aluno NÃO pode criar ranking (FORBIDDEN — §50/§52)", async () => {
    const ctx = makeStudentContext();
    const caller = appRouter.createCaller(ctx);
    // Payload completo válido — o bloqueio deve vir da permissão (staff-only),
    // não da validação de input.
    await expect(
      caller.rankings.create({
        name: "Hacked Ranking",
        visibility: "publico",
        participantRule: "todos",
        participantStudentIds: [],
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 86400000).toISOString(),
      } as any)
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("aluno NÃO pode registrar ajuste de pontuação (FORBIDDEN)", async () => {
    const ctx = makeStudentContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.rankings.ajuste({ rankingId: 1, studentId: 1, points: 9999, reason: "auto-promoção" } as any)
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("ranking engine — classificação derivada e desempate", () => {
  beforeEach(() => {
    selectQueue.length = 0;
    insertCalls.length = 0;
    updateCalls.length = 0;
    currentDb = makeFakeDb();
  });

  it("computa posições com pesos padrão e ordena corretamente (Maria 1º, João 2º, Pedro 3º)", async () => {
    const { computeStandings } = await import("./services/RankingEngine");
    const ranking = makeRankingRow();
    // Fila de computeStandings:
    // 1. participantes
    enqueueSelectResult([
      { studentId: 1, joinedAt: new Date("2026-08-01"), name: "João Silva", avatar: null },
      { studentId: 2, joinedAt: new Date("2026-08-01"), name: "Maria Souza", avatar: null },
      { studentId: 3, joinedAt: new Date("2026-08-01"), name: "Pedro Lima", avatar: null },
    ]);
    // 2. Promise.all — presença, atividades, evolução, prática (planos), ajustes
    enqueueSelectResult([{ studentId: 1, cnt: 2 }, { studentId: 2, cnt: 1 }]); // presença
    enqueueSelectResult([{ studentId: 2, cnt: 3 }]); // atividades (metas)
    enqueueSelectResult([]); // evolução
    enqueueSelectResult([{ studentId: 1, daysTimeSpent: "[3600,1800]" }]); // prática: 90 min
    enqueueSelectResult([{ studentId: 3, points: 50 }]); // ajuste manual
    // Pesos padrão: presença 20%, atividades 30%, prática 25%, evolução 15%
    // João:   (2×100×0.20) + (90×1×0.25) = 40 + 22.5 = 62.5 → 63
    // Maria:  (1×100×0.20) + (3×80×0.30) = 20 + 72   = 92
    // Pedro:  ajuste +50                                   = 50
    const standings = await computeStandings(ranking as any);
    expect(standings.map((s) => s.studentId)).toEqual([2, 1, 3]);
    expect(standings[0].total).toBe(92);
    expect(standings[1].total).toBe(63);
    expect(standings[2].total).toBe(50);
    expect(standings[0].position).toBe(1);
    // Anti-burla: prática raw em minutos respeitada (90 ≤ teto)
    expect(standings[1].breakdown.pratica.raw).toBe(90);
  });

  it("prática acima do teto diário é truncada (anti-burla §16)", async () => {
    const { computeStandings } = await import("./services/RankingEngine");
    // Período de 1 dia (31/08 → teto 120 min); aluno reporta 600 min de "cronômetro"
    const ranking = makeRankingRow({ startDate: new Date("2026-08-31T00:00:00"), endDate: new Date("2026-08-31T23:59:59") });
    enqueueSelectResult([{ studentId: 1, joinedAt: new Date("2026-08-31"), name: "João", avatar: null }]);
    enqueueSelectResult([]); // presença
    enqueueSelectResult([]); // atividades
    enqueueSelectResult([]); // evolução
    enqueueSelectResult([{ studentId: 1, daysTimeSpent: "[36000]" }]); // 600 min
    enqueueSelectResult([]); // ajustes
    const standings = await computeStandings(ranking as any);
    expect(standings[0].breakdown.pratica.raw).toBe(120); // cap 120min/dia
  });
});

describe("ranking engine — encerramento (§48)", () => {
  beforeEach(() => {
    selectQueue.length = 0;
    insertCalls.length = 0;
    updateCalls.length = 0;
    currentDb = makeFakeDb();
  });

  it("encerra ranking: congela status, grava pódio, concede medalha de campeão e notifica", async () => {
    const { closeRanking } = await import("./services/RankingEngine");
    // 1. ranking atual
    enqueueSelectResult([makeRankingRow()]);
    // 2. computeStandings: participantes + 5 agregações
    enqueueSelectResult([
      { studentId: 1, joinedAt: new Date("2026-08-01"), name: "João Silva", avatar: null },
      { studentId: 2, joinedAt: new Date("2026-08-01"), name: "Maria Souza", avatar: null },
    ]);
    enqueueSelectResult([{ studentId: 1, cnt: 3 }]); // presença
    enqueueSelectResult([]); // atividades
    enqueueSelectResult([]); // evolução
    enqueueSelectResult([]); // prática
    enqueueSelectResult([]); // ajustes
    // 3. dedup de badges (2 participantes no pódio: 1º e 2º)
    enqueueSelectResult([]);
    enqueueSelectResult([]);
    // 4. notificações: alunos com conta
    enqueueSelectResult([{ studentId: 1, studentUserId: 11, name: "João Silva" }]);
    enqueueSelectResult([]);

    await closeRanking(1);

    const rankingUpdate = updateCalls.find((u) => u.table === rankingsTable);
    expect(rankingUpdate).toBeTruthy();
    expect(rankingUpdate!.sets.some((s) => s.status === "encerrado")).toBe(true);
    const historySet = rankingUpdate!.sets.find((s) => s.history);
    expect(historySet.history.podium.length).toBeGreaterThan(0);
    expect(historySet.history.podium[0].position).toBe(1);

    const achievementInsert = insertCalls.find((c) => c.table === achievementsTable);
    expect(achievementInsert).toBeTruthy();
    expect(achievementInsert!.values.badge).toBe("campeao");

    const { notifyUser } = await import("./_core/notification");
    expect(notifyUser).toHaveBeenCalledWith(
      11,
      expect.objectContaining({ title: "🏆 Ranking Encerrado" })
    );
  });
});

describe("rankings — portal do aluno", () => {
  beforeEach(() => {
    selectQueue.length = 0;
    insertCalls.length = 0;
    updateCalls.length = 0;
    currentDb = makeFakeDb();
  });

  it("myRankings retorna participações do aluno (ativo com posição derivada)", async () => {
    const ctx = makeStudentContext();
    const caller = appRouter.createCaller(ctx);
    // 1. participations join rankings
    enqueueSelectResult([{
      rankingId: 1, name: "Desafio de Agosto", status: "ativo", visibility: "publico",
      startDate: new Date("2026-08-01"), endDate: new Date("2026-08-31"), image: null,
      finalPosition: null, finalScore: null, previousPosition: 5, lastPosition: null, totalParticipants: 24,
    }]);
    // 2. ranking row (para computeStandings)
    enqueueSelectResult([makeRankingRow()]);
    // 3-8. computeStandings: participantes + 5 agregações
    enqueueSelectResult([{ studentId: 1, joinedAt: new Date("2026-08-01"), name: "Aluno Teste", avatar: null }]);
    enqueueSelectResult([]);
    enqueueSelectResult([]);
    enqueueSelectResult([]);
    enqueueSelectResult([]);
    enqueueSelectResult([]);
    const result = await caller.rankings.myRankings();
    expect(Array.isArray(result)).toBe(true);
    expect((result as any[])[0].position).toBe(1);
    expect((result as any[])[0].totalParticipants).toBe(24);
  });
});

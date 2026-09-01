// ═══════════════════════════════════════════════════════════════════════════════
// RankingEngine — PRD_SISTEMA_RANKINGS (§13-19, §46-49)
//
// Motor de pontuação DERIVADA: cada critério é calculado no backend a partir das
// tabelas-fonte (aulas concluídas, metas concluídas, tempo do plano diário,
// evoluções registradas). Nenhuma pontuação é informada pelo frontend (§50) e
// nenhum evento de score é escrito pelos alunos (§52).
//
// Regras internas (NUNCA expostas ao aluno — §14/§17):
//  - Escala de pontos por unidade de cada critério;
//  - Teto de prática validada por dia (anti-burla: cronômetro passivo sozinho
//    não gera registro — só há tempo registrado quando há atividade real no
//    plano diário, e mesmo assim com teto diário);
//  - Pesos configuráveis aplicados como percentual sobre o subtotal.
// ═══════════════════════════════════════════════════════════════════════════════

import { and, eq, gte, lte, inArray, sql, ne } from "drizzle-orm";
import { getDb } from "../db";
import { debugLog } from "../_core/logger";
import {
  rankings,
  rankingParticipants,
  rankingScores,
  studentAchievements,
  students,
  lessons,
  studentGoals,
  dailyStudyPlans,
  studentTimeline,
  RANKING_DEFAULT_WEIGHTS,
} from "../../drizzle/schema";
import type { Ranking, RankingWeights } from "../../drizzle/schema";
import { notifyUser } from "../_core/notification";

// ── Regras internas de escala (config administrativa — não expor ao aluno) ────
const POINTS_PER_ATTENDANCE = 100;   // presença: aula concluída no período
const POINTS_PER_ACTIVITY = 80;      // atividades: meta/exercício concluído
const POINTS_PER_MINUTE_PRACTICE = 1; // prática validada: 1 ponto por minuto
const PRACTICE_MAX_MINUTES_PER_DAY = 120; // anti-burla: teto de minutos/dia
const POINTS_PER_EVOLUTION = 60;     // evolução: registro na linha do tempo

const POSITION_PERSIST_INTERVAL_MS = 60 * 60 * 1000; // persistência horária das posições

export interface CriterionBreakdown {
  raw: number;      // quantidade bruta (aulas, metas, minutos, registros)
  points: number;   // subtotal bruto (raw × escala)
  weighted: number; // subtotal × peso/100
}

export interface StandingRow {
  studentId: number;
  name: string;
  avatar: string | null;
  breakdown: {
    presenca: CriterionBreakdown;
    atividades: CriterionBreakdown;
    pratica: CriterionBreakdown;
    evolucao: CriterionBreakdown;
    desafios: CriterionBreakdown;
  };
  adjustments: number; // soma dos ajustes manuais (bônus/correções)
  total: number;
  position: number;
  shared: boolean; // empate técnico (§19)
  joinedAt: Date;
}

function normalizeWeights(weights: RankingWeights | null | undefined): RankingWeights {
  const w = { ...RANKING_DEFAULT_WEIGHTS, ...(weights ?? {}) };
  for (const k of Object.keys(RANKING_DEFAULT_WEIGHTS) as Array<keyof RankingWeights>) {
    const v = Number(w[k]);
    w[k] = Number.isFinite(v) && v > 0 ? v : 0;
  }
  return w;
}

function countBy(rawRows: Array<{ studentId: number | null; cnt: number }>): Map<number, number> {
  const map = new Map<number, number>();
  for (const r of rawRows) {
    if (r.studentId != null) map.set(r.studentId, r.cnt);
  }
  return map;
}

/**
 * Calcula a classificação completa de um ranking (derivada, sem estado).
 * Consultas agregadas por critério — performance ok para escolas de 50–1000
 * alunos (§53) e leituras do aluno NÃO fazem escrita (§49).
 */
export async function computeStandings(ranking: Ranking): Promise<StandingRow[]> {
  const db = await getDb();
  if (!db) return [];
  const orgId = ranking.organizationId!;

  // 1. Participantes + dados básicos do aluno
  const participants = await db.select({
    studentId: rankingParticipants.studentId,
    joinedAt: rankingParticipants.joinedAt,
    name: students.name,
    avatar: students.avatar,
  }).from(rankingParticipants)
    .leftJoin(students, eq(rankingParticipants.studentId, students.id))
    .where(eq(rankingParticipants.rankingId, ranking.id));

  if (participants.length === 0) return [];
  const studentIds = participants.map((p) => p.studentId);
  const start = new Date(ranking.startDate);
  const end = new Date(ranking.endDate);

  // 2. Sinais derivados — agregações no banco (§53)
  const [attendanceRows, goalRows, evolutionRows, planRows, adjustmentRows] = await Promise.all([
    db.select({ studentId: lessons.studentId, cnt: sql<number>`CAST(count(*) AS INT)` })
      .from(lessons)
      .where(and(
        eq(lessons.organizationId, orgId),
        eq(lessons.status, 'concluida'),
        gte(lessons.scheduledAt, start),
        lte(lessons.scheduledAt, end),
        inArray(lessons.studentId, studentIds),
      ))
      .groupBy(lessons.studentId),
    db.select({ studentId: studentGoals.studentId, cnt: sql<number>`CAST(count(*) AS INT)` })
      .from(studentGoals)
      .where(and(
        eq(studentGoals.organizationId, orgId),
        eq(studentGoals.status, 'concluida'),
        gte(studentGoals.completedAt, start),
        lte(studentGoals.completedAt, end),
        inArray(studentGoals.studentId, studentIds),
      ))
      .groupBy(studentGoals.studentId),
    db.select({ studentId: studentTimeline.studentId, cnt: sql<number>`CAST(count(*) AS INT)` })
      .from(studentTimeline)
      .where(and(
        eq(studentTimeline.organizationId, orgId),
        gte(studentTimeline.achievedAt, start),
        lte(studentTimeline.achievedAt, end),
        inArray(studentTimeline.studentId, studentIds),
      ))
      .groupBy(studentTimeline.studentId),
    // Prática validada: tempo registrado no plano diário (só existe registro com
    // interação real — cronômetro aberto passivo não produz dado, §15/§16)
    db.select({
      studentId: dailyStudyPlans.studentId,
      daysTimeSpent: dailyStudyPlans.daysTimeSpent,
    })
      .from(dailyStudyPlans)
      .where(and(
        eq(dailyStudyPlans.organizationId, orgId),
        gte(dailyStudyPlans.updatedAt, start),
        lte(dailyStudyPlans.updatedAt, end),
        inArray(dailyStudyPlans.studentId, studentIds),
      )),
    db.select({ studentId: rankingScores.studentId, points: rankingScores.points })
      .from(rankingScores)
      .where(eq(rankingScores.rankingId, ranking.id)),
  ]);

  const attendanceMap = countBy(attendanceRows as any);
  const goalsMap = countBy(goalRows as any);
  const evolutionMap = countBy(evolutionRows as any);

  // Anti-burla (§16): teto de prática validada por dia de competição. O tempo
  // vem de sessões com atividade real registrada; excesso é descartado.
  const periodDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)));
  const maxValidatedMinutes = periodDays * PRACTICE_MAX_MINUTES_PER_DAY;
  const practiceMinutesMap = new Map<number, number>();
  for (const plan of planRows as Array<{ studentId: number | null; daysTimeSpent: string | null }>) {
    if (plan.studentId == null) continue;
    let seconds = 0;
    try {
      const arr = JSON.parse(plan.daysTimeSpent || "[]");
      if (Array.isArray(arr)) seconds += arr.reduce((acc: number, v: any) => acc + (Number(v) || 0), 0);
    } catch { /* plano corrompido: ignora, não pontua */ }
    const current = practiceMinutesMap.get(plan.studentId) ?? 0;
    practiceMinutesMap.set(plan.studentId, current + Math.floor(seconds / 60));
  }

  const adjustmentsMap = new Map<number, number>();
  for (const adj of adjustmentRows as Array<{ studentId: number; points: number }>) {
    adjustmentsMap.set(adj.studentId, (adjustmentsMap.get(adj.studentId) ?? 0) + adj.points);
  }

  // 3. Totais ponderados
  const weights = normalizeWeights(ranking.criteriaWeights);
  const standings: StandingRow[] = participants.map((p) => {
    const attendances = attendanceMap.get(p.studentId) ?? 0;
    const goals = goalsMap.get(p.studentId) ?? 0;
    const rawMinutes = Math.min(practiceMinutesMap.get(p.studentId) ?? 0, maxValidatedMinutes);
    const evolutions = evolutionMap.get(p.studentId) ?? 0;
    const adjustments = adjustmentsMap.get(p.studentId) ?? 0;

    const bPresenca = attendances * POINTS_PER_ATTENDANCE;
    const bAtividades = goals * POINTS_PER_ACTIVITY;
    const bPratica = rawMinutes * POINTS_PER_MINUTE_PRACTICE;
    const bEvolucao = evolutions * POINTS_PER_EVOLUTION;
    const bDesafios = 0; // Fase 2 (§55)

    const total =
      (bPresenca * weights.presenca +
        bAtividades * weights.atividades +
        bPratica * weights.pratica +
        bEvolucao * weights.evolucao +
        bDesafios * weights.desafios) / 100 +
      adjustments;

    return {
      studentId: p.studentId,
      name: p.name ?? "Aluno",
      avatar: p.avatar ?? null,
      breakdown: {
        presenca: { raw: attendances, points: bPresenca, weighted: (bPresenca * weights.presenca) / 100 },
        atividades: { raw: goals, points: bAtividades, weighted: (bAtividades * weights.atividades) / 100 },
        pratica: { raw: rawMinutes, points: bPratica, weighted: (bPratica * weights.pratica) / 100 },
        evolucao: { raw: evolutions, points: bEvolucao, weighted: (bEvolucao * weights.evolucao) / 100 },
        desafios: { raw: 0, points: 0, weighted: 0 },
      },
      adjustments,
      total: Math.round(total),
      position: 0,
      shared: false,
      joinedAt: new Date(p.joinedAt),
    };
  });

  // 4. Ordenação + desempate (§19): total → atividades → prática → evolução →
  // presença → ingresso mais antigo. Persistindo igualdade: empate técnico.
  standings.sort((a, b) =>
    b.total - a.total ||
    b.breakdown.atividades.points - a.breakdown.atividades.points ||
    b.breakdown.pratica.points - a.breakdown.pratica.points ||
    b.breakdown.evolucao.points - a.breakdown.evolucao.points ||
    b.breakdown.presenca.points - a.breakdown.presenca.points ||
    a.joinedAt.getTime() - b.joinedAt.getTime()
  );

  standings.forEach((row, idx) => {
    const prev = standings[idx - 1];
    const tied = prev && prev.total === row.total &&
      prev.breakdown.atividades.points === row.breakdown.atividades.points &&
      prev.breakdown.pratica.points === row.breakdown.pratica.points &&
      prev.breakdown.evolucao.points === row.breakdown.evolucao.points &&
      prev.breakdown.presenca.points === row.breakdown.presenca.points &&
      prev.joinedAt.getTime() === row.joinedAt.getTime();
    row.shared = !!tied;
    row.position = tied ? prev.position : idx + 1;
  });

  return standings;
}

/** Persiste posições correntes (para evolução ↑↓ do aluno) — escrita em background. */
export async function persistRankingPositions(ranking: Ranking): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const standings = await computeStandings(ranking);
  for (const row of standings) {
    const [p] = await db.select({ lastPosition: rankingParticipants.lastPosition })
      .from(rankingParticipants)
      .where(and(eq(rankingParticipants.rankingId, ranking.id), eq(rankingParticipants.studentId, row.studentId)))
      .limit(1);
    await db.update(rankingParticipants).set({
      previousPosition: p?.lastPosition ?? null,
      lastPosition: row.position,
    }).where(and(eq(rankingParticipants.rankingId, ranking.id), eq(rankingParticipants.studentId, row.studentId)));
  }
}

const BADGE_DEFS: Record<string, { title: string; description: string }> = {
  campeao: { title: "🏆 Campeão", description: "Terminou em 1º lugar." },
  vice: { title: "🥈 Vice-campeão", description: "Terminou em 2º lugar." },
  top3: { title: "🥉 Top 3", description: "Terminou entre os três primeiros." },
};

/**
 * Encerra um ranking (§48): congela pontuação, grava posições finais, snapshot
 * do pódio no histórico, concede medalhas e notifica participantes.
 */
export async function closeRanking(rankingId: number, opts?: { silent?: boolean }): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const [ranking] = await db.select().from(rankings).where(eq(rankings.id, rankingId)).limit(1);
  if (!ranking || ranking.status === 'encerrado' || ranking.status === 'cancelado') return;

  const standings = await computeStandings(ranking);

  for (const row of standings) {
    await db.update(rankingParticipants).set({
      finalPosition: row.position,
      finalScore: row.total,
      previousPosition: null,
      lastPosition: row.position,
    }).where(and(eq(rankingParticipants.rankingId, rankingId), eq(rankingParticipants.studentId, row.studentId)));
  }

  // Snapshot do histórico (§26/§48)
  const podium = standings.slice(0, 3).map((row) => ({
    position: row.position,
    studentId: row.studentId,
    name: row.name,
    avatar: row.avatar,
    score: row.total,
  }));
  await db.update(rankings).set({
    status: 'encerrado',
    closedAt: new Date(),
    history: {
      podium,
      totalParticipants: standings.length,
      closedAt: new Date().toISOString(),
    },
    updatedAt: new Date(),
  }).where(eq(rankings.id, rankingId));

  // Medalhas básicas (§25) — com dedup (idempotente no reprocessamento)
  const badgeByPosition: Record<number, string> = { 1: 'campeao', 2: 'vice', 3: 'top3' };
  for (const row of standings) {
    const badgeKey = badgeByPosition[row.position];
    if (!badgeKey) continue;
    const def = BADGE_DEFS[badgeKey];
    const existing = await db.select({ id: studentAchievements.id })
      .from(studentAchievements)
      .where(and(
        eq(studentAchievements.studentId, row.studentId),
        eq(studentAchievements.rankingId, rankingId),
        eq(studentAchievements.badge, badgeKey),
      ))
      .limit(1);
    if (existing.length === 0) {
      await db.insert(studentAchievements).values({
        organizationId: ranking.organizationId,
        studentId: row.studentId,
        rankingId,
        badge: badgeKey,
        title: def.title,
        description: def.description,
        awardedAt: new Date(),
      });
    }
  }

  // Notificações de encerramento (§30) — apenas alunos com conta vinculada
  if (!opts?.silent) {
    const withAccount = await db.select({ studentId: students.id, studentUserId: students.studentUserId, name: students.name })
      .from(students)
      .where(and(inArray(students.id, standings.map((s) => s.studentId)), sql`${students.studentUserId} IS NOT NULL`));
    const positionOf = new Map(standings.map((s) => [s.studentId, s.position]));
    for (const s of withAccount) {
      const pos = positionOf.get(s.studentId);
      if (!s.studentUserId || !pos) continue;
      try {
        await notifyUser(s.studentUserId, {
          title: "🏆 Ranking Encerrado",
          content: `O ranking "${ranking.name}" foi encerrado. Você terminou em ${pos}º lugar!`,
        });
      } catch (e) {
        debugLog("[Rankings] Falha ao notificar encerramento:", e);
      }
    }
  }

  debugLog(`[Rankings] Ranking ${rankingId} encerrado com ${standings.length} participantes.`);
}

/** Notifica participantes sobre início de competição (§30). */
export async function notifyRankingStart(ranking: Ranking): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const withAccount = await db.select({ studentUserId: students.studentUserId })
    .from(students)
    .innerJoin(rankingParticipants, eq(rankingParticipants.studentId, students.id))
    .where(and(eq(rankingParticipants.rankingId, ranking.id), sql`${students.studentUserId} IS NOT NULL`));
  for (const s of withAccount) {
    if (!s.studentUserId) continue;
    try {
      await notifyUser(s.studentUserId, {
        title: "🏆 Novo Desafio Começou!",
        content: `O ranking "${ranking.name}" está ativo. Boa sorte!`,
      });
    } catch (e) {
      debugLog("[Rankings] Falha ao notificar início:", e);
    }
  }
}

// Guard de concorrência para a manutenção periódica
let isMaintenanceRunning = false;
let lastPersistAt = 0;

/**
 * Manutenção periódica chamada pelo job de automação (§48/§49):
 *  1. Encerra automaticamente rankings cuja data final passou;
 *  2. Persiste posições correntes a cada hora (evolução ↑↓— do aluno).
 */
export async function runRankingsMaintenance(): Promise<void> {
  if (isMaintenanceRunning) return;
  isMaintenanceRunning = true;
  try {
    const db = await getDb();
    if (!db) return;

    // 1. Encerramento automático
    const due = await db.select().from(rankings).where(and(eq(rankings.status, 'ativo'), lte(rankings.endDate, new Date())));
    for (const ranking of due) {
      try {
        await closeRanking(ranking.id);
      } catch (e) {
        debugLog(`[Rankings] Erro ao encerrar ranking ${ranking.id}:`, e);
      }
    }

    // 2. Persistência horária de posições dos rankings ativos
    const now = Date.now();
    if (now - lastPersistAt >= POSITION_PERSIST_INTERVAL_MS) {
      lastPersistAt = now;
      const active = await db.select().from(rankings).where(and(eq(rankings.status, 'ativo'), ne(rankings.endDate, new Date(0))));
      for (const ranking of active) {
        try {
          await persistRankingPositions(ranking);
        } catch (e) {
          debugLog(`[Rankings] Erro ao persistir posições do ranking ${ranking.id}:`, e);
        }
      }
    }
  } finally {
    isMaintenanceRunning = false;
  }
}

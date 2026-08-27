import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb, getSettingsByUserId } from "./db";
import {
  students,
  lessons,
  studentEvolution,
  studentTimeline,
  dailyStudyPlans,
  studentPedagogicalMemory,
  scheduleOptimizationLogs,
  studioRooms,
  professores,
  users,
  instruments
} from "../drizzle/schema";
import { eq, and, desc, gte, inArray } from "drizzle-orm";
import { callGemini } from "./utils/gemini";
import { resolveAiCredentials } from "./utils/aiProvider";

export const advancedAiRouter = router({
  // ─── OPÇÃO 4: MEMÓRIA PEDAGÓGICA CONTÍNUA DO ALUNO ────────────────────────

  /**
   * Obtém a memória pedagógica contínua do aluno (pontos fortes, fracos, repertório e diretrizes).
   */
  getPedagogicalMemory: protectedProcedure
    .input(z.object({ studentId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database error" });
      const orgId = ctx.user.organizationId!;

      const memory = await db
        .select()
        .from(studentPedagogicalMemory)
        .where(and(eq(studentPedagogicalMemory.studentId, input.studentId), eq(studentPedagogicalMemory.organizationId, orgId)))
        .limit(1)
        .then((rows) => rows[0])
        .catch((err) => {
          console.warn("[getPedagogicalMemory] Falha ao consultar memória pedagógica:", err?.message || err);
          return null;
        });

      if (!memory) {
        return {
          studentId: input.studentId,
          strongPoints: [],
          weakPoints: [],
          repertoireMastered: [],
          repertoireLearning: [],
          pedagogicalDirectives: "Nenhuma análise prévia gerada. Clique em 'Analisar e Gerar Plano com IA' para compilar a memória histórica deste aluno.",
          lastAiAnalysisAt: null,
        };
      }

      let strongPoints: string[] = [];
      let weakPoints: string[] = [];
      let repertoireMastered: string[] = [];
      let repertoireLearning: string[] = [];

      try {
        strongPoints = JSON.parse(memory.strongPoints || "[]");
        weakPoints = JSON.parse(memory.weakPoints || "[]");
        repertoireMastered = JSON.parse(memory.repertoireMastered || "[]");
        repertoireLearning = JSON.parse(memory.repertoireLearning || "[]");
      } catch (parseErr) {
        console.warn("[getPedagogicalMemory] Erro ao parsear JSON da memória:", parseErr);
      }

      return {
        ...memory,
        strongPoints,
        weakPoints,
        repertoireMastered,
        repertoireLearning,
      };
    }),

  /**
   * Gera o Plano da Próxima Aula baseado nos últimos 6 meses de histórico e atualiza a Memória Pedagógica.
   */
  generateSmartLessonPlan: protectedProcedure
    .input(z.object({ studentId: z.number(), focusNotes: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database error" });
      const orgId = ctx.user.organizationId!;

      // 1. Buscar Dados do Aluno
      const [student] = await db
        .select()
        .from(students)
        .where(and(eq(students.id, input.studentId), eq(students.organizationId, orgId)))
        .limit(1);

      if (!student) throw new TRPCError({ code: "NOT_FOUND", message: "Aluno não encontrado" });

      // 2. Buscar Histórico dos últimos 6 meses (Aulas, Evoluções e Timeline)
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const recentLessons = await db
        .select({ title: lessons.title, notes: lessons.notes, rating: lessons.rating, scheduledAt: lessons.scheduledAt })
        .from(lessons)
        .where(and(eq(lessons.studentId, input.studentId), gte(lessons.scheduledAt, sixMonthsAgo)))
        .orderBy(desc(lessons.scheduledAt))
        .limit(15);

      const recentEvolutions = await db
        .select()
        .from(studentEvolution)
        .where(eq(studentEvolution.studentId, input.studentId))
        .orderBy(desc(studentEvolution.recordedAt))
        .limit(5);

      const timelineItems = await db
        .select({ title: studentTimeline.title, category: studentTimeline.category, description: studentTimeline.description })
        .from(studentTimeline)
        .where(eq(studentTimeline.studentId, input.studentId))
        .orderBy(desc(studentTimeline.achievedAt))
        .limit(10);

      // 3. Montar Prompt contextualizado
      const prompt = `Você é um mestre da pedagogia musical e consultor pedagógico do sistema MusicPro.
Sua missão é analisar o histórico evolutivo acumulado nos últimos 6 meses do aluno e gerar a estratégia perfeita para a PRÓXIMA AULA.

DADOS DO ALUNO:
- Nome: ${student.name}
- Nível: ${student.level}
- Notas gerais do professor: ${student.notes || "Nenhuma"}
- Foco adicional informado pelo professor hoje: ${input.focusNotes || "Geral / Seguir evolução natural"}

HISTÓRICO DE AULAS RECENTES (Até 15 aulas):
${recentLessons.map(l => `- [${l.scheduledAt?.toISOString().slice(0, 10)}] ${l.title} (Nota: ${l.rating || 'N/A'}) | Obs: ${l.notes || 'Sem anotação'}`).join("\n")}

AVALIAÇÕES DE TÉCNICA E RITMO RECENTES:
${recentEvolutions.map(e => `- Técnica: ${e.technical}/10 | Ritmo: ${e.rhythm}/10 | Harmonia: ${e.harmony}/10 | Leitura: ${e.reading}/10`).join("\n")}

CONQUISTAS E REPERTÓRIO NA TIMELINE:
${timelineItems.map(t => `- [${t.category}] ${t.title}: ${t.description || ''}`).join("\n")}

INSTRUÇÕES DE RESPOSTA EM FORMATO JSON ESTRITO:
Retorne APENAS um JSON válido (sem texto fora do JSON e sem Markdown de código) com o seguinte formato:
{
  "summary": "Resumo pedagógico do progresso recente do aluno em 2 frases",
  "strongPoints": ["Ponto forte 1", "Ponto forte 2"],
  "weakPoints": ["Dificuldade recorrente 1", "Dificuldade recorrente 2"],
  "repertoireMastered": ["Música/Exercício dominado 1"],
  "repertoireLearning": ["Música/Exercício em aprendizado 1"],
  "nextLessonPlan": {
    "title": "Título sugerido para a próxima aula",
    "warmup": "Exercício de aquecimento (5-10 min)",
    "technicalFocus": "Foco técnico principal da aula",
    "repertoirePractice": "Trecho de repertório a trabalhar",
    "homework": "Tarefa recomendada para casa"
  },
  "pedagogicalDirectives": "Diretriz pedagógica contínua recomendada ao professor para as próximas semanas."
}`;

      const settingsData = await getSettingsByUserId(orgId, ctx.user.id);
      const creds = resolveAiCredentials(settingsData);
      const apiKey = creds.apiKey;
      const model = creds.model;

      const aiRaw = await callGemini([{ role: "user", content: prompt }], undefined, false, apiKey, model);

      let parsed: any;
      try {
        const cleanJson = aiRaw.replace(/```json/g, "").replace(/```/g, "").trim();
        parsed = JSON.parse(cleanJson);
      } catch (err) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Falha ao processar resposta estruturada da IA. Tente novamente." });
      }

      // 4. Salvar ou Atualizar na Memória Pedagógica Contínua
      const existingMem = await db
        .select({ id: studentPedagogicalMemory.id })
        .from(studentPedagogicalMemory)
        .where(eq(studentPedagogicalMemory.studentId, input.studentId))
        .limit(1);

      if (existingMem.length > 0) {
        await db
          .update(studentPedagogicalMemory)
          .set({
            strongPoints: JSON.stringify(parsed.strongPoints || []),
            weakPoints: JSON.stringify(parsed.weakPoints || []),
            repertoireMastered: JSON.stringify(parsed.repertoireMastered || []),
            repertoireLearning: JSON.stringify(parsed.repertoireLearning || []),
            pedagogicalDirectives: parsed.pedagogicalDirectives || "",
            lastAiAnalysisAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(studentPedagogicalMemory.id, existingMem[0].id));
      } else {
        await db.insert(studentPedagogicalMemory).values({
          organizationId: orgId,
          studentId: input.studentId,
          strongPoints: JSON.stringify(parsed.strongPoints || []),
          weakPoints: JSON.stringify(parsed.weakPoints || []),
          repertoireMastered: JSON.stringify(parsed.repertoireMastered || []),
          repertoireLearning: JSON.stringify(parsed.repertoireLearning || []),
          pedagogicalDirectives: parsed.pedagogicalDirectives || "",
          lastAiAnalysisAt: new Date(),
        });
      }

      return parsed;
    }),

  // ─── OPÇÃO 6: OTIMIZADOR AUTOMÁTICO DE GRADE & SALAS (SMART SCHEDULING) ───

  /**
   * Analisa conflitos e gera uma sugestão de grade otimizada usando IA.
   */
  generateSmartSchedule: protectedProcedure
    .input(
      z.object({
        targetDate: z.string(), // YYYY-MM-DD
        daysCount: z.number().default(7),
        preferences: z.string().optional(), // ex: "Evitar aulas de bateria após as 18h na Sala 1"
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database error" });
      const orgId = ctx.user.organizationId!;

      // 1. Buscar Professores, Salas, Instrumentos e Alunos Ativos
      const activeStudents = await db
        .select({ id: students.id, name: students.name, level: students.level, instrumentId: students.instrumentId })
        .from(students)
        .where(and(eq(students.organizationId, orgId), eq(students.status, "ativo")));

      const rooms = await db
        .select({ id: studioRooms.id, name: studioRooms.name })
        .from(studioRooms)
        .where(and(eq(studioRooms.organizationId, orgId), eq(studioRooms.active, true)));

      const activeInstruments = await db
        .select({ id: instruments.id, name: instruments.name })
        .from(instruments)
        .where(eq(instruments.organizationId, orgId));

      const startDate = new Date(input.targetDate);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + input.daysCount);

      // Buscar aulas agendadas no período para ajustar
      const existingLessons = await db
        .select({
          id: lessons.id,
          title: lessons.title,
          studentId: lessons.studentId,
          scheduledAt: lessons.scheduledAt,
          duration: lessons.duration,
          studioRoomId: lessons.studioRoomId,
          instrumentId: lessons.instrumentId,
        })
        .from(lessons)
        .where(and(eq(lessons.organizationId, orgId), gte(lessons.scheduledAt, startDate), eq(lessons.status, "agendada")));

      const prompt = `Você é o Algoritmo Otimizador de Agendas do MusicPro (Smart Scheduling Engine).
Sua missão é reorganizar e otimizar a distribuição de aulas da escola para eliminar choque de horários e salas, otimizando o uso do estúdio.

DADOS DA ESCOLA:
- Período: ${input.targetDate} (Duração: ${input.daysCount} dias)
- Salas de Estúdio Disponíveis: ${JSON.stringify(rooms)}
- Instrumentos: ${JSON.stringify(activeInstruments)}
- Preferências / Restrições Especiais do Usuário: "${input.preferences || 'Nenhuma'}"
- Aulas no Período para Reorganização/Distribuição (${existingLessons.length} aulas):
${JSON.stringify(existingLessons)}

REGRAS RÍGIDAS DE ALOCAÇÃO:
1. Nunca colocar 2 aulas no mesmo horário na mesma Sala de Estúdio.
2. Manter a duração original das aulas.
3. Distribuir os horários entre 08:00 e 20:00.
4. Caso haja conflito, ajuste o horário ou a sala e informe a justificativa no JSON.

FORMATO DE RESPOSTA EXCLUSIVO EM JSON ESTRITO:
{
  "totalOptimized": ${existingLessons.length},
  "conflictsResolved": 0,
  "recommendations": ["Recomendação 1", "Recomendação 2"],
  "optimizedLessons": [
    {
      "lessonId": 123,
      "studentName": "Nome",
      "originalScheduledAt": "2026-08-15T10:00:00Z",
      "proposedScheduledAt": "2026-08-15T11:00:00Z",
      "proposedStudioRoomId": 1,
      "proposedStudioRoomName": "Sala 1 - Piano",
      "reason": "Evitou choque com aula de bateria na Sala 1"
    }
  ]
}`;

      const settingsData = await getSettingsByUserId(orgId, ctx.user.id);
      const creds = resolveAiCredentials(settingsData);
      const apiKey = creds.apiKey;
      const model = creds.model;

      const aiRaw = await callGemini([{ role: "user", content: prompt }], undefined, false, apiKey, model);

      let parsed: any;
      try {
        const cleanJson = aiRaw.replace(/```json/g, "").replace(/```/g, "").trim();
        parsed = JSON.parse(cleanJson);
      } catch (err) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Erro ao gerar otimização de grade. Tente novamente." });
      }

      // Registrar o log de otimização gerado no banco
      const [log] = await db
        .insert(scheduleOptimizationLogs)
        .values({
          organizationId: orgId,
          userId: ctx.user.id,
          inputConstraints: JSON.stringify({ targetDate: input.targetDate, daysCount: input.daysCount, preferences: input.preferences }),
          proposedSchedule: JSON.stringify(parsed),
          status: "pending",
        })
        .returning({ id: scheduleOptimizationLogs.id });

      return {
        logId: log.id,
        ...parsed,
      };
    }),

  /**
   * Aplica a grade otimizada aprovada pelo usuário no banco de dados.
   */
  applySmartSchedule: protectedProcedure
    .input(z.object({ logId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database error" });
      const orgId = ctx.user.organizationId!;

      const [log] = await db
        .select()
        .from(scheduleOptimizationLogs)
        .where(and(eq(scheduleOptimizationLogs.id, input.logId), eq(scheduleOptimizationLogs.organizationId, orgId)))
        .limit(1);

      if (!log) throw new TRPCError({ code: "NOT_FOUND", message: "Registro de otimização não encontrado" });
      if (log.status === "applied") throw new TRPCError({ code: "BAD_REQUEST", message: "Esta otimização já foi aplicada previamente" });

      const proposed = JSON.parse(log.proposedSchedule);
      const items = proposed.optimizedLessons || [];

      let updatedCount = 0;
      for (const item of items) {
        if (!item.lessonId) continue;
        await db
          .update(lessons)
          .set({
            scheduledAt: new Date(item.proposedScheduledAt),
            studioRoomId: item.proposedStudioRoomId || null,
            updatedAt: new Date(),
          })
          .where(and(eq(lessons.id, item.lessonId), eq(lessons.organizationId, orgId)));
        updatedCount++;
      }

      await db
        .update(scheduleOptimizationLogs)
        .set({ status: "applied", appliedAt: new Date() })
        .where(eq(scheduleOptimizationLogs.id, input.logId));

      return { success: true, updatedLessons: updatedCount };
    }),
});

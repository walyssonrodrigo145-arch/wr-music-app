import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "../_core/cookies";
import { systemRouter } from "../_core/systemRouter";
import { fcmRouter } from "../fcmRouter";
import { publicProcedure, protectedProcedure, professorProcedure, studentProcedure, router } from "../_core/trpc";
import { slotAdvanceRouter } from "../slotAdvanceRouter";
import {
  getDashboardStats,
  getMonthlyStats,
  getStudentsWithInstrument,
  getRecentLessons,
  getInstrumentsWithCount,
  getLessonsByDayOfWeek,
  getDb,
  getSettingsByUserId,
  upsertSettings,
  updateUserProfile,
  getExperimentalStats,
} from "../db";
import { organizations, users, students, lessons, instruments, reminders, reminderTemplates, paymentDues, asaasCustomers, settings, studentGoals, studentTimeline, studentFiles, announcements, chatMessages, rescheduleRequests, studentEvolution, aiConversations, aiMessages, aiDocuments, expenses, dailyStudyPlans, notifications, professores, professorPayments, attendanceTokens, attendanceLogs, contracts, fileComments, studioRooms, schoolIntegrations, contractTemplates, contractEvents, crmLeads, crmGoals, crmActivities, fiscalCompanies, fiscalInvoices, fiscalServices, fiscalJobs, fiscalLogs } from "../../drizzle/schema";
import { eq, desc, sql, and, gte, lt, lte, asc, ne, or, inArray, aliasedTable, ilike, isNull } from "drizzle-orm";
import { notifyOwner, notifyUser } from "../_core/notification";
import { handleDbError } from "../utils/error_handler";
import { TRPCError } from "@trpc/server";

import crypto from "crypto";
import { createAsaasCustomer, createAsaasCharge, deleteAsaasCharge, getAsaasPixQrCode } from "../utils/asaas";
import { buildUserContext } from "../utils/aiContext";
import { getSystemPrompt } from "../utils/aiPrompts";
import { callGemini, genAI } from "../utils/gemini";
import { BillingEngine } from "../services/BillingEngine";
import { sendWhatsAppMessage, startWhatsAppSession, getWhatsAppSessionStatus, logoutWhatsAppSession } from "../utils/whatsapp";
import { nanoid } from "nanoid";
import { sdk } from "../_core/sdk";
import { sendVerificationEmail, sendSimpleEmail } from "../_core/email";
import { ENV } from "../_core/env";
import { storagePut } from "../storage";
import { superAdminRouter } from "../superAdminRouter";
import { pairingActiveSessions } from "../automationJob";
import { checkFileMagicBytes } from "../utils/fileSecurity";
import { reportEngineRouter } from "../reportEngineRouter";
import { marketingRouter } from "../marketingRouter";
import { analyticsRouter } from "../analyticsRouter";
import { crmRouter } from "../crmRouter";
import { studioRoomsRouter } from "../studioRoomsRouter";
import { enrollmentRouter } from "../enrollmentRouter";
import { advancedAiRouter } from "../advancedAiRouter";
import { chatbotFlowRouter } from "../chatbotFlowRouter";
import { schoolAiRouter } from "../schoolAiRouter";
import { fiscalRouter } from "../fiscalRouter";
import { FiscalService } from "../services/fiscal/FiscalService";
import { loginAttempts, safeEqualStr, isReservedSuperAdminEmail, getOrgPlanLimits, syncOrgAsaasSubscription, reconcileOrgAsaasCharges, runCreateAssinafyContract } from "./helpers";
import { getInstrumentContext } from "../utils/instrumentContexts";
import { studentPedagogicalMemory } from "../../drizzle/schema";
export const progressRouters = {
  progress: router({
    getGoals: protectedProcedure.input(z.object({ studentId: z.number() })).query(async ({ ctx, input }) => {
      const isUserAdmin = ctx.user.role === 'admin' || ctx.user.openId === ENV.ownerOpenId;
      const orgId = ctx.user.organizationId!;
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      return db.select().from(studentGoals)
        .where(and(
          eq(studentGoals.organizationId, orgId),
          isUserAdmin ? undefined : eq(studentGoals.userId, ctx.user.id), 
          eq(studentGoals.studentId, input.studentId)
        ))
        .orderBy(asc(studentGoals.targetDate));
    }),
    createGoal: protectedProcedure.input(z.object({
      studentId: z.number(),
      title: z.string(),
      description: z.string().optional(),
      targetDate: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const orgId = ctx.user.organizationId!;

      const isUserAdmin = ctx.user.role === 'admin' || ctx.user.openId === ENV.ownerOpenId;
      // Security: verify student ownership
      const [ownedStudent] = await db.select({ id: students.id }).from(students)
        .where(and(
          eq(students.id, input.studentId as number), 
          eq(students.organizationId, orgId), 
          isUserAdmin ? undefined : eq(students.professorId, ctx.user.id)
        ))
        .limit(1);
      
      if (!ownedStudent) {
        throw new TRPCError({ code: "FORBIDDEN", message: "O aluno selecionado não existe ou não pertence ao seu perfil." });
      }

      await db.insert(studentGoals).values({
        organizationId: orgId,
        userId: ctx.user.id,
        studentId: input.studentId,
        title: input.title,
        description: input.description,
        targetDate: input.targetDate,
      });
      return { success: true };
    }),
    updateGoal: protectedProcedure.input(z.object({
      id: z.number(),
      title: z.string().optional(),
      description: z.string().optional(),
      status: z.enum(['pendente', 'concluida']).optional(),
      targetDate: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const orgId = ctx.user.organizationId!;
      const { id, ...data } = input;
      const updateData: any = { ...data, updatedAt: new Date() };
      if (data.status === 'concluida') updateData.completedAt = new Date();
      else if (data.status === 'pendente') updateData.completedAt = null;
      await db.update(studentGoals).set(updateData).where(and(eq(studentGoals.id, id), eq(studentGoals.organizationId, orgId), eq(studentGoals.userId, ctx.user.id)));
      return { success: true };
    }),
    deleteGoal: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const orgId = ctx.user.organizationId!;
      await db.delete(studentGoals).where(and(eq(studentGoals.id, input.id), eq(studentGoals.organizationId, orgId), eq(studentGoals.userId, ctx.user.id)));
      return { success: true };
    }),
    getTimeline: protectedProcedure.input(z.object({ studentId: z.number() })).query(async ({ ctx, input }) => {
      const isUserAdmin = ctx.user.role === 'admin' || ctx.user.openId === ENV.ownerOpenId;
      const orgId = ctx.user.organizationId!;
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      return db.select().from(studentTimeline)
        .where(and(
          eq(studentTimeline.organizationId, orgId),
          isUserAdmin ? undefined : eq(studentTimeline.userId, ctx.user.id), 
          eq(studentTimeline.studentId, input.studentId)
        ))
        .orderBy(desc(studentTimeline.achievedAt));
    }),
    createTimelineEvent: protectedProcedure.input(z.object({
      studentId: z.number(),
      title: z.string(),
      description: z.string().optional(),
      category: z.enum(['tecnica', 'teoria', 'repertorio', 'geral']).default('geral'),
      grade: z.string().optional(),
      achievedAt: z.string(),
    })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const orgId = ctx.user.organizationId!;

      const isUserAdmin = ctx.user.role === 'admin' || ctx.user.openId === ENV.ownerOpenId;
      // Security: verify student ownership
      const [ownedStudent] = await db.select({ id: students.id }).from(students)
        .where(and(
          eq(students.id, input.studentId as number), 
          eq(students.organizationId, orgId), 
          isUserAdmin ? undefined : eq(students.professorId, ctx.user.id)
        ))
        .limit(1);
      
      if (!ownedStudent) {
        throw new TRPCError({ code: "FORBIDDEN", message: "O aluno selecionado não existe ou não pertence ao seu perfil." });
      }

      await db.insert(studentTimeline).values({
        organizationId: orgId,
        userId: ctx.user.id,
        studentId: input.studentId,
        title: input.title,
        description: input.description,
        category: input.category,
        grade: input.grade,
        achievedAt: new Date(input.achievedAt),
      });
      return { success: true };
    }),
    updateTimelineEvent: protectedProcedure.input(z.object({
      id: z.number(),
      title: z.string().optional(),
      description: z.string().optional(),
      category: z.enum(['tecnica', 'teoria', 'repertorio', 'geral']).optional(),
      grade: z.string().optional(),
      achievedAt: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const orgId = ctx.user.organizationId!;
      const { id, ...data } = input;
      const updateData: any = { ...data };
      if (data.achievedAt) updateData.achievedAt = new Date(data.achievedAt);
      await db.update(studentTimeline).set(updateData).where(and(eq(studentTimeline.id, id), eq(studentTimeline.organizationId, orgId), eq(studentTimeline.userId, ctx.user.id)));
      return { success: true };
    }),
    deleteTimelineEvent: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const orgId = ctx.user.organizationId!;
      await db.delete(studentTimeline).where(and(eq(studentTimeline.id, input.id), eq(studentTimeline.organizationId, orgId), eq(studentTimeline.userId, ctx.user.id)));
      return { success: true };
    }),
    getSummary: protectedProcedure.input(z.object({ studentId: z.number() })).query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const timelineEvents = await db.select().from(studentTimeline).where(and(eq(studentTimeline.studentId, input.studentId), eq(studentTimeline.userId, ctx.user.id)));
      const studentLessons = await db.select().from(lessons).where(and(eq(lessons.studentId, input.studentId as number), eq(lessons.userId, ctx.user.id)));
      
      const grades = timelineEvents.map(e => e.grade).filter(g => g !== null).map(Number);
      const averageGrade = grades.length > 0 ? grades.reduce((a, b) => a + b, 0) / grades.length : 0;
      
      const completedLessons = studentLessons.filter(l => l.status === 'concluida');
      const missedLessons = studentLessons.filter(l => l.status === 'falta');
      
      const frequency = (completedLessons.length + missedLessons.length) > 0 
        ? (completedLessons.length / (completedLessons.length + missedLessons.length)) * 100 
        : 100;
        
      const totalTimeMinutes = completedLessons.reduce((acc, lesson) => acc + (lesson.duration || 60), 0);
        
      return {
        averageGrade: Number(averageGrade.toFixed(1)),
        completedCount: completedLessons.length,
        frequency: Math.round(frequency),
        totalTimeMinutes,
        lastLesson: completedLessons.length > 0 ? completedLessons.sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime())[0].scheduledAt : null
      };
    }),
    generateAIInsight: protectedProcedure.input(z.object({ studentId: z.number() })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const orgId = ctx.user.organizationId!;
      const [student] = await db.select().from(students).where(and(eq(students.id, input.studentId as number), eq(students.organizationId, orgId)));
      if (!student) throw new Error("Aluno não encontrado");
      const pastLessons = await db.select().from(lessons).where(and(eq(lessons.studentId, input.studentId as number), eq(lessons.organizationId, orgId), eq(lessons.status, 'concluida'))).limit(10).orderBy(desc(lessons.scheduledAt));
      const goals = await db.select().from(studentGoals).where(and(eq(studentGoals.studentId, input.studentId), eq(studentGoals.organizationId, orgId)));
      
      const prompt = `Analise o progresso musical do aluno ${student.name} (nível: ${student.level}). Últimas aulas: ${pastLessons.length} concluídas. Metas cadastradas: ${goals.length}. Dê um feedback motivador e com 2 pontos de foco para as próximas aulas em um único parágrafo pequeno.`;
      
      try {
        const { callGemini } = await import("../utils/gemini");
        const { getSettingsByUserId } = await import("../db");
        const settingsData = await getSettingsByUserId(orgId, ctx.user.id);
        const apiKey = settingsData?.aiProvider === 'groq' ? settingsData?.groqApiKey : settingsData?.geminiApiKey;
        const model = settingsData?.aiProvider === 'groq' ? settingsData?.groqModel : settingsData?.geminiModel;
        
        const responseText = await callGemini([{ role: 'user', content: prompt }], undefined, false, apiKey, model);
        return { insight: responseText.trim() };
      } catch (e) {
        console.error("Erro ao gerar insight:", e);
        return { insight: "O aluno tem se saído bem nas últimas aulas. Foco em melhorar a constância na prática diária e avançar nas metas de repertório." }; // Fallback
      }
    }),
    suggestNextLessonTopic: protectedProcedure.input(z.object({ studentId: z.number() })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const orgId = ctx.user.organizationId!;
      
      const [student] = await db.select().from(students).where(and(eq(students.id, input.studentId), eq(students.organizationId, orgId)));
      if (!student) throw new Error("Aluno não encontrado");
      
      const pastLessons = await db.select().from(lessons).where(and(eq(lessons.studentId, input.studentId), eq(lessons.organizationId, orgId), eq(lessons.status, 'concluida'))).limit(5).orderBy(desc(lessons.scheduledAt));
      const goals = await db.select().from(studentGoals).where(and(eq(studentGoals.studentId, input.studentId), eq(studentGoals.organizationId, orgId)));
      const timeline = await db.select().from(studentTimeline).where(and(eq(studentTimeline.studentId, input.studentId), eq(studentTimeline.organizationId, orgId))).limit(10).orderBy(desc(studentTimeline.achievedAt));

      const timelineText = timeline.map(t => "[" + t.category + "] " + t.title + " - " + t.description).join(" | ");

      const prompt = `Atue como um professor mentor. Analise o histórico do aluno ${student.name} (Nível: ${student.level}) e sugira qual deve ser o ASSUNTO PRINCIPAL da próxima aula.

Histórico do Aluno:
- Últimas ${pastLessons.length} aulas concluídas.
- Metas pendentes/ativas: ${goals.map(g => g.title).join(", ") || "Nenhuma"}
- Timeline recente de evolução: ${timelineText || "Nenhum registro"}

Forneça APENAS um parágrafo curto (máx 3 linhas) explicando diretamente qual o melhor assunto/foco para a próxima aula e por que. Não use saudações, vá direto ao ponto.`;
      
      try {
        const { callGemini } = await import("../utils/gemini");
        const { getSettingsByUserId } = await import("../db");
        const settingsData = await getSettingsByUserId(orgId, ctx.user.id);
        const apiKey = settingsData?.aiProvider === 'groq' ? settingsData?.groqApiKey : settingsData?.geminiApiKey;
        const model = settingsData?.aiProvider === 'groq' ? settingsData?.groqModel : settingsData?.geminiModel;
        const responseText = await callGemini([{ role: 'user', content: prompt }], undefined, false, apiKey, model);
        return { suggestion: responseText.trim() };
      } catch (e: any) {
        throw new Error("Erro ao sugerir tópico com a IA: " + e.message);
      }
    }),

    uploadMethodologyPdf: protectedProcedure.input(z.object({
      studentId: z.number(),
      filename: z.string(),
      pdfBase64: z.string(),
    })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const orgId = ctx.user.organizationId!;
      
      const [student] = await db.select().from(students).where(and(eq(students.id, input.studentId), eq(students.organizationId, orgId)));
      if (!student) throw new Error("Aluno não encontrado");

      try {
        const pdfParseModule = await import('pdf-parse');
        const pdfParse = (pdfParseModule as any).default || pdfParseModule;
        const buffer = Buffer.from(input.pdfBase64.replace(/^data:application\/pdf;base64,/, ""), 'base64');
        const data = await pdfParse(buffer);
        
        await db.update(students).set({
          methodologyFilename: input.filename,
          methodologyText: data.text
        }).where(eq(students.id, student.id));

        return { success: true };
      } catch (e: any) {
        throw new Error("Erro ao processar PDF: " + e.message);
      }
    }),

    removeMethodology: protectedProcedure.input(z.object({
      studentId: z.number()
    })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return;
      const orgId = ctx.user.organizationId!;
      await db.update(students).set({
        methodologyFilename: null,
        methodologyText: null
      }).where(and(eq(students.id, input.studentId), eq(students.organizationId, orgId)));
      return { success: true };
    }),

    generateNextLessonPlan: protectedProcedure.input(z.object({ studentId: z.number(), topic: z.string().optional() })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const orgId = ctx.user.organizationId!;
      
      const [student] = await db.select().from(students).where(and(eq(students.id, input.studentId), eq(students.organizationId, orgId)));
      if (!student) throw new Error("Aluno não encontrado");
      
      const pastLessons = await db.select().from(lessons).where(and(eq(lessons.studentId, input.studentId), eq(lessons.organizationId, orgId), eq(lessons.status, 'concluida'))).limit(5).orderBy(desc(lessons.scheduledAt));
      const goals = await db.select().from(studentGoals).where(and(eq(studentGoals.studentId, input.studentId), eq(studentGoals.organizationId, orgId)));
      const timeline = await db.select().from(studentTimeline).where(and(eq(studentTimeline.studentId, input.studentId), eq(studentTimeline.organizationId, orgId))).limit(10).orderBy(desc(studentTimeline.achievedAt));

      const timelineText = timeline.map(t => "[" + t.category + "] " + t.title + " - " + t.description).join(" | ");

      const prompt = `Você é um professor de música gerando um plano de aula particular para a PRÓXIMA AULA do aluno ${student.name} (Nível: ${student.level}). Escreva obrigatoriamente em Português do Brasil (pt-BR) com um tom natural, humano e caloroso. A linguagem deve ser extremamente simples, didática e de fácil compreensão, focada em alunos iniciantes com dificuldade, sem jargões complexos nem tons robóticos.
${student.methodologyText ? `\nMETODOLOGIA DE ENSINO DO PROFESSOR:\nBaseie seus exercícios rigorosamente nesta metodologia definida para este aluno:\n"""\n${student.methodologyText}\n"""\n` : ''}
Histórico do Aluno:
- Últimas ${pastLessons.length} aulas concluídas.
- Metas pendentes/ativas: ${goals.map(g => g.title).join(", ") || "Nenhuma"}
- Timeline recente de evolução: ${timelineText || "Nenhum registro"}

${input.topic ? `O professor definiu que o TÓPICO PRINCIPAL DESTA AULA DEVE SER: "${input.topic}". Crie o plano focado neste assunto.` : 'Decida o próximo assunto a ser tratado e sugira exercícios apropriados para o nível dele com base no histórico.'}

Sua resposta será exibida em uma interface de texto puro. Portanto, NÃO UTILIZE MARKDOWN (como asteriscos **, hashtags # ou traços ---).

Siga EXATAMENTE o template abaixo, usando emojis como âncoras visuais, hífens para listas e pulando uma linha em branco entre cada bloco de conteúdo para garantir a legibilidade.
${!input.topic ? 'Decida o próximo assunto a ser tratado e sugira exercícios apropriados para o nível dele com base no histórico.' : ''}

[INÍCIO DO TEMPLATE]

🎸 PLANO DE AULA: [Título Curto e Direto]

👤 Aluno: ${student.name} | 📊 Nível: ${student.level}

🎯 OBJETIVO DA AULA
[Escreva em 2 ou 3 linhas o objetivo principal da aula de forma clara e motivadora].

⏱️ 1. AQUECIMENTO ([X] min)

[Nome do Exercício]: [Instrução breve].

[Foco]: [O que o aluno deve prestar atenção].

🧠 2. TÉCNICA E TEORIA ([X] min)

[Tópico 1]: [Explicação ou exercício prático].

[Tópico 2]: [Explicação ou exercício prático].

🎵 3. PRÁTICA MUSICAL ([X] min)

[Música/Trecho]: [O que tocar e como aplicar o que foi aprendido].

📝 TAREFA DE CASA

[Resumo rápido do que o aluno deve praticar até a próxima aula].

[FIM DO TEMPLATE]`;
      
      try {
        const { callGemini } = await import("../utils/gemini");
        const { getSettingsByUserId } = await import("../db");
        const settingsData = await getSettingsByUserId(orgId, ctx.user.id);
        const apiKey = settingsData?.aiProvider === 'groq' ? settingsData?.groqApiKey : settingsData?.geminiApiKey;
        const model = settingsData?.aiProvider === 'groq' ? settingsData?.groqModel : settingsData?.geminiModel;
        const responseText = await callGemini([{ role: 'user', content: prompt }], undefined, false, apiKey, model);
        return { plan: responseText };
      } catch (e: any) {
        throw new Error("Erro ao gerar plano de aula com a IA: " + e.message);
      }
    }),

    generateDailyStudyPlan: protectedProcedure.input(z.object({
      studentId: z.number(),
      targetMinutes: z.number().min(10).max(120).optional().default(30),
      teacherNotes: z.string().max(500).optional(),
    })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const orgId = ctx.user.organizationId!;
      const totalMinutes = input.targetMinutes ?? 30;

      // ── 1. BUSCA DO ALUNO (com isolamento por organização) ──────────────────
      const [student] = await db
        .select()
        .from(students)
        .where(and(eq(students.id, input.studentId), eq(students.organizationId, orgId)));
      if (!student) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Aluno não encontrado ou sem permissão de acesso." });
      }

      // ── 2. BUSCA DO INSTRUMENTO ──────────────────────────────────────────────
      let instrumentName = "instrumento não especificado";
      let instrumentCategory = "geral";
      if (student.instrumentId) {
        const [instrument] = await db
          .select({ name: instruments.name, category: instruments.category })
          .from(instruments)
          .where(eq(instruments.id, student.instrumentId));
        if (instrument) {
          instrumentName = instrument.name;
          instrumentCategory = (instrument.category || "geral").toLowerCase();
        }
      }

      // ── 3. CONTEXTO PEDAGÓGICO DO INSTRUMENTO ───────────────────────────────
      const { context: instrContext } = getInstrumentContext(instrumentName, instrumentCategory);

      const studentLevel = student.level || "iniciante";
      const levelKey = (studentLevel === "avancado" || studentLevel === "avançado")
        ? "avancado"
        : (studentLevel === "intermediario" || studentLevel === "intermediário")
          ? "intermediario"
          : "iniciante";

      const levelHint = instrContext.levelHints[levelKey];
      const terminologyBlock = instrContext.terminology.length > 0
        ? `Termos CORRETOS para este instrumento: ${instrContext.terminology.join(", ")}.`
        : "";
      const forbiddenBlock = instrContext.forbiddenTerms.length > 0
        ? `PROIBIDO usar estes termos (são de outros instrumentos): ${instrContext.forbiddenTerms.join(", ")}.`
        : "";

      // ── 4. BUSCA PARALELA DE DADOS DE CONTEXTO ──────────────────────────────
      const [pastLessons, goals, timeline, pedagogicalMemoryRows] = await Promise.all([
        db.select({
          title: lessons.title,
          notes: lessons.notes,
          rating: lessons.rating,
          scheduledAt: lessons.scheduledAt,
        })
          .from(lessons)
          .where(and(
            eq(lessons.studentId, input.studentId),
            eq(lessons.organizationId, orgId),
            eq(lessons.status, "concluida")
          ))
          .orderBy(desc(lessons.scheduledAt))
          .limit(10),

        db.select()
          .from(studentGoals)
          .where(and(
            eq(studentGoals.studentId, input.studentId),
            eq(studentGoals.organizationId, orgId),
            eq(studentGoals.status, "pendente")
          )),

        db.select({
          title: studentTimeline.title,
          category: studentTimeline.category,
          description: studentTimeline.description,
          grade: studentTimeline.grade,
        })
          .from(studentTimeline)
          .where(and(
            eq(studentTimeline.studentId, input.studentId),
            eq(studentTimeline.organizationId, orgId)
          ))
          .orderBy(desc(studentTimeline.achievedAt))
          .limit(10),

        db.select()
          .from(studentPedagogicalMemory)
          .where(and(
            eq(studentPedagogicalMemory.studentId, input.studentId),
            eq(studentPedagogicalMemory.organizationId, orgId)
          ))
          .limit(1)
          .catch((err) => {
            console.warn("[generateDailyStudyPlan] Falha não impeditiva ao consultar studentPedagogicalMemory:", err?.message || err);
            return [];
          }),
      ]);

      // ── 5. FORMATAÇÃO DOS DADOS DE CONTEXTO ─────────────────────────────────
      const hasGoals = goals.length > 0;
      const weeklyGoalsText = hasGoals
        ? goals.map((g, idx) => `[META ${idx + 1}] ${g.title}${g.description ? `\n   Descrição/Detalhes da meta: ${g.description}` : ""}`).join("\n")
        : "⚠️ NENHUMA META CADASTRADA. Baseie o plano estritamente nos fundamentos técnicos essenciais do instrumento e nível.";

      const lessonsText = pastLessons.length > 0
        ? pastLessons.map(l =>
            `- "${l.title}"` +
            (l.rating ? ` (nota: ${l.rating}/5)` : "") +
            (l.notes ? ` | obs: ${l.notes}` : "")
          ).join("\n")
        : "Nenhuma aula concluída registrada ainda.";

      const timelineText = timeline.length > 0
        ? timeline.map(t =>
            `[${t.category}] ${t.title}` +
            (t.grade ? ` (nota: ${t.grade})` : "") +
            (t.description ? ` — ${t.description}` : "")
          ).join("\n")
        : "Nenhum registro de conquistas anteriores.";

      let pedagogicalMemoryBlock = "";
      const mem = pedagogicalMemoryRows[0];
      if (mem) {
        let strongPoints: string[] = [];
        let weakPoints: string[] = [];
        let repertoireLearning: string[] = [];
        try {
          strongPoints = JSON.parse(mem.strongPoints || "[]") as string[];
          weakPoints = JSON.parse(mem.weakPoints || "[]") as string[];
          repertoireLearning = JSON.parse(mem.repertoireLearning || "[]") as string[];
        } catch (parseErr) {
          console.warn("[generateDailyStudyPlan] Erro ao parsear JSON da memória pedagógica:", parseErr);
        }

        if (strongPoints.length > 0 || weakPoints.length > 0 || repertoireLearning.length > 0) {
          pedagogicalMemoryBlock = `
# 🧠 MEMÓRIA PEDAGÓGICA (Ajuste a dificuldade técnica da meta)
- Pontos fortes: ${strongPoints.length > 0 ? strongPoints.join(", ") : "Não identificados"}
- Dificuldades recorrentes: ${weakPoints.length > 0 ? weakPoints.join(", ") : "Não identificadas"}
- Repertório em aprendizado: ${repertoireLearning.length > 0 ? repertoireLearning.join(", ") : "Nenhum registrado"}
${mem.pedagogicalDirectives ? `- Diretriz pedagógica: ${mem.pedagogicalDirectives}` : ""}
`;
        }
      }

      const instrumentWarning = !student.instrumentId
        ? "\n⚠️ ATENÇÃO: Instrumento não cadastrado no perfil. Crie um plano genérico de desenvolvimento musical.\n"
        : "";
      const goalsWarning = !hasGoals
        ? "\n⚠️ ATENÇÃO: Nenhuma meta cadastrada. No campo 'importantMessage', oriente o professor a cadastrar as metas do aluno na aba Progresso.\n"
        : "";
      const teacherNotesBlock = input.teacherNotes
        ? `\n# 📝 OBSERVAÇÃO ADICIONAL DO PROFESSOR SOBRE A META\n"${input.teacherNotes.substring(0, 500)}"\n`
        : "";

      // ── 6. CÁLCULO DOS BLOCOS DE TEMPO ──────────────────────────────────────
      const warmMin = totalMinutes <= 15
        ? Math.max(2, Math.round(totalMinutes * 0.25))
        : Math.max(5, Math.round(totalMinutes * 0.2));
      const challengeMin = totalMinutes <= 15
        ? Math.max(2, Math.round(totalMinutes * 0.25))
        : Math.max(5, Math.round(totalMinutes * 0.2));
      const mainMin = Math.max(5, totalMinutes - warmMin - challengeMin);

      // ── 7. JSON SCHEMA DE SAÍDA ──────────────────────────────────────────────
      const jsonSchemaFormat = `{
  "instrument": "${instrumentName}",
  "level": "${studentLevel}",
  "weeklyGoal": "Resumo musical objetivo da semana focado estritamente na(s) meta(s) de ${instrumentName}.",
  "importantMessage": "Dica prática de postura, técnica ou pulso para ${instrumentName} no nível ${studentLevel}.",
  "targetDailyMinutes": ${totalMinutes},
  "days": [
    {
      "dayName": "Dia 1",
      "focus": {
        "title": "Título pedagógico do foco do Dia 1 (ex: Memória Muscular e Ataque do Acorde de D)",
        "description": "Explicação clara em 2 frases sobre o objetivo técnico exato deste dia."
      },
      "exercises": [
        {
          "title": "Aquecimento",
          "subtitle": "Subtítulo musical específico deste dia (ex: Agilidade e Abertura de Dedos em D)",
          "duration": "${warmMin} min",
          "points": [
            "Passo 1 de aquecimento detalhando dedos, notas e postura.",
            "Passo 2 com contagem e observação de relaxamento."
          ],
          "icon": "music"
        },
        {
          "title": "Prática Principal",
          "subtitle": "Subtítulo musical específico da prática (ex: Montagem Instantânea e Ataque Simultâneo)",
          "duration": "${mainMin} min",
          "points": [
            "Bloco 1 (5 min): Passo a passo detalhado de posicionamento (dedos, notas, cordas/teclas) e teste de clareza das notas.",
            "Bloco 2 (7 min): Treino mecânico de repetições com metrônomo (ex: 3 séries de 10 repetições a 60 BPM).",
            "Bloco 3 (6 min): Aplicação rítmica contínua (ex: levada em 4 tempos ou transição sem parar o pulso)."
          ],
          "icon": "star"
        },
        {
          "title": "Teoria ou Desafio",
          "subtitle": "Subtítulo do desafio (ex: Teste de Memória Tátil de Olhos Fechados)",
          "duration": "${challengeMin} min",
          "points": [
            "Desafio prático e mensurável para testar o domínio da meta.",
            "Critério objetivo de acerto (ex: acertar 3 vezes seguidas sem errar nenhuma nota)."
          ],
          "icon": "pen"
        }
      ]
    }
  ]
}`;

      // ── 8. CONSTRUÇÃO DO PROMPT MULTI-INSTRUMENTO PEDAGÓGICO DE ALTA PERFORMANCE ──
      const prompt = `# 🎼 MusicPro AI — Personal Trainer Pedagógico de ${instrumentName.toUpperCase()}

Você é um mestre da pedagogia musical e professor de **${instrumentName}** (nível: **${studentLevel}**).
Sua missão é criar uma rotina de treino diário de 5 dias, **prática, altamente engajadora, rica em detalhes de execução e focada EXCLUSIVAMENTE nas METAS CADASTRADAS**.
${instrumentWarning}${goalsWarning}
---

# 🎯 METAS DA SEMANA (FIO CONDUTOR EXCLUSIVO E OBRIGATÓRIO)
${weeklyGoalsText}

---

# 🎸 DIRETRIZES TÉCNICAS E HARMONIA PARA: ${instrumentName.toUpperCase()}
${terminologyBlock}
${forbiddenBlock}

### REGRAS ESPECÍFICAS DE INSTRUMENTO:
- **Teclado / Piano:**
  * Os acordes e tríades são formados na mão direita (ex: dedos 1-3-5 ou 1-2-4), enquanto a mão esquerda toca o baixo/fundamental (dedo 5 ou 1-5).
  * **NUNCA** coloque um acorde isolado na mão direita e outro acorde isolado na mão esquerda em dias separados. Ambos os acordes devem ser treinados na mão de harmonia (direita) com seus respectivos baixos na mão esquerda.
  * Para trocas de acordes, ensine o princípio do movimento mínimo de dedos e antecipação mental.
- **Violão / Guitarra:**
  * Especifique cordas, casas e dedos (1-Indicador, 2-Médio, 3-Anelar, 4-Mínimo). Detalhe a levada da mão direita (ritmo/batida/dedilhado).
- **Canto:**
  * Exercícios de apoio diafragmático, ressonância, vocalizes em semitons ("Brrr", "Trrr", "Voz de cabeça") aplicados à melodia da meta.
- **Bateria:**
  * Rudimentos, coordenação motora bumbo-caixa-chimbal e contagem vocalizada (1 e 2 e 3 e 4 e).

---

# 📈 PROGRESSÃO PEDAGÓGICA OBRIGATÓRIA DOS 5 DIAS:
- **Dia 1 — Mecânica & Memória Muscular (Elemento A):** Posicionamento perfeito dos dedos, clareza sonora das notas e memorização da forma.
- **Dia 2 — Mecânica & Memória Muscular (Elemento B ou aprofundamento):** Segundo acorde/técnica da meta com baixo e estabilidade.
- **Dia 3 — A Conexão e Transição (Troca Rápida):** Técnica de troca sem perder o pulso do metrônomo (treino lento de antecipação e deslocamento de dedos).
- **Dia 4 — Levada & Ritmo Aplicado:** Aplicação de uma levada rítmica real (ex: levada pop 4/4, batida com baixo alternado ou dedilhado) sobre a meta.
- **Dia 5 — Performance Contínua & Resistência:** Desafio de tocar a progressão/meta em loop contínuo por vários compassos sem hesitações.

---

# ⏱️ ESTRUTURA REAL DO TEMPO: ${totalMinutes} MINUTOS POR DIA
Para cada um dos 5 dias:
- **Aquecimento (${warmMin} min):** 2 passos de aquecimento com dedilhado, escala curta ou relaxamento muscular.
- **Prática Principal (${mainMin} min):** DEVE ser dividida em 3 Blocos de tempo reais que somam ${mainMin} min:
  * "Bloco 1 (5 min): ..."
  * "Bloco 2 (7 min): ..."
  * "Bloco 3 (6 min): ..."
- **Teoria ou Desafio (${challengeMin} min):** 1 desafio com critério claro de aprovação.
A soma de cada dia DEVE ser exatamente ${totalMinutes} minutos.

---
${teacherNotesBlock}
${pedagogicalMemoryBlock}
# 📚 HISTÓRICO DE AULAS (Referência de nível)
${lessonsText}

---

# ⚠️ REGRAS ABSOLUTAS:
1. **NUNCA COLOQUE NOME DE ALUNO/PESSOA NO PLANO.** Use linguagem direta e impessoal.
2. **NUNCA USE SUBTÍTULOS GENÉRICOS OU METALINGUAGEM.** Subtítulos como "Execução direta e detalhada da meta cadastrada" ou "Preparação dos músculos/dedos" são PROIBIDOS. Crie subtítulos musicais reais.
3. **FOCO 100% FECHADO NAS METAS.** É proibido inventar matérias ou repertórios fora das metas cadastradas.
4. **TODOS OS EXERCÍCIOS DEVEM SER ESPECÍFICOS PARA ${instrumentName.toUpperCase()}.**

---

# 📤 FORMATO DE SAÍDA
Retorne SOMENTE o JSON válido abaixo com EXATAMENTE 5 objetos em "days" (um por dia), sem texto antes ou depois, sem blocos markdown fora do JSON.

${jsonSchemaFormat}`;

      // ── 9. CHAMADA À IA E PARSING DEFENSIVO ─────────────────────────────────
      try {
        const { callGemini } = await import("../utils/gemini");
        const { getSettingsByUserId } = await import("../db");
        const settingsData = await getSettingsByUserId(orgId, ctx.user.id);
        const apiKey = settingsData?.aiProvider === "groq" ? settingsData?.groqApiKey : settingsData?.geminiApiKey;
        const model = settingsData?.aiProvider === "groq" ? settingsData?.groqModel : settingsData?.geminiModel;

        if (!apiKey) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Chave de API da IA não configurada. Acesse Configurações > Inteligência Artificial.",
          });
        }

        const responseText = await callGemini([{ role: "user", content: prompt }], undefined, true, apiKey, model);

        // Parsing defensivo: tenta JSON direto, depois extrai bloco JSON por regex
        let parsedPlan: any;
        let cleanedText = responseText.trim();
        cleanedText = cleanedText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

        try {
          parsedPlan = JSON.parse(cleanedText);
        } catch {
          const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              parsedPlan = JSON.parse(jsonMatch[0]);
            } catch {
              throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: "A IA retornou um plano em formato inválido. Tente gerar novamente.",
              });
            }
          } else {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "A IA retornou um plano em formato inválido. Tente gerar novamente.",
            });
          }
        }

        if (!parsedPlan || !Array.isArray(parsedPlan.days) || parsedPlan.days.length === 0) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "A IA não gerou os dias de treino corretamente. Tente gerar novamente.",
          });
        }

        if (parsedPlan.days.length < 5) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `A IA gerou apenas ${parsedPlan.days.length} dia(s) de treino (esperado: 5). Tente gerar novamente.`,
          });
        }

        // Garante campos de rastreabilidade
        parsedPlan.instrument = parsedPlan.instrument || instrumentName;
        parsedPlan.level = parsedPlan.level || studentLevel;

        // Aviso de metas ou instrumento não configurados no campo importantMessage
        if (!hasGoals) {
          parsedPlan.importantMessage =
            (parsedPlan.importantMessage || "") +
            " ⚠️ Professor: cadastre as metas deste aluno na aba Progresso para personalizar o treino nos 5 dias.";
        }
        if (!student.instrumentId) {
          parsedPlan.importantMessage =
            (parsedPlan.importantMessage || "") +
            " ⚠️ Professor: cadastre o instrumento deste aluno para planos mais precisos.";
        }

        const finalPlanText = JSON.stringify(parsedPlan);

        // ── 10. PERSISTÊNCIA NO BANCO (como rascunho) ──────────────────────────
        const [inserted] = await db
          .insert(dailyStudyPlans)
          .values({
            organizationId: orgId,
            studentId: input.studentId,
            teacherId: ctx.user.id,
            planText: finalPlanText,
            status: "ativo",
            publishedStatus: "rascunho",
            daysCompleted: JSON.stringify([false, false, false, false, false]),
          })
          .returning({ id: dailyStudyPlans.id });

        return { plan: finalPlanText, planId: inserted.id };
      } catch (e: any) {
        if (e instanceof TRPCError) throw e;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erro ao gerar plano de estudo com a IA: " + (e.message || "Erro desconhecido"),
        });
      }
    }),


    getActiveStudyPlan: studentProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [plan] = await db.select()
        .from(dailyStudyPlans)
        .where(and(
          eq(dailyStudyPlans.studentId, ctx.user.studentId!), 
          eq(dailyStudyPlans.status, 'ativo'),
          eq(dailyStudyPlans.publishedStatus, 'publicado')
        ))
        .orderBy(desc(dailyStudyPlans.createdAt))
        .limit(1);
      return plan || null;
    }),

    toggleStudyPlanDay: studentProcedure.input(z.object({ planId: z.number(), dayIndex: z.number().min(0).max(4), timeSpentSeconds: z.number().optional() })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const [plan] = await db.select().from(dailyStudyPlans).where(and(eq(dailyStudyPlans.id, input.planId), eq(dailyStudyPlans.studentId, ctx.user.studentId!)));
      if (!plan) throw new Error("Plano não encontrado");

      const parsedDays = JSON.parse((plan.daysCompleted as string) || "[]");
      const daysCompleted = Array.isArray(parsedDays) ? parsedDays.map(Boolean) : [false, false, false, false, false];
      
      const parsedTime = JSON.parse((plan.daysTimeSpent as string) || "[]");
      const daysTimeSpent = Array.isArray(parsedTime) ? parsedTime.map(Number) : [0, 0, 0, 0, 0];
      
      // Ensure it always has exactly 5 days
      while (daysCompleted.length < 5) daysCompleted.push(false);
      if (daysCompleted.length > 5) daysCompleted.length = 5;

      while (daysTimeSpent.length < 5) daysTimeSpent.push(0);
      if (daysTimeSpent.length > 5) daysTimeSpent.length = 5;

      if (input.dayIndex >= 0 && input.dayIndex < 5) {
        daysCompleted[input.dayIndex] = !daysCompleted[input.dayIndex];
        if (daysCompleted[input.dayIndex] && input.timeSpentSeconds) {
          daysTimeSpent[input.dayIndex] = input.timeSpentSeconds;
        } else if (!daysCompleted[input.dayIndex]) {
          daysTimeSpent[input.dayIndex] = 0;
        }
      }

      // Check if all 5 days are actually true
      const allCompleted = daysCompleted.every(Boolean);

      await db.update(dailyStudyPlans)
        .set({ 
          daysCompleted: JSON.stringify(daysCompleted),
          daysTimeSpent: JSON.stringify(daysTimeSpent),
          updatedAt: new Date(),
          ...(allCompleted ? { completedAt: new Date() } : {})
        })
        .where(eq(dailyStudyPlans.id, plan.id));

      if (allCompleted) {
        // Envia notificação no painel do professor (Semana completa)
        await db.insert(notifications).values({
          organizationId: plan.organizationId,
          userId: plan.teacherId,
          title: "Semana Gabaritada! 🎸",
          message: `O aluno ${ctx.user.name} concluiu os 5 dias de treino do plano de estudos!`,
          type: "success",
          actionUrl: `/alunos/${ctx.user.studentId}`,
        });

        // Envia notificação PUSH para o aparelho do professor (Sem await para não travar a resposta)
        notifyUser(plan.teacherId, {
          title: "Semana Gabaritada! 🎸",
          content: `O aluno ${ctx.user.name} concluiu os 5 dias de treino do plano de estudos!`,
        }).catch(e => console.error("Falha ao enviar push notification:", e));
      } else if (input.dayIndex >= 0 && input.dayIndex < 5 && daysCompleted[input.dayIndex]) {
        // Envia notificação diária quando o aluno marca um dia
        await db.insert(notifications).values({
          organizationId: plan.organizationId,
          userId: plan.teacherId,
          title: "Treino Concluído! 🎸",
          message: `O aluno ${ctx.user.name} concluiu o treino do dia!`,
          type: "success",
          actionUrl: `/alunos/${ctx.user.studentId}`,
        });

        notifyUser(plan.teacherId, {
          title: "Treino Concluído! 🎸",
          content: `O aluno ${ctx.user.name} concluiu o treino do dia!`,
        }).catch(e => console.error("Falha ao enviar push notification:", e));
      }

      return { success: true, allCompleted };
    }),

    editStudyPlanText: studentProcedure.input(z.object({ planId: z.number(), planText: z.string() })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const [plan] = await db.select().from(dailyStudyPlans).where(and(eq(dailyStudyPlans.id, input.planId), eq(dailyStudyPlans.studentId, ctx.user.studentId!)));
      if (!plan) throw new Error("Plano não encontrado");

      await db.update(dailyStudyPlans)
        .set({ planText: input.planText, updatedAt: new Date() })
        .where(eq(dailyStudyPlans.id, plan.id));

      return { success: true };
    }),

    publishStudyPlan: protectedProcedure.input(z.object({ planId: z.number(), studentId: z.number() })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const orgId = ctx.user.organizationId!;
      const isUserAdmin = ctx.user.role === 'admin' || ctx.user.openId === ENV.ownerOpenId;

      // MÉDIO-13 FIX: Validar que o studentId pertence ao professor que está publicando.
      // Sem isso, um professor poderia invalidar planos de alunos de outros professores.
      const [ownedStudent] = await db.select({ id: students.id })
        .from(students)
        .where(and(
          eq(students.id, input.studentId),
          eq(students.organizationId, orgId),
          isUserAdmin ? undefined : eq(students.professorId, ctx.user.id)
        ))
        .limit(1);

      if (!ownedStudent) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Você não tem permissão para publicar planos deste aluno.'
        });
      }

      // Invalida planos antigos do aluno (publicados e ativos) — apenas desta organização
      await db.update(dailyStudyPlans)
        .set({ status: 'inativo' })
        .where(and(
          eq(dailyStudyPlans.studentId, input.studentId),
          eq(dailyStudyPlans.organizationId, orgId),
          eq(dailyStudyPlans.status, 'ativo'),
          eq(dailyStudyPlans.publishedStatus, 'publicado')
        ));

      // Publica o plano atual
      await db.update(dailyStudyPlans)
        .set({ publishedStatus: 'publicado' })
        .where(and(eq(dailyStudyPlans.id, input.planId), eq(dailyStudyPlans.organizationId, orgId)));

      return { success: true };
    }),

    updateStudyPlan: protectedProcedure.input(z.object({ planId: z.number(), planText: z.string() })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const orgId = ctx.user.organizationId!;

      try {
        JSON.parse(input.planText);
      } catch (e) {
        throw new Error("O plano editado não é um JSON válido. Verifique se as aspas e chaves estão corretas.");
      }

      await db.update(dailyStudyPlans)
        .set({ planText: input.planText, updatedAt: new Date() })
        .where(and(eq(dailyStudyPlans.id, input.planId), eq(dailyStudyPlans.organizationId, orgId)));

      return { success: true };
    }),

    unpublishStudyPlan: protectedProcedure.input(z.object({ planId: z.number() })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const orgId = ctx.user.organizationId!;

      await db.update(dailyStudyPlans)
        .set({ publishedStatus: 'rascunho' })
        .where(and(eq(dailyStudyPlans.id, input.planId), eq(dailyStudyPlans.organizationId, orgId)));

      return { success: true };
    }),

    deleteStudyPlan: protectedProcedure.input(z.object({ planId: z.number() })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const orgId = ctx.user.organizationId!;

      await db.delete(dailyStudyPlans)
        .where(and(
          eq(dailyStudyPlans.id, input.planId),
          eq(dailyStudyPlans.organizationId, orgId)
        ));

      return { success: true };
    }),

    getStudentPlanHistory: protectedProcedure.input(z.object({ studentId: z.number() })).query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const orgId = ctx.user.organizationId!;

      const history = await db.select()
        .from(dailyStudyPlans)
        .where(and(
          eq(dailyStudyPlans.studentId, input.studentId),
          eq(dailyStudyPlans.organizationId, orgId)
        ))
        .orderBy(desc(dailyStudyPlans.createdAt));

      return history;
    }),

    getStudentPlanForTeacher: protectedProcedure.input(z.object({ studentId: z.number() })).query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const orgId = ctx.user.organizationId!;

      const [plan] = await db.select()
        .from(dailyStudyPlans)
        .where(and(
          eq(dailyStudyPlans.studentId, input.studentId),
          eq(dailyStudyPlans.organizationId, orgId),
          eq(dailyStudyPlans.status, 'ativo')
        ))
        .orderBy(desc(dailyStudyPlans.createdAt))
        .limit(1);

      return plan || null;
    }),


    sendPlanViaWhatsApp: protectedProcedure.input(z.object({ 
      studentId: z.number(), 
      planText: z.string(),
      type: z.enum(["aula", "diario"])
    })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const orgId = ctx.user.organizationId!;
      
      const [student] = await db.select().from(students).where(and(eq(students.id, input.studentId), eq(students.organizationId, orgId)));
      if (!student) throw new Error("Aluno não encontrado");

      // FIX: Tenta primeiro o telefone do aluno; se não tiver, usa o do responsável.
      // Nunca envia para os dois ao mesmo tempo.
      const targetPhone = student.phone?.trim() || student.guardianPhone?.trim() || null;
      const sendingToGuardian = !student.phone?.trim() && !!student.guardianPhone?.trim();

      if (!targetPhone) {
        throw new Error("Este aluno não tem telefone cadastrado e nem o do responsável. Cadastre um número em Alunos > Editar.");
      }
      
      const [userSettings] = await db.select().from(settings).where(eq(settings.userId, ctx.user.id));
      const botUrl = userSettings?.whatsappBotUrl || process.env.EVOLUTION_API_URL || "http://179.197.76.174:8080";
      const botToken = userSettings?.whatsappBotToken || process.env.EVOLUTION_API_KEY || "minha_chave_secreta_123";

      // Saudão diferenciada: se for para o responsável, menciona o nome do aluno
      const saudacao = sendingToGuardian
        ? (input.type === "aula"
            ? `Olá! Segue o plano de aula de ${student.name} 🎸\n\n`
            : `Olá! Aqui está o cronograma de treino de ${student.name} para essa semana 📅👇\n\n`)
        : (input.type === "aula" 
            ? `Olá ${student.name}! Preparado para a nossa próxima aula? 🎸 Aqui está o que vamos fazer:\n\n`
            : `Olá ${student.name}! Aqui está o seu cronograma de treino para arrebentar essa semana! 📅👇\n\n`);

      let formattedPlanText = input.planText;
      if (input.type === "diario") {
        try {
          const planData = JSON.parse(input.planText);
          let text = `🎯 *Objetivo da semana*: ${planData.weeklyGoal || "Praticar"}\n\n`;
          planData.days?.forEach((day: any) => {
            text += `📅 *${day.dayName}*: ${day.focus?.title}\n`;
            day.exercises?.forEach((ex: any) => {
               text += `  🔹 ${ex.title} (${ex.duration})\n`;
               ex.points?.forEach((p: string) => { text += `    - ${p}\n` });
            });
            text += `\n`;
          });
          if (planData.importantMessage) {
            text += `💡 *Dica*: ${planData.importantMessage}\n`;
          }
          formattedPlanText = text;
        } catch (e) {
          // Caso não seja um JSON (planos antigos), usa o texto original
        }
      }

      const finalMessage = saudacao + formattedPlanText;

      const { sendWhatsAppMessage } = await import("../utils/whatsapp");
      const result = await sendWhatsAppMessage({
        url: botUrl,
        token: botToken,
        phone: targetPhone,
        message: finalMessage,
        sessionId: `prof_${ctx.user.id}`
      });

      if (!result.success) {
        throw new Error("Falha ao enviar mensagem pelo robô: " + result.error);
      }

      return { 
        success: true,
        sentTo: sendingToGuardian ? "guardian" : "student"
      };
    }),
  }),

  musicLibrary: router({
    list: protectedProcedure.input(z.object({ 
      studentId: z.number(),
      category: z.string().optional(),
      search: z.string().optional(),
    })).query(async ({ ctx, input }) => {
      const orgId = ctx.user.organizationId!;
      let whereClause = and(
        eq(studentFiles.organizationId, orgId),
        eq(studentFiles.userId, ctx.user.id),
        eq(studentFiles.studentId, input.studentId)
      );

      if (input.category && input.category !== 'todos') {
        whereClause = and(whereClause, eq(studentFiles.category, input.category as any));
      }

      if (input.search) {
        whereClause = and(whereClause, sql`LOWER(${studentFiles.fileName}) LIKE ${`%${input.search.toLowerCase()}%`}`);
      }

      const db = await getDb();
      if (!db) throw new Error("Database not available");
      return db.select().from(studentFiles)
        .where(whereClause)
        .orderBy(desc(studentFiles.createdAt));
    }),

    create: protectedProcedure.input(z.object({
      studentId: z.number(),
      fileName: z.string(),
      fileType: z.string(),
      category: z.enum(['imagem', 'video', 'pdf', 'audio', 'documento']),
      folder: z.string().optional(),
      fileUrl: z.string(),
      thumbnailUrl: z.string().optional(),
      comments: z.string().optional(),
      size: z.number().optional(),
    })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const orgId = ctx.user.organizationId!;

      const isUserAdmin = ctx.user.role === 'admin' || ctx.user.openId === ENV.ownerOpenId;
      // Security: verify student ownership
      const [ownedStudent] = await db.select({ id: students.id }).from(students)
        .where(and(
          eq(students.id, input.studentId as number), 
          eq(students.organizationId, orgId), 
          isUserAdmin ? undefined : eq(students.professorId, ctx.user.id)
        ))
        .limit(1);
      
      if (!ownedStudent) {
        throw new TRPCError({ code: "FORBIDDEN", message: "O aluno selecionado não existe ou não pertence ao seu perfil." });
      }

      await db.insert(studentFiles).values({
        organizationId: orgId,
        userId: ctx.user.id,
        studentId: input.studentId,
        fileName: input.fileName,
        fileType: input.fileType,
        category: input.category,
        folder: input.folder,
        fileUrl: input.fileUrl,
        thumbnailUrl: input.thumbnailUrl,
        comments: input.comments,
        size: input.size,
      });
      
      return { success: true };
    }),

    upload: protectedProcedure.input(z.object({
      fileName: z.string(),
      fileType: z.string(),
      base64Data: z.string(),
      thumbnailData: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const orgId = ctx.user.organizationId!;

      // CRÍTICO-05 FIX: Validação de MIME type e extensão por whitelist explícita.
      // Impede upload de arquivos executáveis (PHP, JS no servidor, EXE, etc.)
      // mesmo que renomeados com extensão segura.
      const ALLOWED_MIME_TYPES = new Set([
        // Imagens
        'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
        // Áudio
        'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/aac', 'audio/flac', 'audio/m4a', 'audio/mp4',
        // Vídeo
        'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/avi', 'video/mov',
        // Documentos
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        // Texto
        'text/plain',
      ]);

      const ALLOWED_EXTENSIONS = new Set([
        'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg',
        'mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a',
        'mp4', 'webm', 'mov', 'avi',
        'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt',
      ]);

      // TAMANHO MÁXIMO POR TIPO (em bytes)
      const SIZE_LIMITS: Record<string, number> = {
        'image': 10 * 1024 * 1024,  // 10MB para imagens
        'audio': 50 * 1024 * 1024,  // 50MB para áudio
        'video': 200 * 1024 * 1024, // 200MB para vídeo
        'application': 20 * 1024 * 1024, // 20MB para documentos
        'text': 5 * 1024 * 1024,    // 5MB para texto
      };

      // Verificar extensão
      const ext = input.fileName.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || '';
      if (!ALLOWED_EXTENSIONS.has(ext)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Tipo de arquivo não permitido: .${ext}. Formatos aceitos: imagens, áudio, vídeo, PDF e documentos Office.`
        });
      }

      // Verificar MIME type declarado
      const normalizedMime = input.fileType.toLowerCase().split(';')[0].trim();
      if (!ALLOWED_MIME_TYPES.has(normalizedMime)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Tipo de conteúdo não permitido: ${input.fileType}.`
        });
      }

      // Decodificar e verificar tamanho
      const base64 = input.base64Data.includes(',') ? input.base64Data.split(',')[1] : input.base64Data;
      const buffer = Buffer.from(base64, 'base64');

      // Verificar tamanho máximo por categoria de tipo
      const mimeCategory = normalizedMime.split('/')[0];
      const maxSize = SIZE_LIMITS[mimeCategory] || (10 * 1024 * 1024); // padrão 10MB
      if (buffer.length > maxSize) {
        const maxMb = Math.round(maxSize / (1024 * 1024));
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Arquivo muito grande. Tamanho máximo para ${mimeCategory}: ${maxMb}MB.`
        });
      }

      // CRÍTICO-05 FIX: Verificação de magic bytes (assinatura do arquivo binário).
      // Garante que o conteúdo real corresponde ao tipo declarado, mesmo que renomeado.
      const fileSignatureValid = checkFileMagicBytes(buffer, normalizedMime);
      if (!fileSignatureValid) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'O conteúdo do arquivo não corresponde ao tipo declarado. Upload bloqueado por segurança.'
        });
      }

      // Strong sanitization: replace the entire file name with a UUID to prevent path traversal or script execution
      const uuid = crypto.randomUUID();
      const baseKey = `music-library/${orgId}/${ctx.user.id}/${Date.now()}-${uuid}.${ext}`;

      // Upload do arquivo principal (MIME type sanitizado — usa o declarado após validação)
      const { url } = await storagePut(baseKey, buffer, normalizedMime);

      let thumbnailUrl: string | undefined = undefined;
      // Upload da thumbnail se fornecida
      if (input.thumbnailData) {
        const thumbBase64 = input.thumbnailData.includes(',') ? input.thumbnailData.split(',')[1] : input.thumbnailData;
        const thumbBuffer = Buffer.from(thumbBase64, 'base64');

        // Limitar thumbnail a 5MB
        if (thumbBuffer.length > 5 * 1024 * 1024) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Thumbnail muito grande. Máximo: 5MB.' });
        }

        const thumbKey = `${baseKey}-thumb.jpg`;
        const thumbResult = await storagePut(thumbKey, thumbBuffer, 'image/jpeg');
        thumbnailUrl = thumbResult.url;
      }
      
      return { url, thumbnailUrl };
    }),

    update: protectedProcedure.input(z.object({
      id: z.number(),
      comments: z.string().optional(),
      fileName: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const { id, ...data } = input;
      await db.update(studentFiles)
        .set({ ...data, updatedAt: new Date() })
        .where(and(eq(studentFiles.id, id), eq(studentFiles.userId, ctx.user.id)));
      
      return { success: true };
    }),

    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const orgId = ctx.user.organizationId!;
      await db.delete(studentFiles)
        .where(and(eq(studentFiles.id, input.id), eq(studentFiles.organizationId, orgId), eq(studentFiles.userId, ctx.user.id)));
      
      return { success: true };
    }),
    getStats: protectedProcedure.query(async ({ ctx }) => {
      const isUserAdmin = ctx.user.role === 'admin' || ctx.user.openId === ENV.ownerOpenId;
      const orgId = ctx.user.organizationId!;
      return getDashboardStats(orgId, isUserAdmin ? undefined : ctx.user.id);
    }),
    getMonthlyStats: protectedProcedure.query(async ({ ctx }) => {
      const isUserAdmin = ctx.user.role === 'admin' || ctx.user.openId === ENV.ownerOpenId;
      const orgId = ctx.user.organizationId!;
      const stats = await getMonthlyStats(orgId, isUserAdmin ? undefined : ctx.user.id, 12);
      return stats;
    }),
    getExperimentalStats: protectedProcedure.input(z.object({ 
      month: z.number().optional(), 
      year: z.number().optional() 
    }).optional()).query(async ({ ctx, input }) => {
        const isUserAdmin = ctx.user.role === 'admin' || ctx.user.openId === ENV.ownerOpenId;
        const orgId = ctx.user.organizationId!;
        return getExperimentalStats(orgId, isUserAdmin ? undefined : ctx.user.id, input?.month, input?.year);
    }),
    getLessonsByDay: protectedProcedure.query(async ({ ctx }) => {
      const isUserAdmin = ctx.user.role === 'admin' || ctx.user.openId === ENV.ownerOpenId;
      const orgId = ctx.user.organizationId!;
      const data = await getLessonsByDayOfWeek(orgId, isUserAdmin ? undefined : ctx.user.id);
      return data;
    }),
  }),

};

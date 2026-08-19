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
export const aiRouters = {
  ai: router({
    newConversation: protectedProcedure
      .input(z.object({ title: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const orgId = ctx.user.organizationId!;

        const [conversation] = await db.insert(aiConversations).values({
          organizationId: orgId,
          userId: ctx.user.id,
          title: input.title || "Nova Conversa",
          createdAt: new Date(),
        }).returning();

        return conversation;
      }),

    enhanceText: protectedProcedure
      .input(z.object({ text: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const { callGemini } = await import("../utils/gemini");
        const { getSettingsByUserId } = await import("../db");
        const orgId = ctx.user.organizationId!;
        const settingsData = await getSettingsByUserId(orgId, ctx.user.id);
        const apiKey = settingsData?.aiProvider === 'groq' ? settingsData?.groqApiKey : settingsData?.geminiApiKey;
        const model = settingsData?.aiProvider === 'groq' ? settingsData?.groqModel : settingsData?.geminiModel;

        const prompt = `Você é um excelente e prestativo assistente de escrita.
Sua tarefa é reescrever o aviso abaixo, enviado por um professor de música para seus alunos/pais.

OBJETIVO:
O texto deve ser polido, simpático, respeitoso e direto ao ponto.

O QUE EVITAR ABSOLUTAMENTE:
1. Linguagem burocrática, robótica ou jurídica (Ex: "Prezados", "Venho por meio desta", "Atenciosamente", "Espero ansiosamente").
2. Linguagem excessivamente informal, gírias ou expressões estranhas (Ex: "E acredita", "E aí galera", "Mano").
3. Não invente informações que não estão no texto original (se não falou de reunião, não invente).

COMO DEVE SER:
- Claro, empático e caloroso. Como um bom professor falando educadamente no WhatsApp.
- Corrija eventuais erros de português.
- Devolva APENAS o texto reescrito e finalizado, sem adicionar aspas extras, sem comentários.

Texto original para reescrever:
"${input.text}"`;
        const result = await callGemini([{ role: "user", content: prompt }], undefined, false, apiKey, model);
        return { text: result };
      }),

    listConversations: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      const orgId = ctx.user.organizationId!;

      return db.select()
        .from(aiConversations)
        .where(and(eq(aiConversations.userId, ctx.user.id), eq(aiConversations.organizationId, orgId)))
        .orderBy(desc(aiConversations.updatedAt));
    }),

    getMessages: protectedProcedure
      .input(z.object({ conversationId: z.number() }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) return [];
        const orgId = ctx.user.organizationId!;

        // Verificar se a conversa pertence ao usuário
        const [conv] = await db.select({ id: aiConversations.id }).from(aiConversations)
          .where(and(
            eq(aiConversations.id, input.conversationId),
            eq(aiConversations.userId, ctx.user.id),
            eq(aiConversations.organizationId, orgId)
          )).limit(1);

        if (!conv) throw new Error("Conversa não encontrada ou acesso negado");

        return db.select()
          .from(aiMessages)
          .where(eq(aiMessages.conversationId, input.conversationId))
          .orderBy(asc(aiMessages.createdAt));
      }),

    getUsageStats: protectedProcedure.query(async ({ ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

        const DAILY_LIMIT = 10;

        // Início do dia atual em UTC
        const now = new Date();
        const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

        // Buscar todas as conversas do usuário
        const userConversations = await db
          .select({ id: aiConversations.id })
          .from(aiConversations)
          .where(eq(aiConversations.userId, ctx.user.id));

        const convIds = userConversations.map((c) => c.id);

        if (convIds.length === 0) {
          return { usedToday: 0, limit: DAILY_LIMIT, canQuery: true, resetsAt: null, cooldownUntil: null };
        }

        // Contar mensagens do usuário nas últimas 24h
        const todayMsgs = await db
          .select({ createdAt: aiMessages.createdAt })
          .from(aiMessages)
          .where(
            and(
              sql`${aiMessages.conversationId} = ANY(ARRAY[${sql.join(convIds.map(id => sql`${id}`), sql`, `)}]::int[])`,
              eq(aiMessages.role, "user"),
              gte(aiMessages.createdAt, startOfDay)
            )
          )
          .orderBy(asc(aiMessages.createdAt));

        const usedToday = todayMsgs.length;
        const canQuery = true; // Removido limite diário de consultas

        // Não há mais reset diário pois não há limite
        let resetsAt: string | null = null;

        // Calcular cooldown (última mensagem do usuário)
        const lastMsg = await db
          .select({ createdAt: aiMessages.createdAt })
          .from(aiMessages)
          .where(
            and(
              sql`${aiMessages.conversationId} = ANY(ARRAY[${sql.join(convIds.map(id => sql`${id}`), sql`, `)}]::int[])`,
              eq(aiMessages.role, "user")
            )
          )
          .orderBy(desc(aiMessages.createdAt))
          .limit(1);

        let cooldownUntil: string | null = null;
        if (lastMsg.length > 0) {
          const lastAt = new Date(lastMsg[0].createdAt);
          const cooldownEnd = new Date(lastAt.getTime() + 10 * 1000); // 10 segundos
          if (cooldownEnd > now) {
            cooldownUntil = cooldownEnd.toISOString();
          }
        }

        return { usedToday, limit: DAILY_LIMIT, canQuery, resetsAt, cooldownUntil };
      }),

    chat: protectedProcedure
      .input(z.object({
        conversationId: z.number(),
        message: z.string().min(1).max(4000),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        const orgId = ctx.user.organizationId!;

        // ── VALIDAÇÃO DA MENSAGEM ──────────────────────────────────────────────────
        const rawMsg = input.message.trim();

        // 1. Somente dígitos
        if (/^\d+$/.test(rawMsg)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Mensagem inválida: não envie somente números. Faça uma consulta real.",
          });
        }

        // 2. Muito curta (menos de 5 caracteres efetivos sem espaços)
        const charsOnly = rawMsg.replace(/\s/g, "");
        if (charsOnly.length < 5) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Mensagem inválida: muito curta. Elabore sua consulta com mais detalhes.",
          });
        }

        // 3. Somente um caractere repetido (ex: 'aaaaaaa', '!!!!!!')
        if (/^(.)\1{4,}$/.test(charsOnly)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Mensagem inválida: caracteres repetidos não são aceitos.",
          });
        }



        // ── VERIFICAR ACESSO À CONVERSA ──────────────────────────────────────────
        const [conv] = await db.select({ id: aiConversations.id, title: aiConversations.title }).from(aiConversations)
          .where(and(
            eq(aiConversations.id, input.conversationId),
            eq(aiConversations.userId, ctx.user.id),
            eq(aiConversations.organizationId, orgId)
          )).limit(1);

        if (!conv) throw new TRPCError({ code: "NOT_FOUND", message: "Conversa não encontrada ou acesso negado" });

        // ── BUSCAR CONVERSAS DO USUÁRIO PARA RATE LIMITING ───────────────────────
        const userConversations = await db
          .select({ id: aiConversations.id })
          .from(aiConversations)
          .where(eq(aiConversations.userId, ctx.user.id));
        const convIds = userConversations.map((c) => c.id);

        // ── RATE LIMITING: 10 SEGUNDOS ENTRE CONSULTAS ───────────────────────────
        if (convIds.length > 0) {
          const lastUserMsg = await db
            .select({ createdAt: aiMessages.createdAt })
            .from(aiMessages)
            .where(
              and(
                sql`${aiMessages.conversationId} = ANY(ARRAY[${sql.join(convIds.map(id => sql`${id}`), sql`, `)}]::int[])`,
                eq(aiMessages.role, "user")
              )
            )
            .orderBy(desc(aiMessages.createdAt))
            .limit(1);

          if (lastUserMsg.length > 0) {
            const lastAt = new Date(lastUserMsg[0].createdAt);
            const secondsElapsed = (Date.now() - lastAt.getTime()) / 1000;
            if (secondsElapsed < 10) {
              const waitSeconds = Math.ceil(10 - secondsElapsed);
              throw new TRPCError({
                code: "TOO_MANY_REQUESTS",
                message: `Aguarde ${waitSeconds} segundo(s) antes de enviar outra consulta.`,
              });
            }
          }
        }

        // ── LIMITE DIÁRIO DE CONSULTAS REMOVIDO ──────────────────────────────────
        // (O professor agora usa sua própria chave de API)

        // ── SALVAR A MENSAGEM DO USUÁRIO ─────────────────────────────────────────
        await db.insert(aiMessages).values({
          conversationId: input.conversationId,
          role: "user",
          content: input.message,
          createdAt: new Date(),
        });

        // Atualiza título da conversa se for a primeira mensagem
        if (conv.title === "Nova Conversa") {
          const newTitle = input.message.length > 30 ? input.message.substring(0, 30) + "..." : input.message;
          await db.update(aiConversations)
            .set({ title: newTitle, updatedAt: new Date() })
            .where(eq(aiConversations.id, input.conversationId));
        } else {
          await db.update(aiConversations)
            .set({ updatedAt: new Date() })
            .where(eq(aiConversations.id, input.conversationId));
        }

        // Busca histórico (últimas 20 mensagens)
        const history = await db.select({ role: aiMessages.role, content: aiMessages.content })
          .from(aiMessages)
          .where(eq(aiMessages.conversationId, input.conversationId))
          .orderBy(desc(aiMessages.createdAt))
          .limit(20);
        const formattedHistory = history.reverse();

        // Constrói contexto e prompt do sistema
        const isUserAdmin = ctx.user.role === 'admin' || ctx.user.openId === ENV.ownerOpenId;
        const userDataContext = await buildUserContext(db, ctx.user.id, orgId, isUserAdmin);
        let systemPrompt = getSystemPrompt(userDataContext);

        // Fetch AI documents to use as context
        const userDocs = await db.select({
          fileName: aiDocuments.fileName,
          extractedText: aiDocuments.extractedText
        }).from(aiDocuments)
          .where(and(eq(aiDocuments.userId, ctx.user.id), eq(aiDocuments.organizationId, orgId)));

        if (userDocs.length > 0) {
          systemPrompt += `\n\n=== BASE DE CONHECIMENTO DO USUÁRIO (DOCUMENTOS) ===\n`;
          systemPrompt += `O usuário forneceu os seguintes documentos para você ler e usar como base para respostas. Nunca diga que você não tem acesso aos documentos, pois eles estão listados abaixo:\n`;
          for (const doc of userDocs) {
            systemPrompt += `\n--- Arquivo: ${doc.fileName} ---\n${doc.extractedText}\n----------------------\n`;
          }
        }

        // Fetch professor's API key
        let professorId = ctx.user.id;
        if (ctx.user.role === "aluno") {
          const [student] = await db.select({ professorId: students.professorId }).from(students).where(eq(students.id, ctx.user.studentId!));
          if (student) professorId = student.professorId;
        }
        const { getSettingsByUserId } = await import("../db");
        const settingsData = await getSettingsByUserId(orgId, professorId);

        // Chama a IA
        const apiKey = settingsData?.aiProvider === 'groq' ? settingsData?.groqApiKey : settingsData?.geminiApiKey;
        const model = settingsData?.aiProvider === 'groq' ? settingsData?.groqModel : settingsData?.geminiModel;
        const aiResponseRaw = await callGemini(formattedHistory, systemPrompt, false, apiKey, model);

        // ── PROCESSAR ACTIONS DE CADASTRO DE ALUNO (Múltiplos permitidos) ────────
        const ACTION_REGEX = /<!--ACTION:CREATE_STUDENT\s+(\{[\s\S]*?\})-->/g;
        let finalResponseContent = aiResponseRaw;
        
        let match;
        let foundAny = false;
        
        while ((match = ACTION_REGEX.exec(aiResponseRaw)) !== null) {
          foundAny = true;
          const blockStr = match[0];
          const jsonStr = match[1];
            
            try {
              const actionData = JSON.parse(jsonStr);

              // Executar o cadastro do aluno sem exigir campos extras
              const [newStudent] = await db.insert(students).values({
                organizationId: orgId,
                professorId: ctx.user.id,
                userId: ctx.user.id,
                name: actionData.name,
                phone: actionData.phone || "",
                email: actionData.email || null,
                birthDate: actionData.birthDate || null,
                guardianName: actionData.guardianName || null,
                guardianPhone: actionData.guardianPhone || null,
                guardianEmail: null,
                level: actionData.level || "iniciante",
                monthlyFee: String(actionData.monthlyFee ?? 0),
                dueDay: actionData.dueDay ?? 15,
                lessonType: "individual",
                status: "ativo",
                startDate: new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }),
                notes: actionData.notes || null,
                createdAt: new Date(),
                updatedAt: new Date(),
              }).returning({ id: students.id });

              const confirmMsg = [
                `\n\n✅ **Aluno cadastrado com sucesso:** ${actionData.name}`,
                `- **Telefone:** ${actionData.phone}`,
                `- **Nascimento:** ${actionData.birthDate}`,
                `- **Mensalidade:** R$ ${Number(actionData.monthlyFee).toFixed(2)} (Venc: dia ${actionData.dueDay})`,
                actionData.guardianName ? `- **Responsável:** ${actionData.guardianName} (${actionData.guardianPhone})` : null,
              ].filter(Boolean).join("\n");

              finalResponseContent = finalResponseContent.replace(blockStr, confirmMsg);
            } catch (parseErr: any) {
              console.error("[AI ACTION:CREATE_STUDENT] Erro ao processar:", parseErr);
              let errorReason = "Ocorreu um erro interno ao tentar cadastrar o aluno.";
              
              const errMsg = parseErr?.message || "";
              const errDetail = parseErr?.detail || "";
              const errCode = parseErr?.code || "";

              if (errCode === '23505' || errMsg.includes("unique constraint") || errMsg.includes("duplicate key")) {
                if (errMsg.includes("students_email_org_unique") || errDetail.includes("email")) {
                  errorReason = "⚠️ Não foi possível cadastrar: este e-mail já está em uso por outro aluno nesta escola. Utilize um e-mail diferente ou cadastre o e-mail no campo do responsável.";
                } else if (errMsg.includes("cpf")) {
                  errorReason = "⚠️ Não foi possível cadastrar: já existe um aluno cadastrado com este CPF.";
                } else {
                  errorReason = `⚠️ Não foi possível cadastrar: este registro já existe no sistema (${errDetail || "chave duplicada"}).`;
                }
              } else if (errMsg) {
                errorReason = `⚠️ Não foi possível concluir o cadastro: ${errMsg.replace(/^Error:\s*/, "")}`;
              }

              finalResponseContent = finalResponseContent.replace(blockStr,
                `\n\n${errorReason}`
              );
            }
          }

        // ── PROCESSAR ACTIONS DE AGENDAMENTO DE AULAS (Múltiplos permitidos) ──────
        const LESSON_ACTION_REGEX = /<!--ACTION:CREATE_LESSON\s+(\{[\s\S]*?\})-->/g;
        let lessonMatch;
        while ((lessonMatch = LESSON_ACTION_REGEX.exec(aiResponseRaw)) !== null) {
          const blockStr = lessonMatch[0];
          const jsonStr = lessonMatch[1];
          try {
            const lessonData = JSON.parse(jsonStr);
            let targetStudentId: number | null = null;
            
            if (lessonData.studentName) {
              const [foundStudent] = await db.select({ id: students.id })
                .from(students)
                .where(and(eq(students.organizationId, orgId), ilike(students.name, `%${lessonData.studentName}%`)))
                .limit(1);
              if (foundStudent) targetStudentId = foundStudent.id;
            }

            const scheduledDate = lessonData.scheduledAt ? new Date(lessonData.scheduledAt) : new Date();

            const [newLesson] = await db.insert(lessons).values({
              organizationId: orgId,
              userId: ctx.user.id,
              studentId: targetStudentId,
              title: lessonData.title || `Aula - ${lessonData.studentName || 'Aluno'}`,
              scheduledAt: scheduledDate,
              duration: lessonData.duration || 60,
              isExperimental: !!lessonData.isExperimental,
              experimentalName: lessonData.experimentalName || null,
              lessonType: lessonData.lessonType || (lessonData.isExperimental ? "experimental" : "individual"),
              status: "agendada",
              createdAt: new Date(),
              updatedAt: new Date(),
            }).returning({ id: lessons.id });

            const formattedScheduled = scheduledDate.toLocaleString('pt-BR', {
              dateStyle: 'short',
              timeStyle: 'short'
            });

            const confirmMsg = `\n\n📅 **Aula agendada com sucesso na agenda!**\n- **Título:** ${lessonData.title}\n- **Data/Hora:** ${formattedScheduled}\n- **Duração:** ${lessonData.duration || 60} minutos`;

            finalResponseContent = finalResponseContent.replace(blockStr, confirmMsg);
          } catch (parseErr) {
            console.error("[AI ACTION:CREATE_LESSON] Erro ao processar:", parseErr);
            finalResponseContent = finalResponseContent.replace(blockStr,
              "\n\n⚠️ Ocorreu um erro interno ao agendar a aula na agenda."
            );
          }
        }
        
        // Salva a resposta da IA (já processada)
        const [aiMsg] = await db.insert(aiMessages).values({
          conversationId: input.conversationId,
          role: "assistant",
          content: finalResponseContent,
          createdAt: new Date(),
        }).returning();

        return { reply: aiMsg.content };
      }),

    deleteConversation: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const orgId = ctx.user.organizationId!;

        // Verifica e deleta (em cascata no postgres se configurado, mas faremos manual para garantir)
        const [conv] = await db.select({ id: aiConversations.id }).from(aiConversations)
          .where(and(
            eq(aiConversations.id, input.id),
            eq(aiConversations.userId, ctx.user.id),
            eq(aiConversations.organizationId, orgId)
          )).limit(1);

        if (!conv) throw new Error("Conversa não encontrada");

        await db.delete(aiMessages).where(eq(aiMessages.conversationId, input.id));
        await db.delete(aiConversations).where(eq(aiConversations.id, input.id));

        return { success: true };
      }),

    uploadDocument: protectedProcedure
      .input(z.object({
        fileName: z.string(),
        fileType: z.string(),
        extractedText: z.string()
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const orgId = ctx.user.organizationId!;

        await db.insert(aiDocuments).values({
          organizationId: orgId,
          userId: ctx.user.id,
          fileName: input.fileName,
          fileType: input.fileType,
          extractedText: input.extractedText,
          createdAt: new Date(),
        });
        return { success: true };
      }),

    listDocuments: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      const orgId = ctx.user.organizationId!;

      return db.select({
        id: aiDocuments.id,
        fileName: aiDocuments.fileName,
        fileType: aiDocuments.fileType,
        createdAt: aiDocuments.createdAt
      }).from(aiDocuments)
        .where(and(eq(aiDocuments.organizationId, orgId), eq(aiDocuments.userId, ctx.user.id)))
        .orderBy(desc(aiDocuments.createdAt));
    }),

    deleteDocument: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const orgId = ctx.user.organizationId!;

        await db.delete(aiDocuments)
          .where(and(
            eq(aiDocuments.id, input.id),
            eq(aiDocuments.userId, ctx.user.id),
            eq(aiDocuments.organizationId, orgId)
          ));

        return { success: true };
      }),
  }),

};

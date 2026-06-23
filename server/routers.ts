import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { fcmRouter } from "./fcmRouter";
import { publicProcedure, protectedProcedure, professorProcedure, studentProcedure, router } from "./_core/trpc";
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
} from "./db";
import { organizations, users, students, lessons, instruments, reminders, reminderTemplates, paymentDues, asaasCustomers, settings, studentGoals, studentTimeline, studentFiles, announcements, chatMessages, rescheduleRequests, studentEvolution, aiConversations, aiMessages, aiDocuments, expenses, dailyStudyPlans, notifications, professores, professorPayments, attendanceTokens, attendanceLogs, contracts } from "../drizzle/schema";
import { eq, desc, sql, and, gte, lt, lte, asc, ne, or, inArray } from "drizzle-orm";
import { notifyOwner, notifyUser } from "./_core/notification";
import { handleDbError } from "./utils/error_handler";
import { TRPCError } from "@trpc/server";

import crypto from "crypto";
import { createAsaasCustomer, createAsaasCharge, deleteAsaasCharge, getAsaasPixQrCode } from "./utils/asaas";
import { buildUserContext } from "./utils/aiContext";
import { getSystemPrompt } from "./utils/aiPrompts";
import { callGemini, genAI } from "./utils/gemini";
import { sendWhatsAppMessage, startWhatsAppSession, getWhatsAppSessionStatus, logoutWhatsAppSession } from "./utils/whatsapp";
import { nanoid } from "nanoid";
import { sdk } from "./_core/sdk";
import { sendVerificationEmail } from "./_core/email";
import { ENV } from "./_core/env";
import { storagePut } from "./storage";

export const appRouter = router({
  system: router({
    status: publicProcedure.query(() => ({ status: "ok" })),
    checkSchema: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return { error: "Database not available" };
      try {
        const result = await db.execute(sql`
          SELECT column_name, is_nullable, data_type, column_default 
          FROM information_schema.columns 
          WHERE table_name = 'lessons' AND column_name = 'studentId'
        `);
        return { 
          success: true, 
          columns: result,
          timestamp: new Date().toISOString()
        };
      } catch (e: any) {
        return { 
          success: false, 
          error: e.message, 
          code: e.code,
          detail: e.detail
        };
      }
    }),
    cleanupTestData: protectedProcedure.mutation(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const orgId = ctx.user.organizationId!;
      const term = "%teste%";
      const studentList = await db.select({ id: students.id }).from(students)
        .where(and(
          eq(students.organizationId, orgId),
          eq(students.professorId, ctx.user.id), 
          sql`LOWER(name) LIKE ${term} OR LOWER(email) LIKE ${term}`
        ));
      const studentIds = studentList.map(s => s.id);
      if (studentIds.length > 0) {
        await db.delete(lessons).where(and(eq(lessons.organizationId, orgId), inArray(lessons.studentId, studentIds)));
        await db.delete(paymentDues).where(and(eq(paymentDues.organizationId, orgId), inArray(paymentDues.studentId, studentIds)));
        await db.delete(students).where(and(eq(students.organizationId, orgId), inArray(students.id, studentIds)));
      }
      await db.delete(lessons).where(and(
        eq(lessons.organizationId, orgId),
        eq(lessons.userId, ctx.user.id), 
        sql`LOWER(title) LIKE ${term}`
      ));
      return { success: true, studentsRemoved: studentIds.length, lessonsRemoved: 0 };
    }),
    getNotifications: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      return await db.select().from(notifications)
        .where(and(eq(notifications.userId, ctx.user.id), eq(notifications.organizationId, ctx.user.organizationId!)))
        .orderBy(desc(notifications.createdAt))
        .limit(10);
    }),
    markNotificationRead: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return;
      await db.update(notifications).set({ read: true }).where(and(eq(notifications.id, input.id), eq(notifications.userId, ctx.user.id)));
    }),
  }),
  auth: router({
    me: publicProcedure.query(async ({ ctx }) => {
      if (!ctx.user) return null;
      const db = await getDb();
      if (!db) return ctx.user;
      
      if (ctx.user.organizationId) {
        const [org] = await db.select({
          subscriptionStatus: organizations.subscriptionStatus,
          trialEndsAt: organizations.trialEndsAt
        }).from(organizations).where(eq(organizations.id, ctx.user.organizationId)).limit(1);
        
        let permissions: string[] = [];
        if (ctx.user.role === 'professor') {
          const [prof] = await db.select({ permissions: professores.permissions })
            .from(professores)
            .where(eq(professores.userId, ctx.user.id))
            .limit(1);
          if (prof?.permissions) {
            permissions = prof.permissions as string[];
          }
        }

        return {
          ...ctx.user,
          subscriptionStatus: org?.subscriptionStatus,
          trialEndsAt: org?.trialEndsAt,
          permissions,
        };
      }
      
      return ctx.user;
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
    updateMyPassword: protectedProcedure
      .input(z.object({ password: z.string().min(6) }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        const salt = crypto.randomBytes(16).toString("hex");
        const derivedKey = crypto.scryptSync(input.password, salt, 64).toString("hex");
        const passwordHash = `${salt}:${derivedKey}`;
        
        await db.update(users)
          .set({ passwordHash, mustChangePassword: false })
          .where(eq(users.id, ctx.user.id));
          
        return { success: true };
      }),
    login: publicProcedure
      .input(z.object({ 
        email: z.string().email(), 
        password: z.string(), 
        rememberMe: z.boolean().optional(),
        loginType: z.enum(['aluno', 'professor']).nullish()
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const [user] = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
        
        if (!user) {
          throw new Error("Usuário não encontrado");
        }

        if (input.loginType === 'aluno' && user.role !== 'aluno') {
          throw new Error("Acesso restrito a alunos");
        }
        
        if (input.loginType === 'professor' && user.role === 'aluno') {
          throw new Error("Acesso restrito a professores");
        }

        if (!user.passwordHash) {
          throw new Error("Credenciais inválidas");
        }
        
        const [salt, key] = user.passwordHash.split(":");
        const derivedKey = crypto.scryptSync(input.password, salt, 64).toString("hex");
        if (key !== derivedKey) {
          throw new Error("Credenciais inválidas");
        }

        if (!user.isEmailVerified) {
          throw new Error("Sua conta ainda não foi verificada. Por favor, verifique seu e-mail.");
        }
        
        const isRemembered = input.rememberMe !== false; // Padrão: marcado
        const expiresInMs = isRemembered ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

        const sessionToken = await sdk.createSessionToken(user.openId, {
          name: user.name || "",
          expiresInMs,
        });

        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, { 
          ...cookieOptions, 
          maxAge: isRemembered ? expiresInMs : undefined 
        });

        return { success: true, role: user.role, mustChangePassword: user.mustChangePassword };
      }),
    register: publicProcedure
      .input(z.object({ 
        name: z.string().min(2), 
        email: z.string().email(), 
        password: z.string().min(6),
        registrationToken: z.string()
      }))
      .mutation(async ({ ctx, input }) => {
        const submittedToken = (input.registrationToken || "").trim();
        const expectedToken = (ENV.registrationToken || "").trim();

        if (!submittedToken) {
          throw new Error("Por favor, informe o Token de Segurança.");
        }

        if (submittedToken !== expectedToken) {
          throw new Error("Token de segurança incorreto. Verifique o código enviado.");
        }

        const db = await getDb();
        if (!db) throw new Error("Banco de dados não disponível");
        
        const salt = crypto.randomBytes(16).toString("hex");
        const derivedKey = crypto.scryptSync(input.password, salt, 64).toString("hex");
        const passwordHash = `${salt}:${derivedKey}`;
        const openId = crypto.randomUUID();

        // Create default organization for new admin with 33-day trial
        const baseSlug = input.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'escola';
        const uniqueSlug = `${baseSlug}-${crypto.randomBytes(4).toString('hex')}`;
        const trialEndsAt = new Date();
        trialEndsAt.setDate(trialEndsAt.getDate() + 33);
        trialEndsAt.setHours(23, 59, 59, 999);
        const org = await db.insert(organizations).values({
          name: `${input.name}'s School`,
          slug: uniqueSlug,
          subscriptionStatus: "trialing",
          trialEndsAt,
          createdAt: new Date(),
        }).returning().then(res => res[0]);

        await db.insert(users).values({
          openId,
          organizationId: org.id,
          name: input.name,
          email: input.email,
          passwordHash,
          loginMethod: "local",
          role: "admin",
          isEmailVerified: true,
        });

        return { success: true, message: "Conta criada com sucesso! Você já pode fazer login." };
      }),
    registerWithPlan: publicProcedure
      .input(z.object({
        name: z.string().min(2),
        email: z.string().email(),
        password: z.string().min(6),
        planType: z.enum(["MONTHLY", "YEARLY"]),
        planId: z.enum(["basico", "profissional", "premium", "30alunos", "20alunos", "10alunos"]).default("profissional"),
        cpfCnpj: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Banco de dados não disponível");
        
        const [existing] = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
        if (existing) {
          throw new Error("Este e-mail já está em uso.");
        }

        const salt = crypto.randomBytes(16).toString("hex");
        const derivedKey = crypto.scryptSync(input.password, salt, 64).toString("hex");
        const passwordHash = `${salt}:${derivedKey}`;
        const openId = crypto.randomUUID();

        // Mapear valor correto por plano
        const planValues: Record<string, number> = {
          "basico": 29.99,
          "profissional": 59.90,
          "premium": 99.90,
          "30alunos": 20.00,
          "20alunos": 15.00,
          "10alunos": 10.00,
        };
        const planValue = input.planType === "YEARLY"
          ? (planValues[input.planId] ?? 59.90) * 10  // desconto anual (~2 meses grátis)
          : (planValues[input.planId] ?? 59.90);

        // Criar organização com status PENDING (aguardando pagamento)
        const baseSlug = input.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'escola';
        const uniqueSlug = `${baseSlug}-${crypto.randomBytes(4).toString('hex')}`;
        
        // Fatura para hoje
        const nextDueDateStr = new Date().toISOString().slice(0, 10);

        const [org] = await db.insert(organizations).values({
          name: `${input.name}`,
          slug: uniqueSlug,
          subscriptionStatus: "pending",  // Status correto: aguardando pagamento
          createdAt: new Date(),
        }).returning();

        const [newUser] = await db.insert(users).values({
          openId,
          organizationId: org.id,
          name: input.name,
          email: input.email,
          passwordHash,
          loginMethod: "local",
          role: "admin",
          isEmailVerified: true,
        }).returning();

        // Integração Asaas
        const { createAsaasCustomer, createAsaasSubscription } = await import('./utils/asaas');
        
        let invoiceUrl: string | null = null;

        try {
          const customerId = await createAsaasCustomer({
            name: org.name || "Escola",
            email: newUser.email ?? undefined,
            cpfCnpj: input.cpfCnpj || undefined,
          });
          
          const sub = await createAsaasSubscription({
            customer: customerId,
            billingType: 'UNDEFINED',  // Asaas gera link de checkout próprio
            value: planValue,
            nextDueDate: nextDueDateStr,
            cycle: input.planType,
            description: `Assinatura MusicPro - Plano ${input.planId} (${input.planType})`,
            successUrl: `${(ctx.req as any).headers?.origin || 'https://wrmusicpro.com.br'}/dashboard`
          });

          // Salvar IDs do Asaas na organização
          await db.update(organizations)
            .set({ asaasCustomerId: customerId, asaasSubscriptionId: sub.id })
            .where(eq(organizations.id, org.id));

          // Buscar o link de pagamento da primeira fatura
          try {
            const { getAsaasSubscriptionPayments } = await import('./utils/asaas');
            const payments = await getAsaasSubscriptionPayments(sub.id);
            if (payments?.length > 0 && payments[0].invoiceUrl) {
              invoiceUrl = payments[0].invoiceUrl;
            }
          } catch {
            // Se não conseguir o link, não bloqueia o cadastro
          }

        } catch (error: any) {
          // Se Asaas falhar, remove usuário e org para não deixar dados órfãos
          await db.delete(users).where(eq(users.id, newUser.id));
          await db.delete(organizations).where(eq(organizations.id, org.id));
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: error?.message?.includes("[Asaas]")
              ? "Erro ao configurar faturamento: " + error.message.replace("[Asaas] ", "")
              : "Erro ao configurar faturamento. Verifique os dados e tente novamente.",
            cause: error
          });
        }

        // Criar sessão para login automático (org está pending, mas usuário pode acessar)
        const expiresInMs = 30 * 24 * 60 * 60 * 1000;
        const sessionToken = await sdk.createSessionToken(openId, {
          name: input.name,
          expiresInMs,
        });
        
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, { 
          ...cookieOptions, 
          maxAge: expiresInMs 
        });

        return { success: true, invoiceUrl };
      }),

    verifyEmail: publicProcedure
      .input(z.object({ token: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Banco de dados não disponível");
        const [user] = await db.select().from(users).where(eq(users.verificationToken, input.token)).limit(1);
        if (!user) throw new Error("Código de verificação inválido.");
        if (user.verificationTokenExpiresAt && user.verificationTokenExpiresAt < new Date()) {
          throw new Error("Código de verificação expirado.");
        }
        await db.update(users).set({ 
          isEmailVerified: true, 
          verificationToken: null, 
          verificationTokenExpiresAt: null 
        }).where(eq(users.id, user.id));
        return { success: true };
      }),
  }),

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

      // Security: verify student ownership
      const [ownedStudent] = await db.select({ id: students.id }).from(students)
        .where(and(eq(students.id, input.studentId as number), eq(students.organizationId, orgId), eq(students.professorId, ctx.user.id)))
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

      // Security: verify student ownership
      const [ownedStudent] = await db.select({ id: students.id }).from(students)
        .where(and(eq(students.id, input.studentId as number), eq(students.organizationId, orgId), eq(students.professorId, ctx.user.id)))
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
        
      return {
        averageGrade: Number(averageGrade.toFixed(1)),
        completedCount: completedLessons.length,
        frequency: Math.round(frequency),
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
        const { getLLM } = await import("./_core/llm");
        const llm = getLLM();
        const response = await llm.chat({ messages: [{ role: 'user', content: prompt }] });
        return { insight: response.message.content };
      } catch (e) {
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
        const { callGemini } = await import("./utils/gemini");
        const { getSettingsByUserId } = await import("./db");
        const settingsData = await getSettingsByUserId(orgId, ctx.user.id);
        const responseText = await callGemini([{ role: 'user', content: prompt }], undefined, false, settingsData?.geminiApiKey);
        return { suggestion: responseText.trim() };
      } catch (e: any) {
        throw new Error("Erro ao sugerir tópico com a IA: " + e.message);
      }
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

      const prompt = `Você é um assistente educacional gerando planos de aula para a PRÓXIMA AULA do aluno ${student.name} (Nível: ${student.level}). Utilize uma linguagem simples, didática e de fácil compreensão, focada em alunos iniciantes, sem jargões complexos.

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
        const { callGemini } = await import("./utils/gemini");
        const { getSettingsByUserId } = await import("./db");
        const settingsData = await getSettingsByUserId(orgId, ctx.user.id);
        const responseText = await callGemini([{ role: 'user', content: prompt }], undefined, false, settingsData?.geminiApiKey);
        return { plan: responseText };
      } catch (e: any) {
        throw new Error("Erro ao gerar plano de aula com a IA: " + e.message);
      }
    }),

    generateDailyStudyPlan: protectedProcedure.input(z.object({ studentId: z.number() })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const orgId = ctx.user.organizationId!;
      
      const [student] = await db.select().from(students).where(and(eq(students.id, input.studentId), eq(students.organizationId, orgId)));
      if (!student) throw new Error("Aluno não encontrado");

      // Busca o instrumento do aluno — essencial para gerar plano 100% correto
      let instrumentName = "instrumento não especificado";
      if (student.instrumentId) {
        const [instrument] = await db.select({ name: instruments.name, category: instruments.category })
          .from(instruments)
          .where(eq(instruments.id, student.instrumentId));
        if (instrument) instrumentName = instrument.name + " (" + instrument.category + ")";
      }

      const pastLessons = await db.select({ title: lessons.title, notes: lessons.notes })
        .from(lessons)
        .where(and(eq(lessons.studentId, input.studentId), eq(lessons.organizationId, orgId), eq(lessons.status, 'concluida')))
        .limit(5)
        .orderBy(desc(lessons.scheduledAt));
      const goals = await db.select().from(studentGoals).where(and(eq(studentGoals.studentId, input.studentId), eq(studentGoals.organizationId, orgId)));
      const timeline = await db.select().from(studentTimeline).where(and(eq(studentTimeline.studentId, input.studentId), eq(studentTimeline.organizationId, orgId))).limit(10).orderBy(desc(studentTimeline.achievedAt));

      const timelineText = timeline.map(t => "[" + t.category + "] " + t.title + " - " + t.description).join(" | ");
      const lessonsText = pastLessons.length > 0
        ? pastLessons.map(l => "- \"" + l.title + "\"" + (l.notes ? " (notas do professor: " + l.notes + ")" : "")).join("\n")
        : "Nenhuma aula concluída registrada.";

      const jsonTemplate = JSON.stringify({
        weeklyGoal: "Objetivo em 2-3 linhas especifico para " + instrumentName,
        importantMessage: "Dica de motivação específica para quem toca " + instrumentName,
        days: [
          {
            dayName: "Dia 1",
            focus: { title: "Titulo do foco para " + instrumentName, description: "Descrição breve e pratica" },
            exercises: [
              { title: "Nome do exercicio", subtitle: "Instrucao especifica para " + instrumentName, duration: "15 min", points: ["Ponto 1", "Ponto 2"], icon: "music" }
            ]
          }
        ]
      }, null, 2);

      const prompt = "Voce e um professor especialista gerando um PLANO DE ESTUDO DIARIO personalizado.\n\n"
        + "INFORMACOES DO ALUNO:\n"
        + "- Nome: " + student.name + "\n"
        + "- Nivel: " + student.level + "\n"
        + "- Instrumento: " + instrumentName + "\n\n"
        + "HISTORICO DE AULAS (mais recentes concluidas):\n"
        + lessonsText + "\n\n"
        + "METAS ATIVAS: " + (goals.map(g => g.title).join(", ") || "Nenhuma") + "\n"
        + "TIMELINE: " + (timelineText || "Nenhum registro") + "\n\n"
        + "REGRAS OBRIGATORIAS:\n"
        + "1. O plano DEVE ser 100% especifico para o instrumento: " + instrumentName + ". NAO mencione nenhum outro instrumento.\n"
        + "2. Todos os exercicios devem ser tecnicos e praticos para quem toca " + instrumentName + ".\n"
        + "3. Gere exatamente 5 dias de pratica com atividades curtas.\n"
        + "4. Use linguagem simples, motivadora e didatica.\n\n"
        + "Retorne APENAS um JSON valido com esta estrutura (sem markdown ao redor):\n\n"
        + jsonTemplate + "\n\n"
        + "Regras para o campo icon: use exatamente uma das opcoes: metronome, guitar, music, pen, star, play.";
      
      try {
        const { callGemini } = await import("./utils/gemini");
        const { getSettingsByUserId } = await import("./db");
        const settingsData = await getSettingsByUserId(orgId, ctx.user.id);
        const responseText = await callGemini([{ role: 'user', content: prompt }], undefined, true, settingsData?.geminiApiKey);

        // Salva novo plano no banco como rascunho (não inativa os antigos ainda)
        const [inserted] = await db.insert(dailyStudyPlans).values({
          organizationId: orgId,
          studentId: input.studentId,
          teacherId: ctx.user.id,
          planText: responseText,
          status: 'ativo', // status continua ativo, publishedStatus diz se aluno vê
          publishedStatus: 'rascunho',
          daysCompleted: JSON.stringify([false, false, false, false, false]),
        }).returning({ id: dailyStudyPlans.id });

        return { plan: responseText, planId: inserted.id };
      } catch (e: any) {
        throw new Error("Erro ao gerar plano de estudo com a IA: " + e.message);
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

    toggleStudyPlanDay: studentProcedure.input(z.object({ planId: z.number(), dayIndex: z.number().min(0).max(4) })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const [plan] = await db.select().from(dailyStudyPlans).where(and(eq(dailyStudyPlans.id, input.planId), eq(dailyStudyPlans.studentId, ctx.user.studentId!)));
      if (!plan) throw new Error("Plano não encontrado");

      const parsedDays = JSON.parse(plan.daysCompleted as string);
      const daysCompleted = Array.isArray(parsedDays) ? parsedDays.map(Boolean) : [false, false, false, false, false];
      
      // Ensure it always has exactly 5 days
      while (daysCompleted.length < 5) daysCompleted.push(false);
      if (daysCompleted.length > 5) daysCompleted.length = 5;

      if (input.dayIndex >= 0 && input.dayIndex < 5) {
        daysCompleted[input.dayIndex] = !daysCompleted[input.dayIndex];
      }

      // Check if all 5 days are actually true
      const allCompleted = daysCompleted.every(Boolean);

      await db.update(dailyStudyPlans)
        .set({ 
          daysCompleted: JSON.stringify(daysCompleted),
          updatedAt: new Date(),
          ...(allCompleted ? { status: 'inativo', completedAt: new Date() } : {})
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

        // Envia notificação PUSH para o aparelho do professor
        try {
          await notifyUser(plan.teacherId, {
            title: "Semana Gabaritada! 🎸",
            content: `O aluno ${ctx.user.name} concluiu os 5 dias de treino do plano de estudos!`,
          });
        } catch (e) {
          console.error("Falha ao enviar push notification:", e);
        }
      } else if (input.dayIndex >= 0 && input.dayIndex < 5 && daysCompleted[input.dayIndex]) {
        // Envia notificação diária quando o aluno marca um dia
        await db.insert(notifications).values({
          organizationId: plan.organizationId,
          userId: plan.teacherId,
          title: "Treino Concluído! 🎸",
          message: `O aluno ${ctx.user.name} concluiu o treino do dia (Plano: ${plan.title})!`,
          type: "success",
          actionUrl: `/alunos/${ctx.user.studentId}`,
        });

        try {
          await notifyUser(plan.teacherId, {
            title: "Treino Concluído! 🎸",
            content: `O aluno ${ctx.user.name} concluiu o treino do dia (Plano: ${plan.title})!`,
          });
        } catch (e) {
          console.error("Falha ao enviar push notification:", e);
        }
      }

      return { success: true, allCompleted };
    }),

    publishStudyPlan: protectedProcedure.input(z.object({ planId: z.number(), studentId: z.number() })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const orgId = ctx.user.organizationId!;

      // Invalida planos antigos do aluno (publicados e ativos)
      await db.update(dailyStudyPlans)
        .set({ status: 'inativo' })
        .where(and(
          eq(dailyStudyPlans.studentId, input.studentId),
          eq(dailyStudyPlans.status, 'ativo'),
          eq(dailyStudyPlans.publishedStatus, 'publicado')
        ));

      // Publica o plano atual
      await db.update(dailyStudyPlans)
        .set({ publishedStatus: 'publicado' })
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
      if (!student.phone) throw new Error("Este aluno não tem um telefone cadastrado.");
      
      const [userSettings] = await db.select().from(settings).where(eq(settings.userId, ctx.user.id));
      if (!userSettings || !userSettings.whatsappBotUrl || !userSettings.whatsappBotToken) {
        throw new Error("O robô do WhatsApp não está configurado. Vá em Configurações > WhatsApp para configurar.");
      }

      const saudacao = input.type === "aula" 
        ? `Olá ${student.name}! Preparado para a nossa próxima aula? 🎸 Aqui está o que vamos fazer:\n\n`
        : `Olá ${student.name}! Aqui está o seu cronograma de treino para arrebentar essa semana! 📅👇\n\n`;

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

      const { sendWhatsAppMessage } = await import("./utils/whatsapp");
      const result = await sendWhatsAppMessage({
        url: userSettings.whatsappBotUrl,
        token: userSettings.whatsappBotToken,
        phone: student.phone,
        message: finalMessage,
        sessionId: `prof_${ctx.user.id}`
      });

      if (!result.success) {
        throw new Error("Falha ao enviar mensagem pelo robô: " + result.error);
      }

      return { success: true };
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
      fileUrl: z.string(),
      thumbnailUrl: z.string().optional(),
      comments: z.string().optional(),
      size: z.number().optional(),
    })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const orgId = ctx.user.organizationId!;

      // Security: verify student ownership
      const [ownedStudent] = await db.select({ id: students.id }).from(students)
        .where(and(eq(students.id, input.studentId as number), eq(students.organizationId, orgId), eq(students.professorId, ctx.user.id)))
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
      // Strong sanitization: replace the entire file name with a UUID to prevent path traversal or script execution
      const ext = input.fileName.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'bin';
      const uuid = crypto.randomUUID();
      const baseKey = `music-library/${orgId}/${ctx.user.id}/${Date.now()}-${uuid}.${ext}`;
      // Upload do arquivo principal
      const base64 = input.base64Data.includes(',') ? input.base64Data.split(',')[1] : input.base64Data;
      const buffer = Buffer.from(base64, 'base64');
      const { url } = await storagePut(baseKey, buffer, input.fileType);

      let thumbnailUrl: string | undefined = undefined;
      // Upload da thumbnail se fornecida
      if (input.thumbnailData) {
        const thumbBase64 = input.thumbnailData.includes(',') ? input.thumbnailData.split(',')[1] : input.thumbnailData;
        const thumbBuffer = Buffer.from(thumbBase64, 'base64');
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

  dashboard: router({
    stats: protectedProcedure.query(async ({ ctx }) => {
      const isUserAdmin = ctx.user.role === 'admin' || ctx.user.openId === ENV.ownerOpenId;
      return getDashboardStats(ctx.user.organizationId!, isUserAdmin ? undefined : ctx.user.id);
    }),
    monthlyStats: protectedProcedure.query(async ({ ctx }) => {
      const isUserAdmin = ctx.user.role === 'admin' || ctx.user.openId === ENV.ownerOpenId;
      const stats = await getMonthlyStats(ctx.user.organizationId!, isUserAdmin ? undefined : ctx.user.id, 12);
      return stats.reverse();
    }),
    experimentalStats: protectedProcedure
      .input(z.object({
        month: z.number().optional(),
        year: z.number().optional()
      }).optional())
      .query(async ({ ctx, input }) => {
        const isUserAdmin = ctx.user.role === 'admin' || ctx.user.openId === ENV.ownerOpenId;
        return getExperimentalStats(ctx.user.organizationId!, isUserAdmin ? undefined : ctx.user.id, input?.month, input?.year);
      }),
    lessonsByDay: protectedProcedure.query(async ({ ctx }) => {
      const isUserAdmin = ctx.user.role === 'admin' || ctx.user.openId === ENV.ownerOpenId;
      const data = await getLessonsByDayOfWeek(ctx.user.organizationId!, isUserAdmin ? undefined : ctx.user.id);
      const days = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
      const result = days.map((day, i) => ({
        day,
        aulas: 0,
      }));
      data.forEach(d => {
        const idx = (Number(d.dayOfWeek) - 1 + 7) % 7;
        result[idx].aulas = Number(d.count);
      });
      return result;
    }),
    recentLessons: protectedProcedure.query(async ({ ctx }) => {
      // Por padrão agora redireciona para a mesma lógica de upcoming (próximas aulas)
      const db = await getDb();
      if (!db) return [];
      const now = new Date();
      now.setHours(0, 0, 0, 0); // hoje em diante

      return db.select({
        id: lessons.id,
        title: lessons.title,
        scheduledAt: lessons.scheduledAt,
        duration: lessons.duration,
        status: lessons.status,
        isExperimental: lessons.isExperimental,
        experimentalName: lessons.experimentalName,
        studentName: students.name,
        studentId: students.id,
      }).from(lessons)
        .leftJoin(students, eq(lessons.studentId, students.id))
        .where(and(
          eq(lessons.status, 'agendada'), 
          eq(lessons.userId, ctx.user.id),
          sql`${lessons.scheduledAt} >= ${now.toISOString()}`
        ))
        .orderBy(asc(lessons.scheduledAt))
        .limit(8);
    }),
  }),

  students: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const isUserAdmin = ctx.user.role === 'admin' || ctx.user.openId === ENV.ownerOpenId;
      return getStudentsWithInstrument(ctx.user.organizationId!, isUserAdmin ? undefined : ctx.user.id);
    }),
    recent: protectedProcedure.query(async ({ ctx }) => {
      const isUserAdmin = ctx.user.role === 'admin' || ctx.user.openId === ENV.ownerOpenId;
      return getStudentsWithInstrument(ctx.user.organizationId!, isUserAdmin ? undefined : ctx.user.id, 8);
    }),
    getForEdit: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
      console.log(`[TRPC] students.getForEdit called for ID: ${input.id} by user: ${ctx.user.id}`);
      const db = await getDb();
      if (!db) {
        console.error("[TRPC] students.getForEdit: Database not available");
        return null;
      }

      const isUserAdmin = ctx.user.role === 'admin' || ctx.user.openId === ENV.ownerOpenId;
      const orgId = ctx.user.organizationId!;
      const [student] = await db.select({
        id: students.id,
        name: students.name,
        socialName: students.socialName,
        birthDate: students.birthDate,
        gender: students.gender,
        cpf: students.cpf,
        rg: students.rg,
        address: students.address,
        guardianName: students.guardianName,
        guardianPhone: students.guardianPhone,
        guardianEmail: students.guardianEmail,
        instrumentId: students.instrumentId,
        email: students.email,
        phone: students.phone,
        level: students.level,
        status: students.status,
        monthlyFee: students.monthlyFee,
        dueDay: students.dueDay,
        lessonType: students.lessonType,
        notes: students.notes,
        startDate: students.startDate,
        professorId: students.professorId,
      }).from(students)
        .where(and(
          eq(students.id, input.id), 
          eq(students.organizationId, orgId),
          isUserAdmin ? undefined : eq(students.professorId, ctx.user.id)
        ))
        .limit(1);

      if (!student) {
        console.warn(`[TRPC] students.getForEdit: Student ${input.id} not found or doesn't belong to user ${ctx.user.id}`);
        return null;
      }

      console.log(`[TRPC] students.getForEdit: Successfully retrieved student ${student.name}`);
      return student;
    }),
    getDetails: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        console.error("[TRPC] Database not available for getDetails");
        return null;
      }

      console.log(`[TRPC] Fetching student details for ID: ${input.id} requested by user: ${ctx.user.id} (${ctx.user.role})`);

      const isUserAdmin = ctx.user.role === 'admin' || ctx.user.openId === ENV.ownerOpenId;
      const orgId = ctx.user.organizationId!;

      const [student] = await db.select({
        id: students.id,
        name: students.name,
        socialName: students.socialName,
        birthDate: students.birthDate,
        gender: students.gender,
        cpf: students.cpf,
        rg: students.rg,
        address: students.address,
        guardianName: students.guardianName,
        guardianPhone: students.guardianPhone,
        guardianEmail: students.guardianEmail,
        instrumentId: students.instrumentId,
        email: students.email,
        phone: students.phone,
        level: students.level,
        status: students.status,
        monthlyFee: students.monthlyFee,
        dueDay: students.dueDay,
        lessonType: students.lessonType,
        notes: students.notes,
        startDate: students.startDate,
        avatar: students.avatar,
        createdAt: students.createdAt,
        instrumentName: instruments.name,
        instrumentColor: instruments.color,
        instrumentIcon: instruments.icon,
        professorId: students.professorId,
        permissions: students.permissions,
      }).from(students)
        .leftJoin(instruments, eq(students.instrumentId, instruments.id))
        .where(and(eq(students.id, input.id), eq(students.organizationId, orgId)))
        .limit(1);

      if (!student) {
        console.warn(`[TRPC] Student with ID ${input.id} not found`);
        return null;
      }

      // Check permission: owner of the student or admin/owner of the system
      const isOwner = student.professorId === ctx.user.id;
      // const isUserAdmin = ctx.user.role === 'admin' || ctx.user.openId === ENV.ownerOpenId; // Removed redeclaration
      
      if (!isOwner && !isUserAdmin) {
        console.warn(`[TRPC] Access denied for user ${ctx.user.id} to student ${input.id}`);
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Você não tem permissão para visualizar os detalhes deste aluno.'
        });
      }

      // Buscar informações financeiras e acesso portal
      console.log(`[TRPC] Fetching additional info for student ${input.id}`);
      const [
        [lastPayment],
        [nextPayment],
        [studentUser]
      ] = await Promise.all([
        db.select({
          paidAt: paymentDues.paidAt,
          dueDate: paymentDues.dueDate,
          status: paymentDues.status,
        }).from(paymentDues)
          .where(and(
             eq(paymentDues.organizationId, orgId),
             eq(paymentDues.studentId, input.id),
             eq(paymentDues.status, 'pago')
          ))
          .orderBy(desc(paymentDues.paidAt))
          .limit(1),

        db.select({
          paidAt: paymentDues.paidAt,
          dueDate: paymentDues.dueDate,
          status: paymentDues.status,
        }).from(paymentDues)
          .where(and(
             eq(paymentDues.organizationId, orgId),
             eq(paymentDues.studentId, input.id),
             or(eq(paymentDues.status, 'pendente'), eq(paymentDues.status, 'atrasado'))
          ))
          .orderBy(asc(paymentDues.dueDate))
          .limit(1),

        db.select({ email: users.email })
          .from(users)
          .where(and(eq(users.organizationId, orgId), eq(users.studentId, input.id)))
          .limit(1)
      ]);

      console.log(`[TRPC] Successfully fetched all info for student ${input.id}. Portal access: ${!!studentUser}`);

      return {
        ...student,
        lastPaymentDate: lastPayment?.paidAt || null,
        nextDueDate: nextPayment?.dueDate || null, 
        hasPortalAccess: !!studentUser,
        portalEmail: studentUser?.email || null,
      };
    }),

    updateAvatar: professorProcedure.input(z.object({
      id: z.number(),
      avatar: z.string(),
    })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: "Banco de dados não disponível" });
      const orgId = ctx.user.organizationId!;
      
      await db.update(students)
        .set({ avatar: input.avatar })
        .where(and(eq(students.id, input.id), eq(students.organizationId, orgId), eq(students.professorId, ctx.user.id), eq(students.userId, ctx.user.id)));
      
      return { success: true };
    }),

    enablePortalAccess: professorProcedure.input(z.object({
      studentId: z.number(),
      email: z.string().email().optional(),
      password: z.string().min(6).optional(),
      permissions: z.record(z.string(), z.boolean()).optional(),
    })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: "Banco de dados não disponível" });

      const orgId = ctx.user.organizationId!;
      console.log(`[TRPC] Enabling portal access for student: ${input.studentId} requested by: ${ctx.user.id}`);

      const [student] = await db.select().from(students).where(and(eq(students.id, input.studentId as number), eq(students.organizationId, orgId))).limit(1);
      if (!student) throw new TRPCError({ code: 'NOT_FOUND', message: "Aluno não encontrado." });

      const isOwner = student.professorId === ctx.user.id;
      const isUserAdmin = ctx.user.role === 'admin' || ctx.user.openId === ENV.ownerOpenId;
      
      if (!isOwner && !isUserAdmin) {
        console.warn(`[TRPC] Permission denied for enabling portal access - User: ${ctx.user.id}, Student: ${input.studentId}`);
        throw new TRPCError({ code: 'FORBIDDEN', message: "Você não tem permissão para liberar o acesso deste aluno." });
      }

      // Update student permissions
      if (input.permissions) {
        await db.update(students).set({ 
          permissions: JSON.stringify(input.permissions) 
        }).where(eq(students.id, student.id));
      }

      // Check if user already exists for this student
      const [existingStudentUser] = await db.select().from(users).where(and(eq(users.studentId, student.id), eq(users.organizationId, orgId))).limit(1);
      
      // Se não informado, tentar usar o e-mail do cadastro do aluno, ou gerar um padrão
      const email = input.email || student.email || `${student.name.toLowerCase().replace(/\s+/g, '.')}@musicpro.com`;
      const isAutoGeneratedPassword = !input.password;
      const password = input.password || Math.random().toString(36).slice(-8);

      // If creating a NEW user (not just updating), check email availability
      if (!existingStudentUser) {
        const [existingEmail] = await db.select().from(users).where(and(eq(users.email, email), eq(users.organizationId, orgId))).limit(1);
        if (existingEmail) throw new TRPCError({ code: 'CONFLICT', message: "Este e-mail já está em uso por outro usuário." });
      }

      const salt = crypto.randomBytes(16).toString("hex");
      const derivedKey = crypto.scryptSync(password, salt, 64).toString("hex");
      const passwordHash = `${salt}:${derivedKey}`;
      
      if (existingStudentUser) {
        await db.update(users)
          .set({ 
            email, 
            passwordHash, 
            mustChangePassword: isAutoGeneratedPassword,
            role: 'aluno', 
            studentId: student.id, 
            isEmailVerified: true 
          })
          .where(eq(users.id, existingStudentUser.id));
        console.log(`[TRPC] Updated existing user ${existingStudentUser.id} for student ${student.id}`);
      } else {
        const openId = crypto.randomUUID();
        await db.insert(users).values({
          openId,
          organizationId: orgId,
          name: student.name,
          email,
          passwordHash,
          mustChangePassword: isAutoGeneratedPassword,
          loginMethod: 'local',
          role: 'aluno',
          studentId: student.id,
          isEmailVerified: true,
        });
        console.log(`[TRPC] Created new user for student ${student.id} with email: ${email}`);
      }

      // Link back the user to the student record
      const [finalUser] = await db.select({ id: users.id }).from(users).where(and(eq(users.email, email), eq(users.organizationId, orgId))).limit(1);
      if (finalUser) {
        await db.update(students).set({ studentUserId: finalUser.id }).where(eq(students.id, student.id));
      }

      return { success: true, email, password };
    }),
    create: protectedProcedure.input(z.object({
      name: z.string().min(1, "O nome é obrigatório"),
      socialName: z.string().optional().nullable(),
      email: z.string().email("E-mail inválido").or(z.literal("")).optional().nullable(),
      phone: z.string().optional().nullable().default(""),
      birthDate: z.string().optional().nullable(),
      gender: z.string().optional().nullable(),
      cpf: z.string().optional().nullable().refine((val) => {
        if (!val) return true;
        const clean = val.replace(/\D/g, "");
        if (clean === "") return true;
        if (clean.length !== 11) return false;
        if (/^(\d)\1{10}$/.test(clean)) return false;
        
        let sum = 0;
        for (let i = 0; i < 9; i++) sum += parseInt(clean.charAt(i)) * (10 - i);
        let rev = 11 - (sum % 11);
        if (rev === 10 || rev === 11) rev = 0;
        if (rev !== parseInt(clean.charAt(9))) return false;
        
        sum = 0;
        for (let i = 0; i < 10; i++) sum += parseInt(clean.charAt(i)) * (11 - i);
        rev = 11 - (sum % 11);
        if (rev === 10 || rev === 11) rev = 0;
        if (rev !== parseInt(clean.charAt(10))) return false;
        
        return true;
      }, "CPF inválido"),
      rg: z.string().optional().nullable().refine((val) => {
        if (!val) return true;
        const clean = val.replace(/[^a-zA-Z0-9]/g, "");
        if (clean === "") return true;
        return clean.length >= 5 && !/^0+$/.test(clean);
      }, "RG deve ter pelo menos 5 caracteres e não conter apenas zeros"),
      address: z.string().optional().nullable(),
      guardianName: z.string().optional().nullable().refine((val) => {
        if (!val) return true;
        return /^[a-zA-ZáàâãéêíóôõúüçÁÀÂÃÉÊÍÓÔÕÚÜÇ\s]*$/.test(val);
      }, "O nome do responsável deve conter apenas letras"),
      guardianPhone: z.string().optional().nullable().refine((val) => {
        if (!val) return true;
        const clean = val.replace(/\D/g, "");
        if (clean === "") return true;
        return (clean.length === 10 || clean.length === 11) && !/^0+$/.test(clean);
      }, "Telefone do responsável deve ter 10 ou 11 dígitos e não conter apenas zeros"),
      guardianEmail: z.string().email("E-mail do responsável inválido").or(z.literal("")).optional().nullable(),
      instrumentId: z.number().optional(),
      level: z.enum(['iniciante','intermediario','avancado']).default('iniciante'),
      monthlyFee: z.number().default(0),
      dueDay: z.number().default(15),
      lessonType: z.enum(['individual','turma']).default('individual'),
      notes: z.string().optional(),
      status: z.enum(['ativo','inativo','pausado']).default('ativo'),
      startDate: z.string().optional().nullable(),
      temporaryPassword: z.string().optional(),
      professorId: z.number().optional(),
      avatar: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Banco de dados não disponível");
        
        const orgId = ctx.user.organizationId!;
        // 1. Criar o Aluno primeiro para ter o ID
        const [newStudent] = await db.insert(students).values({
          organizationId: orgId,
          professorId: input.professorId || ctx.user.id,
          name: input.name,
          socialName: input.socialName || null,
          email: input.email || null,
          phone: input.phone,
          birthDate: input.birthDate || null,
          gender: input.gender || null,
          cpf: input.cpf || null,
          rg: input.rg || null,
          address: input.address || null,
          guardianName: input.guardianName || null,
          avatar: input.avatar || null,
          guardianPhone: input.guardianPhone || null,
          guardianEmail: input.guardianEmail || null,
          avatar: input.avatar !== undefined ? input.avatar : undefined,
          instrumentId: input.instrumentId || null,
          level: input.level,
          monthlyFee: String(input.monthlyFee),
          dueDay: input.dueDay,
          lessonType: input.lessonType,
          startDate: input.startDate || new Date().toISOString().slice(0, 10),
          notes: input.notes || null,
          status: input.status,
          userId: ctx.user.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        }).returning({ id: students.id });

        // 2. Criar o usuário se o email for gmail (mesmo sem senha) ou se tiver senha temporária
        if (input.email) {
          const isGoogle = input.email.toLowerCase().endsWith('@gmail.com');
          
          if (isGoogle || input.temporaryPassword) {
            let passwordHash: string | null = null;
            let loginMethod = 'local';
            
            if (isGoogle) {
              loginMethod = 'google';
            } else if (input.temporaryPassword) {
              const salt = crypto.randomBytes(16).toString("hex");
              const derivedKey = crypto.scryptSync(input.temporaryPassword, salt, 64).toString("hex");
              passwordHash = `${salt}:${derivedKey}`;
            }

            const openId = crypto.randomUUID();

            const [newUser] = await db.insert(users).values({
              openId,
              organizationId: orgId,
              name: input.name,
              email: input.email,
              passwordHash,
              loginMethod,
              role: 'aluno',
              studentId: newStudent.id,
              isEmailVerified: true,
            }).returning({ id: users.id });

            // Atualizar o aluno com o link para o usuário
            await db.update(students)
              .set({ studentUserId: newUser.id })
              .where(and(eq(students.id, newStudent.id), eq(students.organizationId, orgId)));
          }
        }
        
        return { success: true, studentId: newStudent.id };
      } catch (error) {
        return handleDbError(error, "cadastrar o aluno");
      }
    }),


    update: protectedProcedure.input(z.object({
      id: z.number(),
      name: z.string().optional(),
      socialName: z.string().optional().nullable(),
      birthDate: z.string().optional().nullable(),
      gender: z.string().optional().nullable(),
      cpf: z.string().optional().nullable().refine((val) => {
        if (!val) return true;
        const clean = val.replace(/\D/g, "");
        if (clean === "") return true;
        if (clean.length !== 11) return false;
        if (/^(\d)\1{10}$/.test(clean)) return false;
        
        let sum = 0;
        for (let i = 0; i < 9; i++) sum += parseInt(clean.charAt(i)) * (10 - i);
        let rev = 11 - (sum % 11);
        if (rev === 10 || rev === 11) rev = 0;
        if (rev !== parseInt(clean.charAt(9))) return false;
        
        sum = 0;
        for (let i = 0; i < 10; i++) sum += parseInt(clean.charAt(i)) * (11 - i);
        rev = 11 - (sum % 11);
        if (rev === 10 || rev === 11) rev = 0;
        if (rev !== parseInt(clean.charAt(10))) return false;
        
        return true;
      }, "CPF inválido"),
      rg: z.string().optional().nullable().refine((val) => {
        if (!val) return true;
        const clean = val.replace(/[^a-zA-Z0-9]/g, "");
        if (clean === "") return true;
        return clean.length >= 5 && !/^0+$/.test(clean);
      }, "RG deve ter pelo menos 5 caracteres e não conter apenas zeros"),
      address: z.string().optional().nullable(),
      guardianName: z.string().optional().nullable().refine((val) => {
        if (!val) return true;
        return /^[a-zA-ZáàâãéêíóôõúüçÁÀÂÃÉÊÍÓÔÕÚÜÇ\s]*$/.test(val);
      }, "O nome do responsável deve conter apenas letras"),
      guardianPhone: z.string().optional().nullable().refine((val) => {
        if (!val) return true;
        const clean = val.replace(/\D/g, "");
        if (clean === "") return true;
        return (clean.length === 10 || clean.length === 11) && !/^0+$/.test(clean);
      }, "Telefone do responsável deve ter 10 ou 11 dígitos e não conter apenas zeros"),
      guardianEmail: z.string().email("E-mail do responsável inválido").or(z.literal("")).optional().nullable(),
      email: z.string().email("E-mail inválido").or(z.literal("")).optional().nullable(),
      phone: z.string().optional().nullable(),
      instrumentId: z.number().optional().nullable(),
      level: z.enum(['iniciante', 'intermediario', 'avancado']).optional(),
      monthlyFee: z.number().optional(),
      dueDay: z.number().optional(),
      status: z.enum(['ativo', 'inativo', 'pausado']).optional(),
      notes: z.string().optional(),
      startDate: z.string().optional().nullable(),
      updateFutureDues: z.boolean().optional(),
      professorId: z.number().optional(),
      avatar: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Banco de dados não disponível");
        
        const orgId = ctx.user.organizationId!;
        const { id, updateFutureDues, ...data } = input;
        
        // Converte strings vazias para null para evitar erros do Postgres (como em datas ou email)
        const cleanData = Object.fromEntries(
          Object.entries(data).map(([k, v]) => [k, v === "" ? null : v])
        );

        const updateData: any = { ...cleanData, updatedAt: new Date() };
        if (updateData.monthlyFee !== undefined && updateData.monthlyFee !== null) {
          updateData.monthlyFee = String(updateData.monthlyFee);
        }
        
        const isUserAdmin = ctx.user.role === 'admin' || ctx.user.openId === ENV.ownerOpenId;
        const condition = isUserAdmin 
          ? and(eq(students.id, id), eq(students.organizationId, orgId))
          : and(eq(students.id, id), eq(students.organizationId, orgId), eq(students.professorId, ctx.user.id));

        const [existing] = await db.select().from(students).where(condition).limit(1);
        if (!existing) throw new TRPCError({ code: "FORBIDDEN", message: "Aluno não encontrado ou sem permissão" });

        // Sincronizar e-mail com a tabela de usuários, se houver alteração
        if (updateData.email && updateData.email !== existing.email) {
          // Verifica se já existe outro usuário com este e-mail
          const [existingUserWithEmail] = await db.select().from(users).where(eq(users.email, updateData.email)).limit(1);
          if (existingUserWithEmail && existingUserWithEmail.studentId !== id) {
             throw new TRPCError({ code: "CONFLICT", message: "Este e-mail já está em uso por outro usuário." });
          }
          
          // Atualiza o e-mail na tabela de usuários caso o aluno já tenha portal de acesso
          await db.update(users).set({ email: updateData.email, updatedAt: new Date() }).where(eq(users.studentId, id));
        }

        await db.update(students).set(updateData).where(eq(students.id, id));

        // Sincronizar vencimentos futuros se solicitado
        if (updateFutureDues && data.dueDay) {
          const unpaidPayments = await db.select()
            .from(paymentDues)
            .where(and(
              eq(paymentDues.organizationId, orgId),
              eq(paymentDues.studentId, id),
              eq(paymentDues.userId, ctx.user.id),
              ne(paymentDues.status, "pago")
            ));

          for (const pay of unpaidPayments) {
            const currentDueDate = new Date(pay.dueDate);
            const newDueDate = new Date(currentDueDate.getFullYear(), currentDueDate.getMonth(), data.dueDay);
            
            // Format to YYYY-MM-DD
            const formattedDate = newDueDate.toISOString().slice(0, 10);

            await db.update(paymentDues)
              .set({ 
                dueDate: formattedDate,
                updatedAt: new Date()
              })
              .where(and(eq(paymentDues.id, pay.id), eq(paymentDues.organizationId, orgId)));
          }
        }
        
        return { success: true };
      } catch (error) {
        return handleDbError(error, "atualizar o aluno");
      }
    }),
    updateStatus: protectedProcedure.input(z.object({
      id: z.number(),
      status: z.enum(['ativo', 'inativo', 'pausado']),
    })).mutation(async ({ ctx, input }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const orgId = ctx.user.organizationId!;
        await db.update(students).set({
          status: input.status,
          updatedAt: new Date(),
        }).where(and(eq(students.id, input.id), eq(students.organizationId, orgId), eq(students.professorId, ctx.user.id), eq(students.userId, ctx.user.id)));
        return { success: true };
      } catch (error) {
        return handleDbError(error, "atualizar o status do aluno");
      }
    }),
    delete: protectedProcedure.input(z.object({
      id: z.number(),
    })).mutation(async ({ ctx, input }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Banco de dados não disponível");
        
        const orgId = ctx.user.organizationId!;
        const isAdmin = ctx.user.role === 'admin' || ctx.user.openId === ENV.ownerOpenId;

        // Fetch student first to check permissions and get studentUserId
        const [student] = await db.select().from(students).where(and(eq(students.id, input.id), eq(students.organizationId, orgId))).limit(1);
        if (!student) throw new Error("Aluno não encontrado");
        
        // Only admin or the assigned professor can delete the student
        if (!isAdmin && student.professorId !== ctx.user.id) {
          throw new Error("Você não tem permissão para remover este aluno");
        }

        // Deletar dependências para evitar erro de FK
        await db.delete(paymentDues).where(and(eq(paymentDues.studentId, input.id), eq(paymentDues.organizationId, orgId)));
        await db.delete(reminders).where(and(eq(reminders.studentId, input.id), eq(reminders.organizationId, orgId)));
        await db.delete(rescheduleRequests).where(and(eq(rescheduleRequests.studentId, input.id), eq(rescheduleRequests.organizationId, orgId)));
        await db.delete(studentEvolution).where(and(eq(studentEvolution.studentId, input.id), eq(studentEvolution.organizationId, orgId)));
        await db.delete(dailyStudyPlans).where(and(eq(dailyStudyPlans.studentId, input.id), eq(dailyStudyPlans.organizationId, orgId)));
        await db.delete(studentGoals).where(and(eq(studentGoals.studentId, input.id), eq(studentGoals.organizationId, orgId)));
        await db.delete(studentTimeline).where(and(eq(studentTimeline.studentId, input.id), eq(studentTimeline.organizationId, orgId)));
        await db.delete(studentFiles).where(and(eq(studentFiles.studentId, input.id), eq(studentFiles.organizationId, orgId)));
        
        if (student.studentUserId) {
          await db.delete(chatMessages).where(and(or(eq(chatMessages.senderId, student.studentUserId), eq(chatMessages.receiverId, student.studentUserId)), eq(chatMessages.organizationId, orgId)));
        }

        await db.delete(lessons).where(and(eq(lessons.studentId, input.id), eq(lessons.organizationId, orgId)));
        await db.delete(students).where(and(eq(students.id, input.id), eq(students.organizationId, orgId)));
        
        if (student.studentUserId) {
          await db.delete(users).where(and(eq(users.id, student.studentUserId), eq(users.organizationId, orgId)));
        }
        
        return { success: true };
      } catch (error) {
        return handleDbError(error, "remover o aluno");
      }
    }),
    search: protectedProcedure.input(z.object({ q: z.string() })).query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      if (!input.q.trim()) return [];
      const orgId = ctx.user.organizationId!;
      const term = `%${input.q.toLowerCase()}%`;
      return db.select({
        id: students.id,
        name: students.name,
        email: students.email,
        status: students.status,
      }).from(students).where(and(
        eq(students.organizationId, orgId),
        eq(students.professorId, ctx.user.id),
        sql`LOWER(name) LIKE ${term} OR LOWER(email) LIKE ${term}`
      )).limit(8);
    }),
  }),

  lessons: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const isUserAdmin = ctx.user.role === 'admin' || ctx.user.openId === ENV.ownerOpenId;
      const orgId = ctx.user.organizationId!;
      return getRecentLessons(orgId, isUserAdmin ? undefined : ctx.user.id, 500);
    }),
    upcoming: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      const orgId = ctx.user.organizationId!;
      const now = new Date();
      now.setHours(0, 0, 0, 0); // Mostrar aulas a partir do início de hoje
      
      const twoWeeksLater = new Date(now);
      twoWeeksLater.setDate(now.getDate() + 14);

      return db.select({
        id: lessons.id,
        title: lessons.title,
        scheduledAt: lessons.scheduledAt,
        duration: lessons.duration,
        status: lessons.status,
        isExperimental: lessons.isExperimental,
        experimentalName: lessons.experimentalName,
        studentName: students.name,
        studentId: students.id,
      }).from(lessons)
        .leftJoin(students, eq(lessons.studentId, students.id))
        .where(and(
          eq(lessons.organizationId, orgId),
          eq(lessons.status, 'agendada'), 
          eq(lessons.userId, ctx.user.id),
          gte(lessons.scheduledAt, new Date()),
          lte(lessons.scheduledAt, twoWeeksLater)
        ))
        .orderBy(asc(lessons.scheduledAt))
        .limit(10);
    }),
    create: protectedProcedure.input(z.object({
      studentId: z.number().nullable().optional(),
      isExperimental: z.boolean().default(false),
      experimentalName: z.string().optional(),
      experimentalPhone: z.string().optional(),
      title: z.string().min(2),
      scheduledAt: z.string(),
      duration: z.number().default(60),
      description: z.string().optional(),
      notes: z.string().optional(),
      instrumentId: z.number().nullable().optional(),
      lessonType: z.enum(['individual', 'turma']).default('individual'),
    })).mutation(async ({ ctx, input }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const orgId = ctx.user.organizationId!;
        const scheduledAt = new Date(input.scheduledAt);
        const endsAt = new Date(scheduledAt.getTime() + input.duration * 60000);
  
        // Segurança: Verificar se o aluno pertence ao usuário logado (se não for experimental)
        if (!input.isExperimental) {
          if (!input.studentId) throw new Error("O campo aluno é obrigatório para aulas comuns.");
          const [ownedStudent] = await db.select({ id: students.id }).from(students)
            .where(and(eq(students.id, input.studentId as number), eq(students.organizationId, orgId), eq(students.professorId, ctx.user.id)))
            .limit(1);
            
          if (!ownedStudent) {
            throw new Error("O aluno selecionado não existe ou não pertence ao seu perfil.");
          }
        } else {
          if (!input.experimentalName) throw new Error("O nome do aluno é obrigatório para aulas experimentais.");
        }

        // Segurança: Verificar se o instrumento pertence ao usuário logado
        if (input.instrumentId) {
          const [ownedInstrument] = await db.select({ id: instruments.id }).from(instruments)
            .where(and(eq(instruments.id, input.instrumentId), eq(instruments.organizationId, orgId), eq(instruments.userId, ctx.user.id)))
            .limit(1);
          if (!ownedInstrument) {
            throw new Error("O instrumento selecionado não pertence ao seu perfil.");
          }
        }
  
        // Prevenção de conflitos (mesmo professor/userId)
        // Se for aula individual, não permite sobreposição com NADA.
        // Se for aula em turma, permite sobreposição com outras aulas em turma, mas não com individuais.
        const conflictQuery = and(
          eq(lessons.organizationId, orgId),
          eq(lessons.userId, ctx.user.id),
          eq(lessons.status, 'agendada'),
          sql`(${lessons.scheduledAt}, (${lessons.scheduledAt} + (${lessons.duration} || ' minutes')::interval)) OVERLAPS (${scheduledAt.toISOString()}::timestamp, ${endsAt.toISOString()}::timestamp)`
        );

        const conflict = await db.select({ id: lessons.id, lessonType: lessons.lessonType }).from(lessons)
          .where(conflictQuery).limit(1);

        if (conflict.length > 0) {
          const conflictingLesson = conflict[0];
          // Se a nova é individual OU a existente é individual, bloqueia.
          // Só permite se AMBAS forem 'turma'.
          if (input.lessonType === 'individual' || conflictingLesson.lessonType === 'individual') {
            throw new Error("Conflito de horário: Já existe uma aula agendada para este período.");
          }
        }

        await db.insert(lessons).values({
          organizationId: orgId,
          userId: ctx.user.id,
          studentId: input.studentId ?? null,
          isExperimental: !!input.isExperimental,
          experimentalName: input.experimentalName ?? null,
          experimentalPhone: input.experimentalPhone ?? null,
          title: input.title,
          scheduledAt: scheduledAt,
          duration: input.duration ?? 60,
          description: input.description ?? null,
          notes: input.notes ?? null,
          instrumentId: input.instrumentId ?? null,
          status: 'agendada',
          lessonType: input.lessonType,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        return { success: true };
      } catch (error) {
        return handleDbError(error, "agendar a aula");
      }
    }),
    update: protectedProcedure.input(z.object({
      id: z.number(),
      title: z.string().min(2).optional(),
      scheduledAt: z.string().optional(),
      duration: z.number().optional(),
      description: z.string().optional(),
      notes: z.string().optional(),
      status: z.enum(['agendada','concluida','cancelada','remarcada','falta']).optional(),
      isExperimental: z.boolean().optional(),
      experimentalName: z.string().optional(),
      experimentalPhone: z.string().optional(),
      studentId: z.number().optional().nullable(),
      instrumentId: z.number().optional().nullable(),
      lessonType: z.enum(['individual', 'turma']).optional(),
      updateSeries: z.boolean().optional(),
    })).mutation(async ({ ctx, input }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const orgId = ctx.user.organizationId!;
        const { id, ...data } = input;
        const updateData: any = { ...data };
        const updateSeries = (input as any).updateSeries === true;

        // Buscar aula atual para pegar o recurringGroupId e data original
        const [currentLesson] = await db.select().from(lessons).where(and(eq(lessons.id, id), eq(lessons.organizationId, orgId), eq(lessons.userId, ctx.user.id))).limit(1);
        if (!currentLesson) throw new Error("Aula não encontrada ou você não tem permissão.");

        // Segurança: Verificar propriedade do aluno se estiver sendo alterado
        if (data.studentId) {
          const [ownedStudent] = await db.select({ id: students.id }).from(students)
            .where(and(eq(students.id, data.studentId), eq(students.organizationId, orgId), eq(students.professorId, ctx.user.id)))
            .limit(1);
          if (!ownedStudent) throw new Error("O aluno selecionado não pertence ao seu perfil.");
        }

        // Segurança: Verificar propriedade do instrumento se estiver sendo alterado
        if (data.instrumentId) {
          const [ownedInstrument] = await db.select({ id: instruments.id }).from(instruments)
            .where(and(eq(instruments.id, data.instrumentId), eq(instruments.organizationId, orgId), eq(instruments.userId, ctx.user.id)))
            .limit(1);
          if (!ownedInstrument) throw new Error("O instrumento selecionado não pertence ao seu perfil.");
        }

        if (data.scheduledAt) {
          const scheduledAt = new Date(data.scheduledAt);
          const duration = data.duration ?? currentLesson.duration;
          const endsAt = new Date(scheduledAt.getTime() + duration * 60000);

          // Prevenção de conflitos para a aula atual
          const conflict = await db.select({ id: lessons.id, lessonType: lessons.lessonType }).from(lessons)
            .where(and(
              eq(lessons.organizationId, orgId),
              eq(lessons.userId, ctx.user.id),
              eq(lessons.status, 'agendada'),
              sql`id != ${id}`,
              sql`(${lessons.scheduledAt}, (${lessons.scheduledAt} + (${lessons.duration} || ' minutes')::interval)) OVERLAPS (${scheduledAt.toISOString()}::timestamp, ${endsAt.toISOString()}::timestamp)`
            )).limit(1);

          if (conflict.length > 0) {
            const conflictingLesson = conflict[0];
            const newLessonType = data.lessonType ?? currentLesson.lessonType;
            if (newLessonType === 'individual' || conflictingLesson.lessonType === 'individual') {
              throw new Error("Conflito de horário: Já existe uma aula agendada para este período.");
            }
          }
          updateData.scheduledAt = scheduledAt;

          // Cancelar lembretes pendentes da aula pois a data/hora mudou
          if (currentLesson && new Date(currentLesson.scheduledAt).getTime() !== scheduledAt.getTime()) {
            await db.update(reminders)
              .set({ status: 'cancelado', cancelledAt: new Date(), updatedAt: new Date() })
              .where(and(
                eq(reminders.lessonId, id),
                eq(reminders.status, 'pendente')
              ));
          }

          // Se for para atualizar a série toda
          if (updateSeries && currentLesson.recurringGroupId) {
            const timeOffset = scheduledAt.getTime() - new Date(currentLesson.scheduledAt).getTime();
            
            // Buscar aulas futuras da série
            const futureLessons = await db.select().from(lessons).where(and(
              eq(lessons.organizationId, orgId),
              eq(lessons.recurringGroupId, currentLesson.recurringGroupId),
              eq(lessons.userId, ctx.user.id),
              gte(lessons.scheduledAt, currentLesson.scheduledAt),
              sql`id != ${id}`
            ));

            // Atualizar cada aula futura
            for (const future of futureLessons) {
              const nextDate = new Date(new Date(future.scheduledAt).getTime() + timeOffset);
              await db.update(lessons).set({
                title: data.title ?? future.title,
                duration: data.duration ?? future.duration,
                notes: data.notes ?? future.notes,
                scheduledAt: nextDate,
                updatedAt: new Date()
              }).where(and(eq(lessons.id, future.id), eq(lessons.organizationId, orgId), eq(lessons.userId, ctx.user.id)));

              // Cancelar lembretes pendentes da aula futura da série pois a data mudou
              await db.update(reminders)
                .set({ status: 'cancelado', cancelledAt: new Date(), updatedAt: new Date() })
                .where(and(
                  eq(reminders.lessonId, future.id),
                  eq(reminders.status, 'pendente')
                ));
            }
          }
        } else if (updateSeries && currentLesson.recurringGroupId) {
          // Se mudou apenas texto (título/notas) e quer atualizar a série
          await db.update(lessons).set({
            title: data.title,
            notes: data.notes,
            duration: data.duration,
            updatedAt: new Date()
          }).where(and(
            eq(lessons.organizationId, orgId),
            eq(lessons.recurringGroupId, currentLesson.recurringGroupId),
            eq(lessons.userId, ctx.user.id),
            gte(lessons.scheduledAt, currentLesson.scheduledAt)
          ));
        }

        await db.update(lessons).set(updateData).where(and(eq(lessons.id, id), eq(lessons.organizationId, orgId), eq(lessons.userId, ctx.user.id)));
        return { success: true };
      } catch (error) {
        return handleDbError(error, "atualizar a aula");
      }
    }),
    updateStatus: protectedProcedure.input(z.object({
      id: z.number(),
      status: z.enum(['agendada','concluida','cancelada','remarcada','falta']),
      scheduledAt: z.string().optional(), // Nova data opcional para remarcação
      rating: z.number().min(1).max(5).optional(),
      updateSeries: z.boolean().optional(),
    })).mutation(async ({ ctx, input }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Banco de dados não disponível");

        const orgId = ctx.user.organizationId!;
        const updateData: any = {
          status: input.status,
          rating: input.rating,
          updatedAt: new Date(),
        };

        // Se a aula foi remarcada com nova data, ela deve voltar ao status 'agendada'
        // para que o job de automação possa gerar lembretes normalmente.
        // O status 'remarcada' sem nova data fica apenas como marcação histórica.
        if (input.status === 'remarcada' && input.scheduledAt) {
          updateData.status = 'agendada';
        }

        // Se estiver remarcando com uma nova data, validar conflitos
        if (input.scheduledAt) {
          const newDate = new Date(input.scheduledAt);
          const [current] = await db.select({ duration: lessons.duration, scheduledAt: lessons.scheduledAt, recurringGroupId: lessons.recurringGroupId }).from(lessons).where(and(eq(lessons.id, input.id), eq(lessons.organizationId, orgId))).limit(1);
          const duration = current?.duration || 60;
          const endsAt = new Date(newDate.getTime() + duration * 60000);

          const conflict = await db.select({ id: lessons.id }).from(lessons)
            .where(and(
              eq(lessons.organizationId, orgId),
              eq(lessons.userId, ctx.user.id),
              eq(lessons.status, 'agendada'),
              sql`id != ${input.id}`,
              sql`(${lessons.scheduledAt}, (${lessons.scheduledAt} + (${lessons.duration} || ' minutes')::interval)) OVERLAPS (${newDate.toISOString()}::timestamp, ${endsAt.toISOString()}::timestamp)`
            )).limit(1);

          if (conflict.length > 0) {
            throw new Error("Conflito: Já existe uma aula agendada para este novo horário.");
          }
          updateData.scheduledAt = newDate;

          // Cancelar lembretes pendentes da aula pois a data/hora mudou
          if (current && new Date(current.scheduledAt).getTime() !== newDate.getTime()) {
            await db.update(reminders)
              .set({ status: 'cancelado', cancelledAt: new Date(), updatedAt: new Date() })
              .where(and(
                eq(reminders.lessonId, input.id),
                eq(reminders.status, 'pendente')
              ));
          }

          // Se for para atualizar a série toda
          if (input.updateSeries && current?.recurringGroupId) {
            const timeOffset = newDate.getTime() - new Date(current.scheduledAt).getTime();
            
            // Buscar aulas futuras da série
            const futureLessons = await db.select().from(lessons).where(and(
              eq(lessons.organizationId, orgId),
              eq(lessons.recurringGroupId, current.recurringGroupId),
              eq(lessons.userId, ctx.user.id),
              gte(lessons.scheduledAt, current.scheduledAt),
              sql`id != ${input.id}`
            ));

            // Atualizar cada aula futura deslocando a data
            for (const future of futureLessons) {
              const nextDate = new Date(new Date(future.scheduledAt).getTime() + timeOffset);
              await db.update(lessons).set({
                scheduledAt: nextDate,
                // Se a aula estava remarcada, volta para agendada para que a automação processe
                status: future.status === 'remarcada' || input.status === 'remarcada' ? 'agendada' : future.status,
                updatedAt: new Date()
              }).where(and(eq(lessons.id, future.id), eq(lessons.organizationId, orgId), eq(lessons.userId, ctx.user.id)));

              // Cancelar lembretes pendentes da aula futura da série pois a data mudou
              await db.update(reminders)
                .set({ status: 'cancelado', cancelledAt: new Date(), updatedAt: new Date() })
                .where(and(
                  eq(reminders.lessonId, future.id),
                  eq(reminders.status, 'pendente')
                ));
            }
          }
        }

        // Correção preventiva para o enum no PostgreSQL
        if (input.status) {
          try {
            await db.execute(sql`ALTER TYPE lesson_status ADD VALUE IF NOT EXISTS 'concluida'`);
            await db.execute(sql`ALTER TYPE lesson_status ADD VALUE IF NOT EXISTS 'cancelada'`);
            await db.execute(sql`ALTER TYPE lesson_status ADD VALUE IF NOT EXISTS 'remarcada'`);
            await db.execute(sql`ALTER TYPE lesson_status ADD VALUE IF NOT EXISTS 'falta'`);
          } catch (e) {
            console.warn("Aviso ao tentar atualizar enum:", e);
          }
        }

        // Cancelar lembretes pendentes associados se a aula mudou para um status não-agendada
        if (input.status === 'cancelada' || input.status === 'concluida' || input.status === 'remarcada' || input.status === 'falta') {
          await db.update(reminders)
            .set({ status: 'cancelado', cancelledAt: new Date(), updatedAt: new Date() })
            .where(and(
              eq(reminders.lessonId, input.id),
              eq(reminders.organizationId, orgId),
              eq(reminders.status, 'pendente')
            ));
        }

        await db.update(lessons).set(updateData).where(and(eq(lessons.id, input.id), eq(lessons.organizationId, orgId), eq(lessons.userId, ctx.user.id)));
        
        return { success: true };
      } catch (error) {
        return handleDbError(error, "atualizar o status da aula");
      }
    }),
    delete: protectedProcedure.input(z.object({
      id: z.number(),
      deleteSeries: z.boolean().optional(),
    })).mutation(async ({ ctx, input }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const orgId = ctx.user.organizationId!;
        const isAdmin = ctx.user.role === 'admin' || ctx.user.openId === ENV.ownerOpenId;
        const deleteSeries = input.deleteSeries === true;

        if (deleteSeries) {
          // Admin can delete series from any professor; others only their own
          const seriesWhere = isAdmin
            ? and(eq(lessons.id, input.id), eq(lessons.organizationId, orgId))
            : and(eq(lessons.id, input.id), eq(lessons.organizationId, orgId), eq(lessons.userId, ctx.user.id));

          const [currentLesson] = await db.select({ recurringGroupId: lessons.recurringGroupId, scheduledAt: lessons.scheduledAt })
            .from(lessons).where(seriesWhere).limit(1);

          if (currentLesson && currentLesson.recurringGroupId) {
            const deleteSeriesWhere = isAdmin
              ? and(eq(lessons.organizationId, orgId), eq(lessons.recurringGroupId, currentLesson.recurringGroupId), gte(lessons.scheduledAt, currentLesson.scheduledAt))
              : and(eq(lessons.organizationId, orgId), eq(lessons.userId, ctx.user.id), eq(lessons.recurringGroupId, currentLesson.recurringGroupId), gte(lessons.scheduledAt, currentLesson.scheduledAt));
            await db.delete(lessons).where(deleteSeriesWhere);
            return { success: true };
          }
        }

        const deleteWhere = isAdmin
          ? and(eq(lessons.id, input.id), eq(lessons.organizationId, orgId))
          : and(eq(lessons.id, input.id), eq(lessons.organizationId, orgId), eq(lessons.userId, ctx.user.id));
        await db.delete(lessons).where(deleteWhere);
        return { success: true };
      } catch (error) {
        return handleDbError(error, "remover a aula");
      }
    }),
    
    // ─ Excluir Aulas em Massa (Filtro por aluno ou Todas) ──────────────────
    deleteBulk: protectedProcedure.input(z.object({
      type: z.enum(['all', 'student']),
      studentId: z.number().optional().nullable()
    })).mutation(async ({ ctx, input }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const orgId = ctx.user.organizationId!;

        if (input.type === 'student') {
          if (!input.studentId) throw new Error("ID do aluno não fornecido");
          await db.delete(lessons).where(and(
             eq(lessons.organizationId, orgId),
             eq(lessons.userId, ctx.user.id),
             eq(lessons.studentId, input.studentId as number),
             eq(lessons.status, 'agendada')
          ));
        } else {
          // Apagar todas as aulas não concluídas do usuário
          await db.delete(lessons).where(and(
             eq(lessons.organizationId, orgId),
             eq(lessons.userId, ctx.user.id),
             eq(lessons.status, 'agendada') // Somente as q ainda vão acontecer (agendada)
          ));
        }
        return { success: true };
      } catch (error) {
        return handleDbError(error, "excluir agendamentos em massa");
      }
    }),

    // ─ Listar aulas de uma semana específica ────────────────────────────────
    listByWeek: protectedProcedure.input(z.object({
      weekStart: z.string(), // ISO string da segunda-feira da semana
    })).query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const orgId = ctx.user.organizationId!;
      const start = new Date(input.weekStart);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + 7);
      return db.select({
        id: lessons.id,
        title: lessons.title,
        scheduledAt: lessons.scheduledAt,
        duration: lessons.duration,
        status: lessons.status,
        rating: lessons.rating,
        description: lessons.description,
        notes: lessons.notes,
        studentName: students.name,
        studentPhone: students.phone,
        isExperimental: lessons.isExperimental,
        experimentalName: lessons.experimentalName,
        instrumentId: instruments.id,
        instrumentName: instruments.name,
        instrumentColor: instruments.color,
        instrumentIcon: instruments.icon,
        lessonType: lessons.lessonType,
      }).from(lessons)
        .leftJoin(students, and(eq(lessons.studentId, students.id), eq(students.organizationId, orgId)))
        .leftJoin(instruments, and(eq(students.instrumentId, instruments.id), eq(students.organizationId, orgId)))
        .where(and(
          eq(lessons.organizationId, orgId),
          eq(lessons.userId, ctx.user.id),
          gte(lessons.scheduledAt, start), 
          lt(lessons.scheduledAt, end)
        ))
        .orderBy(asc(lessons.scheduledAt));
    }),

    listRange: protectedProcedure.input(z.object({
      start: z.string(),
      end: z.string(),
    })).query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      const orgId = ctx.user.organizationId!;
      const start = new Date(input.start);
      const end = new Date(input.end);
      return db.select({
        id: lessons.id,
        title: lessons.title,
        scheduledAt: lessons.scheduledAt,
        duration: lessons.duration,
        status: lessons.status,
        rating: lessons.rating,
        description: lessons.description,
        notes: lessons.notes,
        studentName: students.name,
        studentPhone: students.phone,
        isExperimental: lessons.isExperimental,
        experimentalName: lessons.experimentalName,
        instrumentId: instruments.id,
        instrumentName: instruments.name,
        instrumentColor: instruments.color,
        instrumentIcon: instruments.icon,
        lessonType: lessons.lessonType,
      }).from(lessons)
        .leftJoin(students, and(eq(lessons.studentId, students.id), eq(students.organizationId, orgId)))
        .leftJoin(instruments, and(eq(students.instrumentId, instruments.id), eq(students.organizationId, orgId)))
        .where(and(
          eq(lessons.organizationId, orgId),
          eq(lessons.userId, ctx.user.id),
          gte(lessons.scheduledAt, start), 
          lte(lessons.scheduledAt, end)
        ))
        .orderBy(asc(lessons.scheduledAt));
    }),

    // ─ Verificar conflitos para agendamentos recorrentes ─────────────────────
    checkConflicts: protectedProcedure.input(z.object({
      firstDate: z.string(),
      duration: z.number(),
      weeksCount: z.number().min(1).max(104),
    })).query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      
      const orgId = ctx.user.organizationId!;
      const results = [];
      const base = new Date(input.firstDate);
      
      for (let i = 0; i < input.weeksCount; i++) {
        const d = new Date(base);
        d.setDate(base.getDate() + i * 7);
        const endsAt = new Date(d.getTime() + input.duration * 60000);
        
        const [conflict] = await db.select({ 
          id: lessons.id, 
          studentName: students.name 
        })
          .from(lessons)
          .leftJoin(students, and(eq(lessons.studentId, students.id), eq(lessons.organizationId, orgId)))
          .where(and(
            eq(lessons.organizationId, orgId),
            eq(lessons.userId, ctx.user.id),
            eq(lessons.status, 'agendada'),
            sql`(${lessons.scheduledAt}, (${lessons.scheduledAt} + (${lessons.duration} || ' minutes')::interval)) OVERLAPS (${d.toISOString()}::timestamp, ${endsAt.toISOString()}::timestamp)`
          )).limit(1);
          
        results.push({
          date: d.toISOString(),
          hasConflict: !!conflict,
          conflictingWith: conflict?.studentName || null
        });
      }
      return results;
    }),

    // ─ Criar aulas recorrentes semanalmente ──────────────────
    createBatch: protectedProcedure.input(z.object({
      studentId: z.number(),
      title: z.string().min(2),
      duration: z.number().default(60),
      description: z.string().optional(),
      notes: z.string().optional(),
      instrumentId: z.number().nullable().optional(),
      items: z.array(z.object({
        scheduledAt: z.string(),
        force: z.boolean().default(false)
      })).min(1)
    })).mutation(async ({ ctx, input }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Banco de dados não disponível");

        const orgId = ctx.user.organizationId!;
        // Segurança: Verificar se o aluno pertence ao usuário logado
        const [ownedStudent] = await db.select({ id: students.id }).from(students)
          .where(and(eq(students.id, input.studentId as number), eq(students.organizationId, orgId), eq(students.professorId, ctx.user.id)))
          .limit(1);

        if (!ownedStudent) {
          throw new Error("O aluno selecionado não existe ou não pertence ao seu perfil.");
        }
        
        const rowsToInsert = [];
        const groupId = nanoid();
        for (const item of input.items) {
          const scheduledAt = new Date(item.scheduledAt);
          
          if (!item.force) {
            const endsAt = new Date(scheduledAt.getTime() + input.duration * 60000);
            const [conflict] = await db.select({ id: lessons.id }).from(lessons)
              .where(and(
                eq(lessons.organizationId, orgId),
                eq(lessons.userId, ctx.user.id),
                eq(lessons.status, 'agendada'),
                sql`(${lessons.scheduledAt}, (${lessons.scheduledAt} + (${lessons.duration} || ' minutes')::interval)) OVERLAPS (${scheduledAt.toISOString()}::timestamp, ${endsAt.toISOString()}::timestamp)`
              )).limit(1);
              
            if (conflict) continue; // Pula se tem conflito e não foi forçado
          }
          
          rowsToInsert.push({
            organizationId: orgId,
            userId: ctx.user.id,
            studentId: input.studentId,
            title: input.title,
            scheduledAt: scheduledAt,
            duration: input.duration,
            description: input.description || null,
            notes: input.notes || null,
            instrumentId: input.instrumentId || null,
            rating: null,
            recurringGroupId: groupId,
            status: 'agendada' as const,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
        
        if (rowsToInsert.length > 0) {
          await db.insert(lessons).values(rowsToInsert);
        }
        
        return { success: true, count: rowsToInsert.length };
      } catch (error) {
        return handleDbError(error, "realizar agendamentos em lote");
      }
    }),

    // ─ Criar aulas em turma (mesmo horário, vários alunos) ───────────────
    createTurma: protectedProcedure.input(z.object({
      studentIds: z.array(z.number()).min(1),
      title: z.string().min(2),
      scheduledAt: z.string(),
      duration: z.number().default(60),
      notes: z.string().optional(),
      instrumentId: z.number().nullable().optional(),
      weeksCount: z.number().default(1),
    })).mutation(async ({ ctx, input }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Banco de dados não disponível");

        const orgId = ctx.user.organizationId!;
        
        // Segurança: Verificar se todos os alunos pertencem ao usuário logado
        const ownedStudents = await db.select({ id: students.id, name: students.name }).from(students)
          .where(and(
            inArray(students.id, input.studentIds),
            eq(students.organizationId, orgId),
            eq(students.professorId, ctx.user.id)
          ));

        if (ownedStudents.length !== input.studentIds.length) {
          throw new Error("Um ou mais alunos selecionados não existem ou não pertencem ao seu perfil.");
        }
        
        const rowsToInsert = [];
        const baseDate = new Date(input.scheduledAt);
        
        for (let w = 0; w < input.weeksCount; w++) {
          const d = new Date(baseDate);
          d.setDate(baseDate.getDate() + w * 7);
          const endsAt = new Date(d.getTime() + input.duration * 60000);
          
          const groupId = nanoid(); // Cada sessão/data de turma ganha um groupId unificado

          for (const studentId of input.studentIds) {
            // Verificar se o aluno específico tem conflito de horário.
            // Para turmas, só nos importamos se *este* aluno tem outra aula na mesma hora.
            const [conflict] = await db.select({ id: lessons.id }).from(lessons)
              .where(and(
                eq(lessons.organizationId, orgId),
                eq(lessons.studentId, studentId),
                eq(lessons.status, 'agendada'),
                sql`(${lessons.scheduledAt}, (${lessons.scheduledAt} + (${lessons.duration} || ' minutes')::interval)) OVERLAPS (${d.toISOString()}::timestamp, ${endsAt.toISOString()}::timestamp)`
              )).limit(1);
              
            if (conflict) {
              const studentName = ownedStudents.find(s => s.id === studentId)?.name || 'Aluno';
              throw new Error(`Conflito: ${studentName} já possui aula agendada neste horário.`);
            }

            rowsToInsert.push({
              organizationId: orgId,
              userId: ctx.user.id,
              studentId: studentId,
              title: input.title,
              scheduledAt: d,
              duration: input.duration,
              notes: input.notes || null,
              instrumentId: input.instrumentId || null,
              rating: null,
              recurringGroupId: groupId, // Todas as linhas desta turma terão o mesmo groupId
              status: 'agendada' as const,
              lessonType: 'turma' as const,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }
        }
        
        if (rowsToInsert.length > 0) {
          await db.insert(lessons).values(rowsToInsert);
        }
        
        return { success: true, count: rowsToInsert.length };
      } catch (error) {
        return handleDbError(error, "agendar turma");
      }
    }),
  }),


  instruments: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const isUserAdmin = ctx.user.role === 'admin' || ctx.user.openId === ENV.ownerOpenId;
      const orgId = ctx.user.organizationId!;
      return getInstrumentsWithCount(orgId, isUserAdmin ? undefined : ctx.user.id);
    }),
    create: protectedProcedure.input(z.object({
      name: z.string().min(2),
      category: z.string().min(2),
      color: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const orgId = ctx.user.organizationId!;
        await db.insert(instruments).values({
          organizationId: orgId,
          userId: ctx.user.id,
          name: input.name,
          category: input.category,
          color: input.color ?? '#6366f1',
          createdAt: new Date(),
        });
        return { success: true };
      } catch (error) {
        return handleDbError(error, "cadastrar o instrumento");
      }
    }),
    update: protectedProcedure.input(z.object({
      id: z.number(),
      name: z.string().min(2).optional(),
      category: z.string().min(2).optional(),
      color: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const orgId = ctx.user.organizationId!;
        const isAdmin = ctx.user.role === 'admin' || ctx.user.openId === ENV.ownerOpenId;
        const { id, ...rest } = input;
        const whereClause = isAdmin
          ? and(eq(instruments.id, id), eq(instruments.organizationId, orgId))
          : and(eq(instruments.id, id), eq(instruments.organizationId, orgId), eq(instruments.userId, ctx.user.id));
        await db.update(instruments).set(rest).where(whereClause);
        return { success: true };
      } catch (error) {
        return handleDbError(error, "atualizar o instrumento");
      }
    }),
    delete: protectedProcedure.input(z.object({
      id: z.number(),
    })).mutation(async ({ ctx, input }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const orgId = ctx.user.organizationId!;
        const isAdmin = ctx.user.role === 'admin' || ctx.user.openId === ENV.ownerOpenId;

        // Verify instrument belongs to this org before deleting
        const [inst] = await db.select({ id: instruments.id, userId: instruments.userId })
          .from(instruments)
          .where(and(eq(instruments.id, input.id), eq(instruments.organizationId, orgId)))
          .limit(1);

        if (!inst) return { success: false, message: "Instrumento não encontrado." };
        if (!isAdmin && inst.userId !== ctx.user.id) return { success: false, message: "Sem permissão para remover este instrumento." };

        // Remove instrument reference from students of this org
        await db.update(students).set({ instrumentId: null }).where(and(eq(students.instrumentId, input.id), eq(students.organizationId, orgId)));
        // Remove instrument reference from lessons (agenda) of this org
        await db.update(lessons).set({ instrumentId: null }).where(and(eq(lessons.instrumentId, input.id), eq(lessons.organizationId, orgId)));
        // Delete the instrument
        await db.delete(instruments).where(and(eq(instruments.id, input.id), eq(instruments.organizationId, orgId)));
        return { success: true };
      } catch (error) {
        return handleDbError(error, "remover o instrumento");
      }
    }),
    search: protectedProcedure.input(z.object({ q: z.string() })).query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      const orgId = ctx.user.organizationId!;
      const term = `%${input.q.toLowerCase()}%`;
      return db.select({
        id: instruments.id,
        name: instruments.name,
        category: instruments.category,
      }).from(instruments).where(and(
        eq(instruments.organizationId, orgId),
        eq(instruments.userId, ctx.user.id),
        sql`LOWER(name) LIKE ${term}`
      )).limit(5);
    }),
  }),

  settings: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const orgId = ctx.user.organizationId!;
      return getSettingsByUserId(orgId, ctx.user.id);
    }),

    updateProfile: protectedProcedure.input(z.object({
      name: z.string().min(2).optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      bio: z.string().optional(),
      pixKey: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const orgId = ctx.user.organizationId!;
      const { name, email, phone, bio, pixKey } = input;
      const userFields = { name, email };
      if (userFields.name || userFields.email) {
        await updateUserProfile(orgId, ctx.user.id, userFields);
      }
      await upsertSettings(orgId, ctx.user.id, { phone, bio, pixKey });
      return { success: true };
    }),

    updateSchool: protectedProcedure.input(z.object({
      schoolName: z.string().optional(),
      schoolAddress: z.string().optional(),
      schoolCity: z.string().optional(),
      schoolPhone: z.string().optional(),
      schoolWebsite: z.string().optional(),
      schoolDescription: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const orgId = ctx.user.organizationId!;
      await upsertSettings(orgId, ctx.user.id, input);
      return { success: true };
    }),

    updateNotifications: protectedProcedure.input(z.object({
      notifyLessonReminder: z.boolean().optional(),
      notifyPaymentDue: z.boolean().optional(),
      notifyStudentAbsence: z.boolean().optional(),
      notifyNewStudent: z.boolean().optional(),
      notifyWeeklyReport: z.boolean().optional(),
    })).mutation(async ({ ctx, input }) => {
      const orgId = ctx.user.organizationId!;
      await upsertSettings(orgId, ctx.user.id, {
        notifyLessonReminder: input.notifyLessonReminder !== undefined ? (input.notifyLessonReminder ? 1 : 0) : undefined,
        notifyPaymentDue: input.notifyPaymentDue !== undefined ? (input.notifyPaymentDue ? 1 : 0) : undefined,
        notifyStudentAbsence: input.notifyStudentAbsence !== undefined ? (input.notifyStudentAbsence ? 1 : 0) : undefined,
        notifyNewStudent: input.notifyNewStudent !== undefined ? (input.notifyNewStudent ? 1 : 0) : undefined,
        notifyWeeklyReport: input.notifyWeeklyReport !== undefined ? (input.notifyWeeklyReport ? 1 : 0) : undefined,
      });
      return { success: true };
    }),

    updateIA: protectedProcedure.input(z.object({
      geminiApiKey: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      await upsertSettings(ctx.user.organizationId!, ctx.user.id, { geminiApiKey: input.geminiApiKey });
      return { success: true };
    }),

    updateTheme: protectedProcedure.input(z.object({
      theme: z.enum(['light', 'dark']),
    })).mutation(async ({ ctx, input }) => {
      await upsertSettings(ctx.user.organizationId!, ctx.user.id, { theme: input.theme });
      return { success: true };
    }),

    updateHiddenTabs: protectedProcedure.input(z.object({
      hiddenTabs: z.string(),
    })).mutation(async ({ ctx, input }) => {
      await upsertSettings(ctx.user.organizationId!, ctx.user.id, { hiddenTabs: input.hiddenTabs });
      return { success: true };
    }),

    getAutomation: protectedProcedure.query(async ({ ctx }) => {
      const s = await getSettingsByUserId(ctx.user.organizationId!, ctx.user.id);
      return {
        enabled: s?.automationEnabled === 1,
        lastRun: s?.automationLastRun ?? null,
      };
    }),

    toggleAutomation: protectedProcedure.input(z.object({
      enabled: z.boolean(),
    })).mutation(async ({ ctx, input }) => {
      await upsertSettings(ctx.user.organizationId!, ctx.user.id, {
        automationEnabled: input.enabled ? 1 : 0,
      });
      return { success: true, enabled: input.enabled };
    }),

    updateWhatsAppBot: protectedProcedure.input(z.object({
      whatsappBotUrl: z.string().optional(),
      whatsappBotToken: z.string().optional(),
      whatsappAutoSend: z.boolean().optional(),
    })).mutation(async ({ ctx, input }) => {
      await upsertSettings(ctx.user.organizationId!, ctx.user.id, {
        whatsappBotUrl: input.whatsappBotUrl ?? null,
        whatsappBotToken: input.whatsappBotToken ?? null,
        whatsappAutoSend: input.whatsappAutoSend !== undefined ? (input.whatsappAutoSend ? 1 : 0) : undefined,
      });
      return { success: true };
    }),

    updateAsaasIntegration: protectedProcedure.input(z.object({
      asaasApiKey: z.string().optional(),
      asaasEnabled: z.boolean().optional(),
    })).mutation(async ({ ctx, input }) => {
      await upsertSettings(ctx.user.organizationId!, ctx.user.id, {
        asaasApiKey: input.asaasApiKey ?? null,
        asaasEnabled: input.asaasEnabled !== undefined ? (input.asaasEnabled ? 1 : 0) : undefined,
      });
      return { success: true };
    }),

    exportData: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const orgId = ctx.user.organizationId!;
      // Alunos (somente do usuário logado)
      const allStudents = await db.select({
        id: students.id,
        name: students.name,
        email: students.email,
        phone: students.phone,
        level: students.level,
        status: students.status,
        monthlyFee: students.monthlyFee,
        startDate: students.startDate,
      }).from(students).where(and(eq(students.organizationId, orgId), eq(students.professorId, ctx.user.id))).orderBy(students.name);

      // Aulas (somente do usuário logado)
      const allLessons = await db.select({
        id: lessons.id,
        title: lessons.title,
        status: lessons.status,
        scheduledAt: lessons.scheduledAt,
        duration: lessons.duration,
        rating: lessons.rating,
        studentName: students.name,
      }).from(lessons)
        .leftJoin(students, eq(lessons.studentId, students.id))
        .where(and(eq(lessons.organizationId, orgId), eq(lessons.userId, ctx.user.id)))
        .orderBy(desc(lessons.scheduledAt));


      // Build CSV strings
      const studentsCsv = [
        'ID,Nome,Email,Telefone,Nivel,Status,Mensalidade,Inicio',
        ...allStudents.map(s =>
          [s.id, `"${s.name}"`, `"${s.email ?? ''}"`, `"${s.phone ?? ''}"`,
           s.level, s.status, s.monthlyFee,
           s.startDate ? new Date(s.startDate).toLocaleDateString('pt-BR') : ''].join(',')
        ),
      ].join('\n');

      const lessonsCsv = [
        'ID,Titulo,Aluno,Status,Data,Duracao(min),Avaliacao',
        ...allLessons.map(l =>
          [l.id, `"${l.title}"`, `"${l.studentName ?? ''}"`,
           l.status, new Date(l.scheduledAt).toLocaleDateString('pt-BR'),
           l.duration, l.rating ?? ''].join(',')
        ),
      ].join('\n');

      return { studentsCsv, lessonsCsv };
    }),
  }),

  // ─── LEMBRETES (MÓDULO COMPLETO) ──────────────────────────────────────────────
  reminders: router({

    // ─ Listar com filtros ─────────────────────────────────────────────────────────────
    list: protectedProcedure
      .input(z.object({
        studentId: z.number().nullable().optional(),
        type: z.enum(["aula", "cobranca", "inadimplencia", "manual"]).optional(),
        status: z.enum(["pendente", "enviado", "cancelado"]).optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        const orgId = ctx.user.organizationId!;
        const db = await getDb();
        if (!db) return [];

        // Monta filtros diretamente no SQL para evitar fetch completo
        // ⚠️ Filtra APENAS por organizationId (não por userId) para que lembretes
        // criados pelo automationJob (que usa seu próprio userId) também apareçam
        // e permaneçam como 'enviado' após o markSent. Filtrar por userId causava
        // um revert visual: o lembrete sumia da lista após ser marcado como enviado.
        const conditions: any[] = [
          eq(reminders.organizationId, orgId),
        ];
        if (input?.studentId) conditions.push(eq(reminders.studentId, input.studentId));
        if (input?.type)      conditions.push(eq(reminders.type, input.type));
        if (input?.status)    conditions.push(eq(reminders.status, input.status));
        if (input?.dateFrom)  conditions.push(gte(reminders.scheduledAt, new Date(input.dateFrom)));
        if (input?.dateTo)    conditions.push(lte(reminders.scheduledAt, new Date(input.dateTo)));

        const rows = await db
          .select({
            id: reminders.id,
            type: reminders.type,
            message: reminders.message,
            scheduledAt: reminders.scheduledAt,
            status: reminders.status,
            autoGenerated: reminders.autoGenerated,
            sentAt: reminders.sentAt,
            cancelledAt: reminders.cancelledAt,
            refId: reminders.refId,
            studentId: reminders.studentId,
            lessonId: reminders.lessonId,
            paymentDueId: reminders.paymentDueId,
            createdAt: reminders.createdAt,
            studentName: students.name,
            studentPhone: students.phone,
            externalMessageId: reminders.externalMessageId,
            errorMessage: reminders.errorMessage,
          })
          .from(reminders)
          .leftJoin(students, and(eq(reminders.studentId, students.id), eq(students.organizationId, orgId)))
          .where(and(...conditions))
          .orderBy(desc(reminders.scheduledAt))
          .limit(200); // máximo de 200 registros por vez

        return rows;
      }),

    // ─ Contadores para dashboard ──────────────────────────────────────────────────
    pendingCount: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return 0;
      const orgId = ctx.user.organizationId!;
      // Conta todos os pendentes da organização (não só do userId logado)
      const rows = await db.select({ id: reminders.id }).from(reminders)
        .where(and(eq(reminders.organizationId, orgId), eq(reminders.status, "pendente")));
      return rows.length;
    }),

    // ─ Geração automática de lembretes de AULA (24h antes, semana atual) ───────────────
    generateLessonReminders: protectedProcedure.mutation(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const orgId = ctx.user.organizationId!;
      const now = new Date();
      // Semana atual: segunda a domingo
      const dayOfWeek = now.getDay(); // 0=dom, 1=seg...
      const monday = new Date(now);
      monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      monday.setHours(0, 0, 0, 0);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);

      // Buscar aulas da semana atual que não foram canceladas
      const weekLessons = await db.select({
        id: lessons.id,
        studentId: lessons.studentId,
        title: lessons.title,
        scheduledAt: lessons.scheduledAt,
        status: lessons.status,
        studentName: students.name,
        studentPhone: students.phone,
        instrumentName: instruments.name,
      })
        .from(lessons)
        .leftJoin(students, and(eq(lessons.studentId, students.id), eq(students.organizationId, orgId)))
        .leftJoin(instruments, and(eq(students.instrumentId, instruments.id), eq(instruments.organizationId, orgId)))
        .where(
          and(
            eq(lessons.organizationId, orgId),
            eq(lessons.userId, ctx.user.id),
            eq(lessons.lessonType, "individual"),
            gte(lessons.scheduledAt, monday),
            lte(lessons.scheduledAt, sunday)
          )
        );

      let created = 0;
      let skipped = 0;

      for (const lesson of weekLessons) {
        // Não gerar para aulas canceladas
        if (lesson.status === "cancelada") { skipped++; continue; }

        const lessonDate = new Date(lesson.scheduledAt);
        // Não gerar se a aula já passou
        if (lessonDate <= now) { skipped++; continue; }

        // Lembrete programado para 24h antes da aula
        const reminderTime = new Date(lessonDate.getTime() - 24 * 60 * 60 * 1000);
        // Só gera se a janela de 24h já chegou (1 dia antes da aula)
        if (reminderTime > now) { skipped++; continue; }

        // ✅ TRAVA PRINCIPAL: Se já existe QUALQUER lembrete 'enviado' ou 'cancelado' para esta aula
        // (independente do refId), não criar novo. Isso impede regeneração após "Concluir" ou "Cancelar".
        const alreadySent = await db.select({ id: reminders.id }).from(reminders)
          .where(and(
            eq(reminders.organizationId, orgId),
            eq(reminders.lessonId, lesson.id),
            or(eq(reminders.status, "enviado"), eq(reminders.status, "cancelado"))
          )).limit(1);
        if (alreadySent.length > 0) { skipped++; continue; }

        // Chave de deduplicação
        const dateStr = lessonDate.toISOString().slice(0, 10);
        const refId = `lesson-${lesson.id}-${dateStr}`;

        // Verificar duplicidade por refId (qualquer status: pendente, cancelado)
        const existing = await db.select({ id: reminders.id }).from(reminders)
          .where(
            and(
              eq(reminders.organizationId, orgId),
              or(
                eq(reminders.refId, refId),
                eq(reminders.refId, `lesson-24h-${lesson.id}-${dateStr}`),
                and(
                  eq(reminders.refId, `lesson-24h-${lesson.id}`),
                  sql`abs(extract(epoch from (${reminders.scheduledAt} - ${reminderTime.toISOString()}::timestamp))) < 43200`
                )
              )
            )
          ).limit(1);
        if (existing.length > 0) { skipped++; continue; }

        // Buscar template de aula (prioriza padrão, depois qualquer um do tipo aula cadastrado)
        let [tpl] = await db.select().from(reminderTemplates)
          .where(and(eq(reminderTemplates.organizationId, orgId), eq(reminderTemplates.userId, ctx.user.id), eq(reminderTemplates.type, "aula"), eq(reminderTemplates.isDefault, 1)))
          .limit(1);

        if (!tpl) {
          const anyTpl = await db.select().from(reminderTemplates)
            .where(
              and(
                eq(reminderTemplates.organizationId, orgId),
                eq(reminderTemplates.userId, ctx.user.id),
                eq(reminderTemplates.type, "aula")
              )
            )
            .limit(1);
          if (anyTpl.length > 0) {
            tpl = anyTpl[0];
          }
        }

        const dataAula = lessonDate.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", timeZone: "America/Sao_Paulo" });
        const horaAula = lessonDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
        const bodyTemplate = tpl?.body ?? "Olá {nome}, lembrete: sua aula de {instrumento} será dia {data_aula} às {hora_aula}.";
        const message = bodyTemplate
          .replace(/\{nome\}/g, lesson.studentName ?? "Aluno")
          .replace(/\{instrumento\}/g, lesson.instrumentName ?? "música")
          .replace(/\{data_aula\}/g, dataAula)
          .replace(/\{hora_aula\}/g, horaAula);

        await db.insert(reminders).values({
          organizationId: orgId,
          userId: ctx.user.id,
          studentId: lesson.studentId,
          lessonId: lesson.id,
          type: "aula",
          message,
          scheduledAt: reminderTime,
          status: "pendente",
          autoGenerated: 1,
          refId,
        });
        created++;
      }

      if (created > 0) {
        await notifyUser(ctx.user.id, {
          title: "Lembretes Gerados",
          content: `Foram gerados ${created} novos lembretes de aula manualmente.`
        });
      }

      return { created, skipped };
    }),

    // ─ Geração automática de lembretes de MENSALIDADE (3 dias antes, mês atual) ───────
    generatePaymentReminders: protectedProcedure.mutation(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const orgId = ctx.user.organizationId!;
      const now = new Date();
      const today = now.toISOString().slice(0, 10); // YYYY-MM-DD

      // Buscar chave PIX do professor
      const [userSettings] = await db.select({ pixKey: settings.pixKey })
        .from(settings)
        .where(eq(settings.userId, ctx.user.id))
        .limit(1);
      const pixKey = userSettings?.pixKey ?? null;

      // Buscar TODAS as mensalidades pendentes (qualquer mês/ano)
      const dues = await db.select({
        id: paymentDues.id,
        studentId: paymentDues.studentId,
        amount: paymentDues.amount,
        dueDate: paymentDues.dueDate,
        status: paymentDues.status,
        month: paymentDues.month,
        year: paymentDues.year,
        studentName: students.name,
        studentPhone: students.phone,
        instrumentName: instruments.name,
      })
        .from(paymentDues)
        .leftJoin(students, and(eq(paymentDues.studentId, students.id), eq(students.organizationId, orgId)))
        .leftJoin(instruments, and(eq(students.instrumentId, instruments.id), eq(students.organizationId, orgId)))
        .where(and(
          eq(paymentDues.organizationId, orgId),
          or(eq(paymentDues.status, "pendente"), eq(paymentDues.status, "atrasado")),
          eq(paymentDues.userId, ctx.user.id)
        ));

      let created = 0;
      let skipped = 0;

      for (const due of dues) {
        const dueDate = new Date(String(due.dueDate) + "T12:00:00");
        const dueDateStr = String(due.dueDate).slice(0, 10);
        const isOverdue = dueDateStr < today;

        let reminderTime: Date;
        let type: "cobranca" | "inadimplencia";
        let refId: string;
        let defaultBody: string;

        if (isOverdue) {
          // Mensalidade vencida → lembrete de inadimplência imediato
          type = "inadimplencia";
          refId = `overdue-${due.id}-${today}`;
          reminderTime = new Date(now);
          defaultBody = "Olá {nome}, sua mensalidade de {valor} venceu em {vencimento} e ainda não foi paga. Por favor, entre em contato para regularizar.";
        } else {
          // Mensalidade futura → lembrete 3 dias antes às 9h
          type = "cobranca";
          const reminderDate = new Date(dueDate);
          reminderDate.setDate(dueDate.getDate() - 3);
          reminderDate.setHours(9, 0, 0, 0);
          // Só gera se a janela de 3 dias já chegou
          if (reminderDate > now) { skipped++; continue; }
          reminderTime = reminderDate;
          refId = `payment-${due.id}-${due.year}-${due.month}`;
          defaultBody = "Olá {nome}, sua mensalidade de {valor} vence em {vencimento}. Por favor, efetue o pagamento.";
        }

        // ✅ TRAVA PRINCIPAL: Se já existe QUALQUER lembrete 'enviado' ou 'cancelado' para esta cobrança
        // (independente do refId), não criar novo. Isso impede regeneração após "Concluir" ou "Cancelar".
        const alreadySentPayment = await db.select({ id: reminders.id }).from(reminders)
          .where(and(
            eq(reminders.organizationId, orgId),
            eq(reminders.paymentDueId, due.id),
            or(eq(reminders.status, "enviado"), eq(reminders.status, "cancelado"))
          )).limit(1);
        if (alreadySentPayment.length > 0) { skipped++; continue; }

        // Verificar duplicidade por refId (qualquer status: pendente, cancelado)
        const existing = await db.select({ id: reminders.id }).from(reminders)
          .where(
            and(
              eq(reminders.organizationId, orgId),
              isOverdue
                ? eq(reminders.refId, refId)
                : or(
                    eq(reminders.refId, refId),
                    eq(reminders.refId, `pay-prev-${due.id}`),
                    eq(reminders.refId, `pay-hoje-${due.id}`)
                  )
            )
          ).limit(1);
        if (existing.length > 0) { skipped++; continue; }

        // Buscar template do tipo (prioriza padrão, depois qualquer um do tipo cadastrado)
        let [tpl] = await db.select().from(reminderTemplates)
          .where(and(eq(reminderTemplates.organizationId, orgId), eq(reminderTemplates.userId, ctx.user.id), eq(reminderTemplates.type, type), eq(reminderTemplates.isDefault, 1)))
          .limit(1);

        if (!tpl) {
          const anyTpl = await db.select().from(reminderTemplates)
            .where(
              and(
                eq(reminderTemplates.organizationId, orgId),
                eq(reminderTemplates.userId, ctx.user.id),
                eq(reminderTemplates.type, type)
              )
            )
            .limit(1);
          if (anyTpl.length > 0) {
            tpl = anyTpl[0];
          }
        }

        const vencimento = dueDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });
        const valor = Number(due.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
        const bodyTemplate = tpl?.body ?? defaultBody;
        let message = bodyTemplate
          .replace(/\{nome\}/g, due.studentName ?? "Aluno")
          .replace(/\{valor\}/g, valor)
          .replace(/\{vencimento\}/g, vencimento)
          .replace(/\{instrumento\}/g, due.instrumentName ?? "música")
          .replace(/\{chave_pix\}/g, pixKey ?? "");

        if (pixKey) {
          message += `\n\n💳 *Pagamento via PIX:*\n🔑 Chave: ${pixKey}`;
        }

        await db.insert(reminders).values({
          organizationId: orgId,
          userId: ctx.user.id,
          studentId: due.studentId,
          paymentDueId: due.id,
          type,
          message,
          scheduledAt: reminderTime,
          status: "pendente",
          autoGenerated: 1,
          refId,
        });
        created++;
      }

      if (created > 0) {
        await notifyUser(ctx.user.id, {
          title: "Lembretes Gerados",
          content: `Foram gerados ${created} novos lembretes de cobrança manualmente.`
        });
      }

      return { created, skipped };
    }),

    // ─ Criar lembrete manual ────────────────────────────────────────────────────────────
    create: protectedProcedure
      .input(z.object({
        studentId: z.number().nullable().optional(),
        type: z.enum(["aula", "cobranca", "inadimplencia", "manual"]),
        message: z.string().min(1),
        scheduledAt: z.string(), // ISO
        templateId: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const orgId = ctx.user.organizationId!;
        await db.insert(reminders).values({
          organizationId: orgId,
          userId: ctx.user.id,
          studentId: input.studentId ?? null,
          type: input.type,
          message: input.message,
          scheduledAt: new Date(input.scheduledAt),
          status: "pendente",
          autoGenerated: 0,
          templateId: input.templateId ?? null,
        });
        return { success: true };
      }),

    // ─ Marcar como enviado ───────────────────────────────────────────────────────────
    markSent: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const orgId = ctx.user.organizationId!;
        await db.update(reminders)
          .set({ status: "enviado", sentAt: new Date() })
          .where(and(eq(reminders.id, input.id), eq(reminders.organizationId, orgId)));
        return { success: true };
      }),

    // ─ Disparar via Robô Fly.io ─────────────────────────────────────────────────────
    sendViaBot: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const orgId = ctx.user.organizationId!;
        
        const [rem] = await db.select({
          id: reminders.id,
          message: reminders.message,
          studentName: students.name,
          studentPhone: students.phone,
          guardianPhone: students.guardianPhone,
          birthDate: students.birthDate,
          whatsappBotUrl: settings.whatsappBotUrl,
          whatsappBotToken: settings.whatsappBotToken,
        })
        .from(reminders)
        .leftJoin(students, and(eq(reminders.studentId, students.id), eq(students.organizationId, orgId)))
        .leftJoin(settings, eq(settings.userId, ctx.user.id))
        .where(and(eq(reminders.id, input.id), eq(reminders.organizationId, orgId)))
        .limit(1);

        if (!rem) throw new Error("Lembrete não encontrado.");
        if (!rem.whatsappBotUrl) throw new Error("URL do robô do WhatsApp não configurada nas Configurações.");

        let targetPhone = rem.studentPhone;
        if (rem.birthDate) {
          const birthDate = new Date(rem.birthDate);
          const today = new Date();
          let age = today.getFullYear() - birthDate.getFullYear();
          const m = today.getMonth() - birthDate.getMonth();
          if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
          }
          if (age < 18 && rem.guardianPhone && rem.guardianPhone.trim()) {
            targetPhone = rem.guardianPhone;
          }
        }

        if (!targetPhone) throw new Error("Aluno/Responsável sem telefone cadastrado.");

        const sendRes = await sendWhatsAppMessage({
          url: rem.whatsappBotUrl,
          token: rem.whatsappBotToken,
          phone: targetPhone,
          message: rem.message,
          sessionId: `prof_${ctx.user.id}`,
        });

        if (sendRes.success) {
          await db.update(reminders)
            .set({ status: "enviado", sentAt: new Date(), externalMessageId: sendRes.messageId, errorMessage: null })
            .where(eq(reminders.id, input.id));
          
          await notifyUser(ctx.user.id, {
            title: "Mensagem Enviada",
            content: `Mensagem enviada com sucesso para ${rem.studentName || "Aluno"} (${targetPhone}).`,
          });

          return { success: true, messageId: sendRes.messageId };
        } else {
          await db.update(reminders)
            .set({ errorMessage: sendRes.error })
            .where(eq(reminders.id, input.id));
          throw new Error(sendRes.error);
        }
      }),

    // ─ Cancelar lembrete ────────────────────────────────────────────────────────────
    cancel: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const orgId = ctx.user.organizationId!;
        await db.update(reminders)
          .set({ status: "cancelado", cancelledAt: new Date() })
          .where(and(eq(reminders.id, input.id), eq(reminders.organizationId, orgId)));
        return { success: true };
      }),

    // ─ Excluir lembrete ────────────────────────────────────────────────────────────
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const orgId = ctx.user.organizationId!;

        await db.delete(reminders)
          .where(and(eq(reminders.id, input.id), eq(reminders.organizationId, orgId)));

        return { success: true };
      }),

    // ─ Cancelar lembrete quando aula é cancelada ────────────────────────────────
    syncLessonCancelled: protectedProcedure
      .input(z.object({ lessonId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const orgId = ctx.user.organizationId!;
        await db.update(reminders)
          .set({ status: "cancelado", cancelledAt: new Date() })
          .where(
            and(
              eq(reminders.lessonId, input.lessonId),
              eq(reminders.organizationId, orgId),
              eq(reminders.status, "pendente")
            )
          );
        return { success: true };
      }),

    // ─ Cancelar lembrete quando mensalidade é paga ─────────────────────────────
    syncPaymentPaid: protectedProcedure
      .input(z.object({ paymentDueId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const orgId = ctx.user.organizationId!;
        await db.update(reminders)
          .set({ status: "cancelado", cancelledAt: new Date() })
          .where(
            and(
              eq(reminders.paymentDueId, input.paymentDueId),
              eq(reminders.organizationId, orgId),
              eq(reminders.status, "pendente")
            )
          );
        return { success: true };
      }),

    testNotification: protectedProcedure
      .input(z.object({ title: z.string(), content: z.string() }))
      .mutation(async ({ input }) => {
        const ok = await notifyOwner(input);
        if (!ok) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Falha na comunicação com o serviço de notificações do sistema. Verifique se as permissões de notificação estão ativas."
          });
        }
        return ok;
      }),
  }),

  // ─── WHATSAPP MULTI-SESSÃO (BAILEYS) ──────────────────────────────────────────
  whatsapp: router({
    startSession: protectedProcedure
      .input(z.object({ 
        phoneNumber: z.string().optional(),
        mode: z.enum(["QR_CODE", "PAIRING_CODE"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const [userSet] = await db.select({
          whatsappBotUrl: settings.whatsappBotUrl,
          whatsappBotToken: settings.whatsappBotToken,
        }).from(settings).where(eq(settings.userId, ctx.user.id)).limit(1);

        const sessionId = `prof_${ctx.user.id}`;
        return await startWhatsAppSession({
          url: userSet?.whatsappBotUrl || "",
          token: userSet?.whatsappBotToken || "",
          sessionId,
          phoneNumber: input.phoneNumber || "",
          mode: input.mode,
        });
      }),

    getStatus: protectedProcedure
      .query(async ({ ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const [userSet] = await db.select({
          whatsappBotUrl: settings.whatsappBotUrl,
          whatsappBotToken: settings.whatsappBotToken,
        }).from(settings).where(eq(settings.userId, ctx.user.id)).limit(1);

        const sessionId = `prof_${ctx.user.id}`;
        try {
          return await getWhatsAppSessionStatus({
            url: userSet?.whatsappBotUrl || "",
            token: userSet?.whatsappBotToken || "",
            sessionId,
          });
        } catch (err: any) {
          return { sessionId, status: "DISCONNECTED", phone: "" };
        }
      }),

    logout: protectedProcedure
      .mutation(async ({ ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const [userSet] = await db.select({
          whatsappBotUrl: settings.whatsappBotUrl,
          whatsappBotToken: settings.whatsappBotToken,
        }).from(settings).where(eq(settings.userId, ctx.user.id)).limit(1);

        const sessionId = `prof_${ctx.user.id}`;
        return await logoutWhatsAppSession({
          url: userSet?.whatsappBotUrl || "",
          token: userSet?.whatsappBotToken || "",
          sessionId,
        });
      }),

    testConnection: protectedProcedure
      .mutation(async ({ ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const [userSet] = await db.select({
          phone: settings.phone,
          whatsappBotUrl: settings.whatsappBotUrl,
          whatsappBotToken: settings.whatsappBotToken,
        }).from(settings).where(eq(settings.userId, ctx.user.id)).limit(1);

        if (!userSet?.whatsappBotUrl) {
          throw new Error("URL do robô do WhatsApp não configurada.");
        }

        if (!userSet?.phone) {
          throw new Error("Você precisa cadastrar o seu número de celular nas configurações do Perfil para realizar o teste.");
        }

        const sessionId = `prof_${ctx.user.id}`;
        const sendRes = await sendWhatsAppMessage({
          url: userSet.whatsappBotUrl,
          token: userSet.whatsappBotToken,
          phone: userSet.phone,
          message: "🤖 Teste de Conexão: O robô de mensagens do seu MusicPro está funcionando perfeitamente!",
          sessionId,
        });

        if (!sendRes.success) {
          throw new Error(sendRes.error || "Falha ao enviar mensagem de teste.");
        }

        return { success: true };
      }),
  }),

  // ─── TEMPLATES DE LEMBRETE ──────────────────────────────────────────────────────────
  reminderTemplates: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const orgId = ctx.user.organizationId!;
      const db = await getDb();
      if (!db) return [];
      return db.select().from(reminderTemplates)
        .where(and(eq(reminderTemplates.organizationId, orgId), eq(reminderTemplates.userId, ctx.user.id)))
        .orderBy(asc(reminderTemplates.type));
    }),

    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1).max(100),
        type: z.enum(["aula", "cobranca", "inadimplencia", "manual"]),
        body: z.string().min(1),
        isDefault: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          const orgId = ctx.user.organizationId!;
          const db = await getDb();
          if (!db) throw new Error("Database not available");
          
          if (input.isDefault) {
            await db.update(reminderTemplates)
              .set({ isDefault: 0 })
              .where(and(eq(reminderTemplates.organizationId, orgId), eq(reminderTemplates.userId, ctx.user.id), eq(reminderTemplates.type, input.type)));
          }
          await db.insert(reminderTemplates).values({
            organizationId: orgId,
            userId: ctx.user.id,
            name: input.name,
            type: input.type,
            body: input.body,
            isDefault: input.isDefault ? 1 : 0,
            createdAt: new Date(),
          });
          return { success: true };
        } catch (error) {
          return handleDbError(error, "criar o modelo de lembrete");
        }
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).max(100).optional(),
        type: z.enum(["aula", "cobranca", "inadimplencia", "manual"]).optional(),
        body: z.string().min(1).optional(),
        isDefault: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          const db = await getDb();
          if (!db) throw new Error("Database not available");
          const orgId = ctx.user.organizationId!;
          const { id, isDefault, ...rest } = input;
          const updateData: Record<string, unknown> = { ...rest };
          
          if (isDefault !== undefined) {
            if (isDefault && rest.type) {
              await db.update(reminderTemplates)
                .set({ isDefault: 0 })
                .where(and(eq(reminderTemplates.organizationId, orgId), eq(reminderTemplates.userId, ctx.user.id), eq(reminderTemplates.type, rest.type)));
            }
            updateData.isDefault = isDefault ? 1 : 0;
          }
          
          await db.update(reminderTemplates).set(updateData)
            .where(and(eq(reminderTemplates.id, id), eq(reminderTemplates.organizationId, orgId), eq(reminderTemplates.userId, ctx.user.id)));
          return { success: true };
        } catch (error) {
          return handleDbError(error, "atualizar o modelo de lembrete");
        }
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        try {
          const db = await getDb();
          if (!db) throw new Error("Database not available");
          const orgId = ctx.user.organizationId!;
          await db.delete(reminderTemplates)
            .where(and(eq(reminderTemplates.id, input.id), eq(reminderTemplates.organizationId, orgId), eq(reminderTemplates.userId, ctx.user.id)));
          return { success: true };
        } catch (error) {
          return handleDbError(error, "remover o modelo de lembrete");
        }
      }),
  }),

  // ─── MENSALIDADES (payment_dues) ──────────────────────────────────────────────────────
  paymentDues: router({
    list: protectedProcedure
      .input(z.object({
        month: z.number().optional(),
        year: z.number().optional(),
        status: z.enum(["pendente", "pago", "atrasado"]).optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) return [];
        const orgId = ctx.user.organizationId!;
        const now = new Date();
        const m = input?.month ?? new Date().getMonth() + 1;
        const y = input?.year ?? new Date().getFullYear();
        const rows = await db.select({
          id: paymentDues.id,
          studentId: paymentDues.studentId,
          amount: paymentDues.amount,
          dueDate: paymentDues.dueDate,
          paidAt: paymentDues.paidAt,
          status: paymentDues.status,
          month: paymentDues.month,
          year: paymentDues.year,
          notes: paymentDues.notes,
          asaasId: paymentDues.asaasId,
          asaasPaymentLink: paymentDues.asaasPaymentLink,
          asaasBillingType: paymentDues.asaasBillingType,
          receiptUrl: paymentDues.receiptUrl,
          studentName: students.name,
          studentPhone: students.phone,
          email: students.email,
          lessonType: students.lessonType,
          studentStatus: students.status,
        })
          .from(paymentDues)
          .leftJoin(students, eq(paymentDues.studentId, students.id))
          .where(and(
            eq(paymentDues.organizationId, orgId),
            eq(paymentDues.month, m), 
            eq(paymentDues.year, y), 
            (ctx.user.role === 'admin' || ctx.user.openId === ENV.ownerOpenId) ? undefined : eq(paymentDues.userId, ctx.user.id)
          ))
          .orderBy(asc(paymentDues.dueDate));

        const today = new Date().toISOString().slice(0, 10);
        const mappedRows = rows.map(r => {
          if (r.status === 'pendente' && String(r.dueDate).slice(0, 10) < today) {
            return { ...r, status: 'atrasado' as const };
          }
          return r;
        });

        if (input?.status) return mappedRows.filter(r => r.status === input.status);
        return mappedRows;
      }),

    create: protectedProcedure
      .input(z.object({
        studentId: z.number(),
        amount: z.number(),
        dueDate: z.string(),
        month: z.number(),
        year: z.number(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          const db = await getDb();
          if (!db) throw new Error("Database not available");
          const orgId = ctx.user.organizationId!;
   
          // Security: verify student ownership
          const [ownedStudent] = await db.select({ id: students.id, name: students.name, email: students.email, phone: students.phone, cpf: students.cpf }).from(students)
              .where(and(eq(students.id, input.studentId as number), eq(students.organizationId, orgId), eq(students.professorId, ctx.user.id)))
              .limit(1);
          
          if (!ownedStudent) {
              throw new TRPCError({ code: "FORBIDDEN", message: "O aluno selecionado não existe ou não pertence ao seu perfil." });
          }

          const paymentData: any = {
            organizationId: orgId,
            userId: ctx.user.id,
            studentId: input.studentId,
            amount: input.amount.toFixed(2),
            dueDate: input.dueDate.slice(0, 10),
            month: input.month,
            year: input.year,
            status: "pendente",
            notes: input.notes ?? null,
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          const { createAsaasCustomer, createAsaasCharge } = await import('./utils/asaas');
          const [settingsData] = await db.select({ asaasEnabled: settings.asaasEnabled, asaasApiKey: settings.asaasApiKey }).from(settings).where(eq(settings.userId, ctx.user.id)).limit(1);
          
          if (settingsData && settingsData.asaasEnabled === 1 && settingsData.asaasApiKey) {
            const apiKey = settingsData.asaasApiKey;
            // Get or create Asaas customer
            let asaasCustomerId: string | null = null;
            const [existingCustomer] = await db.select().from(asaasCustomers)
              .where(and(eq(asaasCustomers.studentId, input.studentId), eq(asaasCustomers.organizationId, orgId)))
              .limit(1);

            if (existingCustomer) {
              asaasCustomerId = existingCustomer.asaasCustomerId;
            } else {
              asaasCustomerId = await createAsaasCustomer({
                name: ownedStudent.name || 'Aluno',
                email: ownedStudent.email ?? undefined,
                phone: ownedStudent.phone ?? undefined,
                cpfCnpj: ownedStudent.cpf ?? undefined,
              }, apiKey);
              
              if (asaasCustomerId) {
                await db.insert(asaasCustomers).values({
                  organizationId: orgId,
                  studentId: input.studentId,
                  asaasCustomerId,
                });
              }
            }

            if (asaasCustomerId) {
              const dueDateObj = new Date(input.dueDate);
              const todayObj = new Date();
              todayObj.setHours(0, 0, 0, 0);
              const finalDueDate = dueDateObj < todayObj ? new Date().toISOString().slice(0, 10) : input.dueDate.slice(0, 10);

              const charge = await createAsaasCharge({
                asaasCustomerId,
                billingType: 'UNDEFINED', // Let Asaas decide/offer multiple
                value: Number(input.amount.toFixed(2)),
                dueDate: finalDueDate,
                description: `Mensalidade ${input.month}/${input.year} - ${ownedStudent.name}`,
              }, apiKey);

              if (charge) {
                paymentData.asaasId = charge.id;
                paymentData.asaasPaymentLink = charge.invoiceUrl;
                paymentData.asaasBillingType = charge.billingType;
              }
            }
          }

          await db.insert(paymentDues).values(paymentData);
          return { success: true };
        } catch (error) {
          return handleDbError(error, "gerar a cobrança");
        }
      }),

    markPaid: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        try {
          const db = await getDb();
          if (!db) throw new Error("Database not available");
          const orgId = ctx.user.organizationId!;
          
          const [paymentDetails] = await db
            .select({
              studentName: students.name,
              amount: paymentDues.amount,
            })
            .from(paymentDues)
            .leftJoin(students, eq(paymentDues.studentId, students.id))
            .where(and(eq(paymentDues.id, input.id), eq(paymentDues.organizationId, orgId)))
            .limit(1);

          await db.update(paymentDues)
            .set({ status: "pago", paidAt: new Date(), updatedAt: new Date() })
            .where(and(eq(paymentDues.id, input.id), eq(paymentDues.organizationId, orgId), eq(paymentDues.userId, ctx.user.id)));
          
          // Cancelar lembretes pendentes desta mensalidade
          await db.update(reminders)
            .set({ status: "cancelado", cancelledAt: new Date(), updatedAt: new Date() })
            .where(and(eq(reminders.paymentDueId, input.id), eq(reminders.organizationId, orgId), eq(reminders.userId, ctx.user.id), eq(reminders.status, "pendente")));
          
          if (paymentDetails) {
            const valor = Number(paymentDetails.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
            await notifyUser(ctx.user.id, {
              title: "Pagamento Confirmado",
              content: `O aluno ${paymentDetails.studentName || "Aluno"} teve o pagamento confirmado no valor de ${valor}.`,
            });
          }

          return { success: true };
        } catch (error) {
          return handleDbError(error, "marcar mensalidade como paga");
        }
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        amount: z.number().optional(),
        dueDate: z.string().optional(),
        paidAt: z.string().nullable().optional(),
        status: z.enum(["pendente", "pago", "atrasado"]).optional(),
        notes: z.string().nullable().optional(),
        updateFutureDues: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          const db = await getDb();
          if (!db) throw new Error("Database not available");
          const orgId = ctx.user.organizationId!;
          const { id, updateFutureDues, ...data } = input;
          
          // Buscar registro atual para obter o studentId se necessário
          const currentPayment = await db.select()
            .from(paymentDues)
            .where(and(eq(paymentDues.id, id), eq(paymentDues.organizationId, orgId), eq(paymentDues.userId, ctx.user.id)))
            .limit(1)
            .then(res => res[0]);

          if (!currentPayment) throw new Error("Mensalidade não encontrada");

          const updateData: any = {
            ...data,
            updatedAt: new Date(),
          };

          if (data.dueDate) updateData.dueDate = data.dueDate.slice(0, 10);
          if (data.paidAt !== undefined) {
             updateData.paidAt = data.paidAt ? new Date(data.paidAt) : null;
          } else if (data.status === 'pago' && !currentPayment.paidAt) {
             updateData.paidAt = new Date();
          }
          if (data.amount !== undefined) updateData.amount = data.amount.toFixed(2);

          await db.update(paymentDues)
            .set(updateData)
            .where(and(eq(paymentDues.id, id), eq(paymentDues.organizationId, orgId), eq(paymentDues.userId, ctx.user.id)));

          // Sincronizar vencimentos futuros se solicitado
          if (updateFutureDues && data.dueDate) {
            const newDay = new Date(data.dueDate).getUTCDate();
            
            // Atualizar cadastro do aluno
            await db.update(students)
              .set({ dueDay: newDay, updatedAt: new Date() })
              .where(and(eq(students.id, currentPayment.studentId), eq(students.organizationId, orgId), eq(students.professorId, ctx.user.id)));

            // Atualizar futuras cobranças pendentes
            const unpaidPayments = await db.select()
              .from(paymentDues)
              .where(and(
                eq(paymentDues.organizationId, orgId),
                eq(paymentDues.studentId, currentPayment.studentId),
                eq(paymentDues.userId, ctx.user.id),
                ne(paymentDues.status, "pago"),
                ne(paymentDues.id, id) // não mexer na que acabamos de atualizar
              ));

            for (const pay of unpaidPayments) {
              const currentDueDate = new Date(pay.dueDate);
              const newDueDate = new Date(currentDueDate.getFullYear(), currentDueDate.getMonth(), newDay);
              const formattedDate = newDueDate.toISOString().slice(0, 10);

              await db.update(paymentDues)
                .set({ dueDate: formattedDate, updatedAt: new Date() })
                .where(and(eq(paymentDues.id, pay.id), eq(paymentDues.organizationId, orgId)));
            }
          }
            
          return { success: true };
        } catch (error) {
          return handleDbError(error, "atualizar a mensalidade");
        }
      }),

    getRevenueByDueDay: protectedProcedure
      .input(z.object({
        month: z.number(),
        year: z.number(),
      }))
      .query(async ({ ctx, input }) => {
        try {
          const db = await getDb();
          if (!db) throw new Error("Database not available");
          const orgId = ctx.user.organizationId!;
          
          const payments = await db.select()
            .from(paymentDues)
            .where(and(
              eq(paymentDues.organizationId, orgId),
              eq(paymentDues.userId, ctx.user.id),
              eq(paymentDues.month, input.month),
              eq(paymentDues.year, input.year)
            ));

          const stats = {
            5: 0,
            10: 0,
            15: 0,
            20: 0,
            others: 0,
            total: 0
          };

          for (const p of payments) {
            const dueDate = new Date(p.dueDate);
            const day = dueDate.getUTCDate();
            const amount = Number(p.amount);
            
            if ([5, 10, 15, 20].includes(day)) {
              stats[day as 5|10|15|20] += amount;
            } else {
              stats.others += amount;
            }
            stats.total += amount;
          }

          return stats;
        } catch (error) {
          return handleDbError(error, "obter relatório de vencimentos");
        }
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        try {
          const db = await getDb();
          if (!db) throw new Error("Database not available");
          const orgId = ctx.user.organizationId!;
          const isAdmin = ctx.user.role === 'admin' || ctx.user.openId === ENV.ownerOpenId;
          const whereClause = isAdmin
            ? and(eq(paymentDues.id, input.id), eq(paymentDues.organizationId, orgId))
            : and(eq(paymentDues.id, input.id), eq(paymentDues.organizationId, orgId), eq(paymentDues.userId, ctx.user.id));
          await db.delete(paymentDues).where(whereClause);
          return { success: true };
        } catch (error) {
          return handleDbError(error, "remover a mensalidade");
        }
      }),

    uploadReceipt: protectedProcedure
      .input(z.object({
        paymentDueId: z.number(),
        fileData: z.string(), // Base64
        fileName: z.string(),
        fileType: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          const db = await getDb();
          if (!db) throw new Error("Banco de dados não disponível");
          const orgId = ctx.user.organizationId!;

          // Extrair buffer do base64
          const base64Content = input.fileData.split(';base64,').pop() || input.fileData;
          const buffer = Buffer.from(base64Content, 'base64');
          
          // Gerar nome de arquivo único
          const ext = input.fileName.split('.').pop() || 'dat';
          const storageKey = `receipts/org_${orgId}/user_${ctx.user.id}/pay_${input.paymentDueId}_${nanoid(6)}.${ext}`;
          
          // Salvar no storage
          const { url } = await storagePut(storageKey, buffer, input.fileType);
          
          // Atualizar mensalidade
          await db.update(paymentDues)
            .set({ 
              receiptUrl: url,
              updatedAt: new Date()
            })
            .where(and(
              eq(paymentDues.id, input.paymentDueId), 
              eq(paymentDues.organizationId, orgId), 
              eq(paymentDues.userId, ctx.user.id)
            ));
            
          return { success: true, url };
        } catch (error) {
          return handleDbError(error, "enviar o comprovante");
        }
      }),

    // ─ Gerar mensalidades dos próximos 3 meses (travado) ──────────────
    generateMonthly: protectedProcedure
      .input(z.object({
        studentId: z.number(),
        amount: z.number(),
        dueDay: z.number().min(1).max(28), // dia do vencimento
        startMonth: z.number().min(1).max(12),
        startYear: z.number(),
        monthsCount: z.number().min(1).max(12),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const rows = [];
        for (let i = 0; i < input.monthsCount; i++) {
          let m = input.startMonth - 1 + i; // 0-based
          const y = input.startYear + Math.floor(m / 12);
          m = m % 12;
          const dueDate = new Date(y, m, input.dueDay);
          const month = m + 1; // 1-based

          const orgId = ctx.user.organizationId!;
          // Verificar duplicidade (mesmo aluno, mesmo mês/ano)
          const existing = await db.select({ id: paymentDues.id }).from(paymentDues)
            .where(and(
              eq(paymentDues.organizationId, orgId),
              eq(paymentDues.studentId, input.studentId),
              eq(paymentDues.month, month),
              eq(paymentDues.year, y),
              eq(paymentDues.userId, ctx.user.id),
            )).limit(1);
          if (existing.length > 0) continue; // pular duplicados

          rows.push({
            organizationId: orgId,
            userId: ctx.user.id,
            studentId: input.studentId,
            amount: input.amount.toFixed(2),
            dueDate: dueDate.toISOString().slice(0, 10),
            month,
            year: y,
            status: 'pendente' as const,
            notes: input.notes ?? null,
          });
        }

        if (rows.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (db.insert(paymentDues) as any).values(rows);
        }
        return { success: true, count: rows.length };
      }),

    generateBulkAll: protectedProcedure
      .input(z.object({
        startMonth: z.number().min(1).max(12),
        startYear: z.number(),
        monthsCount: z.number().min(1).max(12),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const orgId = ctx.user.organizationId!;

        const activeStudents = await db.select({
          id: students.id,
          monthlyFee: students.monthlyFee,
          dueDay: students.dueDay
        }).from(students).where(and(
          eq(students.organizationId, orgId),
          eq(students.professorId, ctx.user.id),
          eq(students.status, 'ativo')
        ));

        const rows: any[] = [];
        
        for (const student of activeStudents) {
          const fee = Number(student.monthlyFee);
          if (fee <= 0) continue;

          for (let i = 0; i < input.monthsCount; i++) {
            let m = input.startMonth - 1 + i;
            const y = input.startYear + Math.floor(m / 12);
            m = m % 12;
            const dueDate = new Date(y, m, student.dueDay);
            const month = m + 1;

            const existing = await db.select({ id: paymentDues.id }).from(paymentDues)
              .where(and(
                eq(paymentDues.organizationId, orgId),
                eq(paymentDues.studentId, student.id),
                eq(paymentDues.month, month),
                eq(paymentDues.year, y),
                eq(paymentDues.userId, ctx.user.id),
              )).limit(1);
            
            if (existing.length > 0) continue;

            rows.push({
              organizationId: orgId,
              userId: ctx.user.id,
              studentId: student.id,
              amount: fee.toFixed(2),
              dueDate: dueDate.toISOString().slice(0, 10),
              month,
              year: y,
              status: 'pendente' as const,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }
        }

        if (rows.length > 0) {
          await (db.insert(paymentDues) as any).values(rows);
        }
        
        return { success: true, count: rows.length };
      }),

    // ─ Mensalidades vencidas (não pagas, data já passou) ────────────
    overdue: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      const orgId = ctx.user.organizationId!;
      const today = new Date().toISOString().slice(0, 10);
      const rows = await db.select({
        id: paymentDues.id,
        studentId: paymentDues.studentId,
        amount: paymentDues.amount,
        dueDate: paymentDues.dueDate,
        status: paymentDues.status,
        month: paymentDues.month,
        year: paymentDues.year,
        studentName: students.name,
        studentPhone: students.phone,
      })
        .from(paymentDues)
        .leftJoin(students, and(eq(paymentDues.studentId, students.id), eq(paymentDues.organizationId, orgId)))
        .where(and(
          eq(paymentDues.organizationId, orgId),
          eq(paymentDues.userId, ctx.user.id),
          sql`${paymentDues.dueDate} < ${today}`,
          sql`${paymentDues.status} != 'pago'`
        ))
        .orderBy(asc(paymentDues.dueDate));

      const mappedRows = rows.map(r => {
        if (r.status === 'pendente' && String(r.dueDate).slice(0, 10) < today) {
          return { ...r, status: 'atrasado' as const };
        }
        return r;
      });
      return mappedRows;
    }),

    // ─ Listar mensalidades por aluno (todos os meses) ──────────────
    listByStudent: protectedProcedure
      .input(z.object({ studentId: z.number() }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) return [];
        const orgId = ctx.user.organizationId!;
        const rows = await db.select({
          id: paymentDues.id,
          amount: paymentDues.amount,
          dueDate: paymentDues.dueDate,
          paidAt: paymentDues.paidAt,
          status: paymentDues.status,
          month: paymentDues.month,
          year: paymentDues.year,
          notes: paymentDues.notes,
        }).from(paymentDues)
          .where(and(eq(paymentDues.studentId, input.studentId), eq(paymentDues.organizationId, orgId), eq(paymentDues.userId, ctx.user.id)))
          .orderBy(asc(paymentDues.year), asc(paymentDues.month));

        const today = new Date().toISOString().slice(0, 10);
        const mappedRows = rows.map(r => {
          if (r.status === 'pendente' && String(r.dueDate).slice(0, 10) < today) {
            return { ...r, status: 'atrasado' as const };
          }
          return r;
        });
        return mappedRows;
      }),
  }),

  reports: router({
    getInstrumentStats: protectedProcedure.query(async ({ ctx }) => {
      const isUserAdmin = ctx.user.role === 'admin' || ctx.user.openId === ENV.ownerOpenId;
      const orgId = ctx.user.organizationId!;
      return getInstrumentsWithCount(orgId, isUserAdmin ? undefined : ctx.user.id);
    }),
    getFinanceiroDetails: protectedProcedure
      .input(z.object({ month: z.number(), year: z.number() }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const orgId = ctx.user.organizationId!;
        const userId = (ctx.user.role === 'admin' || ctx.user.openId === ENV.ownerOpenId) ? undefined : ctx.user.id;

        const payments = await db.select({
          status: paymentDues.status,
          amount: paymentDues.amount,
          studentStatus: students.status,
          dueDate: paymentDues.dueDate,
        }).from(paymentDues)
          .leftJoin(students, eq(paymentDues.studentId, students.id))
          .where(and(
            eq(paymentDues.organizationId, orgId),
            userId ? eq(paymentDues.userId, userId) : undefined,
            eq(paymentDues.month, input.month),
            eq(paymentDues.year, input.year)
          ));

        const summary = {
          pago: 0,
          pendente: 0,
          atrasado: 0,
          total: 0
        };

        const today = new Date().toISOString().slice(0, 10);

        payments.forEach(p => {
          const amt = Number(p.amount);
          const isAtrasado = p.status === 'atrasado' || (p.status === 'pendente' && String(p.dueDate).slice(0, 10) < today);
          if (p.status === 'pago') {
            summary.pago += amt;
            summary.total += amt;
          } else if (p.studentStatus === 'ativo') {
            if (isAtrasado) summary.atrasado += amt;
            else summary.pendente += amt;
            summary.total += amt;
          }
        });

        return summary;
      }),

    getDespesasDetails: protectedProcedure
      .input(z.object({ month: z.number(), year: z.number() }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const orgId = ctx.user.organizationId!;
        const userId = (ctx.user.role === 'admin' || ctx.user.openId === ENV.ownerOpenId) ? undefined : ctx.user.id;

        const expensesList = await db.select({
          amount: expenses.amount,
          category: expenses.category,
          status: expenses.status,
        }).from(expenses)
          .where(and(
            eq(expenses.organizationId, orgId),
            userId ? eq(expenses.userId, userId) : undefined,
            sql`EXTRACT(MONTH FROM ${expenses.date}) = ${input.month}`,
            sql`EXTRACT(YEAR FROM ${expenses.date}) = ${input.year}`
          ));

        let total = 0;
        let pago = 0;
        let pendente = 0;
        const byCategory: Record<string, number> = {};

        expensesList.forEach(e => {
          const amt = Number(e.amount);
          total += amt;
          if (e.status === 'pago') pago += amt;
          else pendente += amt;
          byCategory[e.category] = (byCategory[e.category] || 0) + amt;
        });

        const categories = Object.keys(byCategory).map(k => ({
          name: k,
          value: byCategory[k]
        }));

        return { total, pago, pendente, categories };
      }),

    getProjecao6Meses: protectedProcedure
      .input(z.object({ month: z.number(), year: z.number() }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const orgId = ctx.user.organizationId!;
        const userId = (ctx.user.role === 'admin' || ctx.user.openId === ENV.ownerOpenId) ? undefined : ctx.user.id;

        const activeStudents = await db.select({ monthlyFee: students.monthlyFee }).from(students)
          .where(and(
            eq(students.organizationId, orgId),
            userId ? eq(students.professorId, userId) : undefined,
            eq(students.status, 'ativo')
          ));
        const receitaBase = activeStudents.reduce((acc, s) => acc + Number(s.monthlyFee || 0), 0);

        const recurringExpenses = await db.select({ amount: expenses.amount }).from(expenses)
          .where(and(
            eq(expenses.organizationId, orgId),
            userId ? eq(expenses.userId, userId) : undefined,
            eq(expenses.recurrence, 'mensal')
          ));
        const despesaBase = recurringExpenses.reduce((acc, e) => acc + Number(e.amount || 0), 0);

        const MONTHS_PT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
        const projection = [];

        let currentM = input.month;
        let currentY = input.year;

        for (let i = 0; i < 6; i++) {
          let m = currentM + i;
          let y = currentY;
          while (m > 12) { m -= 12; y += 1; }

          projection.push({
            monthName: `${MONTHS_PT[m - 1]}/${y}`,
            month: m,
            year: y,
            receita: receitaBase,
            despesa: despesaBase,
            lucro: receitaBase - despesaBase
          });
        }

        return {
          receitaBase,
          despesaBase,
          lucroBase: receitaBase - despesaBase,
          projection
        };
      }),

    generateAsaasCharge: protectedProcedure
      .input(z.object({
        paymentDueId: z.number(),
        billingType: z.enum(["PIX", "CREDIT_CARD"]),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

        const orgId = ctx.user.organizationId!;
        const professorId = ctx.user.id;

        // Security Lock
        const { createAsaasCustomer, createAsaasCharge, getAsaasPixQrCode } = await import('./utils/asaas');
        const [settingsData] = await db.select({ asaasEnabled: settings.asaasEnabled, asaasApiKey: settings.asaasApiKey }).from(settings).where(eq(settings.userId, professorId)).limit(1);
        if (!settingsData || settingsData.asaasEnabled !== 1 || !settingsData.asaasApiKey) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Geração via Asaas não está disponível para esta conta. Configure a Chave da API." });
        }
        const apiKey = settingsData.asaasApiKey;

        // Fetch payment due
        const [due] = await db.select().from(paymentDues)
          .where(and(eq(paymentDues.id, input.paymentDueId), eq(paymentDues.userId, professorId)))
          .limit(1);

        if (!due) throw new TRPCError({ code: "NOT_FOUND", message: "Mensalidade não encontrada" });
        if (due.asaasId) throw new TRPCError({ code: "BAD_REQUEST", message: "Esta mensalidade já possui uma cobrança gerada no Asaas" });

        // Fetch student
        const [student] = await db.select().from(students)
          .where(and(eq(students.id, due.studentId), eq(students.organizationId, orgId)))
          .limit(1);

        if (!student) throw new TRPCError({ code: "NOT_FOUND", message: "Aluno não encontrado" });

        // Get or create Asaas customer
        let asaasCustomerId: string;
        const [existingCustomer] = await db.select().from(asaasCustomers)
          .where(and(eq(asaasCustomers.studentId, student.id), eq(asaasCustomers.organizationId, orgId)))
          .limit(1);

        if (existingCustomer) {
          asaasCustomerId = existingCustomer.asaasCustomerId;
        } else {
          asaasCustomerId = await createAsaasCustomer({
            name: student.name,
            email: student.email ?? undefined,
            phone: student.phone ?? undefined,
            cpfCnpj: student.cpf ?? undefined,
          }, apiKey);
          await db.insert(asaasCustomers).values({
            organizationId: orgId,
            studentId: student.id,
            asaasCustomerId,
          });
        }

        const dueDateObj = new Date(due.dueDate);
        const todayObj = new Date();
        todayObj.setHours(0, 0, 0, 0);
        const finalDueDate = dueDateObj < todayObj ? new Date().toISOString().slice(0, 10) : due.dueDate;

        // Create charge on Asaas
        const charge = await createAsaasCharge({
          asaasCustomerId,
          billingType: input.billingType,
          value: Number(due.amount),
          dueDate: finalDueDate,
          description: `Mensalidade ${due.month}/${due.year} - ${student.name}`,
        }, apiKey);

        // Fetch PIX QR code if PIX
        let pixPayload: string | null = null;
        let pixQrCode: string | null = null;
        if (input.billingType === "PIX") {
          try {
            const pix = await getAsaasPixQrCode(charge.id, apiKey);
            pixPayload = pix.payload;
            pixQrCode = pix.encodedImage;
          } catch (e) {
            console.error("[Asaas] Erro ao buscar QR code PIX:", e);
          }
        }

        // Persist Asaas charge data
        const paymentLink = input.billingType === "PIX" ? (pixPayload ?? charge.invoiceUrl) : charge.invoiceUrl;
        await db.update(paymentDues)
          .set({
            asaasId: charge.id,
            asaasPaymentLink: paymentLink,
            asaasBillingType: input.billingType,
            updatedAt: new Date(),
          })
          .where(eq(paymentDues.id, input.paymentDueId));

        return {
          asaasId: charge.id,
          paymentLink,
          pixQrCode,
          billingType: input.billingType,
        };
      }),

    cancelAsaasCharge: protectedProcedure
      .input(z.object({ paymentDueId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

        const [due] = await db.select().from(paymentDues)
          .where(and(eq(paymentDues.id, input.paymentDueId), eq(paymentDues.userId, ctx.user.id)))
          .limit(1);

        if (!due) throw new TRPCError({ code: "NOT_FOUND", message: "Mensalidade não encontrada" });
        if (!due.asaasId) throw new TRPCError({ code: "BAD_REQUEST", message: "Esta mensalidade não possui cobrança no Asaas" });

        await deleteAsaasCharge(due.asaasId);

        await db.update(paymentDues)
          .set({ asaasId: null, asaasPaymentLink: null, asaasBillingType: null, updatedAt: new Date() })
          .where(eq(paymentDues.id, input.paymentDueId));

        return { success: true };
      }),
    
    getFrequencyDetails: protectedProcedure
      .input(z.object({ month: z.number(), year: z.number() }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const orgId = ctx.user.organizationId!;
        const userId = (ctx.user.role === 'admin' || ctx.user.openId === ENV.ownerOpenId) ? undefined : ctx.user.id;

        const startOfMonth = new Date(input.year, input.month - 1, 1);
        const endOfMonth = new Date(input.year, input.month, 0, 23, 59, 59, 999);

        return db.select({
          id: lessons.id,
          date: lessons.scheduledAt,
          studentName: students.name,
          professorName: users.name,
          status: lessons.status,
          observation: lessons.title,
        })
        .from(lessons)
        .leftJoin(students, eq(lessons.studentId, students.id))
        .leftJoin(users, eq(lessons.userId, users.id))
        .where(and(
          eq(lessons.organizationId, orgId),
          userId ? eq(lessons.userId, userId) : undefined,
          gte(lessons.scheduledAt, startOfMonth),
          lte(lessons.scheduledAt, endOfMonth)
        ))
        .orderBy(desc(lessons.scheduledAt));
      }),

    getEvolutionDetails: protectedProcedure
      .query(async ({ ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const orgId = ctx.user.organizationId!;
        const userId = (ctx.user.role === 'admin' || ctx.user.openId === ENV.ownerOpenId) ? undefined : ctx.user.id;

        return db.select({
          studentName: students.name,
          technical: studentEvolution.technical,
          rhythm: studentEvolution.rhythm,
          harmony: studentEvolution.harmony,
          reading: studentEvolution.reading,
          recordedAt: studentEvolution.recordedAt,
        })
        .from(studentEvolution)
        .leftJoin(students, eq(studentEvolution.studentId, students.id))
        .where(and(
          eq(studentEvolution.organizationId, orgId),
          userId ? eq(students.professorId, userId) : undefined
        ))
        .orderBy(desc(studentEvolution.recordedAt));
      }),

    getAlunosReport: protectedProcedure
      .query(async ({ ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const orgId = ctx.user.organizationId!;
        const userId = (ctx.user.role === 'admin' || ctx.user.openId === ENV.ownerOpenId) ? undefined : ctx.user.id;

        return db.select({
          id: students.id,
          name: students.name,
          professorName: users.name,
          instrumentName: instruments.name,
          monthlyFee: students.monthlyFee,
          status: students.status,
        })
        .from(students)
        .leftJoin(users, eq(students.professorId, users.id))
        .leftJoin(instruments, eq(students.instrumentId, instruments.id))
        .where(and(
          eq(students.organizationId, orgId),
          userId ? eq(students.professorId, userId) : undefined
        ))
        .orderBy(students.name);
      }),

    getModalidadeStats: protectedProcedure
      .input(z.object({ month: z.number(), year: z.number() }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const orgId = ctx.user.organizationId!;
        const userId = (ctx.user.role === 'admin' || ctx.user.openId === ENV.ownerOpenId) ? undefined : ctx.user.id;

        // 1. Distribuição de alunos por modalidade (ativos)
        const studentStats = await db.select({
          lessonType: students.lessonType,
          count: sql<number>`CAST(count(*) AS INT)`,
        })
        .from(students)
        .where(and(
          eq(students.organizationId, orgId),
          userId ? eq(students.professorId, userId) : undefined,
          eq(students.status, 'ativo')
        ))
        .groupBy(students.lessonType);

        // 2. Faturamento por modalidade (recebido e a receber)
        const revenueStats = await db.select({
          lessonType: students.lessonType,
          recebido: sql<number>`CAST(sum(CASE WHEN ${paymentDues.status} = 'pago' THEN CAST(${paymentDues.amount} AS DECIMAL) ELSE 0 END) AS FLOAT)`,
          aReceber: sql<number>`CAST(sum(CASE WHEN ${paymentDues.status} IN ('pendente', 'atrasado') THEN CAST(${paymentDues.amount} AS DECIMAL) ELSE 0 END) AS FLOAT)`,
          total: sql<number>`CAST(sum(CASE WHEN ${paymentDues.status} = 'pago' THEN CAST(${paymentDues.amount} AS DECIMAL) ELSE 0 END) AS FLOAT)`, // Mantendo 'total' igual a 'recebido' para compatibilidade caso outro lugar use, ou podemos deixar como a soma de tudo. Como antes filtrava apenas por 'pago', o 'total' de antes era apenas o pago.
        })
        .from(paymentDues)
        .leftJoin(students, eq(paymentDues.studentId, students.id))
        .where(and(
          eq(paymentDues.organizationId, orgId),
          userId ? eq(paymentDues.userId, userId) : undefined,
          eq(paymentDues.month, input.month),
          eq(paymentDues.year, input.year)
        ))
        .groupBy(students.lessonType);

        return {
          students: studentStats,
          revenue: revenueStats
        };
      }),
  }),

  announcements: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const orgId = ctx.user.organizationId!;
      return db.select({
        id: announcements.id,
        title: announcements.title,
        content: announcements.content,
        important: announcements.important,
        targetStudentId: announcements.targetStudentId,
        createdAt: announcements.createdAt,
        authorName: users.name,
      })
      .from(announcements)
      .leftJoin(users, eq(announcements.userId, users.id))
      .where(and(eq(announcements.organizationId, orgId), eq(announcements.userId, ctx.user.id)))
      .orderBy(desc(announcements.createdAt));
    }),
    create: protectedProcedure.input(z.object({
      title: z.string(),
      content: z.string(),
      important: z.boolean().default(false),
      targetStudentId: z.number().nullable().optional(),
    })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const orgId = ctx.user.organizationId!;
      await db.insert(announcements).values({
        organizationId: orgId,
        userId: ctx.user.id,
        title: input.title,
        content: input.content,
        important: input.important,
        targetStudentId: input.targetStudentId ?? null,
      });
      return { success: true };
    }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const orgId = ctx.user.organizationId!;
      await db.delete(announcements).where(and(eq(announcements.id, input.id), eq(announcements.organizationId, orgId), eq(announcements.userId, ctx.user.id)));
      return { success: true };
    }),
  }),

  chat: router({
    getMessages: protectedProcedure.input(z.object({ withUserId: z.number() })).query(async ({ ctx, input }) => {
       const db = await getDb();
       if (!db) throw new Error("Database not available");
       const orgId = ctx.user.organizationId!;
       return db.select({
         id: chatMessages.id,
         senderId: chatMessages.senderId,
         content: chatMessages.content,
         createdAt: chatMessages.createdAt,
         isRead: chatMessages.isRead,
         isMe: sql`${chatMessages.senderId} = ${ctx.user.id}`,
       }).from(chatMessages)
         .where(and(
           eq(chatMessages.organizationId, orgId),
           or(
             and(eq(chatMessages.senderId, ctx.user.id), eq(chatMessages.receiverId, input.withUserId)),
             and(eq(chatMessages.senderId, input.withUserId), eq(chatMessages.receiverId, ctx.user.id))
           )
         ))
         .orderBy(asc(chatMessages.createdAt));
    }),
    send: protectedProcedure.input(z.object({ receiverId: z.number(), content: z.string() })).mutation(async ({ ctx, input }) => {
       const db = await getDb();
       if (!db) throw new Error("Database not available");
       const orgId = ctx.user.organizationId!;
       await db.insert(chatMessages).values({
         organizationId: orgId,
         senderId: ctx.user.id,
         receiverId: input.receiverId,
         content: input.content,
       });
       return { success: true };
    }),
    unreadCount: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const orgId = ctx.user.organizationId!;
      const [result] = await db.select({ count: sql<number>`CAST(count(*) AS INT)` })
        .from(chatMessages)
        .where(and(eq(chatMessages.organizationId, orgId), eq(chatMessages.receiverId, ctx.user.id), eq(chatMessages.isRead, false)));
      return result?.count || 0;
    }),
    markAsRead: protectedProcedure.input(z.object({ fromUserId: z.number() })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const orgId = ctx.user.organizationId!;
      await db.update(chatMessages)
        .set({ isRead: true })
        .where(and(
          eq(chatMessages.organizationId, orgId),
          eq(chatMessages.senderId, input.fromUserId),
          eq(chatMessages.receiverId, ctx.user.id),
          eq(chatMessages.isRead, false)
        ));
      return { success: true };
    }),
  }),

  reschedule: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const orgId = ctx.user.organizationId!;
      return db.select({
        id: rescheduleRequests.id,
        studentName: students.name,
        lessonTitle: lessons.title,
        reason: rescheduleRequests.reason,
        preferredDates: rescheduleRequests.preferredDates,
        status: rescheduleRequests.status,
        createdAt: rescheduleRequests.createdAt,
      })
      .from(rescheduleRequests)
      .leftJoin(students, eq(rescheduleRequests.studentId, students.id))
      .leftJoin(lessons, eq(rescheduleRequests.lessonId, lessons.id))
      .where(and(eq(rescheduleRequests.organizationId, orgId), eq(students.professorId, ctx.user.id)))
      .orderBy(desc(rescheduleRequests.createdAt));
    }),
    pendingCount: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const orgId = ctx.user.organizationId!;
      const [result] = await db.select({ count: sql<number>`CAST(count(*) AS INT)` })
        .from(rescheduleRequests)
        .leftJoin(students, eq(rescheduleRequests.studentId, students.id))
        .where(and(eq(rescheduleRequests.organizationId, orgId), eq(students.professorId, ctx.user.id), eq(rescheduleRequests.status, 'pendente')));
      return result?.count || 0;
    }),
    respond: protectedProcedure.input(z.object({ id: z.number(), status: z.enum(['aprovada', 'recusada']) })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const orgId = ctx.user.organizationId!;
      await db.update(rescheduleRequests).set({ status: input.status }).where(and(eq(rescheduleRequests.id, input.id), eq(rescheduleRequests.organizationId, orgId)));
      return { success: true };
    }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const orgId = ctx.user.organizationId!;
      await db.delete(rescheduleRequests).where(and(eq(rescheduleRequests.id, input.id), eq(rescheduleRequests.organizationId, orgId)));
      return { success: true };
    }),
  }),

  studentPortal: router({
    getDashboard: studentProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      let studentId = ctx.user.studentId;

      if (!studentId) {
        const [found] = await db.select({ id: students.id }).from(students).where(eq(students.studentUserId, ctx.user.id)).limit(1);
        if (found) studentId = found.id;
      }

      if (!studentId) {
        throw new Error("Acesso não autorizado ou perfil de aluno incompleto.");
      }
      
      const orgId = ctx.user.organizationId!;
      const now = new Date();
      
      const [student] = await db.select().from(students).where(eq(students.id, studentId)).limit(1);
      
      // Parse permissions
      let permissions = {
        canSeeFinanceiro: true,
        canSeeProgress: true,
        canSeeFiles: true,
        canSeeSchedule: true,
        canSeeMessages: true,
      };

      if (student.permissions) {
        try {
          const parsed = JSON.parse(student.permissions);
          permissions = { ...permissions, ...parsed };
        } catch (e) {
          console.error("[studentPortal] Error parsing permissions for student", studentId, e);
        }
      }

      const [
        teacher,
        upcoming,
        timeline,
        dbAnnouncements,
        materials,
        statsDone,
        statsPending,
        statsTotalRecent,
        statsDoneRecent,
        payments,
        latestMessages,
        pendingGoals
      ] = await Promise.all([
        db.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, student.professorId)).limit(1).then(res => res[0]),
        
        // Upcoming (Schedule)
        permissions.canSeeSchedule 
          ? db.select({
              id: lessons.id,
              title: lessons.title,
              scheduledAt: lessons.scheduledAt,
              status: lessons.status,
              instrumentId: lessons.instrumentId,
            }).from(lessons)
              .where(and(eq(lessons.studentId, studentId), eq(lessons.organizationId, orgId), gte(lessons.scheduledAt, new Date()), eq(lessons.status, 'agendada')))
              .orderBy(asc(lessons.scheduledAt))
              .limit(5)
          : Promise.resolve([]),

        // Timeline (Progress)
        permissions.canSeeProgress
          ? db.select().from(studentTimeline)
              .where(and(eq(studentTimeline.studentId, studentId), eq(studentTimeline.organizationId, orgId)))
              .orderBy(desc(studentTimeline.achievedAt))
              .limit(5)
          : Promise.resolve([]),

        db.select({
          id: announcements.id,
          title: announcements.title,
          author: users.name,
          date: announcements.createdAt,
          important: announcements.important,
          content: announcements.content,
        })
        .from(announcements)
        .leftJoin(users, eq(announcements.userId, users.id))
        .where(and(
          eq(announcements.organizationId, orgId),
          eq(announcements.userId, student.professorId),
          sql`(${announcements.targetStudentId} IS NULL OR ${announcements.targetStudentId} = ${studentId})`
        ))
        .orderBy(desc(announcements.createdAt))
        .limit(10),

        // Materials (Files)
        permissions.canSeeFiles
          ? db.select().from(studentFiles)
              .where(and(eq(studentFiles.studentId, studentId), eq(studentFiles.organizationId, orgId)))
              .orderBy(desc(studentFiles.createdAt))
              .limit(4)
          : Promise.resolve([]),

        db.select({ count: sql<number>`CAST(count(*) AS INT)` }).from(lessons).where(and(eq(lessons.studentId, studentId), eq(lessons.organizationId, orgId), eq(lessons.status, 'concluida'))).then(res => res[0]),
        db.select({ count: sql<number>`CAST(count(*) AS INT)` }).from(studentGoals).where(and(eq(studentGoals.studentId, studentId), eq(studentGoals.organizationId, orgId), eq(studentGoals.status, 'pendente'))).then(res => res[0]),
        db.select({ count: sql<number>`CAST(count(*) AS INT)` }).from(lessons).where(and(eq(lessons.studentId, studentId), eq(lessons.organizationId, orgId), gte(lessons.scheduledAt, new Date(new Date().setMonth(new Date().getMonth() - 3))), ne(lessons.status, 'cancelada'))).then(res => res[0]),
        db.select({ count: sql<number>`CAST(count(*) AS INT)` }).from(lessons).where(and(eq(lessons.studentId, studentId), eq(lessons.organizationId, orgId), gte(lessons.scheduledAt, new Date(new Date().setMonth(new Date().getMonth() - 3))), eq(lessons.status, 'concluida'))).then(res => res[0]),
        
        // Payments (Financeiro)
        permissions.canSeeFinanceiro
          ? db.select().from(paymentDues)
              .where(and(eq(paymentDues.studentId, studentId), eq(paymentDues.organizationId, orgId)))
              .orderBy(desc(paymentDues.dueDate))
              .limit(3)
          : Promise.resolve([]),

        // Latest Messages
        permissions.canSeeMessages !== false
          ? db.select({
              id: chatMessages.id,
              content: chatMessages.content,
              createdAt: chatMessages.createdAt,
              senderName: users.name,
              isMe: sql`${chatMessages.senderId} = ${ctx.user.id}`,
            }).from(chatMessages)
              .leftJoin(users, eq(chatMessages.senderId, users.id))
              .where(and(
                eq(chatMessages.organizationId, orgId),
                sql`(${chatMessages.senderId} = ${ctx.user.id} OR ${chatMessages.receiverId} = ${ctx.user.id})`
              ))
              .orderBy(desc(chatMessages.createdAt))
              .limit(3)
          : Promise.resolve([]),
          
        // Pending Exercises (Goals)
        db.select({
          id: studentGoals.id,
          title: studentGoals.title,
          status: studentGoals.status,
          createdAt: studentGoals.createdAt,
        }).from(studentGoals)
          .where(and(eq(studentGoals.studentId, studentId), eq(studentGoals.organizationId, orgId), eq(studentGoals.status, 'pendente')))
          .orderBy(desc(studentGoals.createdAt))
          .limit(5)
      ]);

      const frequency = statsTotalRecent.count > 0 ? Math.round((statsDoneRecent.count / statsTotalRecent.count) * 100) : 100;

      return {
        upcomingLessons: upcoming,
        recentActivities: timeline,
        announcements: dbAnnouncements.map(a => ({ 
          ...a, 
          date: a.date instanceof Date ? a.date.toLocaleDateString('pt-BR') : a.date 
        })),
        materials,
        payments,
        pendingGoals: pendingGoals,
        teacherName: teacher?.name || 'Professor',
        teacherId: teacher?.id,
        messages: latestMessages,
        stats: {
          lessonsDone: statsDone.count,
          pendingExercises: statsPending.count,
          unreadAnnouncements: dbAnnouncements.length,
          frequency,
          generalProgress: 85,
        }
      };
    }),
    getAnnouncements: studentProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      let studentId = ctx.user.studentId;
      if (!studentId) {
        const [found] = await db.select({ id: students.id }).from(students).where(eq(students.studentUserId, ctx.user.id)).limit(1);
        if (found) studentId = found.id;
      }
      if (!studentId) throw new Error("Acesso não autorizado");

      const orgId = ctx.user.organizationId!;
      const [student] = await db.select({ professorId: students.professorId })
        .from(students)
        .where(and(eq(students.id, studentId), eq(students.organizationId, orgId)))
        .limit(1);
      
      if (!student) throw new Error("Estudante não encontrado.");

      const dbAnnouncements = await db.select({
        id: announcements.id,
        title: announcements.title,
        author: users.name,
        date: announcements.createdAt,
        important: announcements.important,
        content: announcements.content,
      })
      .from(announcements)
      .leftJoin(users, eq(announcements.userId, users.id))
      .where(and(
        eq(announcements.organizationId, orgId),
        eq(announcements.userId, student.professorId),
        sql`(${announcements.targetStudentId} IS NULL OR ${announcements.targetStudentId} = ${studentId})`
      ))
      .orderBy(desc(announcements.createdAt))
      .limit(50);
      
      return dbAnnouncements.map(a => ({ 
        ...a, 
        date: a.date instanceof Date ? a.date.toLocaleDateString('pt-BR') : a.date 
      }));
    }),
    getLessons: studentProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const studentId = ctx.user.studentId || (await db.select({ id: students.id }).from(students).where(eq(students.studentUserId, ctx.user.id)).limit(1).then(res => res[0]?.id));
      if (!studentId) throw new Error("Acesso não autorizado");

      const orgId = ctx.user.organizationId!;
      return db.select().from(lessons).where(and(eq(lessons.studentId, studentId), eq(lessons.organizationId, orgId))).orderBy(desc(lessons.scheduledAt)).limit(50);
    }),
    getMaterials: studentProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const studentId = ctx.user.studentId || (await db.select({ id: students.id }).from(students).where(eq(students.studentUserId, ctx.user.id)).limit(1).then(res => res[0]?.id));
      if (!studentId) throw new Error("Acesso não autorizado");

      const orgId = ctx.user.organizationId!;
      return db.select().from(studentFiles).where(and(eq(studentFiles.studentId, studentId), eq(studentFiles.organizationId, orgId))).orderBy(desc(studentFiles.createdAt)).limit(100);
    }),
    markMaterialViewed: studentProcedure.input(z.object({ fileId: z.number() })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const orgId = ctx.user.organizationId!;
      
      let studentId = ctx.user.studentId || (await db.select({ id: students.id }).from(students).where(eq(students.studentUserId, ctx.user.id)).limit(1).then(res => res[0]?.id));
      if (!studentId) throw new Error("Acesso não autorizado");

      await db.update(studentFiles)
        .set({ viewedAt: new Date() })
        .where(and(
          eq(studentFiles.id, input.fileId),
          eq(studentFiles.organizationId, orgId),
          eq(studentFiles.studentId, studentId)
        ));
      return { success: true };
    }),
    getExercises: studentProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const studentId = ctx.user.studentId || (await db.select({ id: students.id }).from(students).where(eq(students.studentUserId, ctx.user.id)).limit(1).then(res => res[0]?.id));
      if (!studentId) throw new Error("Acesso não autorizado");

      const orgId = ctx.user.organizationId!;
      return db.select().from(studentGoals).where(and(eq(studentGoals.studentId, studentId), eq(studentGoals.organizationId, orgId))).orderBy(desc(studentGoals.createdAt));
    }),
    getProgress: studentProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const studentId = ctx.user.studentId || (await db.select({ id: students.id }).from(students).where(eq(students.studentUserId, ctx.user.id)).limit(1).then(res => res[0]?.id));
      if (!studentId) throw new Error("Acesso não autorizado");

      const orgId = ctx.user.organizationId!;
      const [timeline, done] = await Promise.all([
        db.select().from(studentTimeline).where(and(eq(studentTimeline.studentId, studentId), eq(studentTimeline.organizationId, orgId))).orderBy(desc(studentTimeline.achievedAt)),
        db.select({ count: sql<number>`CAST(count(*) AS INT)` }).from(lessons).where(and(eq(lessons.studentId, studentId), eq(lessons.organizationId, orgId), eq(lessons.status, 'concluida'))).then(res => res[0])
      ]);

      return {
        timeline,
        stats: {
          lessonsDone: done.count,
          averageGrade: 9.2, // Mock
        }
      };
    }),
    getPayments: studentProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const studentId = ctx.user.studentId || (await db.select({ id: students.id }).from(students).where(eq(students.studentUserId, ctx.user.id)).limit(1).then(res => res[0]?.id));
      if (!studentId) throw new Error("Acesso não autorizado");

      const orgId = ctx.user.organizationId!;
      return db.select().from(paymentDues).where(and(eq(paymentDues.studentId, studentId), eq(paymentDues.organizationId, orgId))).orderBy(desc(paymentDues.dueDate));
    }),
    getMessages: studentProcedure.input(z.object({ withUserId: z.number() })).query(async ({ ctx, input }) => {
       const db = await getDb();
       if (!db) throw new Error("Database not available");

       let studentId = ctx.user.studentId;
       let [student] = studentId ? await db.select({ permissions: students.permissions }).from(students).where(eq(students.id, studentId)).limit(1) : [null];
       if (!student) {
         [student] = await db.select({ permissions: students.permissions }).from(students).where(eq(students.studentUserId, ctx.user.id)).limit(1);
       }

       if (student?.permissions) {
         try {
           const parsed = JSON.parse(student.permissions);
           if (parsed.canSeeMessages === false) return [];
         } catch (e) {
           console.error("Error parsing student permissions in getMessages:", e);
         }
       }

       const orgId = ctx.user.organizationId!;
       return db.select({
         id: chatMessages.id,
         senderId: chatMessages.senderId,
         content: chatMessages.content,
         createdAt: chatMessages.createdAt,
         isMe: sql`${chatMessages.senderId} = ${ctx.user.id}`,
       }).from(chatMessages)
         .where(and(
           eq(chatMessages.organizationId, orgId),
           or(
             and(eq(chatMessages.senderId, ctx.user.id), eq(chatMessages.receiverId, input.withUserId)),
             and(eq(chatMessages.senderId, input.withUserId), eq(chatMessages.receiverId, ctx.user.id))
           )
         ))
         .orderBy(asc(chatMessages.createdAt));
    }),
    sendMessage: studentProcedure.input(z.object({ receiverId: z.number(), content: z.string() })).mutation(async ({ ctx, input }) => {
       const db = await getDb();
       if (!db) throw new Error("Database not available");

       let studentId = ctx.user.studentId;
       let [student] = studentId ? await db.select({ permissions: students.permissions }).from(students).where(eq(students.id, studentId)).limit(1) : [null];
       if (!student) {
         [student] = await db.select({ permissions: students.permissions }).from(students).where(eq(students.studentUserId, ctx.user.id)).limit(1);
       }

       if (student?.permissions) {
         try {
           const parsed = JSON.parse(student.permissions);
           if (parsed.canSeeMessages === false) {
             throw new TRPCError({
               code: 'FORBIDDEN',
               message: 'Você não tem permissão para enviar mensagens.'
             });
           }
         } catch (e) {
           console.error("Error parsing student permissions in sendMessage:", e);
           if (e instanceof TRPCError) throw e;
         }
       }

       const orgId = ctx.user.organizationId!;
       await db.insert(chatMessages).values({
         organizationId: orgId,
         senderId: ctx.user.id,
         receiverId: input.receiverId,
         content: input.content,
       });
       return { success: true };
    }),
    getProfile: studentProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      let studentId = ctx.user.studentId;
      let [student] = studentId ? await db.select({
        id: students.id,
        name: students.name,
        email: students.email,
        phone: students.phone,
        level: students.level,
        instrumentId: students.instrumentId,
        teacherId: students.professorId,
        startDate: students.startDate,
        birthDate: students.birthDate,
        address: students.address,
        guardianName: students.guardianName,
        guardianPhone: students.guardianPhone,
        permissions: students.permissions,
      }).from(students).where(eq(students.id, studentId)).limit(1) : [null];

      if (!student) {
        [student] = await db.select({
          id: students.id,
          name: students.name,
          email: students.email,
          phone: students.phone,
          level: students.level,
          instrumentId: students.instrumentId,
          teacherId: students.professorId,
          startDate: students.startDate,
          birthDate: students.birthDate,
          address: students.address,
          guardianName: students.guardianName,
          guardianPhone: students.guardianPhone,
          permissions: students.permissions,
        }).from(students).where(eq(students.studentUserId, ctx.user.id)).limit(1);
      }
      
      if (!student) throw new Error("Dados do aluno não encontrados.");
      
      const [[teacher], [instrument]] = await Promise.all([
        db.select({ 
          name: users.name,
          pixKey: settings.pixKey
        })
        .from(users)
        .leftJoin(settings, eq(users.id, settings.userId))
        .where(eq(users.id, student.teacherId))
        .limit(1),
        
        student.instrumentId 
          ? db.select({ name: instruments.name })
              .from(instruments)
              .where(eq(instruments.id, student.instrumentId))
              .limit(1)
          : Promise.resolve([{ name: null }])
      ]);
      
      let parsedPermissions = {
        canSeeFinanceiro: true,
        canSeeProgress: true,
        canSeeFiles: true,
        canSeeSchedule: true,
        canSeeMessages: true,
      };

      if (student.permissions) {
        try {
          const parsed = JSON.parse(student.permissions);
          parsedPermissions = { ...parsedPermissions, ...parsed };
        } catch (e) {
          console.error("[studentPortal] Error parsing permissions for student profile", student.id, e);
        }
      }
      
      return { 
        ...student, 
        permissions: parsedPermissions,
        teacherName: teacher?.name || 'Professor',
        teacherPixKey: teacher?.pixKey,
        instrumentName: instrument?.name || 'Não definido'
      };
    }),
    getSchedule: studentProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      let studentId = ctx.user.studentId;
      if (!studentId) {
        const [found] = await db.select({ id: students.id, permissions: students.permissions }).from(students).where(eq(students.studentUserId, ctx.user.id)).limit(1);
        if (found) {
          if (found.permissions) {
            const perms = JSON.parse(found.permissions);
            if (perms.canSeeSchedule === false) return [];
          }
          studentId = found.id;
        }
      } else {
        const [found] = await db.select({ permissions: students.permissions }).from(students).where(eq(students.id, studentId)).limit(1);
        if (found?.permissions) {
          const perms = JSON.parse(found.permissions);
          if (perms.canSeeSchedule === false) return [];
        }
      }
      if (!studentId) throw new Error("Acesso não autorizado");

      const orgId = ctx.user.organizationId!;
      return db.select({
        id: lessons.id,
        title: lessons.title,
        scheduledAt: lessons.scheduledAt,
        duration: lessons.duration,
        status: lessons.status,
        notes: lessons.notes,
      }).from(lessons)
        .where(and(eq(lessons.studentId, studentId), eq(lessons.organizationId, orgId)))
        .orderBy(asc(lessons.scheduledAt))
        .limit(100);
    }),
    updateProfile: studentProcedure
      .input(z.object({
        phone: z.string().optional(),
        email: z.string().email().optional(),
        password: z.string().min(6).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        let studentId = ctx.user.studentId;
        if (!studentId) {
          const [found] = await db.select({ id: students.id }).from(students).where(eq(students.studentUserId, ctx.user.id)).limit(1);
          if (found) studentId = found.id;
        }
        if (!studentId) throw new Error("Acesso não autorizado");

        await db.update(students).set({ phone: input.phone, email: input.email }).where(eq(students.id, studentId));

        const userUpdates: any = {};
        if (input.email) userUpdates.email = input.email;
        if (input.password) {
           const salt = crypto.randomBytes(16).toString('hex');
           const derivedKey = crypto.scryptSync(input.password, salt, 64).toString('hex');
           userUpdates.passwordHash = salt + ':' + derivedKey;
        }

        if (Object.keys(userUpdates).length > 0) {
          await db.update(users).set(userUpdates).where(eq(users.id, ctx.user.id));
        }

        return { success: true };
      }),
    requestReschedule: studentProcedure
      .input(z.object({
        lessonId: z.number(),
        reason: z.string(),
        preferredDates: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const orgId = ctx.user.organizationId!;
        
        let studentId = ctx.user.studentId;
        if (!studentId) {
          const [found] = await db.select({ id: students.id }).from(students).where(eq(students.studentUserId, ctx.user.id)).limit(1);
          if (found) studentId = found.id;
        }
        if (!studentId) throw new Error("Acesso não autorizado");

        await db.insert(rescheduleRequests).values({
          organizationId: orgId,
          studentId: studentId,
          lessonId: input.lessonId,
          reason: input.reason,
          preferredDates: input.preferredDates,
        });

      return { success: true, message: "Solicitação enviada ao professor." };
      }),
    verifyAndConfirmPayment: studentProcedure
      .input(z.object({
        paymentDueId: z.number(),
        fileData: z.string(),
        fileName: z.string(),
        fileType: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Banco de dados não disponível");
        const orgId = ctx.user.organizationId!;

        let studentId = ctx.user.studentId;
        if (!studentId) {
          const [found] = await db.select({ id: students.id }).from(students).where(eq(students.studentUserId, ctx.user.id)).limit(1);
          if (found) studentId = found.id;
        }
        if (!studentId) throw new Error("Acesso não autorizado");

        const [payment] = await db.select()
          .from(paymentDues)
          .where(and(
            eq(paymentDues.id, input.paymentDueId),
            eq(paymentDues.studentId, studentId),
            eq(paymentDues.organizationId, orgId)
          ))
          .limit(1);

        if (!payment) throw new Error("Mensalidade não encontrada.");
        if (payment.status === 'pago') throw new Error("Esta mensalidade já está paga.");

        const [student] = await db.select()
          .from(students)
          .where(eq(students.id, studentId))
          .limit(1);

        const [teacher] = await db.select({
          name: users.name,
          pixKey: settings.pixKey,
          geminiApiKey: settings.geminiApiKey
        })
        .from(users)
        .leftJoin(settings, eq(users.id, settings.userId))
        .where(eq(users.id, student.professorId))
        .limit(1);

        // Upload receipt to local storage
        const base64Content = input.fileData.includes(',') ? input.fileData.split(',')[1] : input.fileData;
        const buffer = Buffer.from(base64Content, 'base64');
        const ext = input.fileName.split('.').pop() || 'dat';
        const storageKey = `receipts/org_${orgId}/user_${ctx.user.id}/pay_${input.paymentDueId}_${nanoid(6)}.${ext}`;
        
        const { url: receiptUrl } = await storagePut(storageKey, buffer, input.fileType);

        // AI Validation
        try {
          const { GoogleGenerativeAI } = await import("@google/generative-ai");
          const apiKeyToUse = teacher?.geminiApiKey || process.env.GEMINI_API_KEY;
          if (!apiKeyToUse) throw new Error("Chave Gemini não configurada");
          const localGenAI = new GoogleGenerativeAI(apiKeyToUse);
          const model = localGenAI.getGenerativeModel({ model: "gemini-2.5-flash" });
          const systemPrompt = `Você é um robô de inteligência artificial especializado em análise de comprovantes de pagamento (principalmente PIX) para uma escola de música.
Sua tarefa é analisar a imagem do comprovante enviada pelo aluno e verificar se ela é válida para a mensalidade esperada.

Dados da mensalidade esperada:
- Nome do Aluno: ${student?.name || 'Não especificado'}
- Valor Esperado: R$ ${Number(payment.amount).toFixed(2)}
- Mês de Referência: ${payment.month}/${payment.year}
- Chave PIX / Nome do Recebedor (Professor): ${teacher?.pixKey || 'Não especificada'} / ${teacher?.name || 'Não especificado'}

Instruções de análise:
1. Verifique se a imagem é realmente um comprovante de pagamento válido (PIX, transferência bancária ou boleto pago). Se for uma imagem irrelevante ou inválida, marque "isValidReceipt" como false.
2. Extraia o valor pago encontrado no comprovante.
3. Extraia a data do pagamento.
4. Verifique se o valor pago é compatível com o valor esperado (permita variações muito pequenas, mas idealmente deve bater).
5. Retorne estritamente um objeto JSON com o seguinte formato exato (sem formatação markdown):
{
  "isValidReceipt": true/false,
  "amountPaid": 200.00,
  "paymentDate": "YYYY-MM-DD",
  "confidenceScore": 0.95,
  "reason": "Motivo resumido em português explicando a validação ou recusa"
}`;

          const result = await model.generateContent({
            contents: [
              {
                role: 'user',
                parts: [
                  { text: systemPrompt },
                  { inlineData: { data: base64Content, mimeType: input.fileType } }
                ]
              }
            ],
            generationConfig: {
              responseMimeType: "application/json"
            }
          });

          let aiResponseText = result.response.text();
          if (aiResponseText.includes("\`\`\`")) {
            aiResponseText = aiResponseText.replace(/\`\`\`json/g, "").replace(/\`\`\`/g, "").trim();
          }

          const analysis = JSON.parse(aiResponseText);

          if (!analysis.isValidReceipt) {
            return {
              success: false,
              verified: false,
              reason: analysis.reason || "O comprovante não pôde ser validado."
            };
          }

          // Confirma o pagamento no banco de dados
          await db.update(paymentDues)
            .set({ 
              status: 'pago',
              paidAt: new Date(),
              receiptUrl: receiptUrl,
              updatedAt: new Date()
            })
            .where(eq(paymentDues.id, payment.id));

          const valor = Number(payment.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
          await notifyUser(student.professorId, {
            title: "Pagamento Confirmado",
            content: `O aluno ${student.name || "Aluno"} pagou a mensalidade de ${valor} via PIX (validado por IA).`,
          });

          return {
            success: true,
            verified: true,
            amountPaid: analysis.amountPaid,
            reason: analysis.reason || "Comprovante validado com sucesso!"
          };
        } catch (error: any) {
          console.error("[verifyAndConfirmPayment] Erro na análise do Gemini:", error);
          throw new Error("Ocorreu um erro ao analisar o comprovante com a IA. Tente novamente mais tarde.");
        }
      }),
    completeExercise: studentProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const orgId = ctx.user.organizationId!;
        
        let studentId = ctx.user.studentId;
        if (!studentId) {
          const [found] = await db.select({ id: students.id }).from(students).where(eq(students.studentUserId, ctx.user.id)).limit(1);
          if (found) studentId = found.id;
        }
        if (!studentId) throw new Error("Acesso não autorizado");

        const [exercise] = await db.select({
          id: studentGoals.id,
          title: studentGoals.title,
          userId: studentGoals.userId,
          studentName: students.name,
        })
        .from(studentGoals)
        .leftJoin(students, eq(studentGoals.studentId, students.id))
        .where(and(eq(studentGoals.id, input.id), eq(studentGoals.studentId, studentId), eq(studentGoals.organizationId, orgId)))
        .limit(1);

        if (!exercise) throw new Error("Exercício não encontrado.");

        await db.update(studentGoals)
          .set({ status: "concluida", completedAt: new Date(), updatedAt: new Date() })
          .where(eq(studentGoals.id, input.id));

        // Notify the professor (exercise.userId)
        await notifyUser(exercise.userId, {
          title: "Exercício Concluído",
          content: `O aluno ${exercise.studentName || "Aluno"} concluiu a atividade "${exercise.title}".`
        });

        return { success: true };
      }),

    // Retorna o contato do professor responsável pelo aluno (para o botão "Falar com o professor")
    getProfessorContact: studentProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      let studentId = ctx.user.studentId;
      if (!studentId) {
        const [found] = await db.select({ id: students.id }).from(students).where(eq(students.studentUserId, ctx.user.id)).limit(1);
        if (found) studentId = found.id;
      }
      if (!studentId) throw new Error("Perfil de aluno não encontrado.");

      // Busca o professor do aluno
      const [student] = await db.select({ professorId: students.professorId })
        .from(students).where(eq(students.id, studentId)).limit(1);
      if (!student) throw new Error("Aluno não encontrado.");

      // Busca o nome do professor
      const [professor] = await db.select({ name: users.name })
        .from(users).where(eq(users.id, student.professorId)).limit(1);

      // Busca o telefone do professor nas configurações (tabela settings)
      const [professorSettings] = await db.select({ phone: settings.phone })
        .from(settings).where(eq(settings.userId, student.professorId)).limit(1);

      return {
        name: professor?.name || null,
        phone: professorSettings?.phone || null,
      };
    }),

    // Gera uma explicação detalhada de um exercício do plano de estudos via IA
    getExerciseDetails: studentProcedure.input(z.object({
      exerciseTitle: z.string(),
      exerciseSubtitle: z.string().optional(),
      exercisePoints: z.array(z.string()).optional(),
      instrument: z.string().optional(),
      dayFocus: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const prompt = "Você é um professor de música experiente e didático. "
        + "Um aluno está pedindo uma explicação mais detalhada sobre um exercício do plano de estudos.\n\n"
        + "EXERCÍCIO: " + input.exerciseTitle + "\n"
        + (input.exerciseSubtitle ? "INSTRUÇÃO: " + input.exerciseSubtitle + "\n" : "")
        + (input.exercisePoints && input.exercisePoints.length > 0 ? "PONTOS DE ATENÇÃO: " + input.exercisePoints.join(", ") + "\n" : "")
        + (input.instrument ? "INSTRUMENTO DO ALUNO: " + input.instrument + "\n" : "")
        + (input.dayFocus ? "FOCO DO DIA: " + input.dayFocus + "\n" : "")
        + "\nGere uma explicação detalhada e motivadora deste exercício para o aluno. Inclua:\n"
        + "1. Por que este exercício é importante para o desenvolvimento musical\n"
        + "2. Como executá-lo passo a passo de forma correta\n"
        + "3. Dicas práticas e erros comuns a evitar\n"
        + "4. Como saber se está fazendo certo\n"
        + "Responda de forma clara, simples e encorajadora. Máximo de 300 palavras.";

      try {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const [student] = await db.select({ professorId: students.professorId }).from(students).where(eq(students.id, ctx.user.studentId!));
        const { getSettingsByUserId } = await import("./db");
        const settingsData = await getSettingsByUserId(ctx.user.organizationId!, student?.professorId || ctx.user.id);

        const { callGemini } = await import("./utils/gemini");
        const explanation = await callGemini([{ role: "user", content: prompt }], undefined, false, settingsData?.geminiApiKey);
        return { explanation };
      } catch (e: any) {
        throw new Error("Não foi possível gerar a explicação: " + e.message);
      }
    }),
  }),

  // ─── AI ASSISTANT (Gemini) ──────────────────────────────────────────────────────────

  // ─── Helpers de validação de mensagens da IA ───────────────────────────────────────
  // Verificações feitas ANTES de enviar ao Gemini, no endpoint ai.chat

  /**
   * Verifica se a mensagem é válida para ser enviada à IA.
   * Retorna null se válida, ou uma string de erro se inválida.
   */
  // (helpers são funções inline no closure do endpoint, não são exportadas)
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
        const userDataContext = await buildUserContext(db, ctx.user.id, orgId);
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
        const { getSettingsByUserId } = await import("./db");
        const settingsData = await getSettingsByUserId(orgId, professorId);

        // Chama a IA
        const aiResponseRaw = await callGemini(formattedHistory, systemPrompt, false, settingsData?.geminiApiKey);

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
                startDate: new Date().toISOString().slice(0, 10),
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
            } catch (parseErr) {
              console.error("[AI ACTION:CREATE_STUDENT] Erro ao processar:", parseErr);
              finalResponseContent = finalResponseContent.replace(blockStr,
                "\n\n⚠️ Ocorreu um erro interno ao tentar cadastrar o aluno."
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
  expenses: router({
    list: protectedProcedure
      .input(z.object({
        month: z.number().optional(),
        year: z.number().optional()
      }).optional())
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) return [];
        const orgId = ctx.user.organizationId!;
        const m = input?.month ?? new Date().getMonth() + 1;
        const y = input?.year ?? new Date().getFullYear();
        
        const dateFilter = input?.month === -1 ? undefined : sql`EXTRACT(MONTH FROM ${expenses.date}) = ${m} AND EXTRACT(YEAR FROM ${expenses.date}) = ${y}`;
        
        return db.select()
          .from(expenses)
          .where(and(
            eq(expenses.organizationId, orgId),
            (ctx.user.role === 'admin' || ctx.user.openId === ENV.ownerOpenId) ? undefined : eq(expenses.userId, ctx.user.id),
            dateFilter
          ))
          .orderBy(desc(expenses.date));
      }),
      
    create: protectedProcedure
      .input(z.object({
        description: z.string(),
        supplier: z.string().optional(),
        account: z.string().optional(),
        recurrence: z.string().optional(),
        amount: z.number(),
        date: z.string(),
        category: z.string(),
        status: z.enum(["pendente", "pago", "atrasado"]).optional(),
        notes: z.string().optional()
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          const db = await getDb();
          if (!db) throw new Error("Database not available");
          const orgId = ctx.user.organizationId!;
          
          await db.insert(expenses).values({
            organizationId: orgId,
            userId: ctx.user.id,
            description: input.description,
            supplier: input.supplier || null,
            account: input.account || null,
            recurrence: input.recurrence || "unica",
            amount: input.amount.toFixed(2),
            date: input.date.slice(0, 10),
            category: input.category,
            status: input.status || "pendente",
            notes: input.notes,
            createdAt: new Date(),
            updatedAt: new Date()
          });
          return { success: true };
        } catch (error) {
          return handleDbError(error, "criar despesa");
        }
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        description: z.string().optional(),
        supplier: z.string().nullable().optional(),
        account: z.string().nullable().optional(),
        recurrence: z.string().optional(),
        amount: z.number().optional(),
        date: z.string().optional(),
        category: z.string().optional(),
        status: z.enum(["pendente", "pago", "atrasado"]).optional(),
        notes: z.string().nullable().optional()
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          const db = await getDb();
          if (!db) throw new Error("Database not available");
          const orgId = ctx.user.organizationId!;
          const { id, ...data } = input;
          
          const updateData: any = { ...data, updatedAt: new Date() };
          if (data.date) updateData.date = data.date.slice(0, 10);
          if (data.amount !== undefined) updateData.amount = data.amount.toFixed(2);
          
          const isAdmin = ctx.user.role === 'admin' || ctx.user.openId === ENV.ownerOpenId;
          const whereClause = isAdmin
            ? and(eq(expenses.id, id), eq(expenses.organizationId, orgId))
            : and(eq(expenses.id, id), eq(expenses.organizationId, orgId), eq(expenses.userId, ctx.user.id));
            
          await db.update(expenses)
            .set(updateData)
            .where(whereClause);
          return { success: true };
        } catch (error) {
          return handleDbError(error, "atualizar despesa");
        }
      }),
      
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        try {
          const db = await getDb();
          if (!db) throw new Error("Database not available");
          const orgId = ctx.user.organizationId!;
          const isAdmin = ctx.user.role === 'admin' || ctx.user.openId === ENV.ownerOpenId;
          const whereClause = isAdmin
            ? and(eq(expenses.id, input.id), eq(expenses.organizationId, orgId))
            : and(eq(expenses.id, input.id), eq(expenses.organizationId, orgId), eq(expenses.userId, ctx.user.id));
            
          await db.delete(expenses).where(whereClause);
          return { success: true };
        } catch (error) {
          return handleDbError(error, "remover despesa");
        }
      }),
      
    markPaid: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        try {
          const db = await getDb();
          if (!db) throw new Error("Database not available");
          const orgId = ctx.user.organizationId!;
          const isAdmin = ctx.user.role === 'admin' || ctx.user.openId === ENV.ownerOpenId;
          const whereClause = isAdmin
            ? and(eq(expenses.id, input.id), eq(expenses.organizationId, orgId))
            : and(eq(expenses.id, input.id), eq(expenses.organizationId, orgId), eq(expenses.userId, ctx.user.id));
            
          await db.update(expenses)
            .set({ status: "pago", updatedAt: new Date() })
            .where(whereClause);
          return { success: true };
        } catch (error) {
          return handleDbError(error, "marcar despesa como paga");
        }
      }),

    generateRecurring: protectedProcedure
      .input(z.object({
        startMonth: z.number(),
        startYear: z.number(),
        monthsCount: z.number().default(1)
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          const db = await getDb();
          if (!db) throw new Error("Database not available");
          const orgId = ctx.user.organizationId!;
          
          const recurringList = await db.select()
            .from(expenses)
            .where(and(
              eq(expenses.organizationId, orgId),
              eq(expenses.userId, ctx.user.id),
              eq(expenses.recurrence, "mensal")
            ));

          const templatesMap = new Map<string, typeof recurringList[0]>();
          recurringList.forEach(e => {
            const existing = templatesMap.get(e.description.toLowerCase());
            if (!existing || new Date(e.date) > new Date(existing.date)) {
              templatesMap.set(e.description.toLowerCase(), e);
            }
          });

          const templates = Array.from(templatesMap.values());
          if (templates.length === 0) return { success: true, count: 0 };

          let count = 0;
          for (let i = 0; i < input.monthsCount; i++) {
            let m = input.startMonth + i;
            let y = input.startYear;
            while (m > 12) { m -= 12; y += 1; }

            const existingThisMonth = await db.select({ description: expenses.description })
              .from(expenses)
              .where(and(
                eq(expenses.organizationId, orgId),
                eq(expenses.userId, ctx.user.id),
                sql`EXTRACT(MONTH FROM ${expenses.date}) = ${m}`,
                sql`EXTRACT(YEAR FROM ${expenses.date}) = ${y}`
              ));
            const existingSet = new Set(existingThisMonth.map(e => e.description.toLowerCase()));

            for (const t of templates) {
              if (!existingSet.has(t.description.toLowerCase())) {
                const oldDate = new Date(t.date + "T12:00:00");
                const day = oldDate.getDate();
                const newDateStr = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

                await db.insert(expenses).values({
                  organizationId: orgId,
                  userId: ctx.user.id,
                  description: t.description,
                  supplier: t.supplier,
                  account: t.account,
                  recurrence: t.recurrence,
                  amount: t.amount,
                  date: newDateStr,
                  category: t.category,
                  status: "pendente",
                  notes: t.notes,
                  createdAt: new Date(),
                  updatedAt: new Date()
                });
                count++;
              }
            }
          }

          return { success: true, count };
        } catch (error) {
          return handleDbError(error, "gerar despesas recorrentes");
        }
      }),

    uploadReceipt: protectedProcedure
      .input(z.object({
        expenseId: z.number(),
        fileData: z.string(),
        fileName: z.string(),
        fileType: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          const db = await getDb();
          if (!db) throw new Error("Database not available");
          const orgId = ctx.user.organizationId!;

          const base64Content = input.fileData.split(';base64,').pop() || input.fileData;
          const buffer = Buffer.from(base64Content, 'base64');
          const fileExt = input.fileName.split(".").pop() || 'dat';
          const storageKey = `receipts/exp_${orgId}_${input.expenseId}_${nanoid(6)}.${fileExt}`;

          const { url } = await storagePut(storageKey, buffer, input.fileType);

          await db.update(expenses)
            .set({ receiptUrl: url, updatedAt: new Date() })
            .where(and(eq(expenses.id, input.expenseId), eq(expenses.organizationId, orgId), eq(expenses.userId, ctx.user.id)));

          return { success: true, receiptUrl: url };
        } catch (error) {
          return handleDbError(error, "enviar comprovante de despesa");
        }
      }),
  }),

  // ─── PILAR 4: PROFESSOR PAYMENT CALCULATION ─────────────────────
  professorPayments: router({
    list: protectedProcedure
      .input(z.object({
        month: z.number().min(1).max(12),
        year: z.number().min(2020).max(2100),
      }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) return [];
        const orgId = ctx.user.organizationId!;

        const payments = await db.select({
          payment: professorPayments,
          professorName: users.name,
        })
          .from(professorPayments)
          .innerJoin(professores, eq(professores.id, professorPayments.professorId))
          .innerJoin(users, eq(users.id, professores.userId))
          .where(and(
            eq(professorPayments.organizationId, orgId),
            eq(professorPayments.month, input.month),
            eq(professorPayments.year, input.year),
          ))
          .orderBy(asc(users.name));

        return payments.map(p => ({
          ...p.payment,
          professorName: p.professorName,
        }));
      }),

    calculate: protectedProcedure
      .input(z.object({
        professorId: z.number(),
        month: z.number().min(1).max(12),
        year: z.number().min(2020).max(2100),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          const db = await getDb();
          if (!db) throw new Error("Database not available");
          const orgId = ctx.user.organizationId!;

          // Get professor data
          const [prof] = await db.select()
            .from(professores)
            .where(and(
              eq(professores.id, input.professorId),
              eq(professores.organizationId, orgId),
            ))
            .limit(1);

          if (!prof) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Professor não encontrado" });
          }

          // Date range for the month
          const startDate = new Date(input.year, input.month - 1, 1);
          const endDate = new Date(input.year, input.month, 1);

          // Get completed lessons for this professor in the given month
          const completedLessons = await db.select({
            id: lessons.id,
            duration: lessons.duration,
            studentId: lessons.studentId,
          })
            .from(lessons)
            .where(and(
              eq(lessons.organizationId, orgId),
              eq(lessons.userId, prof.userId),
              eq(lessons.status, "concluida"),
              gte(lessons.scheduledAt, startDate),
              lt(lessons.scheduledAt, endDate),
            ));

          const totalClasses = completedLessons.length;
          const totalMinutes = completedLessons.reduce((sum, l) => sum + (l.duration || 60), 0);
          let totalCredits = 0;

          if (prof.paymentType === "fixo") {
            // Fixed rate: totalMinutes / 60 * hourlyRate
            const hourlyRate = parseFloat(prof.hourlyRate || "0");
            totalCredits = (totalMinutes / 60) * hourlyRate;
          } else if (prof.paymentType === "porcentagem") {
            // Percentage: sum of monthly fees for students who had lessons * percentage / 100
            const uniqueStudentIds = [...new Set(completedLessons.map(l => l.studentId).filter(Boolean))] as number[];
            if (uniqueStudentIds.length > 0) {
              const studentList = await db.select({
                id: students.id,
                monthlyFee: students.monthlyFee,
              })
                .from(students)
                .where(and(
                  eq(students.organizationId, orgId),
                  inArray(students.id, uniqueStudentIds),
                ));

              const totalFees = studentList.reduce((sum, s) => sum + parseFloat(s.monthlyFee || "0"), 0);
              const percentage = parseFloat(prof.paymentPercentage || "0");
              totalCredits = (totalFees * percentage) / 100;
            }
          }

          const totalAmount = totalCredits; // totalAmount = totalCredits - totalDebits (debits can be added later)

          // Upsert: check if a payment record already exists for this professor/month/year
          const [existing] = await db.select()
            .from(professorPayments)
            .where(and(
              eq(professorPayments.organizationId, orgId),
              eq(professorPayments.professorId, input.professorId),
              eq(professorPayments.month, input.month),
              eq(professorPayments.year, input.year),
            ))
            .limit(1);

          if (existing) {
            await db.update(professorPayments)
              .set({
                totalClasses,
                totalMinutes,
                totalCredits: totalCredits.toFixed(2),
                totalAmount: totalAmount.toFixed(2),
                status: "aberto",
                updatedAt: new Date(),
              })
              .where(eq(professorPayments.id, existing.id));

            return { success: true, paymentId: existing.id, totalClasses, totalMinutes, totalCredits, totalAmount };
          } else {
            const [newPayment] = await db.insert(professorPayments).values({
              organizationId: orgId,
              professorId: input.professorId,
              month: input.month,
              year: input.year,
              totalClasses,
              totalMinutes,
              totalCredits: totalCredits.toFixed(2),
              totalDebits: "0.00",
              totalAmount: totalAmount.toFixed(2),
              status: "aberto",
              createdAt: new Date(),
              updatedAt: new Date(),
            }).returning({ id: professorPayments.id });

            return { success: true, paymentId: newPayment.id, totalClasses, totalMinutes, totalCredits, totalAmount };
          }
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          return handleDbError(error, "calcular pagamento do professor");
        }
      }),

    calculateAll: protectedProcedure
      .input(z.object({
        month: z.number().min(1).max(12),
        year: z.number().min(2020).max(2100),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          const db = await getDb();
          if (!db) throw new Error("Database not available");
          const orgId = ctx.user.organizationId!;

          // Get all professors in the organization
          const allProfessors = await db.select()
            .from(professores)
            .where(eq(professores.organizationId, orgId));

          const results: Array<{ professorId: number; totalClasses: number; totalMinutes: number; totalCredits: number; totalAmount: number }> = [];

          const startDate = new Date(input.year, input.month - 1, 1);
          const endDate = new Date(input.year, input.month, 1);

          for (const prof of allProfessors) {
            const completedLessons = await db.select({
              id: lessons.id,
              duration: lessons.duration,
              studentId: lessons.studentId,
            })
              .from(lessons)
              .where(and(
                eq(lessons.organizationId, orgId),
                eq(lessons.userId, prof.userId),
                eq(lessons.status, "concluida"),
                gte(lessons.scheduledAt, startDate),
                lt(lessons.scheduledAt, endDate),
              ));

            const totalClasses = completedLessons.length;
            const totalMinutes = completedLessons.reduce((sum, l) => sum + (l.duration || 60), 0);
            let totalCredits = 0;

            if (prof.paymentType === "fixo") {
              const hourlyRate = parseFloat(prof.hourlyRate || "0");
              totalCredits = (totalMinutes / 60) * hourlyRate;
            } else if (prof.paymentType === "porcentagem") {
              const uniqueStudentIds = [...new Set(completedLessons.map(l => l.studentId).filter(Boolean))] as number[];
              if (uniqueStudentIds.length > 0) {
                const studentList = await db.select({
                  id: students.id,
                  monthlyFee: students.monthlyFee,
                })
                  .from(students)
                  .where(and(
                    eq(students.organizationId, orgId),
                    inArray(students.id, uniqueStudentIds),
                  ));

                const totalFees = studentList.reduce((sum, s) => sum + parseFloat(s.monthlyFee || "0"), 0);
                const percentage = parseFloat(prof.paymentPercentage || "0");
                totalCredits = (totalFees * percentage) / 100;
              }
            }

            const totalAmount = totalCredits;

            // Upsert payment record
            const [existing] = await db.select()
              .from(professorPayments)
              .where(and(
                eq(professorPayments.organizationId, orgId),
                eq(professorPayments.professorId, prof.id),
                eq(professorPayments.month, input.month),
                eq(professorPayments.year, input.year),
              ))
              .limit(1);

            if (existing) {
              await db.update(professorPayments)
                .set({
                  totalClasses,
                  totalMinutes,
                  totalCredits: totalCredits.toFixed(2),
                  totalAmount: totalAmount.toFixed(2),
                  status: "aberto",
                  updatedAt: new Date(),
                })
                .where(eq(professorPayments.id, existing.id));
            } else {
              await db.insert(professorPayments).values({
                organizationId: orgId,
                professorId: prof.id,
                month: input.month,
                year: input.year,
                totalClasses,
                totalMinutes,
                totalCredits: totalCredits.toFixed(2),
                totalDebits: "0.00",
                totalAmount: totalAmount.toFixed(2),
                status: "aberto",
                createdAt: new Date(),
                updatedAt: new Date(),
              });
            }

            results.push({ professorId: prof.id, totalClasses, totalMinutes, totalCredits, totalAmount });
          }

          return { success: true, count: results.length, results };
        } catch (error) {
          return handleDbError(error, "calcular pagamentos de todos os professores");
        }
      }),

    approve: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        try {
          const db = await getDb();
          if (!db) throw new Error("Database not available");
          const orgId = ctx.user.organizationId!;

          const [payment] = await db.select()
            .from(professorPayments)
            .where(and(
              eq(professorPayments.id, input.id),
              eq(professorPayments.organizationId, orgId),
            ))
            .limit(1);

          if (!payment) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Pagamento não encontrado" });
          }

          if (payment.status !== "aberto") {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Somente pagamentos em aberto podem ser aprovados" });
          }

          await db.update(professorPayments)
            .set({
              status: "aprovado",
              approvedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(professorPayments.id, input.id));

          return { success: true };
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          return handleDbError(error, "aprovar pagamento do professor");
        }
      }),

    markPaid: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        try {
          const db = await getDb();
          if (!db) throw new Error("Database not available");
          const orgId = ctx.user.organizationId!;

          const [payment] = await db.select()
            .from(professorPayments)
            .where(and(
              eq(professorPayments.id, input.id),
              eq(professorPayments.organizationId, orgId),
            ))
            .limit(1);

          if (!payment) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Pagamento não encontrado" });
          }

          if (payment.status !== "aprovado") {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Somente pagamentos aprovados podem ser marcados como pagos" });
          }

          await db.update(professorPayments)
            .set({
              status: "pago",
              paidAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(professorPayments.id, input.id));

          return { success: true };
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          return handleDbError(error, "marcar pagamento como pago");
        }
      }),

    getDetails: protectedProcedure
      .input(z.object({ paymentId: z.number() }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) return { lessons: [] };
        const orgId = ctx.user.organizationId!;
        
        const [payment] = await db.select()
          .from(professorPayments)
          .where(and(
            eq(professorPayments.id, input.paymentId),
            eq(professorPayments.organizationId, orgId)
          ))
          .limit(1);
          
        if (!payment) throw new TRPCError({ code: "NOT_FOUND", message: "Pagamento não encontrado" });

        const startDate = new Date(payment.year, payment.month - 1, 1);
        const endDate = new Date(payment.year, payment.month, 1);

        const profLessons = await db.select({
          lesson: lessons,
          studentName: students.name,
        })
          .from(lessons)
          .leftJoin(students, eq(students.id, lessons.studentId))
          .innerJoin(professores, eq(professores.userId, lessons.userId))
          .where(and(
            eq(lessons.organizationId, orgId),
            eq(professores.id, payment.professorId),
            eq(lessons.status, "concluida"),
            gte(lessons.scheduledAt, startDate),
            lt(lessons.scheduledAt, endDate)
          ))
          .orderBy(asc(lessons.scheduledAt));

        return { lessons: profLessons.map(p => ({ ...p.lesson, studentName: p.studentName })) };
      }),

    updateAdjustments: protectedProcedure
      .input(z.object({
        paymentId: z.number(),
        adjustments: z.string(), // JSON string
        totalAmount: z.number(),
        totalCredits: z.number(),
        totalDebits: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          const db = await getDb();
          if (!db) throw new Error("Database not available");
          const orgId = ctx.user.organizationId!;

          const [payment] = await db.select()
            .from(professorPayments)
            .where(and(
              eq(professorPayments.id, input.paymentId),
              eq(professorPayments.organizationId, orgId)
            ))
            .limit(1);

          if (!payment) throw new TRPCError({ code: "NOT_FOUND", message: "Pagamento não encontrado" });
          if (payment.status !== "aberto") {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Apenas pagamentos em aberto podem ser editados" });
          }

          await db.update(professorPayments)
            .set({
              adjustments: input.adjustments,
              totalAmount: input.totalAmount.toFixed(2),
              totalCredits: input.totalCredits.toFixed(2),
              totalDebits: input.totalDebits.toFixed(2),
              updatedAt: new Date(),
            })
            .where(eq(professorPayments.id, input.paymentId));

          return { success: true };
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          return handleDbError(error, "atualizar ajustes do pagamento");
        }
      }),
  }),

  // ─── FILE COMMENTS ROUTER ──────────────────────────────────────
  fileComments: router({
    list: protectedProcedure.input(z.object({ fileId: z.number() })).query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      const orgId = ctx.user.organizationId!;
      return db.select({
        id: fileComments.id,
        content: fileComments.content,
        createdAt: fileComments.createdAt,
        userId: fileComments.userId,
        userName: users.name,
      })
      .from(fileComments)
      .leftJoin(users, eq(users.id, fileComments.userId))
      .where(and(
        eq(fileComments.organizationId, orgId),
        eq(fileComments.fileId, input.fileId)
      ))
      .orderBy(asc(fileComments.createdAt));
    }),
    create: protectedProcedure.input(z.object({ fileId: z.number(), content: z.string() })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const orgId = ctx.user.organizationId!;
      
      const [newComment] = await db.insert(fileComments).values({
        organizationId: orgId,
        fileId: input.fileId,
        userId: ctx.user.id,
        content: input.content,
        createdAt: new Date(),
      }).returning();
      
      return newComment;
    }),
  }),

  // ─── PILAR 5: QR CODE ATTENDANCE ────────────────────────────────
  attendance: router({
    generateToken: protectedProcedure
      .mutation(async ({ ctx }) => {
        try {
          const db = await getDb();
          if (!db) throw new Error("Database not available");
          const orgId = ctx.user.organizationId!;

          const [active] = await db.select()
            .from(attendanceTokens)
            .where(and(
              eq(attendanceTokens.organizationId, orgId),
              gte(attendanceTokens.expiresAt, new Date())
            ))
            .orderBy(desc(attendanceTokens.createdAt))
            .limit(1);

          if (active) {
            return { success: true, token: active.token, expiresAt: active.expiresAt };
          }

          const token = crypto.randomBytes(16).toString('hex');
          const expiresAt = new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000); // 100 anos

          const [created] = await db.insert(attendanceTokens).values({
            organizationId: orgId,
            token,
            expiresAt,
            createdAt: new Date(),
          }).returning();

          return { success: true, token: created.token, expiresAt: created.expiresAt };
        } catch (error) {
          return handleDbError(error, "gerar token de presença");
        }
      }),

    getActiveToken: protectedProcedure
      .query(async ({ ctx }) => {
        const db = await getDb();
        if (!db) return null;
        const orgId = ctx.user.organizationId!;

        const [active] = await db.select()
          .from(attendanceTokens)
          .where(and(
            eq(attendanceTokens.organizationId, orgId),
            gte(attendanceTokens.expiresAt, new Date()),
          ))
          .orderBy(desc(attendanceTokens.createdAt))
          .limit(1);

        return active || null;
      }),

    scan: protectedProcedure
      .input(z.object({
        token: z.string().min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          const db = await getDb();
          if (!db) throw new Error("Database not available");
          const orgId = ctx.user.organizationId!;
          const userId = ctx.user.id;

          // 1. Validate the token
          const [tokenRecord] = await db.select()
            .from(attendanceTokens)
            .where(and(
              eq(attendanceTokens.organizationId, orgId),
              eq(attendanceTokens.token, input.token),
            ))
            .limit(1);

          if (!tokenRecord) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Token inválido" });
          }

          if (new Date() > tokenRecord.expiresAt) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Token expirado" });
          }

          // 2. Find the user's lesson (scheduled status)
          // Allow checking into lessons that started up to 12 hours ago, and up to 30 minutes in the future.
          // This avoids complex timezone string parsing issues on UTC servers.
          const now = new Date();
          const minAllowedTime = new Date(now.getTime() - 12 * 60 * 60 * 1000);
          const maxAllowedTime = new Date(now.getTime() + 30 * 60 * 1000);

          // Determine if the user is a student or a professor
          // Trava 1: Apenas alunos podem registrar presença via QR Code
          if (ctx.user.role !== "aluno" || !ctx.user.studentId) {
            throw new TRPCError({ code: "FORBIDDEN", message: "Apenas alunos podem registrar presença via QR Code." });
          }

          const [todayLesson] = await db.select()
            .from(lessons)
            .where(and(
              eq(lessons.organizationId, orgId),
              eq(lessons.studentId, ctx.user.studentId),
              eq(lessons.status, "agendada"),
              gte(lessons.scheduledAt, minAllowedTime),
              lte(lessons.scheduledAt, maxAllowedTime),
            ))
            .orderBy(asc(lessons.scheduledAt))
            .limit(1);

          if (!todayLesson) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Nenhuma aula agendada disponível para check-in neste momento. (Aguarde o horário da aula)" });
          }

          // 3. Check for duplicate scan
          const [existingLog] = await db.select()
            .from(attendanceLogs)
            .where(and(
              eq(attendanceLogs.organizationId, orgId),
              eq(attendanceLogs.userId, userId),
              eq(attendanceLogs.lessonId, todayLesson.id),
            ))
            .limit(1);

          if (existingLog) {
            throw new TRPCError({ code: "CONFLICT", message: "Presença já registrada para esta aula" });
          }

          // 4. Mark the lesson as completed
          await db.update(lessons)
            .set({ status: "concluida", updatedAt: new Date() })
            .where(eq(lessons.id, todayLesson.id));

          // 5. Create attendance log
          await db.insert(attendanceLogs).values({
            organizationId: orgId,
            userId,
            lessonId: todayLesson.id,
            tokenId: tokenRecord.id,
            scannedAt: new Date(),
          });

          return { success: true, lessonId: todayLesson.id, lessonTitle: todayLesson.title };
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          return handleDbError(error, "registrar presença");
        }
      }),

    getLogs: protectedProcedure
      .input(z.object({
        startDate: z.string(), // ISO date string
        endDate: z.string(),   // ISO date string
      }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) return [];
        const orgId = ctx.user.organizationId!;

        const start = new Date(input.startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(input.endDate);
        end.setHours(23, 59, 59, 999);

        const isUserAdmin = ctx.user.role === 'admin' || ctx.user.openId === ENV.ownerOpenId;

        const logs = await db.select({
          log: attendanceLogs,
          userName: users.name,
          lessonTitle: lessons.title,
          lessonScheduledAt: lessons.scheduledAt,
        })
          .from(attendanceLogs)
          .innerJoin(users, eq(users.id, attendanceLogs.userId))
          .leftJoin(lessons, eq(lessons.id, attendanceLogs.lessonId))
          .where(and(
            eq(attendanceLogs.organizationId, orgId),
            gte(attendanceLogs.scannedAt, start),
            lte(attendanceLogs.scannedAt, end),
            isUserAdmin ? undefined : eq(lessons.userId, ctx.user.id)
          ))
          .orderBy(desc(attendanceLogs.scannedAt));

        return logs.map(l => ({
          ...l.log,
          userName: l.userName,
          lessonTitle: l.lessonTitle,
          lessonScheduledAt: l.lessonScheduledAt,
        }));
      }),
  }),

  platform: router({
    checkout: protectedProcedure
      .input(z.object({
        planType: z.enum(["MONTHLY", "YEARLY"])
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        const orgId = ctx.user.organizationId!;
        const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
        if (!org) throw new TRPCError({ code: "NOT_FOUND", message: "Organização não encontrada" });

        const [profData] = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);

        const { createAsaasCustomer, createAsaasSubscription, getAsaasSubscriptionPayments } = await import('./utils/asaas');
        
        let customerId = org.asaasCustomerId;
        if (!customerId) {
          customerId = await createAsaasCustomer({
            name: org.name || "Escola",
            email: profData?.email ?? undefined,
          });
          await db.update(organizations).set({ asaasCustomerId: customerId }).where(eq(organizations.id, orgId));
        }

        let subId = org.asaasSubscriptionId;
        if (!subId) {
          const sub = await createAsaasSubscription({
            customer: customerId,
            billingType: 'UNDEFINED',
            value: input.planType === "YEARLY" ? 499.00 : 49.90,
            nextDueDate: new Date().toISOString().slice(0, 10),
            cycle: input.planType,
            description: `Assinatura MusicPro - Plano ${input.planType}`,
            successUrl: `${ENV.appUrl}/checkout?payment=success`,
          });
          subId = sub.id;
          await db.update(organizations).set({ asaasSubscriptionId: subId }).where(eq(organizations.id, orgId));
        }

        const payments = await getAsaasSubscriptionPayments(subId);
        const pendingPayment = payments.find(p => p.status === 'PENDING' || p.status === 'OVERDUE');
        if (!pendingPayment) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível gerar o link de pagamento." });
        }

        return { success: true, paymentLink: pendingPayment.invoiceUrl };
      }),
    getPendingInvoice: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return null;
      const orgId = ctx.user.organizationId!;
      const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
      if (!org || !org.asaasSubscriptionId) return null;

      const { getAsaasSubscriptionPayments } = await import('./utils/asaas');
      const payments = await getAsaasSubscriptionPayments(org.asaasSubscriptionId);
      const pendingPayment = payments.find((p: any) => p.status === 'PENDING' || p.status === 'OVERDUE');
      
      if (!pendingPayment) return null;
      
      return {
        invoiceUrl: pendingPayment.invoiceUrl,
        value: pendingPayment.value
      };
    }),
    syncSubscription: protectedProcedure.mutation(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const orgId = ctx.user.organizationId!;
      const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
      if (!org) throw new TRPCError({ code: "NOT_FOUND", message: "Organização não encontrada" });

      if (!org.asaasSubscriptionId) {
        return { success: false, status: org.subscriptionStatus, message: "Nenhuma assinatura encontrada." };
      }

      const { getAsaasSubscriptionPayments } = await import('./utils/asaas');
      const payments = await getAsaasSubscriptionPayments(org.asaasSubscriptionId);
      const confirmedPayment = payments.find((p: any) => p.status === 'RECEIVED' || p.status === 'CONFIRMED');
      
      if (confirmedPayment) {
        await db.update(organizations)
          .set({ subscriptionStatus: "active", updatedAt: new Date() })
          .where(eq(organizations.id, orgId));
        console.log(`[Platform Sync] Assinatura ativada manualmente para org ${orgId}`);
        return { success: true, status: "active", message: "Assinatura ativada com sucesso!" };
      }

      const pendingPayment = payments.find((p: any) => p.status === 'PENDING' || p.status === 'OVERDUE');
      
      return { 
        success: false, 
        status: org.subscriptionStatus, 
        message: "Nenhum pagamento confirmado encontrado.",
        invoiceUrl: pendingPayment?.invoiceUrl,
        pendingValue: pendingPayment?.value
      };
    }),
  }),

  // ─── PILAR 3: DIGITAL CONTRACTS (ZAPSIGN) ───────────────────────
  contracts: router({
    list: protectedProcedure
      .input(z.object({
        studentId: z.number().optional(),
      }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) return [];
        const orgId = ctx.user.organizationId!;

        let filters = eq(contracts.organizationId, orgId);
        if (input.studentId) {
          filters = and(filters, eq(contracts.studentId, input.studentId)) as any;
        }

        const list = await db.select({
          contract: contracts,
          studentName: students.name,
        })
          .from(contracts)
          .innerJoin(students, eq(students.id, contracts.studentId))
          .where(filters)
          .orderBy(desc(contracts.createdAt));

        return list.map(l => ({
          ...l.contract,
          studentName: l.studentName,
        }));
      }),

    create: protectedProcedure
      .input(z.object({
        studentId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          const db = await getDb();
          if (!db) throw new Error("Database not available");
          const orgId = ctx.user.organizationId!;
          
          // Get school settings
          const [orgSettings] = await db.select()
            .from(settings)
            .where(eq(settings.organizationId, orgId))
            .limit(1);

          if (!orgSettings?.zapsignApiKey) {
            throw new TRPCError({ code: "PRECONDITION_FAILED", message: "API Key da ZapSign não configurada. Vá em Configurações > Integrações." });
          }

          // Get student details
          const [student] = await db.select()
            .from(students)
            .where(and(
              eq(students.id, input.studentId),
              eq(students.organizationId, orgId)
            ))
            .limit(1);

          if (!student) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Aluno não encontrado" });
          }

          // Generate HTML/Base64 contract
          const { generateContractHtml, createZapSignDocument } = await import("./utils/zapsign");
          const htmlContent = generateContractHtml({
            schoolName: orgSettings.schoolName || "MusicPro",
            schoolAddress: orgSettings.schoolAddress || "",
            schoolPhone: orgSettings.schoolPhone || "",
            studentName: student.name,
            studentCpf: student.cpf || "",
            studentPhone: student.phone || "",
            monthlyFee: student.monthlyFee || "0.00",
            dueDay: student.dueDay || 10,
            lessonType: student.lessonType,
          });

          // Convert HTML to base64 pdf string if needed, or ZapSign accepts PDF URLs.
          // Since we don't have a PDF generation library, we will pass a generic PDF URL for now.
          const pdfUrl = "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf";

          const zapResponse = await createZapSignDocument(
            { apiToken: orgSettings.zapsignApiKey },
            {
              name: `Contrato - ${student.name}`,
              urlPdf: pdfUrl,
              signers: [
                {
                  name: student.name,
                  email: student.email || "aluno@musicpro.com.br", // fallback
                  auth_mode: "assinaturaTela",
                }
              ]
            }
          );

          // Save to DB
          const [newContract] = await db.insert(contracts).values({
            organizationId: orgId,
            userId: ctx.user.id,
            studentId: student.id,
            title: `Contrato - ${student.name}`,
            status: "enviado",
            zapsignDocId: zapResponse.token,
            zapsignSignUrl: zapResponse.signers[0].sign_url,
            createdAt: new Date(),
            updatedAt: new Date(),
          }).returning();

          return { success: true, contract: newContract };
        } catch (error: any) {
          if (error instanceof TRPCError) throw error;
          if (error.response?.data) {
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Erro na ZapSign: " + JSON.stringify(error.response.data) });
          }
          return handleDbError(error, "gerar contrato");
        }
      }),
  }),

  professores: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      const orgId = ctx.user.organizationId!;

      const list = await db.select({
        professor: professores,
        userName: users.name,
        userEmail: users.email,
        openId: users.openId,
      })
        .from(professores)
        .innerJoin(users, eq(users.id, professores.userId))
        .where(eq(professores.organizationId, orgId));

      return list.map(p => ({
        ...p.professor,
        name: p.userName,
        email: p.userEmail,
      }));
    }),

    create: protectedProcedure
      .input(z.object({
        name: z.string(),
        email: z.string().email(),
        password: z.string().min(6),
        telefone: z.string().optional(),
        especialidade: z.string().optional(),
        permissions: z.array(z.string()).default([]),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        const orgId = ctx.user.organizationId!;

        if (ctx.user.role !== "admin" && ctx.user.openId !== ENV.ownerOpenId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas administradores podem criar professores" });
        }

        const existingUser = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
        if (existingUser.length > 0) {
          throw new TRPCError({ code: "CONFLICT", message: "E-mail já cadastrado no sistema" });
        }

        const { crypto } = await import("crypto");
        const cryptoLib = crypto || require("crypto");
        const salt = cryptoLib.randomBytes(16).toString("hex");
        const derivedKey = cryptoLib.scryptSync(input.password, salt, 64).toString("hex");
        const passwordHash = `${salt}:${derivedKey}`;

        const openId = `prof_${Date.now()}_${Math.random().toString(36).substring(7)}`;

        const [newUser] = await db.insert(users).values({
          organizationId: orgId,
          name: input.name,
          email: input.email,
          openId,
          passwordHash,
          role: "professor",
          mustChangePassword: false,
          isEmailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        }).returning({ id: users.id });

        const [newProfessor] = await db.insert(professores).values({
          organizationId: orgId,
          userId: newUser.id,
          telefone: input.telefone,
          especialidade: input.especialidade,
          permissions: input.permissions,
          createdAt: new Date(),
        }).returning();

        return { success: true, professor: newProfessor };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string(),
        telefone: z.string().optional(),
        especialidade: z.string().optional(),
        permissions: z.array(z.string()).optional(),
        password: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        const orgId = ctx.user.organizationId!;

        if (ctx.user.role !== "admin" && ctx.user.openId !== ENV.ownerOpenId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas administradores podem editar professores" });
        }

        const [prof] = await db.select().from(professores).where(and(eq(professores.id, input.id), eq(professores.organizationId, orgId))).limit(1);
        if (!prof) throw new TRPCError({ code: "NOT_FOUND", message: "Professor não encontrado" });

        await db.update(professores)
          .set({
            telefone: input.telefone,
            especialidade: input.especialidade,
            ...(input.permissions ? { permissions: input.permissions } : {})
          })
          .where(eq(professores.id, input.id));

        const userUpdates: any = { name: input.name, updatedAt: new Date() };

        if (input.password) {
          const { crypto } = await import("crypto");
          const cryptoLib = crypto || require("crypto");
          const salt = cryptoLib.randomBytes(16).toString("hex");
          const derivedKey = cryptoLib.scryptSync(input.password, salt, 64).toString("hex");
          userUpdates.passwordHash = `${salt}:${derivedKey}`;
        }

        await db.update(users).set(userUpdates).where(eq(users.id, prof.userId));

        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({
        id: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        const orgId = ctx.user.organizationId!;

        if (ctx.user.role !== "admin" && ctx.user.openId !== ENV.ownerOpenId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas administradores podem excluir professores" });
        }

        const [prof] = await db.select().from(professores).where(and(eq(professores.id, input.id), eq(professores.organizationId, orgId))).limit(1);
        if (!prof) throw new TRPCError({ code: "NOT_FOUND", message: "Professor não encontrado" });

        await db.delete(professores).where(eq(professores.id, input.id));
        await db.delete(users).where(eq(users.id, prof.userId));

        return { success: true };
      }),
  }),

  fcm: fcmRouter,

  // ─── AUTOMATIONS ROUTER ───────────────────────────────────────────────────────
  automations: router({
    // List all automation rules for the current user/org
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      const { messageAutomationRules } = await import("../drizzle/schema");
      const orgId = ctx.user.organizationId!;
      const userId = ctx.user.id;

      const rules = await db
        .select()
        .from(messageAutomationRules)
        .where(
          and(
            eq(messageAutomationRules.organizationId, orgId),
            eq(messageAutomationRules.userId, userId)
          )
        )
        .orderBy(desc(messageAutomationRules.isSystem), asc(messageAutomationRules.createdAt));
      return rules;
    }),

    // Create a new custom automation rule
    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1),
          description: z.string().optional(),
          trigger: z.string().min(1),
          offsetDays: z.number().default(0),
          offsetHours: z.number().default(0),
          conditions: z.string().optional(),
          actions: z.string().optional(),
          messageTemplate: z.string().min(1),
          channel: z.string().default("whatsapp"),
          isActive: z.number().default(1),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        const { messageAutomationRules } = await import("../drizzle/schema");
        const orgId = ctx.user.organizationId!;
        const userId = ctx.user.id;

        console.log("[automations.create] RECEIVED REQUEST:", { userId, orgId, name: input.name, trigger: input.trigger });

        try {
          // Use Drizzle's .insert().values().returning() for safe superjson serialization
          // (db.execute with RETURNING returns postgres.Row[] which is not a plain JS array
          //  and cannot be serialized by superjson, causing "Unable to transform response" errors)
          const inserted = await db
            .insert(messageAutomationRules)
            .values({
              organizationId: orgId,
              userId,
              name: input.name,
              description: input.description ?? null,
              isSystem: 0,
              isActive: input.isActive,
              trigger: input.trigger,
              offsetDays: input.offsetDays,
              offsetHours: input.offsetHours,
              conditions: input.conditions ?? null,
              actions: input.actions ?? null,
              messageTemplate: input.messageTemplate,
              channel: input.channel,
            })
            .returning({ id: messageAutomationRules.id });

          const newId = inserted[0]?.id ?? null;
          console.log("[automations.create] INSERT OK, newId=", newId);

          return { success: true, id: Number(newId), name: input.name };
        } catch (error) {
          console.error("[automations.create] FAILED:", error);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Erro ao salvar automação: " + String(error) });
        }
      }),

    // Update an existing automation rule (name, template, timing, etc.)
    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().min(1).optional(),
          description: z.string().optional(),
          offsetDays: z.number().optional(),
          offsetHours: z.number().optional(),
          conditions: z.string().optional(),
          actions: z.string().optional(),
          messageTemplate: z.string().optional(),
          channel: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const { messageAutomationRules } = await import("../drizzle/schema");
        const orgId = ctx.user.organizationId!;
        const userId = ctx.user.id;

        const { id, ...fields } = input;
        const updateData: Record<string, any> = {};
        if (fields.name !== undefined) updateData.name = fields.name;
        if (fields.description !== undefined) updateData.description = fields.description;
        if (fields.offsetDays !== undefined) updateData.offsetDays = fields.offsetDays;
        if (fields.offsetHours !== undefined) updateData.offsetHours = fields.offsetHours;
        if (fields.conditions !== undefined) updateData.conditions = fields.conditions;
        if (fields.actions !== undefined) updateData.actions = fields.actions;
        if (fields.messageTemplate !== undefined) updateData.messageTemplate = fields.messageTemplate;
        if (fields.channel !== undefined) updateData.channel = fields.channel;
        updateData.updatedAt = new Date();

        await db
          .update(messageAutomationRules)
          .set(updateData)
          .where(
            and(
              eq(messageAutomationRules.id, id),
              eq(messageAutomationRules.organizationId, orgId),
              eq(messageAutomationRules.userId, userId)
            )
          );
        return { success: true };
      }),

    // Toggle active/inactive
    toggle: protectedProcedure
      .input(z.object({ id: z.number(), isActive: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const { messageAutomationRules } = await import("../drizzle/schema");
        const orgId = ctx.user.organizationId!;
        const userId = ctx.user.id;

        await db
          .update(messageAutomationRules)
          .set({ isActive: input.isActive, updatedAt: new Date() })
          .where(
            and(
              eq(messageAutomationRules.id, input.id),
              eq(messageAutomationRules.organizationId, orgId),
              eq(messageAutomationRules.userId, userId)
            )
          );
        return { success: true };
      }),

    // Delete a custom rule (system rules cannot be deleted)
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const { messageAutomationRules } = await import("../drizzle/schema");
        const orgId = ctx.user.organizationId!;
        const userId = ctx.user.id;

        const [rule] = await db
          .select()
          .from(messageAutomationRules)
          .where(
            and(
              eq(messageAutomationRules.id, input.id),
              eq(messageAutomationRules.organizationId, orgId),
              eq(messageAutomationRules.userId, userId)
            )
          )
          .limit(1);

        if (!rule) throw new TRPCError({ code: "NOT_FOUND" });
        if (rule.isSystem === 1) throw new TRPCError({ code: "FORBIDDEN", message: "Regras do sistema não podem ser excluídas." });

        await db
          .delete(messageAutomationRules)
          .where(eq(messageAutomationRules.id, input.id));
        return { success: true };
      }),

    // Get execution history (reminders generated by a specific rule)
    history: protectedProcedure
      .input(z.object({ ruleId: z.number(), limit: z.number().default(50) }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) return [];
        const orgId = ctx.user.organizationId!;

        const rows = await db
          .select({
            id: reminders.id,
            studentName: students.name,
            studentPhone: students.phone,
            message: reminders.message,
            status: reminders.status,
            scheduledAt: reminders.scheduledAt,
            sentAt: reminders.sentAt,
            errorMessage: reminders.errorMessage,
            channel: reminders.type,
          })
          .from(reminders)
          .leftJoin(students, and(eq(reminders.studentId, students.id), eq(students.organizationId, orgId)))
          .where(
            and(
              eq(reminders.organizationId, orgId),
              eq(reminders.userId, ctx.user.id),
              sql`${reminders.refId} LIKE ${'auto-rule-' + input.ruleId + '-%'}`
            )
          )
          .orderBy(desc(reminders.createdAt))
          .limit(input.limit);
        return rows;
      }),

    // Dashboard stats
    stats: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return { totalSent: 0, activeRules: 0, deliveryRate: 0, topRule: null };
      const { messageAutomationRules } = await import("../drizzle/schema");
      const orgId = ctx.user.organizationId!;
      const userId = ctx.user.id;

      try {
        const rules = await db
          .select()
          .from(messageAutomationRules)
          .where(
            and(
              eq(messageAutomationRules.organizationId, orgId),
              eq(messageAutomationRules.userId, userId)
            )
          );

        const totalSent = rules.reduce((acc, r) => acc + (r.totalSent || 0), 0);
        const activeRules = rules.filter(r => r.isActive === 1).length;

        // Count sent/error from reminders with auto-rule prefix
        const [sentCount] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(reminders)
          .where(
            and(
              eq(reminders.organizationId, orgId),
              eq(reminders.userId, userId),
              eq(reminders.status, "enviado"),
              sql`${reminders.refId} LIKE 'auto-rule-%'`
            )
          );

        const [totalCount] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(reminders)
          .where(
            and(
              eq(reminders.organizationId, orgId),
              eq(reminders.userId, userId),
              sql`${reminders.refId} LIKE 'auto-rule-%'`
            )
          );

        const sentNum = Number(sentCount?.count ?? 0);
        const totalNum = Number(totalCount?.count ?? 0);
        const deliveryRate = totalNum > 0 ? Math.round((sentNum / totalNum) * 100) : 0;
        const topRule = rules.sort((a, b) => (b.totalSent || 0) - (a.totalSent || 0))[0] ?? null;

        return {
          totalSent: sentNum || 0,
          activeRules,
          deliveryRate,
          topRule: topRule ? { id: topRule.id, name: topRule.name, totalSent: topRule.totalSent } : null,
        };
      } catch (e) {
        console.error("[automations.stats] ERROR:", e);
        return { totalSent: 0, activeRules: 0, deliveryRate: 0, topRule: null };
      }
    }),

    // Seed default system rules for the current user if they don't exist yet
    seedDefaults: protectedProcedure.mutation(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { messageAutomationRules } = await import("../drizzle/schema");
      const orgId = ctx.user.organizationId!;
      const userId = ctx.user.id;

      const existing = await db
        .select({ id: messageAutomationRules.id })
        .from(messageAutomationRules)
        .where(
          and(
            eq(messageAutomationRules.organizationId, orgId),
            eq(messageAutomationRules.userId, userId),
            eq(messageAutomationRules.isSystem, 1)
          )
        )
        .limit(1);

      if (existing.length > 0) return { seeded: false };

      const systemRules = [
        {
          name: "Boas-vindas ao Novo Aluno",
          description: "Envia mensagem de boas-vindas quando um novo aluno é matriculado.",
          trigger: "new_student",
          offsetDays: 0,
          offsetHours: 0,
          messageTemplate: "Olá {nome_aluno}! 🎵 Seja muito bem-vindo(a) à {nome_escola}! Estamos felizes em ter você aqui. Em breve seu professor {nome_professor} entrará em contato para organizar sua primeira aula de {curso}. Qualquer dúvida, estamos à disposição!",
          channel: "whatsapp",
        },
        {
          name: "Lembrete de Aula 24h Antes",
          description: "Lembra o aluno da aula 24 horas antes do horário agendado.",
          trigger: "lesson_scheduled",
          offsetDays: 0,
          offsetHours: -24,
          messageTemplate: "Olá {nome_aluno}! 🎸 Lembrando que você tem aula de {curso} amanhã, {data_aula} às {hora_aula}. Te esperamos! Qualquer imprevisto, entre em contato.",
          channel: "whatsapp",
        },
        {
          name: "Mensalidade Próxima do Vencimento",
          description: "Avisa o aluno sobre mensalidade prestes a vencer. Timing configurável.",
          trigger: "payment_due",
          offsetDays: -3,
          offsetHours: 0,
          messageTemplate: "Olá {nome_aluno}! 💰 Passando para lembrar que sua mensalidade de {valor_mensalidade} vence em {data_vencimento}. Por favor, realize o pagamento no prazo. Obrigado!",
          channel: "whatsapp",
        },
        {
          name: "Mensalidade Vencida",
          description: "Avisa o aluno que a mensalidade já venceu.",
          trigger: "payment_overdue",
          offsetDays: 0,
          offsetHours: 0,
          messageTemplate: "Olá {nome_aluno}! Identificamos que sua mensalidade de {valor_mensalidade} com vencimento em {data_vencimento} ainda consta como pendente. Por favor, regularize o quanto antes. Qualquer dúvida, fale conosco!",
          channel: "whatsapp",
        },
        {
          name: "Parabéns no Aniversário",
          description: "Envia mensagem de parabéns no dia do aniversário do aluno.",
          trigger: "birthday",
          offsetDays: 0,
          offsetHours: 0,
          messageTemplate: "🎂 Feliz Aniversário, {nome_aluno}! A equipe da {nome_escola} deseja um dia incrível cheio de muita música e alegria! 🎵🎉",
          channel: "whatsapp",
        },
        {
          name: "Confirmação de Pagamento Recebido",
          description: "Confirma ao aluno que o pagamento foi registrado.",
          trigger: "payment_confirmed",
          offsetDays: 0,
          offsetHours: 0,
          messageTemplate: "Olá {nome_aluno}! ✅ Seu pagamento de {valor_mensalidade} foi confirmado com sucesso. Obrigado pela pontualidade! Qualquer dúvida, estamos à disposição.",
          channel: "whatsapp",
        },
        {
          name: "Reativação de Aluno Inativo",
          description: "Envia mensagem para alunos que não acessam a plataforma há muitos dias.",
          trigger: "student_inactive",
          offsetDays: 30,
          offsetHours: 0,
          messageTemplate: "Olá {nome_aluno}! 🎵 Sentimos sua falta! Você está há {dias_sem_estudo} dias sem registrar atividades. Que tal voltar à sua jornada musical? Estamos aqui para te apoiar na {nome_escola}!",
          channel: "whatsapp",
        },
      ];

      for (const rule of systemRules) {
        await db.insert(messageAutomationRules).values({
          organizationId: orgId,
          userId,
          isSystem: 1,
          isActive: 1,
          ...rule,
        });
      }

      return { seeded: true, count: systemRules.length };
    }),
  }),
});

export type AppRouter = typeof appRouter;
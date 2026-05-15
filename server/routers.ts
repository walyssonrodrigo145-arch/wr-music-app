import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
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
import { organizations, users, students, lessons, instruments, reminders, reminderTemplates, paymentDues, asaasCustomers, settings, studentGoals, studentTimeline, studentFiles, announcements, chatMessages, rescheduleRequests, studentEvolution } from "../drizzle/schema";
import { eq, desc, sql, and, gte, lt, lte, asc, ne, or } from "drizzle-orm";
import { notifyOwner } from "./_core/notification";
import { handleDbError } from "./utils/error_handler";
import { TRPCError } from "@trpc/server";

import crypto from "crypto";
import { createAsaasCustomer, createAsaasCharge, deleteAsaasCharge, getAsaasPixQrCode } from "./utils/asaas";
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
        await db.delete(lessons).where(and(eq(lessons.organizationId, orgId), sql`studentId IN ${studentIds}`));
        await db.delete(paymentDues).where(and(eq(paymentDues.organizationId, orgId), sql`studentId IN ${studentIds}`));
        await db.delete(students).where(and(eq(students.organizationId, orgId), eq(students.id, sql`ANY(${studentIds})`)));
      }
      await db.delete(lessons).where(and(
        eq(lessons.organizationId, orgId),
        eq(lessons.userId, ctx.user.id), 
        sql`LOWER(title) LIKE ${term}`
      ));
      return { success: true, studentsRemoved: studentIds.length, lessonsRemoved: 0 };
    }),
  }),
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
    login: publicProcedure
      .input(z.object({ email: z.string().email(), password: z.string(), rememberMe: z.boolean().optional() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const [user] = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
        if (!user || !user.passwordHash) {
          throw new Error("Email ou senha inválidos");
        }
        
        const [salt, key] = user.passwordHash.split(":");
        const derivedKey = crypto.scryptSync(input.password, salt, 64).toString("hex");
        if (key !== derivedKey) {
          throw new Error("Email ou senha inválidos");
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

        return { success: true, role: user.role };
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

        // Create default organization for new admin
        const org = await db.insert(organizations).values({
          name: `${input.name}'s School`,
          slug: input.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
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
    })).mutation(async ({ ctx, input }) => {
      const orgId = ctx.user.organizationId!;
      // Simple sanitization of filename
      const safeName = input.fileName.replace(/[^a-zA-Z0-9.\-_]/g, '_');
      const key = `music-library/${orgId}/${ctx.user.id}/${Date.now()}-${safeName}`;
      
      // Remove data URL prefix if present
      const base64 = input.base64Data.includes(',') ? input.base64Data.split(',')[1] : input.base64Data;
      const buffer = Buffer.from(base64, 'base64');
      
      const { url } = await storagePut(key, buffer, input.fileType);
      return { url };
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
        notes: students.notes,
        startDate: students.startDate,
        createdAt: students.createdAt,
        instrumentName: instruments.name,
        instrumentColor: instruments.color,
        instrumentIcon: instruments.icon,
        professorId: students.professorId,
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
             eq(paymentDues.status, 'pendente')
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
      name: z.string().min(2, "O nome deve ter pelo menos 2 caracteres"),
      socialName: z.string().optional().nullable(),
      email: z.string().email("E-mail inválido").or(z.literal("")).optional().nullable(),
      phone: z.string().min(8, "Telefone é obrigatório"),
      birthDate: z.string().optional().nullable(),
      gender: z.string().optional().nullable(),
      cpf: z.string().optional().nullable(),
      rg: z.string().optional().nullable(),
      address: z.string().optional().nullable(),
      guardianName: z.string().optional().nullable(),
      guardianPhone: z.string().optional().nullable(),
      guardianEmail: z.string().email("E-mail do responsável inválido").or(z.literal("")).optional().nullable(),
      instrumentId: z.number().optional(),
      level: z.enum(['iniciante','intermediario','avancado']).default('iniciante'),
      monthlyFee: z.number().default(0),
      dueDay: z.number().default(10),
      notes: z.string().optional(),
      status: z.enum(['ativo','inativo','pausado']).default('ativo'),
      temporaryPassword: z.string().min(6, "A senha temporária deve ter pelo menos 6 caracteres").optional(),
    })).mutation(async ({ ctx, input }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Banco de dados não disponível");
        
        const orgId = ctx.user.organizationId!;
        // 1. Criar o Aluno primeiro para ter o ID
        const [newStudent] = await db.insert(students).values({
          organizationId: orgId,
          professorId: ctx.user.id,
          name: input.name,
          socialName: input.socialName,
          email: input.email || null,
          phone: input.phone,
          birthDate: input.birthDate,
          gender: input.gender,
          cpf: input.cpf,
          rg: input.rg,
          address: input.address,
          guardianName: input.guardianName,
          guardianPhone: input.guardianPhone,
          guardianEmail: input.guardianEmail,
          instrumentId: input.instrumentId,
          level: input.level,
          monthlyFee: String(input.monthlyFee),
          dueDay: input.dueDay,
          notes: input.notes,
          status: input.status,
          createdAt: new Date(),
          updatedAt: new Date(),
        }).returning({ id: students.id });

        // 2. Se informada senha temporária e email, criar o usuário
        if (input.temporaryPassword && input.email) {
          const salt = crypto.randomBytes(16).toString("hex");
          const derivedKey = crypto.scryptSync(input.temporaryPassword, salt, 64).toString("hex");
          const passwordHash = `${salt}:${derivedKey}`;
          const openId = crypto.randomUUID();

          const [newUser] = await db.insert(users).values({
            openId,
            organizationId: orgId,
            name: input.name,
            email: input.email,
            passwordHash,
            loginMethod: 'local',
            role: 'aluno',
            studentId: newStudent.id,
            isEmailVerified: true,
          }).returning({ id: users.id });

          // Atualizar o aluno com o link para o usuário
          await db.update(students)
            .set({ studentUserId: newUser.id })
            .where(and(eq(students.id, newStudent.id), eq(students.organizationId, orgId)));
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
      cpf: z.string().optional().nullable(),
      rg: z.string().optional().nullable(),
      address: z.string().optional().nullable(),
      guardianName: z.string().optional().nullable(),
      guardianPhone: z.string().optional().nullable(),
      guardianEmail: z.string().email("E-mail do responsável inválido").or(z.literal("")).optional().nullable(),
      email: z.string().email("E-mail inválido").or(z.literal("")).optional().nullable(),
      phone: z.string().min(8, "Telefone é obrigatório").optional(),
      instrumentId: z.number().optional().nullable(),
      level: z.enum(['iniciante', 'intermediario', 'avancado']).optional(),
      monthlyFee: z.number().optional(),
      dueDay: z.number().optional(),
      status: z.enum(['ativo', 'inativo', 'pausado']).optional(),
      notes: z.string().optional(),
      updateFutureDues: z.boolean().optional(),
    })).mutation(async ({ ctx, input }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Banco de dados não disponível");
        
        const orgId = ctx.user.organizationId!;
        const { id, updateFutureDues, ...data } = input;
        const updateData: any = { ...data, updatedAt: new Date() };
        if (updateData.monthlyFee !== undefined) {
          updateData.monthlyFee = String(updateData.monthlyFee);
        }
        
        await db.update(students).set(updateData).where(and(eq(students.id, id), eq(students.organizationId, orgId), eq(students.professorId, ctx.user.id)));

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
        }).where(and(eq(students.id, input.id), eq(students.organizationId, orgId), eq(students.professorId, ctx.user.id)));
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
        // Deletar aulas relacionadas primeiro para evitar erro de FK (garantindo que sejam aulas do próprio professor)
        await db.delete(lessons).where(and(eq(lessons.organizationId, orgId), eq(lessons.studentId, input.id), eq(lessons.userId, ctx.user.id)));
        await db.delete(students).where(and(eq(students.id, input.id), eq(students.organizationId, orgId), eq(students.professorId, ctx.user.id)));
        
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
      return getRecentLessons(orgId, isUserAdmin ? undefined : ctx.user.id, 50);
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
      title: z.string().min(2),
      scheduledAt: z.string(),
      duration: z.number().default(60),
      description: z.string().optional(),
      notes: z.string().optional(),
      instrumentId: z.number().nullable().optional(),
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
        const conflict = await db.select({ id: lessons.id }).from(lessons)
          .where(and(
            eq(lessons.organizationId, orgId),
            eq(lessons.userId, ctx.user.id),
            eq(lessons.status, 'agendada'),
            sql`(${lessons.scheduledAt}, (${lessons.scheduledAt} + (${lessons.duration} || ' minutes')::interval)) OVERLAPS (${scheduledAt.toISOString()}::timestamp, ${endsAt.toISOString()}::timestamp)`
          )).limit(1);

        if (conflict.length > 0) {
          throw new Error("Já existe uma aula agendada para este horário.");
        }

        await db.insert(lessons).values({
          organizationId: orgId,
          userId: ctx.user.id,
          studentId: input.studentId ?? null,
          isExperimental: !!input.isExperimental,
          experimentalName: input.experimentalName ?? null,
          title: input.title,
          scheduledAt: scheduledAt,
          duration: input.duration ?? 60,
          description: input.description ?? null,
          notes: input.notes ?? null,
          instrumentId: input.instrumentId ?? null,
          status: 'agendada',
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
      studentId: z.number().optional().nullable(),
      instrumentId: z.number().optional().nullable(),
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
          const conflict = await db.select({ id: lessons.id }).from(lessons)
            .where(and(
              eq(lessons.organizationId, orgId),
              eq(lessons.userId, ctx.user.id),
              eq(lessons.status, 'agendada'),
              sql`id != ${id}`,
              sql`(${lessons.scheduledAt}, (${lessons.scheduledAt} + (${lessons.duration} || ' minutes')::interval)) OVERLAPS (${scheduledAt.toISOString()}::timestamp, ${endsAt.toISOString()}::timestamp)`
            )).limit(1);

          if (conflict.length > 0) {
            throw new Error("Conflito de horário: Já existe uma aula agendada para este período.");
          }
          updateData.scheduledAt = scheduledAt;

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

        // Se estiver remarcando com uma nova data, validar conflitos
        if (input.scheduledAt) {
          const newDate = new Date(input.scheduledAt);
          const [current] = await db.select({ duration: lessons.duration }).from(lessons).where(and(eq(lessons.id, input.id), eq(lessons.organizationId, orgId))).limit(1);
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

        await db.update(lessons).set(updateData).where(and(eq(lessons.id, input.id), eq(lessons.organizationId, orgId), eq(lessons.userId, ctx.user.id)));
        
        return { success: true };
      } catch (error) {
        return handleDbError(error, "atualizar o status da aula");
      }
    }),
    delete: protectedProcedure.input(z.object({
      id: z.number(),
    })).mutation(async ({ ctx, input }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const orgId = ctx.user.organizationId!;
        await db.delete(lessons).where(and(eq(lessons.id, input.id), eq(lessons.organizationId, orgId), eq(lessons.userId, ctx.user.id)));
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
      weeksCount: z.number().min(1).max(13),
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
        const { id, ...rest } = input;
        await db.update(instruments).set(rest).where(and(eq(instruments.id, id), eq(instruments.organizationId, orgId), eq(instruments.userId, ctx.user.id)));
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
        // Remove instrument reference from students (only if student belongs to user)
        await db.update(students).set({ instrumentId: null }).where(and(eq(students.instrumentId, input.id), eq(students.organizationId, orgId), eq(students.professorId, ctx.user.id)));
        await db.delete(instruments).where(and(eq(instruments.id, input.id), eq(instruments.organizationId, orgId), eq(instruments.userId, ctx.user.id)));
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

    updateTheme: protectedProcedure.input(z.object({
      theme: z.enum(['light', 'dark']),
    })).mutation(async ({ ctx, input }) => {
      await upsertSettings(ctx.user.organizationId!, ctx.user.id, { theme: input.theme });
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
        if (!db) throw new Error("Database not available");
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
          })
          .from(reminders)
          .leftJoin(students, and(eq(reminders.studentId, students.id), eq(students.organizationId, orgId)))
          .where(and(eq(reminders.organizationId, orgId), eq(reminders.userId, ctx.user.id)))
          .orderBy(desc(reminders.scheduledAt));

        return rows.filter((r: any) => {
          if (input?.studentId && r.studentId !== input.studentId) return false;
          if (input?.type && r.type !== input.type) return false;
          if (input?.status && r.status !== input.status) return false;
          if (input?.dateFrom && new Date(r.scheduledAt) < new Date(input.dateFrom)) return false;
          if (input?.dateTo && new Date(r.scheduledAt) > new Date(input.dateTo)) return false;
          return true;
        });
      }),

    // ─ Contadores para dashboard ──────────────────────────────────────────────────
    pendingCount: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return 0;
      const orgId = ctx.user.organizationId!;
      const rows = await db.select({ id: reminders.id }).from(reminders)
        .where(and(eq(reminders.organizationId, orgId), eq(reminders.userId, ctx.user.id), eq(reminders.status, "pendente")));
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
        .leftJoin(students, and(eq(lessons.studentId, students.id), eq(lessons.organizationId, orgId)))
        .leftJoin(instruments, and(eq(lessons.instrumentId, instruments.id), eq(lessons.organizationId, orgId)))
        .where(
          and(
            eq(lessons.organizationId, orgId),
            eq(lessons.userId, ctx.user.id),
            gte(lessons.scheduledAt, monday),
            lt(lessons.scheduledAt, sunday)
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

        // Lembrete = exatamente 24h antes
        const reminderTime = new Date(lessonDate.getTime() - 24 * 60 * 60 * 1000);
        
        // Só gera se o momento do lembrete já chegou (ou está nos próximos 5 minutos)
        // E se o lembrete ainda é relevante (aula não passou)
        if (reminderTime > new Date(now.getTime() + 5 * 60 * 1000)) { skipped++; continue; }
        if (lessonDate <= now) { skipped++; continue; }
        
        // Não gerar se o lembrete já "caducou" (ex: a aula é amanhã mas o lembrete deveria ter sido enviado há mais de 12h)
        if (reminderTime.getTime() < now.getTime() - 12 * 60 * 60 * 1000) { skipped++; continue; }

        // Chave de deduplicação
        const refId = `lesson-${lesson.id}-${lessonDate.toISOString().slice(0, 10)}`;

        // Verificar duplicidade
        const existing = await db.select({ id: reminders.id }).from(reminders)
          .where(and(eq(reminders.refId, refId), eq(reminders.organizationId, orgId))).limit(1);
        if (existing.length > 0) { skipped++; continue; }

        // Buscar template padrão de aula
        const [tpl] = await db.select().from(reminderTemplates)
          .where(and(eq(reminderTemplates.organizationId, orgId), eq(reminderTemplates.userId, ctx.user.id), eq(reminderTemplates.type, "aula"), eq(reminderTemplates.isDefault, 1)))
          .limit(1);

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
        await notifyOwner({
          title: "🔔 Novos Lembretes (Aula)",
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
        .where(and(eq(paymentDues.organizationId, orgId), eq(paymentDues.status, "pendente"), eq(paymentDues.userId, ctx.user.id)));

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

        // Verificar duplicidade
        const existing = await db.select({ id: reminders.id }).from(reminders)
          .where(and(eq(reminders.refId, refId), eq(reminders.organizationId, orgId))).limit(1);
        if (existing.length > 0) { skipped++; continue; }

        // Buscar template padrão do tipo
        const [tpl] = await db.select().from(reminderTemplates)
          .where(and(eq(reminderTemplates.organizationId, orgId), eq(reminderTemplates.userId, ctx.user.id), eq(reminderTemplates.type, type), eq(reminderTemplates.isDefault, 1)))
          .limit(1);

        const vencimento = dueDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });
        const valor = Number(due.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
        const bodyTemplate = tpl?.body ?? defaultBody;
        const message = bodyTemplate
          .replace(/\{nome\}/g, due.studentName ?? "Aluno")
          .replace(/\{valor\}/g, valor)
          .replace(/\{vencimento\}/g, vencimento)
          .replace(/\{instrumento\}/g, due.instrumentName ?? "música");

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
        await notifyOwner({
          title: "🔔 Novos Lembretes (Cobrança)",
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
          .where(and(eq(reminders.id, input.id), eq(reminders.organizationId, orgId), eq(reminders.userId, ctx.user.id)));
        return { success: true };
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
          .where(and(eq(reminders.id, input.id), eq(reminders.organizationId, orgId), eq(reminders.userId, ctx.user.id)));
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
          .where(and(eq(reminders.id, input.id), eq(reminders.organizationId, orgId), eq(reminders.userId, ctx.user.id)));
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
              eq(reminders.userId, ctx.user.id),
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
              eq(reminders.userId, ctx.user.id),
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

  // ─── TEMPLATES DE LEMBRETE ──────────────────────────────────────────────────────────
  reminderTemplates: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const orgId = ctx.user.organizationId!;
      const db = await getDb();
      if (!db) throw new Error("Database not available");
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
        if (input?.status) return rows.filter(r => r.status === input.status);
        return rows;
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
          const [ownedStudent] = await db.select({ id: students.id }).from(students)
              .where(and(eq(students.id, input.studentId as number), eq(students.organizationId, orgId), eq(students.professorId, ctx.user.id)))
              .limit(1);
          
          if (!ownedStudent) {
              throw new TRPCError({ code: "FORBIDDEN", message: "O aluno selecionado não existe ou não pertence ao seu perfil." });
          }

          await db.insert(paymentDues).values({
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
          });
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
          await db.update(paymentDues)
            .set({ status: "pago", paidAt: new Date(), updatedAt: new Date() })
            .where(and(eq(paymentDues.id, input.id), eq(paymentDues.organizationId, orgId), eq(paymentDues.userId, ctx.user.id)));
          // Cancelar lembretes pendentes desta mensalidade
          await db.update(reminders)
            .set({ status: "cancelado", cancelledAt: new Date(), updatedAt: new Date() })
            .where(and(eq(reminders.paymentDueId, input.id), eq(reminders.organizationId, orgId), eq(reminders.userId, ctx.user.id), eq(reminders.status, "pendente")));
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
          await db.delete(paymentDues).where(and(eq(paymentDues.id, input.id), eq(paymentDues.organizationId, orgId), eq(paymentDues.userId, ctx.user.id)));
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
        monthsCount: z.number().min(1).max(3), // travado em 3 meses
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
      return rows;
    }),

    // ─ Listar mensalidades por aluno (todos os meses) ──────────────
    listByStudent: protectedProcedure
      .input(z.object({ studentId: z.number() }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) return [];
        const orgId = ctx.user.organizationId!;
        return db.select({
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
        }).from(paymentDues)
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

        payments.forEach(p => {
          const amt = Number(p.amount);
          if (p.status === 'pago') summary.pago += amt;
          else if (p.status === 'pendente') summary.pendente += amt;
          else if (p.status === 'atrasado') summary.atrasado += amt;
          summary.total += amt;
        });

        return summary;
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
          });
          await db.insert(asaasCustomers).values({
            organizationId: orgId,
            studentId: student.id,
            asaasCustomerId,
          });
        }

        // Create charge on Asaas
        const charge = await createAsaasCharge({
          asaasCustomerId,
          billingType: input.billingType,
          value: Number(due.amount),
          dueDate: due.dueDate,
          description: `Mensalidade ${due.month}/${due.year} - ${student.name}`,
        });

        // Fetch PIX QR code if PIX
        let pixPayload: string | null = null;
        let pixQrCode: string | null = null;
        if (input.billingType === "PIX") {
          try {
            const pix = await getAsaasPixQrCode(charge.id);
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

        db.select({
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
          .limit(3),
          
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
      return db.select().from(studentFiles).where(and(eq(studentFiles.studentId, studentId), eq(studentFiles.organizationId, orgId))).orderBy(desc(studentFiles.createdAt));
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
      
      return { 
        ...student, 
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
  }),
});

export type AppRouter = typeof appRouter;
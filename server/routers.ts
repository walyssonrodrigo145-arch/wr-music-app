import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
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
import { users, students, lessons, instruments, reminders, reminderTemplates, paymentDues, settings } from "../drizzle/schema";
import { eq, desc, sql, and, gte, lt, lte, asc } from "drizzle-orm";
import { notifyOwner } from "./_core/notification";
import { handleDbError } from "./utils/error_handler";
import { TRPCError } from "@trpc/server";

import crypto from "crypto";
import { nanoid } from "nanoid";
import { sdk } from "./_core/sdk";
import { sendVerificationEmail } from "./_core/email";
import { ENV } from "./_core/env";

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

        return { success: true };
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
        
        const [existing] = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
        if (existing) throw new Error("E-mail já está em uso");

        const salt = crypto.randomBytes(16).toString("hex");
        const derivedKey = crypto.scryptSync(input.password, salt, 64).toString("hex");
        const passwordHash = `${salt}:${derivedKey}`;
        const openId = crypto.randomUUID();

        await db.insert(users).values({
          openId,
          name: input.name,
          email: input.email,
          passwordHash,
          loginMethod: "local",
          role: "admin",
          isEmailVerified: true,
        });

        return { success: true, message: "Conta criada com sucesso! Você já pode fazer login." };
      }),
  }),

  dashboard: router({
    stats: protectedProcedure.query(async ({ ctx }) => {
      return getDashboardStats(ctx.user.id);
    }),
    monthlyStats: protectedProcedure.query(async ({ ctx }) => {
      const stats = await getMonthlyStats(ctx.user.id, 12);
      return stats.reverse();
    }),
    experimentalStats: protectedProcedure
      .input(z.object({
        month: z.number().optional(),
        year: z.number().optional()
      }).optional())
      .query(async ({ ctx, input }) => {
        return getExperimentalStats(ctx.user.id, input?.month, input?.year);
      }),
    lessonsByDay: protectedProcedure.query(async ({ ctx }) => {
      const data = await getLessonsByDayOfWeek(ctx.user.id);
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
      return getStudentsWithInstrument(ctx.user.id);
    }),
    recent: protectedProcedure.query(async ({ ctx }) => {
      return getStudentsWithInstrument(ctx.user.id, 8);
    }),
    getDetails: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return null;
      
      const [student] = await db.select({
        id: students.id,
        name: students.name,
        email: students.email,
        phone: students.phone,
        level: students.level,
        status: students.status,
        monthlyFee: students.monthlyFee,
        startDate: students.startDate,
        createdAt: students.createdAt,
        instrumentName: instruments.name,
        instrumentColor: instruments.color,
        instrumentIcon: instruments.icon,
      }).from(students)
        .leftJoin(instruments, eq(students.instrumentId, instruments.id))
        .where(and(eq(students.id, input.id), eq(students.userId, ctx.user.id)))
        .limit(1);

      if (!student) return null;

      // Buscar último pagamento
      const [lastPayment] = await db.select().from(paymentDues)
        .where(and(
           eq(paymentDues.studentId, input.id),
           eq(paymentDues.status, 'pago')
        ))
        .orderBy(desc(paymentDues.paidAt))
        .limit(1);

      // Buscar próximo vencimento pendente (ou o mais recente)
      const [nextPayment] = await db.select().from(paymentDues)
        .where(and(
           eq(paymentDues.studentId, input.id),
           eq(paymentDues.status, 'pendente')
        ))
        .orderBy(asc(paymentDues.dueDate))
        .limit(1);

      return {
        ...student,
        lastPaymentDate: lastPayment?.paidAt || null,
        nextDueDate: nextPayment?.dueDate || null, 
      };
    }),
    create: protectedProcedure.input(z.object({
      name: z.string().min(2, "O nome deve ter pelo menos 2 caracteres"),
      email: z.string().email("E-mail inválido").optional().nullable(),
      phone: z.string().min(8, "Telefone é obrigatório"),
      instrumentId: z.number().optional(),
      level: z.enum(['iniciante','intermediario','avancado']).default('iniciante'),
      monthlyFee: z.number().default(0),
      notes: z.string().optional(),
      status: z.enum(['ativo','inativo','pausado']).default('ativo'),
    })).mutation(async ({ ctx, input }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Banco de dados não disponível");
        
        await db.insert(students).values({
          userId: ctx.user.id,
          name: input.name,
          email: input.email || null,
          phone: input.phone,
          instrumentId: input.instrumentId,
          level: input.level,
          monthlyFee: String(input.monthlyFee),
          notes: input.notes,
          status: input.status,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        
        return { success: true };
      } catch (error) {
        return handleDbError(error, "cadastrar o aluno");
      }
    }),

    update: protectedProcedure.input(z.object({
      id: z.number(),
      name: z.string().optional(),
      email: z.string().email().optional().nullable(),
      phone: z.string().min(8, "Telefone é obrigatório").optional(),
      instrumentId: z.number().optional().nullable(),
      level: z.enum(['iniciante', 'intermediario', 'avancado']).optional(),
      monthlyFee: z.number().optional(),
      status: z.enum(['ativo', 'inativo', 'pausado']).optional(),
      notes: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Banco de dados não disponível");
        
        const { id, ...data } = input;
        await db.update(students).set({
          ...data,
          updatedAt: new Date(),
        }).where(and(eq(students.id, id), eq(students.userId, ctx.user.id)));
        
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
        if (!db) throw new Error("Banco de dados não disponível");
        await db.update(students).set({
          status: input.status,
          updatedAt: new Date(),
        }).where(and(eq(students.id, input.id), eq(students.userId, ctx.user.id)));
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
        
        // Deletar aulas relacionadas primeiro para evitar erro de FK (garantindo que sejam aulas do próprio professor)
        await db.delete(lessons).where(and(eq(lessons.studentId, input.id), eq(lessons.userId, ctx.user.id)));
        await db.delete(students).where(and(eq(students.id, input.id), eq(students.userId, ctx.user.id)));
        
        return { success: true };
      } catch (error) {
        return handleDbError(error, "remover o aluno");
      }
    }),
    search: protectedProcedure.input(z.object({ q: z.string() })).query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      if (!input.q.trim()) return [];
      const term = `%${input.q.toLowerCase()}%`;
      return db.select({
        id: students.id,
        name: students.name,
        email: students.email,
        status: students.status,
      }).from(students).where(and(
        eq(students.userId, ctx.user.id),
        sql`LOWER(name) LIKE ${term} OR LOWER(email) LIKE ${term}`
      )).limit(8);
    }),
  }),

  lessons: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getRecentLessons(ctx.user.id, 50);
    }),
    upcoming: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
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
          eq(lessons.status, 'agendada'), 
          eq(lessons.userId, ctx.user.id),
          gte(lessons.scheduledAt, now),
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

        const scheduledAt = new Date(input.scheduledAt);
        const endsAt = new Date(scheduledAt.getTime() + input.duration * 60000);
  
        // Segurança: Verificar se o aluno pertence ao usuário logado (se não for experimental)
        if (!input.isExperimental) {
          if (!input.studentId) throw new Error("O campo aluno é obrigatório para aulas comuns.");
          const [ownedStudent] = await db.select({ id: students.id }).from(students)
            .where(and(eq(students.id, input.studentId), eq(students.userId, ctx.user.id)))
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
            .where(and(eq(instruments.id, input.instrumentId), eq(instruments.userId, ctx.user.id)))
            .limit(1);
          if (!ownedInstrument) {
            throw new Error("O instrumento selecionado não pertence ao seu perfil.");
          }
        }
  
        // Prevenção de conflitos (mesmo professor/userId)
        const conflict = await db.select({ id: lessons.id }).from(lessons)
          .where(and(
            eq(lessons.userId, ctx.user.id),
            eq(lessons.status, 'agendada'),
            sql`(${lessons.scheduledAt}, (${lessons.scheduledAt} + (${lessons.duration} || ' minutes')::interval)) OVERLAPS (${scheduledAt.toISOString()}::timestamp, ${endsAt.toISOString()}::timestamp)`
          )).limit(1);

        if (conflict.length > 0) {
          throw new Error("Já existe uma aula agendada para este horário.");
        }

        await db.insert(lessons).values({
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
    })).mutation(async ({ ctx, input }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const { id, ...data } = input;
        const updateData: any = { ...data };
        const updateSeries = (input as any).updateSeries === true;

        // Buscar aula atual para pegar o recurringGroupId e data original
        const [currentLesson] = await db.select().from(lessons).where(and(eq(lessons.id, id), eq(lessons.userId, ctx.user.id))).limit(1);
        if (!currentLesson) throw new Error("Aula não encontrada ou você não tem permissão.");

        // Segurança: Verificar propriedade do aluno se estiver sendo alterado
        if (data.studentId) {
          const [ownedStudent] = await db.select({ id: students.id }).from(students)
            .where(and(eq(students.id, data.studentId), eq(students.userId, ctx.user.id)))
            .limit(1);
          if (!ownedStudent) throw new Error("O aluno selecionado não pertence ao seu perfil.");
        }

        // Segurança: Verificar propriedade do instrumento se estiver sendo alterado
        if (data.instrumentId) {
          const [ownedInstrument] = await db.select({ id: instruments.id }).from(instruments)
            .where(and(eq(instruments.id, data.instrumentId), eq(instruments.userId, ctx.user.id)))
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
              }).where(and(eq(lessons.id, future.id), eq(lessons.userId, ctx.user.id)));
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
            eq(lessons.recurringGroupId, currentLesson.recurringGroupId),
            eq(lessons.userId, ctx.user.id),
            gte(lessons.scheduledAt, currentLesson.scheduledAt)
          ));
        }

        await db.update(lessons).set(updateData).where(and(eq(lessons.id, id), eq(lessons.userId, ctx.user.id)));
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

        const updateData: any = {
          status: input.status,
          rating: input.rating,
          updatedAt: new Date(),
        };

        // Se estiver remarcando com uma nova data, validar conflitos
        if (input.scheduledAt) {
          const newDate = new Date(input.scheduledAt);
          // Buscar duração atual para validar conflito (pode vir do input no futuro se permitirmos mudar)
          const [current] = await db.select({ duration: lessons.duration }).from(lessons).where(eq(lessons.id, input.id)).limit(1);
          const duration = current?.duration || 60;
          const endsAt = new Date(newDate.getTime() + duration * 60000);

          const conflict = await db.select({ id: lessons.id }).from(lessons)
            .where(and(
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

        await db.update(lessons).set(updateData).where(and(eq(lessons.id, input.id), eq(lessons.userId, ctx.user.id)));
        
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
        if (!db) throw new Error("Banco de dados não disponível");
        await db.delete(lessons).where(and(eq(lessons.id, input.id), eq(lessons.userId, ctx.user.id)));
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
        if (!db) throw new Error("Banco de dados não disponível");

        if (input.type === 'student') {
          if (!input.studentId) throw new Error("ID do aluno não fornecido");
          await db.delete(lessons).where(and(
             eq(lessons.userId, ctx.user.id),
             eq(lessons.studentId, input.studentId),
             eq(lessons.status, 'agendada')
          ));
        } else {
          // Apagar todas as aulas não concluídas do usuário
          await db.delete(lessons).where(and(
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
      if (!db) return [];
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
        .leftJoin(students, eq(lessons.studentId, students.id))
        .leftJoin(instruments, eq(students.instrumentId, instruments.id))
        .where(and(
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
        .leftJoin(students, eq(lessons.studentId, students.id))
        .leftJoin(instruments, eq(students.instrumentId, instruments.id))
        .where(and(
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
          .leftJoin(students, eq(lessons.studentId, students.id))
          .where(and(
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

        // Segurança: Verificar se o aluno pertence ao usuário logado
        const [ownedStudent] = await db.select({ id: students.id }).from(students)
          .where(and(eq(students.id, input.studentId), eq(students.userId, ctx.user.id)))
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
                eq(lessons.userId, ctx.user.id),
                eq(lessons.status, 'agendada'),
                sql`(${lessons.scheduledAt}, (${lessons.scheduledAt} + (${lessons.duration} || ' minutes')::interval)) OVERLAPS (${scheduledAt.toISOString()}::timestamp, ${endsAt.toISOString()}::timestamp)`
              )).limit(1);
              
            if (conflict) continue; // Pula se tem conflito e não foi forçado
          }
          
          rowsToInsert.push({
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
      return getInstrumentsWithCount(ctx.user.id);
    }),
    create: protectedProcedure.input(z.object({
      name: z.string().min(2),
      category: z.string().min(2),
      color: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Banco de dados não disponível");
        await db.insert(instruments).values({
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
        if (!db) throw new Error("Banco de dados não disponível");
        const { id, ...rest } = input;
        await db.update(instruments).set(rest).where(and(eq(instruments.id, id), eq(instruments.userId, ctx.user.id)));
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
        if (!db) throw new Error("Banco de dados não disponível");
        // Remove instrument reference from students (only if student belongs to user)
        await db.update(students).set({ instrumentId: null }).where(and(eq(students.instrumentId, input.id), eq(students.userId, ctx.user.id)));
        await db.delete(instruments).where(and(eq(instruments.id, input.id), eq(instruments.userId, ctx.user.id)));
        return { success: true };
      } catch (error) {
        return handleDbError(error, "remover o instrumento");
      }
    }),
    search: protectedProcedure.input(z.object({ q: z.string() })).query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      if (!input.q.trim()) return [];
      const term = `%${input.q.toLowerCase()}%`;
      return db.select({
        id: instruments.id,
        name: instruments.name,
        category: instruments.category,
      }).from(instruments).where(and(
        eq(instruments.userId, ctx.user.id),
        sql`LOWER(name) LIKE ${term}`
      )).limit(5);
    }),
  }),

  settings: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      return getSettingsByUserId(ctx.user.id);
    }),

    updateProfile: protectedProcedure.input(z.object({
      name: z.string().min(2).optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      bio: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const { phone, bio, ...userFields } = input;
      if (userFields.name || userFields.email) {
        await updateUserProfile(ctx.user.id, userFields);
      }
      await upsertSettings(ctx.user.id, { phone, bio });
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
      await upsertSettings(ctx.user.id, input);
      return { success: true };
    }),

    updateNotifications: protectedProcedure.input(z.object({
      notifyLessonReminder: z.boolean().optional(),
      notifyPaymentDue: z.boolean().optional(),
      notifyStudentAbsence: z.boolean().optional(),
      notifyNewStudent: z.boolean().optional(),
      notifyWeeklyReport: z.boolean().optional(),
    })).mutation(async ({ ctx, input }) => {
      await upsertSettings(ctx.user.id, {
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
      await upsertSettings(ctx.user.id, { theme: input.theme });
      return { success: true };
    }),

    getAutomation: protectedProcedure.query(async ({ ctx }) => {
      const s = await getSettingsByUserId(ctx.user.id);
      return {
        enabled: s?.automationEnabled === 1,
        lastRun: s?.automationLastRun ?? null,
      };
    }),

    toggleAutomation: protectedProcedure.input(z.object({
      enabled: z.boolean(),
    })).mutation(async ({ ctx, input }) => {
      await upsertSettings(ctx.user.id, {
        automationEnabled: input.enabled ? 1 : 0,
      });
      return { success: true, enabled: input.enabled };
    }),

    exportData: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

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
      }).from(students).where(eq(students.userId, ctx.user.id)).orderBy(students.name);

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
        .where(eq(lessons.userId, ctx.user.id))
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
        studentId: z.number().optional(),
        type: z.enum(["aula", "cobranca", "inadimplencia", "manual"]).optional(),
        status: z.enum(["pendente", "enviado", "cancelado"]).optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) return [];
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
          .leftJoin(students, eq(reminders.studentId, students.id))
          .where(eq(reminders.userId, ctx.user.id))
          .orderBy(desc(reminders.scheduledAt));

        return rows.filter(r => {
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
      const rows = await db.select({ id: reminders.id }).from(reminders)
        .where(and(eq(reminders.userId, ctx.user.id), eq(reminders.status, "pendente")));
      return rows.length;
    }),

    // ─ Geração automática de lembretes de AULA (24h antes, semana atual) ───────────────
    generateLessonReminders: protectedProcedure.mutation(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

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
        .leftJoin(students, eq(lessons.studentId, students.id))
        .leftJoin(instruments, eq(students.instrumentId, instruments.id))
        .where(
          and(
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
          .where(eq(reminders.refId, refId)).limit(1);
        if (existing.length > 0) { skipped++; continue; }

        // Buscar template padrão de aula
        const [tpl] = await db.select().from(reminderTemplates)
          .where(and(eq(reminderTemplates.userId, ctx.user.id), eq(reminderTemplates.type, "aula"), eq(reminderTemplates.isDefault, 1)))
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
        .leftJoin(students, eq(paymentDues.studentId, students.id))
        .leftJoin(instruments, eq(students.instrumentId, instruments.id))
        .where(and(eq(paymentDues.status, "pendente"), eq(paymentDues.userId, ctx.user.id)));

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
          .where(eq(reminders.refId, refId)).limit(1);
        if (existing.length > 0) { skipped++; continue; }

        // Buscar template padrão do tipo
        const [tpl] = await db.select().from(reminderTemplates)
          .where(and(eq(reminderTemplates.userId, ctx.user.id), eq(reminderTemplates.type, type), eq(reminderTemplates.isDefault, 1)))
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
        studentId: z.number().optional(),
        type: z.enum(["aula", "cobranca", "inadimplencia", "manual"]),
        message: z.string().min(1),
        scheduledAt: z.string(), // ISO
        templateId: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        await db.insert(reminders).values({
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
        await db.update(reminders)
          .set({ status: "enviado", sentAt: new Date() })
          .where(and(eq(reminders.id, input.id), eq(reminders.userId, ctx.user.id)));
        return { success: true };
      }),

    // ─ Cancelar lembrete ────────────────────────────────────────────────────────────
    cancel: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        await db.update(reminders)
          .set({ status: "cancelado", cancelledAt: new Date() })
          .where(and(eq(reminders.id, input.id), eq(reminders.userId, ctx.user.id)));
        return { success: true };
      }),

    // ─ Excluir lembrete ────────────────────────────────────────────────────────────
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        await db.delete(reminders)
          .where(and(eq(reminders.id, input.id), eq(reminders.userId, ctx.user.id)));
        return { success: true };
      }),

    // ─ Cancelar lembrete quando aula é cancelada ────────────────────────────────
    syncLessonCancelled: protectedProcedure
      .input(z.object({ lessonId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        await db.update(reminders)
          .set({ status: "cancelado", cancelledAt: new Date() })
          .where(
            and(
              eq(reminders.lessonId, input.lessonId),
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
        await db.update(reminders)
          .set({ status: "cancelado", cancelledAt: new Date() })
          .where(
            and(
              eq(reminders.paymentDueId, input.paymentDueId),
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
      const db = await getDb();
      if (!db) return [];
      return db.select().from(reminderTemplates)
        .where(eq(reminderTemplates.userId, ctx.user.id))
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
          const db = await getDb();
          if (!db) throw new Error("Banco de dados não disponível");
          
          if (input.isDefault) {
            await db.update(reminderTemplates)
              .set({ isDefault: 0 })
              .where(and(eq(reminderTemplates.userId, ctx.user.id), eq(reminderTemplates.type, input.type)));
          }
          await db.insert(reminderTemplates).values({
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
          if (!db) throw new Error("Banco de dados não disponível");
          const { id, isDefault, ...rest } = input;
          const updateData: Record<string, unknown> = { ...rest };
          
          if (isDefault !== undefined) {
            if (isDefault && rest.type) {
              await db.update(reminderTemplates)
                .set({ isDefault: 0 })
                .where(and(eq(reminderTemplates.userId, ctx.user.id), eq(reminderTemplates.type, rest.type)));
            }
            updateData.isDefault = isDefault ? 1 : 0;
          }
          
          await db.update(reminderTemplates).set(updateData)
            .where(and(eq(reminderTemplates.id, id), eq(reminderTemplates.userId, ctx.user.id)));
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
          if (!db) throw new Error("Banco de dados não disponível");
          await db.delete(reminderTemplates)
            .where(and(eq(reminderTemplates.id, input.id), eq(reminderTemplates.userId, ctx.user.id)));
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
        const now = new Date();
        const m = input?.month ?? now.getMonth() + 1;
        const y = input?.year ?? now.getFullYear();
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
          studentName: students.name,
          studentPhone: students.phone,
        })
          .from(paymentDues)
          .leftJoin(students, eq(paymentDues.studentId, students.id))
          .where(and(eq(paymentDues.month, m), eq(paymentDues.year, y), eq(paymentDues.userId, ctx.user.id)))
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
          if (!db) throw new Error("Banco de dados não disponível");
   
          // Security: verify student ownership
          const [ownedStudent] = await db.select({ id: students.id }).from(students)
              .where(and(eq(students.id, input.studentId), eq(students.userId, ctx.user.id)))
              .limit(1);
          
          if (!ownedStudent) {
              throw new TRPCError({ code: "FORBIDDEN", message: "O aluno selecionado não existe ou não pertence ao seu perfil." });
          }

          await db.insert(paymentDues).values({
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
          if (!db) throw new Error("Banco de dados não disponível");
          await db.update(paymentDues)
            .set({ status: "pago", paidAt: new Date(), updatedAt: new Date() })
            .where(and(eq(paymentDues.id, input.id), eq(paymentDues.userId, ctx.user.id)));
          // Cancelar lembretes pendentes desta mensalidade
          await db.update(reminders)
            .set({ status: "cancelado", cancelledAt: new Date(), updatedAt: new Date() })
            .where(and(eq(reminders.paymentDueId, input.id), eq(reminders.userId, ctx.user.id), eq(reminders.status, "pendente")));
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
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          const db = await getDb();
          if (!db) throw new Error("Banco de dados não disponível");
          const { id, ...data } = input;
          
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
            .where(and(eq(paymentDues.id, id), eq(paymentDues.userId, ctx.user.id)));
            
          return { success: true };
        } catch (error) {
          return handleDbError(error, "atualizar a mensalidade");
        }
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        try {
          const db = await getDb();
          if (!db) throw new Error("Banco de dados não disponível");
          await db.delete(paymentDues).where(and(eq(paymentDues.id, input.id), eq(paymentDues.userId, ctx.user.id)));
          return { success: true };
        } catch (error) {
          return handleDbError(error, "remover a mensalidade");
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

          // Verificar duplicidade (mesmo aluno, mesmo mês/ano)
          const existing = await db.select({ id: paymentDues.id }).from(paymentDues)
            .where(and(
              eq(paymentDues.studentId, input.studentId),
              eq(paymentDues.month, month),
              eq(paymentDues.year, y),
              eq(paymentDues.userId, ctx.user.id),
            )).limit(1);
          if (existing.length > 0) continue; // pular duplicados

          rows.push({
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
        .leftJoin(students, eq(paymentDues.studentId, students.id))
        .where(and(
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
          .where(and(eq(paymentDues.studentId, input.studentId), eq(paymentDues.userId, ctx.user.id)))
          .orderBy(asc(paymentDues.year), asc(paymentDues.month));
      }),
  }),
});

export type AppRouter = typeof appRouter;
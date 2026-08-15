import { z } from "zod";
import { router, studentProcedure, protectedProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { slotOffers, lessons, students, users, settings, instruments } from "../drizzle/schema";
import { eq, and, gt, gte, lte, or, sql, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { notifyUser } from "./_core/notification";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const slotAdvanceRouter = router({
  // ─ Buscar vagas antecipadas disponíveis para o aluno logado hoje ──────────
  getAvailableEarlySlots: studentProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];

    const orgId = ctx.user.organizationId!;

    // 1. Identificar o cadastro do aluno correspondente a esta conta
    const [studentRecord] = await db
      .select({
        id: students.id,
        name: students.name,
        professorId: students.professorId,
        instrumentId: students.instrumentId,
      })
      .from(students)
      .where(and(
        eq(students.organizationId, orgId),
        or(
          eq(students.studentUserId, ctx.user.id),
          eq(students.email, ctx.user.email || "")
        )
      ))
      .limit(1);

    if (!studentRecord) return [];

    // 2. Buscar a aula agendada do aluno para hoje
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const [todayLesson] = await db
      .select({
        id: lessons.id,
        scheduledAt: lessons.scheduledAt,
        duration: lessons.duration,
        teacherId: lessons.userId,
        title: lessons.title,
        instrumentId: lessons.instrumentId,
      })
      .from(lessons)
      .where(and(
        eq(lessons.organizationId, orgId),
        eq(lessons.studentId, studentRecord.id),
        eq(lessons.status, "agendada"),
        gte(lessons.scheduledAt, now), // Aula ainda não começou
        lte(lessons.scheduledAt, endOfDay)
      ))
      .limit(1);

    if (!todayLesson) return [];

    // 3. Buscar ofertas de vagas abertas com o mesmo professor e ANTES da aula atual
    const tolerance = new Date(now.getTime() - 10 * 60000); // Até 10 min de tolerância

    const offers = await db
      .select({
        id: slotOffers.id,
        slotDate: slotOffers.slotDate,
        duration: slotOffers.duration,
        title: slotOffers.title,
        instrumentId: slotOffers.instrumentId,
        teacherId: slotOffers.teacherId,
        teacherName: users.name,
        instrumentName: instruments.name,
      })
      .from(slotOffers)
      .leftJoin(users, eq(slotOffers.teacherId, users.id))
      .leftJoin(instruments, eq(slotOffers.instrumentId, instruments.id))
      .where(and(
        eq(slotOffers.organizationId, orgId),
        eq(slotOffers.teacherId, todayLesson.teacherId), // Mesmo professor
        eq(slotOffers.status, "aberta"),
        gt(slotOffers.slotDate, tolerance), // Horário da vaga ainda válido
        sql`${slotOffers.slotDate} < ${todayLesson.scheduledAt}` // Vaga é mais cedo que o horário do aluno
      ));

    return offers.map(offer => ({
      ...offer,
      studentLessonId: todayLesson.id,
      currentLessonTime: todayLesson.scheduledAt,
      formattedSlotTime: format(new Date(offer.slotDate), "HH:mm"),
      formattedCurrentTime: format(new Date(todayLesson.scheduledAt), "HH:mm"),
      formattedDate: format(new Date(offer.slotDate), "dd 'de' MMMM", { locale: ptBR }),
    }));
  }),

  // ─ Aluno aceita antecipar o horário de sua aula de hoje ────────────────────
  acceptEarlySlot: studentProcedure
    .input(z.object({
      slotOfferId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível" });

      const orgId = ctx.user.organizationId!;

      // 1. Identificar o aluno
      const [studentRecord] = await db
        .select({
          id: students.id,
          name: students.name,
          phone: students.phone,
          guardianPhone: students.guardianPhone,
        })
        .from(students)
        .where(and(
          eq(students.organizationId, orgId),
          or(
            eq(students.studentUserId, ctx.user.id),
            eq(students.email, ctx.user.email || "")
          )
        ))
        .limit(1);

      if (!studentRecord) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Perfil de aluno não encontrado." });
      }

      // 2. Buscar a aula do aluno para hoje
      const now = new Date();
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);

      const [todayLesson] = await db
        .select({
          id: lessons.id,
          scheduledAt: lessons.scheduledAt,
          userId: lessons.userId,
        })
        .from(lessons)
        .where(and(
          eq(lessons.organizationId, orgId),
          eq(lessons.studentId, studentRecord.id),
          eq(lessons.status, "agendada"),
          gte(lessons.scheduledAt, now),
          lte(lessons.scheduledAt, endOfDay)
        ))
        .limit(1);

      if (!todayLesson) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Você não possui aula agendada para hoje para poder antecipar." });
      }

      // 3. Atualização Atômica com trava de concorrência na oferta
      const [acceptedOffer] = await db
        .update(slotOffers)
        .set({
          status: "aceita",
          acceptedByStudentId: studentRecord.id,
          acceptedLessonId: todayLesson.id,
          acceptedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(
          eq(slotOffers.id, input.slotOfferId),
          eq(slotOffers.organizationId, orgId),
          eq(slotOffers.status, "aberta")
        ))
        .returning({
          id: slotOffers.id,
          slotDate: slotOffers.slotDate,
          teacherId: slotOffers.teacherId,
        });

      if (!acceptedOffer) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Esta vaga acabou de ser preenchida por outro aluno ou não está mais disponível."
        });
      }

      const previousTime = format(new Date(todayLesson.scheduledAt), "HH:mm");
      const newTime = format(new Date(acceptedOffer.slotDate), "HH:mm");

      // 4. Atualizar a data da aula do aluno para o novo horário antecipado
      await db
        .update(lessons)
        .set({
          scheduledAt: acceptedOffer.slotDate,
          updatedAt: new Date(),
        })
        .where(and(
          eq(lessons.id, todayLesson.id),
          eq(lessons.organizationId, orgId)
        ));

      // 5. Notificar o Professor e a Escola
      try {
        await notifyUser(acceptedOffer.teacherId, {
          title: "⚡ Horário de Aula Antecipado!",
          content: `O aluno ${studentRecord.name} antecipou a aula de hoje das ${previousTime} para às ${newTime}.`
        });
      } catch (e) {
        console.error("[SlotAdvance] Erro ao notificar professor:", e);
      }

      return {
        success: true,
        newTime,
        message: `Aula antecipada com sucesso para às ${newTime}!`
      };
    }),
});

import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { enrollmentLinks, crmLeads, instruments, professores, users, lessons, students, settings, studioRooms } from "../drizzle/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import crypto from "crypto";

export const enrollmentRouter = router({
  // 1. Gera um link de auto-matrícula exclusivo (Admin/CRM)
  generateLink: protectedProcedure
    .input(
      z.object({
        leadId: z.number().optional(),
        instrumentId: z.number().optional(),
        monthlyFee: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const orgId = ctx.user.organizationId!;

      const code = crypto.randomBytes(16).toString("hex");

      const [link] = await db
        .insert(enrollmentLinks)
        .values({
          organizationId: orgId,
          code,
          leadId: input.leadId,
          instrumentId: input.instrumentId,
          monthlyFee: input.monthlyFee ? String(input.monthlyFee) : undefined,
          status: "active",
        })
        .returning();

      return { code: link.code, url: `/matricula/${link.code}` };
    }),

  // 2. Rota Pública: Retorna os detalhes do link e da escola para o Aluno
  getPublicDetails: publicProcedure
    .input(z.object({ code: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const [link] = await db
        .select()
        .from(enrollmentLinks)
        .where(eq(enrollmentLinks.code, input.code))
        .limit(1);

      if (!link || link.status !== "active") {
        throw new Error("Link de matrícula inválido ou expirado.");
      }

      const orgId = link.organizationId;
      const [schoolSet] = await db.select().from(settings).where(eq(settings.organizationId, orgId)).limit(1);

      let leadData = null;
      if (link.leadId) {
        const [lead] = await db.select().from(crmLeads).where(eq(crmLeads.id, link.leadId)).limit(1);
        if (lead) leadData = lead;
      }

      const allInstruments = await db.select().from(instruments).where(eq(instruments.organizationId, orgId));

      return {
        code: link.code,
        schoolName: schoolSet?.schoolName || "Escola de Música",
        schoolPhone: schoolSet?.schoolPhone || schoolSet?.phone,
        monthlyFee: link.monthlyFee ? Number(link.monthlyFee) : null,
        preselectedInstrumentId: link.instrumentId,
        lead: leadData,
        instruments: allInstruments,
      };
    }),

  // 3. Rota Pública: Calcula os horários livres considerando Professor + Sala + Horário da Escola
  getAvailableSlots: publicProcedure
    .input(
      z.object({
        code: z.string(),
        instrumentId: z.number(),
        dateStr: z.string(), // YYYY-MM-DD
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const [link] = await db
        .select()
        .from(enrollmentLinks)
        .where(eq(enrollmentLinks.code, input.code))
        .limit(1);

      if (!link) throw new Error("Link não encontrado");
      const orgId = link.organizationId;

      // Busca o instrumento para saber o nome/categoria
      const [inst] = await db.select().from(instruments).where(eq(instruments.id, input.instrumentId)).limit(1);
      if (!inst) throw new Error("Instrumento não encontrado");

      // Busca os professores associados à escola que lecionam esse instrumento
      const availableTeachers = await db
        .select({
          id: professores.id,
          userId: professores.userId,
          name: users.name,
          especialidade: professores.especialidade,
        })
        .from(professores)
        .leftJoin(users, eq(professores.userId, users.id))
        .where(eq(professores.organizationId, orgId));

      // Filtra os que tem a especialidade batendo com o instrumento (ou todos se não filtrado)
      const targetTeacher = availableTeachers.find(t => 
        (t.especialidade || "").toLowerCase().includes(inst.name.toLowerCase())
      ) || availableTeachers[0];

      if (!targetTeacher) {
        throw new Error("Nenhum professor encontrado para este instrumento.");
      }

      // Busca as salas de estúdio da escola
      const rooms = await db.select().from(studioRooms).where(and(eq(studioRooms.organizationId, orgId), eq(studioRooms.active, true)));
      const availableRoom = rooms[0] || null;

      // Define grade fixa de horários de atendimento (das 08:00 às 20:00 de hora em hora)
      const times = ["08:00", "09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00"];

      // Busca as aulas agendadas para essa data
      const startOfDay = new Date(`${input.dateStr}T00:00:00-03:00`);
      const endOfDay = new Date(`${input.dateStr}T23:59:59-03:00`);

      const existingLessons = await db
        .select({ scheduledAt: lessons.scheduledAt })
        .from(lessons)
        .where(
          and(
            eq(lessons.organizationId, orgId),
            gte(lessons.scheduledAt, startOfDay),
            lte(lessons.scheduledAt, endOfDay)
          )
        );

      const busyTimes = existingLessons.map(l => {
        const d = new Date(l.scheduledAt);
        return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
      });

      const slots = times.map(time => ({
        time,
        available: !busyTimes.includes(time),
      }));

      return {
        teacher: targetTeacher,
        room: availableRoom,
        slots,
      };
    }),

  // 4. Rota Pública: Confirma a Matrícula e gera a Aula + Cadastro de Aluno
  submitEnrollment: publicProcedure
    .input(
      z.object({
        code: z.string(),
        studentName: z.string().min(2, "Nome é obrigatório"),
        studentPhone: z.string().min(8, "Telefone é obrigatório"),
        studentEmail: z.string().email("E-mail inválido").optional(),
        instrumentId: z.number(),
        teacherUserId: z.number(),
        studioRoomId: z.number().optional(),
        dateStr: z.string(), // YYYY-MM-DD
        timeStr: z.string(), // HH:mm
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const [link] = await db
        .select()
        .from(enrollmentLinks)
        .where(eq(enrollmentLinks.code, input.code))
        .limit(1);

      if (!link || link.status !== "active") {
        throw new Error("Link expirado ou já utilizado.");
      }

      const orgId = link.organizationId;
      const scheduledAt = new Date(`${input.dateStr}T${input.timeStr}:00-03:00`);

      // 1. Cadastra o Aluno
      const [newStudent] = await db
        .insert(students)
        .values({
          organizationId: orgId,
          userId: input.teacherUserId,
          professorId: input.teacherUserId,
          name: input.studentName,
          phone: input.studentPhone,
          email: input.studentEmail || undefined,
          instrumentId: input.instrumentId,
          status: "ativo",
          monthlyFee: link.monthlyFee || "150.00",
          dueDay: new Date().getDate(),
        })
        .returning();

      // 2. Cadastra a Aula Agendada
      const [inst] = await db.select().from(instruments).where(eq(instruments.id, input.instrumentId)).limit(1);
      const courseName = inst?.name || "Música";

      const [newLesson] = await db
        .insert(lessons)
        .values({
          organizationId: orgId,
          userId: input.teacherUserId,
          studentId: newStudent.id,
          title: `Aula de ${courseName} - ${newStudent.name}`,
          scheduledAt,
          duration: 60,
          status: "agendada",
          instrumentId: input.instrumentId,
          studioRoomId: input.studioRoomId || undefined,
        })
        .returning();

      // 3. Se for derivado de um Lead do CRM, atualiza o Lead para "matriculado"
      if (link.leadId) {
        await db
          .update(crmLeads)
          .set({ stage: "matriculado", updatedAt: new Date() })
          .where(eq(crmLeads.id, link.leadId));
      }

      // Marcar link como usado
      await db
        .update(enrollmentLinks)
        .set({ status: "used" })
        .where(eq(enrollmentLinks.id, link.id));

      return {
        success: true,
        studentId: newStudent.id,
        lessonId: newLesson.id,
        message: "Matrícula realizada com sucesso e aula agendada!",
      };
    }),
});

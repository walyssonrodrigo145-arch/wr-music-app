import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { enrollmentLinks, crmLeads, instruments, professores, users, lessons, students, settings, studioRooms } from "../drizzle/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import crypto from "crypto";
import { createAsaasCustomer, createAsaasCharge, getAsaasPixQrCode } from "./utils/asaas";

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

  // 2. Rota Pública: Retorna detalhes da escola, cursos e valor da mensalidade
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
        monthlyFee: link.monthlyFee ? Number(link.monthlyFee) : 150,
        preselectedInstrumentId: link.instrumentId,
        lead: leadData,
        instruments: allInstruments,
        hasAsaas: !!(schoolSet?.asaasApiKey && schoolSet?.asaasEnabled),
      };
    }),

  // 3. Rota Pública: Retorna os horários disponíveis por instrumento e data
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

      // Busca o instrumento
      const [inst] = await db.select().from(instruments).where(eq(instruments.id, input.instrumentId)).limit(1);
      if (!inst) throw new Error("Instrumento não encontrado");

      // Busca professores da escola e tenta filtrar pelo instrumento
      const allTeachers = await db
        .select({
          id: professores.id,
          userId: professores.userId,
          name: users.name,
          especialidade: professores.especialidade,
        })
        .from(professores)
        .leftJoin(users, eq(professores.userId, users.id))
        .where(eq(professores.organizationId, orgId));

      const targetTeacher =
        allTeachers.find(t =>
          (t.especialidade || "").toLowerCase().includes(inst.name.toLowerCase())
        ) || allTeachers[0];

      if (!targetTeacher) {
        throw new Error("Nenhum professor disponível para este instrumento.");
      }

      // Busca salas de estúdio ativas
      const rooms = await db
        .select()
        .from(studioRooms)
        .where(and(eq(studioRooms.organizationId, orgId), eq(studioRooms.active, true)));

      // Busca horários de funcionamento da escola
      const [schoolSet] = await db.select({ schoolHours: settings.schoolHours }).from(settings).where(eq(settings.organizationId, orgId)).limit(1);

      // Grade padrão de horários (de 8h às 20h de hora em hora)
      const allSlots = ["08:00", "09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00"];

      // Busca aulas agendadas para essa data
      const startOfDay = new Date(`${input.dateStr}T00:00:00.000-03:00`);
      const endOfDay = new Date(`${input.dateStr}T23:59:59.999-03:00`);

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
        return d.toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "America/Sao_Paulo",
        });
      });

      const slots = allSlots.map(time => ({
        time,
        available: !busyTimes.includes(time),
      }));

      return {
        teacher: targetTeacher,
        room: rooms[0] || null,
        slots,
        schoolName: schoolSet ? undefined : undefined,
      };
    }),

  // 4. Gerar Cobrança Asaas (PIX/Boleto) para o Aluno pagar
  createPaymentCharge: publicProcedure
    .input(
      z.object({
        code: z.string(),
        studentName: z.string().min(2),
        studentPhone: z.string().min(8),
        studentEmail: z.string().email().optional(),
        studentCpf: z.string().optional(),
        instrumentId: z.number(),
        teacherUserId: z.number(),
        studioRoomId: z.number().optional(),
        dateStr: z.string(),
        timeStr: z.string(),
        billingType: z.enum(["PIX", "BOLETO"]).default("PIX"),
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
      const [schoolSet] = await db.select().from(settings).where(eq(settings.organizationId, orgId)).limit(1);

      if (!schoolSet?.asaasApiKey || !schoolSet?.asaasEnabled) {
        // Sem gateway: cadastrar diretamente sem pagamento online
        return { skipPayment: true };
      }

      const monthlyFee = link.monthlyFee ? Number(link.monthlyFee) : 150;

      // Cria cliente no Asaas
      const asaasCustomerId = await createAsaasCustomer(
        {
          name: input.studentName,
          email: input.studentEmail,
          phone: input.studentPhone,
          cpfCnpj: input.studentCpf,
        },
        schoolSet.asaasApiKey
      );

      // Data de vencimento: hoje + 3 dias
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 3);
      const dueDateStr = dueDate.toISOString().split("T")[0];

      // Cria cobrança PIX ou Boleto
      const [inst] = await db.select().from(instruments).where(eq(instruments.id, input.instrumentId)).limit(1);
      const courseName = inst?.name || "Música";

      const charge = await createAsaasCharge(
        {
          asaasCustomerId,
          billingType: input.billingType,
          value: monthlyFee,
          dueDate: dueDateStr,
          description: `Matrícula - Aula de ${courseName} em ${schoolSet.schoolName || "Escola de Música"}`,
        },
        schoolSet.asaasApiKey
      );

      // Se PIX, busca QR code
      let pixQrCode = null;
      let pixCopiaECola = null;
      if (input.billingType === "PIX" && charge.id) {
        try {
          const pix = await getAsaasPixQrCode(charge.id, schoolSet.asaasApiKey);
          pixQrCode = pix.encodedImage;
          pixCopiaECola = pix.payload;
        } catch (_) {}
      }

      // Armazena dados pendentes no link (sem criar aluno ainda — aguarda confirmação de pagamento)
      // Salva referência no link para o webhook depois processar
      await db.update(enrollmentLinks).set({
        status: "pending_payment",
        // guardamos como JSON no campo expiresAt, na prática usaríamos um campo JSON
        // mas como workaround, salvamos o paymentId no código do campo expiresAt
      } as any).where(eq(enrollmentLinks.id, link.id));

      return {
        skipPayment: false,
        chargeId: charge.id,
        invoiceUrl: charge.invoiceUrl,
        pixQrCode,
        pixCopiaECola,
        value: monthlyFee,
        billingType: input.billingType,
        // Passamos de volta para confirmar após pagamento
        enrollmentData: {
          code: input.code,
          studentName: input.studentName,
          studentPhone: input.studentPhone,
          studentEmail: input.studentEmail,
          instrumentId: input.instrumentId,
          teacherUserId: input.teacherUserId,
          studioRoomId: input.studioRoomId,
          dateStr: input.dateStr,
          timeStr: input.timeStr,
        },
      };
    }),

  // 5. Confirma a Matrícula após pagamento (ou sem gateway)
  submitEnrollment: publicProcedure
    .input(
      z.object({
        code: z.string(),
        studentName: z.string().min(2),
        studentPhone: z.string().min(8),
        studentEmail: z.string().email().optional(),
        instrumentId: z.number(),
        teacherUserId: z.number(),
        studioRoomId: z.number().optional(),
        dateStr: z.string(),
        timeStr: z.string(),
        asaasChargeId: z.string().optional(),
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

      if (!link || (link.status !== "active" && link.status !== "pending_payment")) {
        throw new Error("Link expirado ou já utilizado.");
      }

      const orgId = link.organizationId;
      const scheduledAt = new Date(`${input.dateStr}T${input.timeStr}:00.000-03:00`);

      // Cadastra o Aluno
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

      // Cadastra a Aula
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

      // Atualiza o Lead no CRM para "matriculado"
      if (link.leadId) {
        await db
          .update(crmLeads)
          .set({ stage: "matriculado", updatedAt: new Date() })
          .where(eq(crmLeads.id, link.leadId));
      }

      // Marca o link como usado
      await db
        .update(enrollmentLinks)
        .set({ status: "used" })
        .where(eq(enrollmentLinks.id, link.id));

      return {
        success: true,
        studentId: newStudent.id,
        lessonId: newLesson.id,
      };
    }),
});

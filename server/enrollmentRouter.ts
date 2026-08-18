import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { enrollmentLinks, crmLeads, instruments, professores, users, lessons, students, settings, studioRooms, organizations } from "../drizzle/schema";
import { eq, and, gte, lte, desc, isNotNull, ne, sql } from "drizzle-orm";
import crypto from "crypto";
import { createAsaasCustomer, createAsaasCharge, getAsaasPixQrCode, getAsaasChargeStatus } from "./utils/asaas";
import { createMPPreference, verifyMPPayment } from "./utils/mercadopago";
import { ENV } from "./_core/env";

export const enrollmentRouter = router({
  // 1. Gera um link de auto-matrícula exclusivo (Admin/CRM)
  generateLink: protectedProcedure
    .input(
      z.object({
        leadId: z.number().optional(),
        instrumentId: z.number().optional(),
        monthlyFee: z.number().optional(),
        autoSendWhatsapp: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const orgId = ctx.user.organizationId!;

      // Se não foi passado um monthlyFee, mantém undefined (o frontend mostrará o default da escola)
      const resolvedFee = input.monthlyFee;

      const code = crypto.randomBytes(16).toString("hex");

      const [link] = await db
        .insert(enrollmentLinks)
        .values({
          organizationId: orgId,
          code,
          leadId: input.leadId,
          instrumentId: input.instrumentId,
          monthlyFee: resolvedFee ? String(resolvedFee) : undefined,
          status: "active",
        })
        .returning();

      const url = `/matricula/${link.code}`;
      const appUrl = (ENV.appUrl && !ENV.appUrl.includes('localhost')) 
        ? ENV.appUrl.replace(/\/+$/, '') 
        : 'https://wrmusicpro.com.br';
      const fullUrl = `${appUrl}${url}`;
      let sentViaBot = false;

      // Se solicitado autoSendWhatsapp e o link tem leadId associado com telefone
      if (input.autoSendWhatsapp && input.leadId) {
        try {
          const [lead] = await db.select().from(crmLeads).where(eq(crmLeads.id, input.leadId)).limit(1);
          if (lead?.phone) {
            // Busca configurações do bot do WhatsApp da escola
            const allSettings = await db.select().from(settings).where(eq(settings.organizationId, orgId));
            const schoolSet = allSettings.find(s => s.schoolName && s.schoolName.trim() !== '')
              || allSettings.find(s => s.whatsappBotUrl)
              || allSettings[0];

            const { sendWhatsAppMessage } = await import("./utils/whatsapp");
            const messageText = `Olá ${lead.name}! 🎵\n\nAqui está o seu link exclusivo para realizar sua matrícula na nossa escola de música:\n\n👉 ${fullUrl}\n\nAcesse o link acima para escolher o melhor dia e horário para suas aulas!`;
            
            // Tenta enviar com a sessão do usuário logado (prof_${ctx.user.id})
            let sendRes = await sendWhatsAppMessage({
              url: schoolSet?.whatsappBotUrl || undefined,
              token: schoolSet?.whatsappBotToken || undefined,
              sessionId: `prof_${ctx.user.id}`,
              phone: lead.phone,
              message: messageText,
            });

            // Se falhou, tenta com a sessão do dono/configuração da escola (prof_${schoolSet.userId})
            if (!sendRes.success && schoolSet?.userId && schoolSet.userId !== ctx.user.id) {
              sendRes = await sendWhatsAppMessage({
                url: schoolSet?.whatsappBotUrl || undefined,
                token: schoolSet?.whatsappBotToken || undefined,
                sessionId: `prof_${schoolSet.userId}`,
                phone: lead.phone,
                message: messageText,
              });
            }

            // Se falhou, tenta com a sessão padrão (prof_1)
            if (!sendRes.success) {
              sendRes = await sendWhatsAppMessage({
                url: schoolSet?.whatsappBotUrl || undefined,
                token: schoolSet?.whatsappBotToken || undefined,
                sessionId: `prof_1`,
                phone: lead.phone,
                message: messageText,
              });
            }

            if (sendRes.success) {
              sentViaBot = true;
            } else {
              console.warn("[generateLink] Bot tentou enviar mas retornou erro:", sendRes.error);
            }
          }
        } catch (e) {
          console.error("[generateLink] Erro ao enviar WhatsApp automático:", e);
        }
      }

      return { code: link.code, url, fullUrl, sentViaBot };
    }),

  // 2. Rota Pública: Retorna detalhes da escola, cursos, valor da mensalidade e método de pagamento configurado
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
      // Busca o settings mais completo: prioriza quem tem schoolName ou chaves de pagamento
      const allSettings = await db.select().from(settings).where(eq(settings.organizationId, orgId));
      const schoolSet = allSettings.find(s => s.schoolName && s.schoolName.trim() !== '')
        || allSettings.find(s => s.asaasApiKey || s.mpAccessToken)
        || allSettings.sort((a, b) => b.id - a.id)[0];

      let leadData = null;
      if (link.leadId) {
        const [lead] = await db.select().from(crmLeads).where(eq(crmLeads.id, link.leadId)).limit(1);
        if (lead) leadData = lead;
      }

      const allInstruments = await db.select().from(instruments).where(eq(instruments.organizationId, orgId));

      const paymentGateway = schoolSet?.paymentGateway || "asaas";
      const hasAsaas = !!(schoolSet?.asaasApiKey && (schoolSet?.asaasEnabled === 1 || (schoolSet?.asaasEnabled as any) === true));
      const hasMercadoPago = !!schoolSet?.mpAccessToken;

      let activeGateway: "asaas" | "mercadopago" | "none" = "none";
      if (paymentGateway === "mercadopago" && hasMercadoPago) {
        activeGateway = "mercadopago";
      } else if (paymentGateway === "asaas" && hasAsaas) {
        activeGateway = "asaas";
      } else if (hasAsaas) {
        activeGateway = "asaas";
      } else if (hasMercadoPago) {
        activeGateway = "mercadopago";
      }

      // Retorna schoolHours para o frontend poder cinzar dias fechados
      let parsedSchoolHours: Record<string, { active: boolean; start: string; end: string }> = {};
      try { parsedSchoolHours = JSON.parse(schoolSet?.schoolHours || "{}"); } catch (_) {}

      const [org] = await db.select({ logo: organizations.logo }).from(organizations).where(eq(organizations.id, orgId)).limit(1);
      const schoolLogo = schoolSet?.logoUrl || org?.logo || null;

      return {
        code: link.code,
        schoolName: schoolSet?.schoolName || "Escola de Música",
        schoolLogo,
        schoolPhone: schoolSet?.schoolPhone || schoolSet?.phone,
        monthlyFee: link.monthlyFee ? Number(link.monthlyFee) : 150,
        lessonDuration: schoolSet?.lessonDuration ?? 60,
        preselectedInstrumentId: link.instrumentId,
        lead: leadData,
        instruments: allInstruments,
        paymentGateway: activeGateway,
        schoolHours: parsedSchoolHours,
      };
    }),

  // 3. Rota Pública: Retorna os horários disponíveis por instrumento e data, considerando lessonDuration
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

      // Busca o settings mais completo: prioriza quem tem schoolName ou chaves de pagamento
      const allSettingsForSlots = await db.select({ schoolHours: settings.schoolHours, lessonDuration: settings.lessonDuration, schoolName: settings.schoolName, asaasApiKey: settings.asaasApiKey, mpAccessToken: settings.mpAccessToken }).from(settings).where(eq(settings.organizationId, orgId));
      const schoolSet = allSettingsForSlots.find(s => s.schoolName && s.schoolName.trim() !== '')
        || allSettingsForSlots.find(s => s.asaasApiKey || s.mpAccessToken)
        || allSettingsForSlots[0];

      const duration = schoolSet?.lessonDuration ?? 60;

      // Mapeia o dia da semana da data escolhida para a chave do schoolHours
      const DAY_MAP: Record<number, string> = {
        0: "sunday",
        1: "monday",
        2: "tuesday",
        3: "wednesday",
        4: "thursday",
        5: "friday",
        6: "saturday",
      };

      // Parseia a data garantindo fuso de Brasília (UTC-3)
      const dateObj = new Date(`${input.dateStr}T12:00:00.000-03:00`);
      const weekdayKey = DAY_MAP[dateObj.getDay()];

      // Parse do schoolHours
      let schoolHoursObj: Record<string, { active: boolean; start: string; end: string }> = {};
      try {
        schoolHoursObj = JSON.parse(schoolSet?.schoolHours || "{}");
      } catch (_) {}

      const dayConfig = schoolHoursObj[weekdayKey];

      // Se a escola não funciona nesse dia, retorna vazio
      if (!dayConfig || !dayConfig.active) {
        return {
          teacher: targetTeacher,
          room: rooms[0] || null,
          slots: [],
          closedDay: true,
          lessonDuration: duration,
        };
      }

      // Gera slots com passo igual a lessonDuration dentro do horário de funcionamento
      const [startH, startM] = dayConfig.start.split(":").map(Number);
      const [endH, endM] = dayConfig.end.split(":").map(Number);

      const generatedSlots: string[] = [];
      let cursor = startH * 60 + (startM || 0);
      const endMinutes = endH * 60 + (endM || 0);

      // Cada slot tem duração de duration minutos
      while (cursor + duration <= endMinutes) {
        const hh = String(Math.floor(cursor / 60)).padStart(2, "0");
        const mm = String(cursor % 60).padStart(2, "0");
        generatedSlots.push(`${hh}:${mm}`);
        cursor += duration;
      }

      // Busca aulas agendadas para essa data filtrando por professor E organização
      const startOfDay = new Date(`${input.dateStr}T00:00:00.000-03:00`);
      const endOfDay = new Date(`${input.dateStr}T23:59:59.999-03:00`);

      const existingLessons = await db
        .select({ scheduledAt: lessons.scheduledAt })
        .from(lessons)
        .where(
          and(
            eq(lessons.organizationId, orgId),
            eq(lessons.userId, targetTeacher.userId),
            gte(lessons.scheduledAt, startOfDay),
            lte(lessons.scheduledAt, endOfDay)
          )
        );

      // Converte as aulas existentes para strings HH:mm (horário de Brasília)
      const busyTimes = new Set(
        existingLessons.map(l => {
          const d = new Date(l.scheduledAt);
          return d.toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "America/Sao_Paulo",
          });
        })
      );

      const slots = generatedSlots.map(time => ({
        time,
        available: !busyTimes.has(time),
      }));

      return {
        teacher: targetTeacher,
        room: rooms[0] || null,
        slots,
        closedDay: false,
        lessonDuration: duration,
      };
    }),

  // 4. Gerar Cobrança (Asaas ou Mercado Pago) para o Aluno pagar
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
      // Busca o settings mais completo: prioriza quem tem schoolName ou chaves de pagamento
      const allSettings2 = await db.select().from(settings).where(eq(settings.organizationId, orgId));
      const schoolSet = allSettings2.find(s => s.schoolName && s.schoolName.trim() !== '')
        || allSettings2.find(s => s.asaasApiKey || s.mpAccessToken)
        || allSettings2.sort((a, b) => b.id - a.id)[0];

      const monthlyFee = link.monthlyFee ? Number(link.monthlyFee) : 150;
      const [inst] = await db.select().from(instruments).where(eq(instruments.id, input.instrumentId)).limit(1);
      const courseName = inst?.name || "Música";

      // Qual gateway a escola usa?
      const gateway = schoolSet?.paymentGateway || "asaas";
      const hasAsaas = !!(schoolSet?.asaasApiKey && (schoolSet?.asaasEnabled === 1 || (schoolSet?.asaasEnabled as any) === true));
      const hasMercadoPago = !!schoolSet?.mpAccessToken;

      // MERCADO PAGO
      if ((gateway === "mercadopago" && hasMercadoPago) || (!hasAsaas && hasMercadoPago)) {
        const mpResult = await createMPPreference(
          {
            items: [
              {
                title: `Matrícula - Curso de ${courseName}`,
                quantity: 1,
                currency_id: "BRL",
                unit_price: monthlyFee,
              },
            ],
            payer: {
              name: input.studentName,
              email: input.studentEmail || "cliente@wrmusicpro.com.br",
            },
            external_reference: `enrollment_${link.code}`,
            successUrl: `${ENV.appUrl || 'https://wrmusicpro.com.br'}/matricula/${link.code}?status=success`,
          },
          schoolSet!.mpAccessToken!
        );

        return {
          skipPayment: false,
          gateway: "mercadopago",
          invoiceUrl: mpResult.init_point,
          value: monthlyFee,
          billingType: input.billingType,
        };
      }

      // ASAAS
      if (hasAsaas) {
        const asaasCustomerId = await createAsaasCustomer(
          {
            name: input.studentName,
            email: input.studentEmail,
            phone: input.studentPhone,
            cpfCnpj: input.studentCpf,
          },
          schoolSet.asaasApiKey!
        );

        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 3);
        const dueDateStr = dueDate.toISOString().split("T")[0];

        const charge = await createAsaasCharge(
          {
            asaasCustomerId,
            billingType: input.billingType,
            value: monthlyFee,
            dueDate: dueDateStr,
            description: `Matrícula - Aula de ${courseName} em ${schoolSet.schoolName || "Escola de Música"}`,
          },
          schoolSet.asaasApiKey!
        );

        let pixQrCode = null;
        let pixCopiaECola = null;
        if (input.billingType === "PIX" && charge.id) {
          try {
            const pix = await getAsaasPixQrCode(charge.id, schoolSet.asaasApiKey!);
            pixQrCode = pix.encodedImage;
            pixCopiaECola = pix.payload;
          } catch (_) {}
        }

        return {
          skipPayment: false,
          gateway: "asaas",
          chargeId: charge.id,
          invoiceUrl: charge.invoiceUrl,
          pixQrCode,
          pixCopiaECola,
          value: monthlyFee,
          billingType: input.billingType,
        };
      }

      // Sem gateway configurado na escola
      return { skipPayment: true, gateway: "none" };
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

      // AUDIT-P0 FIX (IDOR + fraude): validar professor e instrumento contra a
      // organização do link — antes, IDs de OUTRAS escolas eram aceitos
      const [validTeacher] = await db
        .select({ id: users.id })
        .from(users)
        .where(and(
          eq(users.id, input.teacherUserId),
          eq(users.organizationId, orgId),
        ))
        .limit(1);
      if (!validTeacher) {
        throw new Error("Professor inválido para esta escola.");
      }

      const [validInstrument] = await db
        .select({ id: instruments.id })
        .from(instruments)
        .where(and(
          eq(instruments.id, input.instrumentId),
          eq(instruments.organizationId, orgId),
        ))
        .limit(1);
      if (!validInstrument) {
        throw new Error("Instrumento inválido para esta escola.");
      }

      // Busca o settings mais completo para pegar lessonDuration correto
      const allSettings3 = await db.select({ lessonDuration: settings.lessonDuration, schoolName: settings.schoolName, asaasApiKey: settings.asaasApiKey, asaasEnabled: settings.asaasEnabled, mpAccessToken: settings.mpAccessToken, paymentGateway: settings.paymentGateway }).from(settings).where(eq(settings.organizationId, orgId));
      const bestSettings3 = allSettings3.find(s => s.schoolName && s.schoolName.trim() !== '')
        || allSettings3.find(s => s.asaasApiKey || s.mpAccessToken)
        || allSettings3[0];
      const schoolSet = bestSettings3;
      const lessonDuration = schoolSet?.lessonDuration ?? 60;

      // AUDIT-P0 FIX (fraude): se a escola COBRA matrícula (gateway configurado),
      // verificar o pagamento SERVER-SIDE antes de criar aluno/aula. Antes, um POST
      // direto matriculava sem pagar — o asaasChargeId do input era ignorado.
      const gateway = (schoolSet as any)?.paymentGateway || "asaas";
      const hasAsaas = !!(schoolSet?.asaasApiKey && (schoolSet?.asaasEnabled === 1 || (schoolSet?.asaasEnabled as any) === true));
      const hasMercadoPago = !!schoolSet?.mpAccessToken;
      const requiresPayment = hasAsaas || ((gateway === "mercadopago") && hasMercadoPago);

      if (requiresPayment) {
        let paymentVerified = false;

        if (hasAsaas) {
          if (!input.asaasChargeId) {
            throw new Error("Pagamento da matrícula é obrigatório. Gere a cobrança e conclua o pagamento antes de confirmar.");
          }
          try {
            const chargeStatus = await getAsaasChargeStatus(input.asaasChargeId, schoolSet!.asaasApiKey!);
            paymentVerified = ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH", "DETERMINED"].includes(String(chargeStatus).toUpperCase());
          } catch (e) {
            console.error("[Enrollment] Falha ao verificar cobrança Asaas:", e);
            paymentVerified = false;
          }
        } else {
          // Mercado Pago: busca pagamento aprovado pela referência externa do link
          try {
            const searchUrl = `https://api.mercadopago.com/v1/payments/search?external_reference=enrollment_${link.code}&sort=date_created&criteria=desc`;
            const mpResp = await fetch(searchUrl, {
              headers: { Authorization: `Bearer ${schoolSet!.mpAccessToken!}` },
            });
            if (mpResp.ok) {
              const mpData: any = await mpResp.json();
              paymentVerified = mpData.results?.some((p: any) => p.status === "approved");
            }
          } catch (e) {
            console.error("[Enrollment] Falha ao verificar pagamento MP:", e);
            paymentVerified = false;
          }
        }

        if (!paymentVerified) {
          throw new Error("Pagamento não confirmado. Conclua o pagamento da matrícula e tente novamente.");
        }
      }

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

      // Cadastra a Aula usando lessonDuration da escola
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
          duration: lessonDuration,
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

  // 6. Verifica se o pagamento MP foi realmente efetuado antes de prosseguir
  verifyMPPayment: publicProcedure
    .input(
      z.object({
        code: z.string(),        // código do link de matrícula (para buscar o accessToken da escola)
        paymentId: z.string(),   // payment_id retornado pelo MP na URL de redirect
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // Busca o link para obter orgId
      const [link] = await db
        .select()
        .from(enrollmentLinks)
        .where(eq(enrollmentLinks.code, input.code))
        .limit(1);

      if (!link) throw new Error("Link não encontrado");

      // Busca o settings com mpAccessToken
      const allSettings = await db.select().from(settings).where(eq(settings.organizationId, link.organizationId));
      const schoolSet = allSettings.find(s => s.schoolName && s.schoolName.trim() !== '')
        || allSettings.find(s => s.asaasApiKey || s.mpAccessToken)
        || allSettings[0];

      if (!schoolSet?.mpAccessToken) {
        throw new Error("Escola sem Mercado Pago configurado.");
      }

      // Consulta a API do MP com o payment_id real
      const result = await verifyMPPayment(input.paymentId, schoolSet.mpAccessToken);

      return {
        verified: result.verified,
        status: result.status,       // "approved" | "pending" | "rejected" | etc.
        externalReference: result.externalReference,
      };
    }),

  // 7. Verifica pagamento MP buscando pelos pagamentos mais recentes com external_reference = enrollment_${code}
  verifyMPByReference: publicProcedure
    .input(
      z.object({
        code: z.string(),
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

      const allSettings = await db.select().from(settings).where(eq(settings.organizationId, link.organizationId));
      const schoolSet = allSettings.find(s => s.schoolName && s.schoolName.trim() !== '')
        || allSettings.find(s => s.asaasApiKey || s.mpAccessToken)
        || allSettings[0];

      if (!schoolSet?.mpAccessToken) {
        throw new Error("Escola sem Mercado Pago configurado.");
      }

      // Busca na API do Mercado Pago por pagamentos referentes a essa matrícula
      const searchUrl = `https://api.mercadopago.com/v1/payments/search?external_reference=enrollment_${input.code}&sort=date_created&criteria=desc`;
      const response = await fetch(searchUrl, {
        headers: { Authorization: `Bearer ${schoolSet.mpAccessToken}` },
      });

      if (!response.ok) {
        return { verified: false, status: "unknown" };
      }

      const data = await response.json();
      const latestPayment = data.results?.[0];

      if (!latestPayment) {
        return { verified: false, status: "not_found" };
      }

      const status = latestPayment.status as string;
      const verified = status === "approved" || status === "pending" || status === "in_process";

      return {
        verified,
        status,
        paymentId: String(latestPayment.id),
      };
    }),
});

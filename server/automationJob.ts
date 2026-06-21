/**
 * Job de automação de lembretes e notificações do WhatsApp
 * Roda periodicamente (a cada 1 minuto) e gerencia o ciclo completo de cobranças e aulas
 * de acordo com as regras de negócio de automação avançada.
 */

import { eq, and, gte, lte, desc, sql, or, like } from "drizzle-orm";
import { notifyOwner, notifyUser } from "./_core/notification";
import { getDb } from "./db";
import { settings, lessons, students, instruments, reminders, reminderTemplates, paymentDues, users } from "../drizzle/schema";
import { sendWhatsAppMessage, getWhatsAppSessionStatus, reconnectWhatsAppSession } from "./utils/whatsapp";

// Guard de concorrência: impede que duas execuções do robô rodem ao mesmo tempo
let isAutomationRunning = false;

// Rastreia a data do último cleanup semanal por usuário.
const lastCleanupByUser = new Map<string, string>();

// Rastreia o último timestamp de keep-alive executado por sessão para garantir ping real
const lastKeepAliveBySession = new Map<string, number>(); // chave: sessionId, valor: timestamp ms
const KEEP_ALIVE_INTERVAL_MS = 10 * 60 * 1000; // 10 minutos (antes: 15 min impreciso)

// Rastreia tentativas de reconexão automática para evitar flood
const autoReconnectAttempts = new Map<string, { count: number; lastAt: number }>();
const MAX_AUTO_RECONNECT = 3;
const AUTO_RECONNECT_COOLDOWN_MS = 15 * 60 * 1000; // 15 min entre tentativas

async function runAutomation() {
  if (isAutomationRunning) {
    console.log("[Automation] Skipping — execução anterior ainda em andamento.");
    return;
  }
  isAutomationRunning = true;

  const db = await getDb();
  if (!db) { isAutomationRunning = false; return; }

  const activeSettings = await db
    .select({
      id: settings.id,
      userId: settings.userId,
      organizationId: settings.organizationId,
      automationEnabled: settings.automationEnabled,
      automationLastRun: settings.automationLastRun,
      whatsappBotUrl: settings.whatsappBotUrl,
      whatsappBotToken: settings.whatsappBotToken,
      whatsappAutoSend: settings.whatsappAutoSend,
      pixKey: settings.pixKey,
    })
    .from(settings)
    .where(eq(settings.automationEnabled, 1));

  if (activeSettings.length === 0) return;

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);

  for (const userSettings of activeSettings) {
    const userId = userSettings.userId;
    const orgId = userSettings.organizationId;

    // Sem organizationId não conseguimos isolar os dados — pula
    if (!orgId) {
      console.warn(`[Automation] Skipping userId=${userId}: no organizationId found.`);
      continue;
    }

    // --- KEEP-ALIVE PARA O WHATSAPP (baseado em timestamp — confiável) ---
    // Usa timestamp real em vez de now.getMinutes() % 15 para evitar ciclos perdidos
    if (userSettings.whatsappAutoSend === 1 && userSettings.whatsappBotUrl) {
      const sessionId = `prof_${userId}`;
      const lastPing = lastKeepAliveBySession.get(sessionId) ?? 0;
      const timeSinceLastPing = now.getTime() - lastPing;

      if (timeSinceLastPing >= KEEP_ALIVE_INTERVAL_MS) {
        try {
          const statusResult = await getWhatsAppSessionStatus({
            url: userSettings.whatsappBotUrl || undefined,
            token: userSettings.whatsappBotToken || undefined,
            sessionId,
          });
          lastKeepAliveBySession.set(sessionId, now.getTime());
          console.log(`[Keep-Alive] Ping OK para sessão ${sessionId} — status: ${statusResult.status}`);

          // Se detectou que a sessão caiu, tenta reconectar automaticamente
          if (statusResult.status === 'DISCONNECTED') {
            const reconnectInfo = autoReconnectAttempts.get(sessionId);
            const canRetry = !reconnectInfo ||
              (reconnectInfo.count < MAX_AUTO_RECONNECT && now.getTime() - reconnectInfo.lastAt >= AUTO_RECONNECT_COOLDOWN_MS);

            if (canRetry) {
              console.log(`[Keep-Alive] Sessão ${sessionId} DESCONECTADA — tentando reconexão automática...`);
              try {
                await reconnectWhatsAppSession({
                  url: userSettings.whatsappBotUrl || undefined,
                  token: userSettings.whatsappBotToken || undefined,
                  sessionId,
                });
                autoReconnectAttempts.set(sessionId, {
                  count: (reconnectInfo?.count ?? 0) + 1,
                  lastAt: now.getTime(),
                });
                console.log(`[Keep-Alive] Reconexão automática solicitada para ${sessionId}`);
              } catch (reconErr) {
                console.error(`[Keep-Alive] Falha na reconexão automática para ${sessionId}:`, reconErr);
              }
            } else {
              console.warn(`[Keep-Alive] Sessão ${sessionId} desconectada — limite de reconexões automáticas atingido. Admin deve reconectar manualmente.`);
            }
          } else {
            // Sessão OK: reseta contadores de reconexão
            if (autoReconnectAttempts.has(sessionId)) {
              autoReconnectAttempts.delete(sessionId);
            }
          }
        } catch (e) {
          console.error(`[Keep-Alive] Erro ao fazer ping para ${sessionId}:`, e);
        }
      }
    }

    let remindersCreated = 0;
    const generatedLogs: string[] = [];

    try {
      // ─── CANCELAMENTO AUTOMÁTICO DE LEMBRETES OBSOLETOS ─────────────────────
      // Cancela lembretes pendentes de alunos inativos/pausados/cancelados, mensalidades pagas ou aulas canceladas/concluídas
      await db.execute(sql`
        UPDATE reminders 
        SET status = 'cancelado', "updatedAt" = now()
        WHERE "organizationId" = ${orgId} 
          AND "userId" = ${userId}
          AND status = 'pendente'
          AND (
            ("studentId" IN (SELECT id FROM students WHERE "organizationId" = ${orgId} AND status IN ('inativo', 'pausado')))
            OR ("paymentDueId" IN (SELECT id FROM payment_dues WHERE "organizationId" = ${orgId} AND status = 'pago'))
            OR ("lessonId" IN (SELECT id FROM lessons WHERE "organizationId" = ${orgId} AND status IN ('cancelada', 'remarcada', 'falta', 'concluida')))
          )
      `);

      // ─── LIMPEZA SEMANAL AUTOMÁTICA (Domingo 00:00 Horário de Brasília) ───────────────
      // Apaga lembretes antigos (enviados e cancelados) para manter a tela limpa.
      // Mantém os lembretes de aulas futuras (recentes dos últimos 2 dias ou futuros)
      // para servirem como travas e evitar que a automação os recrie e envie de novo.
      const brazilDateStr = now.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
      const brazilDay = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })).getDay(); // 0 = domingo
      const cleanupKey = `${orgId}-${userId}`;
      let ranCleanupThisCycle = false;

      if (brazilDay === 0 && lastCleanupByUser.get(cleanupKey) !== brazilDateStr) {
        // [MODIFIED] Não deletar mais os lembretes do banco.
        // Manter o histórico no banco é essencial para as travas anti-duplicação funcionarem.
        // O limite de visualização já é gerenciado pelo tRPC limit(200) na tela.
        lastCleanupByUser.set(cleanupKey, brazilDateStr);
        ranCleanupThisCycle = true;
        console.log(`[Automation] ✅ Limpeza semanal (pular deleção para manter histórico) — domingo ${brazilDateStr} (userId=${userId})`);
      }


      // ─── 4. ALERTA DE AULA (1 HORA OU 30 MINUTOS ANTES) ─────────────────────
      // Busca aulas agendadas nas próximas 1h15m (75 minutos)
      const maxAlertTime = new Date(now.getTime() + 75 * 60 * 1000);
      const upcomingLessons = await db
        .select({
          id: lessons.id,
          title: lessons.title,
          scheduledAt: lessons.scheduledAt,
          alertSent1h: lessons.alertSent1h,
          alertSent30m: lessons.alertSent30m,
          studentName: students.name,
          studentPhone: students.phone,
        })
        .from(lessons)
        .leftJoin(students, and(eq(lessons.studentId, students.id), eq(students.organizationId, orgId)))
        .where(
          and(
            eq(lessons.organizationId, orgId),
            eq(lessons.userId, userId),
            eq(lessons.status, "agendada"),
            gte(lessons.scheduledAt, now),
            lte(lessons.scheduledAt, maxAlertTime)
          )
        );

      for (const lesson of upcomingLessons) {
        const diffMinutes = Math.round((new Date(lesson.scheduledAt).getTime() - now.getTime()) / (60 * 1000));
        
        // Alerta de 1 hora (entre 50 e 70 minutos para tolerância)
        if (diffMinutes >= 50 && diffMinutes <= 70 && !lesson.alertSent1h) {
          const timeStr = new Date(lesson.scheduledAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
          const dateStr = new Date(lesson.scheduledAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
          await notifyUser(userId, {
            title: `🎸 Lembrete de Aula: ${lesson.title}`,
            content: `👤 Aluno: ${lesson.studentName || "Aluno"}\n📱 Número: ${lesson.studentPhone || "Não cadastrado"}\n📅 Data: ${dateStr}\n⏰ Horário: ${timeStr}`
          });
          
          await db
            .update(lessons)
            .set({ alertSent1h: true, updatedAt: new Date() })
            .where(eq(lessons.id, lesson.id));
        }
        
        // Alerta de 30 minutos (entre 20 e 40 minutos para tolerância)
        if (diffMinutes >= 20 && diffMinutes <= 40 && !lesson.alertSent30m) {
          const timeStr = new Date(lesson.scheduledAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
          const dateStr = new Date(lesson.scheduledAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
          await notifyUser(userId, {
            title: `🎸 Lembrete de Aula: ${lesson.title}`,
            content: `👤 Aluno: ${lesson.studentName || "Aluno"}\n📱 Número: ${lesson.studentPhone || "Não cadastrado"}\n📅 Data: ${dateStr}\n⏰ Horário: ${timeStr}`
          });
          
          await db
            .update(lessons)
            .set({ alertSent30m: true, updatedAt: new Date() })
            .where(eq(lessons.id, lesson.id));
        }
      }
      
      // ─── 4.1 LEMBRETE DE AULA EXPERIMENTAL (24h e 1h) ─────────────────────────
      if (userSettings.whatsappAutoSend === 1 && userSettings.whatsappBotUrl) {
        const maxExperimentalTime = new Date(now.getTime() + 24.5 * 60 * 60 * 1000);
        const expLessons = await db
          .select({
            id: lessons.id,
            title: lessons.title,
            scheduledAt: lessons.scheduledAt,
            experimentalName: lessons.experimentalName,
            experimentalPhone: (lessons as any).experimentalPhone,
          })
          .from(lessons)
          .where(
            and(
              eq(lessons.organizationId, orgId),
              eq(lessons.userId, userId),
              eq(lessons.status, "agendada"),
              eq(lessons.isExperimental, true),
              gte(lessons.scheduledAt, now),
              lte(lessons.scheduledAt, maxExperimentalTime)
            )
          );

        for (const lesson of expLessons) {
          if (!lesson.experimentalPhone) continue;

          const diffHours = (new Date(lesson.scheduledAt).getTime() - now.getTime()) / (1000 * 60 * 60);
          
          let refType: string | null = null;
          let msgText = "";

          // 24 horas (entre 23.5 e 24.5 horas)
          if (diffHours >= 23.5 && diffHours <= 24.5) {
            refType = "lesson-exp-24h-" + lesson.id;
            const hora = new Date(lesson.scheduledAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
            msgText = `Olá ${lesson.experimentalName || "Aluno"}! Tudo bem? Passando para lembrar da sua aula experimental de música agendada para amanhã às ${hora}. Te esperamos lá! 🎸`;
          }
          // 1 hora (entre 0.8 e 1.2 horas = 48 a 72 min)
          else if (diffHours >= 0.8 && diffHours <= 1.2) {
            refType = "lesson-exp-1h-" + lesson.id;
            const hora = new Date(lesson.scheduledAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
            msgText = `Olá ${lesson.experimentalName || "Aluno"}! Falta apenas 1 horinha para a nossa aula experimental (às ${hora}). Até logo! 🎶`;
          }

          if (refType) {
            const existingExp = await db.select({ id: reminders.id }).from(reminders)
              .where(and(eq(reminders.organizationId, orgId), eq(reminders.refId, refType))).limit(1);

            if (existingExp.length === 0) {
              await db.insert(reminders).values({
                organizationId: orgId,
                userId,
                type: "aula" as any,
                message: msgText,
                scheduledAt: now,
                status: "pendente",
                autoGenerated: 1,
                refId: refType,
                targetPhone: lesson.experimentalPhone,
              });
              remindersCreated++;
              generatedLogs.push(`Aula Experimental para ${lesson.experimentalName || "Aluno"}`);
            }
          }
        }
      }
      // ─── 5. LEMBRETE DE PLANO DE ESTUDO (DIÁRIO) ────────────────────────────
      // Envia lembrete às 18:00 (ou depois) se o aluno tem um plano ativo com pendências, e ainda não interagiu hoje.
      if (now.getHours() >= 18) {
        // Obter todos os planos ativos do usuário
        const { dailyStudyPlans } = await import("../drizzle/schema");
        const activeStudyPlans = await db
          .select({
            id: dailyStudyPlans.id,
            studentId: dailyStudyPlans.studentId,
            status: dailyStudyPlans.status,
            publishedStatus: dailyStudyPlans.publishedStatus,
            daysCompleted: dailyStudyPlans.daysCompleted,
            updatedAt: dailyStudyPlans.updatedAt,
            studentName: students.name,
          })
          .from(dailyStudyPlans)
          .leftJoin(students, eq(dailyStudyPlans.studentId, students.id))
          .where(
            and(
              eq(dailyStudyPlans.organizationId, orgId),
              eq(dailyStudyPlans.teacherId, userId),
              eq(dailyStudyPlans.status, "ativo"),
              eq(dailyStudyPlans.publishedStatus, "publicado"),
              eq(students.status, "ativo")
            )
          );

        for (const plan of activeStudyPlans) {
          try {
            // Verificar se o plano ainda possui dias marcados como false
            const parsedDays = JSON.parse(plan.daysCompleted as string);
            const daysCompletedArray = Array.isArray(parsedDays) ? parsedDays.map(Boolean) : [];
            const hasPendingTasks = daysCompletedArray.includes(false);

            if (!hasPendingTasks) continue;

            // Verificar se ele interagiu com o plano *hoje*
            const lastUpdate = new Date(plan.updatedAt);
            const interactedToday = lastUpdate >= startOfDay;

            if (interactedToday) continue; // Ele já estudou/clicou hoje, não precisa de lembrete!

            // Verificar se já geramos o lembrete HOJE
            const refId = `estudo-${plan.id}-${todayStr}`;
            const existing = await db.select({ id: reminders.id }).from(reminders)
              .where(and(
                eq(reminders.organizationId, orgId),
                eq(reminders.refId, refId)
              )).limit(1);

            if (existing.length === 0 && !ranCleanupThisCycle) {
              const msgEstudo = `Olá ${plan.studentName || "Aluno"}, passando para lembrar do seu treino de hoje! 🎸\n\nAcesse a plataforma para conferir o seu plano de estudos e marcar como concluído.\n\nQualquer dúvida estou à disposição! Bom treino!`;

              // Type usamos "manual" para não quebrar enums do postgres
              await db.insert(reminders).values({
                organizationId: orgId, 
                userId, 
                studentId: plan.studentId, 
                type: "manual" as any, 
                message: msgEstudo, 
                scheduledAt: now, 
                status: "pendente", 
                autoGenerated: 1, 
                refId,
              });
              remindersCreated++;
              generatedLogs.push(`Plano de Estudo para ${plan.studentName || "Aluno"}`);
            }
          } catch (err) {
            console.error(`[Automation] Error processing study plan ID ${plan.id}:`, err);
          }
        }
      }

      await db.update(settings).set({ automationLastRun: now }).where(eq(settings.userId, userId));

      for (const log of generatedLogs) {
        await notifyUser(userId, {
          title: "⏳ Lembrete Gerado",
          content: log
        });
      }

      // ─── 3. DISPARO AUTOMÁTICO COM CONTROLE DE FILA E PRIORIDADE ────────────
      if (userSettings.whatsappAutoSend === 1 && userSettings.whatsappBotUrl) {
        const pendingReminders = await db
          .select({
            id: reminders.id,
            studentId: reminders.studentId,
            type: reminders.type,
            message: reminders.message,
            scheduledAt: reminders.scheduledAt,
            refId: reminders.refId,
            targetPhone: (reminders as any).targetPhone,
            studentPhone: students.phone,
            guardianPhone: students.guardianPhone,
            birthDate: students.birthDate,
            studentName: students.name,
          })
          .from(reminders)
          .leftJoin(students, and(eq(reminders.studentId, students.id), eq(reminders.organizationId, orgId)))
          .where(
            and(
              eq(reminders.organizationId, orgId),
              eq(reminders.userId, userId),
              eq(reminders.status, "pendente"),
              lte(reminders.scheduledAt, now)
            )
          );

        if (pendingReminders.length === 0) continue;

        const getPriorityWeight = (rem: typeof pendingReminders[0]) => {
          if (rem.refId?.startsWith("lesson-1h-")) return 1;
          if (rem.refId?.startsWith("lesson-24h-")) return 2;
          if (rem.refId?.startsWith("pay-prev-")) return 3;
          if (rem.refId?.startsWith("pay-hoje-")) return 4;
          if (rem.type === "inadimplencia") return 5;
          return 6;
        };

        pendingReminders.sort((a, b) => getPriorityWeight(a) - getPriorityWeight(b));

        const sentToday = await db
          .select({ studentId: reminders.studentId, type: reminders.type, refId: reminders.refId })
          .from(reminders)
          .where(
            and(
              eq(reminders.organizationId, orgId),
              eq(reminders.userId, userId),
              eq(reminders.status, "enviado"),
              gte(reminders.sentAt, startOfDay)
            )
          );

        const getRemKey = (studentId: number | null, type: string, refId: string | null) => {
          let subType = type;
          if (type === "aula") {
            if (refId?.startsWith("lesson-24h-")) subType = "aula-24h";
            else if (refId?.startsWith("lesson-1h-")) subType = "aula-1h";
          }
          return `${studentId}-${subType}`;
        };

        const sentMap = new Set(sentToday.map(s => getRemKey(s.studentId, s.type, s.refId)));

        let messagesSentThisCycle = 0; // LIMITE GERAL POR CICLO (1 POR MINUTO)
        const MAX_MESSAGES_PER_MINUTE = 1;

        for (const rem of pendingReminders) {
          if (messagesSentThisCycle >= MAX_MESSAGES_PER_MINUTE) {
            console.log(`[Automation] Limite de ${MAX_MESSAGES_PER_MINUTE} mensagem/min atingido. Fila continua no próximo ciclo.`);
            break;
          }

          let targetPhone = rem.targetPhone || rem.studentPhone;
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

          if (!targetPhone) {
            await db.update(reminders).set({ errorMessage: "Aluno/Responsável sem telefone cadastrado.", updatedAt: new Date() }).where(eq(reminders.id, rem.id));
            continue;
          }

          const remKey = getRemKey(rem.studentId, rem.type, rem.refId);
          if (sentMap.has(remKey)) {
            await db.update(reminders).set({ status: "enviado", sentAt: new Date(), errorMessage: "Bloqueio Anti-Spam: Lembrete do mesmo tipo já enviado hoje.", updatedAt: new Date() }).where(eq(reminders.id, rem.id));
            continue;
          }

          const sendRes = await sendWhatsAppMessage({
            url: userSettings.whatsappBotUrl,
            token: userSettings.whatsappBotToken,
            phone: targetPhone,
            message: rem.message,
            sessionId: `prof_${userId}`,
          });

          if (sendRes.success) {
            await db.update(reminders)
              .set({
                status: "enviado",
                sentAt: new Date(),
                externalMessageId: sendRes.messageId,
                errorMessage: null,
                updatedAt: new Date(),
              })
              .where(eq(reminders.id, rem.id));
            sentMap.add(remKey);
            messagesSentThisCycle++;

            const timeStr = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
            const remType = rem.type === "aula" ? "Aula" : rem.type === "cobranca" ? "Cobrança" : rem.type === "aniversario" ? "Aniversário" : rem.type === "aula_experimental" ? "Aula Experimental" : "Estudo";
            await notifyUser(userId, {
              title: `✅ Enviado: ${remType}`,
              content: `👤 Aluno: ${rem.studentName || "Aluno"}\n📱 Número: ${targetPhone}\n⏰ Horário: ${timeStr}`
            });
          } else {
            await db.update(reminders)
              .set({
                errorMessage: sendRes.error,
                updatedAt: new Date(),
              })
              .where(eq(reminders.id, rem.id));
          }
        }
      }
    } catch (err) {
      console.error(`[Automation] Error processing userId=${userId} orgId=${orgId}:`, err);
    }
  }

  // ─── PROCESSAMENTO DE REGRAS DE AUTOMAÇÃO PERSONALIZADAS ─────────────────
  try {
    const db = await getDb();
    if (db) {
      const { messageAutomationRules } = await import("../drizzle/schema");
      const { settings: settingsTable } = await import("../drizzle/schema");

      // Re-fetch all active user settings that have automation enabled
      const activeSettingsForRules = await db
        .select({
          userId: settings.userId,
          organizationId: settings.organizationId,
          whatsappBotUrl: settings.whatsappBotUrl,
          whatsappBotToken: settings.whatsappBotToken,
          whatsappAutoSend: settings.whatsappAutoSend,
          pixKey: settings.pixKey,
        })
        .from(settings)
        .where(eq(settings.automationEnabled, 1));

      for (const userSet of activeSettingsForRules) {
        const userId = userSet.userId;
        const orgId = userSet.organizationId;
        if (!orgId) continue;

        // Load all active custom/system rules for this user
        const activeRules = await db
          .select()
          .from(messageAutomationRules)
          .where(
            and(
              eq(messageAutomationRules.organizationId, orgId),
              eq(messageAutomationRules.userId, userId),
              eq(messageAutomationRules.isActive, 1)
            )
          );

        if (activeRules.length === 0) continue;

        // Fetch school name from settings
        const [userSettings2] = await db.select({ schoolName: settings.schoolName }).from(settings).where(eq(settings.userId, userId)).limit(1);
        const [userInfo] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId)).limit(1);
        const schoolName = userSettings2?.schoolName ?? "nossa escola";
        const professorName = userInfo?.name ?? "Professor";
        const now2 = new Date();
        const todayStr2 = now2.toISOString().slice(0, 10);

        for (const rule of activeRules) {
          try {
            if (rule.trigger === "payment_due" || rule.trigger === "payment_overdue") {
              // ── MENSALIDADES ──────────────────────────────────────────────────
              const pendingDues = await db
                .select({
                  id: paymentDues.id,
                  studentId: paymentDues.studentId,
                  amount: paymentDues.amount,
                  dueDate: paymentDues.dueDate,
                  status: paymentDues.status,
                  month: paymentDues.month,
                  year: paymentDues.year,
                  studentName: students.name,
                  studentPhone: students.phone,
                  guardianPhone: students.guardianPhone,
                  birthDate: students.birthDate,
                  instrumentName: instruments.name,
                  asaasPaymentLink: paymentDues.asaasPaymentLink,
                })
                .from(paymentDues)
                .leftJoin(students, and(eq(paymentDues.studentId, students.id), eq(students.organizationId, orgId)))
                .leftJoin(instruments, and(eq(students.instrumentId, instruments.id), eq(instruments.organizationId, orgId)))
                .where(
                  and(
                    eq(paymentDues.organizationId, orgId),
                    eq(paymentDues.userId, userId),
                    rule.trigger === "payment_overdue"
                      ? eq(paymentDues.status, "atrasado")
                      : or(eq(paymentDues.status, "pendente"), eq(paymentDues.status, "atrasado")),
                    eq(students.status, "ativo")
                  )
                );

              for (const due of pendingDues) {
                const dueDate = new Date(due.dueDate + "T12:00:00");
                const dueDateStr = String(due.dueDate).slice(0, 10);
                const isOverdue = dueDateStr < todayStr2;

                // For payment_due: check if trigger date (dueDate + offsetDays) <= today
                // offsetDays is negative for "before" e.g. -3 means 3 days before
                if (rule.trigger === "payment_due") {
                  if (isOverdue) continue; // Already overdue, skip
                  const triggerDate = new Date(dueDate);
                  triggerDate.setDate(triggerDate.getDate() + (rule.offsetDays ?? 0));
                  if (triggerDate > now2) continue; // Not yet time
                }

                const refId = `auto-rule-${rule.id}-${due.id}-${todayStr2}`;
                const existingReminder = await db.select({ id: reminders.id }).from(reminders)
                  .where(and(eq(reminders.organizationId, orgId), eq(reminders.refId, refId))).limit(1);
                if (existingReminder.length > 0) continue;

                const valor = Number(due.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
                const vencimento = dueDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });

                let message = (rule.messageTemplate ?? "")
                  .replace(/\{nome_aluno\}/g, due.studentName ?? "Aluno")
                  .replace(/\{nome_professor\}/g, professorName)
                  .replace(/\{nome_escola\}/g, schoolName)
                  .replace(/\{curso\}/g, due.instrumentName ?? "música")
                  .replace(/\{instrumento\}/g, due.instrumentName ?? "música")
                  .replace(/\{valor_mensalidade\}/g, valor)
                  .replace(/\{data_vencimento\}/g, vencimento);

                if (due.asaasPaymentLink) {
                  message += `\n\n💳 *Link de pagamento:*\n${due.asaasPaymentLink}`;
                } else if (userSet.pixKey) {
                  message += `\n\n💳 *PIX:* ${userSet.pixKey}`;
                }

                let targetPhone = due.studentPhone;
                if (due.birthDate) {
                  const bd = new Date(due.birthDate);
                  let age = now2.getFullYear() - bd.getFullYear();
                  if (now2.getMonth() < bd.getMonth() || (now2.getMonth() === bd.getMonth() && now2.getDate() < bd.getDate())) age--;
                  if (age < 18 && due.guardianPhone) targetPhone = due.guardianPhone;
                }
                if (!targetPhone) continue;

                await db.insert(reminders).values({
                  organizationId: orgId, userId, studentId: due.studentId, paymentDueId: due.id,
                  type: "cobranca", message, scheduledAt: now2, status: "pendente", autoGenerated: 1, refId,
                });

                // If auto-send enabled, send immediately
                if (userSet.whatsappAutoSend === 1 && userSet.whatsappBotUrl) {
                  const sendRes = await sendWhatsAppMessage({
                    url: userSet.whatsappBotUrl,
                    token: userSet.whatsappBotToken,
                    phone: targetPhone,
                    message,
                    sessionId: `prof_${userId}`,
                  });
                  const [newRem] = await db.select({ id: reminders.id }).from(reminders).where(eq(reminders.refId, refId)).limit(1);
                  if (newRem) {
                    await db.update(reminders).set({
                      status: sendRes.success ? "enviado" : "pendente",
                      sentAt: sendRes.success ? now2 : undefined,
                      externalMessageId: sendRes.messageId ?? null,
                      errorMessage: sendRes.error ?? null,
                      updatedAt: new Date(),
                    }).where(eq(reminders.id, newRem.id));
                  }
                  if (sendRes.success) {
                    await db.update(messageAutomationRules).set({ totalSent: (rule.totalSent ?? 0) + 1, lastExecutedAt: now2, updatedAt: new Date() }).where(eq(messageAutomationRules.id, rule.id));
                  }
                }
              }

            } else if (rule.trigger === "lesson_scheduled") {
              // ── AULAS ─────────────────────────────────────────────────────────
              const offsetMs = (rule.offsetHours ?? 0) * 60 * 60 * 1000;
              const monday = new Date(now2);
              monday.setDate(monday.getDate() - monday.getDay());
              const sunday = new Date(monday);
              sunday.setDate(monday.getDate() + 14); // Look 2 weeks ahead

              const upcomingLessons2 = await db
                .select({
                  id: lessons.id,
                  studentId: lessons.studentId,
                  title: lessons.title,
                  scheduledAt: lessons.scheduledAt,
                  studentName: students.name,
                  studentPhone: students.phone,
                  guardianPhone: students.guardianPhone,
                  birthDate: students.birthDate,
                  instrumentName: instruments.name,
                })
                .from(lessons)
                .leftJoin(students, and(eq(lessons.studentId, students.id), eq(students.organizationId, orgId)))
                .leftJoin(instruments, and(eq(students.instrumentId, instruments.id), eq(instruments.organizationId, orgId)))
                .where(
                  and(
                    eq(lessons.organizationId, orgId),
                    eq(lessons.userId, userId),
                    eq(lessons.status, "agendada"),
                    gte(lessons.scheduledAt, now2),
                    lte(lessons.scheduledAt, sunday),
                    eq(students.status, "ativo")
                  )
                );

              for (const lesson of upcomingLessons2) {
                const lessonTime = new Date(lesson.scheduledAt);
                const triggerTime = new Date(lessonTime.getTime() + offsetMs); // offsetHours=-24 → 24h before
                if (triggerTime > now2) continue;

                const lessonDateStr = lessonTime.toISOString().slice(0, 10);
                const refId = `auto-rule-${rule.id}-lesson-${lesson.id}-${lessonDateStr}`;
                const existing = await db.select({ id: reminders.id }).from(reminders)
                  .where(and(eq(reminders.organizationId, orgId), eq(reminders.refId, refId))).limit(1);
                if (existing.length > 0) continue;

                const dataAula = lessonTime.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", timeZone: "America/Sao_Paulo" });
                const horaAula = lessonTime.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

                let message = (rule.messageTemplate ?? "")
                  .replace(/\{nome_aluno\}/g, lesson.studentName ?? "Aluno")
                  .replace(/\{nome_professor\}/g, professorName)
                  .replace(/\{nome_escola\}/g, schoolName)
                  .replace(/\{curso\}/g, lesson.instrumentName ?? "música")
                  .replace(/\{instrumento\}/g, lesson.instrumentName ?? "música")
                  .replace(/\{data_aula\}/g, dataAula)
                  .replace(/\{hora_aula\}/g, horaAula);

                let targetPhone = lesson.studentPhone;
                if (lesson.birthDate) {
                  const bd = new Date(lesson.birthDate);
                  let age = now2.getFullYear() - bd.getFullYear();
                  if (now2.getMonth() < bd.getMonth() || (now2.getMonth() === bd.getMonth() && now2.getDate() < bd.getDate())) age--;
                  if (age < 18 && lesson.guardianPhone) targetPhone = lesson.guardianPhone;
                }
                if (!targetPhone) continue;

                await db.insert(reminders).values({
                  organizationId: orgId, userId, studentId: lesson.studentId, lessonId: lesson.id,
                  type: "aula", message, scheduledAt: triggerTime, status: "pendente", autoGenerated: 1, refId,
                });

                if (userSet.whatsappAutoSend === 1 && userSet.whatsappBotUrl) {
                  const sendRes = await sendWhatsAppMessage({
                    url: userSet.whatsappBotUrl, token: userSet.whatsappBotToken,
                    phone: targetPhone, message, sessionId: `prof_${userId}`,
                  });
                  const [newRem] = await db.select({ id: reminders.id }).from(reminders).where(eq(reminders.refId, refId)).limit(1);
                  if (newRem) {
                    await db.update(reminders).set({
                      status: sendRes.success ? "enviado" : "pendente",
                      sentAt: sendRes.success ? now2 : undefined,
                      errorMessage: sendRes.error ?? null,
                      updatedAt: new Date(),
                    }).where(eq(reminders.id, newRem.id));
                  }
                  if (sendRes.success) {
                    await db.update(messageAutomationRules).set({ totalSent: (rule.totalSent ?? 0) + 1, lastExecutedAt: now2, updatedAt: new Date() }).where(eq(messageAutomationRules.id, rule.id));
                  }
                }
              }

            } else if (rule.trigger === "birthday") {
              // ── ANIVERSÁRIOS ─────────────────────────────────────────────────
              const allStudents = await db
                .select({ id: students.id, name: students.name, phone: students.phone, guardianPhone: students.guardianPhone, birthDate: students.birthDate, instrumentName: instruments.name })
                .from(students)
                .leftJoin(instruments, and(eq(students.instrumentId, instruments.id), eq(instruments.organizationId, orgId)))
                .where(and(eq(students.organizationId, orgId), eq(students.userId, userId), eq(students.status, "ativo")));

              for (const student of allStudents) {
                if (!student.birthDate) continue;
                const bd = new Date(student.birthDate);
                if (bd.getMonth() !== now2.getMonth() || bd.getDate() !== now2.getDate()) continue;

                const refId = `auto-rule-${rule.id}-bday-${student.id}-${todayStr2}`;
                const existing = await db.select({ id: reminders.id }).from(reminders)
                  .where(and(eq(reminders.organizationId, orgId), eq(reminders.refId, refId))).limit(1);
                if (existing.length > 0) continue;

                const message = (rule.messageTemplate ?? "")
                  .replace(/\{nome_aluno\}/g, student.name ?? "Aluno")
                  .replace(/\{nome_professor\}/g, professorName)
                  .replace(/\{nome_escola\}/g, schoolName)
                  .replace(/\{curso\}/g, student.instrumentName ?? "música")
                  .replace(/\{instrumento\}/g, student.instrumentName ?? "música");

                const targetPhone = student.phone || student.guardianPhone;
                if (!targetPhone) continue;

                await db.insert(reminders).values({
                  organizationId: orgId, userId, studentId: student.id,
                  type: "manual", message, scheduledAt: now2, status: "pendente", autoGenerated: 1, refId,
                });

                if (userSet.whatsappAutoSend === 1 && userSet.whatsappBotUrl) {
                  const sendRes = await sendWhatsAppMessage({
                    url: userSet.whatsappBotUrl, token: userSet.whatsappBotToken,
                    phone: targetPhone, message, sessionId: `prof_${userId}`,
                  });
                  const [newRem] = await db.select({ id: reminders.id }).from(reminders).where(eq(reminders.refId, refId)).limit(1);
                  if (newRem) {
                    await db.update(reminders).set({
                      status: sendRes.success ? "enviado" : "pendente",
                      sentAt: sendRes.success ? now2 : undefined,
                      errorMessage: sendRes.error ?? null,
                      updatedAt: new Date(),
                    }).where(eq(reminders.id, newRem.id));
                  }
                  if (sendRes.success) {
                    await db.update(messageAutomationRules).set({ totalSent: (rule.totalSent ?? 0) + 1, lastExecutedAt: now2, updatedAt: new Date() }).where(eq(messageAutomationRules.id, rule.id));
                  }
                }
              }

            } else if (rule.trigger === "student_inactive") {
              // ── ALUNOS INATIVOS ──────────────────────────────────────────────
              const inactiveDays = rule.offsetDays ?? 30;
              const thresholdDate = new Date(now2);
              thresholdDate.setDate(thresholdDate.getDate() - inactiveDays);

              // Find students whose last lesson was before threshold
              const studentsWithLastLesson = await db
                .select({
                  studentId: lessons.studentId,
                  lastLesson: sql<string>`max(${lessons.scheduledAt})`,
                  studentName: students.name,
                  studentPhone: students.phone,
                  guardianPhone: students.guardianPhone,
                  instrumentName: instruments.name,
                })
                .from(lessons)
                .leftJoin(students, and(eq(lessons.studentId, students.id), eq(students.organizationId, orgId)))
                .leftJoin(instruments, and(eq(students.instrumentId, instruments.id), eq(instruments.organizationId, orgId)))
                .where(
                  and(
                    eq(lessons.organizationId, orgId),
                    eq(lessons.userId, userId),
                    eq(students.status, "ativo")
                  )
                )
                .groupBy(lessons.studentId, students.name, students.phone, students.guardianPhone, instruments.name);

              for (const row of studentsWithLastLesson) {
                if (!row.studentId || !row.lastLesson) continue;
                const lastLessonDate = new Date(row.lastLesson);
                if (lastLessonDate > thresholdDate) continue; // Still active

                const daysSince = Math.floor((now2.getTime() - lastLessonDate.getTime()) / (1000 * 60 * 60 * 24));
                const refId = `auto-rule-${rule.id}-inactive-${row.studentId}-${todayStr2}`;
                const existing = await db.select({ id: reminders.id }).from(reminders)
                  .where(and(eq(reminders.organizationId, orgId), eq(reminders.refId, refId))).limit(1);
                if (existing.length > 0) continue;

                const message = (rule.messageTemplate ?? "")
                  .replace(/\{nome_aluno\}/g, row.studentName ?? "Aluno")
                  .replace(/\{nome_professor\}/g, professorName)
                  .replace(/\{nome_escola\}/g, schoolName)
                  .replace(/\{curso\}/g, row.instrumentName ?? "música")
                  .replace(/\{instrumento\}/g, row.instrumentName ?? "música")
                  .replace(/\{dias_sem_estudo\}/g, String(daysSince));

                const targetPhone = row.studentPhone || row.guardianPhone;
                if (!targetPhone) continue;

                await db.insert(reminders).values({
                  organizationId: orgId, userId, studentId: row.studentId,
                  type: "manual", message, scheduledAt: now2, status: "pendente", autoGenerated: 1, refId,
                });

                if (userSet.whatsappAutoSend === 1 && userSet.whatsappBotUrl) {
                  const sendRes = await sendWhatsAppMessage({
                    url: userSet.whatsappBotUrl, token: userSet.whatsappBotToken,
                    phone: targetPhone, message, sessionId: `prof_${userId}`,
                  });
                  const [newRem] = await db.select({ id: reminders.id }).from(reminders).where(eq(reminders.refId, refId)).limit(1);
                  if (newRem) {
                    await db.update(reminders).set({
                      status: sendRes.success ? "enviado" : "pendente",
                      sentAt: sendRes.success ? now2 : undefined,
                      errorMessage: sendRes.error ?? null,
                      updatedAt: new Date(),
                    }).where(eq(reminders.id, newRem.id));
                  }
                  if (sendRes.success) {
                    await db.update(messageAutomationRules).set({ totalSent: (rule.totalSent ?? 0) + 1, lastExecutedAt: now2, updatedAt: new Date() }).where(eq(messageAutomationRules.id, rule.id));
                  }
                }
              }

            } else if (rule.trigger === "new_student") {
              // ── NOVOS ALUNOS ─────────────────────────────────────────────────
              const offsetMs2 = (rule.offsetDays ?? 0) * 24 * 60 * 60 * 1000;
              const newStudents2 = await db
                .select({
                  id: students.id,
                  name: students.name,
                  phone: students.phone,
                  guardianPhone: students.guardianPhone,
                  birthDate: students.birthDate,
                  createdAt: students.createdAt,
                  instrumentName: instruments.name,
                })
                .from(students)
                .leftJoin(instruments, and(eq(students.instrumentId, instruments.id), eq(instruments.organizationId, orgId)))
                .where(
                  and(
                    eq(students.organizationId, orgId),
                    eq(students.userId, userId),
                    eq(students.status, "ativo"),
                    gte(students.createdAt, new Date(now2.getTime() - 7 * 24 * 60 * 60 * 1000)) // Last 7 days
                  )
                );

              for (const student of newStudents2) {
                const triggerDate = new Date(student.createdAt.getTime() + offsetMs2);
                if (triggerDate > now2) continue;

                const refId = `auto-rule-${rule.id}-newstudent-${student.id}`;
                const existing = await db.select({ id: reminders.id }).from(reminders)
                  .where(and(eq(reminders.organizationId, orgId), eq(reminders.refId, refId))).limit(1);
                if (existing.length > 0) continue;

                const message = (rule.messageTemplate ?? "")
                  .replace(/\{nome_aluno\}/g, student.name ?? "Aluno")
                  .replace(/\{nome_professor\}/g, professorName)
                  .replace(/\{nome_escola\}/g, schoolName)
                  .replace(/\{curso\}/g, student.instrumentName ?? "música")
                  .replace(/\{instrumento\}/g, student.instrumentName ?? "música");

                let targetPhone = student.phone;
                if (student.birthDate) {
                  const bd = new Date(student.birthDate);
                  let age = now2.getFullYear() - bd.getFullYear();
                  if (now2.getMonth() < bd.getMonth() || (now2.getMonth() === bd.getMonth() && now2.getDate() < bd.getDate())) age--;
                  if (age < 18 && student.guardianPhone) targetPhone = student.guardianPhone;
                }
                if (!targetPhone) continue;

                await db.insert(reminders).values({
                  organizationId: orgId, userId, studentId: student.id,
                  type: "manual", message, scheduledAt: now2, status: "pendente", autoGenerated: 1, refId,
                });

                if (userSet.whatsappAutoSend === 1 && userSet.whatsappBotUrl) {
                  const sendRes = await sendWhatsAppMessage({
                    url: userSet.whatsappBotUrl, token: userSet.whatsappBotToken,
                    phone: targetPhone, message, sessionId: `prof_${userId}`,
                  });
                  const [newRem] = await db.select({ id: reminders.id }).from(reminders).where(eq(reminders.refId, refId)).limit(1);
                  if (newRem) {
                    await db.update(reminders).set({
                      status: sendRes.success ? "enviado" : "pendente",
                      sentAt: sendRes.success ? now2 : undefined,
                      errorMessage: sendRes.error ?? null,
                      updatedAt: new Date(),
                    }).where(eq(reminders.id, newRem.id));
                  }
                  if (sendRes.success) {
                    await db.update(messageAutomationRules).set({ totalSent: (rule.totalSent ?? 0) + 1, lastExecutedAt: now2, updatedAt: new Date() }).where(eq(messageAutomationRules.id, rule.id));
                  }
                }
              }

            } else if (rule.trigger === "payment_confirmed") {
              // ── PAGAMENTO CONFIRMADO ─────────────────────────────────────────
              // Find payments confirmed today (paidAt >= start of today)
              const startOfToday = new Date(now2.getFullYear(), now2.getMonth(), now2.getDate(), 0, 0, 0);
              const confirmedToday = await db
                .select({
                  id: paymentDues.id,
                  studentId: paymentDues.studentId,
                  amount: paymentDues.amount,
                  paidAt: paymentDues.paidAt,
                  studentName: students.name,
                  studentPhone: students.phone,
                  guardianPhone: students.guardianPhone,
                  birthDate: students.birthDate,
                  instrumentName: instruments.name,
                })
                .from(paymentDues)
                .leftJoin(students, and(eq(paymentDues.studentId, students.id), eq(students.organizationId, orgId)))
                .leftJoin(instruments, and(eq(students.instrumentId, instruments.id), eq(instruments.organizationId, orgId)))
                .where(
                  and(
                    eq(paymentDues.organizationId, orgId),
                    eq(paymentDues.userId, userId),
                    eq(paymentDues.status, "pago"),
                    gte(paymentDues.paidAt, startOfToday)
                  )
                );

              for (const payment of confirmedToday) {
                const refId = `auto-rule-${rule.id}-paid-${payment.id}-${todayStr2}`;
                const existing = await db.select({ id: reminders.id }).from(reminders)
                  .where(and(eq(reminders.organizationId, orgId), eq(reminders.refId, refId))).limit(1);
                if (existing.length > 0) continue;

                const valor = Number(payment.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
                const message = (rule.messageTemplate ?? "")
                  .replace(/\{nome_aluno\}/g, payment.studentName ?? "Aluno")
                  .replace(/\{nome_professor\}/g, professorName)
                  .replace(/\{nome_escola\}/g, schoolName)
                  .replace(/\{curso\}/g, payment.instrumentName ?? "música")
                  .replace(/\{valor_mensalidade\}/g, valor);

                let targetPhone = payment.studentPhone;
                if (payment.birthDate) {
                  const bd = new Date(payment.birthDate);
                  let age = now2.getFullYear() - bd.getFullYear();
                  if (now2.getMonth() < bd.getMonth() || (now2.getMonth() === bd.getMonth() && now2.getDate() < bd.getDate())) age--;
                  if (age < 18 && payment.guardianPhone) targetPhone = payment.guardianPhone;
                }
                if (!targetPhone) continue;

                await db.insert(reminders).values({
                  organizationId: orgId, userId, studentId: payment.studentId, paymentDueId: payment.id,
                  type: "cobranca", message, scheduledAt: now2, status: "pendente", autoGenerated: 1, refId,
                });

                if (userSet.whatsappAutoSend === 1 && userSet.whatsappBotUrl) {
                  const sendRes = await sendWhatsAppMessage({
                    url: userSet.whatsappBotUrl, token: userSet.whatsappBotToken,
                    phone: targetPhone, message, sessionId: `prof_${userId}`,
                  });
                  const [newRem] = await db.select({ id: reminders.id }).from(reminders).where(eq(reminders.refId, refId)).limit(1);
                  if (newRem) {
                    await db.update(reminders).set({
                      status: sendRes.success ? "enviado" : "pendente",
                      sentAt: sendRes.success ? now2 : undefined,
                      errorMessage: sendRes.error ?? null,
                      updatedAt: new Date(),
                    }).where(eq(reminders.id, newRem.id));
                  }
                  if (sendRes.success) {
                    await db.update(messageAutomationRules).set({ totalSent: (rule.totalSent ?? 0) + 1, lastExecutedAt: now2, updatedAt: new Date() }).where(eq(messageAutomationRules.id, rule.id));
                  }
                }
              }
            }
          } catch (ruleErr) {
            console.error(`[Automation] Error processing rule ID ${rule.id} (${rule.name}):`, ruleErr);
          }
        }
      }
    }
  } catch (automationRulesErr) {
    console.error("[Automation] Error in automation rules processing:", automationRulesErr);
  }

  // --- RELATÓRIO DIÁRIO DE TREINOS ---
  try {
    for (const userSettings of activeSettings) {
      const orgId = userSettings.organizationId;
      const userId = userSettings.userId;
      if (!orgId) continue;

      if (now.getHours() >= 20) {
        const { dailyStudyPlans, students, notifications } = await import("../drizzle/schema");
        
        // Verifica se já enviou o relatório hoje
        const [existingReport] = await db
          .select({ id: notifications.id })
          .from(notifications)
          .where(and(
            eq(notifications.organizationId, orgId),
            eq(notifications.title, "Relatório Diário de Treinos 📊"),
            gte(notifications.createdAt, startOfDay)
          ))
          .limit(1);

        if (!existingReport) {
          const plans = await db
            .select({
              studentName: students.name,
              updatedAt: dailyStudyPlans.updatedAt,
              daysCompleted: dailyStudyPlans.daysCompleted
            })
            .from(dailyStudyPlans)
            .leftJoin(students, eq(dailyStudyPlans.studentId, students.id))
            .where(and(
              eq(dailyStudyPlans.organizationId, orgId),
              eq(dailyStudyPlans.status, 'ativo'),
              eq(dailyStudyPlans.publishedStatus, 'publicado')
            ));

          if (plans.length > 0) {
            let messageContent = "Resumo dos treinos de hoje:\n";
            let anyStudent = false;

            for (const p of plans) {
              if (!p.studentName) continue;
              anyStudent = true;
              // Se updatedAt >= startOfDay, o aluno interagiu com o plano hoje
              const updatedToday = p.updatedAt && new Date(p.updatedAt).getTime() >= startOfDay.getTime();
              
              if (updatedToday) {
                messageContent += `\n✅ ${p.studentName.split(' ')[0]}`;
              } else {
                messageContent += `\n❌ ${p.studentName.split(' ')[0]}`;
              }
            }

            if (anyStudent) {
              await db.insert(notifications).values({
                organizationId: orgId,
                userId: userId,
                title: "Relatório Diário de Treinos 📊",
                message: messageContent,
                type: "info",
                actionUrl: "/progresso",
              });

              try {
                await notifyUser(userId, {
                  title: "Relatório Diário de Treinos 📊",
                  content: messageContent,
                });
              } catch (e) {
                console.error("[Automation] Erro ao enviar push de relatório:", e);
              }
            }
          }
        }
      }
    }
  } catch (reportErr) {
    console.error("[Automation] Error in daily practice report:", reportErr);
  }

  isAutomationRunning = false;

}

export function startAutomationJob() {
  setTimeout(() => {
    runAutomation().catch(err => console.error("[Automation] Initial run error:", err));
    setInterval(() => {
      runAutomation().catch(err => console.error("[Automation] Scheduled run error:", err));
    }, 60 * 1000); 
  }, 60 * 1000); 

  console.log("[Automation] Job scheduler started — runs every 1 minute");
}

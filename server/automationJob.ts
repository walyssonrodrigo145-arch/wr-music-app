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

      // ─── 1. BUSCA E GERAÇÃO DE LEMBRETES DE AULA ────────────────────────────
      // Busca todas as aulas agendadas da semana atual para alunos ativos
      const monday = new Date(startOfDay);
      monday.setDate(monday.getDate() - monday.getDay());
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 7);

      const weekLessons = await db
        .select({
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
            eq(lessons.userId, userId),
            eq(lessons.lessonType, "individual"),
            gte(lessons.scheduledAt, monday),
            lte(lessons.scheduledAt, sunday),
            eq(students.status, "ativo")
          )
        );

      for (const lesson of weekLessons) {
        if (lesson.status !== "agendada") continue;

        const lessonDate = new Date(lesson.scheduledAt);
        if (lessonDate <= now) continue; // Aula já passou

        const dataAula = lessonDate.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", timeZone: "America/Sao_Paulo" });
        const horaAula = lessonDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

        // Buscar templates de aula criados pelo usuário
        const aulaTemplates = await db
          .select()
          .from(reminderTemplates)
          .where(
            and(
              eq(reminderTemplates.organizationId, orgId),
              eq(reminderTemplates.userId, userId),
              eq(reminderTemplates.type, "aula")
            )
          );

        let tpl24h = aulaTemplates.find(t => t.name.toLowerCase().includes("24"));
        if (!tpl24h) tpl24h = aulaTemplates.find(t => t.isDefault === 1) || aulaTemplates[0];

        let tpl1h = aulaTemplates.find(t => t.name.toLowerCase().includes("1") && (t.name.toLowerCase().includes("h") || t.name.toLowerCase().includes("hora")));
        if (!tpl1h) tpl1h = aulaTemplates.find(t => t.isDefault === 1) || aulaTemplates[0];

        const baseBody24h = tpl24h?.body ?? "Olá {nome}, lembrete: sua aula de {instrumento} é {quando}, {data_aula} às {hora_aula}. Até lá!";
        const baseBody1h = tpl1h?.body ?? "Olá {nome}, lembrete: sua aula de {instrumento} é {quando}, {data_aula} às {hora_aula}. Até lá!";

        const dateStr = lessonDate.toISOString().slice(0, 10);

        // --- TRAVA GLOBAL: qualquer lembrete 'enviado' ou 'cancelado' para esta aula impede novos ---
        const userConcludedAula = await db.select({ id: reminders.id }).from(reminders)
          .where(and(
            eq(reminders.organizationId, orgId),
            eq(reminders.lessonId, lesson.id),
            or(eq(reminders.status, "enviado"), eq(reminders.status, "cancelado"))
          )).limit(1);
        if (userConcludedAula.length > 0) continue;

        // A) Lembrete 24 horas antes
        const time24h = new Date(lessonDate.getTime() - 24 * 60 * 60 * 1000);
        const ref24h = `lesson-24h-${lesson.id}-${dateStr}`;
        const refManual = `lesson-${lesson.id}-${dateStr}`;
        if (time24h <= now) {
          // ✅ Bug fix #3: verifica QUALQUER status existente (pendente, enviado ou cancelado) para não duplicar
          const existing24 = await db.select({ id: reminders.id, status: reminders.status })
            .from(reminders)
            .where(
              and(
                eq(reminders.organizationId, orgId),
                or(
                  eq(reminders.refId, ref24h),
                  eq(reminders.refId, refManual),
                  and(
                    eq(reminders.refId, `lesson-24h-${lesson.id}`),
                    sql`abs(extract(epoch from (${reminders.scheduledAt} - ${time24h.toISOString()}::timestamp))) < 43200`
                  ),
                  and(
                    eq(reminders.lessonId, lesson.id),
                    eq(reminders.type, "aula"),
                    sql`abs(extract(epoch from (${reminders.scheduledAt} - ${time24h.toISOString()}::timestamp))) < 43200`
                  )
                )
              )
            )
            .limit(1);

          // Só cria se não existir NENHUM registro (qualquer status) e não rodamos cleanup agora
          // ✅ Bug fix #4: se o cleanup rodou neste ciclo E não existe registro 'enviado', aguarda o próximo ciclo
          if (existing24.length === 0 && !ranCleanupThisCycle) {
            const msg24 = baseBody24h
              .replace(/\{quando\}/g, "amanhã")
              .replace(/\{nome\}/g, lesson.studentName ?? "Aluno")
              .replace(/\{instrumento\}/g, lesson.instrumentName ?? "música")
              .replace(/\{data_aula\}/g, dataAula)
              .replace(/\{hora_aula\}/g, horaAula)
              .replace(/\{titulo\}/g, lesson.title);

            await db.insert(reminders).values({
              organizationId: orgId, userId, studentId: lesson.studentId, lessonId: lesson.id,
              type: "aula", message: msg24, scheduledAt: time24h, status: "pendente", autoGenerated: 1, refId: ref24h,
            });
            remindersCreated++;
          }
        }

        // B) Lembrete 1 hora antes
        const time1h = new Date(lessonDate.getTime() - 1 * 60 * 60 * 1000);
        const ref1h = `lesson-1h-${lesson.id}-${lessonDate.getTime()}`;
        if (time1h <= now) {
          // ✅ Bug fix #3 aplicado também ao lembrete de 1h
          const existing1 = await db.select({ id: reminders.id, status: reminders.status })
            .from(reminders)
            .where(
              and(
                eq(reminders.organizationId, orgId),
                or(
                  eq(reminders.refId, ref1h),
                  and(
                    eq(reminders.refId, `lesson-1h-${lesson.id}`),
                    sql`abs(extract(epoch from (${reminders.scheduledAt} - ${time1h.toISOString()}::timestamp))) < 3600`
                  ),
                  and(
                    eq(reminders.lessonId, lesson.id),
                    eq(reminders.type, "aula"),
                    sql`abs(extract(epoch from (${reminders.scheduledAt} - ${time1h.toISOString()}::timestamp))) < 3600`
                  )
                )
              )
            )
            .limit(1);

          // ✅ Bug fix #4: não cria logo após o cleanup do domingo
          if (existing1.length === 0 && !ranCleanupThisCycle) {
            const msg1 = baseBody1h
              .replace(/\{quando\}/g, "hoje")
              .replace(/\{nome\}/g, lesson.studentName ?? "Aluno")
              .replace(/\{instrumento\}/g, lesson.instrumentName ?? "música")
              .replace(/\{data_aula\}/g, dataAula)
              .replace(/\{hora_aula\}/g, horaAula)
              .replace(/\{titulo\}/g, lesson.title);

            await db.insert(reminders).values({
              organizationId: orgId, userId, studentId: lesson.studentId, lessonId: lesson.id,
              type: "aula", message: msg1, scheduledAt: time1h, status: "pendente", autoGenerated: 1, refId: ref1h,
            });
            remindersCreated++;
          }
        }
      }

      // ─── 2. BUSCA E GERAÇÃO DE LEMBRETES DE MENSALIDADE ─────────────────────
      const dues = await db
        .select({
          id: paymentDues.id,
          studentId: paymentDues.studentId,
          amount: paymentDues.amount,
          dueDate: paymentDues.dueDate,
          status: paymentDues.status,
          month: paymentDues.month,
          year: paymentDues.year,
          notes: paymentDues.notes,
          asaasPaymentLink: paymentDues.asaasPaymentLink,
          studentName: students.name,
          studentPhone: students.phone,
          studentNotes: students.notes,
          instrumentName: instruments.name,
        })
        .from(paymentDues)
        .leftJoin(students, and(eq(paymentDues.studentId, students.id), eq(students.organizationId, orgId)))
        .leftJoin(instruments, and(eq(students.instrumentId, instruments.id), eq(students.organizationId, orgId)))
        .where(
          and(
            eq(paymentDues.organizationId, orgId),
            eq(paymentDues.userId, userId),
            or(eq(paymentDues.status, "pendente"), eq(paymentDues.status, "atrasado")),
            eq(students.status, "ativo")
          )
        );

      for (const due of dues) {
        const dueDate = new Date(due.dueDate + "T12:00:00");
        const dueDateStr = String(due.dueDate).slice(0, 10);
        const isOverdue = dueDateStr < todayStr;
        const isToday = dueDateStr === todayStr;

        // ── Regra oficial: o Aviso de Vencimento (Dia D) é o ÚLTIMO lembrete automático ──
        // Mensalidades já vencidas (atrasadas) NÃO recebem mais lembretes do robô.
        // Para re-notificar manualmente, use o botão "Gerar" na tela de Lembretes.
        if (isOverdue) continue;

        // --- TRAVA MANUAL ---
        // Se o usuário já marcou qualquer lembrete desta cobrança como 'enviado' ou 'cancelado', 
        // o robô não deve gerar novos lembretes (nem prévio, nem Dia D).
        const userConcludedPayment = await db.select({ id: reminders.id }).from(reminders)
          .where(and(
            eq(reminders.organizationId, orgId),
            eq(reminders.paymentDueId, due.id),
            or(eq(reminders.status, "enviado"), eq(reminders.status, "cancelado"))
          )).limit(1);
        if (userConcludedPayment.length > 0) continue;

        const vencimento = dueDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });
        const valor = Number(due.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

        // B) Aviso de Vencimento — Dia D (último lembrete automático)
        if (isToday) {
          const refId = `pay-hoje-${due.id}`;
          // Verifica se já existe lembrete de hoje (qualquer status: pendente, enviado ou cancelado)
          // Trava de Duplicidade — Dia D: cada etapa tem refId próprio e independente.
          // O aviso prévio (pay-prev-X) NÃO impede a criação do Dia D (pay-hoje-X).
          const manualRefId = `payment-${due.id}-${due.year}-${due.month}`;
          const existing = await db.select({ id: reminders.id }).from(reminders)
            .where(and(
              eq(reminders.organizationId, orgId),
              or(
                eq(reminders.refId, refId),
                eq(reminders.refId, manualRefId)
              )
            )).limit(1);
          // ✅ Bug fix #4: não recria imediatamente após o cleanup do domingo
          if (existing.length === 0 && !ranCleanupThisCycle) {
            let [tpl] = await db.select().from(reminderTemplates).where(and(eq(reminderTemplates.organizationId, orgId), eq(reminderTemplates.userId, userId), eq(reminderTemplates.type, "cobranca"), eq(reminderTemplates.isDefault, 1))).limit(1);
            if (!tpl) {
              const anyTpl = await db.select().from(reminderTemplates).where(and(eq(reminderTemplates.organizationId, orgId), eq(reminderTemplates.userId, userId), eq(reminderTemplates.type, "cobranca"))).limit(1);
              if (anyTpl.length > 0) tpl = anyTpl[0];
            }
            const body = tpl?.body ?? "Olá {nome}, lembramos que sua mensalidade de {valor} vence hoje, {vencimento}. Agradecemos o pagamento no prazo!";
            let message = body
              .replace(/\{nome\}/g, due.studentName ?? "Aluno")
              .replace(/\{valor\}/g, valor)
              .replace(/\{vencimento\}/g, vencimento)
              .replace(/\{instrumento\}/g, due.instrumentName ?? "música")
              .replace(/\{chave_pix\}/g, userSettings.pixKey ?? "");
            if (due.asaasPaymentLink) {
              message += `\n\n💳 *Link oficial para pagamento (PIX/Cartão/Boleto):*\n${due.asaasPaymentLink}`;
            } else if (userSettings.pixKey) {
              message += `\n\n💳 *Pagamento via PIX:*\n🔑 Chave: ${userSettings.pixKey}`;
            }

            await db.insert(reminders).values({
              organizationId: orgId, userId, studentId: due.studentId, paymentDueId: due.id,
              type: "cobranca", message, scheduledAt: now, status: "pendente", autoGenerated: 1, refId,
            });
            remindersCreated++;
          }
        }
        else {
          const reminderDate = new Date(dueDate);
          reminderDate.setDate(dueDate.getDate() - 3);

          if (reminderDate <= now) {
            const refId = `pay-prev-${due.id}`;
            // Verifica se já existe lembrete para esta mensalidade (qualquer status: pendente, enviado ou cancelado)
            // Trava de Duplicidade — Aviso Prévio (3 dias): cada etapa tem refId próprio.
            // O Aviso do Dia D (pay-hoje-X) NÃO impede a criação do aviso prévio (pay-prev-X)
            // e vice-versa. As duas etapas são completamente independentes.
            const manualRefId = `payment-${due.id}-${due.year}-${due.month}`;
            const existing = await db.select({ id: reminders.id }).from(reminders)
              .where(and(
                eq(reminders.organizationId, orgId),
                or(
                  eq(reminders.refId, refId),
                  eq(reminders.refId, manualRefId)
                )
              )).limit(1);
            // ✅ Bug fix #4: não recria imediatamente após o cleanup do domingo
            if (existing.length === 0 && !ranCleanupThisCycle) {
              let [tpl] = await db.select().from(reminderTemplates).where(and(eq(reminderTemplates.organizationId, orgId), eq(reminderTemplates.userId, userId), eq(reminderTemplates.type, "cobranca"), eq(reminderTemplates.isDefault, 1))).limit(1);
              if (!tpl) {
                const anyTpl = await db.select().from(reminderTemplates).where(and(eq(reminderTemplates.organizationId, orgId), eq(reminderTemplates.userId, userId), eq(reminderTemplates.type, "cobranca"))).limit(1);
                if (anyTpl.length > 0) tpl = anyTpl[0];
              }
              const body = tpl?.body ?? "Olá {nome}, sua mensalidade de {valor} vence em {vencimento}. Por favor, programe o pagamento.";
              let message = body
                .replace(/\{nome\}/g, due.studentName ?? "Aluno")
                .replace(/\{valor\}/g, valor)
                .replace(/\{vencimento\}/g, vencimento)
                .replace(/\{instrumento\}/g, due.instrumentName ?? "música")
                .replace(/\{chave_pix\}/g, userSettings.pixKey ?? "");
              if (due.asaasPaymentLink) {
                message += `\n\n💳 *Link oficial para pagamento (PIX/Cartão/Boleto):*\n${due.asaasPaymentLink}`;
              } else if (userSettings.pixKey) {
                message += `\n\n💳 *Pagamento via PIX:*\n🔑 Chave: ${userSettings.pixKey}`;
              }

              await db.insert(reminders).values({
                organizationId: orgId, userId, studentId: due.studentId, paymentDueId: due.id,
                type: "cobranca", message, scheduledAt: reminderDate, status: "pendente", autoGenerated: 1, refId,
              });
              remindersCreated++;
            }
          }
        }
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
          await notifyUser(userId, {
            title: "Alerta de Aula",
            content: `Sua aula "${lesson.title}" com ${lesson.studentName || "Aluno"} começa em 1 hora (${new Date(lesson.scheduledAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}).`
          });
          
          await db
            .update(lessons)
            .set({ alertSent1h: true, updatedAt: new Date() })
            .where(eq(lessons.id, lesson.id));
        }
        
        // Alerta de 30 minutos (entre 20 e 40 minutos para tolerância)
        if (diffMinutes >= 20 && diffMinutes <= 40 && !lesson.alertSent30m) {
          await notifyUser(userId, {
            title: "Alerta de Aula",
            content: `Sua aula "${lesson.title}" com ${lesson.studentName || "Aluno"} começa em 30 minutos (${new Date(lesson.scheduledAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}).`
          });
          
          await db
            .update(lessons)
            .set({ alertSent30m: true, updatedAt: new Date() })
            .where(eq(lessons.id, lesson.id));
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
            }
          } catch (err) {
            console.error(`[Automation] Error processing study plan ID ${plan.id}:`, err);
          }
        }
      }

      await db.update(settings).set({ automationLastRun: now }).where(eq(settings.userId, userId));

      if (remindersCreated > 0) {
        await notifyUser(userId, {
          title: "Lembretes Gerados",
          content: `O robô gerou ${remindersCreated} novos lembretes de aula e/ou cobrança do dia.`
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

            await notifyUser(userId, {
              title: "Mensagem Enviada",
              content: `Lembrete enviado com sucesso para ${rem.studentName || "Aluno"} (${targetPhone}).`,
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

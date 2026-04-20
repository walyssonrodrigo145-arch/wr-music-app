/**
 * Job de automação de lembretes
 * Roda a cada hora e gera lembretes automaticamente para usuários
 * que tenham automationEnabled = 1 nas configurações.
 *
 * Regras:
 * - Aulas: somente da semana atual, exatamente 24h antes
 * - Mensalidades FUTURAS: lembrete 1 dia antes do vencimento
 * - Mensalidades VENCIDAS e não pagas: gera lembrete de inadimplência imediatamente
 * - Nunca gera duplicados (usa refId único)
 * - Ignora aulas canceladas e mensalidades pagas
 */

import { eq, and, gte, lte, lt, sql } from "drizzle-orm";
import { notifyOwner } from "./_core/notification";
import { getDb } from "./db";
import { settings, lessons, students, instruments, reminders, reminderTemplates, paymentDues } from "../drizzle/schema";

async function runAutomation() {
  const db = await getDb();
  if (!db) return;

  // Buscar todos os usuários com automação ativada
  const activeSettings = await db
    .select()
    .from(settings)
    .where(eq(settings.automationEnabled, 1));

  if (activeSettings.length === 0) return;

  const now = new Date();

  for (const userSettings of activeSettings) {
    const userId = userSettings.userId;
    let remindersCreated = 0;

    try {
      // ─── LIMPEZA SEMANAL (Domingo) ──────────────────────────────────────────
      // Se for domingo e a última execução não foi hoje, limpamos os lembretes
      const lastRunDate = userSettings.automationLastRun ? new Date(userSettings.automationLastRun) : null;
      const isSunday = now.getDay() === 0;
      const isNewDay = !lastRunDate || lastRunDate.toDateString() !== now.toDateString();

      if (isSunday && isNewDay) {
        console.log(`[Automation] Sunday cleanup for userId=${userId}: Clearing reminders for the new week.`);
        await db.delete(reminders).where(eq(reminders.userId, userId));
      }
      // ─── LEMBRETES DE AULA (24h antes, semana atual) ───────────────────────
      const dayOfWeek = now.getDay();
      const monday = new Date(now);
      monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      monday.setHours(0, 0, 0, 0);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);

      const weekLessons = await db
        .select({
          id: lessons.id,
          studentId: lessons.studentId,
          title: lessons.title,
          scheduledAt: lessons.scheduledAt,
          duration: lessons.duration,
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
            eq(lessons.userId, userId),
            gte(lessons.scheduledAt, monday),
            lte(lessons.scheduledAt, sunday)
          )
        );

      for (const lesson of weekLessons) {
        if (lesson.status === "cancelada") continue;

        const lessonDate = new Date(lesson.scheduledAt);
        if (lessonDate <= now) continue; // aula já passou

        // Lembrete = exatamente 24h antes
        const reminderTime = new Date(lessonDate.getTime() - 24 * 60 * 60 * 1000);
        if (reminderTime > now) continue; // Ainda falta mais de 24h para a aula
        if (reminderTime.getTime() < now.getTime() - 24 * 60 * 60 * 1000) continue; // Evitar retornar para janelas muito antigas

        const refId = `lesson-${lesson.id}-${lessonDate.toISOString().slice(0, 10)}`;

        // Verificar duplicidade
        const existing = await db
          .select({ id: reminders.id })
          .from(reminders)
          .where(eq(reminders.refId, refId))
          .limit(1);
        if (existing.length > 0) continue;

        // Buscar template padrão de aula do usuário
        const [tpl] = await db
          .select()
          .from(reminderTemplates)
          .where(
            and(
              eq(reminderTemplates.userId, userId),
              eq(reminderTemplates.type, "aula"),
              eq(reminderTemplates.isDefault, 1)
            )
          )
          .limit(1);

        const dataAula = lessonDate.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", timeZone: "America/Sao_Paulo" });
        const horaAula = lessonDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
        const bodyTemplate = tpl?.body ?? "Olá {nome}, lembrete: sua aula de {instrumento} é amanhã, {data_aula} às {hora_aula}. Até lá!";
        const message = bodyTemplate
          .replace(/\{nome\}/g, lesson.studentName ?? "Aluno")
          .replace(/\{instrumento\}/g, lesson.instrumentName ?? "música")
          .replace(/\{data_aula\}/g, dataAula)
          .replace(/\{hora_aula\}/g, horaAula)
          .replace(/\{titulo\}/g, lesson.title);

        await db.insert(reminders).values({
          userId,
          studentId: lesson.studentId,
          lessonId: lesson.id,
          type: "aula",
          message,
          scheduledAt: reminderTime,
          status: "pendente",
          autoGenerated: 1,
          refId,
        });

        remindersCreated++;
      }

      // ─── LEMBRETES DE MENSALIDADE ──────────────────────────────────────────
      const today = now.toISOString().slice(0, 10); // YYYY-MM-DD

      const dues = await db
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
          instrumentName: instruments.name,
        })
        .from(paymentDues)
        .leftJoin(students, eq(paymentDues.studentId, students.id))
        .leftJoin(instruments, eq(students.instrumentId, instruments.id))
        .where(
          and(
            eq(paymentDues.userId, userId),
            eq(paymentDues.status, "pendente")
          )
        );

      for (const due of dues) {
        const dueDate = new Date(due.dueDate + "T12:00:00");
        const dueDateStr = String(due.dueDate).slice(0, 10);
        const isOverdue = dueDateStr < today;

        let reminderTime: Date;
        let type: "cobranca" | "inadimplencia";
        let refId: string;
        let bodyTemplate: string;

        if (isOverdue) {
          type = "inadimplencia";
          refId = `overdue-${due.id}-${today}`;
          reminderTime = new Date(now);
          bodyTemplate = "Olá {nome}, sua mensalidade de {valor} venceu em {vencimento} e ainda não foi paga. Por favor, entre em contato para regularizar.";
        } else {
          // Mensalidade futura → lembrete 3 dias antes
          type = "cobranca";
          const reminderDate = new Date(dueDate);
          reminderDate.setDate(dueDate.getDate() - 3);
          // Removida a restrição das 9h para permitir disparo em qualquer horário

          if (reminderDate > now) continue;

          reminderTime = reminderDate;
          refId = `payment-${due.id}-${due.year}-${due.month}`;
          bodyTemplate = "Olá {nome}, sua mensalidade de {valor} vence em {vencimento}. Por favor, efetue o pagamento.";
        }

        // Verificar duplicidade
        const existing = await db
          .select({ id: reminders.id })
          .from(reminders)
          .where(and(eq(reminders.userId, userId), eq(reminders.refId, refId)))
          .limit(1);
        if (existing.length > 0) continue;

        // Buscar template padrão
        const [tpl] = await db
          .select()
          .from(reminderTemplates)
          .where(
            and(
              eq(reminderTemplates.userId, userId),
              eq(reminderTemplates.type, type),
              eq(reminderTemplates.isDefault, 1)
            )
          )
          .limit(1);

        const vencimento = dueDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });
        const valor = Number(due.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
        const finalTemplate = tpl?.body ?? bodyTemplate;
        const message = finalTemplate
          .replace(/\{nome\}/g, due.studentName ?? "Aluno")
          .replace(/\{valor\}/g, valor)
          .replace(/\{vencimento\}/g, vencimento)
          .replace(/\{instrumento\}/g, due.instrumentName ?? "música");

        await db.insert(reminders).values({
          userId,
          studentId: due.studentId,
          paymentDueId: due.id,
          type,
          message,
          scheduledAt: reminderTime,
          status: "pendente",
          autoGenerated: 1,
          refId,
        });

        remindersCreated++;
      }

      // Atualizar lastRun
      await db
        .update(settings)
        .set({ automationLastRun: now })
        .where(eq(settings.userId, userId));

      // Disparar notificação externa se houver novos lembretes
      if (remindersCreated > 0) {
        await notifyOwner({
          title: "🔔 Novos Lembretes Disponíveis",
          content: `O robô gerou ${remindersCreated} novos lembretes para você revisar e enviar aos alunos.`
        });
      }

    } catch (err) {
      console.error(`[Automation] Error processing userId=${userId}:`, err);
    }
  }

  console.log(`[Automation] Job completed at ${now.toISOString()} for ${activeSettings.length} user(s)`);
}

/**
 * Inicia o job de automação.
 * Roda imediatamente e depois a cada 1 hora.
 */
export function startAutomationJob() {
  // Primeira execução após 1 minuto do boot (evitar conflito na inicialização)
  setTimeout(() => {
    runAutomation().catch(err => console.error("[Automation] Initial run error:", err));
    // Repetir a cada 10 minutos
    setInterval(() => {
      runAutomation().catch(err => console.error("[Automation] Scheduled run error:", err));
    }, 10 * 60 * 1000); // 10 minutos
  }, 60 * 1000); // 1 minuto após boot

  console.log("[Automation] Job scheduler started — runs every 10 minutes");
}

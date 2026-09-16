// ─── PRD_NOTIFICACAO_ALUNO — Confirmação de presença na aula ─────────────────
// Fluxo: lembrete de aula enviado (automationJob ou sendViaBot) → aluno recebe
// notificação no painel (sino) + push + link no WhatsApp → aluno confirma
// ("Estarei presente") ou nega ("Não poderei ir") → professor notificado.
//
// RN-001: só aula 'agendada' do próprio aluno.
// RN-002: idempotente — dedupe de notificação via notifications.refId.
// RN-003: "nao_vai" NÃO altera o status da aula (decisão é do professor).
// RN-004: aluno sem conta no portal (studentUserId null) pula in-app/push.
// RN-005: remarcação reseta a confirmação para 'pendente' (feito nos routers).

import { debugLog } from "../_core/logger";
import { getDb } from "../db";
import { lessons, notifications } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

export const CONFIRMATION_STATES = ["pendente", "confirmado", "nao_vai"] as const;
export type StudentConfirmation = (typeof CONFIRMATION_STATES)[number];

/** URL pública do app (deep-link do WhatsApp). Sobrescreva com APP_PUBLIC_URL. */
export function getAppPublicUrl(): string {
  return (process.env.APP_PUBLIC_URL || "https://wrmusicpro.com.br").replace(/\/+$/, "");
}

/** Link de confirmação da aula (aponta para o Portal do Aluno). */
export function buildConfirmationLink(lessonId: number): string {
  return `${getAppPublicUrl()}/aluno/aulas?confirmar=${lessonId}`;
}

/** Marca do link dentro da mensagem — evita duplicar se já existir. */
export const CONFIRMATION_LINK_MARK = "/aluno/aulas?confirmar=";

/**
 * Acrescenta a linha "✅ Confirme sua presença: ..." à mensagem do lembrete
 * de aula. Puro e idempotente: se a mensagem já tem o link, retorna intacta.
 */
export function appendConfirmationLink(message: string, lessonId: number): string {
  if (!message) return message;
  if (message.includes(CONFIRMATION_LINK_MARK)) return message;
  return `${message}\n\n✅ Confirme sua presença: ${buildConfirmationLink(lessonId)}`;
}

/**
 * RF-001: após enviar um lembrete de aula, cria a notificação de confirmação
 * no painel do aluno (sino) + push. Idempotente: 1 notificação por aula
 * (dedupe por userId + refId `lesson-confirm-{lessonId}`); não recria se o
 * aluno já respondeu (studentConfirmation != 'pendente').
 * Nunca lança — falha não pode bloquear o disparo do lembrete.
 */
export async function requestAttendanceConfirmation(opts: {
  organizationId: number | null;
  lessonId: number;
  studentUserId: number | null;
}): Promise<void> {
  try {
    if (!opts.studentUserId) return;
    const db = await getDb();
    if (!db) return;

    const [lesson] = await db.select({
      id: lessons.id,
      title: lessons.title,
      scheduledAt: lessons.scheduledAt,
      status: lessons.status,
      studentConfirmation: lessons.studentConfirmation,
    }).from(lessons).where(eq(lessons.id, opts.lessonId)).limit(1);

    if (!lesson || lesson.status !== "agendada") return;
    if (lesson.studentConfirmation && lesson.studentConfirmation !== "pendente") return;

    const refId = `lesson-confirm-${lesson.id}`;
    const [existing] = await db.select({ id: notifications.id })
      .from(notifications)
      .where(and(eq(notifications.userId, opts.studentUserId), eq(notifications.refId, refId)))
      .limit(1);
    if (existing) return;

    const when = new Intl.DateTimeFormat("pt-BR", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(lesson.scheduledAt));

    const title = "📚 Confirme sua presença";
    const message = `Sua aula de ${lesson.title} está marcada para ${when}. Você estará presente?`;
    const actionUrl = `/aluno/aulas?confirmar=${lesson.id}`;

    await db.insert(notifications).values({
      organizationId: opts.organizationId,
      userId: opts.studentUserId,
      title,
      message,
      type: "aula_lembrete",
      actionUrl,
      refId,
    });

    debugLog(`[AttendanceConfirmation] Pedido de confirmação criado para aula ${lesson.id}`);
    const { notifyUser } = await import("../_core/notification");
    notifyUser(opts.studentUserId, { title, content: message, url: actionUrl })
      .catch(e => console.error("[AttendanceConfirmation] Falha no push:", e));
  } catch (e) {
    console.error("[AttendanceConfirmation] Erro ao criar pedido de confirmação (não impeditivo):", e);
  }
}

/** Mensagem da notificação que o professor recebe ao receber a resposta do aluno. */
export function buildTeacherNotificationMessage(studentName: string, lessonTitle: string, confirmed: boolean): string {
  return confirmed
    ? `${studentName} confirmou presença na aula "${lessonTitle}".`
    : `${studentName} avisou que NÃO poderá ir à aula "${lessonTitle}". Combine uma reposição ou nova data se necessário.`;
}

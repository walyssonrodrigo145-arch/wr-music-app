// ─── PRD_LEMBRETE_INTERATIVO — Helper compartilhado dos 3 caminhos de envio:
// Loop Principal, Rules Loop (auto-rule) e sendViaBot manual.
// Decide: botões [✅ Vou comparecer] [❌ Não poderei ir] → lista → texto+link.

import { sendInteractive } from "./InteractiveMessageService";
import { WhatsAppSendResult } from "./types";

export interface LessonReminderInteractiveOpts {
  organizationId: number;
  userId: number;
  phone: string;
  reminderMessage: string;   // mensagem já interpolada do lembrete
  lessonId: number;
  instanceName: string;
  baseUrl: string;
  apiKey: string;
  // Lembretes disparam até 1 dia antes → validade do clique = 24h
  buttonExpirationMinutes?: number;
}

export async function sendLessonReminderInteractive(
  db: any,
  opts: LessonReminderInteractiveOpts
): Promise<WhatsAppSendResult> {
  return sendInteractive(db, {
    organizationId: opts.organizationId,
    userId: opts.userId,
    phone: opts.phone,
    menu: "lembrete_aula",
    title: "📚 Lembrete de aula",
    body: opts.reminderMessage.slice(0, 900),
    footer: `Confira também: ${process.env.APP_PUBLIC_URL || "https://wrmusicpro.com.br"}`,
    buttons: [
      { id: `lesson_confirm_${opts.lessonId}`, text: "✅ Vou comparecer", action: "confirmar_presenca_aula", params: { lessonId: opts.lessonId }, order: 1 },
      { id: `lesson_novai_${opts.lessonId}`, text: "❌ Não poderei ir", action: "nao_vai_aula", params: { lessonId: opts.lessonId }, order: 2 },
    ],
    instanceName: opts.instanceName,
    baseUrl: opts.baseUrl,
    apiKey: opts.apiKey,
    buttonExpirationMinutes: opts.buttonExpirationMinutes ?? 1440,
  });
}

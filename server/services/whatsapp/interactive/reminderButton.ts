// ─── PRD_LEMBRETE_INTERATIVO — Helper compartilhado dos 3 caminhos de envio:
// Loop Principal, Rules Loop (auto-rule) e sendViaBot manual.
// Decide: botões [✅ Vou comparecer] [❌ Não poderei ir] → lista → texto+link.

import { sendInteractive } from "./InteractiveMessageService";
import { WhatsAppSendResult } from "./types";
import { canonicalizeWaPhone } from "../../../utils/whatsapp";

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

/**
 * BUG FIX (cacabug): o provider interativo precisa do MESMO normalizador do
 * caminho textual — sem isso, números nacionais de 10/11 dígitos saíam sem o
 * "55" e o WhatsApp interpretava o DDD como código de país (ex.: "33" → França),
 * respondendo exists:false e caindo no fallback textual (era o caso da Iatsa).
 */
function normalizeWaNumber(phone: string): string {
  let digits = (phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10 || digits.length === 11) digits = "55" + digits;
  return canonicalizeWaPhone(digits);
}

export async function sendLessonReminderInteractive(
  db: any,
  opts: LessonReminderInteractiveOpts
): Promise<WhatsAppSendResult> {
  const phone = normalizeWaNumber(opts.phone);
  if (!phone) {
    return { success: false, error: "Telefone inválido para envio do lembrete interativo." };
  }

  // ── DECISÃO DE PRODUTO (evidência real 17/09): sendButtons da Evolution 2.3.7
  // retorna success mas o WhatsApp do ALUNO não renderiza os botões (limitação
  // conhecida do Baileys — desaparecem silenciosamente em vários aparelhos).
  // Para o lembrete de aula, confirmação PRECISA chegar: envia o texto numerado
  // (1️⃣/2️⃣) que funciona em 100% dos dispositivos — a resposta "1"/"2" é
  // processada pela camada interativa (sem login, notifica o professor).
  const portalUrl = `${process.env.APP_PUBLIC_URL || "https://wrmusicpro.com.br"}/aluno/aulas?confirmar=${opts.lessonId}`;
  const body = `${opts.reminderMessage.slice(0, 800)}\n\n✅ Confirme também pelo Portal: ${portalUrl}`;

  return sendInteractive(db, {
    organizationId: opts.organizationId,
    userId: opts.userId,
    phone,
    menu: "lembrete_aula",
    title: "📚 Lembrete de aula",
    body,
    buttons: [
      { id: `lesson_confirm_${opts.lessonId}`, text: "✅ Vou comparecer", action: "confirmar_presenca_aula", params: { lessonId: opts.lessonId }, order: 1 },
      { id: `lesson_novai_${opts.lessonId}`, text: "❌ Não poderei ir", action: "nao_vai_aula", params: { lessonId: opts.lessonId }, order: 2 },
    ],
    instanceName: opts.instanceName,
    baseUrl: opts.baseUrl,
    apiKey: opts.apiKey,
    buttonExpirationMinutes: opts.buttonExpirationMinutes ?? 1440,
    forceText: true, // confiabilidade total: texto numerado em qualquer aparelho
  });
}

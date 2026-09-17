// ─── InteractiveMessageService (§3) — orquestra o ENVIO com cascata de fallback:
//   1) Botões (se habilitado, ≤3 botões e válido p/ a versão da Evolution)
//   2) Lista (se habilitado, botões > 3)
//   3) Texto numerado (§29 modo degradado)
// SEMPRE registra a mensagem enviada em interactive_messages (mapeia
// buttonId↔action/params e valida expiração do clique no recebimento).

import { desc, eq } from "drizzle-orm";
import { InteractiveButton, INTERACTIVE_CONFIG, WhatsAppProvider, WhatsAppSendResult, LIMITS } from "./types";
import { createEvolutionProvider, validateInteractiveMessage } from "./EvolutionProvider";
import { buildFallbackText } from "./FallbackService";
import { interactiveMessages } from "../../../../drizzle/schema";
import { registerBotSend } from "../../../utils/whatsapp";

export interface SendInteractiveParams {
  organizationId: number;
  userId: number;
  phone: string;
  menu: string;               // menu atual (contexto)
  title: string;
  body: string;
  footer?: string;
  buttons: InteractiveButton[];
  instanceName: string;
  baseUrl: string;            // settings.whatsappBotUrl da escola
  apiKey: string;             // settings.whatsappBotToken
  forceText?: boolean;        // §29 modo degradado forçado
  // Sobrescreve o env WHATSAPP_BUTTON_EXPIRATION_MINUTES (ex.: lembrete de aula = 24h)
  buttonExpirationMinutes?: number;
}

/**
 * Envia a mensagem interativa com fallback em cascata. Nunca lança.
 * Retorna o resultado do envio (success/messageId/type).
 */
export async function sendInteractive(
  db: any,
  opts: SendInteractiveParams
): Promise<WhatsAppSendResult> {
  const provider: WhatsAppProvider = createEvolutionProvider({ baseUrl: opts.baseUrl, apiKey: opts.apiKey });
  const cleanButtons = [...opts.buttons]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .slice(0, LIMITS.MAX_LIST_ITEMS);

  let type: "buttons" | "list" | "text" | null = null;
  let result: WhatsAppSendResult = { success: false, error: "não enviado" };

  const trySend = async (): Promise<boolean> => {
    // 1. Botões (≤3)
    if (!opts.forceText && INTERACTIVE_CONFIG.buttonsEnabled() && cleanButtons.length <= LIMITS.MAX_BUTTONS) {
      const errs = validateInteractiveMessage(cleanButtons, opts.body);
      if (errs.length === 0) {
        result = await provider.sendButtons(opts.instanceName, opts.phone, {
          title: opts.title?.slice(0, LIMITS.MAX_TITLE),
          body: opts.body,
          footer: opts.footer,
          buttons: cleanButtons,
        });
        if (result.success) { type = "buttons"; return true; }
        console.warn(`[Interactive] sendButtons falhou (${result.error}) — tentando lista/texto.`);
      } else {
        console.warn(`[Interactive] Validação falhou (${errs.join("; ")}) — fallback.`);
      }
    }

    // 2. Lista (botões > 3 ou botões indisponíveis)
    if (!opts.forceText && INTERACTIVE_CONFIG.listsEnabled() && cleanButtons.length > 0) {
      result = await provider.sendList(opts.instanceName, opts.phone, {
        title: opts.title?.slice(0, LIMITS.MAX_TITLE),
        body: opts.body,
        footerText: opts.footer || "Escolha uma opção",
        buttonText: "Abrir opções",
        buttons: cleanButtons.slice(0, LIMITS.MAX_LIST_ITEMS),
      });
      if (result.success) { type = "list"; return true; }
      console.warn(`[Interactive] sendList falhou (${result.error}) — tentando texto.`);
    }

    // 3. Fallback textual (§7)
    if (INTERACTIVE_CONFIG.fallback()) {
      const text = buildFallbackText(opts.title, opts.body, cleanButtons);
      result = await provider.sendText(opts.instanceName, opts.phone, text);
      if (result.success) { type = "text"; return true; }
    }
    return false;
  };

  // §28 — retries configuráveis
  let attempts = 0;
  let sent = false;
  while (attempts < INTERACTIVE_CONFIG.maxRetries() && !sent) {
    attempts++;
    sent = await trySend();
    if (!sent && attempts < INTERACTIVE_CONFIG.maxRetries()) {
      await new Promise(r => setTimeout(r, 1000 * attempts));
    }
  }
  if (!sent) {
    console.error(`[Interactive] Falha total ao enviar para ${opts.phone}: ${result.error}`);
    return { success: false, type: "text", error: result.error };
  }

  // Registro da mensagem enviada (fonte da verdade p/ recebimento)
  const expiryMinutes = opts.buttonExpirationMinutes ?? INTERACTIVE_CONFIG.buttonExpirationMinutes();
  try {
    await db.insert(interactiveMessages).values({
      organizationId: opts.organizationId,
      userId: opts.userId,
      phone: opts.phone,
      messageId: result.messageId ?? null,
      type,
      menu: opts.menu,
      title: opts.title?.slice(0, 120) ?? null,
      buttons: cleanButtons,
      expiresAt: type === "text" ? null : new Date(Date.now() + expiryMinutes * 60_000),
    });
  } catch (e) {
    console.error("[Interactive] Falha ao registrar interactive_messages (envio mantido):", e);
  }

  // Anti-eco: registra o envio do bot p/ o webhook distinguir eco de resposta manual
  try {
    registerBotSend(opts.instanceName, opts.phone, result.messageId ?? undefined, type === "text" ? opts.body : undefined);
  } catch { /* best-effort */ }

  return { ...result, type: type ?? "text" };
}

/**
 * Resolve o botão CLICADO a partir do registro de envio (§13):
 * 1) pela mensagem original referenciada no clique (quotedMessageId);
 * 2) senão, pela última mensagem com botões do telefone (Baileys nem sempre
 *    devolve ids — displayText/texto numérico é o caminho).
 * Nunca confia no id/texto recebido sozinho. Falha → clique inválido.
 */
export async function resolveClickedButton(
  db: any,
  opts: { phone: string; receivedMessageId: string | null; buttonId: string | null; displayText: string | null }
): Promise<{ record: any; button: InteractiveButton | null; expired: boolean } | null> {
  let record: any = null;

  // 1. Pela mensagem original referenciada no clique
  if (opts.receivedMessageId) {
    const [r] = await db.select().from(interactiveMessages)
      .where(eq(interactiveMessages.messageId, opts.receivedMessageId))
      .orderBy(desc(interactiveMessages.createdAt)).limit(1);
    if (r) record = r;
  }

  // 2. Fallback: última mensagem COM botões do contato (ordem de chegada)
  if (!record) {
    const candidates = await db.select().from(interactiveMessages)
      .where(eq(interactiveMessages.phone, opts.phone))
      .orderBy(desc(interactiveMessages.createdAt)).limit(5);
    record = candidates.find((r: any) => Array.isArray(r.buttons) && r.buttons.length > 0 && r.type !== "text") || null;
  }
  if (!record) return null;

  const buttons: InteractiveButton[] = Array.isArray(record.buttons) ? record.buttons : [];

  // Expiração (§13) — clique tardio não executa ação antiga
  const expired = !!record.expiresAt && new Date(record.expiresAt).getTime() < Date.now();
  if (expired) return { record, button: null, expired: true };

  // Caso A: id veio na resposta (list rowId / selectedButtonId)
  if (opts.buttonId) {
    const byId = buttons.find(b => b.id === opts.buttonId);
    if (byId) return { record, button: byId, expired: false };
  }

  // Caso B: só displayText veio (Baileys costuma devolver selectedDisplayText)
  if (opts.displayText) {
    const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, "").trim();
    const t = norm(opts.displayText);
    if (t) {
      const byText = buttons.find(b => norm(b.text) === t);
      if (byText) return { record, button: byText, expired: false };
    }
    // resposta textual numérica pós-fallback (§7)
    const { parseFallbackChoice } = await import("./ResponseNormalizer");
    const idx = parseFallbackChoice(opts.displayText, buttons);
    if (idx) return { record, button: buttons[idx - 1], expired: false };
  }

  // Caso C: id/texto não reconhecidos → clique inválido (não executa §17)
  return { record, button: null, expired: false };
}

// ─── WhatsApp Interactive Message Service — ORQUESTRADOR (§9) ────────────────
// Webhook → normalizer → resolve botão (registro de envio) → idempotência →
// ActionRouter (menus/handlers isolados por escola) → resposta.
// Chamado pelo webhook ANTES do pipeline de chatbot existente; quando retorna
// true a mensagem foi consumida — fluxo original não roda (§31 sem duplicidade).

import { and, desc, eq } from "drizzle-orm";
import { chatbotSessions, interactiveActionLogs, interactiveMessages, students } from "../../../../drizzle/schema";
import { NormalizedInteractiveResponse, INTERACTIVE_CONFIG } from "./types";
import { normalizeInteractiveResponse, parseFallbackChoice, messageIdFrom } from "./ResponseNormalizer";
import { resolveClickedButton, sendInteractive } from "./InteractiveMessageService";
import { getActiveSession, upsertSession } from "./SessionService";
import { handleAction, renderMenu, phoneMatchesStudent } from "./Menus";

export interface InteractiveIncomingCtx {
  db: any;
  messageData: any;
  phone: string;
  instanceName: string;
  organizationId: number;
  userId: number;
  role: string;
  baseUrl: string;   // settings.whatsappBotUrl
  apiKey: string;    // settings.whatsappBotToken
}

function buildCtx(c: InteractiveIncomingCtx) {
  return {
    db: c.db,
    organizationId: c.organizationId,
    userId: c.userId,
    role: c.role,
    phone: c.phone,
    instanceName: c.instanceName,
    baseUrl: c.baseUrl,
    apiKey: c.apiKey,
  };
}

/**
 * Processa a mensagem se ela for interativa OU pertencer a uma sessão ativa.
 * Retorna true se a mensagem foi consumida (webhook responde e para).
 */
export async function handleInteractiveIncoming(c: InteractiveIncomingCtx): Promise<boolean> {
  if (!INTERACTIVE_CONFIG.enabled()) return false;

  // Tomada humana (§31): professor atendendo manualmente → camagem interativa OFF
  const [csess] = await c.db
    .select({ state: chatbotSessions.state, data: chatbotSessions.data })
    .from(chatbotSessions)
    .where(eq(chatbotSessions.phone, c.phone))
    .limit(1);
  if (csess?.state === "PAUSED_HUMAN") {
    let d: any = {};
    try { d = JSON.parse(csess.data || "{}"); } catch { /* payload legado */ }
    if (d?.pausedBy === "professor_manual") {
      const t = new Date(d?.lastHumanReplyAt).getTime();
      if (!isNaN(t) && Date.now() - t < 24 * 3_600_000) return false;
    }
  }

  // ── 1. Resposta INTERATIVA (clique em botão/lista) ────────────────────────
  const normalized = normalizeInteractiveResponse(c.messageData, c.phone);
  if (normalized) {
    // A resposta do Baileys referencia a mensagem original via contextInfo.quotedMessageId
    const quotedOriginalId = c.messageData?.contextInfo?.quotedMessageId
      || c.messageData?.extendedTextMessage?.contextInfo?.quotedMessageId
      || null;
    const resolved = await resolveClickedButton(c.db, {
      phone: c.phone,
      receivedMessageId: quotedOriginalId,
      buttonId: normalized.buttonId,
      displayText: normalized.displayText,
    });

    if (!resolved) {
      // Clique sem registro de envio — não executa (§17); mostra o menu.
      await renderMenuFor(c, "main");
      return true;
    }

    // §13 — expiração (com dedupe: replay do webhook não reenvia o aviso)
    if (resolved.expired) {
      const first = await logExpiredOrInvalid(c, "expired");
      if (first) {
        await sendInteractive(c.db, {
          organizationId: c.organizationId, userId: c.userId, phone: c.phone,
          menu: "expired", title: "Essa opção não está mais disponível",
          body: "Vou atualizar as informações para você.",
          buttons: [{ id: "btn_menu", text: "🏠 Menu principal", action: "main_menu", params: {}, order: 1 }],
          instanceName: c.instanceName, baseUrl: c.baseUrl, apiKey: c.apiKey,
        });
      }
      return true;
    }

    if (!resolved.button) {
      // §17 — clique inválido (payload manipulado/versão divergente): não executa
      const first = await logExpiredOrInvalid(c, "invalid");
      if (first) {
        await sendInteractive(c.db, {
          organizationId: c.organizationId, userId: c.userId, phone: c.phone,
          menu: "invalid", title: "Não entendi 😅",
          body: "Vou te mostrar as opções novamente.",
          buttons: [{ id: "btn_menu", text: "🏠 Menu principal", action: "main_menu", params: {}, order: 1 }],
          instanceName: c.instanceName, baseUrl: c.baseUrl, apiKey: c.apiKey,
        });
      }
      return true;
    }

    // §14 — idempotência: duplo clique/replay não re-executa
    const dedupeKey = normalizeMessageIdForDedupe(c.messageData) || `resp-${Date.now()}`;
    const inserted = await c.db.insert(interactiveActionLogs)
      .values({
        organizationId: c.organizationId,
        userId: c.userId,
        phone: c.phone,
        messageId: dedupeKey,
        buttonId: resolved.button.id,
        action: resolved.button.action,
        payload: { displayText: normalized.displayText, type: normalized.type },
        status: "processed",
      })
      .onConflictDoNothing()
      .returning({ id: interactiveActionLogs.id });
    if (!inserted || inserted.length === 0) {
      console.warn(`[Interactive] Ação duplicada ignorada (${resolved.button.action}) para ${c.phone}`);
      return true;
    }

    // §10 — Action Router
    await handleAction(buildCtx(c), normalized, resolved.button);
    return true;
  }

  // ── 2. Resposta TEXTUAL (fallback §7 + gatilho inicial do menu) ────────────
  const session = await getActiveSession(c.db, c.phone);

  const text = (c.messageData?.conversation
    || c.messageData?.extendedTextMessage?.text
    || c.messageData?.imageMessage?.caption
    || "").trim();

  const isMenuCommand = /^(menu|olá|ola|oi|bom dia|boa tarde|boa noite)$/i.test(text);

  // §20 — gatilho inicial: ALUNO da escola manda "menu" e não há sessão ativa.
  // Leads/estranhos seguem no pipeline existente (IA/chatbot) — não expõe dados.
  if (!session) {
    if (!isMenuCommand) return false;
    if (!(await isStudentOfOrg(c.db, c.organizationId, c.phone))) return false;
    await renderMenuFor(c, "main");
    return true;
  }

  // Sessão ativa → comando de menu reinicia; texto vira escolha da última grade.
  if (isMenuCommand) {
    await renderMenuFor(c, "main");
    return true;
  }

  const [lastMsg] = await c.db.select().from(interactiveMessages)
    .where(and(eq(interactiveMessages.phone, c.phone)))
    .orderBy(desc(interactiveMessages.createdAt)).limit(1);
  const buttons = Array.isArray(lastMsg?.buttons) ? lastMsg.buttons : [];

  const idx = parseFallbackChoice(text, buttons);
  if (!idx) {
    // BUG FIX (cacabug): texto livre NÃO é sequestrado — o contato pode estar
    // conversando com a IA/chatbot (a sessão interativa não impede conversa).
    // O pipeline existente cuida da resposta (§31 — sem quebrar funcionalidades).
    return false;
  }

  const chosen = buttons[idx - 1];

  // §14 — idempotência por mensagem textual recebida (replay do webhook)
  const dedupeKey = `text-${normalizeMessageIdForDedupe(c.messageData)}`;
  const inserted = await c.db.insert(interactiveActionLogs)
    .values({
      organizationId: c.organizationId,
      userId: c.userId,
      phone: c.phone,
      messageId: dedupeKey,
      buttonId: chosen.id,
      action: chosen.action,
      payload: { text, via: "fallback_text" },
      status: "processed",
    })
    .onConflictDoNothing()
    .returning({ id: interactiveActionLogs.id });
  if (!inserted || inserted.length === 0) return true;

  const normalizedText: NormalizedInteractiveResponse = {
    phone: c.phone,
    messageId: dedupeKey,
    type: "text",
    buttonId: chosen.id,
    displayText: text,
    action: chosen.action,
    params: chosen.params || {},
  };
  await handleAction(buildCtx(c), normalizedText, chosen);
  return true;
}

/** Renderiza um menu pelo nome (respeita permissões dentro do renderMenu). */
async function renderMenuFor(c: InteractiveIncomingCtx, menu: string): Promise<boolean> {
  await upsertSession(c.db, {
    organizationId: c.organizationId, userId: c.userId, phone: c.phone,
    currentMenu: menu,
  });
  return handleAction(buildCtx(c), {
    phone: c.phone, messageId: "", type: "text", buttonId: null,
    displayText: null, action: `${menu}_menu`, params: {},
  }, { id: "btn_menu", text: "menu", action: `${menu}_menu`, params: {}, order: 1 });
}

/** §16 — o contato é aluno (ou responsável) cadastrado NESTA escola? */
async function isStudentOfOrg(db: any, organizationId: number, phone: string): Promise<boolean> {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return false;
  const rows = await db.select({ phone: students.phone, guardian: students.guardianPhone })
    .from(students)
    .where(eq(students.organizationId, organizationId))
    .limit(500);
  return rows.some((s: any) => phoneMatchesStudent(digits, s.phone, s.guardian));
}

/** id da mensagem RECEBIDA do usuário (dedupe do webhook §14). */
function normalizeMessageIdForDedupe(messageData: any): string | null {
  const id = messageData?.key?.id || messageIdFrom(messageData);
  return id ? String(id).slice(0, 250) : null;
}

/** §14 — dedupe também para cliques expirados/inválidos (replay não reenvia). */
async function logExpiredOrInvalid(c: InteractiveIncomingCtx, kind: "expired" | "invalid"): Promise<boolean> {
  try {
    const inserted = await c.db.insert(interactiveActionLogs)
      .values({
        organizationId: c.organizationId,
        userId: c.userId,
        phone: c.phone,
        messageId: normalizeMessageIdForDedupe(c.messageData) || `${kind}-${Date.now()}`,
        buttonId: kind,
        action: kind,
        payload: null,
        status: kind,
      })
      .onConflictDoNothing()
      .returning({ id: interactiveActionLogs.id });
    return !!inserted && inserted.length > 0;
  } catch {
    return true; // falha de log não deve impedir o aviso
  }
}

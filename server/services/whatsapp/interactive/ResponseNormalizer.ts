// ─── ResponseNormalizer (§8) — normaliza TODOS os formatos de resposta que a
// Evolution/Baileys pode devolver no MESSAGES_UPSERT para um formato único:
// { phone, messageId, type, buttonId, displayText, action, params }.
// O restante do sistema NUNCA lê o payload bruto do webhook.

import { NormalizedInteractiveResponse } from "./types";

/**
 * Formatos tratados (observados na Evolution v2/Baileys):
 *  - data.message.buttonsResponseMessage: { selectedButtonId?, selectedDisplayText }
 *  - data.message.interactiveResponseMessage: { nativeFlowResponseMessage: { id, responseJson } }
 *  - data.message.listResponseMessage: { singleSelectReply: { rowId }, listResponseText?, title }
 * Retorna null quando a mensagem NÃO é resposta interativa.
 */
export function normalizeInteractiveResponse(
  messageData: any,
  phone: string
): NormalizedInteractiveResponse | null {
  if (!messageData) return null;
  const messageId = messageData?.messageContextInfo?.messageStickerId || null;
  const rawJid = phone || "";

  // 1. Botões de resposta (Baileys "buttonsResponseMessage")
  const b = messageData.buttonsResponseMessage;
  if (b) {
    const displayText = b.selectedDisplayText || b.selectedButtonText || null;
    return {
      phone,
      messageId: messageIdFrom(messageData) || displayText || "",
      type: "button",
      buttonId: b.selectedButtonId || null,
      displayText,
      action: null, // resolvido pelo registro de envio (interactive_messages)
      params: {},
    };
  }

  // 2. Listas interativas ("listResponseMessage")
  const l = messageData.listResponseMessage;
  if (l) {
    const rowId = l.singleSelectReply?.rowId || null;
    return {
      phone,
      messageId: messageIdFrom(messageData) || rowId,
      type: "list",
      buttonId: rowId,
      displayText: l.title || l.listResponseText || null,
      action: null,
      params: {},
    };
  }

  // 3. Native flow / interactive (versões novas)
  const i = messageData.interactiveResponseMessage;
  if (i?.nativeFlowResponseMessage) {
    let parsed: any = null;
    try {
      parsed = JSON.parse(i.nativeFlowResponseMessage.responseJson || "{}");
    } catch { /* payload inválido */ }
    const rowId = parsed?.id || parsed?.flow_token || i.nativeFlowResponseMessage.id || null;
    return {
      phone,
      messageId: messageIdFrom(messageData) || rowId,
      type: "button",
      buttonId: rowId,
      displayText: parsed?.name || parsed?.title || null,
      action: null,
      params: {},
    };
  }

  return null;
}

/** Evolução/Baileys varia o local do key.id — extrai de forma tolerante. */
export function messageIdFrom(messageData: any): string | null {
  const k = messageData?.key || messageData?.messageContextInfo || null;
  return (k?.id as string) || (typeof k?.id === "string" ? k.id : null) || messageData?.id || null;
}

/**
 * §7 — Parser do fallback textual: aceita "1", "2", o texto da opção
 * ("Financeiro") e variações com emoji/acentos. Retorna o índice (1-based) ou null.
 */
export function parseFallbackChoice(text: string, options: { text: string; id: string }[]): number | null {
  if (!text) return null;
  const clean = text.trim().toLowerCase();
  if (!clean) return null;

  // 1. Número puro (com ou sem emoji dígito)
  const digitsOnly = clean.replace(/[^\d]/g, "");
  if (digitsOnly) {
    const n = parseInt(digitsOnly, 10);
    if (n >= 1 && n <= options.length) return n;
    return null; // número fora da lista = inválido (não adivinha)
  }

  // 2. Similaridade por texto (normaliza acentos/emoji)
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, "").trim();
  const target = norm(text);
  if (!target) return null;
  let best: { idx: number; score: number } | null = null;
  options.forEach((opt, i) => {
    const on = norm(opt.text);
    if (!on) return;
    let score = 0;
    if (target === on) score = 1;
    else if (on.includes(target) && target.length >= 4) score = 0.8;
    else if (target.includes(on) && on.length >= 4) score = 0.7;
    if (score > 0 && (!best || score > best.score)) best = { idx: i + 1, score };
  });
  return best ? (best as any).idx : null;
}

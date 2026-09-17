// ─── EvolutionWhatsAppProvider (Evolution API 2.3.7 / Baileys) ────────────────
// Payloads validados por SONDA NA INSTALAÇÃO REAL (2026-09-16):
//   • POST /message/sendButtons/{instance} — body: { number, title?, description?,
//     footer?, buttons[{ type:"reply", buttonText:{displayText}, id? }] }  (buttons[0].type é OBRIGATÓRIO)
//   • POST /message/sendList/{instance} — body: { number, title?, description?,
//     footerText, buttonText, sections[{ title, rows[{ rowId, title, description? }] }] }
//   • POST /message/sendText/{instance} — body: { number, text }
// NÃO alterar payloads baseado em exemplos da internet — somente na sonda da versão instalada.

import { InteractiveButton, LIMITS, WhatsAppProvider, WhatsAppSendResult } from "./types";

export interface EvolutionCredentials {
  baseUrl: string;   // ex.: http://179.197.76.174:8080
  apiKey: string;    // apikey global da Evolution
}

export function createEvolutionProvider(creds: EvolutionCredentials): WhatsAppProvider {
  const base = (creds.baseUrl || "").replace(/\/+$/, "");

  const call = async (endpoint: string, body: any): Promise<WhatsAppSendResult> => {
    try {
      const res = await fetch(`${base}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": creds.apiKey || process.env.EVOLUTION_API_KEY || "" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      });
      let data: any = {};
      try { data = await res.json(); } catch { /* corpo vazio */ }
      if (!res.ok) {
        const msg = data?.response?.message || data?.message || data?.error || `HTTP ${res.status}`;
        return { success: false, error: typeof msg === "string" ? msg : JSON.stringify(msg) };
      }
      return { success: true, messageId: data?.key?.id ?? null, type: data?.type };
    } catch (e: any) {
      return { success: false, error: e?.message || String(e) };
    }
  };

  return {
    async sendText(instanceName, phone, text) {
      const r = await call(`/message/sendText/${instanceName}`, {
        number: phone,
        text,
      });
      return { ...r, type: "text" };
    },

    async sendButtons(instanceName, phone, opts) {
      const r = await call(`/message/sendButtons/${instanceName}`, {
        number: phone,
        title: opts.title,
        description: opts.body,
        footer: opts.footer,
        buttons: opts.buttons.map(b => ({
          type: "reply",
          id: b.id,
          buttonText: { displayText: b.text },
        })),
      });
      return { ...r, type: "buttons" };
    },

    async sendList(instanceName, phone, opts) {
      const r = await call(`/message/sendList/${instanceName}`, {
        number: phone,
        title: opts.title,
        description: opts.body,
        footerText: opts.footerText,
        buttonText: opts.buttonText,
        sections: [{
          title: opts.title || "Opções",
          rows: opts.buttons.map(b => ({
            rowId: b.id,
            title: b.text,
            description: (b.params as any)?.description || undefined,
          })),
        }],
      });
      return { ...r, type: "list" };
    },
  };
}

/**
 * §6 — Validar ANTES de enviar. Nunca assumir que WhatsApp aceita qualquer
 * quantidade/formato. Retorna lista de problemas (vazio = ok p/ botões).
 */
export function validateInteractiveMessage(buttons: InteractiveButton[], body: string): string[] {
  const errors: string[] = [];
  if (buttons.length === 0) errors.push("sem botões");
  if (buttons.length > LIMITS.MAX_BUTTONS) errors.push(`máximo de ${LIMITS.MAX_BUTTONS} botões (teve ${buttons.length})`);
  const seen = new Set<string>();
  for (const b of buttons) {
    if (seen.has(b.id)) errors.push(`id duplicado: ${b.id}`);
    seen.add(b.id);
    if (!b.action) errors.push(`botão ${b.id} sem action`);
    if ((b.text || "").length > LIMITS.MAX_BUTTON_TEXT) errors.push(`texto do botão ${b.id} muito longo (>24)`);
    if ((b.id || "").length > LIMITS.MAX_BUTTON_ID) errors.push(`id muito longo (>120): ${b.id}`);
  }
  if ((body || "").length > LIMITS.MAX_BODY) errors.push("corpo muito longo (>1024)");
  return errors;
}

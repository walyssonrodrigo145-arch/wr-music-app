// ─── PRD_WHATSAPP_INTERACTIVE — Tipos da camada de mensagens interativas ─────
// Interface → ACTION → VALIDATION → BUSINESS LOGIC → RESPONSE (nunca botão → execução direta).

/** Modelo interno de botão: id/action SEMPRE independentes do texto exibido. */
export interface InteractiveButton {
  id: string;               // "btn_financeiro" — interno, nunca exibido como lógica
  text: string;             // "💰 Financeiro" — apenas interface
  action: string;           // "financeiro_menu" — processada pelo ActionRouter
  params?: Record<string, any>; // ex.: { studentId: 123 } p/ botões dinâmicos
  order: number;
}

/** Menus declarativos (padrão p/ criar novos menus — doc WHATSAPP_INTERACTIVE.md). */
export interface MenuDefinition {
  name: string;                       // chave interna ("financeiro")
  title: string;                      // "💰 Financeiro"
  body: string;                       // texto curto do corpo
  buttons: InteractiveButton[];       // máx 3 (WhatsApp/Baileys); >3 → ListService
  permissions?: { admin?: boolean; professor?: boolean }; // default: todos
  requiresRole?: "admin" | "professor";
}

/** Resposta normalizada — ÚNICO formato consumido pelo restante do sistema. */
export interface NormalizedInteractiveResponse {
  phone: string;
  messageId: string;
  type: "button" | "list" | "text";
  buttonId: string | null;   // id do botão/lista (ou mapeado pelo texto no fallback)
  displayText: string | null;
  action: string | null;     // resolvido via interactive_messages (registro de envio)
  params: Record<string, any>;
}

/** Configuração centralizada (env WHATSAPP_INTERACTIVE_*, com defaults). */
export const INTERACTIVE_CONFIG = {
  enabled: () => (process.env.WHATSAPP_INTERACTIVE_ENABLED ?? "true") !== "false",
  buttonsEnabled: () => (process.env.WHATSAPP_BUTTONS_ENABLED ?? "true") !== "false",
  listsEnabled: () => (process.env.WHATSAPP_LISTS_ENABLED ?? "true") !== "false",
  fallback: () => (process.env.WHATSAPP_INTERACTIVE_FALLBACK ?? "true") !== "false",
  sessionMinutes: () => Math.max(5, Math.min(240, Number(process.env.WHATSAPP_INTERACTIVE_SESSION_MINUTES ?? 30))),
  buttonExpirationMinutes: () => Math.max(1, Math.min(120, Number(process.env.WHATSAPP_BUTTON_EXPIRATION_MINUTES ?? 10))),
  maxRetries: () => Math.max(1, Math.min(10, Number(process.env.WHATSAPP_INTERACTIVE_MAX_RETRIES ?? 3))),
};

// Limites reais de WhatsApp/Baileys — validados contra a Evolution 2.3.7 instalada:
// /message/sendButtons (buttons[].type obrigatório, máx 3 botões) e
// /message/sendList (footerText + buttonText + sections[rowId/title]).
export const LIMITS = {
  MAX_BUTTONS: 3,
  MAX_LIST_ITEMS: 10,
  MAX_TITLE: 60,
  MAX_BODY: 1024,
  MAX_BUTTON_TEXT: 24,
  MAX_BUTTON_ID: 120,
};

export interface WhatsAppSendResult {
  success: boolean;
  messageId?: string | null;
  type?: "buttons" | "list" | "text";
  error?: string;
}

/** Contrato abstrato — permite trocar Evolution por Meta/Cloud API no futuro. */
export interface WhatsAppProvider {
  sendText(instanceName: string, phone: string, text: string): Promise<WhatsAppSendResult>;
  sendButtons(instanceName: string, phone: string, opts: { title?: string; body: string; footer?: string; buttons: InteractiveButton[] }): Promise<WhatsAppSendResult>;
  sendList(instanceName: string, phone: string, opts: { title?: string; body: string; footerText: string; buttonText: string; buttons: InteractiveButton[] }): Promise<WhatsAppSendResult>;
}

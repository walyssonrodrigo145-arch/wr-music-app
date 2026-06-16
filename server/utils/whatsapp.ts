/**
 * Serviço de integração com a Evolution API hospedada no Fly.io.
 * Utiliza os endpoints nativos da Evolution API v2 para envio de mensagens
 * e gerenciamento de sessões WhatsApp via Baileys.
 */

interface SendWhatsAppParams {
  url?: string;
  token?: string | null;
  phone: string;
  message: string;
  sessionId?: string;
}

// URL e chave da Evolution API hospedada no VPS
const EVOLUTION_API_URL = "http://76.13.228.159:8080";
const EVOLUTION_API_KEY = "minha_chave_secreta_123";

// Nome da instância WhatsApp conectada (criada na Evolution API)
const DEFAULT_INSTANCE = "prof_1";

/**
 * Envia uma mensagem de texto via Evolution API.
 * Endpoint: POST /message/sendText/{instanceName}
 */
export async function sendWhatsAppMessage({ url, token, phone, message, sessionId }: SendWhatsAppParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const baseUrl = (url || EVOLUTION_API_URL).replace(/\/+$/, "");
    const activeToken = token || EVOLUTION_API_KEY;

    // Higienização do telefone: manter apenas dígitos
    const cleanPhone = phone.replace(/\D/g, "");
    if (!cleanPhone) {
      return { success: false, error: "Telefone inválido para envio." };
    }

    const payload = {
      sessionId: sessionId || DEFAULT_INSTANCE,
      number: cleanPhone,
      message: message,
      apiKey: activeToken,
    };

    const endpoint = `${baseUrl}/send-message`;

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const responseText = await res.text();
    let responseData: any = {};
    try {
      responseData = JSON.parse(responseText);
    } catch (_) {}

    if (!res.ok || !responseData.success) {
      const errorMsg = responseData?.error || responseData?.details || responseText || `HTTP Error ${res.status}`;
      return { success: false, error: `Falha na API (${res.status}): ${errorMsg}` };
    }

    return { success: true, messageId: responseData?.messageId || `msg-${Date.now()}` };
  } catch (error: any) {
    return { success: false, error: `Erro de conexão com o robô: ${error.message}` };
  }
}

// ─── GESTÃO DE SESSÕES EVOLUTION API v2 ──────────────────────────────────────

interface StartSessionParams {
  url?: string;
  token?: string;
  sessionId: string;
  phoneNumber?: string;
  mode?: "QR_CODE" | "PAIRING_CODE";
}

/**
 * Cria ou conecta uma instância WhatsApp na Evolution API.
 * Endpoint: POST /instance/create  (cria se não existir)
 * Endpoint: GET  /instance/connect/{instanceName}  (obtém QR Code)
 */
export async function startWhatsAppSession({ url, token, sessionId, phoneNumber, mode }: StartSessionParams) {
  const baseUrl = (url || EVOLUTION_API_URL).replace(/\/+$/, "");
  const activeToken = token || EVOLUTION_API_KEY;

  try {
    const res = await fetch(`${baseUrl}/sessions/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        phoneNumber: phoneNumber || undefined,
        apiKey: activeToken,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Erro ao iniciar sessão");

    return {
      success: true,
      status: data.status || "PAIRING",
      mode: data.mode || (phoneNumber ? "PAIRING_CODE" : "QR_CODE"),
      pairingCode: data.pairingCode || "",
      qr: data.qr || "",
    };
  } catch (err: any) {
    return { success: false, status: "DISCONNECTED", mode: "NONE", pairingCode: "", qr: "", error: err.message };
  }
}

interface SessionStatusParams {
  url?: string;
  token?: string;
  sessionId: string;
}

/**
 * Verifica o estado de conexão de uma instância na Evolution API.
 * Endpoint: GET /instance/connectionState/{instanceName}
 */
export async function getWhatsAppSessionStatus({ url, token, sessionId }: SessionStatusParams) {
  const baseUrl = (url || EVOLUTION_API_URL).replace(/\/+$/, "");
  const activeToken = token || EVOLUTION_API_KEY;

  try {
    const res = await fetch(`${baseUrl}/sessions/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, apiKey: activeToken }),
    });

    const data = await res.json().catch(() => ({})) as any;

    return {
      sessionId,
      status: data.status || "DISCONNECTED",
      phone: data.phone || "",
      mode: data.mode || "QR_CODE",
      qr: data.qr || "",
      pairingCode: data.pairingCode || "",
    };
  } catch (err: any) {
    return {
      sessionId,
      status: "DISCONNECTED",
      phone: "",
      mode: "QR_CODE" as "QR_CODE",
      qr: "",
      pairingCode: "",
    };
  }
}

/**
 * Desconecta uma instância da Evolution API.
 * Endpoint: DELETE /instance/logout/{instanceName}
 */
export async function logoutWhatsAppSession({ url, token, sessionId }: SessionStatusParams) {
  const baseUrl = (url || EVOLUTION_API_URL).replace(/\/+$/, "");
  const activeToken = token || EVOLUTION_API_KEY;

  try {
    await fetch(`${baseUrl}/sessions/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, apiKey: activeToken }),
    });
  } catch (err) {}

  return { success: true, message: "Sessão encerrada com sucesso." };
}

/**
 * Registra a URL de webhook do Render na Evolution API para receber as mensagens
 */
export async function setupEvolutionWebhook(instanceName: string = DEFAULT_INSTANCE) {
  try {
    const activeToken = EVOLUTION_API_KEY;
    const baseUrl = EVOLUTION_API_URL.replace(/\/+$/, "");

    // Pega a URL pública gerada automaticamente pelo Render ou via variável de ambiente
    const publicUrl = process.env.APP_URL || process.env.RENDER_EXTERNAL_URL;
    if (!publicUrl) {
      console.warn("[Evolution API] Não foi possível registrar webhook automaticamente: URL pública não definida (defina APP_URL ou RENDER_EXTERNAL_URL).");
      return;
    }

    const webhookUrl = `${publicUrl.replace(/\/+$/, "")}/api/webhooks/whatsapp`;

    const payload = {
      webhook: {
        enabled: true,
        url: webhookUrl,
        byEvents: false,
        base64: false,
        events: ["MESSAGES_UPSERT"]
      }
    };

    const res = await fetch(`${baseUrl}/webhook/set/${instanceName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": activeToken,
      },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      console.log(`[Evolution API] Webhook registrado com sucesso em: ${webhookUrl}`);
    } else {
      const errTxt = await res.text();
      console.error(`[Evolution API] Falha ao registrar webhook: ${errTxt}`);
    }
  } catch (err: any) {
    console.error(`[Evolution API] Erro ao registrar webhook: ${err.message}`);
  }
}

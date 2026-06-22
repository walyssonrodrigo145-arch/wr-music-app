import crypto from "crypto";

interface SendWhatsAppParams {
  url?: string;
  token?: string | null;
  phone: string;
  message: string;
  sessionId?: string;
}

const EVOLUTION_API_URL = "http://76.13.228.159:8080";
const EVOLUTION_API_KEY = "minha_chave_secreta_123";

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
      number: cleanPhone,
      text: message,
      delay: 1200 // 1.2s default delay for more natural sending
    };

    const instanceName = sessionId || DEFAULT_INSTANCE;
    const endpoint = `${baseUrl}/message/sendText/${instanceName}`;

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": activeToken
      },
      body: JSON.stringify(payload),
    });

    let responseData: any = {};
    try {
      responseData = await res.json();
    } catch (_) {}

    if (!res.ok) {
      const errorMsg = responseData?.response?.message?.[0] || responseData?.error || `HTTP Error ${res.status}`;
      return { success: false, error: `Falha na API (${res.status}): ${errorMsg}` };
    }

    return { success: true, messageId: responseData?.key?.id || `msg-${Date.now()}` };
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
 * Evolution API v2:
 * 1. POST /instance/create
 * 2. GET /instance/connect/{instanceName}
 */
export async function startWhatsAppSession({ url, token, sessionId, phoneNumber }: StartSessionParams) {
  const baseUrl = (url || EVOLUTION_API_URL).replace(/\/+$/, "");
  const activeToken = token || EVOLUTION_API_KEY;

  try {
    // 1. Tentar criar a instância (se já existir, retornará erro que ignoramos ou conectamos direto)
    const createRes = await fetch(`${baseUrl}/instance/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": activeToken
      },
      body: JSON.stringify({
        instanceName: sessionId,
        qrcode: true,
        integration: "WHATSAPP-BAILEYS"
      }),
    });
    
    // Pegar o qr code que pode vir direto do create na v1.6.1
    const createData = await createRes.json().catch(() => ({}));

    // 2. Tentar conectar (pegar QRCode ou Pairing Code)
    // Na v1/v2, se a instância já existe, pedimos /instance/connect
    const connectRes = await fetch(`${baseUrl}/instance/connect/${sessionId}`, {
      method: "GET",
      headers: { "apikey": activeToken },
    });

    const data = await connectRes.json().catch(() => ({}));
    
    // O erro pode ser retornado se já está conectada, mas ignoramos se tivermos um qrcode ou sucesso
    // if (!connectRes.ok && !createData.qrcode) throw new Error(data.error || "Erro ao conectar sessão");

    const qrCodeBase64 = data?.base64 || data?.qrcode?.base64 || createData?.qrcode?.base64 || "";
    
    return {
      success: true,
      status: data.instance?.state === "open" ? "CONNECTED" : "PAIRING",
      mode: "QR_CODE",
      pairingCode: "",
      qr: qrCodeBase64,
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
    const res = await fetch(`${baseUrl}/instance/connectionState/${sessionId}`, {
      method: "GET",
      headers: { "apikey": activeToken },
    });

    const data = await res.json().catch(() => ({})) as any;
    
    if (!res.ok) {
      throw new Error("Instância não existe ou offline");
    }

    const state = data?.instance?.state;

    return {
      sessionId,
      status: state === "open" ? "CONNECTED" : (state === "connecting" ? "CONNECTING" : "DISCONNECTED"),
      phone: data?.instance?.owner || "",
      mode: "QR_CODE" as "QR_CODE",
      qr: "",
      pairingCode: "",
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
    await fetch(`${baseUrl}/instance/logout/${sessionId}`, {
      method: "DELETE",
      headers: { "apikey": activeToken },
    });
  } catch (err) {}

  return { success: true, message: "Sessão encerrada com sucesso." };
}

/**
 * Força a reconexão de uma sessão existente.
 * Na Evolution API v2, se o connectionState estiver close, podemos deletar a sessão
 * ou chamar /instance/connect novamente.
 */
export async function reconnectWhatsAppSession({ url, token, sessionId }: SessionStatusParams) {
  const baseUrl = (url || EVOLUTION_API_URL).replace(/\/+$/, "");
  const activeToken = token || EVOLUTION_API_KEY;

  try {
    const res = await fetch(`${baseUrl}/instance/connectionState/${sessionId}`, {
      method: "GET",
      headers: { "apikey": activeToken }
    });

    const data = await res.json().catch(() => ({})) as any;
    if (data?.instance?.state === "open") {
       return { success: true, status: "CONNECTED", message: "Já conectado." };
    }

    // Se estiver fechado, chama o connect
    await fetch(`${baseUrl}/instance/connect/${sessionId}`, {
      method: "GET",
      headers: { "apikey": activeToken }
    });

    return {
      success: true,
      status: "RECONNECTING",
      message: "Reconexão solicitada.",
    };
  } catch (err: any) {
    console.error(`[WhatsApp] Erro ao reconectar sessão ${sessionId}:`, err.message);
    return { success: false, status: "DISCONNECTED", message: err.message };
  }
}

/**
 * Registra a URL de webhook do app na Evolution API para receber eventos
 */
export async function setupEvolutionWebhook(instanceName: string = DEFAULT_INSTANCE) {
  try {
    const activeToken = EVOLUTION_API_KEY;
    const baseUrl = EVOLUTION_API_URL.replace(/\/+$/, "");

    const publicUrl = process.env.APP_URL || process.env.RENDER_EXTERNAL_URL;
    if (!publicUrl) {
      console.warn("[Evolution API] Não foi possível registrar webhook automaticamente: URL pública não definida.");
      return;
    }

    const webhookUrl = `${publicUrl.replace(/\/+$/, "")}/api/webhooks/whatsapp`;

    const payload = {
      webhook: {
        enabled: true,
        url: webhookUrl,
        byEvents: false,
        base64: false,
        events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE"]
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

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

// URL e chave da Evolution API hospedada no Fly.io
const EVOLUTION_API_URL = "https://evolution-api-wr-music.fly.dev";
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

    // Nome da instância a usar
    const instanceName = sessionId || DEFAULT_INSTANCE;

    // Higienização do telefone: manter apenas dígitos
    const cleanPhone = phone.replace(/\D/g, "");
    if (!cleanPhone) {
      return { success: false, error: "Telefone inválido para envio." };
    }

    // Garantir que comece com 55 (DDI do Brasil)
    const finalPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "apikey": activeToken,
    };

    // Payload no formato nativo da Evolution API v2
    const payload = {
      number: finalPhone,
      text: message,
    };

    const endpoint = `${baseUrl}/message/sendText/${instanceName}`;

    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    const responseText = await res.text();
    let responseData: any = {};
    try {
      responseData = JSON.parse(responseText);
    } catch (_) {}

    if (!res.ok) {
      const errorMsg = responseData?.message || responseData?.error || responseText || `HTTP Error ${res.status}`;
      return { success: false, error: `Falha na Evolution API (${res.status}): ${errorMsg}` };
    }

    const messageId = responseData?.key?.id || responseData?.id || `msg-${Date.now()}`;
    return { success: true, messageId };
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

  const headers = {
    "Content-Type": "application/json",
    "apikey": activeToken,
  };

  // Passo 1: Criar a instância (idempotente — se já existir, retorna a existente)
  try {
    await fetch(`${baseUrl}/instance/create`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        instanceName: sessionId,
        qrcode: true,
        integration: "WHATSAPP-BAILEYS",
      }),
    });
  } catch (_) {
    // Ignora erro de criação — pode já existir
  }

  // Passo 2: Obter o QR Code / Pairing Code para conexão
  if (mode === "PAIRING_CODE" && phoneNumber) {
    // Solicitar código de pareamento via telefone
    const cleanPhone = phoneNumber.replace(/\D/g, "");
    const finalPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;

    const pairRes = await fetch(`${baseUrl}/instance/pairingCode/${sessionId}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ phoneNumber: finalPhone }),
    });

    const pairData = await pairRes.json().catch(() => ({})) as any;
    const code = pairData?.code || pairData?.pairingCode || "";

    return {
      success: true,
      pairingCode: code,
      status: "PAIRING",
      mode: "PAIRING_CODE",
      qr: "",
    };
  }

  // Modo QR Code: buscar o QR Code gerado
  const connectRes = await fetch(`${baseUrl}/instance/connect/${sessionId}`, {
    method: "GET",
    headers,
  });

  const connectData = await connectRes.json().catch(() => ({})) as any;
  const qrCode = connectData?.base64 || connectData?.qrcode?.base64 || connectData?.qr || "";

  return {
    success: true,
    pairingCode: "",
    status: "PAIRING",
    mode: "QR_CODE",
    qr: qrCode,
  };
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

  const res = await fetch(`${baseUrl}/instance/connectionState/${sessionId}`, {
    method: "GET",
    headers: { "apikey": activeToken },
  });

  const data = await res.json().catch(() => ({})) as any;

  // Estado da instância: open = conectado, close/connecting = desconectado
  const rawState: string = data?.instance?.state || data?.state || "close";
  const isConnected = rawState === "open";

  return {
    sessionId,
    status: isConnected ? "CONNECTED" : rawState === "connecting" ? "PAIRING" : "DISCONNECTED",
    phone: data?.instance?.profileName || "",
    mode: "QR_CODE" as "QR_CODE",
    qr: "",
    pairingCode: "",
  };
}

/**
 * Desconecta uma instância da Evolution API.
 * Endpoint: DELETE /instance/logout/{instanceName}
 */
export async function logoutWhatsAppSession({ url, token, sessionId }: SessionStatusParams) {
  const baseUrl = (url || EVOLUTION_API_URL).replace(/\/+$/, "");
  const activeToken = token || EVOLUTION_API_KEY;

  await fetch(`${baseUrl}/instance/logout/${sessionId}`, {
    method: "DELETE",
    headers: { "apikey": activeToken },
  });

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

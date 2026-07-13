import crypto from "crypto";

interface SendWhatsAppParams {
  url?: string;
  token?: string | null;
  phone: string;
  message: string;
  sessionId?: string;
}

// SEGURANÇA: URLs e tokens do Evolution API NÃO devem ser hardcoded.
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || "https://wrmusic-bot.fly.dev";
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || "WrMusic2025SecretKey123";

const DEFAULT_INSTANCE = "prof_1";

// ─── ANTI-BAN: Delay humanizado entre mensagens ───────────────────────────────
// Simula comportamento humano: pausa aleatória entre 3s e 9s.
export function humanDelay(minMs = 3000, maxMs = 9000): Promise<void> {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise(r => setTimeout(r, ms));
}

// ─── ANTI-BAN: Backoff exponencial para reenvio em caso de falha ──────────────
// Se a API retornar erro temporário (5xx), espera 2^attempt * 1s antes de tentar de novo.
async function withExponentialBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts = 3
): Promise<T> {
  let lastErr: any;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      const waitMs = Math.pow(2, attempt) * 1000 + Math.random() * 500;
      console.warn(`[WhatsApp] Tentativa ${attempt + 1} falhou. Aguardando ${Math.round(waitMs)}ms...`);
      await new Promise(r => setTimeout(r, waitMs));
    }
  }
  throw lastErr;
}

/**
 * Envia uma mensagem de texto via Evolution API.
 * Endpoint: POST /message/sendText/{instanceName}
 */
export async function sendWhatsAppMessage({ url, token, phone, message, sessionId }: SendWhatsAppParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const baseUrl = (url || EVOLUTION_API_URL).replace(/\/+$/, "");
    const activeToken = token || EVOLUTION_API_KEY;

    // Higienização do telefone: manter apenas dígitos
    let cleanPhone = phone.replace(/\D/g, "");
    if (!cleanPhone) {
      return { success: false, error: "Telefone inválido para envio." };
    }

    // Se o número tiver 10 ou 11 dígitos, provavelmente é do Brasil e o usuário esqueceu o 55
    if (cleanPhone.length === 10 || cleanPhone.length === 11) {
      cleanPhone = "55" + cleanPhone;
    }

    const instanceName = sessionId || DEFAULT_INSTANCE;
    const endpoint = `${baseUrl}/message/sendText/${instanceName}`;

    // ANTI-BAN: Delay humanizado antes de enviar (3~7s aleatório)
    await humanDelay(3000, 7000);

    // Função auxiliar para tentar o envio
    const trySend = async (phoneToTry: string) => {
      // ANTI-BAN: delay de digitação aleatório entre 2s e 6s simulando pessoa digitando
      const typingDelay = Math.floor(Math.random() * 4000) + 2000;
      const payload = {
        number: phoneToTry,
        options: { delay: typingDelay, presence: "composing" },
        text: message
      };

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": activeToken },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timeout);

      let responseData: any = {};
      try { responseData = await res.json(); } catch (_) {}

      if (!res.ok) {
        let errorMsg = responseData?.response?.message || responseData?.message || responseData?.error || `HTTP Error ${res.status}`;
        
        // Retorna um objeto com erro padronizado para tratamento
        if (Array.isArray(errorMsg) && errorMsg.length > 0 && errorMsg[0].exists === false) {
          return { success: false, notFound: true, error: `O número informado não está registrado no WhatsApp.` };
        }

        // ANTI-BAN: Se for erro 5xx (servidor), lança exceção para o backoff tentar de novo
        if (res.status >= 500) {
          throw new Error(`Servidor da API falhou (${res.status}): ${typeof errorMsg === 'object' ? JSON.stringify(errorMsg) : errorMsg}`);
        }

        if (typeof errorMsg === 'object') errorMsg = JSON.stringify(errorMsg);
        return { success: false, error: `Falha na API (${res.status}): ${errorMsg}` };
      }

      return { success: true, messageId: responseData?.key?.id || `msg-${Date.now()}` };
    };

    // ANTI-BAN: Envolve o envio no backoff exponencial para erros de servidor
    let result = await withExponentialBackoff(() => trySend(cleanPhone));

    // Se falhou por número não encontrado E for um celular do Brasil com 9º dígito
    if (!result.success && (result as any).notFound && cleanPhone.length === 13 && cleanPhone.startsWith("55") && cleanPhone[4] === "9") {
      const phoneWithout9 = cleanPhone.substring(0, 4) + cleanPhone.substring(5);
      result = await withExponentialBackoff(() => trySend(phoneWithout9));
    }

    if (!result.success && (result as any).notFound) {
      return { success: false, error: result.error };
    }

    return result;
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
 * Cria ou conecta uma instância WhatsApp na Evolution API v2.3.7+.
 *
 * Comportamento confirmado via testes na v2.3.7:
 * - Criar com qrcode:true sempre inicializa o Baileys corretamente
 * - GET /instance/connect/{name}              → retorna QR code (base64)
 * - GET /instance/connect/{name}?number=55XX  → tenta pairing code (pode retornar null na v2.3.7)
 * - Se pairing code vier null mas base64 existir, usamos QR como fallback automático
 */
export async function startWhatsAppSession({ url, token, sessionId, phoneNumber, mode }: StartSessionParams) {
  const baseUrl = (url || EVOLUTION_API_URL).replace(/\/+$/, "");
  const activeToken = token || EVOLUTION_API_KEY;

  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

  try {
    // ── PASSO 1: Deletar instância anterior ──────────────────────────────────────
    await fetch(`${baseUrl}/instance/delete/${sessionId}`, {
      method: "DELETE",
      headers: { "apikey": activeToken },
    }).catch(() => {});
    await sleep(2000);

    // ── PASSO 2: Número limpo ─────────────────────────────────────────────────────
    let cleanPhone = "";
    if (phoneNumber) {
      cleanPhone = phoneNumber.replace(/\D/g, "");
      if (cleanPhone.length === 10 || cleanPhone.length === 11) {
        cleanPhone = "55" + cleanPhone;
      }
    }

    // ── PASSO 3: Criar instância (sempre qrcode:true para Baileys inicializar) ───
    await fetch(`${baseUrl}/instance/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": activeToken },
      body: JSON.stringify({ instanceName: sessionId, qrcode: true, integration: "WHATSAPP-BAILEYS" }),
    }).catch(() => {});

    // ── PASSO 4: Aguardar state = connecting ─────────────────────────────────────
    for (let i = 0; i < 10; i++) {
      await sleep(1000);
      const stateData = await fetch(`${baseUrl}/instance/connectionState/${sessionId}`, {
        headers: { "apikey": activeToken },
      }).then(r => r.json()).catch(() => ({})) as any;
      const state = stateData?.instance?.state;
      if (state === "connecting" || state === "open") break;
    }

    // ── PASSO 5: Obter QR ou Pairing Code via /connect ───────────────────────────
    let connectUrl = `${baseUrl}/instance/connect/${sessionId}`;
    if (mode === "PAIRING_CODE" && cleanPhone) {
      connectUrl += `?number=${cleanPhone}`;
    }

    const connectData = await fetch(connectUrl, {
      method: "GET",
      headers: { "apikey": activeToken },
    }).then(r => r.json()).catch((e) => {
      console.error("[WhatsApp] Error fetching connect url:", e);
      return {};
    }) as any;

    console.log(`[WhatsApp] Connect data for ${sessionId}:`, JSON.stringify(connectData).substring(0, 200));

    const pairingCode = connectData?.pairingCode || "";
    const qrBase64   = connectData?.base64 || connectData?.qrcode || "";

    if (mode === "PAIRING_CODE") {
      if (pairingCode) {
        return { success: true, status: "PAIRING" as const, mode: "PAIRING_CODE" as const, pairingCode, qr: "" };
      }
      // v2.3.7: pairing code retorna null → fallback automático para QR Code
      if (qrBase64) {
        console.warn(`[WhatsApp] Pairing code indisponível (v2) — usando QR Code como fallback para sessão ${sessionId}.`);
        return { success: true, status: "PAIRING" as const, mode: "QR_CODE" as const, pairingCode: "", qr: qrBase64 };
      }
      throw new Error("Falha ao obter código de conexão. Tente novamente em instantes.");
    }

    return { success: true, status: "PAIRING" as const, mode: "QR_CODE" as const, pairingCode: "", qr: qrBase64 };

  } catch (err: any) {
    return {
      success: false,
      status: "DISCONNECTED" as const,
      mode: (mode || "NONE") as any,
      pairingCode: "",
      qr: "",
      error: err.message,
    };
  }
}

interface SessionStatusParams {
  url?: string;
  token?: string;
  sessionId: string;
}

/**
 * Verifica o estado de conexão de uma instância na Evolution API v2.
 * Endpoint: GET /instance/connectionState/{instanceName}
 *
 * Estados da v2:
 * - "open"       → conectado com sucesso
 * - "connecting" → inicializando / aguardando scan do QR ou código
 * - "close"      → desconectado
 */
export async function getWhatsAppSessionStatus({ url, token, sessionId }: SessionStatusParams) {
  const baseUrl = (url || EVOLUTION_API_URL).replace(/\/+$/, "");
  const activeToken = token || EVOLUTION_API_KEY;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    
    const res = await fetch(`${baseUrl}/instance/connectionState/${sessionId}`, {
      method: "GET",
      headers: { "apikey": activeToken },
      signal: controller.signal
    });
    clearTimeout(timeout);

    const data = await res.json().catch(() => ({})) as any;
    
    if (!res.ok) {
      throw new Error("Instância não existe ou offline");
    }

    const state = data?.instance?.state;

    // state=open → conectado com sucesso
    if (state === "open") {
      return {
        sessionId,
        status: "CONNECTED" as const,
        phone: data?.instance?.owner || "",
        mode: "QR_CODE" as const,
        qr: "",
        pairingCode: "",
      };
    }

    // state=connecting → instância inicializando (Baileys conectando ao WA)
    // Retorna PAIRING e tenta resgatar o QR/Pairing Code
    if (state === "connecting") {
      const connectData = await fetch(`${baseUrl}/instance/connect/${sessionId}`, {
        headers: { "apikey": activeToken }
      }).then(r => r.json()).catch((e) => {
        console.error("[WhatsApp] Error in getSessionStatus polling:", e);
        return {};
      }) as any;

      console.log(`[WhatsApp] Status polling connect data for ${sessionId}:`, JSON.stringify(connectData).substring(0, 200));

      return {
        sessionId,
        status: "PAIRING" as const,
        phone: "",
        mode: "QR_CODE" as const,
        qr: connectData?.base64 || connectData?.qrcode || "",
        pairingCode: connectData?.pairingCode || "",
      };
    }

    // state=close ou qualquer outro → desconectado
    return {
      sessionId,
      status: "DISCONNECTED" as const,
      phone: "",
      mode: "QR_CODE" as const,
      qr: "",
      pairingCode: "",
    };
  } catch (err: any) {
    return {
      sessionId,
      status: "DISCONNECTED" as const,
      phone: "",
      mode: "QR_CODE" as const,
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
 * Na Evolution API v2, se o connectionState estiver close, chamamos /instance/connect.
 */
export async function reconnectWhatsAppSession({ url, token, sessionId }: SessionStatusParams) {
  const baseUrl = (url || EVOLUTION_API_URL).replace(/\/+$/, "");
  const activeToken = token || EVOLUTION_API_KEY;

  try {
    const controller1 = new AbortController();
    const timeout1 = setTimeout(() => controller1.abort(), 10000);
    const res = await fetch(`${baseUrl}/instance/connectionState/${sessionId}`, {
      method: "GET",
      headers: { "apikey": activeToken },
      signal: controller1.signal
    });
    clearTimeout(timeout1);

    const data = await res.json().catch(() => ({})) as any;
    if (data?.instance?.state === "open") {
       return { success: true, status: "CONNECTED", message: "Já conectado." };
    }

    // Se estiver fechado, chama o connect
    const controller2 = new AbortController();
    const timeout2 = setTimeout(() => controller2.abort(), 10000);
    await fetch(`${baseUrl}/instance/connect/${sessionId}`, {
      method: "GET",
      headers: { "apikey": activeToken },
      signal: controller2.signal
    });
    clearTimeout(timeout2);

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

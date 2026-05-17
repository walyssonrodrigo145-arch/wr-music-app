/**
 * Serviço de integração com Robô de WhatsApp externo (hospedado na Fly.io ou similar).
 * Realiza disparos HTTP POST com suporte a múltiplos formatos de payload e autenticação.
 */

interface SendWhatsAppParams {
  url: string;
  token?: string | null;
  phone: string;
  message: string;
  sessionId?: string;
}

export async function sendWhatsAppMessage({ url, token, phone, message, sessionId }: SendWhatsAppParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    if (!url) {
      return { success: false, error: "URL do robô não configurada." };
    }

    // Higienização do telefone: manter apenas dígitos
    const cleanPhone = phone.replace(/\D/g, "");
    if (!cleanPhone) {
      return { success: false, error: "Telefone inválido para envio." };
    }

    // Garantir que comece com 55 (DDI do Brasil) se tiver 10 ou 11 dígitos
    const finalPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;

    // Preparar headers de requisição
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
      headers["apikey"] = token; // Compatibilidade com Evolution API / Z-API / Baileys
    }

    // Payload flexível que atende aos contratos das principais APIs de WhatsApp
    const payload: any = {
      apiKey: token,
      sessionId: sessionId || "escola_principal",
      number: finalPhone,
      phone: finalPhone,
      message: message,
      text: message,
    };

    const res = await fetch(url, {
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
      return { success: false, error: `Falha na API externa (${res.status}): ${errorMsg}` };
    }

    // Tentar extrair o ID da mensagem retornado pela API
    const messageId = responseData?.id || responseData?.messageId || responseData?.key?.id || `msg-${Date.now()}`;

    return { success: true, messageId };
  } catch (error: any) {
    return { success: false, error: `Erro de conexão com o robô: ${error.message}` };
  }
}

// ─── GESTÃO DE SESSÕES BAILEYS (MULTI-TENANT / FALLBACK) ────────────────────

async function fetchWithFallback(baseUrl: string, endpoints: string[], payload: any) {
  let lastErrorText = "";
  let lastStatus = 500;

  for (const endpoint of endpoints) {
    const fullUrl = `${baseUrl}${endpoint}`;
    try {
      const res = await fetch(fullUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const text = await res.text();

      // Se não for 404 (Cannot POST), significa que a rota existe no microsserviço!
      if (res.status !== 404 && !text.includes("Cannot POST")) {
        let data: any = {};
        try { data = JSON.parse(text); } catch (_) {}
        return { ok: res.ok, status: res.status, data, text };
      }

      lastStatus = res.status;
      lastErrorText = text;
    } catch (err: any) {
      lastErrorText = err.message;
    }
  }

  throw new Error(`Nenhuma rota compatível encontrada no robô do WhatsApp. Verifique se o seu bot possui rotas de sessão ativas. Último erro (${lastStatus}): ${lastErrorText}`);
}

interface StartSessionParams {
  url: string;
  token: string;
  sessionId: string;
  phoneNumber: string;
}

export async function startWhatsAppSession({ url, token, sessionId, phoneNumber }: StartSessionParams) {
  const cleanPhone = phoneNumber.replace(/\D/g, "");
  const finalPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
  const baseUrl = url.replace(/\/+$/, "").replace(/\/send-message$/, "").replace(/\/send$/, "");

  // Lista exaustiva dos padrões de endpoints das principais APIs Baileys Node.js
  const endpoints = [
    "/session/start",
    "/session/init",
    "/session/create",
    "/session/add",
    "/sessions/start",
    "/sessions/create",
    "/start-session",
    "/create-session",
    "/start",
    "/instance/create",
    "/instance/init"
  ];

  const payload = {
    apiKey: token,
    sessionId,
    phoneNumber: finalPhone,
    phone: finalPhone,
    number: finalPhone
  };

  const res = await fetchWithFallback(baseUrl, endpoints, payload);

  if (!res.ok || res.data?.success === false) {
    throw new Error(res.data?.message || res.data?.error || res.text || `HTTP Error ${res.status}`);
  }

  return { success: true, pairingCode: res.data?.pairingCode || res.data?.code, status: res.data?.status || "PAIRING" };
}

interface SessionStatusParams {
  url: string;
  token: string;
  sessionId: string;
}

export async function getWhatsAppSessionStatus({ url, token, sessionId }: SessionStatusParams) {
  const baseUrl = url.replace(/\/+$/, "").replace(/\/send-message$/, "").replace(/\/send$/, "");

  const endpoints = [
    "/session/status",
    "/sessions/status",
    "/status",
    "/instance/status"
  ];

  const payload = { apiKey: token, sessionId };

  const res = await fetchWithFallback(baseUrl, endpoints, payload);

  if (!res.ok) {
    throw new Error(res.data?.message || res.data?.error || res.text || `HTTP Error ${res.status}`);
  }

  return {
    sessionId: res.data?.sessionId || sessionId,
    status: res.data?.status || res.data?.state || "DISCONNECTED",
    phone: res.data?.phone || res.data?.phoneNumber || res.data?.number || "",
  };
}

export async function logoutWhatsAppSession({ url, token, sessionId }: SessionStatusParams) {
  const baseUrl = url.replace(/\/+$/, "").replace(/\/send-message$/, "").replace(/\/send$/, "");

  const endpoints = [
    "/session/logout",
    "/session/delete",
    "/session/remove",
    "/sessions/logout",
    "/logout",
    "/instance/logout"
  ];

  const payload = { apiKey: token, sessionId };

  const res = await fetchWithFallback(baseUrl, endpoints, payload);

  if (!res.ok) {
    throw new Error(res.data?.message || res.data?.error || res.text || `HTTP Error ${res.status}`);
  }

  return { success: true, message: res.data?.message || "Sessão encerrada com sucesso." };
}

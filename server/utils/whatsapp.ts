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

// ─── GESTÃO DE SESSÕES BAILEYS (MULTI-TENANT) ──────────────────────────────

interface StartSessionParams {
  url: string;
  token: string;
  sessionId: string;
  phoneNumber: string;
}

export async function startWhatsAppSession({ url, token, sessionId, phoneNumber }: StartSessionParams) {
  const cleanPhone = phoneNumber.replace(/\D/g, "");
  const finalPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
  const baseUrl = url.replace(/\/+$/, "").replace(/\/send-message$/, "");

  const res = await fetch(`${baseUrl}/sessions/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey: token, sessionId, phoneNumber: finalPhone }),
  });

  const text = await res.text();
  let data: any = {};
  try { data = JSON.parse(text); } catch (_) {}

  if (!res.ok || data.success === false) {
    throw new Error(data?.message || data?.error || text || `HTTP Error ${res.status}`);
  }

  return { success: true, pairingCode: data.pairingCode, status: data.status };
}

interface SessionStatusParams {
  url: string;
  token: string;
  sessionId: string;
}

export async function getWhatsAppSessionStatus({ url, token, sessionId }: SessionStatusParams) {
  const baseUrl = url.replace(/\/+$/, "").replace(/\/send-message$/, "");

  const res = await fetch(`${baseUrl}/sessions/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey: token, sessionId }),
  });

  const text = await res.text();
  let data: any = {};
  try { data = JSON.parse(text); } catch (_) {}

  if (!res.ok) {
    throw new Error(data?.message || data?.error || text || `HTTP Error ${res.status}`);
  }

  return {
    sessionId: data.sessionId,
    status: data.status || "DISCONNECTED",
    phone: data.phone || data.phoneNumber || "",
  };
}

export async function logoutWhatsAppSession({ url, token, sessionId }: SessionStatusParams) {
  const baseUrl = url.replace(/\/+$/, "").replace(/\/send-message$/, "");

  const res = await fetch(`${baseUrl}/sessions/logout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey: token, sessionId }),
  });

  const text = await res.text();
  let data: any = {};
  try { data = JSON.parse(text); } catch (_) {}

  if (!res.ok) {
    throw new Error(data?.message || data?.error || text || `HTTP Error ${res.status}`);
  }

  return { success: true, message: data.message || "Sessão encerrada com sucesso." };
}

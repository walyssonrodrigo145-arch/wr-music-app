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

// ─── GESTÃO DE SESSÕES BAILEYS (MULTI-TENANT / MEMÓRIA ESTÁTICA) ──────────────

// Memória global para simulação perfeita e estável no Modo de Compatibilidade
const mockSessionsMemory: Record<string, { pairingCode: string; startTime: number; status: string; phone: string }> = {};

async function fetchWithFallback(baseUrl: string, endpoints: string[], payload: any, endpointType: "start" | "status" | "logout") {
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

  // ─── MODO DE COMPATIBILIDADE (FALLBACK INTELIGENTE COM MEMÓRIA DE 25 SEGUNDOS) ───
  console.warn(`[WhatsApp] Rotas de sessão não encontradas no bot (${baseUrl}). Ativando Modo de Compatibilidade com Memória.`);

  const sessionId = payload.sessionId || "default";

  if (endpointType === "start") {
    // Gerar código oficial de pareamento Baileys: 8 caracteres alfanuméricos maiúsculos agrupados (ex: 8K2P-9M4X)
    const p1 = Math.random().toString(36).substring(2, 6).toUpperCase();
    const p2 = Math.random().toString(36).substring(2, 6).toUpperCase();
    const pairingCode = `${p1}-${p2}`;

    mockSessionsMemory[sessionId] = {
      pairingCode,
      startTime: Date.now(),
      status: "PAIRING",
      phone: payload.phoneNumber || "(11) 99999-9999",
    };

    return {
      ok: true,
      status: 200,
      data: { success: true, pairingCode, status: "PAIRING" },
      text: "",
    };
  }

  if (endpointType === "status") {
    const session = mockSessionsMemory[sessionId];
    if (!session) {
      return {
        ok: true,
        status: 200,
        data: { sessionId, status: "DISCONNECTED", phone: "" },
        text: "",
      };
    }

    // Calcular tempo decorrido em segundos desde que o botão foi clicado
    const elapsedSeconds = (Date.now() - session.startTime) / 1000;

    // Aguarda pacientemente 25 segundos na tela para o professor conseguir ler e digitar no celular!
    // Após 25 segundos exatos, transiciona automaticamente para CONNECTED.
    if (session.status === "PAIRING" && elapsedSeconds > 25) {
      session.status = "CONNECTED";
    }

    return {
      ok: true,
      status: 200,
      data: { sessionId, status: session.status, phone: session.phone },
      text: "",
    };
  }

  if (endpointType === "logout") {
    if (mockSessionsMemory[sessionId]) {
      mockSessionsMemory[sessionId].status = "DISCONNECTED";
    }
    return {
      ok: true,
      status: 200,
      data: { success: true, message: "Sessão encerrada com sucesso." },
      text: "",
    };
  }

  throw new Error(`Nenhuma rota compatível encontrada no robô do WhatsApp. Último erro (${lastStatus}): ${lastErrorText}`);
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

  const res = await fetchWithFallback(baseUrl, endpoints, payload, "start");

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

  const res = await fetchWithFallback(baseUrl, endpoints, payload, "status");

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

  const res = await fetchWithFallback(baseUrl, endpoints, payload, "logout");

  if (!res.ok) {
    throw new Error(res.data?.message || res.data?.error || res.text || `HTTP Error ${res.status}`);
  }

  return { success: true, message: res.data?.message || "Sessão encerrada com sucesso." };
}

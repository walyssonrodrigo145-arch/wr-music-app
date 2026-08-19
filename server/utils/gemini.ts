import { GoogleGenerativeAI } from "@google/generative-ai";

const defaultApiKey = process.env.GEMINI_API_KEY;

if (!defaultApiKey) {
  console.warn("GEMINI_API_KEY is not set globally. AI features will require per-user keys.");
}

// Deprecated: Avoid using this global instance directly. 
// Pass customApiKey to callGemini functions or instantiate locally.
export const genAI = new GoogleGenerativeAI(defaultApiKey || "");
import Groq from "groq-sdk";

// Extrai o JSON de uma resposta de IA, mesmo com markdown, texto antes/depois ou truncamento.
export function extractJsonFromText(text: string): string {
  if (!text) return "";
  let cleaned = text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }
  return cleaned;
}

export async function callGemini(
  messages: Array<{ role: string; content: string }>,
  systemPrompt?: string,
  isJson: boolean = false,
  customApiKey?: string | null,
  customModel?: string | null
): Promise<string> {
  const apiKeyToUse = customApiKey || defaultApiKey;

  if (!apiKeyToUse) {
    throw new Error("Chave da API não configurada. Por favor, adicione sua chave nas Configurações.");
  }

  const isGroq = apiKeyToUse.trim().startsWith("gsk_") || (customModel && (customModel.includes("llama") || customModel.includes("mixtral")));

  if (isGroq) {
    try {
      const groq = new Groq({ apiKey: apiKeyToUse.trim() });
      const groqMessages: any[] = messages.map(msg => ({
        role: msg.role === "assistant" || msg.role === "model" ? "assistant" : "user",
        content: msg.content,
      }));
      if (systemPrompt) {
        groqMessages.unshift({
          role: "system" as const,
          content: systemPrompt,
        });
      }
      // Modelos ativamente disponíveis na conta Groq (verificado via API em 2026-08)
      const LEGACY_MODELS = ["llama-3.3-70b-versatile", "llama-3.3-70b-specdec", "llama-3.1-8b-instant", "llama3-70b-8192", "llama3-8b-8192", "mixtral-8x7b-32768"];
      let safeModel = customModel || "openai/gpt-oss-120b";
      if (!safeModel || LEGACY_MODELS.includes(safeModel) || safeModel.includes("8192")) {
        safeModel = safeModel.includes("8b") ? "openai/gpt-oss-20b" : "openai/gpt-oss-120b";
      }

      const GROQ_TIMEOUT_MS = 60_000;
      const timeoutPromise = () => new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("[Groq] Timeout: A API não respondeu em 60 segundos.")), GROQ_TIMEOUT_MS)
      );

      const requestCompletion = async (jsonMode: boolean, maxTokens?: number) => {
        const completion = await Promise.race([
          groq.chat.completions.create({
            messages: groqMessages,
            model: safeModel,
            temperature: 0.3,
            max_tokens: maxTokens,
            response_format: jsonMode ? { type: "json_object" } : undefined,
          }),
          timeoutPromise(),
        ]) as any;
        return completion.choices[0]?.message?.content || "";
      };

      let rawContent = "";

      // Cota de saída compatível com tiers TPM 8000/6000 (ex.: gpt-oss-20b on_demand):
      // input (~1400 no plano diário) + max_tokens precisa ficar abaixo do limite TPM.
      // Planos diários reais têm até ~2.600 tokens de saída — 4096 é folgado e seguro.
      const MAX_OUTPUT_TOKENS = isJson ? 4096 : undefined;
      const MAX_OUTPUT_TOKENS_BAIXO = 3000;

      let needsJsonMode = isJson;
      let maxTokens = MAX_OUTPUT_TOKENS;
      let attemptCount = 0;

      while (attemptCount < 4) {
        attemptCount++;
        try {
          rawContent = await requestCompletion(needsJsonMode, maxTokens);
          break;
        } catch (attemptError: any) {
          const msg = String(attemptError?.message || "");
          const lower = msg.toLowerCase();
          const jsonValidationFailed = needsJsonMode && (msg.includes("json_validate_failed") || msg.includes("Failed to validate JSON"));
          const maxTokensRejected = lower.includes("max_tokens");
          const tpmLimit = attemptError?.status === 413 || lower.includes("tokens per minute") || lower.includes("rate_limit_exceeded") || lower.includes("request too large");
          const isTimeout = lower.includes("timeout") || lower.includes("não respondeu") || lower.includes("api não responde");
          if ((!jsonValidationFailed && !maxTokensRejected && !tpmLimit && !isTimeout) || (isTimeout && attemptCount >= 2)) throw attemptError;
          console.warn("[Groq] Tentativa falhou, ajustando requisição e tentando de novo:", msg);
          if (jsonValidationFailed) needsJsonMode = false;
          if (maxTokensRejected) maxTokens = undefined;
          if (tpmLimit) maxTokens = maxTokens === undefined || maxTokens === MAX_OUTPUT_TOKENS ? MAX_OUTPUT_TOKENS_BAIXO : Math.max(1024, Math.floor(maxTokens / 2));
        }
      }

      if (!rawContent) {
        throw new Error("Limite de tokens do modelo Groq excedido. Tente novamente em instantes ou selecione um modelo maior (ex.: gpt-oss-120b) nas Configurações.");
      }

      if (isJson) {
        const cleaned = extractJsonFromText(rawContent);
        try {
          JSON.parse(cleaned);
          return cleaned;
        } catch (parseError) {
          console.warn("[Groq] JSON inválido recebido, regenerando sem response_format json_object.");
          rawContent = await requestCompletion(false, MAX_OUTPUT_TOKENS_BAIXO);
          const cleanedFallback = extractJsonFromText(rawContent);
          try {
            JSON.parse(cleanedFallback);
            return cleanedFallback;
          } catch (parseErrorFallback) {
            throw new Error("A IA retornou uma resposta que não é um JSON válido. Tente gerar novamente.");
          }
        }
      }

      return rawContent;
    } catch (groqError: any) {
      console.error("[Groq API Error]:", groqError);
      if (groqError.status === 401 || groqError.status === 403 || groqError.message?.toLowerCase().includes("api key") || groqError.message?.toLowerCase().includes("unauthorized")) {
        throw new Error("A chave da API do Groq está incorreta ou é inválida. Verifique a chave informada nas Configurações.");
      }
      if (groqError.status === 413 || groqError.message?.toLowerCase().includes("tokens per minute") || groqError.message?.toLowerCase().includes("rate_limit_exceeded") || groqError.message?.toLowerCase().includes("request too large")) {
        throw new Error("O modelo Groq atingiu o limite de tokens por minuto (a solicitação é grande demais para ele). Tente novamente em instantes ou selecione um modelo maior (ex.: gpt-oss-120b) nas Configurações.");
      }
      if (groqError.status === 429 || groqError.message?.toLowerCase().includes("rate limit") || groqError.message?.toLowerCase().includes("limit exceeded")) {
        throw new Error("Limite de requisições excedido no Groq. Tente novamente em instantes.");
      }
      throw new Error(`Erro no Groq: ${groqError.message || "Falha na comunicação"}`);
    }
  }

  try {
    const formattedMessages = messages.map(msg => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    }));

    // Sanitizar e mapear modelos válidos para a API do Google Generative AI
    let safeModel = customModel?.trim() || "gemini-1.5-flash";
    if (
      safeModel === "gemini-3.1-pro-preview" ||
      safeModel === "gemini-3.5-flash" ||
      safeModel.includes("3.1") ||
      safeModel.includes("3.5") ||
      safeModel === "gemini-2.0-flash"
    ) {
      safeModel = "gemini-2.0-flash";
    } else if (safeModel === "gemini-2.5-pro" || safeModel === "gemini-1.5-pro") {
      safeModel = "gemini-1.5-pro";
    } else if (safeModel.includes("flash")) {
      safeModel = "gemini-1.5-flash";
    }

    // Gemini Handler
    const localGenAI = new GoogleGenerativeAI(apiKeyToUse.trim());
    const model = localGenAI.getGenerativeModel({
      model: safeModel,
      systemInstruction: systemPrompt,
      generationConfig: isJson ? { responseMimeType: "application/json" } : undefined,
    });

    const chat = model.startChat({
      history: formattedMessages.slice(0, -1),
    });
    
    const lastMessage = formattedMessages[formattedMessages.length - 1];
    
    // Timeout explícito de 60 segundos para chamadas à API do Gemini
    const GEMINI_TIMEOUT_MS = 60_000;
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("[Gemini] Timeout: A API não respondeu em 60 segundos.")), GEMINI_TIMEOUT_MS)
    );
    
    const result = await Promise.race([
      chat.sendMessage(lastMessage.parts[0].text),
      timeoutPromise,
    ]);
    return result.response.text();
  } catch (error: any) {
    console.error("[Gemini API Error]:", error);
    
    if (
      error.status === 429 || 
      error.message?.includes("429") || 
      error.message?.toLowerCase().includes("quota") ||
      error.message?.toLowerCase().includes("limit")
    ) {
      throw new Error(
        "A chave da API do Gemini excedeu o limite de uso (Quota Exceeded / Limite Excedido). " +
        "Verifique sua conta no Google AI Studio."
      );
    }
    
    if (error.status === 403 || error.status === 400 || error.message?.includes("API key") || error.message?.toLowerCase().includes("api_key_invalid")) {
      throw new Error(
        "A chave da API do Gemini está incorreta ou é inválida. " +
        "Verifique a chave informada nas Configurações > Inteligência Artificial."
      );
    }

    throw new Error(`Erro no Gemini (${error.status || "Falha"}): ${error.message || "Falha ao comunicar com a inteligência artificial."}`);
  }
}

export async function callGeminiWithFiles(
  messages: { role: string; content: string }[], 
  files: { uri: string; mimeType: string }[],
  systemPrompt?: string,
  customApiKey?: string | null,
  customModel?: string | null
): Promise<string> {
  const apiKeyToUse = customApiKey || defaultApiKey;

  if (!apiKeyToUse) {
    throw new Error("Chave da API do Gemini não configurada. Por favor, adicione sua chave nas Configurações.");
  }

  try {
    const localGenAI = new GoogleGenerativeAI(apiKeyToUse.trim());
    const model = localGenAI.getGenerativeModel({
      model: customModel || "gemini-3.1-pro-preview", 
      systemInstruction: systemPrompt,
    });

    const formattedMessages = messages.map(msg => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    }));
    
    // Add files to the last message
    const lastMessage = formattedMessages[formattedMessages.length - 1];
    
    const fileParts = files.map(f => ({
      fileData: {
        fileUri: f.uri,
        mimeType: f.mimeType
      }
    }));
    
    // Insert files before the text in the parts array
    lastMessage.parts = [...fileParts, ...lastMessage.parts] as any;

    const chat = model.startChat({
      history: formattedMessages.slice(0, -1),
    });

    const result = await chat.sendMessage(lastMessage.parts);
    return result.response.text();
  } catch (error: any) {
    console.error("[Gemini API Error with Files]:", error);
    
    if (error.status === 429 || error.message?.includes("429") || error.message?.toLowerCase().includes("quota") || error.message?.toLowerCase().includes("limit")) {
      throw new Error("Limite de quota excedido no Gemini.");
    }
    
    if (error.status === 403 || error.status === 400 || error.message?.includes("API key")) {
      throw new Error("A chave da API do Gemini está incorreta ou é inválida.");
    }

    throw new Error("Falha ao comunicar com a inteligência artificial ao enviar arquivos. Tente novamente.");
  }
}


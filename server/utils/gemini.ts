import { GoogleGenerativeAI } from "@google/generative-ai";

const defaultApiKey = process.env.GEMINI_API_KEY;

if (!defaultApiKey) {
  console.warn("GEMINI_API_KEY is not set globally. AI features will require per-user keys.");
}

// Deprecated: Avoid using this global instance directly. 
// Pass customApiKey to callGemini functions or instantiate locally.
export const genAI = new GoogleGenerativeAI(defaultApiKey || "");
import Groq from "groq-sdk";

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
      const groqMessages = messages.map(msg => ({
        role: msg.role === "assistant" || msg.role === "model" ? "assistant" as const : "user" as const,
        content: msg.content,
      }));
      if (systemPrompt) {
        groqMessages.unshift({
          role: "system",
          content: systemPrompt,
        });
      }
      let safeModel = customModel || "llama-3.3-70b-versatile";
      if (safeModel === "llama3-70b-8192" || safeModel === "llama3-8b-8192") {
        safeModel = safeModel.includes("70b") ? "llama-3.3-70b-versatile" : "llama-3.1-8b-instant";
      }

      const completion = await groq.chat.completions.create({
        messages: groqMessages,
        model: safeModel,
        response_format: isJson ? { type: "json_object" } : undefined,
      });
      return completion.choices[0]?.message?.content || "";
    } catch (groqError: any) {
      console.error("[Groq API Error]:", groqError);
      if (groqError.status === 401 || groqError.status === 403 || groqError.message?.toLowerCase().includes("api key") || groqError.message?.toLowerCase().includes("unauthorized")) {
        throw new Error("A chave da API do Groq está incorreta ou é inválida. Verifique a chave informada nas Configurações.");
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

    // Gemini Handler
    const localGenAI = new GoogleGenerativeAI(apiKeyToUse.trim());
    const model = localGenAI.getGenerativeModel({
      model: customModel || "gemini-3.1-pro-preview",
      systemInstruction: systemPrompt,
      generationConfig: isJson ? { responseMimeType: "application/json" } : undefined,
    });

    const chat = model.startChat({
      history: formattedMessages.slice(0, -1),
    });
    
    const lastMessage = formattedMessages[formattedMessages.length - 1];
    
    const result = await chat.sendMessage(lastMessage.parts[0].text);
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
        "Verifique se você atingiu o limite de uso gratuito ou se precisa vincular uma conta de faturamento (billing) ao seu projeto no Google AI Studio."
      );
    }
    
    if (error.status === 403 || error.status === 400 || error.message?.includes("API key")) {
      throw new Error(
        "A chave da API do Gemini está incorreta ou é inválida. " +
        "Verifique a chave informada nas Configurações."
      );
    }

    throw new Error("Falha ao comunicar com a inteligência artificial. Tente novamente em instantes.");
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


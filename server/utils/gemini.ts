import { GoogleGenerativeAI } from "@google/generative-ai";

const defaultApiKey = process.env.GEMINI_API_KEY;

if (!defaultApiKey) {
  console.warn("GEMINI_API_KEY is not set globally. AI features will require per-user keys.");
}

// Deprecated: Avoid using this global instance directly. 
// Pass customApiKey to callGemini functions or instantiate locally.
export const genAI = new GoogleGenerativeAI(defaultApiKey || "");

export async function callGemini(
  messages: { role: string; content: string }[], 
  systemPrompt?: string, 
  isJson?: boolean,
  customApiKey?: string | null
): Promise<string> {
  const apiKeyToUse = customApiKey || defaultApiKey;

  if (!apiKeyToUse) {
    throw new Error("Chave da API do Gemini não configurada. Por favor, adicione sua chave nas Configurações.");
  }

  try {
    const localGenAI = new GoogleGenerativeAI(apiKeyToUse.trim());
    const model = localGenAI.getGenerativeModel({
      model: "gemini-1.5-pro",
      systemInstruction: systemPrompt,
      generationConfig: isJson ? { responseMimeType: "application/json" } : undefined,
    });

    const formattedMessages = messages.map(msg => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    }));

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
  customApiKey?: string | null
): Promise<string> {
  const apiKeyToUse = customApiKey || defaultApiKey;

  if (!apiKeyToUse) {
    throw new Error("Chave da API do Gemini não configurada. Por favor, adicione sua chave nas Configurações.");
  }

  try {
    const localGenAI = new GoogleGenerativeAI(apiKeyToUse.trim());
    const model = localGenAI.getGenerativeModel({
      model: "gemini-1.5-pro", 
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


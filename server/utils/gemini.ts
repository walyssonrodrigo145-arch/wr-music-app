import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.warn("GEMINI_API_KEY is not set. AI features will not work.");
}

export const genAI = new GoogleGenerativeAI(apiKey || "");

export async function callGemini(messages: { role: string; content: string }[], systemPrompt?: string): Promise<string> {
  if (!apiKey) {
    throw new Error("Chave da API do Gemini não configurada no servidor.");
  }

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-3-flash-preview",
      systemInstruction: systemPrompt,
    });

    const formattedMessages = messages.map(msg => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    }));

    const chat = model.startChat({
      history: formattedMessages.slice(0, -1),
    });

    const lastMessage = formattedMessages[formattedMessages.length - 1];
    
    // Configura timeout de 30 segundos usando AbortController (se suportado nativamente pelo fetch do node/SDK)
    // O SDK do Gemini não suporta signal diretamente no sendMessage, então não vamos forçar, 
    // mas o flash model costuma responder muito rápido.
    
    const result = await chat.sendMessage(lastMessage.parts[0].text);
    return result.response.text();
  } catch (error: any) {
    console.error("[Gemini API Error]:", error);
    
    // Identificar erro de limite de quota/faturamento
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
    
    // Identificar erro de chave inválida ou não autorizada
    if (error.status === 403 || error.status === 400 || error.message?.includes("API key")) {
      throw new Error(
        "A chave da API do Gemini está incorreta ou é inválida. " +
        "Verifique a variável GEMINI_API_KEY no arquivo .env."
      );
    }

    throw new Error("Falha ao comunicar com a inteligência artificial. Tente novamente em instantes.");
  }
}

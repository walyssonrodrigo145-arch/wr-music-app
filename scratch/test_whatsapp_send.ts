import { sendWhatsAppMessage } from "../server/utils/whatsapp";

async function main() {
  const url = "https://meu-bot-whatsapp.fly.dev";
  const token = "minha_chave_secreta_123";
  const phone = "553399958830";
  const sessionId = "prof_163";

  console.log(`Sending test message to ${phone} using session ${sessionId}...`);
  
  const res = await sendWhatsAppMessage({
    url,
    token,
    phone,
    message: "🤖 Teste de Envio: O bot de mensagens do seu MusicPro está ativo e conectado!",
    sessionId,
  });

  console.log("Result:", JSON.stringify(res, null, 2));
}

main().catch(console.error);

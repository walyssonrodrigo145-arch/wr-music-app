async function logoutSession(sessionId: string) {
  const url = "https://meu-bot-whatsapp.fly.dev/sessions/logout";
  const token = "minha_chave_secreta_123";

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, apiKey: token }),
    });

    const data = await res.json().catch(() => ({}));
    console.log(`Logout Session ID: ${sessionId}`);
    console.log(`Status Code: ${res.status}`);
    console.log("Response:", JSON.stringify(data, null, 2));
  } catch (err: any) {
    console.error(`Error logging out ${sessionId}:`, err.message);
  }
}

async function main() {
  console.log("Logging out session prof_163...");
  await logoutSession("prof_163");
  console.log("\nLogging out session prof_163_qr...");
  await logoutSession("prof_163_qr");
}

main().catch(console.error);

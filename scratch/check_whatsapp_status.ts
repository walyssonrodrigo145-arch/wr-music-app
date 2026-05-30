async function checkStatus(sessionId: string) {
  const url = "https://meu-bot-whatsapp.fly.dev/sessions/status";
  const token = "minha_chave_secreta_123";

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, apiKey: token }),
    });

    const data = await res.json().catch(() => ({}));
    console.log(`Session ID: ${sessionId}`);
    console.log(`Status Code: ${res.status}`);
    console.log("Response:", JSON.stringify(data, null, 2));
  } catch (err: any) {
    console.error(`Error for ${sessionId}:`, err.message);
  }
}

async function main() {
  console.log("Checking session prof_163...");
  await checkStatus("prof_163");
  console.log("\nChecking session prof_163_qr...");
  await checkStatus("prof_163_qr");
}

main().catch(console.error);

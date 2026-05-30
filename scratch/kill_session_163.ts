async function checkAndKill(sessionId: string) {
  const statusUrl = "https://meu-bot-whatsapp.fly.dev/sessions/status";
  const logoutUrl = "https://meu-bot-whatsapp.fly.dev/sessions/logout";
  const token = "minha_chave_secreta_123";

  try {
    // Check status
    const statusRes = await fetch(statusUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, apiKey: token }),
    });
    const statusData = await statusRes.json().catch(() => ({}));
    console.log(`[Status] Session: ${sessionId}, Status Code: ${statusRes.status}, State: ${statusData.status}`);

    // If connected or pairing, logout/delete
    if (statusRes.status === 200 || statusData.status !== "DISCONNECTED") {
      const logoutRes = await fetch(logoutUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, apiKey: token }),
      });
      const logoutData = await logoutRes.json().catch(() => ({}));
      console.log(`[Logout] Session: ${sessionId}, Status Code: ${logoutRes.status}, Message: ${logoutData.message}`);
    } else {
      console.log(`Session ${sessionId} is already inactive.`);
    }
  } catch (err: any) {
    console.error(`Error for ${sessionId}:`, err.message);
  }
}

async function main() {
  const sessions = ["prof_163", "prof_163_qr", "163", "163_qr"];
  for (const s of sessions) {
    await checkAndKill(s);
    console.log("");
  }
}

main().catch(console.error);

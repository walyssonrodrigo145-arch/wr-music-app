const EVOLUTION_API_URL = "http://76.13.228.159:8080";
const EVOLUTION_API_KEY = "minha_chave_secreta_123";

async function testPairing() {
  const sessionId = "prof_test";
  const number = "5511999999999";
  
  // Create instance
  const createRes = await fetch(`${EVOLUTION_API_URL}/instance/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": EVOLUTION_API_KEY },
    body: JSON.stringify({
      instanceName: sessionId,
      qrcode: false,
      integration: "WHATSAPP-BAILEYS",
      number: number
    })
  });
  console.log("Create Res:", createRes.status, await createRes.text());
  
  // Connect
  const connectRes = await fetch(`${EVOLUTION_API_URL}/instance/connect/${sessionId}`, {
    method: "GET",
    headers: { "apikey": EVOLUTION_API_KEY }
  });
  console.log("Connect Res:", connectRes.status, await connectRes.text());

  // Delete
  await fetch(`${EVOLUTION_API_URL}/instance/delete/${sessionId}`, {
    method: "DELETE",
    headers: { "apikey": EVOLUTION_API_KEY }
  });
}
testPairing();

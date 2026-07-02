const BASE = "http://76.13.228.159:8080";
const KEY = "minha_chave_secreta_123";
const SID = "prof_163";
const PHONE = "5519992060808";

async function run() {
  const payload = {
    number: PHONE,
    options: { delay: 1200, presence: "composing" },
    textMessage: { text: "Teste de envio via v2 API" }
  };

  const res = await fetch(`${BASE}/message/sendText/${SID}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": KEY },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(e=>e.message);
  console.log("Status:", res.status);
  console.log("Data:", data);
}

run().catch(console.error);

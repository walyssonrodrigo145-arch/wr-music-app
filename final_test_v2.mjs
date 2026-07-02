const BASE = "http://76.13.228.159:8080";
const KEY = "minha_chave_secreta_123";
const SID = "prof_163";

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  console.log("=== TESTE FINAL - EVOLUTION API v2.3.7 ===\n");

  // Verificar versao
  const ver = await fetch(BASE + "/").then(r=>r.json()).catch(e=>({error:e.message}));
  console.log("[?] Versão:", ver.version);

  // Limpar
  await fetch(`${BASE}/instance/delete/${SID}`, {method:"DELETE",headers:{"apikey":KEY}}).catch(()=>{});
  await sleep(2000);

  // Teste 1: QR Code
  console.log("\n[1] TESTE QR CODE:");
  const c1 = await fetch(`${BASE}/instance/create`, {
    method:"POST", headers:{"Content-Type":"application/json","apikey":KEY},
    body: JSON.stringify({ instanceName: SID, qrcode: true, integration:"WHATSAPP-BAILEYS" })
  }).then(r=>r.json());
  console.log("   Criado:", c1?.instance?.status || c1?.instance?.instanceName);

  for (let i = 0; i < 10; i++) {
    await sleep(1000);
    const s = await fetch(`${BASE}/instance/connectionState/${SID}`, {headers:{"apikey":KEY}}).then(r=>r.json()).catch(()=>({}));
    if (s?.instance?.state === "connecting") break;
    if (i === 9) console.log("   Aviso: estado nunca chegou a 'connecting'");
  }

  const qr = await fetch(`${BASE}/instance/connect/${SID}`, {headers:{"apikey":KEY}}).then(r=>r.json());
  const qrOk = qr?.base64?.startsWith("data:image/png") ? "? QR CODE GERADO" : "? QR CODE FALHOU";
  console.log("  ", qrOk);

  // Cleanup e teste 2
  await fetch(`${BASE}/instance/delete/${SID}`, {method:"DELETE",headers:{"apikey":KEY}}).catch(()=>{});
  await sleep(2000);

  // Teste 2: Pairing Code
  console.log("\n[2] TESTE PAIRING CODE (número real):");
  const c2 = await fetch(`${BASE}/instance/create`, {
    method:"POST", headers:{"Content-Type":"application/json","apikey":KEY},
    body: JSON.stringify({ instanceName: SID, qrcode: false, number:"5519992060808", integration:"WHATSAPP-BAILEYS" })
  }).then(r=>r.json());
  console.log("   Criado:", c2?.instance?.status || c2?.instance?.instanceName);

  for (let i = 0; i < 10; i++) {
    await sleep(1000);
    const s = await fetch(`${BASE}/instance/connectionState/${SID}`, {headers:{"apikey":KEY}}).then(r=>r.json()).catch(()=>({}));
    if (s?.instance?.state === "connecting") break;
  }

  const pair = await fetch(`${BASE}/instance/connect/${SID}`, {headers:{"apikey":KEY}}).then(r=>r.json());
  if (pair?.pairingCode) {
    console.log(`   ? PAIRING CODE GERADO: ${pair.pairingCode}`);
    console.log(`   ? Use este código agora no WhatsApp!`);
  } else {
    console.log("   ? Pairing code não gerado:", JSON.stringify(pair).substring(0,100));
  }

  await fetch(`${BASE}/instance/delete/${SID}`, {method:"DELETE",headers:{"apikey":KEY}}).catch(()=>{});
  console.log("\n=== TESTE CONCLUIDO ===");
}
run().catch(e => console.error("ERRO:", e.message));

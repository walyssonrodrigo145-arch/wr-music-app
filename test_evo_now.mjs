const BASE = "http://76.13.228.159:8080";
const KEY = "minha_chave_secreta_123";

async function run() {
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  
  console.log("=== TESTE DIRETO NA EVOLUTION API ===\n");

  // 1. Versão
  const ver = await fetch(BASE + "/").then(r=>r.json()).catch(e=>({error:e.message}));
  console.log("[1] Versão:", ver.version);

  // 2. Limpar instância existente
  const SID = "prof_163";
  await fetch(`${BASE}/instance/delete/${SID}`, { method:"DELETE", headers:{"apikey":KEY}}).catch(()=>{});
  console.log("[2] Instância deletada. Aguardando 2s...");
  await sleep(2000);

  // 3. Criar com QR
  console.log("[3] Criando instância com qrcode:true ...");
  const createRes = await fetch(`${BASE}/instance/create`, {
    method: "POST",
    headers: {"Content-Type":"application/json","apikey":KEY},
    body: JSON.stringify({ instanceName: SID, qrcode: true, integration: "WHATSAPP-BAILEYS" })
  }).then(r=>r.json()).catch(e=>({error:e.message}));
  console.log("    Create response:", JSON.stringify(createRes?.instance || createRes));
  
  // 4. Aguardar o Baileys inicializar
  console.log("[4] Aguardando inicialização (até 10s)...");
  let state = "unknown";
  for (let i = 0; i < 10; i++) {
    await sleep(1000);
    const s = await fetch(`${BASE}/instance/connectionState/${SID}`, {headers:{"apikey":KEY}}).then(r=>r.json()).catch(()=>({}));
    state = s?.instance?.state || "erro";
    console.log(`    [${i+1}s] state: ${state}`);
    if (state === "connecting" || state === "open") break;
  }

  // 5. Tentar connect
  console.log(`\n[5] Estado final: "${state}" - Chamando /connect ...`);
  const conn = await fetch(`${BASE}/instance/connect/${SID}`, {headers:{"apikey":KEY}}).then(r=>r.json()).catch(e=>({error:e.message}));
  
  const hasBase64 = conn?.base64 ? `SIM (${conn.base64.substring(0,30)}...)` : "NAO";
  const hasPairing = conn?.pairingCode || "NAO";
  const hasCode = conn?.code ? `SIM len=${conn.code.length}` : "NAO";
  console.log("    base64:", hasBase64);
  console.log("    pairingCode:", hasPairing);
  console.log("    code:", hasCode);
  if (conn?.error) console.log("    ERRO:", conn.error);
  
  // 6. Cleanup
  await fetch(`${BASE}/instance/delete/${SID}`, { method:"DELETE", headers:{"apikey":KEY}}).catch(()=>{});
  console.log("\n=== TESTE CONCLUÍDO ===");
}
run().catch(e => console.error("FATAL:", e));

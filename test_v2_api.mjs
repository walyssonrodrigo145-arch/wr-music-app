const BASE = "http://76.13.228.159:8080";
const KEY = "minha_chave_secreta_123";
const SID = "prof_163_v2test";

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  console.log("=== MAPEANDO ENDPOINTS DA v2.3.7 ===\n");

  // 1. Limpar
  await fetch(`${BASE}/instance/delete/${SID}`, { method:"DELETE", headers:{"apikey":KEY}}).catch(()=>{});
  await sleep(1000);

  // 2. Criar instância
  console.log("[1] Criando instância v2...");
  const create = await fetch(`${BASE}/instance/create`, {
    method:"POST",
    headers:{"Content-Type":"application/json","apikey":KEY},
    body: JSON.stringify({ instanceName:SID, qrcode:true, integration:"WHATSAPP-BAILEYS" })
  }).then(r=>r.json());
  console.log("Criar:", JSON.stringify(create).substring(0,200));

  await sleep(3000);

  // 3. Estado da conexão
  const state = await fetch(`${BASE}/instance/connectionState/${SID}`, {headers:{"apikey":KEY}}).then(r=>r.json());
  console.log("\n[2] Estado:", JSON.stringify(state).substring(0,100));

  // 4. Connect / QR
  const conn = await fetch(`${BASE}/instance/connect/${SID}`, {headers:{"apikey":KEY}}).then(r=>r.json()).catch(e=>({error:e.message}));
  const keys = Object.keys(conn || {});
  console.log("\n[3] Connect keys:", keys);
  if (conn?.base64) console.log("    QR base64: SIM (png válido)");
  if (conn?.code) console.log("    code len:", conn.code.length);
  if (conn?.pairingCode) console.log("    pairingCode:", conn.pairingCode);

  // 5. Testar endpoint pairing code da v2 (é diferente!)
  console.log("\n[4] Testando endpoint pairing v2: POST /instance/pairing-code/...");
  const pair = await fetch(`${BASE}/instance/pairing-code/${SID}`, {
    method:"POST",
    headers:{"Content-Type":"application/json","apikey":KEY},
    body: JSON.stringify({ number:"5519992060808" })
  }).then(r=>r.json()).catch(e=>({error:e.message}));
  console.log("    Pairing v2:", JSON.stringify(pair).substring(0,200));

  // Cleanup
  await fetch(`${BASE}/instance/delete/${SID}`, { method:"DELETE", headers:{"apikey":KEY}}).catch(()=>{});
  console.log("\n=== MAPEAMENTO CONCLUIDO ===");
}
run().catch(e => console.error("ERRO:", e.message));

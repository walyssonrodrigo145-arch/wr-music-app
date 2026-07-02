const BASE = "http://76.13.228.159:8080";
const KEY = "minha_chave_secreta_123";
const SID = "prof_163_v2p2";
const PHONE = "5519992060808";

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

await fetch(`${BASE}/instance/delete/${SID}`, {method:"DELETE",headers:{"apikey":KEY}}).catch(()=>{});
await sleep(2000);

// Criar COM qrcode: true para forçar o Baileys inicializar
console.log("[1] Criando instância (qrcode: true para inicializar Baileys)...");
await fetch(`${BASE}/instance/create`, {
  method:"POST", headers:{"Content-Type":"application/json","apikey":KEY},
  body: JSON.stringify({ instanceName: SID, qrcode: true, integration:"WHATSAPP-BAILEYS" })
}).then(r=>r.json());

// Aguardar connecting
let stateReady = false;
for (let i = 0; i < 10; i++) {
  await sleep(1000);
  const s = await fetch(`${BASE}/instance/connectionState/${SID}`, {headers:{"apikey":KEY}}).then(r=>r.json()).catch(()=>({}));
  const st = s?.instance?.state;
  process.stdout.write(`[${i+1}s] ${st}\r`);
  if (st === "connecting") { stateReady = true; console.log(`\n   Estado: connecting ?`); break; }
}

// Agora chamar connect COM number para obter pairing code
console.log("[2] Chamando /connect?number=... para obter pairing code...");
const p = await fetch(`${BASE}/instance/connect/${SID}?number=${PHONE}`, {
  headers:{"apikey":KEY}
}).then(r=>r.json());

console.log("   Keys:", Object.keys(p || {}));

if (p?.pairingCode) {
  console.log(`\n? PAIRING CODE: ${p.pairingCode}`);
} else {
  // Tentar mais uma vez após 3s
  console.log("   Aguardando 3s e tentando novamente...");
  await sleep(3000);
  const p2 = await fetch(`${BASE}/instance/connect/${SID}?number=${PHONE}`, {
    headers:{"apikey":KEY}
  }).then(r=>r.json());
  console.log("   2a tentativa keys:", Object.keys(p2 || {}));
  console.log("   pairingCode:", p2?.pairingCode || "null");
  console.log("   base64:", p2?.base64 ? "SIM" : "NAO");
  console.log("   count:", p2?.count);
}

await fetch(`${BASE}/instance/delete/${SID}`, {method:"DELETE",headers:{"apikey":KEY}}).catch(()=>{});

const BASE = "http://76.13.228.159:8080";
const KEY = "minha_chave_secreta_123";
const SID = "prof_163_v2p";
const PHONE = "5519992060808";

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

await fetch(`${BASE}/instance/delete/${SID}`, {method:"DELETE",headers:{"apikey":KEY}}).catch(()=>{});
await sleep(2000);

// Criar SEM number no payload, mas com qrcode: false
console.log("[1] Criando instância (qrcode: false, SEM number no payload)...");
const c = await fetch(`${BASE}/instance/create`, {
  method:"POST", headers:{"Content-Type":"application/json","apikey":KEY},
  body: JSON.stringify({ instanceName: SID, qrcode: false, integration:"WHATSAPP-BAILEYS" })
}).then(r=>r.json());
console.log("   Criado:", c?.instance?.status || c?.instance?.instanceName);

// Aguardar connecting
for (let i = 0; i < 10; i++) {
  await sleep(1000);
  const s = await fetch(`${BASE}/instance/connectionState/${SID}`, {headers:{"apikey":KEY}}).then(r=>r.json()).catch(()=>({}));
  const st = s?.instance?.state;
  process.stdout.write(`[${i+1}s] ${st}\r`);
  if (st === "connecting") { console.log(`\n   Estado: connecting ?`); break; }
}

// Chamar connect COM number como query param
console.log("[2] Chamando GET /instance/connect com ?number=...");
const p = await fetch(`${BASE}/instance/connect/${SID}?number=${PHONE}`, {
  headers:{"apikey":KEY}
}).then(r=>r.json());

console.log("   Keys:", Object.keys(p || {}));
if (p?.pairingCode) {
  console.log(`\n? PAIRING CODE: ${p.pairingCode}\n`);
} else {
  console.log("   pairingCode:", p?.pairingCode);
  console.log("   base64:", p?.base64 ? "SIM" : "NAO");
  console.log("   Raw:", JSON.stringify(p).substring(0, 300));
}

await fetch(`${BASE}/instance/delete/${SID}`, {method:"DELETE",headers:{"apikey":KEY}}).catch(()=>{});

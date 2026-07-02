const BASE = "http://76.13.228.159:8080";
const KEY = "minha_chave_secreta_123";
const SID = "prof_163_pair";

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Limpar
await fetch(`${BASE}/instance/delete/${SID}`, {method:"DELETE",headers:{"apikey":KEY}}).catch(()=>{});
await sleep(2000);

// Criar com número (modo pairing)
const c = await fetch(`${BASE}/instance/create`, {
  method:"POST", headers:{"Content-Type":"application/json","apikey":KEY},
  body: JSON.stringify({ instanceName: SID, qrcode: false, number:"5519992060808", integration:"WHATSAPP-BAILEYS" })
}).then(r=>r.json());
console.log("Criado:", c?.instance?.status);

for (let i = 0; i < 10; i++) {
  await sleep(1000);
  const s = await fetch(`${BASE}/instance/connectionState/${SID}`, {headers:{"apikey":KEY}}).then(r=>r.json()).catch(()=>({}));
  process.stdout.write(`[${i+1}s] ${s?.instance?.state}\r`);
  if (s?.instance?.state === "connecting") break;
}

const p = await fetch(`${BASE}/instance/connect/${SID}`, {headers:{"apikey":KEY}}).then(r=>r.json());
if (p?.pairingCode) {
  console.log(`\n\n? PAIRING CODE: ${p.pairingCode}`);
  console.log("Entre agora no WhatsApp e use este código!");
} else {
  console.log("\n? Pairing code:", JSON.stringify(p).substring(0,200));
}

await fetch(`${BASE}/instance/delete/${SID}`, {method:"DELETE",headers:{"apikey":KEY}}).catch(()=>{});

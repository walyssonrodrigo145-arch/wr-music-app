// WRAUDITOR - Diagnóstico Completo da Evolution API
const BASE = "http://76.13.228.159:8080";
const KEY = "minha_chave_secreta_123";

async function sleep(ms) { return new Promise(r=>setTimeout(r,ms)); }

async function run() {
  console.log("=== WRAUDITOR: Diagnóstico Completo da Evolution API ===\n");

  // 1. Check versão da API
  console.log("--- [1] Versão da Evolution API ---");
  const ver = await fetch(BASE + "/").then(r=>r.json()).catch(e=>({error:e.message}));
  console.log(JSON.stringify(ver));
  console.log();

  // 2. Listar instâncias existentes
  console.log("--- [2] Instâncias existentes ---");
  const inst = await fetch(BASE + "/instance/fetchInstances", { headers:{"apikey":KEY}}).then(r=>r.json()).catch(e=>({error:e.message}));
  console.log(JSON.stringify(inst, null, 2));
  console.log();

  // 3. Limpar instância de teste anterior
  const SID = "audit_test";
  await fetch(BASE + "/instance/delete/" + SID, { method:"DELETE", headers:{"apikey":KEY}}).catch(()=>{});
  await sleep(1000);

  // 4. Testar criação de instância QR Code
  console.log("--- [3] Criar instância QR Code ---");
  const createQR = await fetch(BASE + "/instance/create", {
    method:"POST",
    headers:{"Content-Type":"application/json","apikey":KEY},
    body: JSON.stringify({ instanceName:SID, qrcode:true, integration:"WHATSAPP-BAILEYS" })
  }).then(r=>r.json()).catch(e=>({error:e.message}));
  console.log("Status:", JSON.stringify(createQR?.instance));
  console.log();

  await sleep(2000);

  // 5. Conectar e verificar QR Code
  console.log("--- [4] Connect (QR Code) ---");
  const conn = await fetch(BASE + "/instance/connect/" + SID, {
    headers:{"apikey":KEY}
  }).then(r=>r.json()).catch(e=>({error:e.message}));
  
  const hasBase64 = conn?.base64 ? "SIM (length=" + conn.base64.length + ")" : "NAO";
  const hasCode = conn?.code ? "SIM (length=" + conn.code.length + ")" : "NAO";
  const hasPairingCode = conn?.pairingCode ? "SIM: " + conn.pairingCode : "NAO";
  console.log("base64 presente:", hasBase64);
  console.log("code presente:", hasCode);
  console.log("pairingCode presente:", hasPairingCode);
  console.log("Outros campos:", Object.keys(conn || {}).filter(k=>k!="base64"&&k!="code").join(", "));
  console.log();

  // 6. Verificar estado
  console.log("--- [5] Estado da instância ---");
  const state = await fetch(BASE + "/instance/connectionState/" + SID, {
    headers:{"apikey":KEY}
  }).then(r=>r.json()).catch(e=>({error:e.message}));
  console.log(JSON.stringify(state));
  console.log();

  // 7. Deletar e recriar para pairing code
  await fetch(BASE + "/instance/delete/" + SID, { method:"DELETE", headers:{"apikey":KEY}}).catch(()=>{});
  await sleep(1000);

  console.log("--- [6] Criar instância Pairing Code (qrcode:false + number) ---");
  const createPC = await fetch(BASE + "/instance/create", {
    method:"POST",
    headers:{"Content-Type":"application/json","apikey":KEY},
    body: JSON.stringify({ instanceName:SID, qrcode:false, integration:"WHATSAPP-BAILEYS", number:"5519992060808" })
  }).then(r=>r.json()).catch(e=>({error:e.message}));
  console.log("Status:", JSON.stringify(createPC?.instance));
  console.log();

  await sleep(3000);

  console.log("--- [7] Connect (Pairing Code mode) com ?number= ---");
  const connPC = await fetch(BASE + "/instance/connect/" + SID + "?number=5519992060808", {
    headers:{"apikey":KEY}
  }).then(r=>r.json()).catch(e=>({error:e.message}));
  
  const pcBase64 = connPC?.base64 ? "SIM (length=" + connPC.base64.length + ")" : "NAO";
  const pcCode = connPC?.code ? "SIM (length=" + connPC.code.length + ")" : "NAO";
  const pcPairing = connPC?.pairingCode ? "CODIGO: " + connPC.pairingCode : "NAO";
  console.log("base64:", pcBase64);
  console.log("code:", pcCode);
  console.log("pairingCode:", pcPairing);
  console.log("Todos os campos:", Object.keys(connPC || {}).join(", "));
  
  if (connPC?.pairingCode) {
    console.log("\n>>> PAIRING CODE OBTIDO:", connPC.pairingCode, "<<<");
  } else {
    console.log("\n>>> FALHA: pairingCode nao encontrado <<<");
    console.log("Resposta completa:", JSON.stringify(connPC).substring(0, 400));
  }

  // 8. Limpeza
  await fetch(BASE + "/instance/delete/" + SID, { method:"DELETE", headers:{"apikey":KEY}}).catch(()=>{});
  console.log("\n--- Auditoria concluída ---");
}

run().catch(e=>console.error("ERRO FATAL:", e.message));

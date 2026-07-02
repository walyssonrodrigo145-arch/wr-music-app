// Simula exatamente o fluxo do sistema: startSession + polling getStatus
const BASE = "http://76.13.228.159:8080";
const KEY = "minha_chave_secreta_123";
const SID = "prof_163"; // A instância real que existe

async function run() {
  console.log("=== Simulando fluxo exato do sistema ===\n");

  // 1. Simula o que getStatus retorna (usado pelo polling)
  console.log("[getStatus] GET /instance/connectionState/" + SID);
  const stateRes = await fetch(BASE + "/instance/connectionState/" + SID, {
    headers:{"apikey":KEY}
  });
  const stateData = await stateRes.json().catch(()=>({}));
  console.log("Status HTTP:", stateRes.status);
  console.log("Dados:", JSON.stringify(stateData));
  console.log();

  // 2. Se o estado não é "open", o sistema considera DISCONNECTED
  const state = stateData?.instance?.state;
  console.log("State:", state);
  
  if (state === "open") {
    console.log("? Frontend recebe CONNECTED");
  } else if (state === "connecting") {
    console.log("? Frontend recebe CONNECTING mas código mapeia como DISCONNECTED!");
    console.log("? PROBLEMA: state=connecting vira DISCONNECTED, resetando a sessão!");
  } else {
    console.log("? Frontend recebe DISCONNECTED");
  }
  
  console.log();
  console.log("[Diagnóstico] O polling de getStatus retorna qr='' e pairingCode=''");
  console.log("[Diagnóstico] Isso significa que ao fazer o polling, o frontend nunca recebe o QR Code ou Pairing Code via polling.");
  console.log("[Diagnóstico] O QR Code e Pairing Code só chegam via o handleStart (mutação), mas o polling de getStatus os sobrescreve?");
  console.log();
  
  // Verificar campos que o connect retorna para uma instância em state=connecting
  console.log("[Extra] Tentando GET /instance/connect/" + SID + " em instância existente...");
  const connRes = await fetch(BASE + "/instance/connect/" + SID, {
    headers:{"apikey":KEY}
  });
  const connData = await connRes.json().catch(()=>({}));
  console.log("Connect Status:", connRes.status);
  const hasBase64 = connData?.base64 ? "SIM length=" + connData.base64.length : "NAO";
  const hasPairingCode = connData?.pairingCode ? "SIM: " + connData.pairingCode : "NAO";
  console.log("base64:", hasBase64);
  console.log("pairingCode:", hasPairingCode);
  console.log("Todos campos:", Object.keys(connData || {}).join(", "));
}

run().catch(e=>console.error("ERR:", e.message));

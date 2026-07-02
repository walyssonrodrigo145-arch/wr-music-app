// Testa o pairing code com o número real do usuário
const BASE = "http://76.13.228.159:8080";
const KEY = "minha_chave_secreta_123";
const SID = "prof_163_test";
const PHONE = "5519992060808"; // número real

async function run() {
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  console.log("=== TESTE PAIRING CODE COM NUMERO REAL ===\n");

  // Deletar instância anterior
  await fetch(`${BASE}/instance/delete/${SID}`, { method:"DELETE", headers:{"apikey":KEY}}).catch(()=>{});
  await sleep(1500);

  // Criar com pairing code
  console.log("[1] Criando instância modo pairing...");
  const create = await fetch(`${BASE}/instance/create`, {
    method:"POST",
    headers:{"Content-Type":"application/json","apikey":KEY},
    body: JSON.stringify({ instanceName:SID, qrcode:false, integration:"WHATSAPP-BAILEYS", number: PHONE })
  }).then(r=>r.json()).catch(e=>({error:e.message}));
  console.log("Create:", JSON.stringify(create?.instance));

  // Aguardar
  console.log("[2] Aguardando inicialização (até 8s)...");
  let state = "";
  for (let i = 0; i < 8; i++) {
    await sleep(1000);
    const s = await fetch(`${BASE}/instance/connectionState/${SID}`, {headers:{"apikey":KEY}}).then(r=>r.json()).catch(()=>({}));
    state = s?.instance?.state || "?";
    process.stdout.write(`[${i+1}s] ${state}\r`);
    if (state === "connecting") break;
  }
  console.log(`\nEstado: ${state}`);

  // Obter pairing code
  console.log("[3] Obtendo pairing code...");
  const conn = await fetch(`${BASE}/instance/connect/${SID}?number=${PHONE}`, {
    headers:{"apikey":KEY}
  }).then(r=>r.json()).catch(e=>({error:e.message}));
  
  if (conn?.pairingCode) {
    console.log(`\n? PAIRING CODE: ${conn.pairingCode}`);
    console.log("   Use esse código no WhatsApp ? Aparelhos Conectados ? Conectar ? Com número de telefone");
    
    // Monitorar por 30s para ver se conecta
    console.log("\n[4] Monitorando conexão por 30 segundos...");
    for (let i = 0; i < 30; i++) {
      await sleep(1000);
      const st = await fetch(`${BASE}/instance/connectionState/${SID}`, {headers:{"apikey":KEY}}).then(r=>r.json()).catch(()=>({}));
      const s = st?.instance?.state;
      process.stdout.write(`[${i+1}s] estado: ${s}        \r`);
      if (s === "open") {
        console.log(`\n\n?? CONECTADO COM SUCESSO! estado: ${s}`);
        break;
      }
    }
  } else {
    console.log("? Pairing code não obtido:", JSON.stringify(conn).substring(0, 200));
  }

  await fetch(`${BASE}/instance/delete/${SID}`, { method:"DELETE", headers:{"apikey":KEY}}).catch(()=>{});
}
run().catch(e => console.error("ERRO:", e.message));

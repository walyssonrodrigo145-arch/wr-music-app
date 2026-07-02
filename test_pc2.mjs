const BASE = "http://76.13.228.159:8080";
const KEY = "minha_chave_secreta_123";
const SID = "prof_pctest2";
const PHONE = "5519992060808";

async function run() {
  // Limpar
  await fetch(BASE + "/instance/delete/" + SID, { method:"DELETE", headers:{"apikey":KEY}}).catch(()=>{});
  await new Promise(r=>setTimeout(r,1000));

  // Criar COM número e qrcode:false (v1.6.1 pairing code flow)
  const cr = await fetch(BASE + "/instance/create", {
    method:"POST",
    headers:{"Content-Type":"application/json","apikey":KEY},
    body: JSON.stringify({ 
      instanceName:SID, 
      qrcode:false, 
      number: PHONE,
      integration:"WHATSAPP-BAILEYS" 
    })
  });
  const crData = await cr.json();
  console.log("CREATE status:", cr.status);
  console.log("CREATE data:", JSON.stringify(crData, null, 2));

  await new Promise(r=>setTimeout(r,3000));

  // Tentar connect com numero via query string (v1.6.1)
  const co = await fetch(BASE + "/instance/connect/" + SID + "?number=" + PHONE, {
    headers:{"apikey":KEY}
  });
  console.log("CONNECT status:", co.status);
  const coData = await co.text();
  console.log("CONNECT data:", coData.substring(0, 500));

  // Limpar
  await fetch(BASE + "/instance/delete/" + SID, { method:"DELETE", headers:{"apikey":KEY}}).catch(()=>{});
}
run().catch(e=>console.error("ERR", e.message));

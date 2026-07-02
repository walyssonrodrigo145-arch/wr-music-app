const BASE = "http://76.13.228.159:8080";
const KEY = "minha_chave_secreta_123";
const SID = "prof_pctest";

async function run() {
  await fetch(BASE + "/instance/delete/" + SID, { method:"DELETE", headers:{"apikey":KEY}}).catch(()=>{});
  await new Promise(r=>setTimeout(r,1000));

  const cr = await fetch(BASE + "/instance/create", {
    method:"POST",
    headers:{"Content-Type":"application/json","apikey":KEY},
    body: JSON.stringify({ instanceName:SID, qrcode:false, integration:"WHATSAPP-BAILEYS" })
  });
  console.log("CREATE", cr.status, await cr.text());

  await new Promise(r=>setTimeout(r,4000));

  const sr = await fetch(BASE + "/instance/connectionState/" + SID, { headers:{"apikey":KEY}});
  const sd = await sr.json();
  console.log("STATE", JSON.stringify(sd?.instance));

  const pr = await fetch(BASE + "/instance/pairing-code/" + SID, {
    method:"POST",
    headers:{"Content-Type":"application/json","apikey":KEY},
    body: JSON.stringify({ number: "5519992060808" })
  });
  console.log("PAIRING STATUS", pr.status);
  console.log("PAIRING RESPONSE", await pr.text());

  await fetch(BASE + "/instance/delete/" + SID, { method:"DELETE", headers:{"apikey":KEY}}).catch(()=>{});
}
run().catch(e=>console.error("ERR", e.message));

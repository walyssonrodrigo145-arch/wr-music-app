const EVOLUTION_API_URL = "http://76.13.228.159:8080";
const EVOLUTION_API_KEY = "minha_chave_secreta_123";

async function flushInstances() {
  console.log("Buscando todas as instâncias...");
  try {
    const res = await fetch(`${EVOLUTION_API_URL}/instance/fetchInstances`, {
      headers: { "apikey": EVOLUTION_API_KEY }
    });
    const instances = await res.json();
    
    if (instances && instances.length > 0) {
      console.log(`Encontradas ${instances.length} instâncias. Apagando...`);
      for (const inst of instances) {
        const name = inst.instance?.instanceName || inst.instanceName;
        if (name) {
          console.log(`Apagando ${name}...`);
          try {
             await fetch(`${EVOLUTION_API_URL}/instance/logout/${name}`, { method: "DELETE", headers: { "apikey": EVOLUTION_API_KEY } });
          } catch(e){}
          const delRes = await fetch(`${EVOLUTION_API_URL}/instance/delete/${name}`, { method: "DELETE", headers: { "apikey": EVOLUTION_API_KEY } });
          console.log(`Status de deleção para ${name}:`, delRes.status);
        }
      }
    } else {
      console.log("Nenhuma instância encontrada.", instances);
    }
  } catch (e) {
    console.log("Erro:", e.message);
  }
}

flushInstances();

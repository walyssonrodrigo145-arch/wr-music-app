const EVOLUTION_API_URL = "http://76.13.228.159:8080";
const EVOLUTION_API_KEY = "minha_chave_secreta_123";

async function forceReset() {
  console.log("Deletando instância prof_1...");
  try {
    await fetch(`${EVOLUTION_API_URL}/instance/logout/prof_1`, {
      method: "DELETE",
      headers: { "apikey": EVOLUTION_API_KEY }
    });
  } catch (e) {
    console.log("Erro ao fazer logout:", e.message);
  }

  try {
    const delRes = await fetch(`${EVOLUTION_API_URL}/instance/delete/prof_1`, {
      method: "DELETE",
      headers: { "apikey": EVOLUTION_API_KEY }
    });
    console.log("Deletar:", await delRes.text());
  } catch (e) {
    console.log("Erro ao deletar:", e.message);
  }

  console.log("Processo concluído.");
}

forceReset();

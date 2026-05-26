import { config } from "dotenv";
config();
import { createAsaasCustomer } from "./server/utils/asaas";

async function run() {
  try {
    console.log("Tentando criar cliente Asaas...");
    const id = await createAsaasCustomer({
      name: "iatsa",
      email: "iatsa@gmail.com",
      phone: "(33) 98896-2572",
      cpfCnpj: "136.790.086-78"
    });
    console.log("Sucesso! ID:", id);
  } catch (e) {
    console.error("ERRO DO ASAAS:", e.message);
  }
}
run();

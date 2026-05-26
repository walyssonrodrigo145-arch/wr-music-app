import { config } from "dotenv";
config();
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { asaasCustomers } from "./drizzle/schema";

async function run() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("No DB URL");
  const client = postgres(connectionString);
  const db = drizzle(client);
  await db.delete(asaasCustomers);
  console.log("Tabela asaasCustomers limpa!");
  process.exit(0);
}
run();

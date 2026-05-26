import { config } from "dotenv";
config();
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { paymentDues, students } from "./drizzle/schema";
import { desc, eq } from "drizzle-orm";

async function run() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("No DB URL");
  const client = postgres(connectionString);
  const db = drizzle(client);
  const dues = await db.select().from(paymentDues).orderBy(desc(paymentDues.id)).limit(1);
  console.log("ULTIMA MENSALIDADE:", JSON.stringify(dues[0], null, 2));
  if (dues[0]) {
    const s = await db.select().from(students).where(eq(students.id, dues[0].studentId));
    console.log("ALUNO:", s[0].name, "CPF:", s[0].cpf, "EMAIL:", s[0].email, "PHONE:", s[0].phone);
  }
  process.exit(0);
}
run();

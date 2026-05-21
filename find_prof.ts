import { eq } from "drizzle-orm";
import { getDb } from "./server/db";
import { users } from "./drizzle/schema";

async function main() {
  const db = await getDb();
  const professor = await db.select().from(users).where(eq(users.email, "walyssonrodrigo145@gmail.com"));
  
  if (professor.length === 0) {
    console.log("Professor não encontrado.");
  } else {
    console.log("Professor encontrado:", professor);
  }
  process.exit(0);
}

main().catch(console.error);

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./drizzle/schema";

async function check() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is missing");
    process.exit(1);
  }
  
  const sql = postgres(url);
  const db = drizzle(sql, { schema });
  
  try {
    const result = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'lessons'
    `;
    console.log("Columns in 'lessons' table:");
    console.table(result);
  } catch (error) {
    console.error("Error checking columns:", error);
  } finally {
    await sql.end();
  }
}

check();

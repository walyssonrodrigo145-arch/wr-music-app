import postgres from 'postgres';
import dotenv from 'dotenv';
dotenv.config();

const sql = postgres(process.env.DATABASE_URL);

async function run() {
  try {
    const res = await sql`SELECT id, name, "allowAutoReminders" FROM students WHERE name ILIKE '%cristina silva%'`;
    console.log("RESULTADO CRISTINA SILVA:");
    console.log(res);
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
run();

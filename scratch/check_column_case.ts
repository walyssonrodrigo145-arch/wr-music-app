
import postgres from 'postgres';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.DATABASE_URL!;
const sql = postgres(url);

async function check() {
  try {
    const result = await sql`
      SELECT table_schema, table_name, column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name ILIKE 'openid'
    `;
    console.log("Matches for 'openid':");
    console.table(result);
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await sql.end();
  }
}

check();

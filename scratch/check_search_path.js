import postgres from 'postgres';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.DATABASE_URL;
const sql = postgres(url);

async function check() {
  try {
    const result = await sql`SHOW search_path;`;
    console.log("Search path:", result);
  } catch (error) {
    console.error("Error checking search path:", error);
  } finally {
    await sql.end();
  }
}

check();

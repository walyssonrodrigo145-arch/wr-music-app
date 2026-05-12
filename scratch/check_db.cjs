require('dotenv').config();
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL);

async function run() {
  try {
    console.log("--- CHECKING USERS TABLE COLUMNS ---");
    const result = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'users'`;
    console.log("Columns:", result.map(r => r.column_name).join(', '));

    console.log("--- CHECKING PEDRO USER FULL RECORD ---");
    const pedro = await sql`SELECT * FROM users WHERE id = 1523`;
    console.log("Pedro full record:", JSON.stringify(pedro, null, 2));

  } catch (e) {
    console.error("ERRO:", e.message);
  } finally {
    await sql.end();
    process.exit();
  }
}
run();

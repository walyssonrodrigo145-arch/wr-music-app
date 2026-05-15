import "dotenv/config";
import postgres from "postgres";

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { ssl: { rejectUnauthorized: false } });
  try {
    const cols = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'students';
    `;
    console.log(JSON.stringify(cols, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await sql.end();
  }
}

main();

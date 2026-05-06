import postgres from 'postgres';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is missing");
  process.exit(1);
}

const sql = postgres(url);

async function check() {
  try {
    const result = await sql`
      SELECT table_schema, column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'users' AND table_schema = 'public'
      ORDER BY ordinal_position;
    `;
    console.log("Columns in 'public.users' table:");
    console.table(result);

    const tables = await sql`
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_name = 'users';
    `;
    console.log("Tables named 'users' found:");
    console.table(tables);

  } catch (error) {
    console.error("Error checking columns:", error);
  } finally {
    await sql.end();
  }
}

check();

import postgres from 'postgres';
import 'dotenv/config';

async function migrate() {
  const sql = postgres(process.env.DATABASE_URL);
  try {
    await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS "geminiApiKey" text;`;
    console.log('Migration done.');
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

migrate();

import postgres from 'postgres';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') });

const sql = postgres(process.env.DATABASE_URL as string);

async function main() {
  // fetch the last 10 lessons to see if any have weird scheduledAt
  const res = await sql`SELECT id, "scheduledAt", "createdAt", title FROM lessons ORDER BY "createdAt" DESC LIMIT 10`;
  console.log("Last 10 lessons created:");
  for (const r of res) {
    console.log(`ID: ${r.id}, scheduledAt: ${r.scheduledAt}, type: ${typeof r.scheduledAt}`);
  }
  await sql.end();
}

main().catch(console.error);

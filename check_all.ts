import postgres from 'postgres';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') });

const sql = postgres(process.env.DATABASE_URL as string);

async function main() {
  const res = await sql`SELECT id, "scheduledAt", "createdAt" FROM lessons`;
  let invalidCount = 0;
  for (const r of res) {
    if (Number.isNaN(new Date(r.scheduledAt).getTime())) {
      console.log(`INVALID DATE FOUND! ID: ${r.id}, raw scheduledAt:`, r.scheduledAt);
      invalidCount++;
    }
  }
  console.log(`Finished checking ${res.length} lessons. Invalid count: ${invalidCount}`);
  await sql.end();
}

main().catch(console.error);

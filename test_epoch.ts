import postgres from 'postgres';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') });

const sql = postgres(process.env.DATABASE_URL as string);

async function main() {
  const time24h = new Date("2026-06-08T02:10:00.000Z");
  
  const res = await sql`
    SELECT id, "scheduledAt", 
           ${time24h.toISOString()}::timestamp as time24h,
           abs(extract(epoch from ("scheduledAt" - ${time24h.toISOString()}::timestamp))) as diff
    FROM reminders 
    WHERE id = 1429
  `;
  console.log("Difference check:");
  console.log(res);

  await sql.end();
}

main().catch(console.error);

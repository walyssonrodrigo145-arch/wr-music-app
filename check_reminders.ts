import postgres from 'postgres';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') });

const sql = postgres(process.env.DATABASE_URL as string);

async function main() {
  const res = await sql`
    SELECT * FROM reminders WHERE "lessonId" IS NOT NULL ORDER BY id DESC LIMIT 10
  `;
  console.log("Last 10 reminders for lessons:");
  for (const r of res) {
    console.log(`ID: ${r.id}, refId: ${r.refId}, status: ${r.status}, message: ${r.message}`);
  }
  await sql.end();
}

main().catch(console.error);

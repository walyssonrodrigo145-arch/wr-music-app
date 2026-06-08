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
    SELECT * FROM reminders ORDER BY id DESC LIMIT 20
  `;
  console.log("Last 20 reminders:");
  for (const r of res) {
    console.log(`ID: ${r.id}, refId: ${r.refId}, lessonId: ${r.lessonId}, status: ${r.status}, message: ${r.message?.slice(0, 20)}`);
  }
  await sql.end();
}

main().catch(console.error);

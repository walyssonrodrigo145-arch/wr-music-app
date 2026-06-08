import postgres from 'postgres';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') });

const sql = postgres(process.env.DATABASE_URL as string);

async function main() {
  const lessonId = 29;
  
  // 1. Check existing reminders for lesson 29
  const existing = await sql`
    SELECT id, "refId", status, "scheduledAt" 
    FROM reminders 
    WHERE "lessonId" = ${lessonId}
  `;
  console.log("Existing reminders for lesson 29:");
  console.log(existing);

  await sql.end();
}

main().catch(console.error);

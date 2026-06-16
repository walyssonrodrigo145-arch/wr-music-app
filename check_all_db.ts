import postgres from 'postgres';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') });

const sql = postgres(process.env.DATABASE_URL as string);

async function main() {
  const rems = await sql`SELECT id, type, status, message, "scheduledAt", "createdAt" FROM reminders ORDER BY id DESC LIMIT 50`;
  console.log(`Found ${rems.length} recent reminders`);
  console.log(rems);

  const less = await sql`SELECT id, "studentId", date, status, "recurrenceId" FROM lessons ORDER BY id DESC LIMIT 20`;
  console.log(`Found ${less.length} recent lessons`);
  console.log(less);

  const dues = await sql`SELECT id, "studentId", "dueDate", status FROM payment_dues ORDER BY id DESC LIMIT 20`;
  console.log(`Found ${dues.length} recent payment dues`);
  console.log(dues);

  await sql.end();
}

main().catch(console.error);

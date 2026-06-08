import postgres from 'postgres';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') });

const sql = postgres(process.env.DATABASE_URL as string);

async function main() {
  const d = new Date(2026, 5, 12, 17, 10, 0); // Friday, June 12, 2026, 17:10 Local Time
  const endsAt = new Date(d.getTime() + 60 * 60000); // 60 minutes later

  console.log("Checking overlaps for:", d.toISOString(), "to", endsAt.toISOString());

  const res = await sql`
    SELECT lessons.id, lessons."scheduledAt", lessons.duration, lessons.title, students.name
    FROM lessons
    LEFT JOIN students ON lessons."studentId" = students.id
    WHERE ("scheduledAt", ("scheduledAt" + (duration || ' minutes')::interval)) 
          OVERLAPS (${d.toISOString()}::timestamp, ${endsAt.toISOString()}::timestamp)
  `;
  
  console.log("Conflicts found:", res.length);
  for (const r of res) {
    console.log(`- ID: ${r.id}, scheduledAt in DB: ${r.scheduledAt}, Student: ${r.name}`);
  }
  await sql.end();
}

main().catch(console.error);

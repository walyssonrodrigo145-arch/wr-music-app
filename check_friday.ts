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
    SELECT lessons.id, lessons."scheduledAt", lessons.title, students.name as "studentName",
    extract(dow from "scheduledAt" AT TIME ZONE 'America/Sao_Paulo') as dow,
    extract(hour from "scheduledAt" AT TIME ZONE 'America/Sao_Paulo') as hour
    FROM lessons 
    LEFT JOIN students ON lessons."studentId" = students.id
    ORDER BY lessons.id DESC 
    LIMIT 50
  `;
  console.log("Last 50 lessons scheduled:");
  for (const r of res) {
    const d = new Date(r.scheduledAt);
    const options: any = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    console.log(`- ID: ${r.id} | ${d.toLocaleString('pt-BR', options)}: ${r.title} (Student: ${r.studentName})`);
  }
  await sql.end();
}

main().catch(console.error);

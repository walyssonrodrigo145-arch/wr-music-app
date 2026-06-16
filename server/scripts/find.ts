import { getDb } from '../db';
import { sql } from 'drizzle-orm';

async function run() {
  const db = await getDb();
  if(!db) return;
  const res = await db.execute(sql`SELECT * FROM students WHERE name ILIKE '%Amparo%'`);
  console.log('Result:', JSON.stringify(res, null, 2));
}

run().catch(console.error).finally(() => process.exit(0));
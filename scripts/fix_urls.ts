import { getDb } from '../server/db';
import { studentFiles } from '../drizzle/schema';
import { desc } from 'drizzle-orm';

async function run() {
  const db = await getDb();
  
  const files = await db.select().from(studentFiles).limit(10).orderBy(desc(studentFiles.id));
  
  console.log(`Found ${files.length} total files in DB.`);
  for (const mat of files) {
    console.log(`[File ${mat.id}] fileUrl: ${mat.fileUrl}`);
  }
  
  console.log('Done.');
  process.exit(0);
}

run().catch(console.error);

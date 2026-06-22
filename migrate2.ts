import 'dotenv/config'; 
import { getDb } from './server/db'; 
async function run() { 
  try {
    const db = await getDb(); 
    await db.execute('ALTER TABLE student_files ADD COLUMN folder VARCHAR(100);');
    await db.execute('ALTER TABLE student_files ADD COLUMN "viewedAt" TIMESTAMP;'); 
    await db.execute('CREATE TABLE IF NOT EXISTS file_comments (id SERIAL PRIMARY KEY, "organizationId" INTEGER, "fileId" INTEGER NOT NULL, "userId" INTEGER NOT NULL, content TEXT NOT NULL, "createdAt" TIMESTAMP DEFAULT NOW() NOT NULL);'); 
    await db.execute('ALTER TABLE professor_payments ADD COLUMN adjustments TEXT;'); 
    console.log('Done'); 
    process.exit(0); 
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
} 
run();

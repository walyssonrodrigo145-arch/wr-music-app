import { db } from "./db";
import { sql } from "drizzle-orm";

async function main() {
  try {
    console.log("Adding folder column to student_files...");
    await db.execute(sql`ALTER TABLE student_files ADD COLUMN IF NOT EXISTS folder text`);
    
    console.log("Adding viewedAt column to student_files...");
    await db.execute(sql`ALTER TABLE student_files ADD COLUMN IF NOT EXISTS viewedAt timestamp`);
    
    console.log("Creating file_comments table...");
    await db.execute(sql`CREATE TABLE IF NOT EXISTS file_comments (id serial PRIMARY KEY, organization_id integer NOT NULL, file_id integer NOT NULL, user_id integer NOT NULL, content text NOT NULL, created_at timestamp DEFAULT now() NOT NULL)`);
    
    console.log("Adding adjustments to professor_payments...");
    await db.execute(sql`ALTER TABLE professor_payments ADD COLUMN IF NOT EXISTS adjustments text`);
    
    console.log("Migration successful.");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

main();

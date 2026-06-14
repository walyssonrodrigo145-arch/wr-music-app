import "dotenv/config";
import { getDb } from "../db";
import { lessons } from "../../drizzle/schema";
import { inArray } from "drizzle-orm";

async function run() {
  const db = await getDb();
  if (!db) return;

  const ls = await db.select().from(lessons).where(inArray(lessons.id, [400, 139, 138, 137, 136, 135, 134, 133, 132, 131, 130]));
  console.log("Lessons data:", ls.map(l => ({ id: l.id, lessonType: l.lessonType })));
  
  process.exit(0);
}

run().catch(console.error);

import "dotenv/config";
import { getDb } from "../db";
import { reminders, lessons } from "../../drizzle/schema";
import { eq, desc, inArray } from "drizzle-orm";

async function run() {
  const db = await getDb();
  if (!db) return;

  const rems = await db.select().from(reminders).where(eq(reminders.type, "aula")).orderBy(desc(reminders.id)).limit(20);
  
  console.log("Last 20 aula reminders:");
  for (const r of rems) {
    let type = "unknown";
    if (r.lessonId) {
      const ls = await db.select({ lessonType: lessons.lessonType }).from(lessons).where(eq(lessons.id, r.lessonId)).limit(1);
      if (ls.length > 0) type = ls[0].lessonType;
    }
    console.log(`ID: ${r.id} | Lesson: ${r.lessonId} (${type}) | Status: ${r.status} | RefId: ${r.refId} | Sched: ${r.scheduledAt}`);
  }

  process.exit(0);
}

run().catch(console.error);

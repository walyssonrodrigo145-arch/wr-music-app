import "dotenv/config";
import { getDb } from "../db";
import { reminders, lessons, students } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

async function run() {
  const db = await getDb();
  if (!db) return;

  const rems = await db.select({
    id: reminders.id,
    lessonId: reminders.lessonId,
    status: reminders.status,
    refId: reminders.refId,
    scheduledAt: reminders.scheduledAt,
    type: reminders.type
  }).from(reminders).where(eq(reminders.status, "pendente"));
  
  console.log(`Found ${rems.length} pending reminders.`);
  for (const r of rems) {
    if (r.type !== 'aula') continue;
    let type = "unknown";
    let isRec = false;
    let title = "";
    if (r.lessonId) {
      const ls = await db.select({ lessonType: lessons.lessonType, recurringGroupId: lessons.recurringGroupId, title: lessons.title }).from(lessons).where(eq(lessons.id, r.lessonId)).limit(1);
      if (ls.length > 0) {
        type = ls[0].lessonType;
        isRec = !!ls[0].recurringGroupId;
        title = ls[0].title || "";
      }
    }
    console.log(`ID: ${r.id} | Lesson: ${r.lessonId} (${type}, rec: ${isRec}) | Title: ${title} | RefId: ${r.refId} | Sched: ${r.scheduledAt}`);
  }

  process.exit(0);
}

run().catch(console.error);

import "dotenv/config";
import { getDb } from "../db";
import { reminders, lessons } from "../../drizzle/schema";
import { eq, inArray } from "drizzle-orm";

async function run() {
  const db = await getDb();
  if (!db) return;

  const turmaLessons = await db.select({ id: lessons.id }).from(lessons).where(eq(lessons.lessonType, "turma"));
  const turmaLessonIds = turmaLessons.map(l => l.id);

  if (turmaLessonIds.length > 0) {
    const allReminders = await db.select({ id: reminders.id, lessonId: reminders.lessonId }).from(reminders);
    const idsToDelete = allReminders.filter(r => r.lessonId && turmaLessonIds.includes(r.lessonId)).map(r => r.id);
    
    if (idsToDelete.length > 0) {
      await db.delete(reminders).where(inArray(reminders.id, idsToDelete));
    }
  }
  process.exit(0);
}

run().catch(console.error);

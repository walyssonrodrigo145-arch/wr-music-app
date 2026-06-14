import "dotenv/config";
import { getDb } from "../db";
import { reminders } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

async function run() {
  const db = await getDb();
  if (!db) return;

  const rems = await db.select().from(reminders).where(eq(reminders.status, "pendente"));
  
  const byLesson: Record<number, number> = {};
  for (const r of rems) {
    if (r.lessonId) {
      byLesson[r.lessonId] = (byLesson[r.lessonId] || 0) + 1;
    }
  }

  const duplicates = Object.entries(byLesson).filter(([k, v]) => v > 1);
  console.log("Lessons with multiple pending reminders:", duplicates);

  process.exit(0);
}

run().catch(console.error);

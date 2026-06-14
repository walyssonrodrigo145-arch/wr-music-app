import "dotenv/config";
import { getDb } from "../db";
import { reminders } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

async function run() {
  const db = await getDb();
  if (!db) return;

  const rems = await db.select().from(reminders).where(eq(reminders.lessonId, 117));
  
  console.log(`Lesson 117 has ${rems.length} reminders:`);
  for (const r of rems) {
    console.log(`ID: ${r.id} | Status: ${r.status} | RefId: ${r.refId} | Sched: ${r.scheduledAt}`);
  }

  const allPending = await db.select().from(reminders).where(eq(reminders.status, "pendente"));
  console.log(`\nTotal pending reminders: ${allPending.length}`);

  process.exit(0);
}

run().catch(console.error);

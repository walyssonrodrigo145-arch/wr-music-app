import "dotenv/config";
import { getDb } from "../db";
import { reminders } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";

async function run() {
  const db = await getDb();
  if (!db) return;
  const rems = await db.select().from(reminders).orderBy(desc(reminders.id)).limit(30);
  
  const duplicated = rems.filter(r => r.type === "aula");
  console.log("Últimos lembretes de aula criados no BD:");
  duplicated.forEach(r => {
    console.log(`ID: ${r.id} | Lesson: ${r.lessonId} | Status: ${r.status} | RefId: ${r.refId} | Date: ${r.scheduledAt}`);
  });
  process.exit(0);
}

run().catch(console.error);

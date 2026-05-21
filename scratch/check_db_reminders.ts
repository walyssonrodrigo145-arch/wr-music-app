import { getDb } from "../server/db";
import { reminders, settings } from "../drizzle/schema";
import { desc } from "drizzle-orm";

async function main() {
  const db = await getDb();
  if (!db) {
    console.error("No DB connection");
    return;
  }
  
  console.log("--- SETTINGS ---");
  const allSettings = await db.select().from(settings);
  for (const s of allSettings) {
    console.log(`User: ${s.userId}, URL: ${s.whatsappBotUrl}, Token: ${s.whatsappBotToken}, AutoSend: ${s.whatsappAutoSend}, AutomationEnabled: ${s.automationEnabled}`);
  }

  console.log("\n--- REMINDERS ---");
  const allReminders = await db.select().from(reminders).orderBy(desc(reminders.scheduledAt)).limit(20);
  for (const r of allReminders) {
    console.log(`ID: ${r.id}, Student: ${r.studentId}, Type: ${r.type}, Message: ${r.message.slice(0, 40)}..., Status: ${r.status}, ScheduledAt: ${r.scheduledAt}, CreatedAt: ${r.createdAt}, RefId: ${r.refId}, Error: ${r.errorMessage}`);
  }
  process.exit(0);
}

main().catch(console.error);

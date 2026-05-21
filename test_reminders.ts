import 'dotenv/config';
import { getDb } from "./server/db";
import { reminders, lessons, settings } from "./drizzle/schema";
import { desc, eq, or, and } from "drizzle-orm";

async function run() {
  const db = await getDb();
  if (!db) return console.error("No DB");

  const todayStr = new Date().toISOString().slice(0, 10);
  
  const setts = await db.select({ url: settings.whatsappBotUrl }).from(settings).where(eq(settings.userId, 163));
  console.log("Settings URL:", setts);
  
  process.exit(0);
}

run();

import { getDb } from "./server/db";
import { sql } from "drizzle-orm";
import "dotenv/config";

async function main() {
  const db = await getDb();
  if (!db) {
    console.error("No db connected");
    process.exit(1);
  }

  try {
    console.log("Running manual migrations...");
    await db.execute(sql`ALTER TABLE students ADD COLUMN "allowAutoReminders" boolean DEFAULT true NOT NULL;`);
    console.log("students table altered.");
  } catch (e: any) {
    console.log("students table alter failed (might already exist):", e.message);
  }

  try {
    await db.execute(sql`ALTER TABLE "messageAutomationRules" ADD COLUMN "sendToStudent" integer DEFAULT 1 NOT NULL;`);
    console.log("messageAutomationRules sendToStudent altered.");
  } catch (e: any) {
    console.log("messageAutomationRules sendToStudent alter failed:", e.message);
  }

  try {
    await db.execute(sql`ALTER TABLE "messageAutomationRules" ADD COLUMN "sendToGuardian" integer DEFAULT 0 NOT NULL;`);
    console.log("messageAutomationRules sendToGuardian altered.");
  } catch (e: any) {
    console.log("messageAutomationRules sendToGuardian alter failed:", e.message);
  }

  console.log("Done.");
  process.exit(0);
}

main();

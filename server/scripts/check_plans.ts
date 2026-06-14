import "dotenv/config";
import { getDb } from "../db";
import { dailyStudyPlans } from "../../drizzle/schema";

async function run() {
  const db = await getDb();
  if (!db) return;

  const plans = await db.select().from(dailyStudyPlans);
  console.log(`Found ${plans.length} plans:`);
  for (const p of plans) {
    console.log(`ID: ${p.id} | Student: ${p.studentId} | Status: ${p.status} | PubStatus: ${p.publishedStatus}`);
  }

  process.exit(0);
}

run().catch(console.error);

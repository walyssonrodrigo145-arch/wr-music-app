import "dotenv/config";
import { getDb } from "../db";
import { dailyStudyPlans } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";

async function run() {
  const db = await getDb();
  if (!db) return;

  const [plan] = await db.select()
    .from(dailyStudyPlans)
    .where(and(
      eq(dailyStudyPlans.studentId, 8), 
      eq(dailyStudyPlans.status, 'ativo'),
      eq(dailyStudyPlans.publishedStatus, 'publicado')
    ))
    .orderBy(desc(dailyStudyPlans.createdAt))
    .limit(1);

  console.log("Active plan for student 8:", plan ? "FOUND" : "NOT FOUND", plan);
  process.exit(0);
}

run().catch(console.error);

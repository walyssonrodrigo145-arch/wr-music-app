import "dotenv/config";
import { getDb } from "../db";
import { dailyStudyPlans } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

async function run() {
  const db = await getDb();
  if (!db) return;

  const plans = await db.select().from(dailyStudyPlans).where(eq(dailyStudyPlans.status, 'ativo'));
  console.log(`Active plans:`, plans);

  // simulate publish for ID 7
  if (plans.length > 0) {
    const p = plans[0];
    const res = await db.update(dailyStudyPlans)
      .set({ publishedStatus: 'publicado' })
      .where(and(eq(dailyStudyPlans.id, p.id), eq(dailyStudyPlans.organizationId, p.organizationId)))
      .returning();
    console.log("Updated:", res);
  }

  process.exit(0);
}

run().catch(console.error);

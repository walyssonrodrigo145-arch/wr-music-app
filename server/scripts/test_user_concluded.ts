import "dotenv/config";
import { getDb } from "../db";
import { reminders, lessons } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

async function run() {
  const db = await getDb();
  if (!db) return;

  // Set ID 1442 to enviado
  await db.update(reminders).set({ status: "enviado" }).where(eq(reminders.id, 1442));
  console.log("Set 1442 to enviado");

  // Run the userConcludedAula check
  const lessonId = 117;
  const orgId = 1; // Assuming org 1
  const userConcludedAula = await db.select({ id: reminders.id }).from(reminders)
    .where(and(
      eq(reminders.organizationId, orgId),
      eq(reminders.lessonId, lessonId),
      eq(reminders.status, "enviado")
    )).limit(1);

  console.log("userConcludedAula:", userConcludedAula);

  process.exit(0);
}

run().catch(console.error);

import { db } from "./db";
import { lessons } from "./schema";
import { eq, sql } from "drizzle-orm";

async function run() {
  console.log("Checking all lessons marked as 'falta'...");
  const allMissedLessons = await db.query.lessons.findMany({
    where: (lessons, { eq }) => eq(lessons.status, "falta")
  });
  console.log(`Found ${allMissedLessons.length} total lessons marked as 'falta'.`);
  
  if (allMissedLessons.length > 0) {
    console.log("Updating to 'agendada'...");
    await db.update(lessons)
      .set({ status: "agendada" })
      .where(
        eq(lessons.status, "falta")
      );
    console.log("All 'falta' lessons reset to 'agendada'.");
  }

  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});

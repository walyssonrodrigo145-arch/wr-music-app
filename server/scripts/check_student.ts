import "dotenv/config";
import { getDb } from "../db";
import { students } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

async function run() {
  const db = await getDb();
  if (!db) return;

  const [s] = await db.select().from(students).where(eq(students.id, 8));
  console.log("Student 8:", s ? `UserId: ${s.studentUserId}` : "Not found");

  process.exit(0);
}

run().catch(console.error);

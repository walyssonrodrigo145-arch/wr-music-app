import { getDb } from "./server/db";
import { students } from "./drizzle/schema";
import "dotenv/config";

async function run() {
  try {
    const db = await getDb();
    if (!db) {
      console.log("NO DB CONNECTION");
      return;
    }
    const res = await db.select().from(students).limit(1);
    console.log("QUERY SUCCESS:", res.length > 0 ? res[0] : "empty");
  } catch(e) {
    console.error("QUERY ERROR:", e);
  }
  process.exit(0);
}

run();

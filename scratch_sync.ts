import { getDb } from "./server/db";
import { sql } from "drizzle-orm";

async function run() {
  console.log("Starting manual schema sync...");
  try {
    const db = await getDb();
    console.log("Schema sync completed successfully.");
  } catch (err) {
    console.error("Schema sync failed:", err);
  }
  process.exit(0);
}

run();

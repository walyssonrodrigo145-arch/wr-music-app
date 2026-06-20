import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { messageAutomationRules } from "./drizzle/schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("No DATABASE_URL");
  process.exit(1);
}

const client = postgres(connectionString);
const db = drizzle(client);

async function run() {
  try {
    const [rule] = await db
      .insert(messageAutomationRules)
      .values({
        organizationId: 1,
        userId: 1,
        name: "Test Rule",
        trigger: "payment_due",
        messageTemplate: "Test",
        channel: "whatsapp"
      })
      .returning();
    console.log("Success:", rule);
  } catch (error) {
    console.error("DB Error:", error);
  } finally {
    process.exit(0);
  }
}
run().catch(console.error);

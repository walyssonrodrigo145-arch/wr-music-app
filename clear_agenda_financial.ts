import postgres from 'postgres';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') });

const sql = postgres(process.env.DATABASE_URL as string);

async function main() {
  console.log("Cleaning up financial and agenda history via Postgres...");
  
  try {
    const r1 = await sql`DELETE FROM reminders`;
    console.log(`Deleted ${r1.count} reminders.`);

    const r2 = await sql`DELETE FROM lessons`;
    console.log(`Deleted ${r2.count} lessons.`);

    const r3 = await sql`DELETE FROM payment_dues`;
    console.log(`Deleted ${r3.count} payment dues.`);

    const r4 = await sql`DELETE FROM expenses`;
    console.log(`Deleted ${r4.count} expenses.`);

    console.log("Clean up successful!");
  } catch (error) {
    console.error("Error during clean up:", error);
  } finally {
    await sql.end();
  }

  process.exit(0);
}

main();

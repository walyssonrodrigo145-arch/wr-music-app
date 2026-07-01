import { db } from "./server/_core/db";
import { getDb } from "./server/db";
import { paymentDues, users, students } from "./drizzle/schema";
import { eq, and, gte, lte } from "drizzle-orm";

async function test() {
  const dbInst = await getDb();
  if (!dbInst) {
    console.log("No DB");
    return;
  }
  
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1);
  
  console.log("startOfDay:", startOfDay.toISOString());
  console.log("endOfDay:", endOfDay.toISOString());

  const allPayments = await dbInst.select().from(paymentDues).where(eq(paymentDues.status, 'pago'));
  
  console.log("All paid payments:");
  for (const p of allPayments) {
    console.log(`ID: ${p.id}, Amount: ${p.amount}, paidAt: ${p.paidAt}, dueDate: ${p.dueDate}`);
  }

  process.exit(0);
}

test().catch(console.error);

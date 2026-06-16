import { getDb } from "./server/db";
import { reminders } from "./drizzle/schema";
import { eq, and, ne } from "drizzle-orm";

async function fix() {
  const db = await getDb();
  if (!db) return;

  const all = await db.select().from(reminders);
  console.log(`Total reminders: ${all.length}`);

  let deleted = 0;

  // 1. Delete all pending reminders for lessons/payments that ALREADY HAVE an 'enviado' reminder
  const sentLessonIds = new Set(all.filter(r => r.status === "enviado" && r.lessonId).map(r => r.lessonId));
  const sentPaymentIds = new Set(all.filter(r => r.status === "enviado" && r.paymentDueId).map(r => r.paymentDueId));

  for (const r of all) {
    if (r.status === "pendente") {
      if ((r.lessonId && sentLessonIds.has(r.lessonId)) || 
          (r.paymentDueId && sentPaymentIds.has(r.paymentDueId))) {
        await db.delete(reminders).where(eq(reminders.id, r.id));
        deleted++;
        continue;
      }
    }
  }

  // 2. Delete duplicates among pending reminders (keep only 1 per lesson or payment)
  const pending = await db.select().from(reminders).where(eq(reminders.status, "pendente"));
  const seenLessons = new Set();
  const seenPayments = new Set();

  for (const r of pending) {
    if (r.lessonId) {
      if (seenLessons.has(r.lessonId)) {
        await db.delete(reminders).where(eq(reminders.id, r.id));
        deleted++;
      } else {
        seenLessons.add(r.lessonId);
      }
    } else if (r.paymentDueId) {
      if (seenPayments.has(r.paymentDueId)) {
        await db.delete(reminders).where(eq(reminders.id, r.id));
        deleted++;
      } else {
        seenPayments.add(r.paymentDueId);
      }
    }
  }

  console.log(`Deleted ${deleted} duplicate/obsolete pending reminders.`);
  process.exit(0);
}

fix().catch(console.error);

import * as dotenv from "dotenv";
dotenv.config();

import { getDb } from "./server/db";
import { paymentDues, users, students, lessons } from "./drizzle/schema";
import { eq, and, gte, lte, sql, inArray, desc } from "drizzle-orm";

async function test() {
  try {
    const db = await getDb();
    if (!db) {
      console.log("No DB");
      return;
    }
    
    const orgId = 1;
    const isUserAdmin = true;
    const userId = 1;
    const isProfessor = false;

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1);
    
    const startOfWeek = new Date(now);
    startOfWeek.setHours(0, 0, 0, 0);
    startOfWeek.setDate(now.getDate() - now.getDay());

    let professorStudentIds: number[] | undefined = undefined;

    const baseLessonCondition = professorStudentIds
      ? (professorStudentIds.length > 0 ? inArray(lessons.studentId, professorStudentIds) : sql`false`)
      : (isUserAdmin ? undefined : eq(lessons.userId, userId));

    const aulasHojeRes = await db.select({ count: sql<number>`count(*)` })
      .from(lessons)
      .where(and(
        eq(lessons.organizationId, orgId),
        baseLessonCondition,
        gte(lessons.scheduledAt, startOfDay),
        lte(lessons.scheduledAt, endOfDay)
      ));
    
    console.log("aulasHojeRes:", aulasHojeRes);

    const recebidoRes = await db.select({ total: sql<number>`sum(${paymentDues.amount})` })
      .from(paymentDues)
      .where(and(
        eq(paymentDues.organizationId, orgId),
        undefined, // basePaymentCondition
        eq(paymentDues.status, 'pago'),
        gte(paymentDues.paidAt, startOfDay),
        lte(paymentDues.paidAt, endOfDay)
      ));
    
    console.log("recebidoRes:", recebidoRes);
    
    let professorDestaque = "Nenhum definido";
    if (isUserAdmin) {
      const destRes = await db.select({ 
          profName: users.name, 
          count: sql<number>`count(${lessons.id})`.as('count') 
        })
        .from(lessons)
        .innerJoin(students, eq(lessons.studentId, students.id))
        .innerJoin(users, eq(students.professorId, users.id))
        .where(and(
          eq(lessons.organizationId, orgId),
          eq(lessons.status, 'concluida'),
          gte(lessons.scheduledAt, startOfDay),
          lte(lessons.scheduledAt, endOfDay)
        ))
        .groupBy(users.name)
        .orderBy(desc(sql`count`))
        .limit(1);

      if (destRes.length > 0) {
        professorDestaque = destRes[0].profName;
      }
    }
    
    console.log("professorDestaque:", professorDestaque);

    console.log("Success");
  } catch(e) {
    console.error("ERROR:");
    console.error(e);
  }
  process.exit(0);
}

test();

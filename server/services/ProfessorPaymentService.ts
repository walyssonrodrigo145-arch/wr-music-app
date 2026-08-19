// Service de folha de pagamento de professores — AUDIT F5
// Núcleo único de cálculo + upsert compartilhado por professorPayments.calculate
// e professorPayments.calculateAll (antes copiado literalmente nos dois).
import { and, eq, gte, inArray, lt, or } from "drizzle-orm";
import { lessons, professorPayments, students } from "../../drizzle/schema";

export interface ProfessorPaymentCalculation {
  paymentId: number;
  professorId: number;
  totalClasses: number;
  totalMinutes: number;
  totalCredits: number;
  totalAmount: number;
}

export async function calculateAndSaveProfessorPayment(
  db: any,
  orgId: number,
  prof: any,
  month: number,
  year: number
): Promise<ProfessorPaymentCalculation> {
  // Date range for the month
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);

  // Get students for this professor
  const profStudents: any[] = await db.select({ id: students.id }).from(students).where(and(
    eq(students.organizationId, orgId),
    eq(students.professorId, prof.userId)
  ));
  const professorStudentIds = profStudents.map(s => s.id);

  const lessonCondition = professorStudentIds.length > 0
    ? or(eq(lessons.userId, prof.userId), inArray(lessons.studentId, professorStudentIds))
    : eq(lessons.userId, prof.userId);

  // Get completed lessons for this professor in the given month
  const completedLessons: any[] = await db.select({
    id: lessons.id,
    duration: lessons.duration,
    studentId: lessons.studentId,
  })
    .from(lessons)
    .where(and(
      eq(lessons.organizationId, orgId),
      lessonCondition,
      eq(lessons.status, "concluida"),
      gte(lessons.scheduledAt, startDate),
      lt(lessons.scheduledAt, endDate),
    ));

  const totalClasses = completedLessons.length;
  const totalMinutes = completedLessons.reduce((sum, l) => sum + (l.duration || 60), 0);
  let totalCredits = 0;

  if (prof.paymentType === "fixo") {
    // Fixed rate: totalMinutes / 60 * hourlyRate
    const hourlyRate = parseFloat(prof.hourlyRate || "0");
    totalCredits = (totalMinutes / 60) * hourlyRate;
  } else if (prof.paymentType === "porcentagem") {
    // Percentage: sum of monthly fees for students who had lessons * percentage / 100
    const uniqueStudentIds = Array.from(new Set(completedLessons.map(l => l.studentId).filter(Boolean))) as number[];
    if (uniqueStudentIds.length > 0) {
      const studentList: any[] = await db.select({
        id: students.id,
        monthlyFee: students.monthlyFee,
      })
        .from(students)
        .where(and(
          eq(students.organizationId, orgId),
          inArray(students.id, uniqueStudentIds),
        ));

      const totalFees = studentList.reduce((sum, s) => sum + parseFloat(s.monthlyFee || "0"), 0);
      const percentage = parseFloat(prof.paymentPercentage || "0");
      totalCredits = (totalFees * percentage) / 100;
    }
  }

  const totalAmount = totalCredits; // totalAmount = totalCredits - totalDebits (debits can be added later)

  // Upsert: check if a payment record already exists for this professor/month/year
  const [existing] = await db.select()
    .from(professorPayments)
    .where(and(
      eq(professorPayments.organizationId, orgId),
      eq(professorPayments.professorId, prof.id),
      eq(professorPayments.month, month),
      eq(professorPayments.year, year),
    ))
    .limit(1);

  let paymentId: number;
  if (existing) {
    await db.update(professorPayments)
      .set({
        totalClasses,
        totalMinutes,
        totalCredits: totalCredits.toFixed(2),
        totalAmount: totalAmount.toFixed(2),
        status: "aberto",
        updatedAt: new Date(),
      })
      .where(eq(professorPayments.id, existing.id));
    paymentId = existing.id;
  } else {
    const [newPayment] = await db.insert(professorPayments).values({
      organizationId: orgId,
      professorId: prof.id,
      month,
      year,
      totalClasses,
      totalMinutes,
      totalCredits: totalCredits.toFixed(2),
      totalDebits: "0.00",
      totalAmount: totalAmount.toFixed(2),
      status: "aberto",
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning({ id: professorPayments.id });
    paymentId = newPayment.id;
  }

  return { paymentId, professorId: prof.id, totalClasses, totalMinutes, totalCredits, totalAmount };
}
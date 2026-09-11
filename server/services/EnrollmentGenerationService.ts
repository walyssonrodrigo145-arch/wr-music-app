// ─── EnrollmentGenerationService ──────────────────────────────────────────────
// Gera automaticamente, a partir das matrículas escolhidas no link público:
//   • Aulas semanais (na quantidade de aulas/semana do plano) pela duração do curso.
//   • Mensalidades (payment_dues) para os meses seguintes, com o dia de vencimento
//     configurado pela escola. O 1º mês é pago no ato da matrícula.
import { and, eq, gte, lte } from "drizzle-orm";
import { lessons, paymentDues } from "../../drizzle/schema";

function pad(n: number): string { return String(n).padStart(2, "0"); }

/** Próxima ocorrência (a partir de amanhã) de um dia da semana, no fuso BRT. */
function nextOccurrence(weekday: number): Date {
  const brt = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  brt.setHours(0, 0, 0, 0);
  let diff = (weekday - brt.getDay() + 7) % 7;
  if (diff === 0) diff = 7; // hoje → semana que vem
  brt.setDate(brt.getDate() + diff);
  return brt;
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export interface EnrollmentLessonInput {
  orgId: number;
  studentId: number;
  teacherUserId: number;
  studioRoomId?: number | null;
  instrumentId: number;
  courseName: string;
  durationMonths: number;
  lessonsPerWeek: number;
  weekday: number; // 0=Dom..6=Sáb
  timeStr: string; // HH:mm
  durationMin: number;
}

/** Gera as aulas semanais do curso. Retorna a quantidade criada. */
export async function generateLessonsForEnrollment(db: any, input: EnrollmentLessonInput): Promise<number> {
  const { orgId, studentId, teacherUserId, studioRoomId, instrumentId, courseName } = input;
  const lessonsPerWeek = Math.max(1, Math.min(3, input.lessonsPerWeek || 1));
  const durationMonths = Math.max(1, input.durationMonths || 1);
  if (!input.timeStr) return 0;

  const start = nextOccurrence(input.weekday);
  const end = new Date(start);
  end.setMonth(end.getMonth() + durationMonths);

  // Dias da semana das aulas (escolhido + a cada 2 dias p/ aulas/semana > 1)
  const offsets: number[] = [];
  for (let i = 0; i < lessonsPerWeek; i++) offsets.push((i * 2) % 7);

  let created = 0;
  const weekCursor = new Date(start);
  while (weekCursor < end) {
    for (const off of offsets) {
      const d = new Date(weekCursor);
      d.setDate(d.getDate() + off);
      if (d >= end) continue;
      const dateStr = toDateStr(d);
      const scheduledAt = new Date(`${dateStr}T${input.timeStr}:00.000-03:00`);
      if (isNaN(scheduledAt.getTime())) continue;

      // Conflito com aula já existente do professor
      const slotEnd = scheduledAt.getTime() + input.durationMin * 60_000;
      const sameDay = await db.select({ scheduledAt: lessons.scheduledAt, duration: lessons.duration })
        .from(lessons)
        .where(and(
          eq(lessons.organizationId, orgId),
          eq(lessons.userId, teacherUserId),
          eq(lessons.status, "agendada"),
          gte(lessons.scheduledAt, new Date(scheduledAt.getTime() - 12 * 3_600_000)),
          lte(lessons.scheduledAt, new Date(scheduledAt.getTime() + 12 * 3_600_000)),
        ));
      const conflict = sameDay.some((l: any) => {
        const s = new Date(l.scheduledAt).getTime();
        const e = s + (l.duration || 60) * 60_000;
        return scheduledAt.getTime() < e && slotEnd > s;
      });
      if (conflict) continue;

      await db.insert(lessons).values({
        organizationId: orgId,
        userId: teacherUserId,
        studentId,
        title: `Aula de ${courseName}`,
        scheduledAt,
        duration: input.durationMin,
        status: "agendada",
        instrumentId,
        studioRoomId: studioRoomId || undefined,
      });
      created++;
    }
    weekCursor.setDate(weekCursor.getDate() + 7);
  }
  return created;
}

export interface DuesInput {
  orgId: number;
  userId: number;
  studentId: number;
  courses: { monthlyFee: number; durationMonths: number }[];
  dueDay: number;
  startMonth: number; // 1-12
  startYear: number;
}

/**
 * Gera as mensalidades dos meses seguintes (o 1º mês é pago no ato da matrícula).
 * Cada mês soma apenas os cursos ainda vigentes naquele mês.
 */
export async function generateMonthlyDues(db: any, input: DuesInput): Promise<number> {
  const courses = (input.courses || []).filter(c => c.monthlyFee > 0 && c.durationMonths > 0);
  if (courses.length === 0) return 0;
  const dueDay = Math.max(1, Math.min(31, input.dueDay || 10));
  const maxDur = Math.max(...courses.map(c => c.durationMonths));
  let created = 0;
  for (let i = 1; i < maxDur; i++) {
    const amount = courses.reduce((sum, c) => (c.durationMonths > i ? sum + c.monthlyFee : sum), 0);
    if (amount <= 0) continue;
    const d = new Date(input.startYear, input.startMonth - 1 + i, 1);
    const y = d.getFullYear();
    const mo = d.getMonth() + 1;
    const lastDay = new Date(y, mo, 0).getDate();
    const day = Math.min(dueDay, lastDay);
    const dueDate = `${y}-${pad(mo)}-${pad(day)}`;
    await db.insert(paymentDues).values({
      organizationId: input.orgId,
      userId: input.userId,
      studentId: input.studentId,
      amount: amount.toFixed(2),
      dueDate,
      month: mo,
      year: y,
      status: "pendente",
      billingPeriodicity: "mensal",
    });
    created++;
  }
  return created;
}

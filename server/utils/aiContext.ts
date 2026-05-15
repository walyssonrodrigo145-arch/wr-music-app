import { and, eq, lte, asc, desc, sql, inArray } from "drizzle-orm";
import { students, lessons, paymentDues, reminders, settings } from "../../drizzle/schema";

export async function buildUserContext(db: any, userId: number, orgId: number): Promise<string> {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  try {
    // 1. Busca configurações básicas
    const [userSettings] = await db.select().from(settings).where(
      and(eq(settings.userId, userId), eq(settings.organizationId, orgId))
    ).limit(1);

    // 2. Busca total de alunos ativos
    const activeStudents = await db.select({ id: students.id }).from(students).where(
      and(eq(students.status, "ativo"), eq(students.professorId, userId), eq(students.organizationId, orgId))
    );

    // 3. Busca aulas agendadas para os próximos 7 dias
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const upcomingLessons = await db.select({
      title: lessons.title,
      scheduledAt: lessons.scheduledAt,
      studentName: students.name,
    }).from(lessons)
      .leftJoin(students, eq(lessons.studentId, students.id))
      .where(
        and(
          eq(lessons.userId, userId),
          eq(lessons.organizationId, orgId),
          inArray(lessons.status, ["agendada", "remarcada"]),
          lte(lessons.scheduledAt, nextWeek)
        )
      )
      .orderBy(asc(lessons.scheduledAt))
      .limit(10);

    // 4. Busca mensalidades atrasadas
    const overduePayments = await db.select({
      amount: paymentDues.amount,
      dueDate: paymentDues.dueDate,
      studentName: students.name,
    }).from(paymentDues)
      .leftJoin(students, eq(paymentDues.studentId, students.id))
      .where(
        and(
          eq(paymentDues.userId, userId),
          eq(paymentDues.organizationId, orgId),
          eq(paymentDues.status, "pendente"),
          sql`${paymentDues.dueDate} < ${todayStr}::date`
        )
      )
      .orderBy(asc(paymentDues.dueDate))
      .limit(10);

    // 5. Busca receita mensal prevista e realizada (mês atual)
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const paymentsThisMonth = await db.select({
      amount: paymentDues.amount,
      status: paymentDues.status,
    }).from(paymentDues).where(
      and(
        eq(paymentDues.userId, userId),
        eq(paymentDues.organizationId, orgId),
        eq(paymentDues.month, currentMonth),
        eq(paymentDues.year, currentYear)
      )
    );

    let totalPrevisto = 0;
    let totalPago = 0;
    paymentsThisMonth.forEach((p: any) => {
      const amt = Number(p.amount);
      totalPrevisto += amt;
      if (p.status === "pago") totalPago += amt;
    });

    // Formatação do contexto
    const tz = "America/Sao_Paulo";
    let context = `Escola: ${userSettings?.schoolName || "Minha Escola de Música"}\n`;
    context += `Data Atual: ${now.toLocaleDateString("pt-BR", { timeZone: tz })} - ${now.toLocaleTimeString("pt-BR", { timeZone: tz, hour: '2-digit', minute: '2-digit' })}\n`;
    context += `Alunos ativos: ${activeStudents.length}\n\n`;

    context += `FINANCEIRO DESTE MÊS (${currentMonth}/${currentYear}):\n`;
    context += `- Receita total prevista: R$ ${totalPrevisto.toFixed(2)}\n`;
    context += `- Receita já paga: R$ ${totalPago.toFixed(2)}\n\n`;

    if (overduePayments.length > 0) {
      context += `ATENÇÃO - MENSALIDADES ATRASADAS (${overduePayments.length} registros mais antigos):\n`;
      overduePayments.forEach((p: any) => {
        context += `- Aluno: ${p.studentName} | Vencimento: ${p.dueDate} | Valor: R$ ${Number(p.amount).toFixed(2)}\n`;
      });
      context += `\n`;
    } else {
      context += `Sem mensalidades atrasadas no momento.\n\n`;
    }

    if (upcomingLessons.length > 0) {
      context += `PRÓXIMAS AULAS (próximos 7 dias):\n`;
      upcomingLessons.forEach((l: any) => {
        const d = new Date(l.scheduledAt);
        const dateStr = d.toLocaleDateString("pt-BR", { timeZone: tz });
        const timeStr = d.toLocaleTimeString("pt-BR", { timeZone: tz, hour: '2-digit', minute: '2-digit' });
        context += `- ${dateStr} às ${timeStr} | Aluno: ${l.studentName || 'Sem nome'} | Aula: ${l.title}\n`;
      });
      context += `\n`;
    }

    return context;

  } catch (err) {
    console.error("[buildUserContext Error]", err);
    return "Erro ao carregar contexto atual. Limite-se a responder de forma genérica baseada em gestão de aulas de música.";
  }
}

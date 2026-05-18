import { and, eq, lte, asc, desc, sql, inArray } from "drizzle-orm";
import { students, lessons, paymentDues, reminders, settings, expenses } from "../../drizzle/schema";

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

    // 3. Busca aulas agendadas para os próximos 7 dias a partir do início de hoje
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
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
          gte(lessons.scheduledAt, startOfDay),
          lte(lessons.scheduledAt, nextWeek),
          eq(students.status, "ativo")
        )
      )
      .orderBy(asc(lessons.scheduledAt))
      .limit(20);

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
          sql`${paymentDues.dueDate} < ${todayStr}::date`,
          eq(students.status, "ativo")
        )
      )
      .orderBy(asc(paymentDues.dueDate))
      .limit(20);

    // 5. Busca receita mensal prevista e realizada (mês atual)
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const paymentsThisMonth = await db.select({
      amount: paymentDues.amount,
      status: paymentDues.status,
      studentStatus: students.status,
    }).from(paymentDues)
      .leftJoin(students, eq(paymentDues.studentId, students.id))
      .where(
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
      if (p.status === "pago" || p.studentStatus === "ativo") {
        totalPrevisto += amt;
      }
      if (p.status === "pago") totalPago += amt;
    });

    // 6. Busca despesas do mês atual
    const expensesThisMonth = await db.select({
      amount: expenses.amount,
      status: expenses.status
    }).from(expenses)
      .where(
        and(
          eq(expenses.userId, userId),
          eq(expenses.organizationId, orgId),
          sql`EXTRACT(MONTH FROM ${expenses.date}) = ${currentMonth}`,
          sql`EXTRACT(YEAR FROM ${expenses.date}) = ${currentYear}`
        )
      );

    let totalDespesasPagas = 0;
    expensesThisMonth.forEach((e: any) => {
      if (e.status === "pago") totalDespesasPagas += Number(e.amount);
    });

    // 7. Busca receita base recorrente e despesa base recorrente para projeções
    const activeStudentsList = await db.select({ monthlyFee: students.monthlyFee }).from(students).where(
      and(eq(students.status, "ativo"), eq(students.professorId, userId), eq(students.organizationId, orgId))
    );
    const receitaRecorrente = activeStudentsList.reduce((acc: number, s: any) => acc + Number(s.monthlyFee || 0), 0);

    const recurringExpensesList = await db.select({ amount: expenses.amount }).from(expenses).where(
      and(eq(expenses.userId, userId), eq(expenses.organizationId, orgId), eq(expenses.recurrence, "mensal"))
    );
    const despesaRecorrente = recurringExpensesList.reduce((acc: number, e: any) => acc + Number(e.amount || 0), 0);

    // Formatação do contexto
    const tz = "America/Sao_Paulo";
    let context = `Escola: ${userSettings?.schoolName || "Minha Escola de Música"}\n`;
    context += `Data Atual: ${now.toLocaleDateString("pt-BR", { timeZone: tz })} - ${now.toLocaleTimeString("pt-BR", { timeZone: tz, hour: '2-digit', minute: '2-digit' })}\n`;
    context += `Alunos ativos: ${activeStudents.length}\n\n`;

    context += `FINANCEIRO DESTE MÊS (${currentMonth}/${currentYear}):\n`;
    context += `- Receita total prevista: R$ ${totalPrevisto.toFixed(2)}\n`;
    context += `- Receita já paga: R$ ${totalPago.toFixed(2)}\n`;
    context += `- Despesas pagas: R$ ${totalDespesasPagas.toFixed(2)}\n`;
    context += `- Saldo Líquido atual: R$ ${(totalPago - totalDespesasPagas).toFixed(2)}\n\n`;

    context += `PROJEÇÃO FINANCEIRA FUTURA (BASE RECORRENTE MENSAL):\n`;
    context += `- Receita Mensal Recorrente (soma das mensalidades de alunos ativos): R$ ${receitaRecorrente.toFixed(2)}\n`;
    context += `- Despesa Mensal Recorrente (soma das despesas fixas mensais): R$ ${despesaRecorrente.toFixed(2)}\n`;
    context += `- Lucro Mensal Recorrente Projetado: R$ ${(receitaRecorrente - despesaRecorrente).toFixed(2)}\n\n`;
    context += `REGRA DE CÁLCULO PARA PROJEÇÕES DE GANHOS FUTUROS (MUITO IMPORTANTE):\n`;
    context += `Quando o usuário perguntar sobre projeção de ganhos, lucro ou faturamento para daqui a N meses (ex: "quanto posso ter de lucro daqui 3 meses?", "projeção para 6 meses"), você DEVE calcular da seguinte forma:\n`;
    context += `1. Identifique a quantidade N de meses solicitada no prompt do usuário.\n`;
    context += `2. Multiplique a Receita Mensal Recorrente (R$ ${receitaRecorrente.toFixed(2)}) por N para obter a Receita Acumulada de N meses.\n`;
    context += `3. Multiplique a Despesa Mensal Recorrente (R$ ${despesaRecorrente.toFixed(2)}) por N para obter a Despesa Acumulada de N meses.\n`;
    context += `4. O Lucro Total Projetado em N meses será (Receita Mensal Recorrente - Despesa Mensal Recorrente) * N.\n`;
    context += `5. Apresente ao usuário um resumo claro com o valor total acumulado e o detalhamento mensal, explicando de onde vêm os valores (alunos ativos e despesas fixas).\n\n`;

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

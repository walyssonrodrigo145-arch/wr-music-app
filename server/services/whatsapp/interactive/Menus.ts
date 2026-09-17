// ─── Menus (§20/§36) — definições declarativas + handlers de negócio isolados
// por escola/role. PRINCÍPIO: INTERFACE → ACTION → VALIDATION → LOGIC → RESPONSE.

import { and, asc, eq, gt, inArray, sql } from "drizzle-orm";
import { lessons, notifications, paymentDues, reminders, students } from "../../../../drizzle/schema";
import { InteractiveButton, NormalizedInteractiveResponse } from "./types";
import { sendInteractive } from "./InteractiveMessageService";
import { closeSession, getActiveSession, upsertSession } from "./SessionService";

export interface MenuCtx {
  db: any;
  organizationId: number;
  userId: number;          // dono da instância (prof_X)
  role: string;            // 'admin' | 'professor'
  phone: string;
  instanceName: string;
  baseUrl: string;
  apiKey: string;
}

/** Constrói um botão com defaults (order/params). */
export const btn = (id: string, text: string, action: string, params?: Record<string, any>, order?: number): InteractiveButton => ({
  id, text, action, params: params || {}, order: order ?? 0,
});

// ─── Action Router (§10) — navegação + despacho dinâmico ─────────────────────

export async function handleAction(
  ctx: MenuCtx,
  response: NormalizedInteractiveResponse,
  button: InteractiveButton | null
): Promise<boolean> {
  const action = button?.action ?? response.action;
  if (!action) return false;

  const params = { ...(button?.params ?? response.params ?? {}) };

  switch (action) {
    case "main_menu":
      return renderMenu(ctx, "main");

    case "voltar_menu": {
      // BUG FIX (cacabug): ler a sessão ANTES de sobrescrever — antes o
      // upsert já apagava previousMenu e "Voltar" sempre caía no main.
      const session = await getActiveSession(ctx.db, ctx.phone);
      const prev = session?.previousMenu || "main";
      return renderMenu(ctx, prev, true);
    }

    case "encerrar_atendimento": {
      await closeSession(ctx.db, ctx.phone);
      await sendInteractive(ctx.db, {
        organizationId: ctx.organizationId, userId: ctx.userId, phone: ctx.phone,
        menu: "bye", title: "Atendimento encerrado",
        body: "Foi um prazer ajudar! Quando precisar, mande *menu* que eu volto. 👋",
        buttons: [btn("btn_reabrir", "🔁 Abrir menu", "main_menu", {}, 1)],
        instanceName: ctx.instanceName, baseUrl: ctx.baseUrl, apiKey: ctx.apiKey,
      });
      return true;
    }

    case "ajuda":
      return sendHelp(ctx);

    case "alunos_menu":
      return requireMenu(ctx, "alunos", () => renderMenu(ctx, "alunos"));
    case "agenda_menu":
      return requireMenu(ctx, "agenda", () => renderMenu(ctx, "agenda"));
    case "financeiro_menu":
      return requireMenu(ctx, "financeiro", () => renderMenu(ctx, "financeiro"));

    default:
      return routeDynamic(ctx, action, params);
  }
}

/** §15 — permissão por papel: professor não acessa financeiro. */
const MENUS_ADMIN_ONLY = new Set(["financeiro", "relatorios"]);
export function canAccessMenu(role: string, menu: string): boolean {
  if (MENUS_ADMIN_ONLY.has(menu) && role !== "admin") return false;
  return true;
}

async function requireMenu(ctx: MenuCtx, menu: string, fn: () => Promise<boolean>): Promise<boolean> {
  if (!canAccessMenu(ctx.role, menu)) {
    await sendInteractive(ctx.db, {
      organizationId: ctx.organizationId, userId: ctx.userId, phone: ctx.phone,
      menu: "sem_permissao", title: "Acesso restrito",
      body: "Essa opção é restrita à administração da escola. Se precisar de algo, fale com o seu professor.",
      buttons: [btn("btn_menu", "🏠 Menu principal", "main_menu", {}, 1)],
      instanceName: ctx.instanceName, baseUrl: ctx.baseUrl, apiKey: ctx.apiKey,
    });
    return true;
  }
  return fn();
}

async function sendHelp(ctx: MenuCtx): Promise<boolean> {
  await sendInteractive(ctx.db, {
    organizationId: ctx.organizationId, userId: ctx.userId, phone: ctx.phone,
    menu: "ajuda", title: "🆘 Ajuda",
    body: "Eu consigo consultar alunos, agenda e (para a administração) o financeiro. A qualquer momento use o botão Voltar ou mande *menu* para recomeçar.",
    buttons: [
      btn("btn_help_voltar", "⬅️ Voltar", "voltar_menu", {}, 1),
      btn("btn_help_alunos", "👨‍🎓 Alunos", "alunos_menu", {}, 2),
    ],
    instanceName: ctx.instanceName, baseUrl: ctx.baseUrl, apiKey: ctx.apiKey,
  });
  return true;
}

// ─── Renderização de menus (sessão + navegação coerente) ─────────────────────

export async function renderMenu(ctx: MenuCtx, menu: string, isBack = false): Promise<boolean> {
  // BUG FIX (cacabug): previousMenu calculado ANTES do upsert, com histórico
  // real — antes o upsert apagava o histórico e a navegação voltar quebrava.
  const existing = await getActiveSession(ctx.db, ctx.phone);
  const previousMenu = isBack
    ? "main"
    : (existing?.currentMenu && existing.currentMenu !== menu ? existing.currentMenu : (existing?.previousMenu || "main"));
  await upsertSession(ctx.db, {
    organizationId: ctx.organizationId, userId: ctx.userId, phone: ctx.phone,
    currentMenu: menu, previousMenu, context: existing?.context ?? undefined,
  });

  switch (menu) {
    case "main": return renderMainMenu(ctx);
    case "alunos": return renderAlunosMenu(ctx, (existing?.context ?? {}) as any);
    case "agenda": return renderAgendaMenu(ctx);
    case "financeiro": return renderFinanceiroMenu(ctx);
    default: return renderMenu(ctx, "main", true);
  }
}

async function renderMainMenu(ctx: MenuCtx): Promise<boolean> {
  const buttons: InteractiveButton[] = [
    btn("btn_alunos", "👨‍🎓 Alunos", "alunos_menu", {}, 1),
    btn("btn_agenda", "📅 Agenda", "agenda_menu", {}, 2),
  ];
  if (canAccessMenu(ctx.role, "financeiro")) {
    buttons.push(btn("btn_financeiro", "💰 Financeiro", "financeiro_menu", {}, 3));
  }
  await sendInteractive(ctx.db, {
    organizationId: ctx.organizationId, userId: ctx.userId, phone: ctx.phone,
    menu: "main", title: "Olá! 👋", body: "Como posso ajudar?",
    buttons,
    instanceName: ctx.instanceName, baseUrl: ctx.baseUrl, apiKey: ctx.apiKey,
  });
  return true;
}

// ─── ALUNOS (§18/§19 — dinâmico + paginação; §15 escopo do professor) ─────────

const PAGE_SIZE = 3;

async function renderAlunosMenu(ctx: MenuCtx, context: any, page = 1): Promise<boolean> {
  const safePage = Math.max(1, Number(page ?? context?.page ?? 1));
  // §15: professor só lista os SEUS alunos; admin lista a escola inteira.
  const studentWhere = ctx.role === "professor"
    ? and(eq(students.organizationId, ctx.organizationId), eq(students.status, "ativo"), eq(students.professorId, ctx.userId))
    : and(eq(students.organizationId, ctx.organizationId), eq(students.status, "ativo"));

  const [{ total }] = await ctx.db.select({ total: sql<number>`CAST(count(*) AS INT)` })
    .from(students).where(studentWhere);

  const offset = (safePage - 1) * PAGE_SIZE;
  const rows = await ctx.db.select({ id: students.id, name: students.name })
    .from(students)
    .where(studentWhere)
    .orderBy(asc(students.name))
    .limit(PAGE_SIZE + 1)
    .offset(offset);

  const hasNext = rows.length > PAGE_SIZE;
  const pageRows = rows.slice(0, PAGE_SIZE);

  if (pageRows.length === 0) {
    await sendInteractive(ctx.db, {
      organizationId: ctx.organizationId, userId: ctx.userId, phone: ctx.phone,
      menu: "alunos", title: "👨‍🎓 Alunos", body: "Nenhum aluno ativo encontrado nesta visão.",
      buttons: [btn("btn_menu", "🏠 Menu principal", "main_menu", {}, 1)],
      instanceName: ctx.instanceName, baseUrl: ctx.baseUrl, apiKey: ctx.apiKey,
    });
    return true;
  }

  const buttons: InteractiveButton[] = pageRows.map((s: any, i: number) =>
    btn(`student_${s.id}`, s.name, "consultar_aluno", { studentId: s.id }, i + 1)
  );
  if (hasNext) buttons.push(btn("btn_next", "➡️ Próxima", "next_students_page", { page: safePage + 1 }, 4));
  if (safePage > 1) buttons.push(btn("btn_prev", "⬅️ Anterior", "prev_students_page", { page: safePage - 1 }, 5));
  buttons.push(btn("btn_voltar", "🏠 Menu principal", "main_menu", {}, 6));

  await sendInteractive(ctx.db, {
    organizationId: ctx.organizationId, userId: ctx.userId, phone: ctx.phone,
    menu: "alunos", title: "👨‍🎓 Alunos", body: `Qual aluno deseja consultar? (${offset + 1}-${offset + pageRows.length} de ${total})`,
    buttons,
    instanceName: ctx.instanceName, baseUrl: ctx.baseUrl, apiKey: ctx.apiKey,
  });

  // §19 — contexto da pesquisa mantido p/ paginação
  await upsertSession(ctx.db, {
    organizationId: ctx.organizationId, userId: ctx.userId, phone: ctx.phone,
    currentMenu: "alunos", previousMenu: "main", context: { page: safePage },
  });
  return true;
}

// ─── AGENDA (aulas de hoje / amanhã; §15 escopo do professor) ─────────────────

async function renderAgendaMenu(ctx: MenuCtx): Promise<boolean> {
  const buttons: InteractiveButton[] = [
    btn("btn_agenda_hoje", "📆 Aulas de hoje", "agenda_hoje", {}, 1),
    btn("btn_agenda_amanha", "🌅 Aulas de amanhã", "agenda_amanha", {}, 2),
    btn("btn_voltar", "⬅️ Voltar", "voltar_menu", {}, 3),
  ];
  await sendInteractive(ctx.db, {
    organizationId: ctx.organizationId, userId: ctx.userId, phone: ctx.phone,
    menu: "agenda", title: "📅 Agenda", body: "O que deseja ver?",
    buttons, instanceName: ctx.instanceName, baseUrl: ctx.baseUrl, apiKey: ctx.apiKey,
  });
  return true;
}

async function listAgenda(ctx: MenuCtx, dayOffset: number): Promise<boolean> {
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  base.setDate(base.getDate() + dayOffset);
  const end = new Date(base);
  end.setHours(23, 59, 59, 999);

  // §15: professor vê as aulas dele (criadas por ele OU dos alunos dele)
  const scope = ctx.role === "professor"
    ? and(
        eq(lessons.organizationId, ctx.organizationId),
        eq(lessons.status, "agendada"),
        gt(lessons.scheduledAt, base),
        sql`${lessons.scheduledAt} < ${end}`,
        sql`(${lessons.userId} = ${ctx.userId} OR EXISTS (SELECT 1 FROM students s WHERE s.id = ${lessons.studentId} AND s."professorId" = ${ctx.userId}))`,
      )
    : and(
        eq(lessons.organizationId, ctx.organizationId),
        eq(lessons.status, "agendada"),
        gt(lessons.scheduledAt, base),
        sql`${lessons.scheduledAt} < ${end}`,
      );

  const rows = await ctx.db.select({
    title: lessons.title,
    scheduledAt: lessons.scheduledAt,
    studentName: students.name,
  }).from(lessons)
    .leftJoin(students, eq(lessons.studentId, students.id))
    .where(scope)
    .orderBy(asc(lessons.scheduledAt))
    .limit(8);

  const dayLabel = dayOffset === 0 ? "hoje" : "amanhã";
  const body = rows.length === 0
    ? `Não há aulas agendadas para ${dayLabel}. 🎶`
    : rows.map((l: any) =>
        `• ${new Date(l.scheduledAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} — ${l.title}${l.studentName ? ` (${l.studentName})` : ""}`
      ).join("\n");

  await sendInteractive(ctx.db, {
    organizationId: ctx.organizationId, userId: ctx.userId, phone: ctx.phone,
    menu: "agenda", title: `📅 Aulas de ${dayLabel}`, body,
    buttons: [
      btn("btn_agenda_voltar", "⬅️ Voltar", "agenda_menu", {}, 1),
      btn("btn_menu", "🏠 Menu principal", "main_menu", {}, 2),
    ],
    instanceName: ctx.instanceName, baseUrl: ctx.baseUrl, apiKey: ctx.apiKey,
  });
  return true;
}

// ─── FINANCEIRO (admin; BUG FIX: soma inclui atrasadas) ──────────────────────

async function renderFinanceiroMenu(ctx: MenuCtx): Promise<boolean> {
  const [{ total, valor }] = await ctx.db.select({
    total: sql<number>`CAST(count(*) AS INT)`,
    valor: sql<number>`COALESCE(SUM(amount), 0)`,
  }).from(paymentDues)
    .where(and(
      eq(paymentDues.organizationId, ctx.organizationId),
      inArray(paymentDues.status, ["pendente", "atrasado"]),
    ));

  const valorFmt = Number(valor ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  await sendInteractive(ctx.db, {
    organizationId: ctx.organizationId, userId: ctx.userId, phone: ctx.phone,
    menu: "financeiro", title: "💰 Financeiro",
    body: `Você tem ${total} cobrança(s) em aberto somando ${valorFmt}.`,
    buttons: [
      btn("btn_fin_pendentes", "📋 Cobranças em aberto", "financeiro_pendentes", {}, 1),
      btn("btn_fin_recebidos", "✅ Pagamentos recebidos", "financeiro_recebidos", {}, 2),
      btn("btn_voltar", "⬅️ Voltar", "voltar_menu", {}, 3),
    ],
    instanceName: ctx.instanceName, baseUrl: ctx.baseUrl, apiKey: ctx.apiKey,
  });
  return true;
}

async function listFinanceiro(ctx: MenuCtx, kind: "pendentes" | "recebidos"): Promise<boolean> {
  if (!canAccessMenu(ctx.role, "financeiro")) return requireAdminBlocked(ctx);

  let rows: any[] = [];
  if (kind === "pendentes") {
    rows = await ctx.db.select({
      id: paymentDues.id, amount: paymentDues.amount, dueDate: paymentDues.dueDate,
      status: paymentDues.status,
      studentName: students.name,
    }).from(paymentDues)
      .leftJoin(students, eq(paymentDues.studentId, students.id))
      .where(and(
        eq(paymentDues.organizationId, ctx.organizationId),
        inArray(paymentDues.status, ["pendente", "atrasado"]),
      ))
      .orderBy(asc(paymentDues.dueDate)).limit(6);
  } else {
    rows = await ctx.db.select({
      id: paymentDues.id, amount: paymentDues.amount, paidAt: paymentDues.paidAt,
      studentName: students.name,
    }).from(paymentDues)
      .leftJoin(students, eq(paymentDues.studentId, students.id))
      .where(and(eq(paymentDues.organizationId, ctx.organizationId), eq(paymentDues.status, "pago")))
      .orderBy(sql`${paymentDues.paidAt} DESC NULLS LAST`).limit(6);
  }

  const body = rows.length === 0
    ? (kind === "pendentes" ? "Nenhuma cobrança em aberto. 🎉" : "Nenhum pagamento registrado ainda.")
    : rows.map((p: any) => {
        const when = kind === "pendentes"
          ? `venc. ${new Date(p.dueDate + "T12:00:00").toLocaleDateString("pt-BR")}${p.status === "atrasado" ? " ⚠️ atrasada" : ""}`
          : (p.paidAt ? `pago ${new Date(p.paidAt).toLocaleDateString("pt-BR")}` : "pago");
        return `• ${p.studentName || "Aluno"} — ${Number(p.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} (${when})`;
      }).join("\n");

  await sendInteractive(ctx.db, {
    organizationId: ctx.organizationId, userId: ctx.userId, phone: ctx.phone,
    menu: "financeiro", title: kind === "pendentes" ? "📋 Cobranças em aberto" : "✅ Recebimentos", body,
    buttons: [
      btn("btn_fin_voltar", "⬅️ Voltar", "financeiro_menu", {}, 1),
      btn("btn_menu", "🏠 Menu principal", "main_menu", {}, 2),
    ],
    instanceName: ctx.instanceName, baseUrl: ctx.baseUrl, apiKey: ctx.apiKey,
  });
  return true;
}

async function requireAdminBlocked(ctx: MenuCtx): Promise<boolean> {
  await sendInteractive(ctx.db, {
    organizationId: ctx.organizationId, userId: ctx.userId, phone: ctx.phone,
    menu: "sem_permissao", title: "Acesso restrito",
    body: "Essa área é exclusiva da administração da escola.",
    buttons: [btn("btn_menu", "🏠 Menu principal", "main_menu", {}, 1)],
    instanceName: ctx.instanceName, baseUrl: ctx.baseUrl, apiKey: ctx.apiKey,
  });
  return true;
}

// ─── Roteador de ações dinâmicas (§10) — handlers registráveis ───────────────

async function routeDynamic(ctx: MenuCtx, action: string, params: Record<string, any>): Promise<boolean> {
  // §16 — consultar_aluno SEMPRE revalida escola; §15 professor vê os seus.
  if (action === "consultar_aluno") {
    const studentId = Number(params?.studentId);
    if (!studentId) return renderMenu(ctx, "alunos", true);

    const [s] = await ctx.db.select({
      id: students.id, name: students.name, status: students.status,
      level: students.level, phone: students.phone, professorId: students.professorId,
    }).from(students)
      .where(and(eq(students.id, studentId), eq(students.organizationId, ctx.organizationId)))
      .limit(1);

    if (!s) {
      // §17 — id de outra escola = "inexistente" (não vaza informação)
      await sendInteractive(ctx.db, {
        organizationId: ctx.organizationId, userId: ctx.userId, phone: ctx.phone,
        menu: "alunos", title: "Aluno não encontrado",
        body: "Esse aluno não está mais disponível. Vou atualizar a lista.",
        buttons: [btn("btn_alunos", "👨‍🎓 Ver alunos", "alunos_menu", {}, 1)],
        instanceName: ctx.instanceName, baseUrl: ctx.baseUrl, apiKey: ctx.apiKey,
      });
      return true;
    }
    if (ctx.role === "professor" && s.professorId !== ctx.userId) {
      return requireAdminBlocked(ctx);
    }

    await sendInteractive(ctx.db, {
      organizationId: ctx.organizationId, userId: ctx.userId, phone: ctx.phone,
      menu: "alunos", title: `👨‍🎓 ${s.name}`,
      body: `Nível: ${s.level || "—"}\nStatus: ${s.status}\nTelefone: ${s.phone || "não informado"}`,
      buttons: [
        btn("btn_alunos_voltar", "👨‍🎓 Ver alunos", "alunos_menu", {}, 1),
        btn("btn_menu", "🏠 Menu principal", "main_menu", {}, 2),
      ],
      instanceName: ctx.instanceName, baseUrl: ctx.baseUrl, apiKey: ctx.apiKey,
    });
    return true;
  }

  if (action === "next_students_page" || action === "prev_students_page") {
    const page = Math.max(1, Number(params?.page ?? 1));
    return renderAlunosMenu(ctx, {}, page);
  }

  if (action === "agenda_hoje") return listAgenda(ctx, 0);
  if (action === "agenda_amanha") return listAgenda(ctx, 1);

  if (action === "financeiro_pendentes") return listFinanceiro(ctx, "pendentes");
  if (action === "financeiro_recebidos") return listFinanceiro(ctx, "recebidos");

  // ── PRD_LEMBRETE_INTERATIVO: confirmação de presença pelos botões do lembrete ──
  if (action === "confirmar_presenca_aula" || action === "nao_vai_aula") {
    const lessonId = Number(params?.lessonId);
    if (!lessonId) return renderMenu(ctx, "main", true);
    return handleLessonConfirmation(ctx, lessonId, action === "confirmar_presenca_aula");
  }

  // Ação desconhecida → menu principal (§29 — não quebra o atendimento)
  return renderMenu(ctx, "main", true);
}

// ─── Confirmação de presença pelo WhatsApp (§22 — validação server-side) ─────
// O clique NÃO é confiável: o aluno é resolvido PELO TELEFONE (aluno ou
// responsável) dentro da organização, e a aula precisa pertencer a esse aluno.

/** Casa o telefone recebido com um aluno da escola (aluno OU responsável). */
export function phoneMatchesStudent(digits: string, studentPhone: string, guardianPhone: string): boolean {
  if (!digits || digits.length < 8) return false;
  const suffix = digits.slice(-8);
  const sp = String(studentPhone || "").replace(/\D/g, "");
  const gp = String(guardianPhone || "").replace(/\D/g, "");
  return (sp.length > 8 && sp.endsWith(suffix)) || (gp.length > 8 && gp.endsWith(suffix));
}

async function handleLessonConfirmation(
  ctx: MenuCtx,
  lessonId: number,
  confirmed: boolean
): Promise<boolean> {
  // 1. Resolve o aluno pelo telefone (org-scoped — nunca pelo params do botão)
  const allStudents = await ctx.db.select({
    id: students.id, name: students.name, phone: students.phone, guardianPhone: students.guardianPhone,
  }).from(students)
    .where(eq(students.organizationId, ctx.organizationId))
    .limit(1000);
  const matched = allStudents.find((s: any) => phoneMatchesStudent(ctx.phone, s.phone, s.guardianPhone));

  if (!matched) {
    // Contato não corresponde a nenhum aluno da escola → não executa nem vaza dados
    await sendInteractive(ctx.db, {
      organizationId: ctx.organizationId, userId: ctx.userId, phone: ctx.phone,
      menu: "lembrete_aula", title: "Não foi possível registrar",
      body: "Este número não corresponde a um aluno ativo da escola. Fale com a recepção para atualizar o cadastro.",
      buttons: [btn("btn_menu", "🏠 Menu principal", "main_menu", {}, 1)],
      instanceName: ctx.instanceName, baseUrl: ctx.baseUrl, apiKey: ctx.apiKey,
      forceText: true,
    });
    return true;
  }

  // 2. Aula precisa pertencer a esse aluno e continuar agendada
  const [lesson] = await ctx.db.select({
    id: lessons.id, title: lessons.title, scheduledAt: lessons.scheduledAt,
    userId: lessons.userId, studentId: lessons.studentId, status: lessons.status,
    studentConfirmation: lessons.studentConfirmation,
  }).from(lessons)
    .where(and(
      eq(lessons.id, lessonId),
      eq(lessons.organizationId, ctx.organizationId),
      eq(lessons.studentId, matched.id),
    ))
    .limit(1);

  if (!lesson || lesson.status !== "agendada") {
    await sendInteractive(ctx.db, {
      organizationId: ctx.organizationId, userId: ctx.userId, phone: ctx.phone,
      menu: "lembrete_aula", title: "Aula indisponível",
      body: "Essa aula não está mais agendada. Fale com seu professor para combinar outra data.",
      buttons: [btn("btn_menu", "🏠 Menu principal", "main_menu", {}, 1)],
      instanceName: ctx.instanceName, baseUrl: ctx.baseUrl, apiKey: ctx.apiKey,
      forceText: true,
    });
    return true;
  }

  // 3. Idempotente: mesma resposta não re-notifica o professor
  const unchanged = lesson.studentConfirmation === (confirmed ? "confirmado" : "nao_vai");

  await ctx.db.update(lessons).set({
    studentConfirmation: confirmed ? "confirmado" : "nao_vai",
    studentConfirmedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(lessons.id, lessonId));

  // BUG FIX (cacabug): aluno já respondeu → CANCELA lembretes pendentes desta
  // aula (sem isso, a regra/o loop reenviavam o lembrete depois da resposta).
  try {
    await ctx.db.update(reminders).set({
      status: "cancelado",
      cancelledAt: new Date(),
      errorMessage: "Aluno já respondeu presença — lembrete cancelado.",
      updatedAt: new Date(),
    }).where(and(eq(reminders.lessonId, lessonId), eq(reminders.status, "pendente")));
  } catch (e) {
    console.error("[Interactive] Falha ao cancelar lembretes pendentes (não impeditivo):", e);
  }

  if (unchanged) {
    const when = new Date(lesson.scheduledAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
    await sendInteractive(ctx.db, {
      organizationId: ctx.organizationId, userId: ctx.userId, phone: ctx.phone,
      menu: "lembrete_aula",
      title: confirmed ? "Presença já confirmada ✅" : "Ausência já avisada ✅",
      body: `Sua resposta para a aula de ${lesson.title} (${when}) já estava registrada.`,
      buttons: [btn("btn_menu", "🏠 Menu principal", "main_menu", {}, 1)],
      instanceName: ctx.instanceName, baseUrl: ctx.baseUrl, apiKey: ctx.apiKey,
      forceText: true,
    });
    return true;
  }

  // 4. Notifica o professor (in-app + push — mesmo comportamento do portal)
  const title = confirmed ? "✅ Presença Confirmada (WhatsApp)" : "⚠️ Aluno não irá à aula (WhatsApp)";
  const message = confirmed
    ? `${matched.name} confirmou presença na aula "${lesson.title}".`
    : `${matched.name} avisou que NÃO poderá ir à aula "${lesson.title}". Combine uma reposição ou nova data se necessário.`;
  try {
    await ctx.db.insert(notifications).values({
      organizationId: ctx.organizationId,
      userId: lesson.userId,
      title,
      message,
      type: confirmed ? "success" : "warning",
      actionUrl: "/aulas",
    });
  } catch (e) {
    console.error("[Interactive] Falha ao notificar professor (registro mantido):", e);
  }
  try {
    const { notifyUser } = await import("../../../_core/notification");
    notifyUser(lesson.userId, { title, content: message, url: "/aulas" })
      .catch((e: any) => console.error("[Interactive] Falha no push de confirmação:", e));
  } catch { /* push é best-effort */ }

  // 5. Confirmação amigável ao contato
  const when = new Date(lesson.scheduledAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  await sendInteractive(ctx.db, {
    organizationId: ctx.organizationId, userId: ctx.userId, phone: ctx.phone,
    menu: "lembrete_aula",
    title: confirmed ? "Presença confirmada ✅" : "Aviso registrado 📋",
    body: confirmed
      ? `Até a aula de ${lesson.title} em ${when}. 🎵`
      : `Seu professor foi avisado de que você não irá à aula de ${lesson.title} (${when}). Ele pode combinar reposição ou nova data com você.`,
    buttons: [btn("btn_menu", "🏠 Menu principal", "main_menu", {}, 1)],
    instanceName: ctx.instanceName, baseUrl: ctx.baseUrl, apiKey: ctx.apiKey,
    forceText: true,
  });
  return true;
}

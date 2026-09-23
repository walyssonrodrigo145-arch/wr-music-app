import { debugLog } from "./_core/logger";
import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import { eq, sql, count, inArray, and, isNotNull, asc } from "drizzle-orm";
import {
  systemPlans,
  systemCoupons,
  organizations,
  users,
  students,
  professores,
  instruments,
  lessons,
  monthlyStats,
  settings,
  reminders,
  reminderTemplates,
  paymentDues,
  billingAuditLogs,
  asaasCustomers,
  expenses,
  studentGoals,
  studentTimeline,
  studentFiles,
  fileComments,
  announcements,
  chatMessages,
  rescheduleRequests,
  studentEvolution,
  dailyStudyPlans,
  notifications,
  aiConversations,
  aiMessages,
  aiDocuments,
  chatbotSessions,
  fcmTokens,
  contracts,
  professorPayments,
  attendanceTokens,
  attendanceLogs,
  messageAutomationRules,
  marketingCampaigns,
  marketingContacts,
  marketingJobs,
  marketingLogs,
  analyticsSessions,
  analyticsRevenue,
  analyticsSecurityLogs,
  crmLeads,
  studioRooms,
  enrollmentLinks,
  landingClients,
  landingHeroSlides,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

// ─── Middleware de autorização ────────────────────────────────────────────────
// REGRA: Somente usuários configurados em SUPER_ADMIN_EMAIL / SUPER_ADMIN_EMAILS
// (variáveis de ambiente) OU via OWNER_OPEN_ID têm acesso.
// AUDIT-P0 FIX: e-mails hardcoded removidos — a lista vem exclusivamente de env.
export const isSuperAdmin = protectedProcedure.use(async ({ ctx, next }) => {
  const userEmail = ctx.user.email?.toLowerCase().trim();

  const isMaster =
    (Boolean(userEmail) && ENV.superAdminEmails.includes(userEmail || "")) ||
    (ENV.ownerOpenId && ctx.user.openId === ENV.ownerOpenId);

  if (!isMaster) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Acesso restrito exclusivamente ao Super Admin.",
    });
  }
  return next({ ctx });
});

/**
 * Diff da vitrine de escolas: o que publicar (selecionado e ainda não vinculado)
 * e o que desativar (vinculado e não selecionado). Puro para testes.
 */
export function diffLandingSchoolSelection(
  currentOrgIds: number[],
  selectedOrgIds: number[]
): { toPublish: number[]; toDeactivate: number[] } {
  const current = new Set(currentOrgIds.map(Number));
  const selected = new Set(selectedOrgIds.map(Number));
  return {
    toPublish: Array.from(selected).filter((id) => !current.has(id)),
    toDeactivate: Array.from(current).filter((id) => !selected.has(id)),
  };
}

export const superAdminRouter = router({

  // ─── Dashboard: contagens globais usando COUNT(*) no SQL ──────────────────
  getDashboardStats: isSuperAdmin.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB indisponível" });

    // FIX: usar COUNT(*) em vez de SELECT * para evitar Full Table Scan em memória
    const [{ totalOrgs }] = await db.select({ totalOrgs: sql<number>`CAST(count(*) AS INT)` }).from(organizations);
    const [{ totalProfs }] = await db.select({ totalProfs: sql<number>`CAST(count(*) AS INT)` }).from(users).where(eq(users.role, "professor"));
    const [{ totalStuds }] = await db.select({ totalStuds: sql<number>`CAST(count(*) AS INT)` }).from(students).where(eq(students.status, "ativo"));

    // Últimas 10 organizações para o painel — ordenadas por criação
    const recentOrgs = await db.select({
      id: organizations.id,
      name: organizations.name,
      subscriptionStatus: organizations.subscriptionStatus,
      createdAt: organizations.createdAt,
    }).from(organizations).orderBy(sql`${organizations.createdAt} DESC`).limit(10);

    return {
      totalOrganizations: totalOrgs,
      totalProfessors: totalProfs,
      totalStudents: totalStuds,
      organizations: recentOrgs,
    };
  }),

  // ─── Lista de organizações — sem dados sensíveis ──────────────────────────
  getOrganizations: isSuperAdmin.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    // CRÍTICO-09 FIX: especificar campos explicitamente — NUNCA usar select() sem campos.
    // Evita retornar asaasCustomerId, asaasSubscriptionId e outros dados sensíveis
    // quando não estritamente necessários.
    const orgsList = await db.select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      logo: organizations.logo,
      active: organizations.active,
      ownerId: organizations.ownerId,
      subscriptionStatus: organizations.subscriptionStatus,
      trialEndsAt: organizations.trialEndsAt,
      currentPeriodEnd: organizations.currentPeriodEnd,
      planId: organizations.planId,
      createdAt: organizations.createdAt,
      updatedAt: organizations.updatedAt,
      // Campos de integração Asaas: incluídos pois o super admin precisa deles
      // para gestão, mas NUNCA expor para outros roles.
      asaasCustomerId: organizations.asaasCustomerId,
      asaasSubscriptionId: organizations.asaasSubscriptionId,
    }).from(organizations);

    // Busca a quantidade real de professores vinculados por escola na tabela 'professores' (ou role='professor')
    const profCounts = await db.select({
      organizationId: professores.organizationId,
      total: sql<number>`CAST(count(*) AS INT)`,
    }).from(professores).groupBy(professores.organizationId);

    // ── Contato das escolas (settings.schoolPhone — fonte única do telefone) ──
    const orgIds = orgsList.map((o) => o.id);
    const phoneMap = new Map<number, string | null>();
    const schoolNameMap = new Map<number, string | null>();
    if (orgIds.length > 0) {
      const settingsRows = await db
        .select({
          organizationId: settings.organizationId,
          schoolPhone: settings.schoolPhone,
          schoolName: settings.schoolName,
        })
        .from(settings)
        .where(inArray(settings.organizationId, orgIds));
      for (const s of settingsRows) {
        if (s.organizationId == null) continue;
        if (!phoneMap.has(s.organizationId)) phoneMap.set(s.organizationId, s.schoolPhone || null);
        if (!schoolNameMap.has(s.organizationId)) schoolNameMap.set(s.organizationId, s.schoolName || null);
      }
    }

    // Busca a quantidade real de alunos ATIVOS cadastrados por escola
    const studentCounts = await db.select({
      organizationId: students.organizationId,
      total: sql<number>`CAST(count(*) AS INT)`,
    }).from(students).where(eq(students.status, "ativo")).groupBy(students.organizationId);

    // Busca os usuários admins e o último acesso por organização
    const allUsers = await db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      organizationId: users.organizationId,
      role: users.role,
      lastSignedIn: users.lastSignedIn,
      createdAt: users.createdAt,
    }).from(users);

    const profCountMap = new Map(profCounts.map(r => [r.organizationId, r.total]));
    const studentCountMap = new Map(studentCounts.map(r => [r.organizationId, r.total]));
    
    // Mapeia donos por org (priorizando role='admin', senão o primeiro usuário criado da org)
    const ownerMap = new Map<number | null, any>();
    const lastAccessMap = new Map<number | null, Date>();

    for (const u of allUsers) {
      if (!u.organizationId) continue;

      // Guarda a data do último acesso mais recente da organização
      const currentLatest = lastAccessMap.get(u.organizationId);
      if (!currentLatest || (u.lastSignedIn && new Date(u.lastSignedIn) > new Date(currentLatest))) {
        lastAccessMap.set(u.organizationId, u.lastSignedIn);
      }

      // Define dono
      const existingOwner = ownerMap.get(u.organizationId);
      if (!existingOwner) {
        ownerMap.set(u.organizationId, u);
      } else if (existingOwner.role !== 'admin' && u.role === 'admin') {
        ownerMap.set(u.organizationId, u);
      }
    }

    return orgsList.map(org => ({
      ...org,
      owner: ownerMap.get(org.id) ?? null,
      lastSignedIn: lastAccessMap.get(org.id) ?? null,
      totalUsers: profCountMap.get(org.id) ?? 0,
      totalStudents: studentCountMap.get(org.id) ?? 0,
      // Contato da escola (para o super admin entrar em contato direto)
      schoolPhone: phoneMap.get(org.id) ?? null,
      schoolNameConfigured: schoolNameMap.get(org.id) ?? null,
    }));
  }),

  /**
   * PRD_RELATORIO_CLIENTES_ATIVOS: relatório de "clientes ativos de fato" —
   * escolas com a mensalidade da plataforma PAGA no período consultado.
   * Janela: N meses (1/2/3/6/12) terminando no mês âncora (month/year) —
   * a mesma lista de pagamentos do Asaas é classificada para CADA mês da
   * janela, gerando a série de evolução sem chamadas extras por mês.
   * Fonte da verdade: Asaas (conta da plataforma, env ASAAS_API_KEY).
   * RN-001: "paga" = cobrança RECEIVED/CONFIRMED com vencimento no mês.
   * RN-002: chamadas Asaas por org com concorrência 5 e falha isolada
   * (status "erro") — nunca quebra o relatório inteiro.
   * RN-003: prioridade do pagamento do mês — paga > atrasada > pendente.
   */
  getOrgBillingReport: isSuperAdmin
    .input(z.object({
      month: z.number().int().min(1).max(12).optional(),
      year: z.number().int().min(2020).max(2100).optional(),
      // Janela de evolução: 1 = mês âncora apenas; N = N meses terminando no âncora
      months: z.number().int().min(1).max(12).optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const now = new Date();
      const anchorMonth = input?.month ?? now.getMonth() + 1;
      const anchorYear = input?.year ?? now.getFullYear();
      const windowMonths = Math.max(1, Math.min(12, input?.months ?? 1));

      // Janela cronológica (mais antiga → âncora)
      const range: { month: number; year: number; key: string }[] = [];
      for (let back = windowMonths - 1; back >= 0; back--) {
        const d = new Date(anchorYear, anchorMonth - 1 - back, 1);
        const m = d.getMonth() + 1;
        const y = d.getFullYear();
        range.push({ month: m, year: y, key: `${y}-${String(m).padStart(2, "0")}` });
      }
      const anchorKey = range[range.length - 1].key;

      const PAID = new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH", "DETERMINED"]);
      const PENDING = new Set(["PENDING", "AWAITING_RISK_ANALYSIS"]);
      const OVERDUE = new Set(["OVERDUE"]);

      // 1. Escolas (campos explícitos — CRÍTICO-09: nunca select() sem campos)
      const orgsList = await db.select({
        id: organizations.id,
        name: organizations.name,
        active: organizations.active,
        ownerId: organizations.ownerId,
        subscriptionStatus: organizations.subscriptionStatus,
        trialEndsAt: organizations.trialEndsAt,
        currentPeriodEnd: organizations.currentPeriodEnd,
        planId: organizations.planId,
        asaasSubscriptionId: organizations.asaasSubscriptionId,
        createdAt: organizations.createdAt,
      }).from(organizations);

      // 2. Planos (nome + preço mensal de referência)
      const plans = await db.select({ id: systemPlans.id, name: systemPlans.name, priceMonthly: systemPlans.priceMonthly }).from(systemPlans);
      const planById = new Map<string, any>(plans.map((p: any) => [p.id, p]));

      // 3. Alunos ativos por escola (uso real)
      const studentCounts = await db.select({
        organizationId: students.organizationId,
        total: sql<number>`CAST(count(*) AS INT)`,
      }).from(students).where(eq(students.status, "ativo")).groupBy(students.organizationId);
      const studentsMap = new Map(studentCounts.map((r: any) => [r.organizationId, Number(r.total ?? 0)]));

      // 4. Dono da escola + último acesso (padrão getOrganizations)
      const allUsers = await db.select({
        id: users.id,
        name: users.name,
        email: users.email,
        organizationId: users.organizationId,
        role: users.role,
        lastSignedIn: users.lastSignedIn,
      }).from(users);
      const ownerMap = new Map<number, any>();
      const lastAccessMap = new Map<number, any>();
      for (const u of allUsers) {
        if (!u.organizationId) continue;
        const cur = lastAccessMap.get(u.organizationId);
        if (!cur || (u.lastSignedIn && new Date(u.lastSignedIn) > new Date(cur))) {
          lastAccessMap.set(u.organizationId, u.lastSignedIn);
        }
        const existing = ownerMap.get(u.organizationId);
        if (!existing) ownerMap.set(u.organizationId, u);
        else if (existing.role !== "admin" && u.role === "admin") ownerMap.set(u.organizationId, u);
      }

      type MonthStatus = {
        status: "paga" | "pendente" | "atrasada" | "trial" | "cancelada" | "sem_cobranca" | "erro";
        value: number | null; dueDate: string | null; paymentDate: string | null;
      };
      type OrgBillingRow = {
        id: number; name: string; active: boolean;
        planName: string; planPrice: number;
        subscriptionStatus: string; trialEndsAt: Date | null; currentPeriodEnd: Date | null;
        activeStudents: number; ownerName: string | null; ownerEmail: string | null;
        lastSignedIn: any; hasSubscription: boolean; createdAt: Date;
        months: Record<string, MonthStatus>;
      };

      const buildRow = (org: any, months: Record<string, MonthStatus>): OrgBillingRow => {
        const plan = planById.get(org.planId);
        const owner = ownerMap.get(org.id);
        return {
          id: org.id,
          name: org.name,
          active: org.active,
          planName: plan?.name ?? org.planId,
          planPrice: plan ? Number(plan.priceMonthly ?? 0) : 0,
          subscriptionStatus: org.subscriptionStatus,
          trialEndsAt: org.trialEndsAt,
          currentPeriodEnd: org.currentPeriodEnd,
          activeStudents: studentsMap.get(org.id) ?? 0,
          ownerName: owner?.name ?? null,
          ownerEmail: owner?.email ?? null,
          lastSignedIn: lastAccessMap.get(org.id) ?? null,
          hasSubscription: !!org.asaasSubscriptionId,
          createdAt: org.createdAt,
          months,
        };
      };

      // Classificação de UM mês a partir dos pagamentos do Asaas (RN-003)
      const classifyMonth = (payments: any[], m: number, y: number): MonthStatus => {
        const monthPayments = payments.filter((p) => {
          const due = String(p.dueDate || "").slice(0, 10);
          const d = new Date(`${due}T12:00:00`);
          return !isNaN(d.getTime()) && d.getMonth() + 1 === m && d.getFullYear() === y;
        });
        const received = monthPayments.find((p) => PAID.has(String(p.status || "").toUpperCase()));
        const overdue = monthPayments.find((p) => OVERDUE.has(String(p.status || "").toUpperCase()));
        const pending = monthPayments.find((p) => PENDING.has(String(p.status || "").toUpperCase()));
        const chosen = received || overdue || pending;
        let status: MonthStatus["status"] = "sem_cobranca";
        if (received) status = "paga";
        else if (overdue) status = "atrasada";
        else if (pending) status = "pendente";
        return {
          status,
          value: chosen ? Number(chosen.value) : null,
          dueDate: chosen ? String(chosen.dueDate || "").slice(0, 10) : null,
          paymentDate: chosen && (chosen as any).paymentDate ? String((chosen as any).paymentDate) : null,
        };
      };

      // 5. Orgs COM assinatura: UMA consulta por org cobre TODOS os meses da janela
      const { getAsaasSubscriptionPayments } = await import("./utils/asaas");
      const withSub = orgsList.filter(o => o.asaasSubscriptionId);
      const rows: OrgBillingRow[] = [];
      const CONCURRENCY = 5;
      for (let i = 0; i < withSub.length; i += CONCURRENCY) {
        const chunk = withSub.slice(i, i + CONCURRENCY);
        await Promise.all(chunk.map(async (org: any) => {
          const months: Record<string, MonthStatus> = {};
          try {
            const payments = (await getAsaasSubscriptionPayments(org.asaasSubscriptionId)) as any[];
            for (const r of range) {
              months[r.key] = classifyMonth(payments, r.month, r.year);
            }
          } catch (e) {
            console.warn(`[OrgBilling] Falha ao consultar Asaas da org ${org.id}:`, e);
            for (const r of range) months[r.key] = { status: "erro", value: null, dueDate: null, paymentDate: null };
          }
          rows.push(buildRow(org, months));
        }));
      }

      // 6. Orgs SEM assinatura: status constante (local) em todos os meses da janela
      for (const org of orgsList.filter(o => !o.asaasSubscriptionId)) {
        const st = String(org.subscriptionStatus || "trialing");
        let status: MonthStatus["status"] = "sem_cobranca";
        if (st === "trialing") status = "trial";
        else if (st === "canceled") status = "cancelada";
        else if (st === "active" || st === "past_due") status = "sem_cobranca";
        const months: Record<string, MonthStatus> = {};
        for (const r of range) months[r.key] = { status, value: null, dueDate: null, paymentDate: null };
        rows.push(buildRow(org, months));
      }

      // 7. KPIs do mês âncora — "clientes ativos de fato" = mensalidade PAGA no mês
      const anchorStatus = (r: OrgBillingRow) => r.months[anchorKey]?.status ?? "sem_cobranca";
      const kpis = {
        pagas: rows.filter(r => anchorStatus(r) === "paga").length,
        pendentes: rows.filter(r => anchorStatus(r) === "pendente").length,
        atrasadas: rows.filter(r => anchorStatus(r) === "atrasada").length,
        trial: rows.filter(r => anchorStatus(r) === "trial").length,
        canceladas: rows.filter(r => anchorStatus(r) === "cancelada").length,
        semCobranca: rows.filter(r => anchorStatus(r) === "sem_cobranca").length,
        erro: rows.filter(r => anchorStatus(r) === "erro").length,
        total: rows.length,
        receitaRecebida: rows.reduce((s, r) => s + (r.months[anchorKey]?.status === "paga" ? (r.months[anchorKey].value ?? 0) : 0), 0),
        receitaPendente: rows.reduce((s, r) => s + (r.months[anchorKey]?.status === "pendente" ? (r.months[anchorKey].value ?? 0) : 0), 0),
        receitaAtrasada: rows.reduce((s, r) => s + (r.months[anchorKey]?.status === "atrasada" ? (r.months[anchorKey].value ?? 0) : 0), 0),
      };

      // 8. Série de evolução por mês da janela (a visão de crescimento pedida)
      const evolution = range.map((r) => {
        const st = (row: OrgBillingRow) => row.months[r.key]?.status ?? "sem_cobranca";
        const val = (row: OrgBillingRow, s: MonthStatus["status"]) => (st(row) === s ? (row.months[r.key].value ?? 0) : 0);
        return {
          month: r.month,
          year: r.year,
          key: r.key,
          pagas: rows.filter(row => st(row) === "paga").length,
          pendentes: rows.filter(row => st(row) === "pendente").length,
          atrasadas: rows.filter(row => st(row) === "atrasada").length,
          semCobranca: rows.filter(row => st(row) === "sem_cobranca").length,
          trial: rows.filter(row => st(row) === "trial").length,
          canceladas: rows.filter(row => st(row) === "cancelada").length,
          receitaRecebida: rows.reduce((s, row) => s + val(row, "paga"), 0),
          receitaPendente: rows.reduce((s, row) => s + val(row, "pendente"), 0),
          receitaAtrasada: rows.reduce((s, row) => s + val(row, "atrasada"), 0),
        };
      });

      // 9. Ordenação: mais pagamentos em atraso primeiro; depois nome
      const unpaidCount = (r: OrgBillingRow) => range.filter(k => {
        const s = r.months[k.key]?.status;
        return s === "atrasada" || s === "pendente" || s === "erro";
      }).length;
      rows.sort((a, b) => unpaidCount(b) - unpaidCount(a) || a.name.localeCompare(b.name, "pt-BR"));

      return { month: anchorMonth, year: anchorYear, months: windowMonths, range, kpis, evolution, orgs: rows };
    }),

  // ─── Exclusão de organização: com transação e Drizzle tipado ─────────────
  deleteOrganization: isSuperAdmin
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const orgId = input.id; // já validado pelo Zod como int positivo

      // Verifica que a organização existe antes de deletar
      const [org] = await db.select({ id: organizations.id, name: organizations.name })
        .from(organizations)
        .where(eq(organizations.id, orgId))
        .limit(1);

      if (!org) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Organização não encontrada." });
      }

      // FIX: envolver em transação para garantir atomicidade
      // FIX: usar Drizzle delete tipado com schema oficial (evita erros de tabelas inexistentes como "messages")
      await db.transaction(async (tx) => {
        // Deleção em ordem respeitando dependências / FKs
        await tx.delete(marketingLogs).where(eq(marketingLogs.organizationId, orgId));
        await tx.delete(marketingJobs).where(eq(marketingJobs.organizationId, orgId));
        await tx.delete(marketingContacts).where(eq(marketingContacts.organizationId, orgId));
        await tx.delete(marketingCampaigns).where(eq(marketingCampaigns.organizationId, orgId));

        // Passo 1: busca todos os IDs de arquivos da organização para deletar
        // file_comments via fileId — cobre registros com organizationId NULL ou de outros usuários
        const orgFileIds = await tx
          .select({ id: studentFiles.id })
          .from(studentFiles)
          .where(eq(studentFiles.organizationId, orgId));
        if (orgFileIds.length > 0) {
          await tx.delete(fileComments)
            .where(inArray(fileComments.fileId, orgFileIds.map(f => f.id)));
        }
        // Passo 2: fallback — deleta file_comments restantes pelo organizationId direto
        await tx.delete(fileComments).where(eq(fileComments.organizationId, orgId));
        await tx.delete(studentFiles).where(eq(studentFiles.organizationId, orgId));
        await tx.delete(studentTimeline).where(eq(studentTimeline.organizationId, orgId));
        await tx.delete(studentGoals).where(eq(studentGoals.organizationId, orgId));
        await tx.delete(studentEvolution).where(eq(studentEvolution.organizationId, orgId));
        await tx.delete(dailyStudyPlans).where(eq(dailyStudyPlans.organizationId, orgId));
        await tx.delete(rescheduleRequests).where(eq(rescheduleRequests.organizationId, orgId));

        await tx.delete(attendanceLogs).where(eq(attendanceLogs.organizationId, orgId));
        await tx.delete(attendanceTokens).where(eq(attendanceTokens.organizationId, orgId));
        await tx.delete(professorPayments).where(eq(professorPayments.organizationId, orgId));
        await tx.delete(contracts).where(eq(contracts.organizationId, orgId));
        await tx.delete(asaasCustomers).where(eq(asaasCustomers.organizationId, orgId));
        await tx.delete(billingAuditLogs).where(eq(billingAuditLogs.organizationId, orgId));
        await tx.delete(paymentDues).where(eq(paymentDues.organizationId, orgId));
        await tx.delete(reminders).where(eq(reminders.organizationId, orgId));
        await tx.delete(reminderTemplates).where(eq(reminderTemplates.organizationId, orgId));

        await tx.delete(chatMessages).where(eq(chatMessages.organizationId, orgId));
        await tx.delete(announcements).where(eq(announcements.organizationId, orgId));
        await tx.delete(messageAutomationRules).where(eq(messageAutomationRules.organizationId, orgId));

        await tx.delete(notifications).where(eq(notifications.organizationId, orgId));
        await tx.delete(fcmTokens).where(eq(fcmTokens.organizationId, orgId));
        await tx.delete(aiDocuments).where(eq(aiDocuments.organizationId, orgId));
        // Deleta mensagens de IA vinculadas às conversas da organização antes das conversas
        const orgConversationIds = await tx.select({ id: aiConversations.id })
          .from(aiConversations)
          .where(eq(aiConversations.organizationId, orgId));
        if (orgConversationIds.length > 0) {
          await tx.delete(aiMessages).where(inArray(aiMessages.conversationId, orgConversationIds.map(c => c.id)));
        }
        await tx.delete(aiConversations).where(eq(aiConversations.organizationId, orgId));
        await tx.delete(chatbotSessions).where(eq(chatbotSessions.organizationId, orgId));
        await tx.delete(crmLeads).where(eq(crmLeads.organizationId, orgId));
        await tx.delete(studioRooms).where(eq(studioRooms.organizationId, orgId));
        await tx.delete(enrollmentLinks).where(eq(enrollmentLinks.organizationId, orgId));

        await tx.delete(analyticsSessions).where(eq(analyticsSessions.organizationId, orgId));
        await tx.delete(analyticsRevenue).where(eq(analyticsRevenue.organizationId, orgId));
        await tx.delete(analyticsSecurityLogs).where(eq(analyticsSecurityLogs.organizationId, orgId));

        await tx.delete(lessons).where(eq(lessons.organizationId, orgId));
        await tx.delete(students).where(eq(students.organizationId, orgId));
        await tx.delete(professores).where(eq(professores.organizationId, orgId));
        await tx.delete(instruments).where(eq(instruments.organizationId, orgId));
        await tx.delete(expenses).where(eq(expenses.organizationId, orgId));
        await tx.delete(settings).where(eq(settings.organizationId, orgId));
        await tx.delete(monthlyStats).where(eq(monthlyStats.organizationId, orgId));

        // Deleta usuários da organização (professores, admins)
        await tx.delete(users).where(eq(users.organizationId, orgId));
        // Por último, deleta a organização em si
        await tx.delete(organizations).where(eq(organizations.id, orgId));
      });

      debugLog(`[SuperAdmin] Organização #${orgId} ("${org.name}") excluída permanentemente.`);
      return { success: true };
    }),

  // ─── Planos ───────────────────────────────────────────────────────────────
  getPlans: isSuperAdmin.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    return await db.select().from(systemPlans);
  }),

  savePlan: isSuperAdmin
    .input(z.object({
      id: z.string().min(1).regex(/^[a-z0-9_-]+$/, "ID deve conter apenas letras minúsculas, números, _ ou -"),
      name: z.string().min(1),
      priceMonthly: z.number().min(0, "Preço não pode ser negativo"),
      priceYearly: z.number().min(0, "Preço não pode ser negativo"),
      maxStudents: z.number().int().min(1, "Limite mínimo é 1 aluno").max(999999999, "Limite máximo é 999.999.999 alunos"),
      features: z.array(z.string()),
      isActive: z.boolean(),
      showOnLanding: z.boolean(),
      isPopular: z.boolean().default(false),
      order: z.number().int().default(0),
      allowExtraStudents: z.boolean().default(true),
      extraStudentPrice: z.number().min(0, "Valor do excedente não pode ser negativo").default(1.49),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const exists = await db.select({ id: systemPlans.id }).from(systemPlans).where(eq(systemPlans.id, input.id)).limit(1);
      if (exists.length > 0) {
        await db.update(systemPlans).set({
          name: input.name,
          priceMonthly: input.priceMonthly.toString(),
          priceYearly: input.priceYearly.toString(),
          maxStudents: input.maxStudents,
          features: JSON.stringify(input.features),
          isActive: input.isActive,
          showOnLanding: input.showOnLanding,
          isPopular: input.isPopular,
          order: input.order,
          allowExtraStudents: input.allowExtraStudents,
          extraStudentPrice: input.extraStudentPrice.toString(),
          updatedAt: new Date(),
        }).where(eq(systemPlans.id, input.id));
      } else {
        await db.insert(systemPlans).values({
          id: input.id,
          name: input.name,
          priceMonthly: input.priceMonthly.toString(),
          priceYearly: input.priceYearly.toString(),
          maxStudents: input.maxStudents,
          features: JSON.stringify(input.features),
          isActive: input.isActive,
          showOnLanding: input.showOnLanding,
          isPopular: input.isPopular,
          order: input.order,
          allowExtraStudents: input.allowExtraStudents,
          extraStudentPrice: input.extraStudentPrice.toString(),
        });
      }
      return { success: true };
    }),

  // ─── Cupons ───────────────────────────────────────────────────────────────
  getCoupons: isSuperAdmin.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    return await db.select().from(systemCoupons);
  }),

  saveCoupon: isSuperAdmin
    .input(z.object({
      code: z.string().min(1).toUpperCase(),
      discountType: z.enum(['PERCENTAGE', 'FIXED']),
      discountValue: z.number().min(0.01, "Desconto deve ser maior que zero"),
      durationMonths: z.number().int().min(1).nullable(),
      maxUses: z.number().int().min(1).nullable(),
      isActive: z.boolean(),
      validUntil: z.string().nullable().optional(), // data ISO opcional
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Validação extra: porcentagem não pode ser maior que 100%
      if (input.discountType === 'PERCENTAGE' && input.discountValue > 100) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Desconto percentual não pode ultrapassar 100%." });
      }

      const code = input.code.toUpperCase().trim();
      const exists = await db.select({ code: systemCoupons.code }).from(systemCoupons).where(eq(systemCoupons.code, code)).limit(1);

      if (exists.length > 0) {
        await db.update(systemCoupons).set({
          discountType: input.discountType,
          discountValue: input.discountValue.toString(),
          durationMonths: input.durationMonths,
          maxUses: input.maxUses,
          isActive: input.isActive,
        }).where(eq(systemCoupons.code, code));
      } else {
        await db.insert(systemCoupons).values({
          code,
          discountType: input.discountType,
          discountValue: input.discountValue.toString(),
          durationMonths: input.durationMonths,
          maxUses: input.maxUses,
          isActive: input.isActive,
        });
      }
      return { success: true };
    }),

  // ─── Ação de gestão: alterar status de assinatura de uma escola ──────────
  updateOrgSubscription: isSuperAdmin
    .input(z.object({
      orgId: z.number().int().positive(),
      // Valores válidos que correspondem aos usados no sistema
      subscriptionStatus: z.enum(['active', 'trialing', 'pending', 'past_due', 'canceled', 'inactive', 'suspended']),
      // PRD_TRIAL_PERIOD: período de teste GRÁTIS quando o status é 'trialing'.
      // O fim do trial é calculado server-side (trialEndsAt = agora + período).
      trialPeriod: z.object({
        unit: z.enum(["dias", "meses"]),
        amount: z.number().int().min(1).max(365),
      }).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Verificar que a org existe antes de alterar
      const [org] = await db.select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.id, input.orgId))
        .limit(1);

      if (!org) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Organização não encontrada." });
      }

      const updates: any = {
        subscriptionStatus: input.subscriptionStatus,
        updatedAt: new Date(),
      };

      // Trial com período definido: grava o fim do teste gratuito
      // (trialEndsAt é o campo que o restante do sistema usa p/ liberar/bloquear)
      if (input.subscriptionStatus === "trialing" && input.trialPeriod) {
        const end = new Date();
        if (input.trialPeriod.unit === "dias") {
          end.setDate(end.getDate() + input.trialPeriod.amount);
        } else {
          end.setMonth(end.getMonth() + input.trialPeriod.amount);
        }
        updates.trialEndsAt = end;
        // Saída de trial não pode manter cobrança assinada ativa
        updates.asaasSubscriptionId = null;
        updates.currentPeriodEnd = null;
      }

      await db.update(organizations)
        .set(updates)
        .where(eq(organizations.id, input.orgId));

      debugLog(`[SuperAdmin] Status da org #${input.orgId} alterado para "${input.subscriptionStatus}"${updates.trialEndsAt ? ` (trial até ${updates.trialEndsAt.toISOString().slice(0, 10)})` : ""}.`);
      return { success: true, trialEndsAt: updates.trialEndsAt ?? null };
    }),

  // ─── Ação de suporte: redefinir senha do usuário administrador da escola ─────
  resetUserPassword: isSuperAdmin
    .input(z.object({
      userId: z.number().int().positive(),
      newPassword: z.string().min(6, "A senha deve ter no mínimo 6 caracteres"),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const crypto = await import("crypto");
      const salt = crypto.randomBytes(16).toString("hex");
      const derivedKey = crypto.scryptSync(input.newPassword, salt, 64).toString("hex");
      const passwordHash = `${salt}:${derivedKey}`;

      await db.update(users)
        .set({ passwordHash, mustChangePassword: true, updatedAt: new Date() })
        .where(eq(users.id, input.userId));

      debugLog(`[SuperAdmin] Senha do usuário #${input.userId} redefinida pelo Super Admin.`);
      return { success: true };
    }),

  // ─── GESTÃO DE CLIENTES / LOGOS DA LANDING PAGE ─────────────────────────────
  listLandingClients: isSuperAdmin
    .query(async () => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { asc } = await import("drizzle-orm");
      return await db.select().from(landingClients).orderBy(asc(landingClients.order), asc(landingClients.createdAt));
    }),

  createLandingClient: isSuperAdmin
    .input(z.object({
      name: z.string().min(1, "Nome da escola ou cliente é obrigatório"),
      logoUrl: z.string().min(1, "URL ou imagem da logo é obrigatória"),
      websiteUrl: z.string().optional().nullable(),
      testimonial: z.string().optional().nullable(),
      order: z.number().int().default(0),
      isActive: z.boolean().default(true),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [newClient] = await db.insert(landingClients).values({
        name: input.name,
        logoUrl: input.logoUrl,
        websiteUrl: input.websiteUrl || null,
        testimonial: input.testimonial || null,
        order: input.order,
        isActive: input.isActive,
      }).returning();

      return newClient;
    }),

  updateLandingClient: isSuperAdmin
    .input(z.object({
      id: z.number().int().positive(),
      name: z.string().min(1).optional(),
      logoUrl: z.string().min(1).optional(),
      websiteUrl: z.string().optional().nullable(),
      testimonial: z.string().optional().nullable(),
      order: z.number().int().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const { id, ...data } = input;
      const [updated] = await db.update(landingClients)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(landingClients.id, id))
        .returning();

      return updated;
    }),

  deleteLandingClient: isSuperAdmin
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db.delete(landingClients).where(eq(landingClients.id, input.id));
      return { success: true };
    }),

  // ─── PUXAR LOGOS DAS ESCOLAS CADASTRADAS ────────────────────────────────────
  // Lista todas as organizações com a logo que já está no sistema, indicando
  // quais já estão vinculadas à vitrine da landing page.
  listSchoolLogos: isSuperAdmin.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const orgs = await db
      .select({ id: organizations.id, name: organizations.name, logo: organizations.logo })
      .from(organizations)
      .orderBy(asc(organizations.name));

    const links = await db
      .select({ id: landingClients.id, organizationId: landingClients.organizationId, isActive: landingClients.isActive })
      .from(landingClients)
      .where(isNotNull(landingClients.organizationId));

    const byOrg = new Map<number, { id: number; isActive: boolean }>();
    links.forEach((l: any) => byOrg.set(Number(l.organizationId), { id: Number(l.id), isActive: l.isActive === true }));

    return orgs.map((o: any) => {
      const link = byOrg.get(Number(o.id));
      return {
        id: Number(o.id),
        name: o.name,
        logo: o.logo || null,
        hasLogo: !!(o.logo && String(o.logo).trim()),
        landingClientId: link?.id ?? null,
        landingActive: link?.isActive === true,
      };
    });
  }),

  /**
   * Sincroniza a vitrine com a seleção de escolas:
   *  • publica as novas (com logo) e reativa/atualiza a logo das existentes;
   *  • desativa (soft) os vínculos de escolas desmarcadas — preserva
   *    depoimento/ordem/link editados manualmente.
   */
  syncSchoolLogos: isSuperAdmin
    .input(z.object({
      organizationIds: z.array(z.number().int().positive()).max(200, "Limite de 200 escolas por vez"),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const selected = Array.from(new Set(input.organizationIds.map(Number)));

      const orgs = selected.length > 0
        ? await db
            .select({ id: organizations.id, name: organizations.name, logo: organizations.logo })
            .from(organizations)
            .where(inArray(organizations.id, selected))
        : [];
      const withLogo = orgs.filter((o: any) => o.logo && String(o.logo).trim());
      const validIds = withLogo.map((o: any) => Number(o.id));

      const currentLinks = await db
        .select({ id: landingClients.id, organizationId: landingClients.organizationId, isActive: landingClients.isActive })
        .from(landingClients)
        .where(isNotNull(landingClients.organizationId));
      const currentByOrg = new Map<number, { id: number; isActive: boolean }>();
      currentLinks.forEach((l: any) => currentByOrg.set(Number(l.organizationId), { id: Number(l.id), isActive: l.isActive === true }));

      const { toPublish, toDeactivate } = diffLandingSchoolSelection(Array.from(currentByOrg.keys()), validIds);

      // Escolas selecionadas que já existem: reativa e atualiza a logo (mantém
      // nome/depoimento/ordem personalizados pelo super admin).
      let reactivated = 0;
      for (const orgId of validIds) {
        const existing = currentByOrg.get(orgId);
        if (!existing) continue;
        const org = withLogo.find((o: any) => Number(o.id) === orgId)!;
        await db.update(landingClients)
          .set({ isActive: true, logoUrl: org.logo as string, updatedAt: new Date() })
          .where(eq(landingClients.id, existing.id));
        if (!existing.isActive) reactivated++;
      }

      if (toDeactivate.length > 0) {
        await db.update(landingClients)
          .set({ isActive: false, updatedAt: new Date() })
          .where(and(isNotNull(landingClients.organizationId), inArray(landingClients.organizationId, toDeactivate)));
      }

      let added = 0;
      if (toPublish.length > 0) {
        const [maxRow] = await db
          .select({ maxOrder: sql<number>`COALESCE(MAX(${landingClients.order}), 0)::int` })
          .from(landingClients);
        const base = Number(maxRow?.maxOrder) || 0;
        const rows = toPublish.map((orgId, idx) => {
          const org = withLogo.find((o: any) => Number(o.id) === orgId)!;
          return {
            name: org.name,
            logoUrl: org.logo as string,
            organizationId: orgId,
            order: base + idx + 1,
            isActive: true,
          };
        });
        await db.insert(landingClients).values(rows);
        added = rows.length;
      }

      return {
        success: true,
        added,
        reactivated,
        deactivated: toDeactivate.length,
        totalSelected: validIds.length,
        invalid: selected.length - validIds.length,
      };
    }),

  // ─── GESTÃO DE SLIDES DE FUNCIONALIDADES (HERO SLIDER) ──────────────────────
  listHeroSlides: isSuperAdmin
    .query(async () => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { asc } = await import("drizzle-orm");
      return await db.select().from(landingHeroSlides).orderBy(asc(landingHeroSlides.order), asc(landingHeroSlides.id));
    }),

  createHeroSlide: isSuperAdmin
    .input(z.object({
      title: z.string().min(1, "Título é obrigatório"),
      highlight: z.string().min(1, "Texto destacado é obrigatório"),
      subtitle: z.string().min(1, "Subtítulo é obrigatório"),
      points: z.array(z.string()).default([]),
      imageUrl: z.string().min(1, "Imagem do slide é obrigatória"),
      bgTheme: z.string().default("slate-900"),
      order: z.number().int().default(0),
      isActive: z.boolean().default(true),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [newSlide] = await db.insert(landingHeroSlides).values({
        title: input.title,
        highlight: input.highlight,
        subtitle: input.subtitle,
        points: JSON.stringify(input.points),
        imageUrl: input.imageUrl,
        bgTheme: input.bgTheme,
        order: input.order,
        isActive: input.isActive,
      }).returning();

      return newSlide;
    }),

  updateHeroSlide: isSuperAdmin
    .input(z.object({
      id: z.number().int().positive(),
      title: z.string().min(1).optional(),
      highlight: z.string().min(1).optional(),
      subtitle: z.string().min(1).optional(),
      points: z.array(z.string()).optional(),
      imageUrl: z.string().min(1).optional(),
      bgTheme: z.string().optional(),
      order: z.number().int().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const { id, points, ...rest } = input;
      const updateData: any = { ...rest, updatedAt: new Date() };
      if (points !== undefined) {
        updateData.points = JSON.stringify(points);
      }

      const [updated] = await db.update(landingHeroSlides)
        .set(updateData)
        .where(eq(landingHeroSlides.id, id))
        .returning();

      return updated;
    }),

  deleteHeroSlide: isSuperAdmin
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db.delete(landingHeroSlides).where(eq(landingHeroSlides.id, input.id));
      return { success: true };
    }),

  // ─── BUSCA GLOBAL DE USUÁRIOS (Para Impersonação / Suporte) ───────────────
  listAllUsers: isSuperAdmin
    .input(z.object({
      search: z.string().optional(),
      role: z.enum(['admin', 'professor', 'aluno']).optional(),
      organizationId: z.number().int().optional(),
      limit: z.number().int().default(50),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const { ilike, or, and, desc } = await import("drizzle-orm");
      const conditions: any[] = [];

      if (input?.search && input.search.trim()) {
        const term = `%${input.search.trim()}%`;
        conditions.push(or(ilike(users.name, term), ilike(users.email, term)));
      }

      if (input?.role) {
        conditions.push(eq(users.role, input.role));
      }

      if (input?.organizationId) {
        conditions.push(eq(users.organizationId, input.organizationId));
      }

      const usersList = await db.select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        organizationId: users.organizationId,
        studentId: users.studentId,
        lastSignedIn: users.lastSignedIn,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(users.lastSignedIn), desc(users.id))
      .limit(input?.limit || 50);

      // Buscar nomes das organizações correspondentes
      const orgIds = Array.from(new Set(usersList.map(u => u.organizationId).filter(Boolean))) as number[];
      let orgMap = new Map<number, string>();
      if (orgIds.length > 0) {
        const orgs = await db.select({ id: organizations.id, name: organizations.name })
          .from(organizations)
          .where(inArray(organizations.id, orgIds));
        orgMap = new Map(orgs.map(o => [o.id, o.name]));
      }

      return usersList.map(u => ({
        ...u,
        organizationName: u.organizationId ? orgMap.get(u.organizationId) || "Escola Desconhecida" : "Sem Escola",
      }));
    }),

  // ─── INICIAR SESSÃO DE SUPORTE / IMPERSONAÇÃO ─────────────────────────────
  impersonateUser: isSuperAdmin
    .input(z.object({
      targetUserId: z.number().int().positive(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Localiza o usuário alvo
      const [targetUser] = await db.select().from(users).where(eq(users.id, input.targetUserId)).limit(1);
      if (!targetUser) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Usuário alvo não encontrado." });
      }

      if (targetUser.id === ctx.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Você já está conectado na sua própria conta de Super Admin." });
      }

      const { sdk } = await import("./_core/sdk");
      const { COOKIE_NAME } = await import("@shared/const");
      const { getSessionCookieOptions } = await import("./_core/cookies");

      // Gera o token de sessão do usuário alvo preservando a identidade do Super Admin
      const sessionToken = await sdk.createSessionToken(targetUser.openId, {
        name: targetUser.name || "",
        expiresInMs: 4 * 60 * 60 * 1000, // 4 horas de sessão de suporte
        impersonatorAdminId: ctx.user.id,
        impersonatorAdminName: ctx.user.name || ctx.user.email || "Super Admin",
      });

      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, {
        ...cookieOptions,
        maxAge: 4 * 60 * 60 * 1000,
      });

      debugLog(`[Impersonation] Super Admin #${ctx.user.id} (${ctx.user.email}) acessou a conta de #${targetUser.id} (${targetUser.email} - ${targetUser.role})`);

      // Determina a rota de redirecionamento apropriada
      let redirectUrl = "/dashboard";
      if (targetUser.role === "aluno") {
        redirectUrl = "/portal";
      }

      return {
        success: true,
        targetUser: {
          id: targetUser.id,
          name: targetUser.name,
          email: targetUser.email,
          role: targetUser.role,
        },
        redirectUrl,
      };
    }),

  // ─── ENCERRAR SESSÃO DE SUPORTE / VOLTAR PARA SUPER ADMIN ─────────────────
  stopImpersonation: protectedProcedure
    .mutation(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      if (!ctx.impersonatorAdminId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Você não está em uma sessão de impersonação / modo suporte ativa.",
        });
      }

      const [adminUser] = await db.select().from(users).where(eq(users.id, ctx.impersonatorAdminId)).limit(1);
      if (!adminUser) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Conta de Super Admin de origem não encontrada." });
      }

      const { sdk } = await import("./_core/sdk");
      const { COOKIE_NAME } = await import("@shared/const");
      const { getSessionCookieOptions } = await import("./_core/cookies");

      // Gera o token restaurado do Super Admin
      const sessionToken = await sdk.createSessionToken(adminUser.openId, {
        name: adminUser.name || "",
        expiresInMs: 30 * 24 * 60 * 60 * 1000,
      });

      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, {
        ...cookieOptions,
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });

      debugLog(`[Impersonation] Sessão de suporte encerrada. Retornando para Super Admin #${adminUser.id} (${adminUser.email})`);

      return {
        success: true,
        redirectUrl: "/super-admin",
      };
    }),
});



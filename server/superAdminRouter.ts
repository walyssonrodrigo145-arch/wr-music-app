import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import { eq, sql, count } from "drizzle-orm";
import { systemPlans, systemCoupons, organizations, users, students } from "../drizzle/schema";
import { ENV } from "./_core/env";

// ─── Middleware de autorização ────────────────────────────────────────────────
// REGRA: Somente o usuário configurado em SUPER_ADMIN_EMAIL (variável de ambiente)
// OU via OWNER_OPEN_ID tem acesso. O e-mail NUNCA deve ser hardcoded no código-fonte.
const isSuperAdmin = protectedProcedure.use(async ({ ctx, next }) => {
  // ENV.superAdminEmail é lido de process.env.SUPER_ADMIN_EMAIL — nunca hardcoded.
  // Em produção, a variável é obrigatória (validada em env.ts).
  const superAdminEmail = ENV.superAdminEmail;

  const isMaster =
    (superAdminEmail && ctx.user.email?.toLowerCase() === superAdminEmail) ||
    (ENV.ownerOpenId && ctx.user.openId === ENV.ownerOpenId);

  if (!isMaster) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Acesso restrito exclusivamente ao Super Admin.",
    });
  }
  return next({ ctx });
});

export const superAdminRouter = router({

  // ─── Dashboard: contagens globais usando COUNT(*) no SQL ──────────────────
  getDashboardStats: isSuperAdmin.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB indisponível" });

    // FIX: usar COUNT(*) em vez de SELECT * para evitar Full Table Scan em memória
    const [{ totalOrgs }] = await db.select({ totalOrgs: sql<number>`CAST(count(*) AS INT)` }).from(organizations);
    const [{ totalProfs }] = await db.select({ totalProfs: sql<number>`CAST(count(*) AS INT)` }).from(users).where(eq(users.role, "professor"));
    const [{ totalStuds }] = await db.select({ totalStuds: sql<number>`CAST(count(*) AS INT)` }).from(students);

    // Últimas 10 organizações para o painel — apenas campos seguros
    const recentOrgs = await db.select({
      id: organizations.id,
      name: organizations.name,
      subscriptionStatus: organizations.subscriptionStatus,
      createdAt: organizations.createdAt,
    }).from(organizations).limit(10);

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

    // FIX: usar COUNT agrupado por org em vez de carregar todos os users/alunos em memória
    const userCounts = await db.select({
      organizationId: users.organizationId,
      total: sql<number>`CAST(count(*) AS INT)`,
    }).from(users).groupBy(users.organizationId);

    const studentCounts = await db.select({
      organizationId: students.organizationId,
      total: sql<number>`CAST(count(*) AS INT)`,
    }).from(students).groupBy(students.organizationId);

    // FIX: buscar owner com apenas campos seguros (sem passwordHash, tokens)
    const admins = await db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      organizationId: users.organizationId,
      role: users.role,
    }).from(users).where(eq(users.role, 'admin'));

    const userCountMap = new Map(userCounts.map(r => [r.organizationId, r.total]));
    const studentCountMap = new Map(studentCounts.map(r => [r.organizationId, r.total]));
    const adminMap = new Map(admins.map(a => [a.organizationId, a]));

    return orgsList.map(org => ({
      ...org,
      owner: adminMap.get(org.id) ?? null,
      totalUsers: userCountMap.get(org.id) ?? 0,
      totalStudents: studentCountMap.get(org.id) ?? 0,
    }));
  }),

  // ─── Exclusão de organização: com transação e SQL parametrizado ──────────
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
      // FIX: usar sql`` parametrizado para cada tabela (sem sql.raw + concatenação)
      await db.transaction(async (tx) => {
        // Deleção em cascata usando queries Drizzle tipadas e seguras
        await tx.execute(sql`DELETE FROM "payment_dues" WHERE "organizationId" = ${orgId}`);
        await tx.execute(sql`DELETE FROM "lessons" WHERE "organizationId" = ${orgId}`);
        await tx.execute(sql`DELETE FROM "students" WHERE "organizationId" = ${orgId}`);
        await tx.execute(sql`DELETE FROM "expenses" WHERE "organizationId" = ${orgId}`);
        await tx.execute(sql`DELETE FROM "settings" WHERE "organizationId" = ${orgId}`);
        await tx.execute(sql`DELETE FROM "messages" WHERE "organizationId" = ${orgId}`);
        await tx.execute(sql`DELETE FROM "notices" WHERE "organizationId" = ${orgId}`);
        await tx.execute(sql`DELETE FROM "automations" WHERE "organizationId" = ${orgId}`);
        // Deleta usuários da organização (professores, admins)
        await tx.execute(sql`DELETE FROM "users" WHERE "organizationId" = ${orgId}`);
        // Por último, deleta a organização em si
        await tx.execute(sql`DELETE FROM "organizations" WHERE "id" = ${orgId}`);
      });

      console.log(`[SuperAdmin] Organização #${orgId} ("${org.name}") excluída permanentemente.`);
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
      maxStudents: z.number().int().min(1, "Limite mínimo é 1 aluno").max(99999),
      features: z.array(z.string()),
      isActive: z.boolean(),
      showOnLanding: z.boolean(),
      isPopular: z.boolean().default(false),
      order: z.number().int().default(0),
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
      subscriptionStatus: z.enum(['active', 'trialing', 'past_due', 'canceled', 'inactive', 'suspended']),
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

      await db.update(organizations)
        .set({ subscriptionStatus: input.subscriptionStatus, updatedAt: new Date() })
        .where(eq(organizations.id, input.orgId));

      console.log(`[SuperAdmin] Status da org #${input.orgId} alterado para "${input.subscriptionStatus}".`);
      return { success: true };
    }),
});

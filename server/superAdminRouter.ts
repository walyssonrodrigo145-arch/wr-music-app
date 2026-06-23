import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import { eq } from "drizzle-orm";
import { systemPlans, systemCoupons, organizations, users, students } from "../drizzle/schema";
import { ENV } from "./_core/env";

const isSuperAdmin = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.user.email !== 'walyssonrodrigo145@gmail.com' && ctx.user.openId !== ENV.ownerOpenId) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Acesso restrito ao Super Admin." });
  }
  return next({ ctx });
});

export const superAdminRouter = router({
  getDashboardStats: isSuperAdmin.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB indisponível" });

    const orgs = await db.select().from(organizations);
    const profs = await db.select().from(users).where(eq(users.role, "professor"));
    const studs = await db.select().from(students);

    return {
      totalOrganizations: orgs.length,
      totalProfessors: profs.length,
      totalStudents: studs.length,
      organizations: orgs.slice(0, 10), // keep for backward compatibility in UI dashboard
    };
  }),

  getOrganizations: isSuperAdmin.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    // Fetch orgs and attach user/student count
    const orgsList = await db.select().from(organizations);
    const allUsers = await db.select().from(users);
    const allStudents = await db.select().from(students);

    return orgsList.map(org => ({
      ...org,
      owner: allUsers.find(u => u.organizationId === org.id && u.role === 'admin'),
      totalUsers: allUsers.filter(u => u.organizationId === org.id).length,
      totalStudents: allStudents.filter(s => s.organizationId === org.id).length,
    }));
  }),

  deleteOrganization: isSuperAdmin
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      
      const { sql } = await import("drizzle-orm");
      
      // Delete everything related to this org to avoid FK errors (Brute force cascade)
      // We use raw sql because Drizzle might not have all tables imported easily here
      await db.execute(sql`DELETE FROM "ai_messages" WHERE "organizationId" = ${input.id}`);
      await db.execute(sql`DELETE FROM "ai_conversations" WHERE "organizationId" = ${input.id}`);
      await db.execute(sql`DELETE FROM "attendance_logs" WHERE "organizationId" = ${input.id}`);
      await db.execute(sql`DELETE FROM "chat_messages" WHERE "organizationId" = ${input.id}`);
      await db.execute(sql`DELETE FROM "daily_study_plans" WHERE "organizationId" = ${input.id}`);
      await db.execute(sql`DELETE FROM "expenses" WHERE "organizationId" = ${input.id}`);
      await db.execute(sql`DELETE FROM "lessons" WHERE "organizationId" = ${input.id}`);
      await db.execute(sql`DELETE FROM "notifications" WHERE "organizationId" = ${input.id}`);
      await db.execute(sql`DELETE FROM "payment_dues" WHERE "organizationId" = ${input.id}`);
      await db.execute(sql`DELETE FROM "professor_payments" WHERE "organizationId" = ${input.id}`);
      await db.execute(sql`DELETE FROM "reminders" WHERE "organizationId" = ${input.id}`);
      await db.execute(sql`DELETE FROM "settings" WHERE "organizationId" = ${input.id}`);
      await db.execute(sql`DELETE FROM "student_evolution" WHERE "organizationId" = ${input.id}`);
      await db.execute(sql`DELETE FROM "student_goals" WHERE "organizationId" = ${input.id}`);
      await db.execute(sql`DELETE FROM "student_timeline" WHERE "organizationId" = ${input.id}`);
      
      // Core tables
      await db.execute(sql`DELETE FROM "students" WHERE "organizationId" = ${input.id}`);
      await db.execute(sql`DELETE FROM "users" WHERE "organizationId" = ${input.id}`);
      await db.execute(sql`DELETE FROM "organizations" WHERE "id" = ${input.id}`);

      return { success: true };
    }),

  getPlans: isSuperAdmin.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    return await db.select().from(systemPlans);
  }),

  savePlan: isSuperAdmin
    .input(z.object({
      id: z.string(),
      name: z.string(),
      priceMonthly: z.number(),
      priceYearly: z.number(),
      maxStudents: z.number(),
      features: z.array(z.string()),
      isActive: z.boolean(),
      showOnLanding: z.boolean(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      
      const exists = await db.select().from(systemPlans).where(eq(systemPlans.id, input.id));
      if (exists.length > 0) {
        await db.update(systemPlans).set({
          name: input.name,
          priceMonthly: input.priceMonthly.toString(),
          priceYearly: input.priceYearly.toString(),
          maxStudents: input.maxStudents,
          features: JSON.stringify(input.features),
          isActive: input.isActive,
          showOnLanding: input.showOnLanding,
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
        });
      }
      return { success: true };
    }),

  getCoupons: isSuperAdmin.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    return await db.select().from(systemCoupons);
  }),

  saveCoupon: isSuperAdmin
    .input(z.object({
      code: z.string(),
      discountType: z.enum(['PERCENTAGE', 'FIXED']),
      discountValue: z.number(),
      durationMonths: z.number().nullable(),
      maxUses: z.number().nullable(),
      isActive: z.boolean(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const exists = await db.select().from(systemCoupons).where(eq(systemCoupons.code, input.code));
      if (exists.length > 0) {
        await db.update(systemCoupons).set({
          discountType: input.discountType,
          discountValue: input.discountValue.toString(),
          durationMonths: input.durationMonths,
          maxUses: input.maxUses,
          isActive: input.isActive,
        }).where(eq(systemCoupons.code, input.code));
      } else {
        await db.insert(systemCoupons).values({
          code: input.code.toUpperCase(),
          discountType: input.discountType,
          discountValue: input.discountValue.toString(),
          durationMonths: input.durationMonths,
          maxUses: input.maxUses,
          isActive: input.isActive,
        });
      }
      return { success: true };
    }),
});

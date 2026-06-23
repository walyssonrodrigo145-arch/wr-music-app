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
      
      const orgId = Number(input.id);
      
      // Dynamic cascade deletion: finds all tables that have organizationId and deletes the rows
      await db.execute(sql.raw(`
        DO $$ 
        DECLARE 
          t_name text;
        BEGIN 
          FOR t_name IN 
            SELECT table_name 
            FROM information_schema.columns 
            WHERE column_name = 'organizationId' AND table_schema = 'public'
          LOOP 
            EXECUTE 'DELETE FROM "' || t_name || '" WHERE "organizationId" = ' || ${orgId}; 
          END LOOP; 
        END $$;
      `));

      // Finally, delete the organization itself
      await db.execute(sql`DELETE FROM "organizations" WHERE "id" = ${orgId}`);

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
      isPopular: z.boolean().default(false),
      order: z.number().default(0),
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
          isPopular: input.isPopular,
          order: input.order,
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

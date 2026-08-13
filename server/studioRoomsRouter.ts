import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { studioRooms } from "../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";

let schemaEnsured = false;
async function ensureStudioRoomsSchema(db: any) {
  if (schemaEnsured) return;
  try {
    await db.execute(sql`ALTER TABLE "studio_rooms" ADD COLUMN IF NOT EXISTS "category" varchar(100) DEFAULT 'Estúdio de gravação' NOT NULL`);
    await db.execute(sql`ALTER TABLE "studio_rooms" ADD COLUMN IF NOT EXISTS "capacity" integer DEFAULT 8 NOT NULL`);
    await db.execute(sql`ALTER TABLE "studio_rooms" ADD COLUMN IF NOT EXISTS "equipments" text DEFAULT 'Bateria, Teclado, Ar Condicionado' NOT NULL`);
    await db.execute(sql`ALTER TABLE "studio_rooms" ADD COLUMN IF NOT EXISTS "status" varchar(20) DEFAULT 'ativa' NOT NULL`);
    await db.execute(sql`ALTER TABLE "studio_rooms" ADD COLUMN IF NOT EXISTS "imageUrl" text`);
    await db.execute(sql`ALTER TABLE "studio_rooms" ADD COLUMN IF NOT EXISTS "utilization_rate" integer DEFAULT 75 NOT NULL`);
    await db.execute(sql`ALTER TABLE "studio_rooms" ADD COLUMN IF NOT EXISTS "is_principal" boolean DEFAULT false NOT NULL`);
    schemaEnsured = true;
  } catch (e: any) {
    console.warn("ensureStudioRoomsSchema failed:", e?.message);
  }
}

export const studioRoomsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    await ensureStudioRoomsSchema(db);
    const orgId = ctx.user.organizationId!;
    return db.select().from(studioRooms).where(eq(studioRooms.organizationId, orgId));
  }),

  stats: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { total: 0, active: 0, maintenance: 0, avgUtilization: 0, avgRating: 4.8 };
    await ensureStudioRoomsSchema(db);
    const orgId = ctx.user.organizationId!;
    const rooms = await db.select().from(studioRooms).where(eq(studioRooms.organizationId, orgId));

    if (rooms.length === 0) {
      return {
        total: 0,
        active: 0,
        maintenance: 0,
        avgUtilization: 0,
        avgRating: 0
      };
    }

    const total = rooms.length;
    const active = rooms.filter(r => r.status === "ativa" && r.active).length;
    const maintenance = rooms.filter(r => r.status === "manutencao").length;
    const totalUtil = rooms.reduce((acc, r) => acc + (r.utilizationRate || 0), 0);
    const avgUtilization = total > 0 ? Math.round(totalUtil / total) : 0;

    return {
      total,
      active,
      maintenance,
      avgUtilization,
      avgRating: 4.8
    };
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1, "Nome da sala é obrigatório"),
        description: z.string().optional(),
        category: z.string().optional(),
        capacity: z.number().optional(),
        equipments: z.string().optional(),
        status: z.string().optional(),
        imageUrl: z.string().optional(),
        utilizationRate: z.number().optional(),
        isPrincipal: z.boolean().optional(),
        color: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await ensureStudioRoomsSchema(db);
      const orgId = ctx.user.organizationId!;

      const [newRoom] = await db
        .insert(studioRooms)
        .values({
          organizationId: orgId,
          name: input.name,
          description: input.description || null,
          category: input.category || "Estúdio de gravação",
          capacity: input.capacity || 8,
          equipments: input.equipments || "Bateria, Teclado, Ar Condicionado",
          status: input.status || "ativa",
          imageUrl: input.imageUrl && input.imageUrl.trim() ? input.imageUrl : null,
          utilizationRate: input.utilizationRate || 75,
          isPrincipal: input.isPrincipal || false,
          color: input.color || "#6366f1",
          active: true,
        })
        .returning();

      return newRoom;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        category: z.string().optional(),
        capacity: z.number().optional(),
        equipments: z.string().optional(),
        status: z.string().optional(),
        imageUrl: z.string().optional(),
        utilizationRate: z.number().optional(),
        isPrincipal: z.boolean().optional(),
        color: z.string().optional(),
        active: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await ensureStudioRoomsSchema(db);
      const orgId = ctx.user.organizationId!;

      const updateData: any = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.category !== undefined) updateData.category = input.category;
      if (input.capacity !== undefined) updateData.capacity = input.capacity;
      if (input.equipments !== undefined) updateData.equipments = input.equipments;
      if (input.status !== undefined) updateData.status = input.status;
      if (input.imageUrl !== undefined) updateData.imageUrl = input.imageUrl && input.imageUrl.trim() ? input.imageUrl : null;
      if (input.utilizationRate !== undefined) updateData.utilizationRate = input.utilizationRate;
      if (input.isPrincipal !== undefined) updateData.isPrincipal = input.isPrincipal;
      if (input.color !== undefined) updateData.color = input.color;
      if (input.active !== undefined) updateData.active = input.active;

      const [updated] = await db
        .update(studioRooms)
        .set(updateData)
        .where(and(eq(studioRooms.id, input.id), eq(studioRooms.organizationId, orgId)))
        .returning();

      return updated;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await ensureStudioRoomsSchema(db);
      const orgId = ctx.user.organizationId!;

      await db
        .delete(studioRooms)
        .where(and(eq(studioRooms.id, input.id), eq(studioRooms.organizationId, orgId)));

      return { success: true };
    }),
});

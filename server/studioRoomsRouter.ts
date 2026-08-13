import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { studioRooms } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

export const studioRoomsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    const orgId = ctx.user.organizationId!;
    return db.select().from(studioRooms).where(eq(studioRooms.organizationId, orgId));
  }),

  stats: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { total: 0, active: 0, maintenance: 0, avgUtilization: 0, avgRating: 4.8 };
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
      const orgId = ctx.user.organizationId!;

      const [newRoom] = await db
        .insert(studioRooms)
        .values({
          organizationId: orgId,
          name: input.name,
          description: input.description,
          category: input.category || "Estúdio de gravação",
          capacity: input.capacity || 8,
          equipments: input.equipments || "Bateria, Teclado, Ar Condicionado",
          status: input.status || "ativa",
          imageUrl: input.imageUrl,
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
      const orgId = ctx.user.organizationId!;

      const [updated] = await db
        .update(studioRooms)
        .set({
          ...(input.name !== undefined && { name: input.name }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.category !== undefined && { category: input.category }),
          ...(input.capacity !== undefined && { capacity: input.capacity }),
          ...(input.equipments !== undefined && { equipments: input.equipments }),
          ...(input.status !== undefined && { status: input.status }),
          ...(input.imageUrl !== undefined && { imageUrl: input.imageUrl }),
          ...(input.utilizationRate !== undefined && { utilizationRate: input.utilizationRate }),
          ...(input.isPrincipal !== undefined && { isPrincipal: input.isPrincipal }),
          ...(input.color !== undefined && { color: input.color }),
          ...(input.active !== undefined && { active: input.active }),
          updatedAt: new Date(),
        })
        .where(and(eq(studioRooms.id, input.id), eq(studioRooms.organizationId, orgId)))
        .returning();

      return updated;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const orgId = ctx.user.organizationId!;

      const { lessons } = await import("../drizzle/schema");
      const { count } = await import("drizzle-orm");
      const [result] = await db
        .select({ total: count() })
        .from(lessons)
        .where(
          and(
            eq(lessons.studioRoomId, input.id),
            eq(lessons.organizationId, orgId)
          )
        );

      if (result?.total && result.total > 0) {
        throw new Error(`Esta sala possui ${result.total} aula(s) associada(s). Remova ou realoque as aulas antes de excluir a sala.`);
      }

      await db
        .delete(studioRooms)
        .where(and(eq(studioRooms.id, input.id), eq(studioRooms.organizationId, orgId)));

      return { success: true };
    }),
});

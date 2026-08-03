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

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1, "Nome da sala é obrigatório"),
        description: z.string().optional(),
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
          color: input.color || "#3b82f6",
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

      await db
        .delete(studioRooms)
        .where(and(eq(studioRooms.id, input.id), eq(studioRooms.organizationId, orgId)));

      return { success: true };
    }),
});

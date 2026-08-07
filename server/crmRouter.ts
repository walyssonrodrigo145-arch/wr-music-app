import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import { crmLeads, students } from "../drizzle/schema";
import { eq, and, desc, sql } from "drizzle-orm";

export const crmRouter = router({
  listLeads: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const orgId = ctx.user.organizationId;
    if (!orgId) return [];

    return await db.select()
      .from(crmLeads)
      .where(eq(crmLeads.organizationId, orgId))
      .orderBy(desc(crmLeads.createdAt));
  }),

  createLead: protectedProcedure
    .input(z.object({
      name: z.string().min(1, "Nome é obrigatório"),
      phone: z.string().optional().nullable(),
      email: z.string().optional().nullable(),
      instrument: z.string().optional().nullable(),
      value: z.number().default(0),
      notes: z.string().optional().nullable(),
      source: z.string().default("WhatsApp"),
      stage: z.enum(["novo", "contato", "aula_agendada", "aula_realizada", "matriculado", "perdido"]).default("novo"),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const orgId = ctx.user.organizationId;
      if (!orgId) throw new TRPCError({ code: "FORBIDDEN", message: "Sem organização vinculada" });

      const [created] = await db.insert(crmLeads)
        .values({
          organizationId: orgId,
          name: input.name,
          phone: input.phone,
          email: input.email,
          instrument: input.instrument,
          value: String(input.value),
          notes: input.notes,
          source: input.source,
          stage: input.stage,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      return created;
    }),

  updateStage: protectedProcedure
    .input(z.object({
      leadId: z.number(),
      stage: z.enum(["novo", "contato", "aula_agendada", "aula_realizada", "matriculado", "perdido"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [updated] = await db.update(crmLeads)
        .set({
          stage: input.stage,
          updatedAt: new Date(),
        })
        .where(and(
          eq(crmLeads.id, input.leadId),
          eq(crmLeads.organizationId, ctx.user.organizationId!)
        ))
        .returning();

      return updated;
    }),

  deleteLead: protectedProcedure
    .input(z.object({ leadId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db.delete(crmLeads)
        .where(and(
          eq(crmLeads.id, input.leadId),
          eq(crmLeads.organizationId, ctx.user.organizationId!)
        ));

      return { ok: true };
    }),

  convertToStudent: protectedProcedure
    .input(z.object({
      leadId: z.number(),
      monthlyFee: z.number().default(0),
      dueDay: z.number().default(10),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const orgId = ctx.user.organizationId;
      if (!orgId) throw new TRPCError({ code: "FORBIDDEN" });

      // Buscar lead
      const [lead] = await db.select()
        .from(crmLeads)
        .where(and(
          eq(crmLeads.id, input.leadId),
          eq(crmLeads.organizationId, orgId)
        ));

      if (!lead) throw new TRPCError({ code: "NOT_FOUND", message: "Lead não encontrado" });

      // Criar aluno
      const [student] = await db.insert(students)
        .values({
          userId: ctx.user.id,
          professorId: ctx.user.id,
          name: lead.name,
          phone: lead.phone || "",
          email: lead.email || `${lead.name.toLowerCase().replace(/\s+/g, ".")}@aluno.local`,
          monthlyFee: String(input.monthlyFee > 0 ? input.monthlyFee : lead.value || 0),
          dueDay: input.dueDay,
          status: "ativo",
          notes: `Convertido do Funil Comercial. Obs: ${lead.notes || ""}`,
          startDate: new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }),
        })
        .returning();

      // Atualizar estágio do lead para matriculado
      await db.update(crmLeads)
        .set({ stage: "matriculado", updatedAt: new Date() })
        .where(eq(crmLeads.id, lead.id));

      return { student, lead };
    }),
});

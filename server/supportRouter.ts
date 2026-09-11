// ─── Suporte / Chamados (bugs e melhorias reportados pelas escolas) ───────────
// Qualquer usuário autenticado (admin/professor) abre um chamado. O dono da
// plataforma (SuperAdmin) lista e atualiza o status pelo Master Panel.
import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { supportTickets, organizations, users } from "../drizzle/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { notifyOwner } from "./_core/notification";
import { isSuperAdmin } from "./superAdminRouter";

export const supportRouter = router({
  create: protectedProcedure
    .input(z.object({
      category: z.enum(["bug", "melhoria", "duvida", "outro"]).default("melhoria"),
      title: z.string().min(3).max(200),
      description: z.string().min(5).max(5000),
      pageUrl: z.string().max(500).optional(),
      priority: z.enum(["baixa", "media", "alta"]).default("media"),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const [ticket] = await db.insert(supportTickets).values({
        organizationId: ctx.user.organizationId ?? null,
        userId: ctx.user.id,
        category: input.category,
        title: input.title.trim(),
        description: input.description.trim(),
        pageUrl: input.pageUrl ?? null,
        priority: input.priority,
        status: "aberto",
      }).returning({ id: supportTickets.id });

      // Notifica o dono da plataforma (best-effort)
      try {
        const cat = input.category === "bug" ? "Bug" : input.category === "melhoria" ? "Melhoria" : input.category === "duvida" ? "Dúvida" : "Outro";
        await notifyOwner({
          title: `🎫 Novo chamado (${cat})`,
          content: `${ctx.user.name || "Usuário"}: ${input.title}\n\n${input.description}`,
        });
      } catch (e) {
        console.warn("[Support] Falha ao notificar o dono:", e);
      }

      return { success: true, id: ticket.id };
    }),

  // Chamados da escola do usuário (o admin acompanha os da própria escola)
  listMine: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    const orgId = ctx.user.organizationId;
    if (!orgId) return [];
    return db.select().from(supportTickets)
      .where(eq(supportTickets.organizationId, orgId))
      .orderBy(desc(supportTickets.createdAt))
      .limit(100);
  }),

  // Todos os chamados (apenas SuperAdmin)
  listAll: isSuperAdmin.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db.select({
      ticket: supportTickets,
      orgName: organizations.name,
      userName: users.name,
      userEmail: users.email,
    }).from(supportTickets)
      .leftJoin(organizations, eq(supportTickets.organizationId, organizations.id))
      .leftJoin(users, eq(supportTickets.userId, users.id))
      .orderBy(desc(supportTickets.createdAt))
      .limit(500);
    return rows.map((r: any) => ({ ...r.ticket, orgName: r.orgName, userName: r.userName, userEmail: r.userEmail }));
  }),

  // Atualiza status/prioridade/resposta (apenas SuperAdmin)
  updateStatus: isSuperAdmin
    .input(z.object({
      id: z.number(),
      status: z.enum(["aberto", "em_andamento", "resolvido", "fechado"]),
      priority: z.enum(["baixa", "media", "alta"]).optional(),
      adminResponse: z.string().max(5000).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const patch: Record<string, any> = { status: input.status, updatedAt: new Date() };
      if (input.priority) patch.priority = input.priority;
      if (input.adminResponse !== undefined) patch.adminResponse = input.adminResponse;
      if (input.status === "resolvido" || input.status === "fechado") patch.resolvedAt = new Date();
      await db.update(supportTickets).set(patch).where(eq(supportTickets.id, input.id));
      return { success: true };
    }),

  // Contagem de chamados abertos da escola (badge no header)
  openCount: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return 0;
    const orgId = ctx.user.organizationId;
    if (!orgId) return 0;
    const [row] = await db.select({ c: sql<number>`CAST(count(*) AS INT)` })
      .from(supportTickets)
      .where(and(eq(supportTickets.organizationId, orgId), eq(supportTickets.status, "aberto")));
    return Number(row?.c ?? 0);
  }),
});

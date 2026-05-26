import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { fcmTokens } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { sendPushNotification } from "./firebaseAdmin";

export const fcmRouter = router({
  registerToken: protectedProcedure.input(z.object({
    token: z.string(),
    deviceInfo: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    
    const orgId = ctx.user.organizationId!;
    
    // Verifica se o token já existe
    const [existing] = await db.select().from(fcmTokens).where(eq(fcmTokens.token, input.token));
    
    if (existing) {
      // Atualiza o userId caso o mesmo device seja usado por outra conta (menos comum, mas possível)
      if (existing.userId !== ctx.user.id) {
         await db.update(fcmTokens)
           .set({ userId: ctx.user.id, updatedAt: new Date() })
           .where(eq(fcmTokens.token, input.token));
      }
      return { success: true, message: "Token já registrado" };
    }
    
    await db.insert(fcmTokens).values({
      organizationId: orgId,
      userId: ctx.user.id,
      token: input.token,
      deviceInfo: input.deviceInfo || "Navegador Web",
    });
    
    return { success: true };
  }),

  testNotification: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    
    const tokens = await db.select().from(fcmTokens).where(eq(fcmTokens.userId, ctx.user.id));
    if (tokens.length === 0) {
      throw new Error("Nenhum dispositivo registrado para notificações");
    }
    
    let sentCount = 0;
    for (const device of tokens) {
      const success = await sendPushNotification(
        device.token,
        "Teste de Notificação 🎉",
        "Seu sistema de Push Notifications está funcionando perfeitamente!"
      );
      if (success) sentCount++;
    }
    
    return { success: true, sentCount };
  }),
});

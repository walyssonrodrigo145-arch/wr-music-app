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
    
    const [existing] = await db.select().from(fcmTokens).where(eq(fcmTokens.token, input.token));
    
    if (existing) {
      if (existing.userId !== ctx.user.id) {
         await db.update(fcmTokens)
           .set({ userId: ctx.user.id, updatedAt: new Date() })
           .where(eq(fcmTokens.token, input.token));
      }
      return { success: true, message: "Dispositivo já cadastrado!" };
    }
    
    await db.insert(fcmTokens).values({
      organizationId: orgId,
      userId: ctx.user.id,
      token: input.token,
      deviceInfo: input.deviceInfo || "Navegador Web",
    });
    
    return { success: true, message: "Novo dispositivo registrado com sucesso!" };
  }),

  // Deleta todos os tokens antigos do usuário e grava exclusivamente o atual
  cleanAndRegisterToken: protectedProcedure.input(z.object({
    token: z.string(),
    deviceInfo: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    
    const orgId = ctx.user.organizationId!;
    
    // Remove todos os tokens anteriores deste usuário
    await db.delete(fcmTokens).where(eq(fcmTokens.userId, ctx.user.id));
    
    // Insere o novo token atual do aparelho
    await db.insert(fcmTokens).values({
      organizationId: orgId,
      userId: ctx.user.id,
      token: input.token,
      deviceInfo: input.deviceInfo || "Dispositivo Atual",
    });
    
    return { success: true, message: "Dispositivos limpos e este aparelho cadastrado como principal!" };
  }),

  testNotification: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    
    const tokens = await db.select().from(fcmTokens).where(eq(fcmTokens.userId, ctx.user.id));
    if (tokens.length === 0) {
      throw new Error("Nenhum dispositivo registrado para notificações. Clique em 'Sincronizar Celular'.");
    }
    
    let sentCount = 0;
    const deadTokens: string[] = [];

    for (const device of tokens) {
      const res = await sendPushNotification(
        device.token,
        "Teste de Notificação 🎉",
        `Dispositivo: ${device.deviceInfo || 'Celular/Web'} - Teste de envio em tempo real!`
      );
      if (res.success) {
        sentCount++;
      } else if (res.error === "messaging/registration-token-not-registered" || res.error === "messaging/invalid-registration-token") {
        deadTokens.push(device.token);
      }
    }
    
    // Auto-clean tokens mortos/expirados do banco
    if (deadTokens.length > 0) {
      for (const deadToken of deadTokens) {
        await db.delete(fcmTokens).where(eq(fcmTokens.token, deadToken));
      }
      console.log(`[Push Clean] Removidos ${deadTokens.length} tokens mortos para userId ${ctx.user.id}`);
    }
    
    return { success: true, sentCount, totalTokens: tokens.length, cleanedCount: deadTokens.length };
  }),
});

import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { fcmTokens } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { sendPushNotification, messaging as firebaseMessaging } from "./firebaseAdmin";

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

  // Deleta todos os tokens antigos do usuário e grava/atualiza o atual com ON CONFLICT
  cleanAndRegisterToken: protectedProcedure.input(z.object({
    token: z.string(),
    deviceInfo: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    
    const orgId = ctx.user.organizationId!;
    
    // 1. Remove todos os tokens anteriores associados a este usuário
    await db.delete(fcmTokens).where(eq(fcmTokens.userId, ctx.user.id));
    
    // 2. Insere/Atualiza com tratamento de conflito de token único
    await db.insert(fcmTokens)
      .values({
        organizationId: orgId,
        userId: ctx.user.id,
        token: input.token,
        deviceInfo: input.deviceInfo || "Dispositivo Principal",
      })
      .onConflictDoUpdate({
        target: fcmTokens.token,
        set: {
          userId: ctx.user.id,
          deviceInfo: input.deviceInfo || "Dispositivo Principal",
          updatedAt: new Date(),
        }
      });
    
    return { success: true, message: "Dispositivos limpos e este aparelho cadastrado como principal!" };
  }),

  // Diagnóstico: verifica se o Firebase Admin está configurado corretamente
  getFirebaseStatus: protectedProcedure.query(async () => {
    const isConfigured = !!firebaseMessaging;
    const hasProjectId = !!process.env.FIREBASE_PROJECT_ID;
    const hasClientEmail = !!process.env.FIREBASE_CLIENT_EMAIL;
    const hasPrivateKey = !!process.env.FIREBASE_PRIVATE_KEY;

    return {
      isConfigured,
      hasProjectId,
      hasClientEmail,
      hasPrivateKey,
      message: isConfigured
        ? "Firebase Admin configurado e pronto para enviar notificações."
        : "Firebase Admin NÃO configurado. Verifique as variáveis de ambiente FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL e FIREBASE_PRIVATE_KEY na VPS.",
    };
  }),

  testNotification: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Verificação crítica: Firebase Admin configurado?
    if (!firebaseMessaging) {
      throw new Error(
        "Serviço de push não configurado no servidor. " +
        "Certifique-se de que as variáveis FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL e FIREBASE_PRIVATE_KEY estão definidas na VPS."
      );
    }
    
    const tokens = await db.select().from(fcmTokens).where(eq(fcmTokens.userId, ctx.user.id));
    if (tokens.length === 0) {
      throw new Error("Nenhum dispositivo registrado. Clique em 'Resetar / Definir Principal' para registrar este aparelho.");
    }
    
    let sentCount = 0;
    const deadTokens: string[] = [];
    const failedErrors: string[] = [];

    for (const device of tokens) {
      console.log(`[Push Test] Tentando enviar para device: ${device.deviceInfo} | token: ${device.token.substring(0, 30)}...`);
      const res = await sendPushNotification(
        device.token,
        "Teste de Notificação 🎉",
        `Olá! Notificação de teste do WR MusicPro enviada às ${new Date().toLocaleTimeString('pt-BR')}. Tudo funcionando!`
      );
      if (res.success) {
        sentCount++;
        console.log(`[Push Test] ✅ Sucesso para device: ${device.deviceInfo}`);
      } else {
        console.warn(`[Push Test] ❌ Falha para device: ${device.deviceInfo} — erro: ${res.error}`);
        failedErrors.push(res.error || "UNKNOWN");
        if (
          res.error === "messaging/registration-token-not-registered" ||
          res.error === "messaging/invalid-registration-token" ||
          res.error?.includes("registration-token-not-registered") ||
          res.error?.includes("invalid-registration-token")
        ) {
          deadTokens.push(device.token);
        }
      }
    }
    
    // Auto-clean tokens mortos/expirados do banco
    if (deadTokens.length > 0) {
      for (const deadToken of deadTokens) {
        await db.delete(fcmTokens).where(eq(fcmTokens.token, deadToken));
      }
      console.log(`[Push Clean] Removidos ${deadTokens.length} tokens mortos para userId ${ctx.user.id}`);
    }

    if (sentCount === 0 && tokens.length > 0) {
      const errorSummary = [...new Set(failedErrors)].join(", ");
      throw new Error(
        `Envio falhou para todos os ${tokens.length} dispositivo(s). ` +
        `Erro: ${errorSummary || "desconhecido"}. ` +
        `O token foi removido automaticamente. Clique em 'Resetar / Definir Principal' uma vez mais para gerar o novo token atualizado!`
      );
    }
    
    return { success: true, sentCount, totalTokens: tokens.length, cleanedCount: deadTokens.length };
  }),
});

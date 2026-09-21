// ═══════════════════════════════════════════════════════════════════════════════
// referralRouter — Programa Indique & Ganhe
//   • Público: dados da landing de indicação (/indicacao/:codigo)
//   • Escola:  código, link, resumo, indicações, recompensas e desconto
//   • SuperAdmin: configuração, listas, métricas, antifraude, auditoria
// Toda regra crítica vive no ReferralEngine (backend). O frontend só exibe.
// ═══════════════════════════════════════════════════════════════════════════════

import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import { isSuperAdmin } from "./superAdminRouter";
import { ENV } from "./_core/env";
import {
  applyCreditsToNextInvoice,
  cancelReward,
  getFraudSignals,
  getPublicReferralInfo,
  getReferralConfig,
  getReferralDashboard,
  getSchoolProgram,
  listReferralEvents,
  listReferralsForAdmin,
  listRewardsForAdmin,
  markReferralFraud,
  previewCreditsForNextInvoice,
  updateReferralConfig,
} from "./services/ReferralEngine";

function requireOrg(ctx: { user: { organizationId?: number | null } }): number {
  const orgId = ctx.user.organizationId;
  if (!orgId) throw new TRPCError({ code: "FORBIDDEN", message: "Usuário sem escola vinculada." });
  return orgId;
}

const configPatchSchema = z.object({
  active: z.boolean().optional(),
  trialDays: z.number().int().min(0).max(90).optional(),
  rewardMode: z.enum(["PROGRESSIVO", "FIXO", "PERCENTUAL"]).optional(),
  cycleSize: z.number().int().min(1).max(12).optional(),
  rewardPercent1: z.number().int().min(0).max(100).optional(),
  rewardPercent2: z.number().int().min(0).max(100).optional(),
  rewardPercent3: z.number().int().min(0).max(100).optional(),
  fixedValueCents: z.number().int().min(0).max(1000000).optional(),
  percentValue: z.number().int().min(0).max(100).optional(),
  maxDiscountPercent: z.number().int().min(0).max(100).optional(),
  allowAccumulation: z.boolean().optional(),
  rewardValidityDays: z.number().int().min(0).max(3650).optional(),
  minActiveDays: z.number().int().min(0).max(365).optional(),
  blockSelfReferral: z.boolean().optional(),
  pageHeadline: z.string().max(255).optional(),
  pageSubtitle: z.string().max(2000).nullable().optional(),
});

export const referralRouter = router({
  // ── Público: landing de indicação ──────────────────────────────────────────
  getPublicInfo: publicProcedure
    .input(z.object({ code: z.string().min(2).max(20) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      return getPublicReferralInfo(db, input.code);
    }),

  // ── Escola: painel de indicações ───────────────────────────────────────────
  getMyProgram: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
    const orgId = requireOrg(ctx);
    return getSchoolProgram(db, orgId, ENV.appUrl);
  }),

  getPendingDiscount: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
    const orgId = requireOrg(ctx);
    return previewCreditsForNextInvoice(db, orgId);
  }),

  applyCredits: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
    const orgId = requireOrg(ctx);
    const result = await applyCreditsToNextInvoice(db, orgId);
    return {
      success: result.appliedCents > 0,
      appliedCents: result.appliedCents,
      invoiceUrl: result.invoiceUrl,
      message: result.appliedCents > 0
        ? "Desconto aplicado na sua próxima mensalidade!"
        : "Nenhum desconto disponível para aplicar agora.",
    };
  }),

  // ── SuperAdmin: configuração ───────────────────────────────────────────────
  adminGetConfig: isSuperAdmin.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
    return getReferralConfig(db);
  }),

  adminUpdateConfig: isSuperAdmin
    .input(configPatchSchema)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      return updateReferralConfig(db, input, ctx.user.id);
    }),

  // ── SuperAdmin: listas e métricas ──────────────────────────────────────────
  adminDashboard: isSuperAdmin
    .input(z.object({ days: z.number().int().min(1).max(365).default(30) }).default({ days: 30 }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      return getReferralDashboard(db, input.days);
    }),

  adminListReferrals: isSuperAdmin.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
    return listReferralsForAdmin(db);
  }),

  adminListRewards: isSuperAdmin.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
    return listRewardsForAdmin(db);
  }),

  adminFraudSignals: isSuperAdmin.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
    return getFraudSignals(db);
  }),

  adminEvents: isSuperAdmin
    .input(z.object({ referralId: z.number().int().positive().optional(), limit: z.number().int().min(1).max(500).default(200) }).default({ limit: 200 }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      return listReferralEvents(db, input.referralId, input.limit);
    }),

  adminMarkFraud: isSuperAdmin
    .input(z.object({ referralId: z.number().int().positive(), reason: z.string().max(500).optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      await markReferralFraud(db, input.referralId, input.reason || "Marcada como fraude pelo SuperAdmin", ctx.user.id);
      return { success: true };
    }),

  adminCancelReward: isSuperAdmin
    .input(z.object({ rewardId: z.number().int().positive(), reason: z.string().max(500).optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      await cancelReward(db, input.rewardId, input.reason || "Cancelada pelo SuperAdmin", ctx.user.id);
      return { success: true };
    }),
});

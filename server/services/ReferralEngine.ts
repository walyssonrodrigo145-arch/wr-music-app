// ═══════════════════════════════════════════════════════════════════════════════
// ReferralEngine — Programa Indique & Ganhe (indicação de escolas)
//
// Regras vigentes (campanha): recompensa PROGRESSIVA por ciclo de 3 conversões:
//   1ª convertida = 30% OFF · 2ª = 60% OFF · 3ª = mensalidade grátis (100%),
//   reiniciando o ciclo a cada 3. A recompensa só é liberada após PAGAMENTO
//   CONFIRMADO da assinatura da escola indicada (nunca no cadastro/teste).
//
// Toda validação crítica é feita AQUI (backend). O frontend apenas exibe.
// Operações são idempotentes (webhooks podem repetir).
// ═══════════════════════════════════════════════════════════════════════════════

import { and, desc, eq, gte, inArray, isNull, or, sql } from "drizzle-orm";
import { getDb } from "../db";
import {
  organizations,
  referralCodes,
  referralConfig,
  referralEvents,
  referralRewards,
  referrals,
  settings,
  users,
} from "../../drizzle/schema";

type Db = any;

export const REFERRAL_CONFIG_ID = 1;

export type ReferralStatus =
  | "PENDENTE"
  | "TESTE"
  | "CONVERTIDA"
  | "RECOMPENSA_LIBERADA"
  | "RECOMPENSA_UTILIZADA"
  | "CANCELADA"
  | "EXPIRADA"
  | "FRAUDE";

const CONVERTED_STATUSES = ["CONVERTIDA", "RECOMPENSA_LIBERADA", "RECOMPENSA_UTILIZADA"];

export interface ReferralConfigView {
  id: number;
  active: boolean;
  trialDays: number;
  rewardMode: string;
  cycleSize: number;
  rewardPercent1: number;
  rewardPercent2: number;
  rewardPercent3: number;
  fixedValueCents: number;
  percentValue: number;
  maxDiscountPercent: number;
  allowAccumulation: boolean;
  rewardValidityDays: number;
  minActiveDays: number;
  blockSelfReferral: boolean;
  pageHeadline: string;
  pageSubtitle: string | null;
}

async function logEvent(
  db: Db,
  params: {
    organizationId?: number | null;
    referralId?: number | null;
    rewardId?: number | null;
    type: string;
    message?: string;
    meta?: unknown;
    actorUserId?: number | null;
  }
) {
  try {
    await db.insert(referralEvents).values({
      organizationId: params.organizationId ?? null,
      referralId: params.referralId ?? null,
      rewardId: params.rewardId ?? null,
      type: params.type,
      message: params.message ?? null,
      meta: params.meta ? JSON.stringify(params.meta) : null,
      actorUserId: params.actorUserId ?? null,
    });
  } catch (err: any) {
    console.warn("[ReferralEngine] Falha ao registrar evento de auditoria:", err?.message || err);
  }
}

/** Config global (linha única) — cria com defaults na primeira leitura. */
export async function getReferralConfig(db?: Db): Promise<ReferralConfigView> {
  const database = db ?? (await getDb());
  if (!database) throw new Error("Database not available");

  const [existing] = await database
    .select()
    .from(referralConfig)
    .where(eq(referralConfig.id, REFERRAL_CONFIG_ID))
    .limit(1);

  if (existing) return existing as ReferralConfigView;

  const [created] = await database
    .insert(referralConfig)
    .values({ id: REFERRAL_CONFIG_ID })
    .onConflictDoNothing({ target: referralConfig.id })
    .returning();

  if (created) return created as ReferralConfigView;

  const [row] = await database
    .select()
    .from(referralConfig)
    .where(eq(referralConfig.id, REFERRAL_CONFIG_ID))
    .limit(1);
  return row as ReferralConfigView;
}

/** Percentual da recompensa para a posição no ciclo (1..N). */
export function rewardPercentForPosition(config: ReferralConfigView, position: number): number {
  if (position <= 1) return config.rewardPercent1;
  if (position === 2) return config.rewardPercent2;
  return config.rewardPercent3;
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // sem I/O para evitar confusão

function codePrefix(name: string | null | undefined): string {
  const words = String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z ]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).padEnd(2, "M");
  if (words.length === 1) return words[0].slice(0, 2).padEnd(2, "M");
  return "MP";
}

/** Gera um código único e não sequencial (não expõe o ID interno). */
export async function generateUniqueCode(db: Db, organizationId: number): Promise<string> {
  const [org] = await db
    .select({ name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  const prefix = codePrefix(org?.name);

  for (let attempt = 0; attempt < 12; attempt++) {
    const suffix = String(Math.floor(10000 + Math.random() * 90000)); // 5 dígitos
    const candidate = `${prefix}${suffix}`;
    const [taken] = await db
      .select({ id: referralCodes.id })
      .from(referralCodes)
      .where(eq(referralCodes.code, candidate))
      .limit(1);
    if (!taken) return candidate;
  }
  // Fallback raro: usa timestamp em base36 (ainda único e opaco)
  return `MP${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

/** Código da escola (gera na primeira vez; nunca é alterável pela escola). */
export async function getOrCreateReferralCode(db: Db, organizationId: number): Promise<string> {
  const [existing] = await db
    .select()
    .from(referralCodes)
    .where(eq(referralCodes.organizationId, organizationId))
    .limit(1);
  if (existing) return existing.code as string;

  const code = await generateUniqueCode(db, organizationId);
  const [created] = await db
    .insert(referralCodes)
    .values({ organizationId, code })
    .onConflictDoNothing({ target: referralCodes.organizationId })
    .returning();

  if (created) {
    await logEvent(db, { organizationId, type: "CODIGO_GERADO", message: `Código ${code} gerado`, meta: { code } });
    return created.code as string;
  }
  const [row] = await db
    .select()
    .from(referralCodes)
    .where(eq(referralCodes.organizationId, organizationId))
    .limit(1);
  return row?.code as string;
}

export interface PublicReferralInfo {
  active: boolean;
  valid: boolean;
  code: string;
  schoolName: string | null;
  trialDays: number;
  headline: string;
  subtitle: string | null;
  rewardSummary: string;
}

/** Dados públicos da landing de indicação (nunca expõe IDs internos). */
export async function getPublicReferralInfo(db: Db, rawCode: string): Promise<PublicReferralInfo> {
  const config = await getReferralConfig(db);
  const code = String(rawCode || "").trim().toUpperCase().slice(0, 20);
  const fallback: PublicReferralInfo = {
    active: config.active,
    valid: false,
    code,
    schoolName: null,
    trialDays: config.trialDays,
    headline: config.pageHeadline,
    subtitle: config.pageSubtitle,
    rewardSummary: "",
  };
  if (!code) return fallback;

  const [row] = await db
    .select({
      code: referralCodes.code,
      active: referralCodes.active,
      orgName: organizations.name,
    })
    .from(referralCodes)
    .leftJoin(organizations, eq(organizations.id, referralCodes.organizationId))
    .where(eq(referralCodes.code, code))
    .limit(1);

  if (!row || row.active === false) return fallback;

  return {
    ...fallback,
    valid: true,
    schoolName: row.orgName ?? null,
    rewardSummary: `${config.rewardPercent1}% OFF na 1ª indicação · ${config.rewardPercent2}% OFF na 2ª · mensalidade grátis na 3ª`,
  };
}

export interface AttachReferralInput {
  code: string;
  referredOrgId: number;
  referredAdminEmail?: string | null;
  cpfCnpj?: string | null;
  phone?: string | null;
  planValueCents?: number;
  ipAddress?: string | null;
  userAgent?: string | null;
  trialEndsAt?: Date | null;
}

export interface AttachReferralResult {
  attached: boolean;
  referralId?: number;
  referrerOrgId?: number;
  reason?: string;
}

function onlyDigits(value?: string | null): string {
  return String(value || "").replace(/\D/g, "");
}

/**
 * Vincula a indicação no cadastro da nova escola. Nunca confia no frontend:
 * revalida o código e aplica o antifraude básico (CNPJ/e-mail/telefone já
 * existentes e autoindicação).
 */
export async function attachReferralOnSignup(db: Db, input: AttachReferralInput): Promise<AttachReferralResult> {
  const config = await getReferralConfig(db);
  if (!config.active) return { attached: false, reason: "PROGRAMA_INATIVO" };

  const code = String(input.code || "").trim().toUpperCase().slice(0, 20);
  if (!code) return { attached: false, reason: "SEM_CODIGO" };

  const [codeRow] = await db
    .select({ organizationId: referralCodes.organizationId, active: referralCodes.active })
    .from(referralCodes)
    .where(eq(referralCodes.code, code))
    .limit(1);
  if (!codeRow || codeRow.active === false) return { attached: false, reason: "CODIGO_INVALIDO" };

  const referrerOrgId = Number(codeRow.organizationId);
  if (referrerOrgId === input.referredOrgId) {
    await logEvent(db, {
      organizationId: referrerOrgId,
      type: "INDICACAO_MARCADA_FRAUDE",
      message: "Autoindicação bloqueada",
      meta: { code, referredOrgId: input.referredOrgId },
    });
    return { attached: false, reason: "AUTOINDICACAO" };
  }

  // ── Antifraude: a escola indicada já existe com mesmo CNPJ/e-mail/telefone? ──
  const cnpjDigits = onlyDigits(input.cpfCnpj);
  if (cnpjDigits.length >= 11) {
    const [sameCnpj] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(and(eq(organizations.cnpj, input.cpfCnpj!), sql`${organizations.id} <> ${input.referredOrgId}`))
      .limit(1);
    if (sameCnpj) {
      await logEvent(db, {
        organizationId: referrerOrgId,
        type: "INDICACAO_BLOQUEADA",
        message: "CNPJ já cadastrado em outra escola",
        meta: { code },
      });
      return { attached: false, reason: "CNPJ_DUPLICADO" };
    }
  }

  const email = String(input.referredAdminEmail || "").trim().toLowerCase();
  if (email) {
    const [sameEmail] = await db
      .select({ id: users.id, organizationId: users.organizationId })
      .from(users)
      .where(and(sql`LOWER(${users.email}) = ${email}`, sql`${users.organizationId} <> ${input.referredOrgId}`))
      .limit(1);
    if (sameEmail) {
      const isReferrerUser = Number(sameEmail.organizationId) === referrerOrgId;
      await logEvent(db, {
        organizationId: referrerOrgId,
        type: isReferrerUser ? "INDICACAO_MARCADA_FRAUDE" : "INDICACAO_BLOQUEADA",
        message: isReferrerUser
          ? "Autoindicação: e-mail já pertence à escola indicadora"
          : "E-mail já vinculado a outra escola",
        meta: { code, email },
      });
      return { attached: false, reason: isReferrerUser ? "AUTOINDICACAO" : "EMAIL_DUPLICADO" };
    }
  }

  const phoneDigits = onlyDigits(input.phone);
  if (phoneDigits.length >= 10) {
    const [samePhone] = await db
      .select({ organizationId: settings.organizationId })
      .from(settings)
      .where(
        and(
          or(
            sql`regexp_replace(COALESCE(${settings.phone}, ''), '[^0-9]', '', 'g') = ${phoneDigits}`,
            sql`regexp_replace(COALESCE(${settings.schoolPhone}, ''), '[^0-9]', '', 'g') = ${phoneDigits}`
          ),
          sql`${settings.organizationId} <> ${input.referredOrgId}`
        )
      )
      .limit(1);
    if (samePhone) {
      await logEvent(db, {
        organizationId: referrerOrgId,
        type: "INDICACAO_BLOQUEADA",
        message: "Telefone já utilizado por outra escola",
        meta: { code },
      });
      return { attached: false, reason: "TELEFONE_DUPLICADO" };
    }
  }

  // ── Cria o vínculo (uma escola = um indicador: referredOrgId é UNIQUE) ───────
  const now = new Date();
  const [created] = await db
    .insert(referrals)
    .values({
      code,
      referrerOrgId,
      referredOrgId: input.referredOrgId,
      status: "TESTE",
      planValueCents: Math.max(0, Math.round(input.planValueCents || 0)),
      indicatedAt: now,
      signupAt: now,
      trialStartAt: now,
      trialEndAt: input.trialEndsAt ?? null,
      ipAddress: input.ipAddress ? String(input.ipAddress).slice(0, 64) : null,
      userAgent: input.userAgent ? String(input.userAgent).slice(0, 500) : null,
    })
    .onConflictDoNothing({ target: referrals.referredOrgId })
    .returning();

  if (!created) return { attached: false, reason: "ESCOLA_JA_INDICADA" };

  await logEvent(db, {
    organizationId: referrerOrgId,
    referralId: created.id,
    type: "INDICACAO_CRIADA",
    message: `Nova escola indicada com o código ${code}`,
    meta: { code, referredOrgId: input.referredOrgId },
  });
  await logEvent(db, {
    organizationId: referrerOrgId,
    referralId: created.id,
    type: "INDICACAO_CADASTRO_REALIZADO",
    message: "Cadastro concluído — período de teste iniciado",
  });

  return { attached: true, referralId: created.id, referrerOrgId };
}

/**
 * Converte a indicação quando o PAGAMENTO da assinatura é confirmado.
 * Idempotente: nunca gera duas recompensas para a mesma indicação.
 */
export async function onSubscriptionPaid(db: Db, referredOrgId: number): Promise<{ converted: boolean; rewardId?: number }> {
  const config = await getReferralConfig(db);

  const [referral] = await db
    .select()
    .from(referrals)
    .where(and(eq(referrals.referredOrgId, referredOrgId), inArray(referrals.status, ["PENDENTE", "TESTE"])))
    .limit(1);

  if (!referral) return { converted: false };

  // Já existe recompensa? (proteção extra contra duplicidade)
  const [existingReward] = await db
    .select({ id: referralRewards.id })
    .from(referralRewards)
    .where(eq(referralRewards.referralId, referral.id))
    .limit(1);
  if (existingReward) return { converted: false, rewardId: existingReward.id };

  const [{ convertedCount }] = await db
    .select({ convertedCount: sql<number>`COUNT(*)::int` })
    .from(referrals)
    .where(and(eq(referrals.referrerOrgId, referral.referrerOrgId), inArray(referrals.status, CONVERTED_STATUSES)));

  const cycleSize = Math.max(1, Number(config.cycleSize) || 3);
  const cyclePosition = (Number(convertedCount) % cycleSize) + 1;
  const percent = Math.max(0, Math.min(100, rewardPercentForPosition(config, cyclePosition)));

  const now = new Date();
  await db
    .update(referrals)
    .set({
      status: "RECOMPENSA_LIBERADA",
      cyclePosition,
      rewardPercent: percent,
      convertedAt: now,
      updatedAt: now,
    })
    .where(eq(referrals.id, referral.id));

  // Sem acúmulo: a nova recompensa substitui as disponíveis anteriores.
  if (!config.allowAccumulation) {
    await db
      .update(referralRewards)
      .set({ status: "CANCELADA", canceledAt: now, cancelReason: "Acúmulo desativado", updatedAt: now })
      .where(and(eq(referralRewards.organizationId, referral.referrerOrgId), inArray(referralRewards.status, ["DISPONIVEL", "PARCIALMENTE_UTILIZADA"])));
  }

  const expiresAt = config.rewardValidityDays > 0
    ? new Date(now.getTime() + config.rewardValidityDays * 24 * 60 * 60 * 1000)
    : null;

  const [reward] = await db
    .insert(referralRewards)
    .values({
      referralId: referral.id,
      organizationId: referral.referrerOrgId,
      type: "PERCENTUAL",
      percent,
      status: "DISPONIVEL",
      releasedAt: now,
      expiresAt,
    })
    .returning();

  await logEvent(db, {
    organizationId: referral.referrerOrgId,
    referralId: referral.id,
    rewardId: reward?.id,
    type: "INDICACAO_CONVERTIDA",
    message: `Indicação convertida (${cyclePosition}ª do ciclo) — recompensa de ${percent}%`,
    meta: { cyclePosition, percent, referredOrgId },
  });
  await logEvent(db, {
    organizationId: referral.referrerOrgId,
    referralId: referral.id,
    rewardId: reward?.id,
    type: "RECOMPENSA_LIBERADA",
    message: `Crédito de ${percent}% disponível para a próxima mensalidade`,
    meta: { percent, expiresAt: expiresAt?.toISOString() ?? null },
  });

  return { converted: true, rewardId: reward?.id };
}

/** Cancela a indicação e a recompensa NÃO utilizada (pagamento estornado/cancelado). */
export async function onSubscriptionCanceled(db: Db, referredOrgId: number, reason: string): Promise<void> {
  const now = new Date();
  const [referral] = await db
    .select()
    .from(referrals)
    .where(and(eq(referrals.referredOrgId, referredOrgId), inArray(referrals.status, CONVERTED_STATUSES)))
    .limit(1);
  if (!referral) return;

  const rewards = await db
    .select()
    .from(referralRewards)
    .where(eq(referralRewards.referralId, referral.id));

  for (const reward of rewards) {
    if (reward.status === "UTILIZADA") {
      // Histórico imutável: registra ajuste, não altera o registro utilizado.
      await logEvent(db, {
        organizationId: referral.referrerOrgId,
        referralId: referral.id,
        rewardId: reward.id,
        type: "RECOMPENSA_AJUSTE_POS_CANCELAMENTO",
        message: `Assinatura da escola indicada foi cancelada após o crédito já ter sido utilizado (${reason})`,
      });
      continue;
    }
    await db
      .update(referralRewards)
      .set({ status: "CANCELADA", canceledAt: now, cancelReason: reason, updatedAt: now })
      .where(eq(referralRewards.id, reward.id));
    await logEvent(db, {
      organizationId: referral.referrerOrgId,
      referralId: referral.id,
      rewardId: reward.id,
      type: "RECOMPENSA_CANCELADA",
      message: `Recompensa cancelada: ${reason}`,
    });
  }

  await db
    .update(referrals)
    .set({ status: "CANCELADA", canceledAt: now, updatedAt: now })
    .where(eq(referrals.id, referral.id));
}

/** Expira recompensas vencidas (idempotente). */
export async function expireRewards(db: Db): Promise<number> {
  const now = new Date();
  const expired = await db
    .update(referralRewards)
    .set({ status: "EXPIRADA", updatedAt: now })
    .where(
      and(
        inArray(referralRewards.status, ["DISPONIVEL", "PARCIALMENTE_UTILIZADA"]),
        sql`${referralRewards.expiresAt} IS NOT NULL AND ${referralRewards.expiresAt} < ${now.toISOString()}`
      )
    )
    .returning({ id: referralRewards.id, organizationId: referralRewards.organizationId });

  for (const row of expired) {
    await logEvent(db, {
      organizationId: row.organizationId,
      rewardId: row.id,
      type: "RECOMPENSA_EXPIRADA",
      message: "Recompensa expirada por validade",
    });
  }
  return expired.length;
}

export interface SchoolReferralProgram {
  active: boolean;
  code: string;
  link: string;
  config: ReferralConfigView;
  summary: {
    total: number;
    inTrial: number;
    converted: number;
    canceled: number;
    cycleConverted: number;
    cycleSize: number;
    nextRewardPercent: number;
    remainingToNext: number;
    availableRewards: number;
    whatsappMessage: string;
  };
  referrals: Array<{
    id: number;
    schoolName: string | null;
    status: ReferralStatus;
    createdAt: string;
    convertedAt: string | null;
    rewardPercent: number;
  }>;
  rewards: Array<{
    id: number;
    percent: number;
    status: string;
    releasedAt: string;
    expiresAt: string | null;
    referralSchoolName: string | null;
  }>;
}

export function buildWhatsAppMessage(schoolName: string | null, link: string, trialDays: number): string {
  return (
    `Olá! Eu uso o MusicPro para gerenciar minha escola de música.\n\n` +
    `Você também pode conhecer a plataforma e começar com ${trialDays} dias grátis:\n${link}`
  );
}

/** Painel da escola: código, link, resumo, lista e recompensas. */
export async function getSchoolProgram(db: Db, organizationId: number, appUrl: string): Promise<SchoolReferralProgram> {
  const config = await getReferralConfig(db);
  await expireRewards(db);
  const code = await getOrCreateReferralCode(db, organizationId);
  const link = `${appUrl.replace(/\/$/, "")}/indicacao/${code}`;

  const rows = await db
    .select({
      id: referrals.id,
      status: referrals.status,
      createdAt: referrals.createdAt,
      convertedAt: referrals.convertedAt,
      rewardPercent: referrals.rewardPercent,
      schoolName: organizations.name,
    })
    .from(referrals)
    .leftJoin(organizations, eq(organizations.id, referrals.referredOrgId))
    .where(eq(referrals.referrerOrgId, organizationId))
    .orderBy(desc(referrals.createdAt));

  const rewardRows = await db
    .select({
      id: referralRewards.id,
      percent: referralRewards.percent,
      status: referralRewards.status,
      releasedAt: referralRewards.releasedAt,
      expiresAt: referralRewards.expiresAt,
      referralId: referralRewards.referralId,
    })
    .from(referralRewards)
    .where(eq(referralRewards.organizationId, organizationId))
    .orderBy(desc(referralRewards.releasedAt));

  const converted = rows.filter((r: any) => CONVERTED_STATUSES.includes(r.status)).length;
  const inTrial = rows.filter((r: any) => ["PENDENTE", "TESTE"].includes(r.status)).length;
  const canceled = rows.filter((r: any) => ["CANCELADA", "EXPIRADA", "FRAUDE"].includes(r.status)).length;
  const cycleSize = Math.max(1, Number(config.cycleSize) || 3);
  const cycleConverted = converted % cycleSize;
  const nextPosition = cycleConverted + 1;
  const nextRewardPercent = rewardPercentForPosition(config, nextPosition);
  const remainingToNext = cycleSize - cycleConverted;
  const availableRewards = rewardRows.filter((r: any) => ["DISPONIVEL", "PARCIALMENTE_UTILIZADA"].includes(r.status)).length;

  const schoolNameById = new Map<number, string | null>(
    rows.map((r: any) => [r.id, r.schoolName])
  );

  return {
    active: config.active,
    code,
    link,
    config,
    summary: {
      total: rows.length,
      inTrial,
      converted,
      canceled,
      cycleConverted,
      cycleSize,
      nextRewardPercent,
      remainingToNext,
      availableRewards,
      whatsappMessage: buildWhatsAppMessage(null, link, config.trialDays),
    },
    referrals: rows.map((r: any) => ({
      id: r.id,
      schoolName: r.schoolName ?? null,
      status: r.status as ReferralStatus,
      createdAt: new Date(r.createdAt).toISOString(),
      convertedAt: r.convertedAt ? new Date(r.convertedAt).toISOString() : null,
      rewardPercent: Number(r.rewardPercent) || 0,
    })),
    rewards: rewardRows.map((r: any) => ({
      id: r.id,
      percent: Number(r.percent) || 0,
      status: r.status,
      releasedAt: new Date(r.releasedAt).toISOString(),
      expiresAt: r.expiresAt ? new Date(r.expiresAt).toISOString() : null,
      referralSchoolName: schoolNameById.get(r.referralId) ?? null,
    })),
  };
}

interface PendingInvoice {
  id: string;
  value: number;
  invoiceUrl: string | null;
}

/** Próxima fatura pendente da assinatura (ou avulsa) da escola. */
export async function findPendingInvoice(db: Db, orgId: number): Promise<PendingInvoice | null> {
  const [org] = await db
    .select({
      asaasSubscriptionId: organizations.asaasSubscriptionId,
      asaasCustomerId: organizations.asaasCustomerId,
    })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);
  if (!org) return null;

  const { getAsaasSubscriptionPayments } = await import("../utils/asaas");

  if (org.asaasSubscriptionId) {
    try {
      const payments = await getAsaasSubscriptionPayments(org.asaasSubscriptionId);
      const pending = payments.find((p: any) => p.status === "PENDING" || p.status === "OVERDUE");
      if (pending) {
        return { id: pending.id, value: Number(pending.value) || 0, invoiceUrl: pending.invoiceUrl ?? null };
      }
    } catch (err: any) {
      console.warn("[ReferralEngine] Falha ao buscar faturas da assinatura:", err?.message || err);
    }
  }

  if (org.asaasCustomerId) {
    try {
      const { ENV } = await import("../_core/env");
      const res = await fetch(
        `${ENV.asaasBaseUrl}/payments?customer=${org.asaasCustomerId}&status=PENDING&limit=5`,
        { headers: { access_token: ENV.asaasApiKey } }
      );
      if (res.ok) {
        const data = await res.json();
        const avulsa = (data?.data || []).find((p: any) => p.status === "PENDING" || p.status === "OVERDUE");
        if (avulsa) return { id: avulsa.id, value: Number(avulsa.value) || 0, invoiceUrl: avulsa.invoiceUrl ?? null };
      }
    } catch (err: any) {
      console.warn("[ReferralEngine] Falha ao buscar faturas avulsas:", err?.message || err);
    }
  }

  return null;
}

/**
 * Aplica os créditos de indicação na PRÓXIMA fatura pendente da escola.
 * Consome as recompensas somente após o Asaas confirmar a alteração do valor.
 */
export async function applyCreditsToNextInvoice(
  db: Db,
  orgId: number
): Promise<{ appliedCents: number; invoiceValueCents: number | null; invoiceUrl: string | null }> {
  const config = await getReferralConfig(db);
  await expireRewards(db);

  const invoice = await findPendingInvoice(db, orgId);
  if (!invoice || invoice.value <= 0) return { appliedCents: 0, invoiceValueCents: null, invoiceUrl: invoice?.invoiceUrl ?? null };

  const now = new Date();
  const rewards = await db
    .select()
    .from(referralRewards)
    .where(
      and(
        eq(referralRewards.organizationId, orgId),
        inArray(referralRewards.status, ["DISPONIVEL", "PARCIALMENTE_UTILIZADA"])
      )
    )
    .orderBy(referralRewards.releasedAt);

  const valid = (rewards as any[]).filter((r) => {
    if (r.expiresAt && new Date(r.expiresAt) < now) return false;
    if (config.minActiveDays > 0) {
      const minDate = new Date(new Date(r.releasedAt).getTime() + config.minActiveDays * 24 * 60 * 60 * 1000);
      if (minDate > now) return false;
    }
    return true;
  });
  if (valid.length === 0) return { appliedCents: 0, invoiceValueCents: Math.round(invoice.value * 100), invoiceUrl: invoice.invoiceUrl };

  // Sem acúmulo: aplica apenas a recompensa mais antiga disponível.
  const applicable = config.allowAccumulation ? valid : valid.slice(0, 1);

  const maxDiscountPercent = Math.max(0, Math.min(100, Number(config.maxDiscountPercent) || 100));
  const invoiceCents = Math.round(invoice.value * 100);
  let remainingCents = invoiceCents;
  let totalDiscount = 0;
  const consumptions: Array<{ rewardId: number; discountCents: number }> = [];

  for (const reward of applicable) {
    const percent = Math.min(Number(reward.percent) || 0, maxDiscountPercent);
    let discount = Math.floor((invoiceCents * percent) / 100);
    discount = Math.min(discount, remainingCents);
    if (discount <= 0) continue;
    totalDiscount += discount;
    remainingCents -= discount;
    consumptions.push({ rewardId: reward.id, discountCents: discount });
    if (remainingCents <= 0) break;
  }

  if (totalDiscount <= 0) return { appliedCents: 0, invoiceValueCents: invoiceCents, invoiceUrl: invoice.invoiceUrl };

  const newValue = Math.max(0, (invoiceCents - totalDiscount) / 100);

  try {
    const { updateAsaasPaymentValue } = await import("../utils/asaas");
    await updateAsaasPaymentValue(invoice.id, newValue);
  } catch (err: any) {
    console.warn("[ReferralEngine] Não foi possível aplicar o desconto na fatura:", err?.message || err);
    return { appliedCents: 0, invoiceValueCents: invoiceCents, invoiceUrl: invoice.invoiceUrl };
  }

  for (const c of consumptions) {
    await db
      .update(referralRewards)
      .set({
        status: "UTILIZADA",
        appliedValueCents: c.discountCents,
        usedAt: now,
        updatedAt: now,
      })
      .where(eq(referralRewards.id, c.rewardId));
    await logEvent(db, {
      organizationId: orgId,
      rewardId: c.rewardId,
      type: "RECOMPENSA_UTILIZADA",
      message: `Desconto de ${(c.discountCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} aplicado na fatura`,
      meta: { invoiceId: invoice.id, discountCents: c.discountCents },
    });
  }

  // Marca as indicações correspondentes como utilizadas (histórico).
  const rewardRows = await db
    .select({ id: referralRewards.id, referralId: referralRewards.referralId })
    .from(referralRewards)
    .where(inArray(referralRewards.id, consumptions.map((c) => c.rewardId)));
  const referralIds = rewardRows.map((r: any) => r.referralId).filter(Boolean);
  if (referralIds.length > 0) {
    await db
      .update(referrals)
      .set({ status: "RECOMPENSA_UTILIZADA", updatedAt: now })
      .where(inArray(referrals.id, referralIds));
  }

  return { appliedCents: totalDiscount, invoiceValueCents: Math.round(newValue * 100), invoiceUrl: invoice.invoiceUrl };
}

/** Prévia (sem aplicar) do desconto na próxima fatura — usada pelo painel da escola. */
export async function previewCreditsForNextInvoice(db: Db, orgId: number) {
  const config = await getReferralConfig(db);
  await expireRewards(db);
  const invoice = await findPendingInvoice(db, orgId);

  const rewards = await db
    .select()
    .from(referralRewards)
    .where(
      and(
        eq(referralRewards.organizationId, orgId),
        inArray(referralRewards.status, ["DISPONIVEL", "PARCIALMENTE_UTILIZADA"])
      )
    )
    .orderBy(referralRewards.releasedAt);

  const now = new Date();
  const valid = (rewards as any[]).filter((r) => {
    if (r.expiresAt && new Date(r.expiresAt) < now) return false;
    if (config.minActiveDays > 0) {
      const minDate = new Date(new Date(r.releasedAt).getTime() + config.minActiveDays * 24 * 60 * 60 * 1000);
      if (minDate > now) return false;
    }
    return true;
  });

  const invoiceCents = invoice ? Math.round(invoice.value * 100) : 0;
  const maxDiscountPercent = Math.max(0, Math.min(100, Number(config.maxDiscountPercent) || 100));
  const applicable = config.allowAccumulation ? valid : valid.slice(0, 1);
  let remaining = invoiceCents;
  let discountCents = 0;
  for (const reward of applicable) {
    const percent = Math.min(Number(reward.percent) || 0, maxDiscountPercent);
    let discount = Math.floor((invoiceCents * percent) / 100);
    discount = Math.min(discount, remaining);
    if (discount <= 0) continue;
    discountCents += discount;
    remaining -= discount;
    if (remaining <= 0) break;
  }

  return {
    hasInvoice: Boolean(invoice),
    invoiceValueCents: invoiceCents,
    invoiceUrl: invoice?.invoiceUrl ?? null,
    discountCents,
    finalValueCents: Math.max(0, invoiceCents - discountCents),
    rewards: valid.map((r: any) => ({
      id: r.id,
      percent: Number(r.percent) || 0,
      status: r.status,
      expiresAt: r.expiresAt ? new Date(r.expiresAt).toISOString() : null,
      releasedAt: new Date(r.releasedAt).toISOString(),
    })),
    config: {
      allowAccumulation: config.allowAccumulation,
      maxDiscountPercent: config.maxDiscountPercent,
      minActiveDays: config.minActiveDays,
      trialDays: config.trialDays,
    },
  };
}

/** SuperAdmin: configuração. */
export async function updateReferralConfig(
  db: Db,
  patch: Partial<ReferralConfigView>,
  actorUserId: number | null
): Promise<ReferralConfigView> {
  await getReferralConfig(db);
  const allowed: (keyof ReferralConfigView)[] = [
    "active", "trialDays", "rewardMode", "cycleSize",
    "rewardPercent1", "rewardPercent2", "rewardPercent3",
    "fixedValueCents", "percentValue", "maxDiscountPercent", "allowAccumulation",
    "rewardValidityDays", "minActiveDays", "blockSelfReferral", "pageHeadline", "pageSubtitle",
  ];
  const values: Record<string, unknown> = {};
  for (const key of allowed) {
    if (patch[key] !== undefined) values[key] = patch[key];
  }
  if (values.trialDays !== undefined) values.trialDays = Math.max(0, Math.min(90, Number(values.trialDays) || 0));
  if (values.cycleSize !== undefined) values.cycleSize = Math.max(1, Math.min(12, Number(values.cycleSize) || 3));
  for (const key of ["rewardPercent1", "rewardPercent2", "rewardPercent3", "maxDiscountPercent"] as const) {
    if (values[key] !== undefined) values[key] = Math.max(0, Math.min(100, Number(values[key]) || 0));
  }
  if (values.rewardValidityDays !== undefined) values.rewardValidityDays = Math.max(0, Math.min(3650, Number(values.rewardValidityDays) || 0));
  if (values.minActiveDays !== undefined) values.minActiveDays = Math.max(0, Math.min(365, Number(values.minActiveDays) || 0));
  values.updatedByUserId = actorUserId;
  values.updatedAt = new Date();

  const [updated] = await db
    .update(referralConfig)
    .set(values)
    .where(eq(referralConfig.id, REFERRAL_CONFIG_ID))
    .returning();

  await logEvent(db, {
    type: "CONFIG_ALTERADA",
    message: "Configuração do programa de indicação alterada",
    meta: { patch: values },
    actorUserId,
  });

  return updated as ReferralConfigView;
}

/** SuperAdmin: métricas + ranking. */
export async function getReferralDashboard(db: Db, days = 30) {
  await expireRewards(db);
  const since = new Date(Date.now() - Math.max(1, days) * 24 * 60 * 60 * 1000);

  const rows = await db.select().from(referrals);
  const rewards = await db.select().from(referralRewards);

  const converted = rows.filter((r: any) => CONVERTED_STATUSES.includes(r.status));
  const canceled = rows.filter((r: any) => ["CANCELADA", "EXPIRADA", "FRAUDE"].includes(r.status));
  const periodRows = rows.filter((r: any) => new Date(r.createdAt) >= since);

  const generated = rewards.length;
  const used = rewards.filter((r: any) => r.status === "UTILIZADA");
  const usedValueCents = used.reduce((acc: number, r: any) => acc + (Number(r.appliedValueCents) || 0), 0);

  const byReferrer = new Map<number, number>();
  for (const r of converted) {
    byReferrer.set(r.referrerOrgId, (byReferrer.get(r.referrerOrgId) || 0) + 1);
  }
  const rankingIds = Array.from(byReferrer.keys());
  const orgNames = new Map<number, string>();
  if (rankingIds.length > 0) {
    const orgs = await db
      .select({ id: organizations.id, name: organizations.name })
      .from(organizations)
      .where(inArray(organizations.id, rankingIds));
    for (const o of orgs) orgNames.set(o.id, o.name);
  }

  return {
    totals: {
      total: rows.length,
      inTrial: rows.filter((r: any) => ["PENDENTE", "TESTE"].includes(r.status)).length,
      converted: converted.length,
      canceled: canceled.length,
      periodTotal: periodRows.length,
      conversionRate: rows.length > 0 ? Math.round((converted.length / rows.length) * 1000) / 10 : 0,
    },
    rewards: {
      generated,
      available: rewards.filter((r: any) => ["DISPONIVEL", "PARCIALMENTE_UTILIZADA"].includes(r.status)).length,
      used: used.length,
      usedValueCents,
    },
    ranking: Array.from(byReferrer.entries())
      .map(([orgId, count]) => ({ orgId, name: orgNames.get(orgId) ?? `Escola #${orgId}`, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    recent: rows.slice(0, 10),
  };
}

/** SuperAdmin: lista completa com nomes das escolas. */
export async function listReferralsForAdmin(db: Db) {
  await expireRewards(db);
  const rows = await db
    .select({
      id: referrals.id,
      code: referrals.code,
      status: referrals.status,
      referrerOrgId: referrals.referrerOrgId,
      referredOrgId: referrals.referredOrgId,
      cyclePosition: referrals.cyclePosition,
      rewardPercent: referrals.rewardPercent,
      createdAt: referrals.createdAt,
      convertedAt: referrals.convertedAt,
      canceledAt: referrals.canceledAt,
      fraudReason: referrals.fraudReason,
      ipAddress: referrals.ipAddress,
    })
    .from(referrals)
    .orderBy(desc(referrals.createdAt))
    .limit(500);

  const orgIds = new Set<number>();
  rows.forEach((r: any) => { orgIds.add(r.referrerOrgId); orgIds.add(r.referredOrgId); });
  const orgNames = new Map<number, string>();
  if (orgIds.size > 0) {
    const orgs = await db
      .select({ id: organizations.id, name: organizations.name })
      .from(organizations)
      .where(inArray(organizations.id, Array.from(orgIds)));
    for (const o of orgs) orgNames.set(o.id, o.name);
  }

  return rows.map((r: any) => ({
    ...r,
    referrerName: orgNames.get(r.referrerOrgId) ?? `Escola #${r.referrerOrgId}`,
    referredName: orgNames.get(r.referredOrgId) ?? `Escola #${r.referredOrgId}`,
  }));
}

/** SuperAdmin: lista de recompensas. */
export async function listRewardsForAdmin(db: Db) {
  await expireRewards(db);
  const rows = await db
    .select({
      id: referralRewards.id,
      referralId: referralRewards.referralId,
      organizationId: referralRewards.organizationId,
      percent: referralRewards.percent,
      appliedValueCents: referralRewards.appliedValueCents,
      status: referralRewards.status,
      releasedAt: referralRewards.releasedAt,
      expiresAt: referralRewards.expiresAt,
      usedAt: referralRewards.usedAt,
      cancelReason: referralRewards.cancelReason,
    })
    .from(referralRewards)
    .orderBy(desc(referralRewards.releasedAt))
    .limit(500);

  const orgIds: number[] = Array.from(new Set<number>((rows as any[]).map((r) => Number(r.organizationId))));
  const orgNames = new Map<number, string>();
  if (orgIds.length > 0) {
    const orgs = await db
      .select({ id: organizations.id, name: organizations.name })
      .from(organizations)
      .where(inArray(organizations.id, orgIds));
    for (const o of orgs) orgNames.set(o.id, o.name);
  }
  return rows.map((r: any) => ({ ...r, organizationName: orgNames.get(r.organizationId) ?? `Escola #${r.organizationId}` }));
}

/** SuperAdmin: marca fraude (cancela recompensas e mantém histórico). */
export async function markReferralFraud(db: Db, referralId: number, reason: string, actorUserId: number | null) {
  const now = new Date();
  const [referral] = await db.select().from(referrals).where(eq(referrals.id, referralId)).limit(1);
  if (!referral) throw new Error("Indicação não encontrada");

  await db
    .update(referrals)
    .set({ status: "FRAUDE", fraudReason: reason || "Marcada como fraude pelo SuperAdmin", updatedAt: now })
    .where(eq(referrals.id, referralId));

  await db
    .update(referralRewards)
    .set({ status: "CANCELADA", canceledAt: now, cancelReason: "Fraude", updatedAt: now })
    .where(and(eq(referralRewards.referralId, referralId), inArray(referralRewards.status, ["DISPONIVEL", "PARCIALMENTE_UTILIZADA"])));

  await logEvent(db, {
    organizationId: referral.referrerOrgId,
    referralId,
    type: "INDICACAO_MARCADA_FRAUDE",
    message: reason || "Marcada como fraude",
    actorUserId,
  });
}

/** SuperAdmin: cancela uma recompensa específica. */
export async function cancelReward(db: Db, rewardId: number, reason: string, actorUserId: number | null) {
  const now = new Date();
  const [reward] = await db.select().from(referralRewards).where(eq(referralRewards.id, rewardId)).limit(1);
  if (!reward) throw new Error("Recompensa não encontrada");
  if (reward.status === "UTILIZADA") throw new Error("Recompensa já utilizada — histórico não pode ser alterado");

  await db
    .update(referralRewards)
    .set({ status: "CANCELADA", canceledAt: now, cancelReason: reason || "Cancelada pelo SuperAdmin", updatedAt: now })
    .where(eq(referralRewards.id, rewardId));

  await logEvent(db, {
    organizationId: reward.organizationId,
    referralId: reward.referralId,
    rewardId,
    type: "RECOMPENSA_CANCELADA",
    message: reason || "Cancelada pelo SuperAdmin",
    actorUserId,
  });
}

/** SuperAdmin: antifraude — sinais de duplicidade. */
export async function getFraudSignals(db: Db) {
  const rows = await db.select().from(referrals).orderBy(desc(referrals.createdAt)).limit(500);
  const byIp = new Map<string, number[]>();
  for (const r of rows) {
    if (!r.ipAddress) continue;
    const list = byIp.get(r.ipAddress) || [];
    list.push(r.id);
    byIp.set(r.ipAddress, list);
  }
  const sameIp = Array.from(byIp.entries())
    .filter(([, ids]) => ids.length > 1)
    .map(([ip, ids]) => ({ ip, referralIds: ids }));

  const flagged = rows.filter((r: any) => r.status === "FRAUDE" || r.status === "CANCELADA");
  return { sameIp, flagged: flagged.slice(0, 100), totalAnalyzed: rows.length };
}

/** Eventos de auditoria de uma indicação/recompensa (SuperAdmin). */
export async function listReferralEvents(db: Db, referralId?: number, limit = 200) {
  const query = db
    .select()
    .from(referralEvents)
    .orderBy(desc(referralEvents.createdAt))
    .limit(Math.min(limit, 500));
  if (referralId) {
    return query.where(eq(referralEvents.referralId, referralId));
  }
  return query;
}

/** Usado pelo cadastro: dias grátis configurados pelo SuperAdmin. */
export async function getTrialDays(db: Db): Promise<number> {
  const config = await getReferralConfig(db);
  return Math.max(0, Math.min(90, Number(config.trialDays) || 7));
}

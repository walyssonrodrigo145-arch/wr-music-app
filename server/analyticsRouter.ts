/**
 * analyticsRouter.ts — Router principal do módulo MusicPro Analytics
 * 
 * Contém 3 sub-routers:
 * 1. event — endpoints públicos de coleta (track, batch, heartbeat)
 * 2. query — queries do dashboard (Super Admin apenas)
 * 3. realtime — SSE de usuários online
 */

import { z } from "zod";
import { router, publicProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import {
  analyticsEvents,
  analyticsSessions,
  analyticsVisitors,
  analyticsHeatmap,
  analyticsOnline,
  analyticsConversions,
  analyticsRevenue,
  analyticsCampaigns,
  analyticsPages,
  analyticsAiInsights,
  analyticsSecurityLogs,
  paymentDues,
  users,
} from "../drizzle/schema";
import {
  analyticsQueue,
  upsertAnalyticsVisitor,
  upsertAnalyticsSession,
  upsertOnlineUser,
} from "./services/AnalyticsQueue";
import { eq, sql, desc, gte, lte, and, count, sum, avg, lt, or } from "drizzle-orm";
import { ENV } from "./_core/env";

// ── Middleware Super Admin ────────────────────────────────────────────────────
import { protectedProcedure } from "./_core/trpc";

const isSuperAdmin = protectedProcedure.use(async ({ ctx, next }) => {
  const superAdminEmail = ENV.superAdminEmail?.toLowerCase() || "walyssonrodrigo145@gmail.com";
  const userEmail = ctx.user.email?.toLowerCase();

  const isMaster =
    userEmail === superAdminEmail ||
    userEmail === "walyssonrodrigo145@gmail.com" ||
    (ENV.ownerOpenId && ctx.user.openId === ENV.ownerOpenId) ||
    ctx.user.role === "admin";

  if (!isMaster) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Acesso restrito ao Super Admin.",
    });
  }
  return next({ ctx });
});

function extractPathname(urlStr: string): string {
  if (!urlStr) return "/";
  try {
    if (urlStr.startsWith("http://") || urlStr.startsWith("https://")) {
      const parsed = new URL(urlStr);
      return parsed.pathname || "/";
    }
  } catch {}
  return urlStr.split("?")[0].substring(0, 255) || "/";
}

// ── Schemas de validação ─────────────────────────────────────────────────────
const EventSchema = z.object({
  sessionId: z.string().max(64),
  visitorId: z.string().max(64),
  userId: z.number().optional().nullable(),
  eventName: z.enum([
    "page_view", "session_start", "session_end", "button_click", "link_click",
    "signup_started", "signup_completed", "trial_started", "trial_finished",
    "login", "logout", "plan_selected", "checkout_started", "pix_generated",
    "payment_success", "payment_failed", "subscription_created", "subscription_cancelled",
    "email_open", "email_click", "whatsapp_click", "video_play", "video_finish",
    "download", "upload", "form_submit", "search", "feature_used", "error", "api_error",
    "scroll_depth", "heatmap_click", "heatmap_move", "web_vital",
  ]),
  pageUrl: z.string().max(2000).optional().nullable(),
  pageTitle: z.string().max(255).optional().nullable(),
  referrer: z.string().max(2000).optional().nullable(),
  elementId: z.string().max(100).optional().nullable(),
  elementText: z.string().max(255).optional().nullable(),
  elementTag: z.string().max(30).optional().nullable(),
  utmSource: z.string().max(100).optional().nullable(),
  utmMedium: z.string().max(100).optional().nullable(),
  utmCampaign: z.string().max(100).optional().nullable(),
  utmContent: z.string().max(100).optional().nullable(),
  utmTerm: z.string().max(100).optional().nullable(),
  country: z.string().max(100).optional().nullable(),
  state: z.string().max(100).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  deviceType: z.enum(["desktop", "tablet", "mobile", "tv", "unknown"]).optional().nullable(),
  os: z.string().max(80).optional().nullable(),
  browser: z.string().max(80).optional().nullable(),
  screenRes: z.string().max(20).optional().nullable(),
  value: z.string().optional().nullable(),
  metadata: z.record(z.unknown()).optional().nullable(),
  timeOnPageSec: z.number().optional().nullable(),
  scrollDepth: z.number().min(0).max(100).optional().nullable(),
});

const SessionSchema = z.object({
  sessionId: z.string().max(64),
  visitorId: z.string().max(64),
  userId: z.number().optional().nullable(),
  ipMasked: z.string().max(20).optional().nullable(),
  country: z.string().max(100).optional().nullable(),
  state: z.string().max(100).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  language: z.string().max(20).optional().nullable(),
  timezone: z.string().max(60).optional().nullable(),
  deviceType: z.enum(["desktop", "tablet", "mobile", "tv", "unknown"]).optional().nullable(),
  os: z.string().max(80).optional().nullable(),
  browser: z.string().max(80).optional().nullable(),
  screenRes: z.string().max(20).optional().nullable(),
  userAgent: z.string().max(500).optional().nullable(),
  referrer: z.string().max(2000).optional().nullable(),
  utmSource: z.string().max(100).optional().nullable(),
  utmMedium: z.string().max(100).optional().nullable(),
  utmCampaign: z.string().max(100).optional().nullable(),
  utmContent: z.string().max(100).optional().nullable(),
  utmTerm: z.string().max(100).optional().nullable(),
});

const DateRangeSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  preset: z.enum(["today", "yesterday", "7d", "30d", "90d", "month", "year", "custom"]).default("30d"),
});

// ── Helpers ──────────────────────────────────────────────────────────────────
function getDateRange(preset: string, from?: string, to?: string): { start: Date; end: Date } {
  const now = new Date();
  const end = to ? new Date(to) : new Date();

  switch (preset) {
    case "today": {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      return { start, end };
    }
    case "yesterday": {
      const start = new Date(now);
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);

      const endDay = new Date(now);
      endDay.setDate(endDay.getDate() - 1);
      endDay.setHours(23, 59, 59, 999);
      return { start, end: endDay };
    }
    case "7d":
      return { start: new Date(Date.now() - 7 * 86400000), end };
    case "30d":
      return { start: new Date(Date.now() - 30 * 86400000), end };
    case "90d":
      return { start: new Date(Date.now() - 90 * 86400000), end };
    case "month": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      return { start, end };
    }
    case "year": {
      const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      return { start, end };
    }
    case "custom":
      return { start: from ? new Date(from) : new Date(Date.now() - 30 * 86400000), end };
    default:
      return { start: new Date(Date.now() - 30 * 86400000), end };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTER DE EVENTOS (público — sem autenticação)
// ─────────────────────────────────────────────────────────────────────────────
const analyticsEventRouter = router({
  // Inicia ou atualiza uma sessão
  sessionStart: publicProcedure
    .input(z.object({ session: SessionSchema, visitor: z.object({ visitorId: z.string().max(64) }) }))
    .mutation(async ({ input }) => {
      // Upsert visitante e sessão de forma assíncrona
      upsertAnalyticsVisitor({
        visitorId: input.visitor.visitorId,
        country: input.session.country,
        state: input.session.state,
        city: input.session.city,
        deviceType: input.session.deviceType ?? "unknown",
      }).catch(() => {}); // Fire and forget

      upsertAnalyticsSession({
        sessionId: input.session.sessionId,
        visitorId: input.session.visitorId,
        userId: input.session.userId,
        ipMasked: input.session.ipMasked,
        country: input.session.country,
        state: input.session.state,
        city: input.session.city,
        language: input.session.language,
        timezone: input.session.timezone,
        deviceType: input.session.deviceType ?? "unknown",
        os: input.session.os,
        browser: input.session.browser,
        screenRes: input.session.screenRes,
        userAgent: input.session.userAgent,
        referrer: input.session.referrer,
        utmSource: input.session.utmSource,
        utmMedium: input.session.utmMedium,
        utmCampaign: input.session.utmCampaign,
        utmContent: input.session.utmContent,
        utmTerm: input.session.utmTerm,
        startedAt: new Date(),
        isBounce: true,
        pageCount: 1,
      }).catch(() => {});

      return { ok: true };
    }),

  // Rastreia um único evento
  track: publicProcedure
    .input(EventSchema)
    .mutation(async ({ input }) => {
      analyticsQueue.push({
        sessionId: input.sessionId,
        visitorId: input.visitorId,
        userId: input.userId,
        eventName: input.eventName,
        pageUrl: input.pageUrl,
        pageTitle: input.pageTitle,
        referrer: input.referrer,
        elementId: input.elementId,
        elementText: input.elementText,
        elementTag: input.elementTag,
        utmSource: input.utmSource,
        utmMedium: input.utmMedium,
        utmCampaign: input.utmCampaign,
        utmContent: input.utmContent,
        utmTerm: input.utmTerm,
        country: input.country,
        state: input.state,
        city: input.city,
        deviceType: input.deviceType ?? "unknown",
        os: input.os,
        browser: input.browser,
        screenRes: input.screenRes,
        value: input.value,
        metadata: input.metadata as Record<string, unknown>,
        timeOnPageSec: input.timeOnPageSec,
        scrollDepth: input.scrollDepth,
        createdAt: new Date(),
      });
      return { ok: true };
    }),

  // Rastreia lote de eventos (enviado pelo debounce do front-end)
  trackBatch: publicProcedure
    .input(z.object({ events: z.array(EventSchema).max(50) }))
    .mutation(async ({ input }) => {
      const pushed = analyticsQueue.pushMany(
        input.events.map((e) => ({
          sessionId: e.sessionId,
          visitorId: e.visitorId,
          userId: e.userId,
          eventName: e.eventName,
          pageUrl: e.pageUrl,
          pageTitle: e.pageTitle,
          referrer: e.referrer,
          elementId: e.elementId,
          elementText: e.elementText,
          elementTag: e.elementTag,
          utmSource: e.utmSource,
          utmMedium: e.utmMedium,
          utmCampaign: e.utmCampaign,
          utmContent: e.utmContent,
          utmTerm: e.utmTerm,
          country: e.country,
          state: e.state,
          city: e.city,
          deviceType: e.deviceType ?? "unknown",
          os: e.os,
          browser: e.browser,
          screenRes: e.screenRes,
          value: e.value,
          metadata: e.metadata as Record<string, unknown>,
          timeOnPageSec: e.timeOnPageSec,
          scrollDepth: e.scrollDepth,
          createdAt: new Date(),
        }))
      );
      return { ok: true, pushed };
    }),

  // Heartbeat de usuário online (chamado a cada 30s)
  heartbeat: publicProcedure
    .input(z.object({
      sessionId: z.string().max(64),
      visitorId: z.string().max(64),
      userId: z.number().optional().nullable(),
      userName: z.string().max(255).optional().nullable(),
      pageUrl: z.string().max(2000).optional().nullable(),
      pageTitle: z.string().max(255).optional().nullable(),
      country: z.string().max(100).optional().nullable(),
      state: z.string().max(100).optional().nullable(),
      city: z.string().max(100).optional().nullable(),
      deviceType: z.enum(["desktop", "tablet", "mobile", "tv", "unknown"]).optional().nullable(),
      browser: z.string().max(80).optional().nullable(),
      os: z.string().max(80).optional().nullable(),
      screenRes: z.string().max(20).optional().nullable(),
      utmSource: z.string().max(100).optional().nullable(),
      referrer: z.string().max(2000).optional().nullable(),
      ipMasked: z.string().max(20).optional().nullable(),
    }))
    .mutation(async ({ input }) => {
      upsertOnlineUser(input).catch(() => {});
      return { ok: true };
    }),

  // Registrar dados de heatmap
  heatmap: publicProcedure
    .input(z.object({
      sessionId: z.string().max(64),
      pageUrl: z.string().max(2000),
      points: z.array(z.object({
        xPercent: z.number().min(0).max(100),
        yPercent: z.number().min(0).max(100),
        eventType: z.enum(["click", "move", "scroll"]),
        viewportW: z.number().optional(),
        viewportH: z.number().optional(),
      })).max(100),
    }))
    .mutation(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) return { ok: false };

        const pageUrlNormalized = extractPathname(input.pageUrl);

        await db.insert(analyticsHeatmap).values(
          input.points.map((p) => ({
            sessionId: input.sessionId,
            pageUrl: input.pageUrl,
            pageUrlNormalized,
            xPercent: String(p.xPercent),
            yPercent: String(p.yPercent),
            eventType: p.eventType,
            viewportW: p.viewportW,
            viewportH: p.viewportH,
          }))
        );
      } catch {}
      return { ok: true };
    }),
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTER DE QUERIES (Super Admin)
// ─────────────────────────────────────────────────────────────────────────────
const analyticsQueryRouter = router({

  // ── Cards KPI do Dashboard ────────────────────────────────────────────────
  getDashboardCards: isSuperAdmin.input(DateRangeSchema).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    try {
      const { start, end } = getDateRange(input.preset, input.from, input.to);
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      // 1. Visitantes Hoje e Únicos
      const [vTodayRes] = await db.select({ count: sql<number>`CAST(COUNT(*) AS INT)` })
        .from(analyticsSessions)
        .where(gte(analyticsSessions.startedAt, todayStart));
      let visitorsTodayCount = vTodayRes?.count || 0;

      const [uTodayRes] = await db.select({ count: sql<number>`CAST(COUNT(DISTINCT ${analyticsSessions.visitorId}) AS INT)` })
        .from(analyticsSessions)
        .where(gte(analyticsSessions.startedAt, todayStart));
      let uniqueVisitorsTodayCount = uTodayRes?.count || 0;

      if (visitorsTodayCount === 0) {
        const [evVisitorsToday] = await db.select({ count: sql<number>`CAST(COUNT(DISTINCT ${analyticsEvents.sessionId}) AS INT)` })
          .from(analyticsEvents)
          .where(gte(analyticsEvents.createdAt, todayStart));
        const [evUniqueVisitorsToday] = await db.select({ count: sql<number>`CAST(COUNT(DISTINCT ${analyticsEvents.visitorId}) AS INT)` })
          .from(analyticsEvents)
          .where(gte(analyticsEvents.createdAt, todayStart));
        visitorsTodayCount = evVisitorsToday?.count || 0;
        uniqueVisitorsTodayCount = evUniqueVisitorsToday?.count || 0;
      }

      // 2. Online Agora (últimos 5 minutos)
      const [onlineRes] = await db.select({ count: sql<number>`CAST(COUNT(*) AS INT)` })
        .from(analyticsOnline)
        .where(gte(analyticsOnline.lastPingAt, new Date(Date.now() - 300_000)));
      let onlineNowCount = onlineRes?.count || 0;

      if (onlineNowCount === 0) {
        const [activeSessionsRes] = await db.select({ count: sql<number>`CAST(COUNT(DISTINCT ${analyticsSessions.sessionId}) AS INT)` })
          .from(analyticsSessions)
          .where(gte(analyticsSessions.startedAt, new Date(Date.now() - 300_000)));
        onlineNowCount = activeSessionsRes?.count || 0;
      }

      // 3. Novos Cadastros (Hoje)
      const [signupEvRes] = await db.select({ count: sql<number>`CAST(COUNT(*) AS INT)` })
        .from(analyticsEvents)
        .where(and(
          eq(analyticsEvents.eventName, "signup_completed"),
          gte(analyticsEvents.createdAt, todayStart)
        ));
      let signupsTodayCount = signupEvRes?.count || 0;

      if (signupsTodayCount === 0) {
        const [usersTodayRes] = await db.select({ count: sql<number>`CAST(COUNT(*) AS INT)` })
          .from(users)
          .where(gte(users.createdAt, todayStart));
        signupsTodayCount = usersTodayRes?.count || 0;
      }

      // 4. Testes Gratuitos (Trials Hoje)
      const [trialEvRes] = await db.select({ count: sql<number>`CAST(COUNT(*) AS INT)` })
        .from(analyticsEvents)
        .where(and(
          eq(analyticsEvents.eventName, "trial_started"),
          gte(analyticsEvents.createdAt, todayStart)
        ));
      let trialsTodayCount = trialEvRes?.count || 0;

      // 5. Assinaturas (Hoje)
      const [subEvRes] = await db.select({ count: sql<number>`CAST(COUNT(*) AS INT)` })
        .from(analyticsEvents)
        .where(and(
          eq(analyticsEvents.eventName, "subscription_created"),
          gte(analyticsEvents.createdAt, todayStart)
        ));
      let subscriptionsTodayCount = subEvRes?.count || 0;

      // 6. Receita (Hoje, Mês, Total)
      const [revTodayRes] = await db.select({ total: sql<string>`COALESCE(SUM(amount), '0')` })
        .from(analyticsRevenue)
        .where(gte(analyticsRevenue.createdAt, todayStart));

      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const [revMonthRes] = await db.select({ total: sql<string>`COALESCE(SUM(amount), '0')` })
        .from(analyticsRevenue)
        .where(gte(analyticsRevenue.createdAt, monthStart));

      const [revTotalRes] = await db.select({ total: sql<string>`COALESCE(SUM(amount), '0')` })
        .from(analyticsRevenue);

      let revToday = parseFloat(revTodayRes?.total || "0");
      let revMonth = parseFloat(revMonthRes?.total || "0");
      let revTotal = parseFloat(revTotalRes?.total || "0");

      if (revTotal === 0) {
        const [duesToday] = await db.select({ total: sql<string>`COALESCE(SUM(amount), '0')` })
          .from(paymentDues)
          .where(and(
            or(eq(paymentDues.status, "pago"), sql`${paymentDues.paidAt} IS NOT NULL`),
            gte(sql`COALESCE(${paymentDues.paidAt}, ${paymentDues.createdAt})`, todayStart)
          ));
        const [duesMonth] = await db.select({ total: sql<string>`COALESCE(SUM(amount), '0')` })
          .from(paymentDues)
          .where(and(
            or(eq(paymentDues.status, "pago"), sql`${paymentDues.paidAt} IS NOT NULL`),
            gte(sql`COALESCE(${paymentDues.paidAt}, ${paymentDues.createdAt})`, monthStart)
          ));
        const [duesTotal] = await db.select({ total: sql<string>`COALESCE(SUM(amount), '0')` })
          .from(paymentDues)
          .where(or(eq(paymentDues.status, "pago"), sql`${paymentDues.paidAt} IS NOT NULL`));

        revToday = parseFloat(duesToday?.total || "0");
        revMonth = parseFloat(duesMonth?.total || "0");
        revTotal = parseFloat(duesTotal?.total || "0");
      }

      // 7. Conversão (Visitantes Únicos vs Pagantes no período)
      const [uInPeriodRes] = await db.select({ count: sql<number>`CAST(COUNT(DISTINCT ${analyticsSessions.visitorId}) AS INT)` })
        .from(analyticsSessions)
        .where(and(gte(analyticsSessions.startedAt, start), lte(analyticsSessions.startedAt, end)));

      const [pInPeriodRes] = await db.select({ count: sql<number>`CAST(COUNT(*) AS INT)` })
        .from(analyticsRevenue)
        .where(and(gte(analyticsRevenue.createdAt, start), lte(analyticsRevenue.createdAt, end)));

      const uniqueVisitorsPeriod = uInPeriodRes?.count || 0;
      const paymentsPeriod = pInPeriodRes?.count || 0;

      const conversionRate = uniqueVisitorsPeriod > 0
        ? parseFloat(((paymentsPeriod / uniqueVisitorsPeriod) * 100).toFixed(2))
        : 0;

      return {
        visitorsToday: visitorsTodayCount,
        uniqueVisitorsToday: uniqueVisitorsTodayCount,
        onlineNow: onlineNowCount,
        signupsToday: signupsTodayCount,
        trialsToday: trialsTodayCount,
        subscriptionsToday: subscriptionsTodayCount,
        revenueToday: revToday,
        revenueMonth: revMonth,
        revenueTotal: revTotal,
        conversionRate,
      };
    } catch (err) {
      console.error("[getDashboardCards Error]:", err);
      return {
        visitorsToday: 0,
        uniqueVisitorsToday: 0,
        onlineNow: 0,
        signupsToday: 0,
        trialsToday: 0,
        subscriptionsToday: 0,
        revenueToday: 0,
        revenueMonth: 0,
        revenueTotal: 0,
        conversionRate: 0,
      };
    }
  }),

  // ── Visitantes por período ────────────────────────────────────────────────
  getVisitorStats: isSuperAdmin.input(DateRangeSchema).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const { start, end } = getDateRange(input.preset, input.from, input.to);

    let byDay = await db.select({
      date: sql<string>`DATE(${analyticsSessions.startedAt})`,
      sessions: sql<number>`CAST(COUNT(*) AS INT)`,
      unique: sql<number>`CAST(COUNT(DISTINCT ${analyticsSessions.visitorId}) AS INT)`,
    })
      .from(analyticsSessions)
      .where(and(gte(analyticsSessions.startedAt, start), lte(analyticsSessions.startedAt, end)))
      .groupBy(sql`DATE(${analyticsSessions.startedAt})`)
      .orderBy(sql`DATE(${analyticsSessions.startedAt})`);

    if (byDay.length === 0) {
      byDay = await db.select({
        date: sql<string>`DATE(${analyticsEvents.createdAt})`,
        sessions: sql<number>`CAST(COUNT(DISTINCT ${analyticsEvents.sessionId}) AS INT)`,
        unique: sql<number>`CAST(COUNT(DISTINCT ${analyticsEvents.visitorId}) AS INT)`,
      })
        .from(analyticsEvents)
        .where(and(gte(analyticsEvents.createdAt, start), lte(analyticsEvents.createdAt, end)))
        .groupBy(sql`DATE(${analyticsEvents.createdAt})`)
        .orderBy(sql`DATE(${analyticsEvents.createdAt})`);
    }

    let byHour = await db.select({
      hour: sql<number>`CAST(EXTRACT(HOUR FROM ${analyticsSessions.startedAt}) AS INT)`,
      sessions: sql<number>`CAST(COUNT(*) AS INT)`,
    })
      .from(analyticsSessions)
      .where(and(gte(analyticsSessions.startedAt, start), lte(analyticsSessions.startedAt, end)))
      .groupBy(sql`EXTRACT(HOUR FROM ${analyticsSessions.startedAt})`)
      .orderBy(sql`EXTRACT(HOUR FROM ${analyticsSessions.startedAt})`);

    if (byHour.length === 0) {
      byHour = await db.select({
        hour: sql<number>`CAST(EXTRACT(HOUR FROM ${analyticsEvents.createdAt}) AS INT)`,
        sessions: sql<number>`CAST(COUNT(DISTINCT ${analyticsEvents.sessionId}) AS INT)`,
      })
        .from(analyticsEvents)
        .where(and(gte(analyticsEvents.createdAt, start), lte(analyticsEvents.createdAt, end)))
        .groupBy(sql`EXTRACT(HOUR FROM ${analyticsEvents.createdAt})`)
        .orderBy(sql`EXTRACT(HOUR FROM ${analyticsEvents.createdAt})`);
    }

    return { byDay, byHour };
  }),

  // ── Origem do tráfego ─────────────────────────────────────────────────────
  getTrafficSources: isSuperAdmin.input(DateRangeSchema).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const { start, end } = getDateRange(input.preset, input.from, input.to);

    let sources = await db.select({
      source: sql<string>`COALESCE(${analyticsSessions.utmSource}, 
        CASE 
          WHEN ${analyticsSessions.referrer} ILIKE '%google%' THEN 'google'
          WHEN ${analyticsSessions.referrer} ILIKE '%instagram%' THEN 'instagram'
          WHEN ${analyticsSessions.referrer} ILIKE '%facebook%' THEN 'facebook'
          WHEN ${analyticsSessions.referrer} ILIKE '%whatsapp%' THEN 'whatsapp'
          WHEN ${analyticsSessions.referrer} ILIKE '%tiktok%' THEN 'tiktok'
          WHEN ${analyticsSessions.referrer} ILIKE '%youtube%' THEN 'youtube'
          WHEN ${analyticsSessions.referrer} ILIKE '%linkedin%' THEN 'linkedin'
          WHEN ${analyticsSessions.referrer} IS NOT NULL AND ${analyticsSessions.referrer} != '' THEN 'referencia'
          ELSE 'direto'
        END)`,
      sessions: sql<number>`CAST(COUNT(*) AS INT)`,
      uniqueVisitors: sql<number>`CAST(COUNT(DISTINCT ${analyticsSessions.visitorId}) AS INT)`,
    })
      .from(analyticsSessions)
      .where(and(gte(analyticsSessions.startedAt, start), lte(analyticsSessions.startedAt, end)))
      .groupBy(sql`1`)
      .orderBy(sql`COUNT(*) DESC`);

    if (sources.length === 0) {
      sources = await db.select({
        source: sql<string>`COALESCE(${analyticsEvents.utmSource}, 
          CASE 
            WHEN ${analyticsEvents.referrer} ILIKE '%google%' THEN 'google'
            WHEN ${analyticsEvents.referrer} ILIKE '%instagram%' THEN 'instagram'
            WHEN ${analyticsEvents.referrer} ILIKE '%facebook%' THEN 'facebook'
            WHEN ${analyticsEvents.referrer} ILIKE '%whatsapp%' THEN 'whatsapp'
            WHEN ${analyticsEvents.referrer} ILIKE '%tiktok%' THEN 'tiktok'
            WHEN ${analyticsEvents.referrer} ILIKE '%youtube%' THEN 'youtube'
            WHEN ${analyticsEvents.referrer} ILIKE '%linkedin%' THEN 'linkedin'
            WHEN ${analyticsEvents.referrer} IS NOT NULL AND ${analyticsEvents.referrer} != '' THEN 'referencia'
            ELSE 'direto'
          END)`,
        sessions: sql<number>`CAST(COUNT(DISTINCT ${analyticsEvents.sessionId}) AS INT)`,
        uniqueVisitors: sql<number>`CAST(COUNT(DISTINCT ${analyticsEvents.visitorId}) AS INT)`,
      })
        .from(analyticsEvents)
        .where(and(gte(analyticsEvents.createdAt, start), lte(analyticsEvents.createdAt, end)))
        .groupBy(sql`1`)
        .orderBy(sql`COUNT(*) DESC`);
    }

    // Receita por source
    const revenueBySource = await db.select({
      source: sql<string>`COALESCE(${analyticsRevenue.utmSource}, 'direto')`,
      revenue: sql<string>`COALESCE(SUM(${analyticsRevenue.amount}), 0)`,
      conversions: sql<number>`CAST(COUNT(*) AS INT)`,
    })
      .from(analyticsRevenue)
      .where(and(gte(analyticsRevenue.createdAt, start), lte(analyticsRevenue.createdAt, end)))
      .groupBy(sql`1`);

    const revenueMap = Object.fromEntries(
      revenueBySource.map((r) => [r.source, { revenue: parseFloat(r.revenue), conversions: r.conversions }])
    );

    const totalSessions = sources.reduce((acc, s) => acc + s.sessions, 0);

    return sources.map((s) => ({
      source: s.source,
      sessions: s.sessions,
      uniqueVisitors: s.uniqueVisitors,
      percentage: totalSessions > 0 ? ((s.sessions / totalSessions) * 100).toFixed(1) : "0",
      conversions: revenueMap[s.source]?.conversions ?? 0,
      revenue: revenueMap[s.source]?.revenue ?? 0,
    }));
  }),

  // ── Páginas mais visitadas ────────────────────────────────────────────────
  getLandingPages: isSuperAdmin.input(DateRangeSchema).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const { start, end } = getDateRange(input.preset, input.from, input.to);

    const pages = await db.select({
      pageUrl: analyticsEvents.pageUrl,
      pageTitle: analyticsEvents.pageTitle,
      totalViews: sql<number>`CAST(COUNT(*) AS INT)`,
      uniqueVisitors: sql<number>`CAST(COUNT(DISTINCT ${analyticsEvents.visitorId}) AS INT)`,
      avgTimeSec: sql<number>`CAST(COALESCE(AVG(${analyticsEvents.timeOnPageSec}), 0) AS INT)`,
    })
      .from(analyticsEvents)
      .where(and(
        eq(analyticsEvents.eventName, "page_view"),
        gte(analyticsEvents.createdAt, start),
        lte(analyticsEvents.createdAt, end),
        sql`${analyticsEvents.pageUrl} IS NOT NULL`,
      ))
      .groupBy(analyticsEvents.pageUrl, analyticsEvents.pageTitle)
      .orderBy(sql`COUNT(*) DESC`)
      .limit(50);

    return pages;
  }),

  // ── Funil de conversão ────────────────────────────────────────────────────
  getConversionFunnel: isSuperAdmin.input(DateRangeSchema).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const { start, end } = getDateRange(input.preset, input.from, input.to);

    const countEvent = async (eventName: string) => {
      const [result] = await db.select({ count: sql<number>`CAST(COUNT(DISTINCT ${analyticsEvents.sessionId}) AS INT)` })
        .from(analyticsEvents)
        .where(and(
          sql`${analyticsEvents.eventName} = ${eventName}`,
          gte(analyticsEvents.createdAt, start),
          lte(analyticsEvents.createdAt, end),
        ));
      return result.count;
    };

    const [visitors] = await db.select({ count: sql<number>`CAST(COUNT(*) AS INT)` })
      .from(analyticsSessions)
      .where(and(gte(analyticsSessions.startedAt, start), lte(analyticsSessions.startedAt, end)));

    const landing = await countEvent("page_view");
    const signupStarted = await countEvent("signup_started");
    const signupCompleted = await countEvent("signup_completed");
    const trialStarted = await countEvent("trial_started");
    const planSelected = await countEvent("plan_selected");
    const checkoutStarted = await countEvent("checkout_started");
    const pixGenerated = await countEvent("pix_generated");
    const paymentSuccess = await countEvent("payment_success");

    const steps = [
      { label: "Visitante", count: visitors.count },
      { label: "Landing Page", count: landing },
      { label: "Início Cadastro", count: signupStarted },
      { label: "Conta Criada", count: signupCompleted },
      { label: "Trial Iniciado", count: trialStarted },
      { label: "Plano Escolhido", count: planSelected },
      { label: "Checkout Iniciado", count: checkoutStarted },
      { label: "PIX Gerado", count: pixGenerated },
      { label: "Pagamento", count: paymentSuccess },
    ];

    return steps.map((step, i) => {
      const prev = i > 0 ? steps[i - 1].count : step.count;
      const loss = Math.max(0, prev - step.count);
      const convRate = prev > 0 ? ((step.count / prev) * 100).toFixed(1) : "100";
      return { ...step, loss, conversionRate: parseFloat(convRate) };
    });
  }),

  // ── Checkout Analytics ────────────────────────────────────────────────────
  getCheckoutAnalytics: isSuperAdmin.input(DateRangeSchema).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const { start, end } = getDateRange(input.preset, input.from, input.to);

    const countEvent = async (eventName: string) => {
      const [r] = await db.select({ count: sql<number>`CAST(COUNT(DISTINCT ${analyticsEvents.sessionId}) AS INT)` })
        .from(analyticsEvents)
        .where(and(
          sql`${analyticsEvents.eventName} = ${eventName}`,
          gte(analyticsEvents.createdAt, start),
          lte(analyticsEvents.createdAt, end),
        ));
      return r.count;
    };

    const checkoutStarted = await countEvent("checkout_started");
    const pixGenerated = await countEvent("pix_generated");
    const paymentSuccess = await countEvent("payment_success");
    const paymentFailed = await countEvent("payment_failed");
    const firstLogin = await countEvent("login");

    return {
      checkoutStarted,
      pixGenerated,
      paymentSuccess,
      paymentFailed,
      firstLogin,
      abandonRate: checkoutStarted > 0
        ? (((checkoutStarted - paymentSuccess) / checkoutStarted) * 100).toFixed(1)
        : "0",
    };
  }),

  // ── Receita ───────────────────────────────────────────────────────────────
  getRevenueStats: isSuperAdmin.input(DateRangeSchema).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const { start, end } = getDateRange(input.preset, input.from, input.to);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [mrr] = await db.select({ total: sql<string>`COALESCE(SUM(amount), 0)` })
      .from(analyticsRevenue)
      .where(gte(analyticsRevenue.createdAt, monthStart));

    const [periodRevenue] = await db.select({ total: sql<string>`COALESCE(SUM(amount), 0)` })
      .from(analyticsRevenue)
      .where(and(gte(analyticsRevenue.createdAt, start), lte(analyticsRevenue.createdAt, end)));

    const [ticket] = await db.select({ avg: sql<string>`COALESCE(AVG(amount), 0)` })
      .from(analyticsRevenue);

    let mrrVal = parseFloat(mrr?.total || "0");
    let pRevVal = parseFloat(periodRevenue?.total || "0");
    let avgTicketVal = parseFloat(ticket?.avg || "0");

    if (mrrVal === 0 && pRevVal === 0) {
      const [duesMrr] = await db.select({ total: sql<string>`COALESCE(SUM(amount), 0)` })
        .from(paymentDues)
        .where(and(or(eq(paymentDues.status, "pago"), sql`${paymentDues.paidAt} IS NOT NULL`), gte(sql`COALESCE(${paymentDues.paidAt}, ${paymentDues.createdAt})`, monthStart)));
      const [duesPeriod] = await db.select({ total: sql<string>`COALESCE(SUM(amount), 0)` })
        .from(paymentDues)
        .where(and(
          or(eq(paymentDues.status, "pago"), sql`${paymentDues.paidAt} IS NOT NULL`),
          gte(sql`COALESCE(${paymentDues.paidAt}, ${paymentDues.createdAt})`, start),
          lte(sql`COALESCE(${paymentDues.paidAt}, ${paymentDues.createdAt})`, end)
        ));
      const [duesAvg] = await db.select({ avg: sql<string>`COALESCE(AVG(amount), 0)` })
        .from(paymentDues)
        .where(and(
          or(eq(paymentDues.status, "pago"), sql`${paymentDues.paidAt} IS NOT NULL`),
          gte(sql`COALESCE(${paymentDues.paidAt}, ${paymentDues.createdAt})`, start),
          lte(sql`COALESCE(${paymentDues.paidAt}, ${paymentDues.createdAt})`, end)
        ));
      mrrVal = parseFloat(duesMrr.total);
      pRevVal = parseFloat(duesPeriod.total);
      avgTicketVal = parseFloat(duesAvg.avg);
    }

    return {
      mrr: mrrVal,
      arr: mrrVal * 12,
      periodRevenue: pRevVal,
      avgTicket: avgTicketVal,
      byPlan: [],
    };
  }),

  // ── Dispositivos e Browsers ───────────────────────────────────────────────
  getDeviceStats: isSuperAdmin.input(DateRangeSchema).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const { start, end } = getDateRange(input.preset, input.from, input.to);

    let devices = await db.select({
      device: sql<string>`COALESCE(${analyticsSessions.deviceType}, 'unknown')`,
      count: sql<number>`CAST(COUNT(*) AS INT)`,
    })
      .from(analyticsSessions)
      .where(and(gte(analyticsSessions.startedAt, start), lte(analyticsSessions.startedAt, end)))
      .groupBy(analyticsSessions.deviceType)
      .orderBy(sql`COUNT(*) DESC`);

    if (devices.length === 0) {
      devices = await db.select({
        device: sql<string>`COALESCE(${analyticsEvents.deviceType}, 'unknown')`,
        count: sql<number>`CAST(COUNT(DISTINCT ${analyticsEvents.sessionId}) AS INT)`,
      })
        .from(analyticsEvents)
        .where(and(gte(analyticsEvents.createdAt, start), lte(analyticsEvents.createdAt, end)))
        .groupBy(analyticsEvents.deviceType)
        .orderBy(sql`COUNT(*) DESC`);
    }

    let browsers = await db.select({
      browser: sql<string>`COALESCE(${analyticsSessions.browser}, 'Outros')`,
      count: sql<number>`CAST(COUNT(*) AS INT)`,
    })
      .from(analyticsSessions)
      .where(and(gte(analyticsSessions.startedAt, start), lte(analyticsSessions.startedAt, end)))
      .groupBy(analyticsSessions.browser)
      .orderBy(sql`COUNT(*) DESC`)
      .limit(10);

    if (browsers.length === 0) {
      browsers = await db.select({
        browser: sql<string>`COALESCE(${analyticsEvents.browser}, 'Outros')`,
        count: sql<number>`CAST(COUNT(DISTINCT ${analyticsEvents.sessionId}) AS INT)`,
      })
        .from(analyticsEvents)
        .where(and(gte(analyticsEvents.createdAt, start), lte(analyticsEvents.createdAt, end)))
        .groupBy(analyticsEvents.browser)
        .orderBy(sql`COUNT(*) DESC`)
        .limit(10);
    }

    let oses = await db.select({
      os: sql<string>`COALESCE(${analyticsSessions.os}, 'Outros')`,
      count: sql<number>`CAST(COUNT(*) AS INT)`,
    })
      .from(analyticsSessions)
      .where(and(gte(analyticsSessions.startedAt, start), lte(analyticsSessions.startedAt, end)))
      .groupBy(analyticsSessions.os)
      .orderBy(sql`COUNT(*) DESC`)
      .limit(10);

    if (oses.length === 0) {
      oses = await db.select({
        os: sql<string>`COALESCE(${analyticsEvents.os}, 'Outros')`,
        count: sql<number>`CAST(COUNT(DISTINCT ${analyticsEvents.sessionId}) AS INT)`,
      })
        .from(analyticsEvents)
        .where(and(gte(analyticsEvents.createdAt, start), lte(analyticsEvents.createdAt, end)))
        .groupBy(analyticsEvents.os)
        .orderBy(sql`COUNT(*) DESC`)
        .limit(10);
    }

    const resolutions = await db.select({
      res: sql<string>`COALESCE(${analyticsSessions.screenRes}, 'Outros')`,
      count: sql<number>`CAST(COUNT(*) AS INT)`,
    })
      .from(analyticsSessions)
      .where(and(gte(analyticsSessions.startedAt, start), lte(analyticsSessions.startedAt, end)))
      .groupBy(analyticsSessions.screenRes)
      .orderBy(sql`COUNT(*) DESC`)
      .limit(10);

    return { devices, browsers, oses, resolutions };
  }),

  // ── Mapa Geográfico ───────────────────────────────────────────────────────
  getGeoStats: isSuperAdmin.input(DateRangeSchema).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const { start, end } = getDateRange(input.preset, input.from, input.to);

    let byState = await db.select({
      state: sql<string>`COALESCE(${analyticsSessions.state}, 'Desconhecido')`,
      count: sql<number>`CAST(COUNT(*) AS INT)`,
      unique: sql<number>`CAST(COUNT(DISTINCT ${analyticsSessions.visitorId}) AS INT)`,
    })
      .from(analyticsSessions)
      .where(and(gte(analyticsSessions.startedAt, start), lte(analyticsSessions.startedAt, end)))
      .groupBy(analyticsSessions.state)
      .orderBy(sql`COUNT(*) DESC`);

    if (byState.length === 0) {
      byState = await db.select({
        state: sql<string>`COALESCE(${analyticsEvents.state}, 'Desconhecido')`,
        count: sql<number>`CAST(COUNT(DISTINCT ${analyticsEvents.sessionId}) AS INT)`,
        unique: sql<number>`CAST(COUNT(DISTINCT ${analyticsEvents.visitorId}) AS INT)`,
      })
        .from(analyticsEvents)
        .where(and(gte(analyticsEvents.createdAt, start), lte(analyticsEvents.createdAt, end)))
        .groupBy(analyticsEvents.state)
        .orderBy(sql`COUNT(*) DESC`);
    }

    let byCity = await db.select({
      city: sql<string>`COALESCE(${analyticsSessions.city}, 'Desconhecida')`,
      state: sql<string>`COALESCE(${analyticsSessions.state}, '')`,
      count: sql<number>`CAST(COUNT(*) AS INT)`,
    })
      .from(analyticsSessions)
      .where(and(gte(analyticsSessions.startedAt, start), lte(analyticsSessions.startedAt, end)))
      .groupBy(analyticsSessions.city, analyticsSessions.state)
      .orderBy(sql`COUNT(*) DESC`)
      .limit(30);

    if (byCity.length === 0) {
      byCity = await db.select({
        city: sql<string>`COALESCE(${analyticsEvents.city}, 'Desconhecida')`,
        state: sql<string>`COALESCE(${analyticsEvents.state}, '')`,
        count: sql<number>`CAST(COUNT(DISTINCT ${analyticsEvents.sessionId}) AS INT)`,
      })
        .from(analyticsEvents)
        .where(and(gte(analyticsEvents.createdAt, start), lte(analyticsEvents.createdAt, end)))
        .groupBy(analyticsEvents.city, analyticsEvents.state)
        .orderBy(sql`COUNT(*) DESC`)
        .limit(30);
    }

    let byCountry = await db.select({
      country: sql<string>`COALESCE(${analyticsSessions.country}, 'Desconhecido')`,
      count: sql<number>`CAST(COUNT(*) AS INT)`,
    })
      .from(analyticsSessions)
      .where(and(gte(analyticsSessions.startedAt, start), lte(analyticsSessions.startedAt, end)))
      .groupBy(analyticsSessions.country)
      .orderBy(sql`COUNT(*) DESC`);

    if (byCountry.length === 0) {
      byCountry = await db.select({
        country: sql<string>`COALESCE(${analyticsEvents.country}, 'Desconhecido')`,
        count: sql<number>`CAST(COUNT(DISTINCT ${analyticsEvents.sessionId}) AS INT)`,
      })
        .from(analyticsEvents)
        .where(and(gte(analyticsEvents.createdAt, start), lte(analyticsEvents.createdAt, end)))
        .groupBy(analyticsEvents.country)
        .orderBy(sql`COUNT(*) DESC`);
    }

    return { byState, byCity, byCountry };
  }),

  // ── Heatmap ───────────────────────────────────────────────────────────────
  getHeatmapPages: isSuperAdmin.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    return await db.select({
      pageUrlNormalized: analyticsHeatmap.pageUrlNormalized,
      totalPoints: sql<number>`CAST(COUNT(*) AS INT)`,
    })
      .from(analyticsHeatmap)
      .groupBy(analyticsHeatmap.pageUrlNormalized)
      .orderBy(sql`COUNT(*) DESC`)
      .limit(50);
  }),

  getHeatmapData: isSuperAdmin
    .input(z.object({ pageUrl: z.string(), eventType: z.enum(["click", "move", "scroll"]).default("click"), limit: z.number().default(2000) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const targetPath = extractPathname(input.pageUrl);

      return await db.select({
        xPercent: analyticsHeatmap.xPercent,
        yPercent: analyticsHeatmap.yPercent,
        count: sql<number>`CAST(COUNT(*) AS INT)`,
      })
        .from(analyticsHeatmap)
        .where(and(
          or(
            eq(analyticsHeatmap.pageUrlNormalized, targetPath),
            eq(analyticsHeatmap.pageUrlNormalized, input.pageUrl),
            eq(analyticsHeatmap.pageUrl, input.pageUrl)
          ),
          eq(analyticsHeatmap.eventType, input.eventType),
        ))
        .groupBy(
          sql`ROUND(${analyticsHeatmap.xPercent}::numeric, 0)`,
          sql`ROUND(${analyticsHeatmap.yPercent}::numeric, 0)`,
          analyticsHeatmap.xPercent,
          analyticsHeatmap.yPercent,
        )
        .limit(input.limit);
    }),

  // ── AI Insights ───────────────────────────────────────────────────────────
  getAIInsights: isSuperAdmin.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    return await db.select()
      .from(analyticsAiInsights)
      .where(sql`${analyticsAiInsights.expiresAt} IS NULL OR ${analyticsAiInsights.expiresAt} > NOW()`)
      .orderBy(desc(analyticsAiInsights.generatedAt))
      .limit(20);
  }),

  // ── Campanhas UTM ─────────────────────────────────────────────────────────
  getCampaignStats: isSuperAdmin.input(DateRangeSchema).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const { start, end } = getDateRange(input.preset, input.from, input.to);

    const campaigns = await db.select({
      campaign: sql<string>`COALESCE(${analyticsSessions.utmCampaign}, 'sem-campanha')`,
      source: sql<string>`COALESCE(${analyticsSessions.utmSource}, 'direto')`,
      medium: sql<string>`COALESCE(${analyticsSessions.utmMedium}, '')`,
      sessions: sql<number>`CAST(COUNT(*) AS INT)`,
      uniqueVisitors: sql<number>`CAST(COUNT(DISTINCT ${analyticsSessions.visitorId}) AS INT)`,
    })
      .from(analyticsSessions)
      .where(and(gte(analyticsSessions.startedAt, start), lte(analyticsSessions.startedAt, end)))
      .groupBy(analyticsSessions.utmCampaign, analyticsSessions.utmSource, analyticsSessions.utmMedium)
      .orderBy(sql`COUNT(*) DESC`)
      .limit(50);

    const revenueData = await db.select({
      campaign: sql<string>`COALESCE(${analyticsRevenue.utmCampaign}, 'sem-campanha')`,
      revenue: sql<string>`COALESCE(SUM(amount), 0)`,
      conversions: sql<number>`CAST(COUNT(*) AS INT)`,
    })
      .from(analyticsRevenue)
      .where(and(gte(analyticsRevenue.createdAt, start), lte(analyticsRevenue.createdAt, end)))
      .groupBy(analyticsRevenue.utmCampaign);

    const revenueMap = Object.fromEntries(
      revenueData.map((r) => [r.campaign, { revenue: parseFloat(r.revenue), conversions: r.conversions }])
    );

    // Investimento das campanhas
    const investmentData = await db.select().from(analyticsCampaigns);
    const investMap = Object.fromEntries(
      investmentData.map((c) => [c.utmCampaign, parseFloat(String(c.investment ?? 0))])
    );

    return campaigns.map((c) => {
      const revenue = revenueMap[c.campaign]?.revenue ?? 0;
      const conversions = revenueMap[c.campaign]?.conversions ?? 0;
      const investment = investMap[c.campaign] ?? 0;
      const roi = investment > 0 ? (((revenue - investment) / investment) * 100).toFixed(1) : null;
      const cac = conversions > 0 && investment > 0 ? (investment / conversions).toFixed(2) : null;
      return { ...c, revenue, conversions, investment, roi, cac };
    });
  }),

  // ── Usuários online agora ─────────────────────────────────────────────────
  getOnlineUsers: isSuperAdmin.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const twoMinAgo = new Date(Date.now() - 120_000);

    return await db.select()
      .from(analyticsOnline)
      .where(gte(analyticsOnline.lastPingAt, twoMinAgo))
      .orderBy(desc(analyticsOnline.lastPingAt))
      .limit(200);
  }),

  // Marcar insight como lido
  markInsightRead: isSuperAdmin
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(analyticsAiInsights).set({ isRead: true }).where(eq(analyticsAiInsights.id, input.id));
      return { ok: true };
    }),

  // Atualizar investimento de campanha
  updateCampaignInvestment: isSuperAdmin
    .input(z.object({ utmCampaign: z.string(), investment: z.number().min(0) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.insert(analyticsCampaigns)
        .values({ utmSource: "manual", utmCampaign: input.utmCampaign, investment: String(input.investment) })
        .onConflictDoUpdate({ target: analyticsCampaigns.utmCampaign, set: { investment: String(input.investment) } });
      return { ok: true };
    }),

  // Auditoria de Segurança & Ataques - Visão Geral
  getSecurityOverview: isSuperAdmin
    .input(z.object({
      dateRange: z.enum(["7d", "30d", "90d", "all"]).optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      let days = 30;
      if (input?.dateRange === "7d") days = 7;
      if (input?.dateRange === "90d") days = 90;
      const startDate = input?.dateRange === "all" ? new Date(0) : new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const [reqStats] = await db
        .select({
          totalRequests: count(analyticsSecurityLogs.id),
          rateLimitBlocked: count(sql`CASE WHEN ${analyticsSecurityLogs.eventCategory} = 'blocked_rate_limit' THEN 1 END`),
          attacksDetected: count(sql`CASE WHEN ${analyticsSecurityLogs.eventCategory} = 'bot_scanner' OR ${analyticsSecurityLogs.severity} IN ('high', 'critical') THEN 1 END`),
        })
        .from(analyticsSecurityLogs)
        .where(gte(analyticsSecurityLogs.createdAt, startDate));

      const [uniqueIpStats] = await db
        .select({
          uniqueIps: count(sql`DISTINCT ${analyticsSecurityLogs.ip}`),
        })
        .from(analyticsSecurityLogs)
        .where(gte(analyticsSecurityLogs.createdAt, startDate));

      const topAttackedRoutes = await db
        .select({
          route: analyticsSecurityLogs.route,
          count: count(analyticsSecurityLogs.id),
        })
        .from(analyticsSecurityLogs)
        .where(and(
          gte(analyticsSecurityLogs.createdAt, startDate),
          or(
            eq(analyticsSecurityLogs.eventCategory, "bot_scanner"),
            eq(analyticsSecurityLogs.eventCategory, "blocked_rate_limit"),
            eq(analyticsSecurityLogs.severity, "high"),
            eq(analyticsSecurityLogs.severity, "critical")
          )
        ))
        .groupBy(analyticsSecurityLogs.route)
        .orderBy(desc(count(analyticsSecurityLogs.id)))
        .limit(5);

      const topSuspiciousIps = await db
        .select({
          ip: analyticsSecurityLogs.ip,
          count: count(analyticsSecurityLogs.id),
          highRiskCount: count(sql`CASE WHEN ${analyticsSecurityLogs.severity} IN ('high', 'critical') OR ${analyticsSecurityLogs.eventCategory} = 'blocked_rate_limit' THEN 1 END`),
        })
        .from(analyticsSecurityLogs)
        .where(gte(analyticsSecurityLogs.createdAt, startDate))
        .groupBy(analyticsSecurityLogs.ip)
        .orderBy(desc(count(analyticsSecurityLogs.id)))
        .limit(5);

      return {
        totalRequests: Number(reqStats?.totalRequests || 0),
        uniqueIps: Number(uniqueIpStats?.uniqueIps || 0),
        rateLimitBlocked: Number(reqStats?.rateLimitBlocked || 0),
        attacksDetected: Number(reqStats?.attacksDetected || 0),
        topAttackedRoutes,
        topSuspiciousIps,
      };
    }),

  // Tabela Paginada de Logs de Segurança e Rotas
  getSecurityLogs: isSuperAdmin
    .input(z.object({
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(100).default(20),
      search: z.string().optional(),
      category: z.string().optional(),
      severity: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const offset = (input.page - 1) * input.limit;
      const conditions = [];

      if (input.search && input.search.trim()) {
        const term = `%${input.search.trim()}%`;
        conditions.push(or(
          sql`${analyticsSecurityLogs.ip} ILIKE ${term}`,
          sql`${analyticsSecurityLogs.route} ILIKE ${term}`,
          sql`${analyticsSecurityLogs.details} ILIKE ${term}`
        ));
      }

      if (input.category && input.category !== "all") {
        conditions.push(eq(analyticsSecurityLogs.eventCategory, input.category));
      }

      if (input.severity && input.severity !== "all") {
        conditions.push(eq(analyticsSecurityLogs.severity, input.severity));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const [countResult] = await db
        .select({ total: count(analyticsSecurityLogs.id) })
        .from(analyticsSecurityLogs)
        .where(whereClause);

      const logs = await db
        .select()
        .from(analyticsSecurityLogs)
        .where(whereClause)
        .orderBy(desc(analyticsSecurityLogs.createdAt))
        .limit(input.limit)
        .offset(offset);

      const total = Number(countResult?.total || 0);

      return {
        logs,
        total,
        page: input.page,
        totalPages: Math.ceil(total / input.limit) || 1,
      };
    }),
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTER PRINCIPAL DO ANALYTICS
// ─────────────────────────────────────────────────────────────────────────────
export const analyticsRouter = router({
  event: analyticsEventRouter,
  query: analyticsQueryRouter,
});

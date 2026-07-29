/**
 * AnalyticsQueue — Fila assíncrona para processamento de eventos do analytics.
 * 
 * Arquitetura:
 * - Eventos chegam via POST /api/analytics/track ou /batch
 * - São colocados numa fila em memória (circular buffer)
 * - Um worker drena a fila a cada 2s em lotes de até 100 eventos
 * - Garante que o Analytics nunca impacte a latência da API principal
 */

import type { InsertAnalyticsEvent, InsertAnalyticsSession, InsertAnalyticsVisitor } from "../../drizzle/schema";

type QueuedEvent = InsertAnalyticsEvent;

interface QueueStats {
  processed: number;
  dropped: number;
  inQueue: number;
  lastDrainAt: Date | null;
}

const MAX_QUEUE_SIZE = 10_000;
const DRAIN_INTERVAL_MS = 2_000;
const BATCH_SIZE = 100;

class AnalyticsQueue {
  private queue: QueuedEvent[] = [];
  private stats: QueueStats = {
    processed: 0,
    dropped: 0,
    inQueue: 0,
    lastDrainAt: null,
  };
  private drainTimer: NodeJS.Timeout | null = null;
  private isRunning = false;

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.drainTimer = setInterval(() => this.drain(), DRAIN_INTERVAL_MS);
    console.log("[AnalyticsQueue] Worker iniciado. Intervalo:", DRAIN_INTERVAL_MS, "ms");
  }

  stop() {
    if (this.drainTimer) {
      clearInterval(this.drainTimer);
      this.drainTimer = null;
    }
    this.isRunning = false;
  }

  push(event: QueuedEvent): boolean {
    if (this.queue.length >= MAX_QUEUE_SIZE) {
      this.stats.dropped++;
      console.warn("[AnalyticsQueue] Fila cheia! Evento descartado. Total descartados:", this.stats.dropped);
      return false;
    }
    this.queue.push(event);
    this.stats.inQueue = this.queue.length;
    return true;
  }

  pushMany(events: QueuedEvent[]): number {
    let pushed = 0;
    for (const event of events) {
      if (this.push(event)) pushed++;
    }
    return pushed;
  }

  private async drain() {
    if (this.queue.length === 0) return;

    const batch = this.queue.splice(0, BATCH_SIZE);
    this.stats.inQueue = this.queue.length;

    try {
      const { getDb } = await import("../db");
      const { analyticsEvents } = await import("../../drizzle/schema");
      
      const db = await getDb();
      if (!db) {
        // Devolve os eventos à fila se o DB não estiver disponível
        this.queue.unshift(...batch);
        this.stats.inQueue = this.queue.length;
        return;
      }

      await db.insert(analyticsEvents).values(batch).onConflictDoNothing();
      
      this.stats.processed += batch.length;
      this.stats.lastDrainAt = new Date();
    } catch (err) {
      console.error("[AnalyticsQueue] Erro ao persistir lote:", err);
      // Devolve à fila para retry
      if (this.queue.length < MAX_QUEUE_SIZE - batch.length) {
        this.queue.unshift(...batch);
        this.stats.inQueue = this.queue.length;
      } else {
        this.stats.dropped += batch.length;
      }
    }
  }

  getStats(): QueueStats {
    return { ...this.stats, inQueue: this.queue.length };
  }
}

// Singleton global
export const analyticsQueue = new AnalyticsQueue();

// ── Helpers para upsert de sessões e visitantes ───────────────────────────────

export async function upsertAnalyticsVisitor(data: InsertAnalyticsVisitor) {
  try {
    const { getDb } = await import("../db");
    const { analyticsVisitors } = await import("../../drizzle/schema");
    const { sql } = await import("drizzle-orm");

    const db = await getDb();
    if (!db) return;

    await db.insert(analyticsVisitors)
      .values(data)
      .onConflictDoUpdate({
        target: analyticsVisitors.visitorId,
        set: {
          lastSeenAt: new Date(),
          totalSessions: sql`${analyticsVisitors.totalSessions} + 1`,
        },
      });
  } catch (err) {
    console.error("[AnalyticsQueue] Erro ao upsert visitante:", err);
  }
}

export async function upsertAnalyticsSession(data: InsertAnalyticsSession) {
  try {
    const { getDb } = await import("../db");
    const { analyticsSessions } = await import("../../drizzle/schema");

    const db = await getDb();
    if (!db) return;

    await db.insert(analyticsSessions)
      .values(data)
      .onConflictDoUpdate({
        target: analyticsSessions.sessionId,
        set: {
          endedAt: data.endedAt ?? undefined,
          durationSec: data.durationSec ?? undefined,
          pageCount: data.pageCount ?? 1,
          isBounce: data.isBounce ?? true,
        },
      });
  } catch (err) {
    console.error("[AnalyticsQueue] Erro ao upsert sessão:", err);
  }
}

export async function upsertOnlineUser(data: {
  sessionId: string;
  visitorId: string;
  userId?: number | null;
  userName?: string | null;
  pageUrl?: string | null;
  pageTitle?: string | null;
  country?: string | null;
  state?: string | null;
  city?: string | null;
  deviceType?: "desktop" | "tablet" | "mobile" | "tv" | "unknown" | null;
  browser?: string | null;
  os?: string | null;
  screenRes?: string | null;
  utmSource?: string | null;
  referrer?: string | null;
  ipMasked?: string | null;
}) {
  try {
    const { getDb } = await import("../db");
    const { analyticsOnline } = await import("../../drizzle/schema");
    const { sql } = await import("drizzle-orm");

    const db = await getDb();
    if (!db) return;

    await db.insert(analyticsOnline)
      .values({ ...data, lastPingAt: new Date(), enteredAt: new Date() })
      .onConflictDoUpdate({
        target: analyticsOnline.sessionId,
        set: {
          pageUrl: data.pageUrl,
          pageTitle: data.pageTitle,
          lastPingAt: sql`NOW()`,
        },
      });

    // Remove usuários offline (sem ping há mais de 2 minutos)
    await db.delete(analyticsOnline).where(
      sql`${analyticsOnline.lastPingAt} < NOW() - INTERVAL '2 minutes'`
    );
  } catch (err) {
    console.error("[AnalyticsQueue] Erro ao upsert online:", err);
  }
}

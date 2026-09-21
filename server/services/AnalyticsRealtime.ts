/**
 * AnalyticsRealtime — série temporal da aba Tempo Real (pura e testável).
 *
 * Os snapshots são gravados pelo serviço independente de Analytics
 * (analytics-service) a cada ~30s. Esta função normaliza a série para o
 * gráfico: ordena, limita à janela, garante buckets regulares (mesmo sem
 * snapshot no intervalo) e calcula o pico exibido no dashboard.
 */

export interface RealtimeSnapshotRow {
  capturedAt: Date | string;
  onlineCount: number | string;
  pageViews: number | string;
  sessionsStarted: number | string;
  eventsCount: number | string;
}

export interface RealtimePoint {
  ts: string;
  online: number;
  pageViews: number;
  sessions: number;
  events: number;
}

export interface RealtimeSeries {
  points: RealtimePoint[];
  peak: RealtimePoint | null;
}

export function buildRealtimeSeries(
  rows: RealtimeSnapshotRow[],
  options: { windowMs: number; bucketMs?: number; now?: Date }
): RealtimeSeries {
  const now = options.now ?? new Date();
  const windowMs = Math.max(options.windowMs, 60_000);
  const bucketMs = Math.max(options.bucketMs ?? 30_000, 1_000);
  const since = now.getTime() - windowMs;

  const parsed = rows
    .map((r) => ({
      t: new Date(r.capturedAt).getTime(),
      online: Number(r.onlineCount) || 0,
      pageViews: Number(r.pageViews) || 0,
      sessions: Number(r.sessionsStarted) || 0,
      events: Number(r.eventsCount) || 0,
    }))
    .filter((r) => Number.isFinite(r.t) && r.t >= since && r.t <= now.getTime() + 60_000)
    .sort((a, b) => a.t - b.t);

  // Agrupa por bucket (soma os valores, mantém o pico de online do bucket)
  const byBucket = new Map<number, RealtimePoint>();
  for (const r of parsed) {
    const bucket = Math.floor(r.t / bucketMs) * bucketMs;
    const existing = byBucket.get(bucket);
    if (existing) {
      existing.pageViews += r.pageViews;
      existing.sessions += r.sessions;
      existing.events += r.events;
      existing.online = Math.max(existing.online, r.online);
    } else {
      byBucket.set(bucket, {
        ts: new Date(bucket).toISOString(),
        online: r.online,
        pageViews: r.pageViews,
        sessions: r.sessions,
        events: r.events,
      });
    }
  }

  // Preenche lacunas entre o primeiro ponto e agora (linha contínua)
  const points: RealtimePoint[] = [];
  if (byBucket.size > 0) {
    const keys = Array.from(byBucket.keys()).sort((a, b) => a - b);
    const first = keys[0];
    const last = Math.max(keys[keys.length - 1], Math.floor(now.getTime() / bucketMs) * bucketMs);
    for (let t = first; t <= last; t += bucketMs) {
      const point = byBucket.get(t);
      const previous = points[points.length - 1];
      points.push(
        point ?? {
          ts: new Date(t).toISOString(),
          online: previous ? previous.online : 0,
          pageViews: 0,
          sessions: 0,
          events: 0,
        }
      );
    }
  }

  let peak: RealtimePoint | null = null;
  for (const p of points) {
    if (!peak) { peak = p; continue; }
    if (p.pageViews > peak.pageViews || (p.pageViews === peak.pageViews && p.online > peak.online)) {
      peak = p;
    }
  }

  return { points, peak };
}

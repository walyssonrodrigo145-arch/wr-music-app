/**
 * AnalyticsRealtime — série temporal da aba Tempo Real (pura e testável).
 *
 * Os snapshots são gravados pelo serviço independente de Analytics
 * (analytics-service) a cada ~30s. Esta função normaliza a série para o
 * gráfico: ordena, limita à janela, garante buckets regulares (mesmo sem
 * snapshot no intervalo) e calcula o pico exibido no dashboard.
 *
 * O gráfico exibe uma linha por PERFIL (admin, professor, aluno) — os demais
 * campos (pageViews/sessions/events) continuam disponíveis no ponto para
 * compatibilidade e telemetria.
 */

export interface RealtimeSnapshotRow {
  capturedAt: Date | string;
  onlineCount: number | string;
  pageViews: number | string;
  sessionsStarted: number | string;
  eventsCount: number | string;
  adminCount?: number | string;
  teacherCount?: number | string;
  studentCount?: number | string;
}

export interface RealtimePoint {
  ts: string;
  online: number;
  admin: number;
  teacher: number;
  student: number;
  pageViews: number;
  sessions: number;
  events: number;
}

export interface RealtimeSeries {
  points: RealtimePoint[];
  peak: RealtimePoint | null;
}

function toInt(value: unknown): number {
  return Math.max(0, Math.round(Number(value) || 0));
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
      online: toInt(r.onlineCount),
      admin: toInt(r.adminCount),
      teacher: toInt(r.teacherCount),
      student: toInt(r.studentCount),
      pageViews: toInt(r.pageViews),
      sessions: toInt(r.sessionsStarted),
      events: toInt(r.eventsCount),
    }))
    .filter((r) => Number.isFinite(r.t) && r.t >= since && r.t <= now.getTime() + 60_000)
    .sort((a, b) => a.t - b.t);

  // Agrupa por bucket: soma os acumulados (pageViews/sessions/events) e mantém
  // o maior valor instantâneo (online e perfis) do bucket.
  const byBucket = new Map<number, RealtimePoint>();
  for (const r of parsed) {
    const bucket = Math.floor(r.t / bucketMs) * bucketMs;
    const existing = byBucket.get(bucket);
    if (existing) {
      existing.pageViews += r.pageViews;
      existing.sessions += r.sessions;
      existing.events += r.events;
      existing.online = Math.max(existing.online, r.online);
      existing.admin = Math.max(existing.admin, r.admin);
      existing.teacher = Math.max(existing.teacher, r.teacher);
      existing.student = Math.max(existing.student, r.student);
    } else {
      byBucket.set(bucket, {
        ts: new Date(bucket).toISOString(),
        online: r.online,
        admin: r.admin,
        teacher: r.teacher,
        student: r.student,
        pageViews: r.pageViews,
        sessions: r.sessions,
        events: r.events,
      });
    }
  }

  // Preenche lacunas entre o primeiro ponto e agora (linha contínua), mantendo
  // o último valor conhecido de online/perfis.
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
          admin: previous ? previous.admin : 0,
          teacher: previous ? previous.teacher : 0,
          student: previous ? previous.student : 0,
          pageViews: 0,
          sessions: 0,
          events: 0,
        }
      );
    }
  }

  // Pico = maior total de online da janela (desempate por pageViews).
  let peak: RealtimePoint | null = null;
  for (const p of points) {
    if (!peak) { peak = p; continue; }
    if (p.online > peak.online || (p.online === peak.online && p.pageViews > peak.pageViews)) {
      peak = p;
    }
  }

  return { points, peak };
}

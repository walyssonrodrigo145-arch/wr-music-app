// ─── MusicPro Analytics Service ──────────────────────────────────────────────
// Coletor INDEPENDENTE do MusicPro: recebe eventos, grava no Postgres,
// mantém snapshots de tempo real e roda retenção/rollup.
// Roda em container próprio (analytics-compose.yml) — reiniciar o MusicPro
// NÃO derruba a coleta, e alterar este serviço NÃO reinicia o MusicPro.

import http from "node:http";
import postgres from "postgres";

// ── Config ───────────────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT || 3002);
const DATABASE_URL = process.env.DATABASE_URL || "";
const CORS_ORIGINS = (process.env.CORS_ORIGINS || "https://wrmusicpro.com.br,https://www.wrmusicpro.com.br,https://analytics.wrmusicpro.com.br,https://staging.wrmusicpro.com.br,http://localhost:5173,http://localhost:3000")
  .split(",").map((s) => s.trim()).filter(Boolean);
const MAX_QUEUE_SIZE = Number(process.env.MAX_QUEUE_SIZE || 10000);
const DRAIN_INTERVAL_MS = Number(process.env.DRAIN_INTERVAL_MS || 2000);
const BATCH_SIZE = Number(process.env.BATCH_SIZE || 100);
const SNAPSHOT_INTERVAL_MS = Number(process.env.SNAPSHOT_INTERVAL_MS || 30000);
const RATE_LIMIT_PER_MIN = Number(process.env.RATE_LIMIT_PER_MIN || 1200);
const RETENTION_EVENTS_DAYS = Number(process.env.RETENTION_EVENTS_DAYS || 90);
const RETENTION_HEATMAP_DAYS = Number(process.env.RETENTION_HEATMAP_DAYS || 30);
const RETENTION_SECURITY_DAYS = Number(process.env.RETENTION_SECURITY_DAYS || 180);
const RETENTION_SNAPSHOTS_HOURS = Number(process.env.RETENTION_SNAPSHOTS_HOURS || 48);

if (!DATABASE_URL) {
  console.error("[analytics] DATABASE_URL não configurada — encerrando.");
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { max: 10, idle_timeout: 20, connect_timeout: 10 });

// ── Estado ───────────────────────────────────────────────────────────────────
const queue = [];
const stats = { processed: 0, dropped: 0, lastDrainAt: null, startedAt: new Date() };

// ── Geo (ip-api) com cache — mesma estratégia do app, sem armazenar IP bruto ──
const geoCache = new Map();
const GEO_TTL_MS = 10 * 60 * 1000;

function maskIp(ip) {
  if (!ip || typeof ip !== "string") return null;
  const clean = ip.replace(/^::ffff:/, "");
  if (clean.includes(".")) {
    const parts = clean.split(".");
    if (parts.length === 4) return `${parts[0]}.${parts[1]}.*.*`;
  }
  return null;
}

async function resolveGeo(ip) {
  if (!ip) return { country: null, state: null, city: null };
  const cached = geoCache.get(ip);
  if (cached && Date.now() - cached.at < GEO_TTL_MS) return cached.geo;
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 1500);
    const res = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,regionName,city`, { signal: controller.signal });
    clearTimeout(t);
    const data = await res.json();
    const geo = data?.status === "success"
      ? { country: data.country || null, state: data.regionName || null, city: data.city || null }
      : { country: null, state: null, city: null };
    geoCache.set(ip, { at: Date.now(), geo });
    if (geoCache.size > 5000) geoCache.clear();
    return geo;
  } catch {
    return { country: null, state: null, city: null };
  }
}

function clientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  const raw = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(",")[0]?.trim()
    || req.headers["x-real-ip"]
    || req.socket?.remoteAddress
    || "";
  return String(raw);
}

// ── Schema do serviço (idempotente) ──────────────────────────────────────────
async function ensureSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS analytics_realtime_snapshots (
      id serial PRIMARY KEY,
      captured_at timestamp NOT NULL DEFAULT now(),
      online_count integer NOT NULL DEFAULT 0,
      page_views integer NOT NULL DEFAULT 0,
      sessions_started integer NOT NULL DEFAULT 0,
      events_count integer NOT NULL DEFAULT 0,
      admin_count integer NOT NULL DEFAULT 0,
      teacher_count integer NOT NULL DEFAULT 0,
      student_count integer NOT NULL DEFAULT 0
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS analytics_realtime_snapshots_captured_idx ON analytics_realtime_snapshots (captured_at)`;
  // Gráfico de tempo real por perfil (admin/professor/aluno) + perfil no "online agora"
  await sql`ALTER TABLE analytics_online ADD COLUMN IF NOT EXISTS user_role varchar(20)`;
  await sql`ALTER TABLE analytics_realtime_snapshots ADD COLUMN IF NOT EXISTS admin_count integer NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE analytics_realtime_snapshots ADD COLUMN IF NOT EXISTS teacher_count integer NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE analytics_realtime_snapshots ADD COLUMN IF NOT EXISTS student_count integer NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS organization_id integer`;
  // Compat de schema para o rollup (a tabela pode ter sido criada por migrações antigas)
  await sql`ALTER TABLE analytics_pages ADD COLUMN IF NOT EXISTS page_title varchar(255)`;
  await sql`ALTER TABLE analytics_pages ADD COLUMN IF NOT EXISTS unique_visitors integer DEFAULT 0 NOT NULL`;
  await sql`ALTER TABLE analytics_pages ADD COLUMN IF NOT EXISTS avg_time_on_page_sec integer DEFAULT 0 NOT NULL`;
  await sql`ALTER TABLE analytics_pages ADD COLUMN IF NOT EXISTS exits integer DEFAULT 0 NOT NULL`;
  await sql`ALTER TABLE analytics_pages ADD COLUMN IF NOT EXISTS conversions integer DEFAULT 0 NOT NULL`;
  await sql`ALTER TABLE analytics_pages ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now() NOT NULL`;
  console.log("[analytics] schema verificado");
}

// ── Fila de eventos ──────────────────────────────────────────────────────────
function pushEvent(event) {
  if (queue.length >= MAX_QUEUE_SIZE) {
    stats.dropped++;
    if (stats.dropped % 100 === 1) console.warn("[analytics] fila cheia — descartados:", stats.dropped);
    return false;
  }
  queue.push(event);
  return true;
}

// Eventos aceitos (espelha o enum analytics_event_name do banco).
// Um nome inválido derrubaria o lote inteiro no Postgres e travaria a fila —
// por isso é filtrado na entrada (evita "poison batch").
const VALID_EVENT_NAMES = new Set([
  "page_view", "session_start", "session_end", "button_click", "link_click",
  "signup_started", "signup_completed", "trial_started", "trial_finished",
  "login", "logout", "plan_selected", "checkout_started", "pix_generated",
  "payment_success", "payment_failed", "subscription_created", "subscription_cancelled",
  "email_open", "email_click", "whatsapp_click", "video_play", "video_finish",
  "download", "upload", "form_submit", "search", "feature_used", "error", "api_error",
  "scroll_depth", "heatmap_click", "heatmap_move", "web_vital",
]);

const clamp = (v, max) => (v == null ? null : String(v).slice(0, max));

function normalizeEvent(e, geo) {
  return {
    session_id: clamp(e.sessionId, 64),
    visitor_id: clamp(e.visitorId, 64),
    user_id: e.userId ?? null,
    event_name: e.eventName,
    page_url: clamp(e.pageUrl, 2000),
    page_title: clamp(e.pageTitle, 255),
    referrer: clamp(e.referrer, 2000),
    element_id: clamp(e.elementId, 100),
    element_text: clamp(e.elementText, 255),
    element_tag: clamp(e.elementTag, 30),
    utm_source: clamp(e.utmSource, 100),
    utm_medium: clamp(e.utmMedium, 100),
    utm_campaign: clamp(e.utmCampaign, 100),
    utm_content: clamp(e.utmContent, 100),
    utm_term: clamp(e.utmTerm, 100),
    country: clamp(e.country || geo.country, 100),
    state: clamp(e.state || geo.state, 100),
    city: clamp(e.city || geo.city, 100),
    device_type: ["desktop", "tablet", "mobile", "tv", "unknown"].includes(e.deviceType) ? e.deviceType : "unknown",
    os: clamp(e.os, 80),
    browser: clamp(e.browser, 80),
    screen_res: clamp(e.screenRes, 20),
    value: e.value ?? null,
    metadata: e.metadata ?? null,
    time_on_page_sec: Number.isFinite(Number(e.timeOnPageSec)) ? Number(e.timeOnPageSec) : null,
    scroll_depth: Number.isFinite(Number(e.scrollDepth)) ? Number(e.scrollDepth) : null,
    created_at: new Date(),
  };
}

const EVENT_COLUMNS = [
  "session_id", "visitor_id", "user_id", "event_name", "page_url", "page_title", "referrer",
  "element_id", "element_text", "element_tag",
  "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term",
  "country", "state", "city", "device_type", "os", "browser", "screen_res",
  "value", "metadata", "time_on_page_sec", "scroll_depth", "created_at",
];

async function upsertVisitor(v) {
  if (!v?.visitorId) return;
  await sql`
    INSERT INTO analytics_visitors (visitor_id, country, state, city, device_type, first_seen_at, last_seen_at, total_sessions)
    VALUES (${clamp(v.visitorId, 64)}, ${clamp(v.country, 100)}, ${clamp(v.state, 100)}, ${clamp(v.city, 100)}, ${["desktop", "tablet", "mobile", "tv", "unknown"].includes(v.deviceType) ? v.deviceType : "unknown"}, now(), now(), 0)
    ON CONFLICT (visitor_id) DO UPDATE SET
      last_seen_at = now(),
      country = COALESCE(analytics_visitors.country, excluded.country),
      state = COALESCE(analytics_visitors.state, excluded.state),
      city = COALESCE(analytics_visitors.city, excluded.city)
  `;
}

async function upsertSession(s) {
  if (!s?.sessionId) return;
  await sql`
    INSERT INTO analytics_sessions (
      session_id, visitor_id, user_id, ip_masked, country, state, city, language, timezone,
      device_type, os, browser, screen_res, user_agent, referrer,
      utm_source, utm_medium, utm_campaign, utm_content, utm_term,
      started_at, ended_at, duration_sec, page_count, is_bounce
    ) VALUES (
      ${clamp(s.sessionId, 64)}, ${clamp(s.visitorId, 64)}, ${s.userId ?? null}, ${clamp(s.ipMasked, 20)}, ${clamp(s.country, 100)}, ${clamp(s.state, 100)}, ${clamp(s.city, 100)},
      ${clamp(s.language, 20)}, ${clamp(s.timezone, 60)}, ${["desktop", "tablet", "mobile", "tv", "unknown"].includes(s.deviceType) ? s.deviceType : "unknown"}, ${clamp(s.os, 80)}, ${clamp(s.browser, 80)}, ${clamp(s.screenRes, 20)},
      ${clamp(s.userAgent, 500)}, ${clamp(s.referrer, 2000)}, ${clamp(s.utmSource, 100)}, ${clamp(s.utmMedium, 100)}, ${clamp(s.utmCampaign, 100)},
      ${clamp(s.utmContent, 100)}, ${clamp(s.utmTerm, 100)}, now(), ${s.endedAt ?? null}, ${s.durationSec ?? null}, ${s.pageCount ?? 1}, ${s.isBounce ?? true}
    )
    ON CONFLICT (session_id) DO UPDATE SET
      ended_at = COALESCE(excluded.ended_at, analytics_sessions.ended_at),
      duration_sec = COALESCE(excluded.duration_sec, analytics_sessions.duration_sec),
      page_count = GREATEST(analytics_sessions.page_count, excluded.page_count),
      is_bounce = CASE WHEN excluded.page_count > 1 OR excluded.ended_at IS NOT NULL THEN false ELSE analytics_sessions.is_bounce END,
      user_id = COALESCE(excluded.user_id, analytics_sessions.user_id)
  `;
}

// Perfis aceitos no gráfico de tempo real (null = visitante/deslogado)
const VALID_ROLES = new Set(["admin", "professor", "aluno"]);
const normalizeRole = (role) => (VALID_ROLES.has(role) ? role : null);

async function upsertOnline(o) {
  if (!o?.sessionId) return;
  await sql`
    INSERT INTO analytics_online (session_id, visitor_id, user_id, user_name, user_role, page_url, page_title, country, state, city, device_type, browser, os, screen_res, utm_source, referrer, ip_masked, entered_at, last_ping_at)
    VALUES (${clamp(o.sessionId, 64)}, ${clamp(o.visitorId, 64)}, ${o.userId ?? null}, ${clamp(o.userName, 255)}, ${normalizeRole(o.userRole)}, ${clamp(o.pageUrl, 2000)}, ${clamp(o.pageTitle, 255)},
            ${clamp(o.country, 100)}, ${clamp(o.state, 100)}, ${clamp(o.city, 100)}, ${["desktop", "tablet", "mobile", "tv", "unknown"].includes(o.deviceType) ? o.deviceType : "unknown"}, ${clamp(o.browser, 80)}, ${clamp(o.os, 80)},
            ${clamp(o.screenRes, 20)}, ${clamp(o.utmSource, 100)}, ${clamp(o.referrer, 2000)}, ${clamp(o.ipMasked, 20)}, now(), now())
    ON CONFLICT (session_id) DO UPDATE SET
      user_id = excluded.user_id,
      user_name = COALESCE(excluded.user_name, analytics_online.user_name),
      user_role = COALESCE(excluded.user_role, analytics_online.user_role),
      page_url = excluded.page_url,
      page_title = excluded.page_title,
      last_ping_at = now()
  `;
}

async function drain() {
  if (queue.length === 0) return;
  const batch = queue.splice(0, BATCH_SIZE);

  try {
    const rows = batch.map((e) => e.__normalized);
    await sql`INSERT INTO analytics_events ${sql(rows, ...EVENT_COLUMNS)}`;

    const seenVisitors = new Set();
    const seenSessions = new Map();
    for (const raw of batch) {
      if (raw.visitorId) seenVisitors.add(raw.visitorId);
      if (raw.sessionId && !seenSessions.has(raw.sessionId)) {
        seenSessions.set(raw.sessionId, {
          sessionId: raw.sessionId,
          visitorId: raw.visitorId,
          userId: raw.userId ?? null,
          deviceType: raw.deviceType || "unknown",
          os: raw.os,
          browser: raw.browser,
          screenRes: raw.screenRes,
          referrer: raw.referrer,
          utmSource: raw.utmSource,
          utmMedium: raw.utmMedium,
          utmCampaign: raw.utmCampaign,
          utmContent: raw.utmContent,
          utmTerm: raw.utmTerm,
          country: raw.country,
          state: raw.state,
          city: raw.city,
        });
      }
    }
    for (const v of seenVisitors) await upsertVisitor({ visitorId: v });
    for (const s of seenSessions.values()) await upsertSession(s);

    stats.processed += batch.length;
    stats.lastDrainAt = new Date();
  } catch (err) {
    console.error("[analytics] erro ao persistir lote:", err.message);
    if (queue.length < MAX_QUEUE_SIZE - batch.length) queue.unshift(...batch);
    else stats.dropped += batch.length;
  }
}

// ── Snapshots de tempo real ──────────────────────────────────────────────────
async function captureSnapshot() {
  try {
    await sql`
      INSERT INTO analytics_realtime_snapshots (captured_at, online_count, page_views, sessions_started, events_count, admin_count, teacher_count, student_count)
      VALUES (
        now(),
        (SELECT COUNT(*)::int FROM analytics_online WHERE last_ping_at > now() - interval '2 minutes'),
        (SELECT COUNT(*)::int FROM analytics_events WHERE event_name = 'page_view' AND created_at > now() - interval '30 seconds'),
        (SELECT COUNT(*)::int FROM analytics_sessions WHERE started_at > now() - interval '30 seconds'),
        (SELECT COUNT(*)::int FROM analytics_events WHERE created_at > now() - interval '30 seconds'),
        (SELECT COUNT(*) FILTER (WHERE user_role = 'admin')::int FROM analytics_online WHERE last_ping_at > now() - interval '2 minutes'),
        (SELECT COUNT(*) FILTER (WHERE user_role = 'professor')::int FROM analytics_online WHERE last_ping_at > now() - interval '2 minutes'),
        (SELECT COUNT(*) FILTER (WHERE user_role = 'aluno')::int FROM analytics_online WHERE last_ping_at > now() - interval '2 minutes')
      )
    `;
  } catch (err) {
    console.error("[analytics] snapshot falhou:", err.message);
  }
}

// ── Retenção + rollup diário ─────────────────────────────────────────────────
let lastRetentionRun = 0;
async function runRetention() {
  if (Date.now() - lastRetentionRun < 24 * 60 * 60 * 1000) return;
  lastRetentionRun = Date.now();
  try {
    const ev = await sql`DELETE FROM analytics_events WHERE created_at < now() - ${`${RETENTION_EVENTS_DAYS} days`}::interval`;
    const hm = await sql`DELETE FROM analytics_heatmap WHERE created_at < now() - ${`${RETENTION_HEATMAP_DAYS} days`}::interval`;
    const sec = await sql`DELETE FROM analytics_security_logs WHERE created_at < now() - ${`${RETENTION_SECURITY_DAYS} days`}::interval`;
    const snap = await sql`DELETE FROM analytics_realtime_snapshots WHERE captured_at < now() - ${`${RETENTION_SNAPSHOTS_HOURS} hours`}::interval`;

    // Rollup do dia anterior (idempotente: apaga e regrava)
    await sql`DELETE FROM analytics_pages WHERE date = ((now() AT TIME ZONE 'America/Sao_Paulo')::date - 1)`;
    await sql`
      INSERT INTO analytics_pages (page_url_normalized, page_title, date, total_views, unique_visitors, avg_time_on_page_sec, bounces, exits, conversions, created_at, updated_at)
      SELECT
        LEFT(COALESCE(NULLIF(split_part(COALESCE(page_url, ''), '?', 1), ''), '/'), 255),
        MAX(page_title),
        ((created_at AT TIME ZONE 'America/Sao_Paulo')::date - 1),
        COUNT(*) FILTER (WHERE event_name = 'page_view'),
        COUNT(DISTINCT visitor_id) FILTER (WHERE event_name = 'page_view'),
        COALESCE(AVG(time_on_page_sec) FILTER (WHERE event_name = 'page_view'), 0)::int,
        0, 0, 0, now(), now()
      FROM analytics_events
      WHERE created_at >= date_trunc('day', now() - interval '1 day')
        AND created_at < date_trunc('day', now())
      GROUP BY 1, 3
    `;

    console.log(`[analytics] retenção: events=${ev.count} heatmap=${hm.count} security=${sec.count} snapshots=${snap.count}`);
  } catch (err) {
    console.error("[analytics] retenção falhou:", err.message);
  }
}

// ── HTTP helpers ─────────────────────────────────────────────────────────────
function setCors(req, res) {
  const origin = req.headers.origin;
  if (origin && CORS_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400");
}

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > 1_500_000) { reject(new Error("payload muito grande")); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => {
      if (chunks.length === 0) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); }
      catch { reject(new Error("JSON inválido")); }
    });
    req.on("error", reject);
  });
}

// ── Rate limit por IP (janela de 1 min) ──────────────────────────────────────
const rateBuckets = new Map();
function isRateLimited(ip) {
  const now = Date.now();
  const bucket = rateBuckets.get(ip);
  if (!bucket || now - bucket.start > 60_000) {
    rateBuckets.set(ip, { start: now, count: 1 });
    if (rateBuckets.size > 10000) rateBuckets.clear();
    return false;
  }
  bucket.count++;
  return bucket.count > RATE_LIMIT_PER_MIN;
}

// ── Rotas ────────────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  setCors(req, res);

  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const path = url.pathname;
  const ip = clientIp(req);

  if (req.method === "GET" && (path === "/health" || path === "/ingest/health")) {
    return json(res, 200, {
      status: "ok",
      queue: queue.length,
      processed: stats.processed,
      dropped: stats.dropped,
      lastDrainAt: stats.lastDrainAt,
      uptimeSec: Math.round((Date.now() - stats.startedAt.getTime()) / 1000),
    });
  }

  if (req.method !== "POST" || !path.startsWith("/ingest/")) {
    return json(res, 404, { ok: false, error: "not found" });
  }

  if (isRateLimited(ip)) return json(res, 429, { ok: false, error: "rate limited" });

  let body;
  try { body = await readBody(req); }
  catch (e) { return json(res, 400, { ok: false, error: e.message }); }

  try {
    switch (path) {
      case "/ingest/track": {
        if (!VALID_EVENT_NAMES.has(body?.eventName)) return json(res, 400, { ok: false, error: "evento inválido" });
        const geo = await resolveGeo(ip);
        pushEvent({ ...body, __normalized: normalizeEvent(body, geo) });
        return json(res, 200, { ok: true });
      }

      case "/ingest/events": {
        const incoming = Array.isArray(body?.events) ? body.events.slice(0, 50) : [];
        const geo = await resolveGeo(ip);
        let pushed = 0;
        let invalid = 0;
        const ended = new Set();
        for (const e of incoming) {
          if (!VALID_EVENT_NAMES.has(e?.eventName) || !e?.sessionId || !e?.visitorId) { invalid++; continue; }
          if (pushEvent({ ...e, __normalized: normalizeEvent(e, geo) })) pushed++;
          if (e.eventName === "session_end" && e.sessionId) ended.add(e.sessionId);
        }
        if (ended.size > 0) {
          for (const sid of ended) {
            sql`DELETE FROM analytics_online WHERE session_id = ${String(sid).slice(0, 64)}`.catch(() => {});
          }
        }
        return json(res, 200, { ok: true, pushed, invalid });
      }

      case "/ingest/session": {
        const geo = await resolveGeo(ip);
        const session = body?.session || {};
        const visitorId = body?.visitor?.visitorId || session.visitorId;
        const country = session.country || geo.country;
        const state = session.state || geo.state;
        const city = session.city || geo.city;

        upsertVisitor({ visitorId, country, state, city, deviceType: session.deviceType ?? "unknown" }).catch((e) => console.error("[analytics] visitor:", e.message));
        upsertSession({
          sessionId: session.sessionId,
          visitorId: session.visitorId,
          userId: session.userId,
          ipMasked: session.ipMasked ?? maskIp(ip),
          country, state, city,
          language: session.language,
          timezone: session.timezone,
          deviceType: session.deviceType ?? "unknown",
          os: session.os,
          browser: session.browser,
          screenRes: session.screenRes,
          userAgent: session.userAgent,
          referrer: session.referrer,
          utmSource: session.utmSource,
          utmMedium: session.utmMedium,
          utmCampaign: session.utmCampaign,
          utmContent: session.utmContent,
          utmTerm: session.utmTerm,
        }).catch((e) => console.error("[analytics] session:", e.message));
        return json(res, 200, { ok: true });
      }

      case "/ingest/heartbeat": {
        const geo = await resolveGeo(ip);
        await upsertOnline({
          ...body,
          ipMasked: body?.ipMasked ?? maskIp(ip),
          country: body?.country || geo.country,
          state: body?.state || geo.state,
          city: body?.city || geo.city,
        });
        await sql`DELETE FROM analytics_online WHERE last_ping_at < now() - interval '2 minutes'`;
        return json(res, 200, { ok: true });
      }

      case "/ingest/heatmap": {
        const points = Array.isArray(body?.points) ? body.points.slice(0, 100) : [];
        if (points.length === 0) return json(res, 200, { ok: true });
        const pageUrl = String(body.pageUrl || "");
        const pageUrlNormalized = (() => {
          try { return new URL(pageUrl, "https://wrmusicpro.com.br").pathname; }
          catch { return pageUrl.split("?")[0] || "/"; }
        })();
        const rows = points.map((p) => ({
          session_id: clamp(body.sessionId || "unknown", 64),
          page_url: clamp(pageUrl, 2000),
          page_url_normalized: clamp(pageUrlNormalized, 255),
          x_percent: String(Math.max(0, Math.min(100, Number(p.xPercent) || 0))),
          y_percent: String(Math.max(0, Math.min(100, Number(p.yPercent) || 0))),
          event_type: ["click", "move", "scroll"].includes(p.eventType) ? p.eventType : "click",
          viewport_w: p.viewportW ?? null,
          viewport_h: p.viewportH ?? null,
          created_at: new Date(),
        }));
        await sql`INSERT INTO analytics_heatmap ${sql(rows, "session_id", "page_url", "page_url_normalized", "x_percent", "y_percent", "event_type", "viewport_w", "viewport_h", "created_at")}`;
        return json(res, 200, { ok: true });
      }

      default:
        return json(res, 404, { ok: false, error: "rota de ingestão desconhecida" });
    }
  } catch (err) {
    console.error("[analytics] erro no endpoint", path, err.message);
    return json(res, 500, { ok: false, error: "erro interno" });
  }
});

// ── Bootstrap + workers ──────────────────────────────────────────────────────
await ensureSchema();
setInterval(() => { drain().catch(() => {}); }, DRAIN_INTERVAL_MS);
setInterval(() => { captureSnapshot().catch(() => {}); }, SNAPSHOT_INTERVAL_MS);
setInterval(() => { runRetention().catch(() => {}); }, 60 * 60 * 1000);
setTimeout(() => { runRetention().catch(() => {}); }, 5 * 60 * 1000);
setTimeout(() => { captureSnapshot().catch(() => {}); }, 5_000);

server.listen(PORT, () => {
  console.log(`[analytics] serviço no ar na porta ${PORT} — fila=${MAX_QUEUE_SIZE} snapshot=${SNAPSHOT_INTERVAL_MS}ms`);
});

async function shutdown() {
  console.log("[analytics] encerrando...");
  try { await drain(); } catch {}
  try { await sql.end({ timeout: 5 }); } catch {}
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 8000);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

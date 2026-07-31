import { sql } from "drizzle-orm";
import { getDb } from "../db";

export async function runAutoMigrations() {
  console.log("[Database] Verificando migrações automáticas...");
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Banco de dados não disponível para migração.");
    return { success: false, error: "Database not available" };
  }

  const results: string[] = [];
  try {
    // Adicionar colunas uma por uma, ignorando se já existirem
    const migrations = [
      { table: 'organizations', sql: 'ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "planId" varchar(50) DEFAULT \'premium\' NOT NULL' },
      { table: 'users', sql: 'ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "isEmailVerified" boolean DEFAULT false NOT NULL' },
      { table: 'users', sql: 'ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "verificationToken" text' },
      { table: 'users', sql: 'ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "verificationTokenExpiresAt" timestamp' },
      { table: 'users', sql: 'ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "resetPasswordToken" text' },
      { table: 'users', sql: 'ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "resetPasswordTokenExpiresAt" timestamp' },
      { table: 'users', sql: 'ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "organizationId" integer' },
      { table: 'users', sql: 'ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "hasSeenTutorial" boolean DEFAULT false NOT NULL' },
      { table: 'professores', sql: 'ALTER TABLE "professores" ADD COLUMN IF NOT EXISTS "permissions" jsonb DEFAULT \'["aulas", "progresso", "recepcao", "ia", "lembretes", "relatorios"]\'::jsonb' },
      { table: 'lessons', sql: 'ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "rating" integer' },
      { table: 'lessons', sql: 'ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "instrumentId" integer' },
      { table: 'lessons', sql: 'ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "recurringGroupId" varchar(100)' },
      { table: 'lessons', sql: 'ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "isExperimental" boolean DEFAULT false NOT NULL' },
      { table: 'lessons', sql: 'ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "experimentalName" varchar(255)' },
      { table: 'lessons', sql: 'ALTER TABLE "lessons" ALTER COLUMN "studentId" DROP NOT NULL' },
      { table: 'students', sql: 'ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "instrumentId" integer' },
      { table: 'student_timeline', sql: 'ALTER TABLE "student_timeline" ADD COLUMN IF NOT EXISTS "grade" decimal(3, 1)' },
      { table: 'enum', sql: "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'goal_status') THEN CREATE TYPE goal_status AS ENUM ('pendente', 'concluida'); END IF; END $$;" },
      { table: 'enum', sql: "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'timeline_category') THEN CREATE TYPE timeline_category AS ENUM ('tecnica', 'teoria', 'repertorio', 'geral'); END IF; END $$;" },
      { table: 'student_goals', sql: `
        CREATE TABLE IF NOT EXISTS "student_goals" (
          "id" serial PRIMARY KEY NOT NULL,
          "userId" integer NOT NULL,
          "studentId" integer NOT NULL,
          "title" varchar(255) NOT NULL,
          "description" text,
          "status" goal_status DEFAULT 'pendente' NOT NULL,
          "targetDate" date,
          "completedAt" timestamp,
          "createdAt" timestamp DEFAULT now() NOT NULL,
          "updatedAt" timestamp DEFAULT now() NOT NULL
        );` 
      },
      { table: 'student_timeline', sql: `
        CREATE TABLE IF NOT EXISTS "student_timeline" (
          "id" serial PRIMARY KEY NOT NULL,
          "userId" integer NOT NULL,
          "studentId" integer NOT NULL,
          "title" varchar(255) NOT NULL,
          "description" text,
          "category" timeline_category DEFAULT 'geral' NOT NULL,
          "grade" decimal(3, 1),
          "achievedAt" timestamp NOT NULL,
          "createdAt" timestamp DEFAULT now() NOT NULL
        );`
      },
      { table: 'crm_leads', sql: `
        CREATE TABLE IF NOT EXISTS "crm_leads" (
          "id" serial PRIMARY KEY NOT NULL,
          "organization_id" integer NOT NULL,
          "name" text NOT NULL,
          "phone" text,
          "email" text,
          "instrument" text,
          "stage" text DEFAULT 'novo' NOT NULL,
          "value" numeric(10, 2) DEFAULT '0.00',
          "notes" text,
          "source" text DEFAULT 'WhatsApp',
          "created_at" timestamp DEFAULT now() NOT NULL,
          "updated_at" timestamp DEFAULT now() NOT NULL
        );`
      },
      { table: 'enum', sql: "ALTER TYPE lesson_status ADD VALUE IF NOT EXISTS 'concluida'" },
      { table: 'enum', sql: "ALTER TYPE lesson_status ADD VALUE IF NOT EXISTS 'cancelada'" },
      { table: 'enum', sql: "ALTER TYPE lesson_status ADD VALUE IF NOT EXISTS 'remarcada'" },
      { table: 'enum', sql: "ALTER TYPE lesson_status ADD VALUE IF NOT EXISTS 'falta'" },
      { table: 'settings', sql: 'ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "notifyLessonReminder" integer DEFAULT 1 NOT NULL' },
      { table: 'settings', sql: 'ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "notifyPaymentDue" integer DEFAULT 1 NOT NULL' },
      { table: 'settings', sql: 'ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "notifyStudentAbsence" integer DEFAULT 1 NOT NULL' },
      { table: 'settings', sql: 'ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "notifyNewStudent" integer DEFAULT 1 NOT NULL' },
      { table: 'settings', sql: 'ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "notifyWeeklyReport" integer DEFAULT 0 NOT NULL' },
      { table: 'settings', sql: 'ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "automationEnabled" integer DEFAULT 0 NOT NULL' },
      { table: 'settings', sql: 'ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "automationLastRun" timestamp' },
      { table: 'settings', sql: 'ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "theme" varchar(20) DEFAULT \'light\'' },
      { table: 'settings', sql: 'ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "pixKey" text' },
      { table: 'settings', sql: 'ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "hiddenTabs" text DEFAULT \'\' NOT NULL' },
      { table: 'settings', sql: 'ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "whatsappBotUrl" varchar(255)' },
      { table: 'settings', sql: 'ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "whatsappBotToken" text' },
      { table: 'settings', sql: 'ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "whatsappAutoSend" integer DEFAULT 0 NOT NULL' },
      { table: 'settings', sql: 'ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "asaasApiKey" text' },
      { table: 'settings', sql: 'ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "asaasEnabled" integer DEFAULT 0 NOT NULL' },
      { table: 'settings', sql: 'ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "geminiApiKey" varchar(255)' },
      { table: 'settings', sql: 'ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "geminiModel" varchar(255)' },
      { table: 'settings', sql: 'ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "zapsignApiKey" text' },
      { table: 'daily_study_plans', sql: `
        CREATE TABLE IF NOT EXISTS "daily_study_plans" (
          "id" serial PRIMARY KEY NOT NULL,
          "organizationId" integer,
          "studentId" integer NOT NULL,
          "teacherId" integer NOT NULL,
          "planText" text NOT NULL,
          "status" varchar(50) DEFAULT 'ativo' NOT NULL,
          "daysCompleted" text DEFAULT '[false,false,false,false,false]' NOT NULL,
          "createdAt" timestamp DEFAULT now() NOT NULL,
          "updatedAt" timestamp DEFAULT now() NOT NULL,
          "completedAt" timestamp
        );`
      },
      { table: 'daily_study_plans', sql: 'ALTER TABLE "daily_study_plans" ADD COLUMN IF NOT EXISTS "updatedAt" timestamp DEFAULT now() NOT NULL' },
      { table: 'notifications', sql: `
        CREATE TABLE IF NOT EXISTS "notifications" (
          "id" serial PRIMARY KEY NOT NULL,
          "organizationId" integer,
          "userId" integer NOT NULL,
          "title" varchar(255) NOT NULL,
          "message" text NOT NULL,
          "type" varchar(50) DEFAULT 'info' NOT NULL,
          "read" boolean DEFAULT false NOT NULL,
          "actionUrl" text,
          "createdAt" timestamp DEFAULT now() NOT NULL
        );`
      },
      { table: 'attendance_tokens', sql: `
        CREATE TABLE IF NOT EXISTS "attendance_tokens" (
          "id" serial PRIMARY KEY NOT NULL,
          "organizationId" integer,
          "token" varchar(64) NOT NULL UNIQUE,
          "expiresAt" timestamp NOT NULL,
          "createdAt" timestamp DEFAULT now() NOT NULL
        );`
      },
      { table: 'attendance_logs', sql: `
        CREATE TABLE IF NOT EXISTS "attendance_logs" (
          "id" serial PRIMARY KEY NOT NULL,
          "organizationId" integer,
          "userId" integer NOT NULL,
          "lessonId" integer,
          "tokenId" integer,
          "scannedAt" timestamp DEFAULT now() NOT NULL
        );`
      },
      { table: 'message_automation_rules', sql: `
        CREATE TABLE IF NOT EXISTS "message_automation_rules" (
          "id" serial PRIMARY KEY NOT NULL,
          "organizationId" integer,
          "userId" integer NOT NULL,
          "name" varchar(255) NOT NULL,
          "description" text,
          "isSystem" integer DEFAULT 0 NOT NULL,
          "isActive" integer DEFAULT 1 NOT NULL,
          "trigger" varchar(100) NOT NULL,
          "offsetDays" integer DEFAULT 0 NOT NULL,
          "offsetHours" integer DEFAULT 0 NOT NULL,
          "conditions" text,
          "actions" text,
          "messageTemplate" text NOT NULL,
          "channel" varchar(50) DEFAULT 'whatsapp' NOT NULL,
          "totalSent" integer DEFAULT 0 NOT NULL,
          "lastExecutedAt" timestamp,
          "createdAt" timestamp DEFAULT now() NOT NULL,
          "updatedAt" timestamp DEFAULT now() NOT NULL
        );`
      },
      // Modalidade Online — expande enum e adiciona coluna de link
      { table: 'enum', sql: "ALTER TYPE lesson_type ADD VALUE IF NOT EXISTS 'online'" },
      { table: 'students', sql: 'ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "onlineMeetingLink" text' },
      { table: 'marketing_campaigns', sql: 'ALTER TABLE "marketing_campaigns" ADD COLUMN IF NOT EXISTS "mediaUrl" text' },

      // ── MusicPro Analytics — Tabelas de Ingestão e Métricas ─────────────────────
      { table: 'enum', sql: "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'analytics_event_name') THEN CREATE TYPE analytics_event_name AS ENUM ('page_view', 'session_start', 'session_end', 'button_click', 'link_click', 'signup_started', 'signup_completed', 'trial_started', 'trial_finished', 'login', 'logout', 'plan_selected', 'checkout_started', 'pix_generated', 'payment_success', 'payment_failed', 'subscription_created', 'subscription_cancelled', 'email_open', 'email_click', 'whatsapp_click', 'video_play', 'video_finish', 'download', 'upload', 'form_submit', 'search', 'feature_used', 'error', 'api_error', 'scroll_depth', 'heatmap_click', 'heatmap_move', 'web_vital'); END IF; END $$;" },
      { table: 'analytics_visitors', sql: `CREATE TABLE IF NOT EXISTS "analytics_visitors" ("id" serial PRIMARY KEY NOT NULL, "visitor_id" varchar(64) NOT NULL UNIQUE, "first_seen_at" timestamp DEFAULT now() NOT NULL, "last_seen_at" timestamp DEFAULT now() NOT NULL, "total_sessions" integer DEFAULT 1 NOT NULL, "country" varchar(100), "state" varchar(100), "city" varchar(100), "device_type" varchar(20) DEFAULT 'unknown' NOT NULL, "created_at" timestamp DEFAULT now() NOT NULL, "updated_at" timestamp DEFAULT now() NOT NULL);` },
      { table: 'analytics_sessions', sql: `CREATE TABLE IF NOT EXISTS "analytics_sessions" ("id" serial PRIMARY KEY NOT NULL, "session_id" varchar(64) NOT NULL UNIQUE, "visitor_id" varchar(64) NOT NULL, "user_id" integer, "ip_masked" varchar(20), "country" varchar(100), "state" varchar(100), "city" varchar(100), "language" varchar(20), "timezone" varchar(60), "device_type" varchar(20) DEFAULT 'unknown' NOT NULL, "os" varchar(80), "browser" varchar(80), "screen_res" varchar(20), "user_agent" varchar(500), "referrer" varchar(2000), "utm_source" varchar(100), "utm_medium" varchar(100), "utm_campaign" varchar(100), "utm_content" varchar(100), "utm_term" varchar(100), "started_at" timestamp DEFAULT now() NOT NULL, "ended_at" timestamp, "duration_sec" integer DEFAULT 0, "page_count" integer DEFAULT 1 NOT NULL, "is_bounce" boolean DEFAULT true NOT NULL, "created_at" timestamp DEFAULT now() NOT NULL, "updated_at" timestamp DEFAULT now() NOT NULL);` },
      { table: 'analytics_events', sql: `CREATE TABLE IF NOT EXISTS "analytics_events" ("id" serial PRIMARY KEY NOT NULL, "session_id" varchar(64) NOT NULL, "visitor_id" varchar(64) NOT NULL, "user_id" integer, "event_name" analytics_event_name NOT NULL, "page_url" varchar(2000), "page_title" varchar(255), "referrer" varchar(2000), "element_id" varchar(100), "element_text" varchar(255), "element_tag" varchar(30), "utm_source" varchar(100), "utm_medium" varchar(100), "utm_campaign" varchar(100), "utm_content" varchar(100), "utm_term" varchar(100), "country" varchar(100), "state" varchar(100), "city" varchar(100), "device_type" varchar(20) DEFAULT 'unknown' NOT NULL, "os" varchar(80), "browser" varchar(80), "screen_res" varchar(20), "value" text, "metadata" jsonb, "time_on_page_sec" integer, "scroll_depth" integer, "created_at" timestamp DEFAULT now() NOT NULL);` },
      { table: 'analytics_heatmap', sql: `CREATE TABLE IF NOT EXISTS "analytics_heatmap" ("id" serial PRIMARY KEY NOT NULL, "session_id" varchar(64) NOT NULL, "page_url" varchar(2000) NOT NULL, "page_url_normalized" varchar(255) NOT NULL, "x_percent" numeric(5, 2) NOT NULL, "y_percent" numeric(5, 2) NOT NULL, "event_type" varchar(20) DEFAULT 'click' NOT NULL, "viewport_w" integer, "viewport_h" integer, "created_at" timestamp DEFAULT now() NOT NULL);` },
      { table: 'analytics_online', sql: `CREATE TABLE IF NOT EXISTS "analytics_online" ("id" serial PRIMARY KEY NOT NULL, "session_id" varchar(64) NOT NULL UNIQUE, "visitor_id" varchar(64) NOT NULL, "user_id" integer, "user_name" varchar(255), "page_url" varchar(2000), "page_title" varchar(255), "country" varchar(100), "state" varchar(100), "city" varchar(100), "device_type" varchar(20) DEFAULT 'unknown' NOT NULL, "browser" varchar(80), "os" varchar(80), "screen_res" varchar(20), "utm_source" varchar(100), "referrer" varchar(2000), "ip_masked" varchar(20), "last_ping_at" timestamp DEFAULT now() NOT NULL, "entered_at" timestamp DEFAULT now() NOT NULL);` },
      { table: 'analytics_pages', sql: `CREATE TABLE IF NOT EXISTS "analytics_pages" ("id" serial PRIMARY KEY NOT NULL, "page_url_normalized" varchar(255) NOT NULL, "page_title" varchar(255), "date" date NOT NULL, "total_views" integer DEFAULT 0 NOT NULL, "unique_visitors" integer DEFAULT 0 NOT NULL, "bounces" integer DEFAULT 0 NOT NULL, "avg_time_sec" integer DEFAULT 0 NOT NULL, "created_at" timestamp DEFAULT now() NOT NULL, "updated_at" timestamp DEFAULT now() NOT NULL);` },
      { table: 'analytics_conversions', sql: `CREATE TABLE IF NOT EXISTS "analytics_conversions" ("id" serial PRIMARY KEY NOT NULL, "session_id" varchar(64) NOT NULL, "visitor_id" varchar(64) NOT NULL, "user_id" integer, "reached_landing" boolean DEFAULT false NOT NULL, "reached_signup_start" boolean DEFAULT false NOT NULL, "reached_signup_complete" boolean DEFAULT false NOT NULL, "reached_trial_start" boolean DEFAULT false NOT NULL, "reached_plan_select" boolean DEFAULT false NOT NULL, "reached_checkout" boolean DEFAULT false NOT NULL, "reached_pix_generated" boolean DEFAULT false NOT NULL, "reached_payment" boolean DEFAULT false NOT NULL, "reached_first_login" boolean DEFAULT false NOT NULL, "utm_source" varchar(100), "utm_campaign" varchar(100), "created_at" timestamp DEFAULT now() NOT NULL, "updated_at" timestamp DEFAULT now() NOT NULL);` },
      { table: 'analytics_revenue', sql: `CREATE TABLE IF NOT EXISTS "analytics_revenue" ("id" serial PRIMARY KEY NOT NULL, "organization_id" integer DEFAULT 1 NOT NULL, "session_id" varchar(64), "visitor_id" varchar(64), "user_id" integer, "amount" numeric(10, 2) NOT NULL, "plan_id" varchar(50), "plan_name" varchar(100), "utm_source" varchar(100), "utm_medium" varchar(100), "utm_campaign" varchar(100), "country" varchar(100), "state" varchar(100), "city" varchar(100), "created_at" timestamp DEFAULT now() NOT NULL);` },
      { table: 'analytics_campaigns', sql: `CREATE TABLE IF NOT EXISTS "analytics_campaigns" ("id" serial PRIMARY KEY NOT NULL, "utm_source" varchar(100) NOT NULL, "utm_medium" varchar(100), "utm_campaign" varchar(100) NOT NULL UNIQUE, "investment" numeric(10, 2) DEFAULT '0' NOT NULL, "created_at" timestamp DEFAULT now() NOT NULL, "updated_at" timestamp DEFAULT now() NOT NULL);` },
      { table: 'analytics_reports', sql: `CREATE TABLE IF NOT EXISTS "analytics_reports" ("id" serial PRIMARY KEY NOT NULL, "title" varchar(255) NOT NULL, "type" varchar(50) NOT NULL, "params" jsonb, "file_url" text, "status" varchar(30) DEFAULT 'completed' NOT NULL, "created_by" integer, "created_at" timestamp DEFAULT now() NOT NULL);` },
      { table: 'analytics_ai_insights', sql: `CREATE TABLE IF NOT EXISTS "analytics_ai_insights" ("id" serial PRIMARY KEY NOT NULL, "insight_type" varchar(50) NOT NULL, "title" varchar(255) NOT NULL, "content" text NOT NULL, "action_suggested" text, "priority" varchar(20) DEFAULT 'medium' NOT NULL, "is_read" boolean DEFAULT false NOT NULL, "generated_at" timestamp DEFAULT now() NOT NULL, "expires_at" timestamp);` },
    ];

    for (const m of migrations) {
      try {
        await db.execute(sql.raw(m.sql));
        const colPart = m.sql.split('ADD COLUMN IF NOT EXISTS ')[1];
        results.push(`OK: ${m.table}${colPart ? ' - ' + colPart : ''}`);
      } catch (e: any) {
        const msg: string = e.message ?? String(e);
        if (msg.includes("already exists") || msg.includes("já existe") || msg.includes("duplicate column")) {
          results.push(`SKIP: ${m.table} já possui a estrutura`);
        } else {
          // Log real errors clearly - they are important for diagnosing missing tables/columns
          console.error(`[Migration] ERRO em ${m.table}: ${msg}`);
          results.push(`ERROR: ${m.table} - ${msg}`);
        }
      }
    }

    const errors = results.filter(r => r.startsWith('ERROR'));
    if (errors.length > 0) {
      console.warn(`[Database] Migrações concluídas com ${errors.length} erro(s):`, errors);
    } else {
      console.log("[Database] Migrações automáticas concluídas sem erros!");
    }
    return { success: true, results };
  } catch (error: any) {
    console.error("[Database] Falha crítica nas migrações:", error.message);
    return { success: false, error: error.message };
  }
}

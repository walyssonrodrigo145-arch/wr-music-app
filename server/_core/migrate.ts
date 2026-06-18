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
      { table: 'users', sql: 'ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "isEmailVerified" boolean DEFAULT false NOT NULL' },
      { table: 'users', sql: 'ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "verificationToken" text' },
      { table: 'users', sql: 'ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "verificationTokenExpiresAt" timestamp' },
      { table: 'users', sql: 'ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "resetPasswordToken" text' },
      { table: 'users', sql: 'ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "resetPasswordTokenExpiresAt" timestamp' },
      { table: 'users', sql: 'ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "organizationId" integer' },
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
          "completedAt" timestamp
        );`
      },
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
      }
    ];

    for (const m of migrations) {
      try {
        await db.execute(sql.raw(m.sql));
        results.push(`OK: ${m.table} - ${m.sql.split('ADD COLUMN IF NOT EXISTS ')[1]}`);
      } catch (e: any) {
        if (e.message.includes("already exists") || e.message.includes("já existe")) {
          results.push(`SKIP: ${m.table} já possui a coluna`);
        } else {
          console.warn(`[Database] Erro ao aplicar coluna em ${m.table}: ${e.message}`);
          results.push(`ERROR: ${m.table} - ${e.message}`);
        }
      }
    }

    console.log("[Database] Migrações automáticas concluídas!");
    return { success: true, results };
  } catch (error: any) {
    console.error("[Database] Falha crítica nas migrações:", error.message);
    return { success: false, error: error.message };
  }
}

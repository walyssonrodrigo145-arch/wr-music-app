import { eq, desc, asc, sql, and, gte, lte, lt, isNotNull, inArray, aliasedTable } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { 
  students, lessons, instruments, users, paymentDues, 
  studentGoals, studentTimeline, asaasCustomers, 
  organizations, settings, professores, studioRooms, monthlyStats, InsertSettings, InsertUser, marketingCampaigns, marketingContacts, marketingJobs, marketingLogs 
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;
let queryClient: postgres.Sql | null = null;
let _schemaInitialized = false;

async function ensureSchemaConsistency(db: any) {
  if (_schemaInitialized) return;
  
  console.time("[DB] schema-consistency-check");
  try {
    console.log("[Database] Checking schema consistency...");

    // Create system tables if missing (drizzle-kit push might not run on deploy)
    try {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "system_plans" (
          "id" varchar(50) PRIMARY KEY,
          "name" varchar(100) NOT NULL,
          "priceMonthly" integer NOT NULL,
          "priceYearly" integer NOT NULL,
          "maxStudents" integer NOT NULL,
          "features" jsonb NOT NULL,
          "isActive" boolean DEFAULT true NOT NULL,
          "showOnLanding" boolean DEFAULT true NOT NULL,
          "order" integer DEFAULT 0 NOT NULL,
          "allow_extra_students" boolean DEFAULT true NOT NULL,
          "extra_student_price" numeric DEFAULT 1.49 NOT NULL,
          "createdAt" timestamp DEFAULT now() NOT NULL,
          "updatedAt" timestamp DEFAULT now() NOT NULL
        )
      `);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "system_coupons" (
          "id" serial PRIMARY KEY,
          "code" varchar(50) NOT NULL UNIQUE,
          "type" varchar(20) NOT NULL,
          "value" integer NOT NULL,
          "maxUses" integer,
          "currentUses" integer DEFAULT 0 NOT NULL,
          "expiresAt" timestamp,
          "isActive" boolean DEFAULT true NOT NULL,
          "createdAt" timestamp DEFAULT now() NOT NULL
        )
      `);
    } catch (e) {
      console.log("[Database] Failed to execute create system tables:", e);
    }
    
    // system_plans: allow_extra_students e extra_student_price
    await db.execute(sql`ALTER TABLE "system_plans" ADD COLUMN IF NOT EXISTS "allow_extra_students" boolean DEFAULT true NOT NULL`);
    await db.execute(sql`ALTER TABLE "system_plans" ADD COLUMN IF NOT EXISTS "extra_student_price" numeric DEFAULT 1.49 NOT NULL`);

    // lessons.studentId (nullable)
    await db.execute(sql`ALTER TABLE "lessons" ALTER COLUMN "studentId" DROP NOT NULL`);
    
    // settings.pixKey and settings.hiddenTabs
    await db.execute(sql`ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "pixKey" text`);
    await db.execute(sql`ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "hiddenTabs" text DEFAULT '' NOT NULL`);
    await db.execute(sql`ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "chatbotEnabled" integer NOT NULL DEFAULT 0`);
    
    // users.mustChangePassword
    await db.execute(sql`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mustChangePassword" boolean DEFAULT false NOT NULL`);
    
    // settings Asaas Integration
    await db.execute(sql`ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "asaasApiKey" text`);
    await db.execute(sql`ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "asaasEnabled" integer DEFAULT 0 NOT NULL`);

    // settings Mercado Pago Integration
    await db.execute(sql`ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "paymentGateway" varchar(20) DEFAULT 'asaas' NOT NULL`);
    await db.execute(sql`ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "mpAccessToken" text`);
    
    // payment_dues Mercado Pago Integration
    await db.execute(sql`ALTER TABLE "payment_dues" ADD COLUMN IF NOT EXISTS "mpPaymentId" varchar(100)`);
    await db.execute(sql`ALTER TABLE "payment_dues" ADD COLUMN IF NOT EXISTS "mpPaymentLink" text`);
    
    // organizations Subscription Fields
    await db.execute(sql`ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "subscriptionStatus" varchar(50) DEFAULT 'trialing' NOT NULL`);
    await db.execute(sql`ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "trialEndsAt" timestamp`);
    await db.execute(sql`ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "currentPeriodEnd" timestamp`);
    await db.execute(sql`ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "asaasCustomerId" varchar(100)`);
    await db.execute(sql`ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "asaasSubscriptionId" varchar(100)`);

    // students.studentUserId
    await db.execute(sql`ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "studentUserId" integer`);
    
    // payment_dues columns for Asaas
    await db.execute(sql`ALTER TABLE "payment_dues" ADD COLUMN IF NOT EXISTS "asaasId" text`);
    await db.execute(sql`ALTER TABLE "payment_dues" ADD COLUMN IF NOT EXISTS "asaasPaymentLink" text`);
    await db.execute(sql`ALTER TABLE "payment_dues" ADD COLUMN IF NOT EXISTS "asaasBillingType" varchar(30)`);
    await db.execute(sql`ALTER TABLE "payment_dues" ADD COLUMN IF NOT EXISTS "receiptUrl" text`);
    
    // lessonType column
    await db.execute(sql`ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "lessonType" text DEFAULT 'individual'`);
    await db.execute(sql`ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "lessonType" text DEFAULT 'individual'`);
    
    // alertSent1h and alertSent30m columns
    await db.execute(sql`ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "alertSent1h" boolean DEFAULT false NOT NULL`);
    await db.execute(sql`ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "alertSent30m" boolean DEFAULT false NOT NULL`);
    
    // expenses table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "expenses" (
        "id" serial PRIMARY KEY NOT NULL,
        "organizationId" integer,
        "userId" integer NOT NULL,
        "description" varchar(255) NOT NULL,
        "amount" numeric(10, 2) NOT NULL,
        "date" date NOT NULL,
        "category" varchar(100) NOT NULL,
        "status" payment_due_status DEFAULT 'pendente' NOT NULL,
        "receiptUrl" text,
        "notes" text,
        "createdAt" timestamp DEFAULT now() NOT NULL,
        "updatedAt" timestamp DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "supplier" varchar(255)`);
    await db.execute(sql`ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "account" varchar(255)`);
    await db.execute(sql`ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "recurrence" varchar(50) DEFAULT 'unica' NOT NULL`);
    
    
    // student_evolution table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "student_evolution" (
        "id" serial PRIMARY KEY,
        "organizationId" integer,
        "studentId" integer NOT NULL,
        "technical" integer DEFAULT 0 NOT NULL,
        "rhythm" integer DEFAULT 0 NOT NULL,
        "harmony" integer DEFAULT 0 NOT NULL,
        "reading" integer DEFAULT 0 NOT NULL,
        "recordedAt" timestamp DEFAULT now() NOT NULL
      )
    `);

    // ai_documents table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "ai_documents" (
        "id" serial PRIMARY KEY,
        "organizationId" integer NOT NULL,
        "userId" integer NOT NULL,
        "fileName" varchar(255) NOT NULL,
        "fileType" varchar(50) NOT NULL,
        "extractedText" text NOT NULL,
        "createdAt" timestamp DEFAULT now() NOT NULL
      )
    `);
    
    // message_automation_rules table
    await db.execute(sql`
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
      )
    `);

    console.log("[Database] Schema consistency check passed.");
  } catch (error: any) {
    console.warn(`[Database] Schema consistency check failed. Code: ${error.code}. Message: ${error.message}`);
  } finally {
    const safeExecute = async (query: any, description: string) => {
      try {
        await db.execute(query);
      } catch (e: any) {
        console.warn(`[Database] Failed to execute ${description}: ${e.message}`);
      }
    };

    // professor_payments adjustments
    await safeExecute(sql`ALTER TABLE "professor_payments" ADD COLUMN IF NOT EXISTS "adjustments" text`, "professor_payments.adjustments");

    // student_files folder and viewedAt
    await safeExecute(sql`ALTER TABLE "student_files" ADD COLUMN IF NOT EXISTS "folder" text`, "student_files.folder");
    await safeExecute(sql`ALTER TABLE "student_files" ADD COLUMN IF NOT EXISTS "viewedAt" timestamp`, "student_files.viewedAt");

    // automations and students missing fields
    await safeExecute(sql`ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "allowAutoReminders" boolean DEFAULT true NOT NULL`, "students.allowAutoReminders");
    await safeExecute(sql`ALTER TABLE "message_automation_rules" ADD COLUMN IF NOT EXISTS "sendToStudent" integer DEFAULT 1 NOT NULL`, "message_automation_rules.sendToStudent");
    await safeExecute(sql`ALTER TABLE "message_automation_rules" ADD COLUMN IF NOT EXISTS "sendToGuardian" integer DEFAULT 0 NOT NULL`, "message_automation_rules.sendToGuardian");

    // BUG-002: Corrigir UNIQUE(email) sem organizationId em students
    // Dropar constraint antigo (se existir) e recriar com (email, organizationId)
    await safeExecute(sql`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'students_email_unique' AND conrelid = 'students'::regclass
        ) THEN
          ALTER TABLE "students" DROP CONSTRAINT "students_email_unique";
        END IF;
      END $$;
    `, "drop students_email_unique constraint");
    await safeExecute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS "students_email_org_unique"
      ON "students" ("email", "organizationId")
      WHERE "email" IS NOT NULL AND "email" <> ''
    `, "students email+org unique index");

    // BUG-007: Adicionar valor 'estudo' ao enum reminder_type
    await safeExecute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum
          WHERE enumlabel = 'estudo' AND enumtypid = (
            SELECT oid FROM pg_type WHERE typname = 'reminder_type'
          )
        ) THEN
          ALTER TYPE "reminder_type" ADD VALUE 'estudo';
        END IF;
      END $$;
    `, "add 'estudo' to reminder_type enum");

    // MH-001: Índice composto em students(organizationId, status) para melhorar performance
    await safeExecute(sql`CREATE INDEX IF NOT EXISTS "idx_students_org_status" ON "students" ("organizationId", "status")`, "idx_students_org_status");
    // Índice em lessons(scheduledAt) para queries de calendário
    await safeExecute(sql`CREATE INDEX IF NOT EXISTS "idx_lessons_scheduled_at" ON "lessons" ("scheduledAt", "userId")`, "idx_lessons_scheduled_at");
    // Índice em payment_dues(dueDate, status) para queries financeiras
    await safeExecute(sql`CREATE INDEX IF NOT EXISTS "idx_payment_dues_date_status" ON "payment_dues" ("dueDate", "status", "organizationId")`, "idx_payment_dues_date_status");
    // Índice em reminders(status, scheduledAt) para o job de automação
    await safeExecute(sql`CREATE INDEX IF NOT EXISTS "idx_reminders_status_scheduled" ON "reminders" ("status", "scheduledAt", "organizationId")`, "idx_reminders_status_scheduled");

    // ─── MÉDIO-07 FIX: Índices adicionais para queries críticas ─────────────────
    // Esses índices eliminam sequential scans nas tabelas mais acessadas.
    // Billing Engine (Juros e Multas)
    await safeExecute(sql`ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "lateFeeEnabled" integer DEFAULT 1 NOT NULL`, "settings lateFeeEnabled");
    await safeExecute(sql`ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "lateFeeType" varchar(20) DEFAULT 'percentage' NOT NULL`, "settings lateFeeType");
    await safeExecute(sql`ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "lateFeeValue" numeric(10, 2) DEFAULT 2.00 NOT NULL`, "settings lateFeeValue");
    await safeExecute(sql`ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "interestEnabled" integer DEFAULT 1 NOT NULL`, "settings interestEnabled");
    await safeExecute(sql`ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "interestType" varchar(20) DEFAULT 'daily' NOT NULL`, "settings interestType");
    await safeExecute(sql`ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "interestRate" numeric(10, 4) DEFAULT 0.3300 NOT NULL`, "settings interestRate");
    await safeExecute(sql`ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "graceDays" integer DEFAULT 3 NOT NULL`, "settings graceDays");
    await safeExecute(sql`ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "autoUpdateInvoice" integer DEFAULT 1 NOT NULL`, "settings autoUpdateInvoice");
    await safeExecute(sql`ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "showFeeBreakdown" integer DEFAULT 1 NOT NULL`, "settings showFeeBreakdown");
    await safeExecute(sql`ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "studioRoomId" integer`, "lessons studioRoomId");

    // Tabela studio_rooms
    await safeExecute(sql`
      CREATE TABLE IF NOT EXISTS "studio_rooms" (
        "id" serial PRIMARY KEY NOT NULL,
        "organizationId" integer NOT NULL,
        "name" varchar(100) NOT NULL,
        "description" text,
        "color" varchar(20) DEFAULT '#3b82f6' NOT NULL,
        "active" boolean DEFAULT true NOT NULL,
        "createdAt" timestamp DEFAULT now() NOT NULL,
        "updatedAt" timestamp DEFAULT now() NOT NULL
      )
    `, "create studio_rooms table");

    // Tabela enrollment_links
    await safeExecute(sql`
      CREATE TABLE IF NOT EXISTS "enrollment_links" (
        "id" serial PRIMARY KEY NOT NULL,
        "organizationId" integer NOT NULL,
        "code" varchar(64) NOT NULL UNIQUE,
        "instrumentId" integer,
        "monthlyFee" numeric(10, 2),
        "leadId" integer,
        "status" varchar(20) DEFAULT 'active' NOT NULL,
        "expiresAt" timestamp,
        "createdAt" timestamp DEFAULT now() NOT NULL
      )
    `, "create enrollment_links table");
    await safeExecute(sql`ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "earlyDiscountEnabled" integer DEFAULT 0 NOT NULL`, "settings earlyDiscountEnabled");
    await safeExecute(sql`ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "earlyDiscountType" varchar(20) DEFAULT 'percentage' NOT NULL`, "settings earlyDiscountType");
    await safeExecute(sql`ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "earlyDiscountValue" numeric(10, 2) DEFAULT 5.00 NOT NULL`, "settings earlyDiscountValue");
    await safeExecute(sql`ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "earlyDiscountDays" integer DEFAULT 0 NOT NULL`, "settings earlyDiscountDays");

    await safeExecute(sql`ALTER TABLE "payment_dues" ADD COLUMN IF NOT EXISTS "originalAmount" numeric(10, 2)`, "payment_dues originalAmount");
    await safeExecute(sql`ALTER TABLE "payment_dues" ADD COLUMN IF NOT EXISTS "lastCalculation" timestamp`, "payment_dues lastCalculation");
    await safeExecute(sql`ALTER TABLE "payment_dues" ADD COLUMN IF NOT EXISTS "daysOverdueCache" integer`, "payment_dues daysOverdueCache");
    await safeExecute(sql`ALTER TABLE "payment_dues" ADD COLUMN IF NOT EXISTS "updatedAmountCache" numeric(10, 2)`, "payment_dues updatedAmountCache");

    await safeExecute(sql`
      CREATE TABLE IF NOT EXISTS "billing_audit_logs" (
        "id" serial PRIMARY KEY,
        "organizationId" integer,
        "invoiceId" integer NOT NULL,
        "originalAmount" numeric(10, 2) NOT NULL,
        "lateFeeAmount" numeric(10, 2) NOT NULL,
        "interestAmount" numeric(10, 2) NOT NULL,
        "daysOverdue" integer NOT NULL,
        "updatedAmount" numeric(10, 2) NOT NULL,
        "userId" integer,
        "origin" varchar(50) NOT NULL,
        "createdAt" timestamp DEFAULT now() NOT NULL
      )
    `, "create billing_audit_logs table");

    // analytics_security_logs table
    await safeExecute(sql`
      CREATE TABLE IF NOT EXISTS "analytics_security_logs" (
        "id" serial PRIMARY KEY,
        "ip" varchar(45) NOT NULL,
        "route" text NOT NULL,
        "method" varchar(10) NOT NULL,
        "status_code" integer DEFAULT 200 NOT NULL,
        "event_category" varchar(50) NOT NULL,
        "severity" varchar(20) DEFAULT 'info' NOT NULL,
        "user_agent" text,
        "referer" text,
        "user_id" integer,
        "organization_id" integer,
        "details" text,
        "created_at" timestamp DEFAULT now() NOT NULL
      )
    `, "create analytics_security_logs table");
    await safeExecute(sql`CREATE INDEX IF NOT EXISTS "idx_analytics_security_logs_ip" ON "analytics_security_logs" ("ip")`, "idx_analytics_security_logs_ip");
    await safeExecute(sql`CREATE INDEX IF NOT EXISTS "idx_analytics_security_logs_created" ON "analytics_security_logs" ("created_at")`, "idx_analytics_security_logs_created");

    // payment_dues.asaasId: usado no processamento de webhooks Asaas (lookup muito frequente)
    await safeExecute(sql`CREATE INDEX IF NOT EXISTS "idx_payment_dues_asaas_id" ON "payment_dues" ("asaasId") WHERE "asaasId" IS NOT NULL`, "idx_payment_dues_asaas_id");

    // students por org + status + professor: query mais comum em toda a aplicação
    await safeExecute(sql`CREATE INDEX IF NOT EXISTS "idx_students_org_status" ON "students" ("organizationId", "status")`, "idx_students_org_status");
    await safeExecute(sql`CREATE INDEX IF NOT EXISTS "idx_students_org_professor" ON "students" ("organizationId", "professorId")`, "idx_students_org_professor");

    // users.organizationId: lookup de sessão no middleware de autenticação
    await safeExecute(sql`CREATE INDEX IF NOT EXISTS "idx_users_organization_id" ON "users" ("organizationId")`, "idx_users_organization_id");
    // users.email: login por email (muito frequente, deve ser rápido)
    await safeExecute(sql`CREATE INDEX IF NOT EXISTS "idx_users_email" ON "users" ("email") WHERE "email" IS NOT NULL`, "idx_users_email");
    // users.studentId: lookup do portal do aluno
    await safeExecute(sql`CREATE INDEX IF NOT EXISTS "idx_users_student_id" ON "users" ("studentId") WHERE "studentId" IS NOT NULL`, "idx_users_student_id");

    // notifications.userId: lookup de notificações do usuário
    await safeExecute(sql`CREATE INDEX IF NOT EXISTS "idx_notifications_user_id" ON "notifications" ("userId", "organizationId")`, "idx_notifications_user_id");

    // lessons.organizationId + status: queries do dashboard
    await safeExecute(sql`CREATE INDEX IF NOT EXISTS "idx_lessons_org_status" ON "lessons" ("organizationId", "status")`, "idx_lessons_org_status");
    // lessons.studentId: lookup de aulas por aluno
    await safeExecute(sql`CREATE INDEX IF NOT EXISTS "idx_lessons_student_id" ON "lessons" ("studentId")`, "idx_lessons_student_id");

    // daily_study_plans: aluno + status publicado (portal do aluno)
    await safeExecute(sql`ALTER TABLE "daily_study_plans" ADD COLUMN IF NOT EXISTS "daysTimeSpent" text DEFAULT '[0,0,0,0,0]' NOT NULL`, "daily_study_plans.daysTimeSpent");
    await safeExecute(sql`CREATE INDEX IF NOT EXISTS "idx_study_plans_student_status" ON "daily_study_plans" ("studentId", "publishedStatus", "status")`, "idx_study_plans_student_status");

    // payment_dues.studentId: relatórios financeiros por aluno
    await safeExecute(sql`CREATE INDEX IF NOT EXISTS "idx_payment_dues_student_id" ON "payment_dues" ("studentId", "organizationId")`, "idx_payment_dues_student_id");

    // file_comments table
    await safeExecute(sql`
      CREATE TABLE IF NOT EXISTS "file_comments" (
        "id" serial PRIMARY KEY,
        "organization_id" integer NOT NULL,
        "file_id" integer NOT NULL,
        "user_id" integer NOT NULL,
        "content" text NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL
      )
    `, "create file_comments");

    // Create Marketing Enums if they don't exist
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE campaign_status AS ENUM ('draft', 'running', 'paused', 'completed', 'error');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE campaign_contact_status AS ENUM ('pending', 'processing', 'sent', 'failed');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE job_status AS ENUM ('pending', 'running', 'completed', 'failed');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create Marketing Tables
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "marketing_campaigns" (
        "id" serial PRIMARY KEY,
        "organizationId" integer NOT NULL,
        "name" varchar(255) NOT NULL,
        "description" text,
        "status" campaign_status DEFAULT 'draft' NOT NULL,
        "minDelay" integer DEFAULT 10 NOT NULL,
        "maxDelay" integer DEFAULT 20 NOT NULL,
        "batchSize" integer DEFAULT 20 NOT NULL,
        "batchDelay" integer DEFAULT 600 NOT NULL,
        "totalContacts" integer DEFAULT 0 NOT NULL,
        "sentCount" integer DEFAULT 0 NOT NULL,
        "failedCount" integer DEFAULT 0 NOT NULL,
        "consecutiveErrors" integer DEFAULT 0 NOT NULL,
        "createdBy" integer NOT NULL,
        "startedAt" timestamp,
        "completedAt" timestamp,
        "createdAt" timestamp DEFAULT now() NOT NULL,
        "updatedAt" timestamp DEFAULT now() NOT NULL
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "marketing_contacts" (
        "id" serial PRIMARY KEY,
        "organizationId" integer NOT NULL,
        "campaignId" integer NOT NULL REFERENCES "marketing_campaigns"("id") ON DELETE CASCADE,
        "name" varchar(255) NOT NULL,
        "phone" varchar(50) NOT NULL,
        "variables" jsonb,
        "messageText" text NOT NULL,
        "status" campaign_contact_status DEFAULT 'pending' NOT NULL,
        "errorMessage" text,
        "evolutionMessageId" varchar(255),
        "processedAt" timestamp,
        "createdAt" timestamp DEFAULT now() NOT NULL
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "marketing_jobs" (
        "id" serial PRIMARY KEY,
        "organizationId" integer NOT NULL,
        "campaignId" integer NOT NULL REFERENCES "marketing_campaigns"("id") ON DELETE CASCADE,
        "status" job_status DEFAULT 'pending' NOT NULL,
        "lockedAt" timestamp,
        "lockedBy" varchar(255),
        "lastProcessedContactId" integer,
        "createdAt" timestamp DEFAULT now() NOT NULL,
        "updatedAt" timestamp DEFAULT now() NOT NULL
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "marketing_logs" (
        "id" serial PRIMARY KEY,
        "organizationId" integer NOT NULL,
        "campaignId" integer NOT NULL REFERENCES "marketing_campaigns"("id") ON DELETE CASCADE,
        "contactId" integer REFERENCES "marketing_contacts"("id") ON DELETE SET NULL,
        "level" varchar(50) NOT NULL,
        "message" text NOT NULL,
        "payload" jsonb,
        "response" jsonb,
        "createdAt" timestamp DEFAULT now() NOT NULL
      )
    `);

    await safeExecute(sql`ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "lessonDuration" integer DEFAULT 60 NOT NULL`, "settings lessonDuration");

    _schemaInitialized = true;
    console.timeEnd("[DB] schema-consistency-check");
  }
}

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const options: any = {
        prepare: false,
        connection: {
          search_path: "public"
        }
      };
      const isLocalDb = process.env.DATABASE_URL.includes("localhost") || 
                        process.env.DATABASE_URL.includes("127.0.0.1") || 
                        process.env.DATABASE_URL.includes("@db:");
      if (!isLocalDb && (process.env.DATABASE_URL.includes("supabase.co") || process.env.DATABASE_URL.includes("supabase.com") || process.env.NODE_ENV === "production")) {
        options.ssl = { rejectUnauthorized: false };
      }

      queryClient = postgres(process.env.DATABASE_URL, options);
      _db = drizzle(queryClient);
      await ensureSchemaConsistency(_db);
    } catch (error) {
      console.error("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser, maxRetries = 3): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      const db = await getDb();
      if (!db) return;

      let [existing] = await db.select().from(users).where(eq(users.openId, user.openId)).limit(1);

      if (!existing && user.email) {
        const [existingByEmail] = await db.select().from(users).where(eq(users.email, user.email)).limit(1);
        if (existingByEmail) {
          existing = existingByEmail;
          // Link accounts by updating the openId to the new one (e.g., from Google)
          await db.update(users).set({ openId: user.openId }).where(eq(users.id, existing.id));
        }
      }


      // Garante que todo usuário tenha uma organização válida isolada
      let targetOrgId = user.organizationId || existing?.organizationId;
      if (!targetOrgId) {
        // Sempre cria uma nova organização para não misturar com escolas existentes
        const newOrgName = user.name ? `Escola de ${user.name.split(' ')[0]}` : "Escola de Música";
        const slugBase = user.name ? user.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') : 'escola';
        const [newOrg] = await db.insert(organizations).values({
          name: newOrgName,
          slug: `${slugBase}-${Date.now()}`,
          subscriptionStatus: "active",
          createdAt: new Date(),
        }).returning();
        targetOrgId = newOrg.id;
        
        // Se criou a organização agora, ele deve ser o admin dono dela
        user.role = "admin";
      }

      const superAdminEmails = ['walyssonrodrigo145@gmail.com', 'ddwvitor@gmail.com'];
      const isAdminEmail = user.email?.toLowerCase() && superAdminEmails.includes(user.email.toLowerCase());
      const isOwner = user.openId === ENV.ownerOpenId || isAdminEmail;

      const data = {
        name: user.name,
        email: user.email,
        loginMethod: user.loginMethod,
        isEmailVerified: user.isEmailVerified ?? true,
        role: isOwner ? 'admin' : (user.role || undefined),
        organizationId: targetOrgId,
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      };

      if (existing) {
        // Only update fields that are provided and not undefined
        const updateData: any = { 
          updatedAt: new Date(),
          lastSignedIn: new Date()
        };
        if (user.name !== undefined) updateData.name = user.name;
        if (user.email !== undefined) updateData.email = user.email;
        if (user.loginMethod !== undefined) updateData.loginMethod = user.loginMethod;
        if (user.isEmailVerified !== undefined) updateData.isEmailVerified = user.isEmailVerified;
        if (user.role !== undefined) updateData.role = user.role;
        if (targetOrgId !== undefined) updateData.organizationId = targetOrgId;
        if ((user as any).studentId !== undefined) updateData.studentId = (user as any).studentId;

        await db.update(users).set(updateData).where(eq(users.openId, user.openId));
      } else {
        await db.insert(users).values({
          openId: user.openId,
          name: user.name || "",
          email: user.email || "",
          loginMethod: user.loginMethod,
          isEmailVerified: user.isEmailVerified ?? true,
          role: user.role || (user.openId === ENV.ownerOpenId ? 'admin' : 'professor'),
          organizationId: targetOrgId,
          studentId: (user as any).studentId,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        });
      }
      return;
    } catch (error: any) {
      attempt++;
      if (attempt >= maxRetries) throw error;
      await new Promise(res => setTimeout(res, 1000 * attempt));
    }
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  const user = result.length > 0 ? result[0] : undefined;

  // Se o usuário existir mas não tiver organizationId (ex: professor convidado ou inserido manualmente),
  // atribui automaticamente a organização principal do sistema para evitar falhas de foreign key/not null nas configurações.
  if (user && !user.organizationId) {
    const [firstOrg] = await db.select().from(organizations).orderBy(organizations.id).limit(1);
    let orgId = firstOrg?.id;

    if (!orgId) {
      const [newOrg] = await db.insert(organizations).values({
        name: "Escola de Música",
        slug: `escola-${Date.now()}`,
        subscriptionStatus: "active",
        createdAt: new Date(),
      }).returning();
      orgId = newOrg.id;
    }

    await db.update(users).set({ organizationId: orgId }).where(eq(users.id, user.id));
    user.organizationId = orgId;
    console.log(`[DB] Auto-assigned organization ${orgId} to user ${user.id} (${user.email || user.openId})`);
  }

  return user;
}

// Dashboard stats
export async function getDashboardStats(organizationId: number, userId?: number) {
  const db = await getDb();
  if (!db) return null;

  const orgFilter = eq(students.organizationId, organizationId);
  const userFilter = userId ? eq(students.professorId, userId) : undefined;

  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);
  
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const lessonOrgFilter = eq(lessons.organizationId, organizationId);
  const lessonUserFilter = userId ? eq(lessons.userId, userId) : undefined;

  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  
  const paymentOrgFilter = eq(paymentDues.organizationId, organizationId);
  const paymentUserFilter = userId ? eq(paymentDues.userId, userId) : undefined;

  const [
    [totalStudents],
    [activeStudents],
    [monthLessons],
    [completedLessons],
    [scheduledLessons],
    [totalLessons],
    [revenueResult]
  ] = await Promise.all([
    db.select({ count: sql<number>`CAST(count(*) AS INT)` }).from(students).where(and(orgFilter, userFilter)),
    db.select({ count: sql<number>`CAST(count(*) AS INT)` }).from(students).where(and(orgFilter, userFilter, eq(students.status, 'ativo'))),
    db.select({ count: sql<number>`CAST(count(*) AS INT)` }).from(lessons)
      .where(and(lessonOrgFilter, lessonUserFilter, gte(lessons.scheduledAt, startOfMonth), lte(lessons.scheduledAt, endOfMonth))),
    db.select({ count: sql<number>`CAST(count(*) AS INT)` }).from(lessons)
      .where(and(
        lessonOrgFilter,
        lessonUserFilter, 
        eq(lessons.status, 'concluida'),
        gte(lessons.scheduledAt, startOfMonth),
        lte(lessons.scheduledAt, endOfMonth)
      )),
    db.select({ count: sql<number>`CAST(count(*) AS INT)` }).from(lessons)
      .where(and(
        lessonOrgFilter,
        lessonUserFilter, 
        eq(lessons.status, 'agendada'),
        gte(lessons.scheduledAt, startOfMonth),
        lte(lessons.scheduledAt, endOfMonth)
      )),
    db.select({ count: sql<number>`CAST(count(*) AS INT)` }).from(lessons)
      .where(and(
        lessonOrgFilter,
        lessonUserFilter, 
        sql`status != 'agendada'`,
        gte(lessons.scheduledAt, startOfMonth),
        lte(lessons.scheduledAt, endOfMonth)
      )),
    db.select({
      total: sql<number>`CAST(COALESCE(SUM(${paymentDues.amount}), 0) AS DECIMAL)`
    }).from(paymentDues)
      .where(and(
        paymentOrgFilter,
        paymentUserFilter,
        eq(paymentDues.month, currentMonth),
        eq(paymentDues.year, currentYear),
        eq(paymentDues.status, 'pago')
      ))
  ]);

  const completionRate = totalLessons.count > 0
    ? Math.round((completedLessons.count / totalLessons.count) * 100)
    : 0;

  return {
    totalStudents: totalStudents.count,
    activeStudents: activeStudents.count,
    monthLessons: monthLessons.count,
    completedLessons: completedLessons.count,
    scheduledLessons: scheduledLessons.count,
    completionRate,
    monthlyRevenue: Number(revenueResult?.total ?? 0),
  };
}

// Monthly stats for charts
export async function getMonthlyStats(organizationId: number, userId?: number, limit = 12) {
  const db = await getDb();
  if (!db) return [];
  
  const now = new Date();
  const data = [];
  const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  
  const promises = [];
  
  for (let i = limit - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    
    const startOfNextMonth = new Date(y, m, 1);
    const startOfMonth = new Date(y, m - 1, 1);
    const endOfMonth = new Date(y, m, 0, 23, 59, 59, 999);
    
    promises.push((async () => {
      const [
        [ativos],
        [aulasVal],
        [revenueRes]
      ] = await Promise.all([
        db.select({ count: sql<number>`CAST(count(*) AS INT)` })
          .from(students)
          .where(and(
            eq(students.organizationId, organizationId),
            userId ? eq(students.professorId, userId) : undefined,
            eq(students.status, 'ativo'),
            lt(students.createdAt, startOfNextMonth)
          )),
        db.select({ count: sql<number>`CAST(count(*) AS INT)` })
          .from(lessons)
          .where(and(
            eq(lessons.organizationId, organizationId),
            userId ? eq(lessons.userId, userId) : undefined,
            eq(lessons.status, 'concluida'),
            gte(lessons.scheduledAt, startOfMonth),
            lte(lessons.scheduledAt, endOfMonth)
          )),
        db.select({ total: sql<number>`CAST(COALESCE(SUM(${paymentDues.amount}), 0) AS DECIMAL)` })
          .from(paymentDues)
          .where(and(
            eq(paymentDues.organizationId, organizationId),
            userId ? eq(paymentDues.userId, userId) : undefined,
            eq(paymentDues.month, m),
            eq(paymentDues.year, y),
            eq(paymentDues.status, 'pago')
          ))
      ]);
      
      return {
        month: `${monthNames[m - 1]}/${y.toString().slice(-2)}`,
        alunos: ativos.count,
        aulas: aulasVal.count,
        receita: Number(revenueRes?.total ?? 0),
        sortIndex: -i
      };
    })());
  }
  
  const results = await Promise.all(promises);
  data.push(...results.sort((a, b) => a.sortIndex - b.sortIndex).map(({ sortIndex, ...rest }) => rest));
  
  return data;
}

// Students with instrument info
export async function getStudentsWithInstrument(organizationId: number, userId?: number, limit?: number) {
  const db = await getDb();
  if (!db) return [];
  const query = db.select({
    id: students.id,
    name: students.name,
    email: students.email,
    phone: students.phone,
    level: students.level,
    status: students.status,
    monthlyFee: students.monthlyFee,
    startDate: students.startDate,
    dueDay: students.dueDay,
    avatar: students.avatar,
    lessonType: students.lessonType,
    instrumentName: instruments.name,
    instrumentColor: instruments.color,
    instrumentIcon: instruments.icon,
    studentUserId: sql<number | null>`COALESCE(${students.studentUserId}, ${users.id})`,
  }).from(students)
    .leftJoin(instruments, eq(students.instrumentId, instruments.id))
    .leftJoin(users, eq(users.studentId, students.id))
    .where(and(
        eq(students.organizationId, organizationId),
        userId ? eq(students.professorId, userId) : undefined
    ))
    .orderBy(desc(students.createdAt));
  if (limit) return (query as any).limit(limit);
  return query;
}

// Recent lessons with student info — fetches a date range suitable for the full calendar
export async function getRecentLessons(
  organizationId: number,
  userId?: number,
  limit = 500,
  professorId?: number  // quando definido, busca aulas dos alunos do professor (independente de quem criou)
) {
  const db = await getDb();
  if (!db) return [];

  // Fetch from 3 months ago up to 12 months ahead so the calendar covers all views
  const rangeStart = new Date();
  rangeStart.setMonth(rangeStart.getMonth() - 3);
  rangeStart.setHours(0, 0, 0, 0);

  const rangeEnd = new Date();
  rangeEnd.setMonth(rangeEnd.getMonth() + 12);
  rangeEnd.setHours(23, 59, 59, 999);

  // Para professores: buscar pelos alunos que são seus, independente de quem criou a aula
  // Isso resolve o caso onde o admin cria aulas para alunos de um professor
  let professorStudentIds: number[] | undefined = undefined;
  if (professorId) {
    const profStudents = await db
      .select({ id: students.id })
      .from(students)
      .where(and(
        eq(students.organizationId, organizationId),
        eq(students.professorId, professorId),
        eq(students.status, 'ativo'),
      ));
    professorStudentIds = profStudents.map(s => s.id);
  }

  const profUsers = aliasedTable(users, "prof_users");
  const creatorUsers = aliasedTable(users, "creator_users");

  return db.select({
    id: lessons.id,
    title: lessons.title,
    scheduledAt: lessons.scheduledAt,
    duration: lessons.duration,
    status: lessons.status,
    rating: lessons.rating,
    isExperimental: lessons.isExperimental,
    experimentalName: lessons.experimentalName,
    instrumentId: lessons.instrumentId,
    instrumentName: instruments.name,
    studentName: students.name,
    studentId: students.id,
    lessonType: lessons.lessonType,
    recurringGroupId: lessons.recurringGroupId,
    studioRoomId: lessons.studioRoomId,
    studioRoomName: studioRooms.name,
    teacherId: sql<number>`COALESCE(${students.professorId}, ${lessons.userId})`,
    teacherName: sql<string>`COALESCE(${profUsers.name}, ${creatorUsers.name})`,
  }).from(lessons)
    .leftJoin(students, eq(lessons.studentId, students.id))
    .leftJoin(instruments, eq(lessons.instrumentId, instruments.id))
    .leftJoin(studioRooms, eq(lessons.studioRoomId, studioRooms.id))
    .leftJoin(profUsers, eq(students.professorId, profUsers.id))
    .leftJoin(creatorUsers, eq(lessons.userId, creatorUsers.id))
    .where(and(
        eq(lessons.organizationId, organizationId),
        // Se for professor: filtra pelos alunos dele (ignora userId do criador)
        // Se for admin/sem filtro: sem restrição de usuário
        professorStudentIds
          ? (professorStudentIds.length > 0
              ? inArray(lessons.studentId, professorStudentIds)
              : sql`false`  // professor sem alunos não vê nada
            )
          : (userId ? eq(lessons.userId, userId) : undefined),
        gte(lessons.scheduledAt, rangeStart),
        lte(lessons.scheduledAt, rangeEnd)
    ))
    .orderBy(asc(lessons.scheduledAt)).limit(limit);
}

// Instruments with student count
export async function getInstrumentsWithCount(organizationId: number, userId?: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: instruments.id,
    name: instruments.name,
    category: instruments.category,
    icon: instruments.icon,
    color: instruments.color,
    studentCount: sql<number>`count(${students.id})`,
  }).from(instruments).leftJoin(students, and(eq(instruments.id, students.instrumentId), eq(students.organizationId, organizationId)))
    .where(and(
        isNotNull(instruments.organizationId),
        eq(instruments.organizationId, organizationId),
        userId ? eq(instruments.userId, userId) : undefined
    ))
    .groupBy(instruments.id).orderBy(desc(sql`count(${students.id})`));
}

// Settings helpers
export async function getSettingsByUserId(organizationId: number, userId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(settings).where(and(eq(settings.organizationId, organizationId), eq(settings.userId, userId))).limit(1);
  if (result.length > 0) return result[0];

  // Auto-cria um registro padrão se não existir (evita erros de null na UI)
  try {
    await db.insert(settings).values({
      organizationId,
      userId,
      hiddenTabs: '',
      notifyLessonReminder: 1,
      notifyPaymentDue: 1,
      notifyStudentAbsence: 1,
      notifyNewStudent: 1,
      notifyWeeklyReport: 0,
      automationEnabled: 0,
      whatsappAutoSend: 0,
    });
  } catch (_) {
    // Ignora conflito de insert concorrente
  }
  const created = await db.select().from(settings).where(and(eq(settings.organizationId, organizationId), eq(settings.userId, userId))).limit(1);
  return created.length > 0 ? created[0] : null;
}

export async function upsertSettings(organizationId: number, userId: number, data: Partial<InsertSettings>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Sanitize hiddenTabs: se vier como array, converte para string CSV; se vier como outro tipo, força string vazia
  const sanitized: Partial<InsertSettings> = { ...data };
  if ('hiddenTabs' in sanitized) {
    if (Array.isArray(sanitized.hiddenTabs)) {
      sanitized.hiddenTabs = (sanitized.hiddenTabs as unknown as string[]).join(',');
    } else if (sanitized.hiddenTabs == null) {
      sanitized.hiddenTabs = '';
    } else {
      sanitized.hiddenTabs = String(sanitized.hiddenTabs);
    }
  }

  const existing = await getSettingsByUserId(organizationId, userId);
  if (existing) {
    await db.update(settings).set({ ...sanitized, updatedAt: new Date() }).where(and(eq(settings.organizationId, organizationId), eq(settings.userId, userId)));
  } else {
    // Fornece defaults seguros para colunas NOT NULL ao criar o primeiro registro
    await db.insert(settings).values({
      organizationId,
      userId,
      hiddenTabs: '',
      notifyLessonReminder: 1,
      notifyPaymentDue: 1,
      notifyStudentAbsence: 1,
      notifyNewStudent: 1,
      notifyWeeklyReport: 0,
      automationEnabled: 0,
      whatsappAutoSend: 0,
      ...sanitized,
    });
  }
  return getSettingsByUserId(organizationId, userId);
}

export async function updateUserProfile(organizationId: number, userId: number, data: { name?: string; email?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ ...data, updatedAt: new Date() }).where(and(eq(users.id, userId), eq(users.organizationId, organizationId)));
  const result = await db.select().from(users).where(and(eq(users.id, userId), eq(users.organizationId, organizationId))).limit(1);
  return result[0] ?? null;
}

// Lessons by day of week
export async function getLessonsByDayOfWeek(organizationId: number, userId?: number) {
  const db = await getDb();
  if (!db) return [];
  const fourWeeksAgo = new Date();
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
  return db.select({
    dayOfWeek: sql<number>`CAST(EXTRACT(DOW FROM "scheduledAt") + 1 AS INT)`,
    count: sql<number>`CAST(count(*) AS INT)`,
  }).from(lessons).where(and(
    eq(lessons.organizationId, organizationId),
    userId ? eq(lessons.userId, userId) : undefined,
    gte(lessons.scheduledAt, fourWeeksAgo),
    eq(lessons.status, 'concluida')
  )).groupBy(sql`EXTRACT(DOW FROM "scheduledAt")`);
}

// Stats for experimental lessons
export async function getExperimentalStats(organizationId: number, userId?: number, month?: number, year?: number) {
  const db = await getDb();
  if (!db) return { total: 0, converted: 0, notConverted: 0, conversionRate: 0 };

  let whereClause = and(
    eq(lessons.organizationId, organizationId),
    userId ? eq(lessons.userId, userId) : undefined, 
    eq(lessons.isExperimental, true),
    eq(lessons.status, 'concluida')
  );
  
  if (month && year) {
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);
    whereClause = and(whereClause, gte(lessons.scheduledAt, startOfMonth), lte(lessons.scheduledAt, endOfMonth));
  }

  const expLessons = await db.select().from(lessons).where(whereClause);
  
  const total = expLessons.length;
  let converted = 0;

  for (const lesson of expLessons) {
    if (lesson.studentId) {
       converted++;
       continue;
    }
    if (lesson.experimentalName) {
      const [student] = await db.select({ id: students.id })
        .from(students)
        .where(and(
          eq(students.organizationId, organizationId),
          userId ? eq(students.professorId, userId) : undefined, 
          sql`LOWER(${students.name}) = LOWER(${lesson.experimentalName})`
        ))
        .limit(1);
      if (student) {
        converted++;
      }
    }
  }

  return {
    total,
    converted,
    notConverted: total - converted,
    conversionRate: total > 0 ? Math.round((converted / total) * 100) : 0
  };
}

export async function createOrganization(name: string, ownerOpenId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const [org] = await db.insert(organizations).values({
    name,
    slug: name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
    subscriptionStatus: "active",
    createdAt: new Date(),
  }).returning();
  
  return org;
}

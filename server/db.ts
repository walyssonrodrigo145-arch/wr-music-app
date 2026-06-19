import { eq, desc, asc, sql, and, gte, lte, lt, isNotNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { InsertUser, users, students, instruments, lessons, monthlyStats, settings, InsertSettings, paymentDues, studentGoals, studentTimeline, organizations } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;
let queryClient: postgres.Sql | null = null;
let _schemaInitialized = false;

async function ensureSchemaConsistency(db: any) {
  if (_schemaInitialized) return;
  
  console.time("[DB] schema-consistency-check");
  try {
    console.log("[Database] Checking schema consistency...");
    
    // lessons.studentId (nullable)
    await db.execute(sql`ALTER TABLE "lessons" ALTER COLUMN "studentId" DROP NOT NULL`);
    
    // settings.pixKey and settings.hiddenTabs
    await db.execute(sql`ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "pixKey" text`);
    await db.execute(sql`ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "hiddenTabs" text DEFAULT '' NOT NULL`);
    
    // users.mustChangePassword
    await db.execute(sql`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mustChangePassword" boolean DEFAULT false NOT NULL`);
    
    // settings Asaas Integration
    await db.execute(sql`ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "asaasApiKey" text`);
    await db.execute(sql`ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "asaasEnabled" integer DEFAULT 0 NOT NULL`);
    
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

      const [existing] = await db.select().from(users).where(eq(users.openId, user.openId)).limit(1);

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

      const data = {
        name: user.name,
        email: user.email,
        loginMethod: user.loginMethod,
        isEmailVerified: user.isEmailVerified ?? true,
        role: user.role || (user.openId === ENV.ownerOpenId ? 'admin' : undefined),
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

  const lessonOrgFilter = eq(lessons.organizationId, organizationId);
  const lessonUserFilter = userId ? eq(lessons.userId, userId) : undefined;

  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  
  const paymentOrgFilter = eq(paymentDues.organizationId, organizationId);
  const paymentUserFilter = userId ? eq(paymentDues.userId, userId) : undefined;

  const [
    [totalStudents],
    [activeStudents],
    [weekLessons],
    [completedLessons],
    [totalLessons],
    [revenueResult]
  ] = await Promise.all([
    db.select({ count: sql<number>`CAST(count(*) AS INT)` }).from(students).where(and(orgFilter, userFilter)),
    db.select({ count: sql<number>`CAST(count(*) AS INT)` }).from(students).where(and(orgFilter, userFilter, eq(students.status, 'ativo'))),
    db.select({ count: sql<number>`CAST(count(*) AS INT)` }).from(lessons)
      .where(and(lessonOrgFilter, lessonUserFilter, gte(lessons.scheduledAt, startOfWeek), lte(lessons.scheduledAt, endOfWeek))),
    db.select({ count: sql<number>`CAST(count(*) AS INT)` }).from(lessons)
      .where(and(
        lessonOrgFilter,
        lessonUserFilter, 
        eq(lessons.status, 'concluida'),
        gte(lessons.scheduledAt, startOfWeek),
        lte(lessons.scheduledAt, endOfWeek)
      )),
    db.select({ count: sql<number>`CAST(count(*) AS INT)` }).from(lessons)
      .where(and(
        lessonOrgFilter,
        lessonUserFilter, 
        sql`status != 'agendada'`,
        gte(lessons.scheduledAt, startOfWeek),
        lte(lessons.scheduledAt, endOfWeek)
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
    weekLessons: weekLessons.count,
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
export async function getRecentLessons(organizationId: number, userId?: number, limit = 500) {
  const db = await getDb();
  if (!db) return [];

  // Fetch from 3 months ago up to 12 months ahead so the calendar covers all views
  const rangeStart = new Date();
  rangeStart.setMonth(rangeStart.getMonth() - 3);
  rangeStart.setHours(0, 0, 0, 0);

  const rangeEnd = new Date();
  rangeEnd.setMonth(rangeEnd.getMonth() + 12);
  rangeEnd.setHours(23, 59, 59, 999);

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
  }).from(lessons)
    .leftJoin(students, eq(lessons.studentId, students.id))
    .leftJoin(instruments, eq(lessons.instrumentId, instruments.id))
    .where(and(
        eq(lessons.organizationId, organizationId),
        userId ? eq(lessons.userId, userId) : undefined,
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

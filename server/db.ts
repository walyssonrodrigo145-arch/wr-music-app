import { eq, desc, sql, and, gte, lte, lt } from "drizzle-orm";
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
    console.log("[Database] Checking schema consistency for 'lessons.studentId'...");
    await db.execute(sql`ALTER TABLE "lessons" ALTER COLUMN "studentId" DROP NOT NULL`);
    console.log("[Database] Schema consistency check passed: 'studentId' is now nullable.");
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
      if (process.env.DATABASE_URL.includes("supabase.co") || process.env.NODE_ENV === "production") {
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

      const data = {
        name: user.name,
        email: user.email,
        loginMethod: user.loginMethod,
        isEmailVerified: user.isEmailVerified ?? true,
        role: user.role || (user.openId === ENV.ownerOpenId ? 'admin' : undefined),
        organizationId: user.organizationId,
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
        if (user.organizationId !== undefined) updateData.organizationId = user.organizationId;
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
          organizationId: user.organizationId,
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
  return result.length > 0 ? result[0] : undefined;
}

// Dashboard stats
export async function getDashboardStats(organizationId: number, userId?: number) {
  const db = await getDb();
  if (!db) return null;

  const orgFilter = eq(students.organizationId, organizationId);
  const userFilter = userId ? eq(students.professorId, userId) : undefined;

  const [totalStudents] = await db.select({ count: sql<number>`CAST(count(*) AS INT)` }).from(students).where(and(orgFilter, userFilter));
  const [activeStudents] = await db.select({ count: sql<number>`CAST(count(*) AS INT)` }).from(students).where(and(orgFilter, userFilter, eq(students.status, 'ativo')));

  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  const lessonOrgFilter = eq(lessons.organizationId, organizationId);
  const lessonUserFilter = userId ? eq(lessons.userId, userId) : undefined;

  const [weekLessons] = await db.select({ count: sql<number>`CAST(count(*) AS INT)` }).from(lessons)
    .where(and(lessonOrgFilter, lessonUserFilter, gte(lessons.scheduledAt, startOfWeek), lte(lessons.scheduledAt, endOfWeek)));

  const [completedLessons] = await db.select({ count: sql<number>`CAST(count(*) AS INT)` }).from(lessons)
    .where(and(
      lessonOrgFilter,
      lessonUserFilter, 
      eq(lessons.status, 'concluida'),
      gte(lessons.scheduledAt, startOfWeek),
      lte(lessons.scheduledAt, endOfWeek)
    ));

  const [totalLessons] = await db.select({ count: sql<number>`CAST(count(*) AS INT)` }).from(lessons)
    .where(and(
      lessonOrgFilter,
      lessonUserFilter, 
      sql`status != 'agendada'`,
      gte(lessons.scheduledAt, startOfWeek),
      lte(lessons.scheduledAt, endOfWeek)
    ));

  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  
  const paymentOrgFilter = eq(paymentDues.organizationId, organizationId);
  const paymentUserFilter = userId ? eq(paymentDues.userId, userId) : undefined;

  const [revenueResult] = await db.select({
    total: sql<number>`CAST(COALESCE(SUM(${paymentDues.amount}), 0) AS DECIMAL)`
  }).from(paymentDues)
    .where(and(
      paymentOrgFilter,
      paymentUserFilter,
      eq(paymentDues.month, currentMonth),
      eq(paymentDues.year, currentYear),
      eq(paymentDues.status, 'pago')
    ));

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
  
  for (let i = limit - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    
    const startOfNextMonth = new Date(y, m, 1);
    const [ativos] = await db.select({ count: sql<number>`CAST(count(*) AS INT)` })
      .from(students)
      .where(and(
        eq(students.organizationId, organizationId),
        userId ? eq(students.professorId, userId) : undefined,
        eq(students.status, 'ativo'),
        lt(students.createdAt, startOfNextMonth)
      ));

    const startOfMonth = new Date(y, m - 1, 1);
    const endOfMonth = new Date(y, m, 0, 23, 59, 59, 999);
    
    const [aulasVal] = await db.select({ count: sql<number>`CAST(count(*) AS INT)` })
      .from(lessons)
      .where(and(
        eq(lessons.organizationId, organizationId),
        userId ? eq(lessons.userId, userId) : undefined,
        gte(lessons.scheduledAt, startOfMonth),
        lte(lessons.scheduledAt, endOfMonth)
      ));
      
    const [revenueRes] = await db.select({ total: sql<number>`CAST(COALESCE(SUM(${paymentDues.amount}), 0) AS DECIMAL)` })
      .from(paymentDues)
      .where(and(
        eq(paymentDues.organizationId, organizationId),
        userId ? eq(paymentDues.userId, userId) : undefined,
        eq(paymentDues.month, m),
        eq(paymentDues.year, y),
        eq(paymentDues.status, 'pago')
      ));
      
    data.push({
      month: `${monthNames[m - 1]}/${y.toString().slice(-2)}`,
      alunos: ativos.count,
      aulas: aulasVal.count,
      receita: Number(revenueRes?.total ?? 0),
    });
  }
  
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
    instrumentName: instruments.name,
    instrumentColor: instruments.color,
    instrumentIcon: instruments.icon,
    studentUserId: students.studentUserId,
  }).from(students).leftJoin(instruments, eq(students.instrumentId, instruments.id))
    .where(and(
        eq(students.organizationId, organizationId),
        userId ? eq(students.professorId, userId) : undefined
    ))
    .orderBy(desc(students.createdAt));
  if (limit) return (query as any).limit(limit);
  return query;
}

// Recent lessons with student info
export async function getRecentLessons(organizationId: number, userId?: number, limit = 10) {
  const db = await getDb();
  if (!db) return [];
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
  }).from(lessons)
    .leftJoin(students, eq(lessons.studentId, students.id))
    .leftJoin(instruments, eq(lessons.instrumentId, instruments.id))
    .where(and(
        eq(lessons.organizationId, organizationId),
        userId ? eq(lessons.userId, userId) : undefined
    ))
    .orderBy(desc(lessons.scheduledAt)).limit(limit);
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
  }).from(instruments).leftJoin(students, eq(instruments.id, students.instrumentId))
    .where(and(
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
  return result.length > 0 ? result[0] : null;
}

export async function upsertSettings(organizationId: number, userId: number, data: Partial<InsertSettings>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getSettingsByUserId(organizationId, userId);
  if (existing) {
    await db.update(settings).set({ ...data, updatedAt: new Date() }).where(and(eq(settings.organizationId, organizationId), eq(settings.userId, userId)));
  } else {
    await db.insert(settings).values({ organizationId, userId, ...data });
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
    createdAt: new Date(),
  }).returning();
  
  return org;
}

import { eq, desc, sql, and, gte, lte, lt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { InsertUser, users, students, instruments, lessons, monthlyStats, settings, InsertSettings, paymentDues } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;
let queryClient: postgres.Sql | null = null;
let _schemaInitialized = false;

async function ensureSchemaConsistency(db: any) {
  if (_schemaInitialized) return;
  
  try {
    console.log("[Database] Checking schema consistency for 'lessons.studentId'...");
    // Tenta remover a restrição NOT NULL de studentId se ela ainda existir
    await db.execute(sql`ALTER TABLE "lessons" ALTER COLUMN "studentId" DROP NOT NULL`);
    console.log("[Database] Schema consistency check passed: 'studentId' is now nullable.");
  } catch (error: any) {
    // Se falhar (ex: por falta de permissão), registramos o erro detalhado
    console.warn(`[Database] Schema consistency check failed. Code: ${error.code}. Message: ${error.message}`);
    if (error.detail) console.warn(`[Database] Error detail: ${error.detail}`);
  } finally {
    _schemaInitialized = true;
  }
}

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      queryClient = postgres(process.env.DATABASE_URL);
      _db = drizzle(queryClient);
      
      // Executa a auto-correção na primeira conexão
      await ensureSchemaConsistency(_db);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }

  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod", "verificationToken", "resetPasswordToken"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    
    // Boolean fields
    if (user.isEmailVerified !== undefined) {
      values.isEmailVerified = user.isEmailVerified;
      updateSet.isEmailVerified = user.isEmailVerified;
    }

    // Date fields
    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.verificationTokenExpiresAt !== undefined) { values.verificationTokenExpiresAt = user.verificationTokenExpiresAt; updateSet.verificationTokenExpiresAt = user.verificationTokenExpiresAt; }
    if (user.resetPasswordTokenExpiresAt !== undefined) { values.resetPasswordTokenExpiresAt = user.resetPasswordTokenExpiresAt; updateSet.resetPasswordTokenExpiresAt = user.resetPasswordTokenExpiresAt; }
    
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
    else if (user.openId === ENV.ownerOpenId) { values.role = 'admin'; updateSet.role = 'admin'; }
    
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    
    // Garantir que updatedAt sempre exista no update e que ambos sejam objetos Date novos
    updateSet.updatedAt = new Date();
    if (!updateSet.lastSignedIn) updateSet.lastSignedIn = new Date();

    await db.insert(users).values(values).onConflictDoUpdate({ 
      target: [users.openId], 
      set: updateSet 
    });

  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// Dashboard stats
export async function getDashboardStats(userId: number) {
  const db = await getDb();
  if (!db) return null;

  const [totalStudents] = await db.select({ count: sql<number>`CAST(count(*) AS INT)` }).from(students).where(eq(students.userId, userId));
  const [activeStudents] = await db.select({ count: sql<number>`CAST(count(*) AS INT)` }).from(students).where(and(eq(students.userId, userId), eq(students.status, 'ativo')));

  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  const [weekLessons] = await db.select({ count: sql<number>`CAST(count(*) AS INT)` }).from(lessons)
    .where(and(eq(lessons.userId, userId), gte(lessons.scheduledAt, startOfWeek), lte(lessons.scheduledAt, endOfWeek)));

  const [completedLessons] = await db.select({ count: sql<number>`CAST(count(*) AS INT)` }).from(lessons).where(and(eq(lessons.userId, userId), eq(lessons.status, 'concluida')));
  const [totalLessons] = await db.select({ count: sql<number>`CAST(count(*) AS INT)` }).from(lessons).where(and(eq(lessons.userId, userId), sql`status != 'agendada'`));

  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  
  const [revenueResult] = await db.select({
    total: sql<number>`CAST(COALESCE(SUM(${paymentDues.amount}), 0) AS DECIMAL)`
  }).from(paymentDues)
    .where(and(
      eq(paymentDues.userId, userId),
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
export async function getMonthlyStats(userId: number, limit = 12) {
  const db = await getDb();
  if (!db) return [];
  
  const now = new Date();
  const data = [];
  
  // Format month names
  const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  
  for (let i = limit - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth() + 1; // 1-12
    
    // Alunos ativos criados ANTES ou DURANTE este mês
    const startOfNextMonth = new Date(y, m, 1);
    const [ativos] = await db.select({ count: sql<number>`CAST(count(*) AS INT)` })
      .from(students)
      .where(and(
        eq(students.userId, userId),
        eq(students.status, 'ativo'),
        lt(students.createdAt, startOfNextMonth)
      ));

    // Aulas do mês (qualquer status não-cancelado, ou simplesmente total agendadas/concluidas no mes)
    const startOfMonth = new Date(y, m - 1, 1);
    const endOfMonth = new Date(y, m, 0, 23, 59, 59, 999);
    
    const [aulasVal] = await db.select({ count: sql<number>`CAST(count(*) AS INT)` })
      .from(lessons)
      .where(and(
        eq(lessons.userId, userId),
        gte(lessons.scheduledAt, startOfMonth),
        lte(lessons.scheduledAt, endOfMonth)
      ));
      
    const [revenueRes] = await db.select({ total: sql<number>`CAST(COALESCE(SUM(${paymentDues.amount}), 0) AS DECIMAL)` })
      .from(paymentDues)
      .where(and(
        eq(paymentDues.userId, userId),
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
export async function getStudentsWithInstrument(userId: number, limit?: number) {
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
  }).from(students).leftJoin(instruments, eq(students.instrumentId, instruments.id))
    .where(eq(students.userId, userId))
    .orderBy(desc(students.createdAt));
  if (limit) return (query as any).limit(limit);
  return query;
}

// Recent lessons with student info
export async function getRecentLessons(userId: number, limit = 10) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: lessons.id,
    title: lessons.title,
    scheduledAt: lessons.scheduledAt,
    duration: lessons.duration,
    status: lessons.status,
    rating: lessons.rating,
    studentName: students.name,
    studentId: students.id,
  }).from(lessons).leftJoin(students, eq(lessons.studentId, students.id))
    .where(eq(lessons.userId, userId))
    .orderBy(desc(lessons.scheduledAt)).limit(limit);
}

// Instruments with student count
export async function getInstrumentsWithCount(userId: number) {
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
    .where(eq(instruments.userId, userId))
    .groupBy(instruments.id).orderBy(desc(sql`count(${students.id})`));
}

// Settings helpers
export async function getSettingsByUserId(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(settings).where(eq(settings.userId, userId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function upsertSettings(userId: number, data: Partial<InsertSettings>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getSettingsByUserId(userId);
  if (existing) {
    await db.update(settings).set({ ...data, updatedAt: new Date() }).where(eq(settings.userId, userId));
  } else {
    await db.insert(settings).values({ userId, ...data });
  }
  return getSettingsByUserId(userId);
}

export async function updateUserProfile(userId: number, data: { name?: string; email?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ ...data, updatedAt: new Date() }).where(eq(users.id, userId));
  const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return result[0] ?? null;
}

// Lessons by day of week (last 4 weeks)
export async function getLessonsByDayOfWeek(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const fourWeeksAgo = new Date();
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
  return db.select({
    dayOfWeek: sql<number>`CAST(EXTRACT(DOW FROM "scheduledAt") + 1 AS INT)`,
    count: sql<number>`CAST(count(*) AS INT)`,
  }).from(lessons).where(and(
    eq(lessons.userId, userId),
    gte(lessons.scheduledAt, fourWeeksAgo),
    eq(lessons.status, 'concluida')
  )).groupBy(sql`EXTRACT(DOW FROM "scheduledAt")`);
}

// Stats for experimental lessons and conversion
export async function getExperimentalStats(userId: number, month?: number, year?: number) {
  const db = await getDb();
  if (!db) return { total: 0, converted: 0, notConverted: 0, conversionRate: 0 };

  let whereClause = and(
    eq(lessons.userId, userId), 
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

  // Heurística de conversão: studentId preenchido OU nome coincide com um aluno existente
  for (const lesson of expLessons) {
    if (lesson.studentId) {
       converted++;
       continue;
    }
    if (lesson.experimentalName) {
      const [student] = await db.select({ id: students.id })
        .from(students)
        .where(and(
          eq(students.userId, userId), 
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

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
      { table: 'lessons', sql: 'ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "rating" integer' },
      { table: 'lessons', sql: 'ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "instrumentId" integer' },
      { table: 'lessons', sql: 'ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "recurringGroupId" varchar(100)' },
      { table: 'students', sql: 'ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "instrumentId" integer' },
      { table: 'enum', sql: "ALTER TYPE lesson_status ADD VALUE IF NOT EXISTS 'concluida'" },
      { table: 'enum', sql: "ALTER TYPE lesson_status ADD VALUE IF NOT EXISTS 'cancelada'" },
      { table: 'enum', sql: "ALTER TYPE lesson_status ADD VALUE IF NOT EXISTS 'remarcada'" },
      { table: 'enum', sql: "ALTER TYPE lesson_status ADD VALUE IF NOT EXISTS 'falta'" }
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

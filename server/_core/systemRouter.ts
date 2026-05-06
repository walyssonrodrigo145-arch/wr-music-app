import { z } from "zod";
import { notifyOwner } from "./notification";
import { adminProcedure, publicProcedure, router } from "./trpc";
import { getDb } from "../db";
import { users, students, lessons, reminders, paymentDues, instruments } from "../../drizzle/schema";
import { or, ilike, inArray, and, sql, eq } from "drizzle-orm";

export const systemRouter = router({
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      })
    )
    .query(() => ({
      ok: true,
    })),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),

  cleanupTestData: adminProcedure
    .mutation(async () => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // 1. Identificar Alunos de Teste (incluindo o termo 'teteste' e ID '111111' se for texto)
      const testStudents = await db.select({ id: students.id }).from(students)
        .where(
          or(
            ilike(students.name, "%teste%"), 
            ilike(students.email, "%teste%"),
            ilike(students.name, "%teteste%"),
            sql`CAST(${students.id} AS TEXT) = '111111'`
          )
        );
      const studentIds = testStudents.map(s => s.id);

      // 2. Identificar Aulas de Teste
      const testLessons = await db.select({ id: lessons.id }).from(lessons)
        .where(or(ilike(lessons.title, "%teste%"), ilike(lessons.description, "%teste%")));
      const lessonIds = testLessons.map(l => l.id);

      // 3. Deletar dependentes
      const reminderCriteria = [];
      if (studentIds.length > 0) reminderCriteria.push(inArray(reminders.studentId, studentIds));
      if (lessonIds.length > 0) reminderCriteria.push(inArray(reminders.lessonId, lessonIds));
      reminderCriteria.push(ilike(reminders.message, "%teste%"));
      
      if (reminderCriteria.length > 0) {
        await db.delete(reminders).where(or(...reminderCriteria));
      }

      const paymentCriteria = [];
      if (studentIds.length > 0) paymentCriteria.push(inArray(paymentDues.studentId, studentIds));
      paymentCriteria.push(ilike(paymentDues.notes, "%teste%"));
      
      if (paymentCriteria.length > 0) {
        await db.delete(paymentDues).where(or(...paymentCriteria));
      }

      // 4. Deletar Entidades
      if (lessonIds.length > 0) {
        await db.delete(lessons).where(inArray(lessons.id, lessonIds));
      }
      
      if (studentIds.length > 0) {
        await db.delete(students).where(inArray(students.id, studentIds));
      }

      await db.delete(instruments).where(ilike(instruments.name, "%teste%"));

      await db.delete(users).where(
        and(
          or(ilike(users.name, "%teste%"), ilike(users.email, "%teste%")),
          sql`role != 'admin'`
        )
      );

       return { success: true, studentsRemoved: studentIds.length, lessonsRemoved: lessonIds.length };
    }),

  getStudentDebug: adminProcedure
    .input(z.object({ query: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const results = await db.select({
        id: students.id,
        name: students.name,
        email: students.email,
        userId: students.userId,
        ownerName: users.name,
      })
      .from(students)
      .leftJoin(users, eq(students.userId, users.id))
      .where(or(
        ilike(students.name, `%${input.query}%`),
        sql`CAST(${students.id} AS TEXT) = ${input.query}`
      ))
      .limit(10);
      
      return results;
    }),

  forceMigrations: publicProcedure
    .mutation(async () => {
      const { runAutoMigrations } = await import("./migrate");
      return await runAutoMigrations();
    }),
});

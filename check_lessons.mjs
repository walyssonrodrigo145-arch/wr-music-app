import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { lessons, students, professores, users } from "./drizzle/schema.js";
import { eq, and, gte, lt, inArray, or } from "drizzle-orm";

async function run() {
  const queryClient = postgres(process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/wr-music-app");
  const db = drizzle(queryClient);

  const orgId = 1; // Assuming 1 for local test
  const startDate = new Date(2026, 5, 1);
  const endDate = new Date(2026, 6, 1);

  console.log("Fetching all professors...");
  const profs = await db.select().from(professores);
  console.log("Professors:", profs.map(p => ({id: p.id, userId: p.userId, name: p.name})));

  for (const prof of profs) {
    console.log(`\n--- Professor: ${prof.name} (id: ${prof.id}, userId: ${prof.userId}) ---`);
    
    const profStudents = await db.select({ id: students.id, name: students.name, profId: students.professorId })
      .from(students)
      .where(and(eq(students.professorId, prof.id)));
      
    console.log(`Students assigned to this professor:`, profStudents.length);
    if (profStudents.length > 0) {
      console.log(profStudents.map(s => s.name).join(", "));
    }

    const studentIds = profStudents.map(s => s.id);

    // Let's just find ALL completed lessons in June to see who they belong to
    const allJuneLessons = await db.select({
      id: lessons.id,
      studentId: lessons.studentId,
      userId: lessons.userId,
      status: lessons.status,
      title: lessons.title
    }).from(lessons)
      .where(and(
        eq(lessons.status, "concluida"),
        gte(lessons.scheduledAt, startDate),
        lt(lessons.scheduledAt, endDate)
      ));

    console.log(`Total completed lessons in June for ANYONE:`, allJuneLessons.length);
    if (allJuneLessons.length > 0) {
       console.log("Sample lessons:", allJuneLessons.slice(0, 5));
    }

    // Now with the condition
    const lessonCondition = studentIds.length > 0
      ? or(eq(lessons.userId, prof.userId), inArray(lessons.studentId, studentIds))
      : eq(lessons.userId, prof.userId);

    const matchedLessons = await db.select().from(lessons).where(and(lessonCondition, eq(lessons.status, "concluida"), gte(lessons.scheduledAt, startDate), lt(lessons.scheduledAt, endDate)));
    console.log(`Matched lessons for this professor:`, matchedLessons.length);
  }

  process.exit(0);
}

run().catch(console.error);

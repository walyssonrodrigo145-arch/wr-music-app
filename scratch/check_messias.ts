import { getDb } from "../server/db";
import { lessons, students } from "../drizzle/schema";
import { eq } from "drizzle-orm";

async function main() {
  const db = await getDb();
  if (!db) {
    console.error("Database not available");
    return;
  }
  const allStudents = await db.select().from(students);
  const messiasStudent = allStudents.find(s => s.name.toLowerCase().includes("messias"));
  if (!messiasStudent) {
    console.log("No student found with name containing 'Messias'");
    return;
  }
  console.log("Found student:", messiasStudent.name, "ID:", messiasStudent.id);

  const messiasLessons = await db.select().from(lessons).where(eq(lessons.studentId, messiasStudent.id));
  console.log("Messias lessons in DB:", messiasLessons.map(m => ({
    id: m.id,
    title: m.title,
    scheduledAt: m.scheduledAt,
    recurringGroupId: m.recurringGroupId
  })));
}

main().catch(console.error);

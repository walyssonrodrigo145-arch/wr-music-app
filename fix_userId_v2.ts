import "dotenv/config";
import postgres from "postgres";

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { ssl: { rejectUnauthorized: false } });
  try {
    console.log("Fixing userId in students table...");
    await sql`UPDATE students SET "userId" = "professorId" WHERE "userId" IS NOT NULL`;
    
    console.log("Fixing userId in lessons table...");
    // lessons has userId, but maybe it's wrong too?
    // Let's check lessons cols
    const lessonsCols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'lessons'`;
    console.log("Lessons columns:", lessonsCols.map(c => c.column_name));
    
    // In lessons, the owner is "userId" itself.
    
    console.log("Fixing userId in payment_dues...");
    await sql`UPDATE payment_dues SET "userId" = (SELECT "professorId" FROM students WHERE students.id = payment_dues."studentId") WHERE "userId" IS NOT NULL`;

    console.log("Data fix completed.");
  } catch (err) {
    console.error(err);
  } finally {
    await sql.end();
  }
}

main();

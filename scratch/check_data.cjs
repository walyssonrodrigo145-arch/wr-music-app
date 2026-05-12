require('dotenv').config();
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL);

async function run() {
  try {
    console.log("--- CHECKING LESSONS FOR STUDENT 8 ---");
    const lessonsList = await sql`SELECT id, title, status, "scheduledAt", "studentId", "organizationId", "userId" FROM lessons WHERE "studentId" = 8`;
    console.log("Lessons found:", JSON.stringify(lessonsList, null, 2));

    if (lessonsList.length > 0) {
       const lesson = lessonsList[0];
       console.log("Lesson 1 data:", lesson);
    }

    console.log("--- CHECKING TIMELINE FOR STUDENT 8 ---");
    const timeline = await sql`SELECT id, title, "studentId", "organizationId" FROM student_timeline WHERE "studentId" = 8`;
    console.log("Timeline entries:", timeline.length);

  } catch (e) {
    console.error("ERRO:", e.message);
  } finally {
    await sql.end();
    process.exit();
  }
}
run();

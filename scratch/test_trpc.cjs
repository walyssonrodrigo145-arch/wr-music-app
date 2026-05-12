require('dotenv').config();
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL);

// Mock the context for Pedro Henrique
const ctx = {
  user: {
    id: 1523,
    openId: "bf25421a-66d4-43a4-9cce-9b0fa320aec6",
    role: "aluno",
    studentId: 8,
    organizationId: 1
  }
};

async function testProfile() {
  try {
    console.log("--- TESTING getProfile SIMULATION (RAW SQL) ---");
    
    // Simulate: await db.select().from(students).where(eq(students.id, ctx.user.studentId)).limit(1);
    const studentsList = await sql`
      SELECT id, name, email, "professorId" as "teacherId" 
      FROM students 
      WHERE id = ${ctx.user.studentId} 
      LIMIT 1
    `;
    
    const student = studentsList[0];
    if (!student) {
      console.log("STUDENT NOT FOUND!");
      return;
    }
    console.log("Student record found:", student);

    // Simulate: const [teacher] = await db.select({ name: users.name }).from(users).where(eq(users.id, student.teacherId)).limit(1);
    const teachersList = await sql`
      SELECT id, name 
      FROM users 
      WHERE id = ${student.teacherId} 
      LIMIT 1
    `;
    
    const teacher = teachersList[0];
    console.log("Teacher record found:", teacher);

    const result = {
      ...student,
      teacherName: teacher?.name || 'Professor',
    };
    
    console.log("FINAL RESULT:", JSON.stringify(result, null, 2));

  } catch (e) {
    console.error("ERRO:", e.message);
  } finally {
    await sql.end();
    process.exit();
  }
}

testProfile();

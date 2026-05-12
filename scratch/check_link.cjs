require('dotenv').config();
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL);

async function run() {
  try {
    console.log("--- CHECKING PEDRO LINK ---");
    const student = await sql`SELECT id, name, "studentUserId", "organizationId", "professorId" FROM students WHERE name LIKE '%Pedro%'`;
    console.log("Student 8:", JSON.stringify(student, null, 2));

    const user = await sql`SELECT id, name, email, "studentId", "organizationId" FROM users WHERE id = 1523`;
    console.log("User 1523:", JSON.stringify(user, null, 2));

    const sessionUser = await sql`SELECT id, name, email, "studentId", "organizationId" FROM users WHERE email = 'pedro.henrique@musicpro.com'`;
    console.log("Users with Pedro's email:", JSON.stringify(sessionUser, null, 2));

  } catch (e) {
    console.error("ERRO:", e.message);
  } finally {
    await sql.end();
    process.exit();
  }
}
run();

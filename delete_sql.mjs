import postgres from 'postgres';
import dotenv from 'dotenv';
dotenv.config();

const sql = postgres(process.env.DATABASE_URL);

async function run() {
  console.log("Iniciando exclusão do aluno ID 16 e dependências...");
  try {
    const sId = 16;
    
    await sql`DELETE FROM "reminders" WHERE "studentId" = ${sId}`;
    console.log("Reminders deletados");
    
    await sql`DELETE FROM "payment_dues" WHERE "studentId" = ${sId}`;
    console.log("Payment dues deletados");
    
    await sql`DELETE FROM "student_goals" WHERE "studentId" = ${sId}`;
    console.log("Student goals deletados");

    await sql`DELETE FROM "student_timeline" WHERE "studentId" = ${sId}`;
    console.log("Student timeline deletada");

    await sql`DELETE FROM "lessons" WHERE "studentId" = ${sId}`;
    console.log("Lessons deletados");

    const res = await sql`DELETE FROM "students" WHERE id = ${sId} RETURNING *;`;
    console.log(`Sucesso: Aluno deletado!`);
    console.log(res);
  } catch(e) {
    console.error("Erro:", e);
  } finally {
    process.exit(0);
  }
}

run();

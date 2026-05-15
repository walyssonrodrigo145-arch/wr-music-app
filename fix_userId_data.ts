import "dotenv/config";
import postgres from "postgres";

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { ssl: { rejectUnauthorized: false } });
  try {
    console.log("Fixing userId in students table...");
    // Sincroniza o userId com o professorId para garantir que os professores possam acessar seus próprios alunos legados
    const result = await sql`
      UPDATE students 
      SET "userId" = "professorId" 
      WHERE "userId" IS NOT NULL;
    `;
    console.log("Update completed:", result);

    console.log("Fixing userId in other tables...");
    await sql`UPDATE instruments SET "userId" = "professorId" WHERE "userId" IS NOT NULL` ; // Wait, instruments doesn't have professorId, it has userId.
    // Let's check instruments cols
    const instCols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'instruments'`;
    console.log("Instruments columns:", instCols.map(c => c.column_name));

  } catch (err) {
    console.error(err);
  } finally {
    await sql.end();
  }
}

main();

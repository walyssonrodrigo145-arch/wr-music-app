import postgres from 'postgres';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL não encontrada no ambiente.");
  process.exit(1);
}

const sql = postgres(url);

async function run() {
  console.log("Tentando remover a restrição NOT NULL da coluna studentId...");
  try {
    await sql`ALTER TABLE "lessons" ALTER COLUMN "studentId" DROP NOT NULL;`;
    console.log("Sucesso: A coluna studentId agora permite valores nulos.");
  } catch (error) {
    console.error("Erro ao tentar alterar a coluna:", error.message);
  } finally {
    await sql.end();
    process.exit(0);
  }
}

run();

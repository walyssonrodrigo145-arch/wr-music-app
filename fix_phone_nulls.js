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
  console.log("Tentando remover valores nulos da coluna 'phone' na tabela 'students'...");
  try {
    const result = await sql`UPDATE "students" SET "phone" = '' WHERE "phone" IS NULL;`;
    console.log(`Sucesso: ${result.count} registros atualizados.`);
  } catch (error) {
    console.error("Erro ao tentar atualizar a tabela:", error.message);
  } finally {
    await sql.end();
    process.exit(0);
  }
}

run();

import 'dotenv/config';
import { getDb } from './server/db';
import { sql } from 'drizzle-orm';

async function fixRls() {
  console.log("Iniciando remoção de RLS...");
  const db = await getDb();
  if (!db) {
    console.error("Banco de dados não disponível");
    return;
  }

  const tables = [
    'users', 
    'students', 
    'lessons', 
    'instruments', 
    'reminders', 
    'reminderTemplates', 
    'paymentDues', 
    'settings'
  ];

  for (const table of tables) {
    try {
      await db.execute(sql.raw(`ALTER TABLE "${table}" DISABLE ROW LEVEL SECURITY`));
      console.log(`✅ RLS desativado para: ${table}`);
    } catch (e: any) {
      console.warn(`⚠️ Não foi possível desativar RLS para ${table}: ${e.message}`);
    }
  }

  console.log("Processo concluído!");
  process.exit(0);
}

fixRls().catch(err => {
  console.error("Falha ao executar script:", err);
  process.exit(1);
});

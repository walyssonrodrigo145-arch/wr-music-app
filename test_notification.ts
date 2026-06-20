import 'dotenv/config';
import { getDb } from './server/db';
import { notifyUser } from './server/_core/notification';

async function test() {
  const db = await getDb();
  if (!db) {
    console.error("No db");
    process.exit(1);
  }
  
  // Assumes user id 1 is the admin
  console.log("Sending test notification to user 1...");
  await notifyUser(1, {
    title: "🎸 Lembrete de Aula: Teste",
    content: "👤 Aluno: Aluno Teste\n📱 Número: (11) 99999-9999\n📅 Data: 20/06/2026\n⏰ Horário: 15:00",
  });
  console.log("Done.");
  process.exit(0);
}

test();

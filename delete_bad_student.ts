import { db } from './server/db';
import { reminders, students, lessons } from './server/db/schema';
import { like } from 'drizzle-orm';

async function run() {
  console.log('Buscando lembretes com falha...');
  const badReminders = await db.select().from(reminders).where(like(reminders.message, '%19 de maio de 2026%'));
  console.log('Lembretes encontrados:', badReminders);
  
  if (badReminders.length > 0) {
    const studentId = badReminders[0].studentId;
    console.log('Apagando aluno de ID:', studentId);
    
    // Apaga os lembretes vinculados
    // Note: in a real environment, you'd cascade or use proper keys.
    const deletedReminders = await db.delete(reminders).where(like(reminders.message, '%19 de maio de 2026%')).returning();
    console.log('Apagado:', deletedReminders.length, 'lembretes');
    
    if (studentId) {
      // Find the student just to print
      const s = await db.select().from(students).where(like(students.id, studentId));
      console.log('Aluno sendo apagado:', s);
      await db.delete(students).where(like(students.id, studentId));
      console.log('Aluno apagado com sucesso!');
    } else {
      console.log('O lembrete não tem studentId associado. Foi um lembrete avulso.');
    }
  } else {
    console.log('Nenhum lembrete encontrado com esse texto.');
  }
  process.exit(0);
}

run();

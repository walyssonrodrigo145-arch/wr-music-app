import { eq } from "drizzle-orm";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { users, students, lessons, reminders, paymentDues, settings, studentGoals, studentTimeline, studentFiles, chatMessages, aiConversations } from "./drizzle/schema";

async function main() {
  const url = "postgresql://postgres.cixbuubjeitckpqcifkq:tcziWltV3MBgbt4Q@aws-1-us-east-2.pooler.supabase.com:6543/postgres?sslmode=require";
  const queryClient = postgres(url, { max: 1, ssl: { rejectUnauthorized: false } });
  const db = drizzle(queryClient);

  try {
    const profs = await db.select().from(users).where(eq(users.email, "walyssonrodrigo145@gmail.com"));
    
    if (profs.length === 0) {
      console.log("Professor não encontrado.");
      return;
    }

    const prof = profs[0];
    const orgId = prof.organizationId;
    const profId = prof.id;

    console.log(`Excluindo Professor ${prof.name} (ID: ${profId}, Org: ${orgId})...`);

    // Obter todos os estudantes deste professor
    const studentList = await db.select({ id: students.id, studentUserId: students.studentUserId }).from(students).where(eq(students.professorId, profId));
    const studentIds = studentList.map(s => s.id);
    const linkedUserIds = studentList.map(s => s.studentUserId).filter(id => id !== null);

    console.log(`Encontrados ${studentIds.length} alunos.`);

    // Deletar em cascata:
    if (studentIds.length > 0) {
      console.log("Deletando timeline, metas e arquivos dos alunos...");
      for (const id of studentIds) {
        await db.delete(studentTimeline).where(eq(studentTimeline.studentId, id));
        await db.delete(studentGoals).where(eq(studentGoals.studentId, id));
        await db.delete(studentFiles).where(eq(studentFiles.studentId, id));
      }

      console.log("Deletando lembretes, pagamentos e aulas...");
      for (const id of studentIds) {
        await db.delete(reminders).where(eq(reminders.studentId, id));
        await db.delete(paymentDues).where(eq(paymentDues.studentId, id));
        await db.delete(lessons).where(eq(lessons.studentId, id));
      }

      console.log("Deletando a tabela de estudantes...");
      for (const id of studentIds) {
         await db.delete(students).where(eq(students.id, id));
      }
    }

    console.log("Deletando lembretes gerais, configuracoes, chat e conversas de IA do professor...");
    await db.delete(reminders).where(eq(reminders.userId, profId));
    await db.delete(settings).where(eq(settings.userId, profId));
    await db.delete(aiConversations).where(eq(aiConversations.userId, profId));
    
    // Delete chat messages for prof
    await db.delete(chatMessages).where(eq(chatMessages.senderId, profId));
    await db.delete(chatMessages).where(eq(chatMessages.receiverId, profId));

    console.log("Deletando o usuário professor e usuários dos estudantes linkados...");
    for (const uid of linkedUserIds) {
      await db.delete(chatMessages).where(eq(chatMessages.senderId, uid as number));
      await db.delete(chatMessages).where(eq(chatMessages.receiverId, uid as number));
      await db.delete(users).where(eq(users.id, uid as number));
    }
    await db.delete(users).where(eq(users.id, profId));

    console.log("Professor excluído com sucesso.");

  } catch(e) {
    console.error("Erro:", e);
  } finally {
    await queryClient.end();
  }
}

main();

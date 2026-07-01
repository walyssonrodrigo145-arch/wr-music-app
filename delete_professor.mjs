import postgres from 'postgres';
import dotenv from 'dotenv';
dotenv.config();

const sql = postgres(process.env.DATABASE_URL);
const TARGET_EMAIL = 'walysson.rodriguesaulas@gmail.com';

async function run() {
  try {
    // 1. Buscar o usuário pelo email
    const users = await sql`SELECT id, name, role, "organizationId" FROM users WHERE email = ${TARGET_EMAIL} LIMIT 1`;

    if (users.length === 0) {
      console.log(`Usuário "${TARGET_EMAIL}" NÃO encontrado no banco. Já foi deletado ou nunca existiu.`);
      return;
    }

    const user = users[0];
    console.log(`Usuário encontrado: id=${user.id} | nome=${user.name} | role=${user.role} | org=${user.organizationId}`);

    // 2. Buscar o registro em professores
    const profs = await sql`SELECT id FROM professores WHERE "userId" = ${user.id} LIMIT 1`;

    if (profs.length > 0) {
      const profId = profs[0].id;
      console.log(`Professor encontrado: professorId=${profId}`);

      // 3. Deletar pagamentos do professor
      await sql`DELETE FROM professor_payments WHERE "professorId" = ${profId}`;
      console.log(`  professor_payments deletados`);

      // 4. Deletar registro do professor
      await sql`DELETE FROM professores WHERE id = ${profId}`;
      console.log(`  professores registro deletado`);
    } else {
      console.log(`Nenhum registro em professores encontrado para este usuário.`);
    }

    // 5. Deletar o usuário
    await sql`DELETE FROM users WHERE id = ${user.id}`;
    console.log(`Usuário deletado com sucesso!`);
    console.log(`\n✅ Email "${TARGET_EMAIL}" está LIVRE para novo cadastro.`);

  } catch(e) {
    console.error('Erro:', e);
  } finally {
    await sql.end();
    process.exit(0);
  }
}

run();

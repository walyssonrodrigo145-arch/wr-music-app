import pg from 'pg';
import { config } from 'dotenv';
config();

const { Client } = pg;

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    
    // Deleta do painel de lembretes
    console.log("Deletando lembrete avulso com falha...");
    const res = await client.query(`
      DELETE FROM "reminders"
      WHERE message LIKE '%19 de maio de 2026%' AND type = 'payment_due'
      RETURNING *;
    `);
    
    console.log("Removido:", res.rowCount, "lembrete(s)");
    console.log(res.rows);

  } catch (err) {
    console.error("Erro:", err);
  } finally {
    await client.end();
  }
}

run();

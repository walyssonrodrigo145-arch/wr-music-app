require('dotenv').config();
const postgres = require('postgres');
const crypto = require('crypto');
const sql = postgres(process.env.DATABASE_URL);

async function run() {
  try {
    const salt = crypto.randomBytes(16).toString('hex');
    const derivedKey = crypto.scryptSync('MusicPro123!', salt, 64).toString('hex');
    const passwordHash = salt + ':' + derivedKey;
    await sql`UPDATE users SET "passwordHash" = ${passwordHash} WHERE id = 1523`;
    console.log('Senha do Pedro atualizada para MusicPro123!');
  } catch (e) {
    console.error("ERRO:", e.message);
  } finally {
    await sql.end();
    process.exit();
  }
}
run();

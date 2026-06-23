const postgres = require('postgres');
const sql = postgres('postgresql://postgres:password_seguro_db_local@localhost:5432/wrmusic');

async function main() {
  try {
    await sql`ALTER TABLE organizations ADD COLUMN "planId" VARCHAR(50) DEFAULT 'premium' NOT NULL;`;
    console.log('Sucesso');
  } catch (e) {
    if (e.message.includes('already exists')) {
      console.log('Coluna já existe');
    } else {
      console.error(e);
    }
  } finally {
    process.exit(0);
  }
}

main();

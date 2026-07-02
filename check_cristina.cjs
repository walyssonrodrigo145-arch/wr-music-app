const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  const res = await pool.query('SELECT id, name, "allowAutoReminders" FROM students WHERE name ILIKE $1', ['%cristina%']);
  console.log(res.rows);
  process.exit(0);
}

run().catch(console.error);

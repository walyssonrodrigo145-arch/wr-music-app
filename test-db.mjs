import pg from 'pg';

async function run() {
  const pool = new pg.Pool({ connectionString: 'postgresql://postgres:password_seguro_db_local@localhost:5432/wrmusic' });
  const users = await pool.query('SELECT id, name, role, "organizationId", "openId" FROM users LIMIT 5');
  console.log('Users:', users.rows);
  const students = await pool.query('SELECT id, name, "professorId", "organizationId", status, "monthlyFee" FROM students');
  console.log('Students:', students.rows);
  process.exit(0);
}
run();

const postgres = require('postgres');
require('dotenv').config();

async function main() {
    const sql = postgres(process.env.DATABASE_URL);
    const email = "pedro.henrique@musicpro.com";
    const res = await sql`SELECT id, name, email, role, "studentId" FROM users WHERE email = ${email}`;
    console.log(JSON.stringify(res, null, 2));
    process.exit(0);
}

main();

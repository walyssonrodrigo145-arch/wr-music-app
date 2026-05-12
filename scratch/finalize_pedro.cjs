const postgres = require('postgres');
require('dotenv').config();
const crypto = require('crypto');

async function main() {
    const sql = postgres(process.env.DATABASE_URL);
    
    const password = "123456";
    const salt = crypto.randomBytes(16).toString("hex");
    const derivedKey = crypto.scryptSync(password, salt, 64).toString("hex");
    const passwordHash = `${salt}:${derivedKey}`;

    const res = await sql`
        UPDATE users 
        SET "passwordHash" = ${passwordHash}, 
            email = 'pedro.henrique@musicpro.com',
            "isEmailVerified" = true,
            "loginMethod" = 'local'
        WHERE id = 1523
        RETURNING id, email
    `;
    console.log("Final update successful:", JSON.stringify(res, null, 2));
    process.exit(0);
}

main();

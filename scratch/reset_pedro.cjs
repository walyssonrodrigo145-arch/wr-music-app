const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
const crypto = require('crypto');
require('dotenv').config();

async function main() {
    const connectionString = process.env.DATABASE_URL;
    const client = postgres(connectionString);
    const db = drizzle(client);

    const password = "123456";
    const salt = crypto.randomBytes(16).toString("hex");
    const derivedKey = crypto.scryptSync(password, salt, 64).toString("hex");
    const passwordHash = `${salt}:${derivedKey}`;

    // Pedro Henrique ID is 1523
    const result = await client`
        UPDATE users 
        SET "passwordHash" = ${passwordHash}, "loginMethod" = 'local', "isEmailVerified" = true
        WHERE id = 1523
        RETURNING id, email, "passwordHash"
    `;

    console.log("Password reset successful for Pedro:", result);
    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});

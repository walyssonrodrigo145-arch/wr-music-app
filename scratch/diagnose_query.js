import postgres from 'postgres';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.DATABASE_URL;
const sql = postgres(url);

async function check() {
  const openId = 'google_112845091862006702862';
  console.log(`Testing query for openId: ${openId}`);
  
  try {
    const result = await sql`
      select "id", "openId", "name", "email", "passwordHash", "loginMethod", "role", "isEmailVerified", "verificationToken", "verificationTokenExpiresAt", "resetPasswordToken", "resetPasswordTokenExpiresAt", "createdAt", "updatedAt", "lastSignedIn" 
      from "users" 
      where "openId" = ${openId} 
      limit 1
    `;
    console.log("Query result:", result);
  } catch (error) {
    console.error("QUERY FAILED!");
    console.error("Error Code:", error.code);
    console.error("Error Message:", error.message);
    if (error.detail) console.error("Error Detail:", error.detail);
    if (error.hint) console.error("Error Hint:", error.hint);
    if (error.where) console.error("Error Where:", error.where);
  } finally {
    await sql.end();
  }
}

check();

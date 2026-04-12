import postgres from "postgres";
import fs from "fs";

async function run() {
  const envContent = fs.readFileSync(".env", "utf8");
  let url = "";
  for (const line of envContent.split("\n")) {
    if (line.startsWith("DATABASE_URL=")) {
      url = line.substring(13).trim().replace(/"/g, '');
    }
  }
  
  if (!url) {
    console.error("DATABASE_URL not found in .env");
    process.exit(1);
  }
  
  console.log("Connecting to", url.substring(0, 20) + "...");
  const sql = postgres(url);
  
  try {
    const migrations = [
      { table: 'users', sql: 'ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "isEmailVerified" boolean DEFAULT false NOT NULL' },
      { table: 'users', sql: 'ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "verificationToken" text' },
      { table: 'users', sql: 'ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "verificationTokenExpiresAt" timestamp' },
      { table: 'users', sql: 'ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "resetPasswordToken" text' },
      { table: 'users', sql: 'ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "resetPasswordTokenExpiresAt" timestamp' },
      { table: 'lessons', sql: 'ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "rating" integer' },
      { table: 'lessons', sql: 'ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "instrumentId" integer' },
      { table: 'lessons', sql: 'ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "recurringGroupId" varchar(100)' },
      { table: 'students', sql: 'ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "instrumentId" integer' }
    ];

    for (const m of migrations) {
      try {
        await sql.unsafe(m.sql);
        console.log(`OK: ${m.table} - ${m.sql.split('ADD COLUMN IF NOT EXISTS ')[1]}`);
      } catch (e) {
        if (e.message.includes("already exists") || e.message.includes("já existe")) {
          console.log(`SKIP: ${m.table} já possui a coluna`);
        } else {
          console.warn(`ERROR: ${m.table} - ${e.message}`);
        }
      }
    }
    
    const result = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'lessons'
    `;
    console.log("\nColumns in 'lessons' table now:");
    console.table(result);

  } catch (error) {
    console.error("Error executing migrations:", error);
  } finally {
    await sql.end();
  }
}

run();

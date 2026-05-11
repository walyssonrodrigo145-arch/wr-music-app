import postgres from 'postgres';
import dotenv from 'dotenv';
dotenv.config();

const sql = postgres(process.env.DATABASE_URL, { ssl: { rejectUnauthorized: false } });

async function run() {
  try {
    console.log("Renaming students.userId to professorId...");
    await sql`ALTER TABLE "students" RENAME COLUMN "userId" TO "professorId"`;
    
    console.log("Updating roleEnum values...");
    // PostgreSQL doesn't easily allow renaming enum values or adding/removing from enum in one go if they are in use.
    // We might need to drop and recreate or just add the new one and update.
    
    // Check current enum values
    const result = await sql`SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE pg_type.typname = 'role'`;
    console.log("Current roles:", result.map(r => r.enumlabel));
    
    // Add 'aluno' if not exists
    try {
        await sql`ALTER TYPE role ADD VALUE IF NOT EXISTS 'aluno'`;
        console.log("Added 'aluno' role.");
    } catch (e) {
        console.log("'aluno' already exists or failed to add.");
    }

    // Update 'student' to 'aluno'
    console.log("Mapping 'student' role to 'aluno'...");
    await sql`UPDATE "users" SET role = 'aluno' WHERE role = 'student'`;
    
    // Update 'user' to 'professor'
    console.log("Mapping 'user' role to 'professor'...");
    await sql`UPDATE "users" SET role = 'professor' WHERE role = 'user'`;

    console.log("Success!");
  } catch (err) {
    console.error("Failed:", err);
  } finally {
    await sql.end();
  }
}

run();

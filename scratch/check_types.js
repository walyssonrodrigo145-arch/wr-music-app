import postgres from 'postgres';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.DATABASE_URL;
const sql = postgres(url);

async function check() {
  try {
    const types = await sql`
      SELECT n.nspname as schema, t.typname as type 
      FROM pg_type t 
      LEFT JOIN pg_namespace n ON n.oid = t.typnamespace 
      WHERE n.nspname = 'public';
    `;
    console.log("Types in 'public' schema:");
    console.table(types);

    const enums = await sql`
      SELECT n.nspname as enum_schema, t.typname as enum_name, e.enumlabel as enum_value
      FROM pg_type t 
      JOIN pg_enum e ON t.oid = e.enumtypid  
      JOIN pg_namespace n ON n.oid = t.typnamespace
      ORDER BY enum_name, e.enumsortorder;
    `;
    console.log("Enums in database:");
    console.table(enums);

  } catch (error) {
    console.error("Error checking types:", error);
  } finally {
    await sql.end();
  }
}

check();

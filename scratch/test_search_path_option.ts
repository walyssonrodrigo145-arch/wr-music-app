
import postgres from 'postgres';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.DATABASE_URL!;

async function test() {
  console.log("Testing search_path via connection options");
  const sql = postgres(url, {
    connection: {
      options: "-c search_path=public"
    }
  });
  
  try {
    const result = await sql`SHOW search_path;`;
    console.log("Search path:", result);
  } catch (error: any) {
    console.error("FAILED to set search_path:", error.message);
  } finally {
    await sql.end();
  }
}

test();

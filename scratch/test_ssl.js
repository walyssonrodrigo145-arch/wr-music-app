import postgres from 'postgres';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.DATABASE_URL;

async function test(useSsl) {
  console.log(`Testing with SSL: ${useSsl}`);
  const options = useSsl ? { ssl: 'require' } : {};
  const sql = postgres(url, options);
  
  try {
    const result = await sql`SELECT 1 as connected;`;
    console.log(`Success with SSL: ${useSsl}`, result);
  } catch (error) {
    console.error(`FAILED with SSL: ${useSsl}`);
    console.error("Error:", error.message);
  } finally {
    await sql.end();
  }
}

async function run() {
  await test(false);
  await test(true);
}

run();

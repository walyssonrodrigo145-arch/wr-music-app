
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
// @ts-ignore
import { users } from "../drizzle/schema.ts"; 
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is missing");
  process.exit(1);
}

const queryClient = postgres(url, {
  connection: {
    options: "-c search_path=public"
  }
});
const db = drizzle(queryClient);

async function check() {
  const openId = 'google_112845091862006702862';
  console.log(`Testing Drizzle query for openId: ${openId}`);
  
  try {
    const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
    console.log("Drizzle result:", result);
  } catch (error: any) {
    console.error("DRIZZLE QUERY FAILED!");
    console.error("Error Message:", error.message);
    if (error.driverError) {
      console.error("Driver Error Code:", error.driverError.code);
      console.error("Driver Error Detail:", error.driverError.detail);
      console.error("Driver Error Table:", error.driverError.table);
      console.error("Driver Error Schema:", error.driverError.schema);
    }
    // Also check for the "Failed query" format
    if (error.toString().includes("Failed query")) {
       console.log("Captured expected error format!");
    }
  } finally {
    await queryClient.end();
  }
}

check();

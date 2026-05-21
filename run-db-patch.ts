import "dotenv/config";
import { getDb } from "./server/db";
import postgres from "postgres";

async function run() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is missing");
  }
  const sql = postgres(connectionString, { max: 1 });

  console.log("Creating chatbot_sessions table...");
  await sql`
    CREATE TABLE IF NOT EXISTS "chatbot_sessions" (
      "id" serial PRIMARY KEY NOT NULL,
      "organizationId" integer,
      "phone" varchar(30) NOT NULL,
      "state" varchar(50) DEFAULT 'START' NOT NULL,
      "data" text,
      "updatedAt" timestamp DEFAULT now() NOT NULL,
      "createdAt" timestamp DEFAULT now() NOT NULL,
      CONSTRAINT "chatbot_sessions_phone_unique" UNIQUE("phone")
    );
  `;
  console.log("Table created successfully!");
  process.exit(0);
}

run().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});

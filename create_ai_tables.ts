import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as dotenv from 'dotenv';
dotenv.config();

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString);
const db = drizzle(client);

async function main() {
  console.log("Criando tabelas da IA...");
  try {
    await client`
      CREATE TABLE IF NOT EXISTS "ai_conversations" (
        "id" serial PRIMARY KEY NOT NULL,
        "organizationId" integer NOT NULL,
        "userId" integer NOT NULL,
        "title" varchar(255) NOT NULL,
        "createdAt" timestamp DEFAULT now() NOT NULL,
        "updatedAt" timestamp DEFAULT now() NOT NULL
      );
    `;
    console.log("ai_conversations OK");

    await client`
      CREATE TABLE IF NOT EXISTS "ai_messages" (
        "id" serial PRIMARY KEY NOT NULL,
        "conversationId" integer NOT NULL,
        "role" varchar(50) NOT NULL,
        "content" text NOT NULL,
        "createdAt" timestamp DEFAULT now() NOT NULL
      );
    `;
    console.log("ai_messages OK");

    process.exit(0);
  } catch (err) {
    console.error("Erro:", err);
    process.exit(1);
  }
}

main();

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, ilike } from 'drizzle-orm';
import { users } from './drizzle/schema';
import * as dotenv from 'dotenv';
dotenv.config();

async function run() {
  const queryClient = postgres(process.env.DATABASE_URL!);
  const db = drizzle(queryClient);
  await db.delete(users).where(eq(users.role, 'admin')).where(ilike(users.email, 'jhonatan%'));
  console.log('Cleaned up incorrect Jhonatan admins');
  process.exit(0);
}

run().catch(console.error);

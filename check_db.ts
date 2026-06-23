import { db } from './server/db';
import { organizations } from './shared/schema';
import { desc } from 'drizzle-orm';

async function check() {
  const orgs = await db.select().from(organizations).orderBy(desc(organizations.id)).limit(1);
  console.log(orgs);
  process.exit(0);
}

check();

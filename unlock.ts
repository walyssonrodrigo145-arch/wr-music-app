import { db } from './server/db/index';
import { organizations } from './server/db/schema';
import { eq } from 'drizzle-orm';

async function run() {
  console.log("Desbloqueando contas...");
  await db.update(organizations).set({
    subscriptionStatus: 'active',
    trialEndsAt: null,
  });
  console.log("Todas as organizações foram marcadas como ativas.");
  process.exit(0);
}

run().catch(console.error);

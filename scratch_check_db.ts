import { getDb } from './server/db';
import { dailyStudyPlans } from './drizzle/schema';
import { desc } from 'drizzle-orm';

async function main() {
  const db = await getDb();
  const plans = await db.select().from(dailyStudyPlans).orderBy(desc(dailyStudyPlans.id)).limit(5);
  console.log(plans.map(p => ({ id: p.id, daysCompleted: p.daysCompleted })));
  process.exit(0);
}
main();

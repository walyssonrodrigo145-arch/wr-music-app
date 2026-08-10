const postgres = require('postgres');

const sql = postgres('postgres://postgres:postgres@db:5432/wrmusic', { max: 1 });

(async () => {
  // Mesma query do getEvolutionStats com Date params
  const params = [
    'pago',
    new Date('2026-03-01T00:00:00-03:00'),
    new Date('2026-03-31T23:59:59-03:00'),
  ];
  try {
    const res = await sql`select COALESCE(SUM(CAST("amount" AS NUMERIC)), 0) from "payment_dues" where (("payment_dues"."status" = ${params[0]} or "payment_dues"."paidAt" IS NOT NULL) and COALESCE("payment_dues"."paidAt", "payment_dues"."dueDate") >= ${params[1]} and COALESCE("payment_dues"."paidAt", "payment_dues"."dueDate") <= ${params[2]})`;
    console.log('Q1 OK:', res);
  } catch (e) {
    console.log('Q1 ERRO FULL:', JSON.stringify(e, Object.getOwnPropertyNames(e)));
    console.log('Q1 message:', e.message);
  }

  try {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const res2 = await sql`select "users"."organizationId", MAX("analytics_online"."last_ping_at"), CAST(COUNT(DISTINCT "analytics_online"."user_id") FILTER (WHERE "analytics_online"."last_ping_at" >= ${fiveMinAgo}) AS INT) from "analytics_online" inner join "users" on "users"."id" = "analytics_online"."user_id" where ("users"."organizationId" is not null and "analytics_online"."last_ping_at" >= ${sevenDaysAgo}) group by "users"."organizationId"`;
    console.log('Q2 OK:', res2);
  } catch (e) {
    console.log('Q2 ERRO FULL:', JSON.stringify(e, Object.getOwnPropertyNames(e)));
    console.log('Q2 message:', e.message);
  }

  await sql.end();
})();

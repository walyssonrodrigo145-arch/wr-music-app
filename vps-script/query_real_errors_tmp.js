const { Client } = require('ssh2');

const conn = new Client();
const config = {
  host: '179.197.76.174',
  port: 22,
  username: 'root',
  password: 'Walysson2003@',
  readyTimeout: 30000
};

const runQuery = (label, sql) => {
  return new Promise((resolve) => {
    const cmd = `cd /root/wr-music-app && docker compose exec -T db psql -U postgres -d wrmusic -c "${sql.replace(/"/g, '\\"')}"`;
    conn.exec(cmd, (err, stream) => {
      if (err) { console.log('\n### ' + label + ' — ERRO: ' + err.message); resolve(); return; }
      let data = '';
      stream.on('data', d => data += d.toString());
      stream.stderr.on('data', d => data += d.toString());
      stream.on('close', () => { console.log('\n### ' + label + '\n' + data); resolve(); });
    });
  });
};

conn.on('ready', async () => {
  await runQuery('Q1 evolution - payment_dues fallback', `SELECT COALESCE(SUM(CAST("amount" AS NUMERIC)), 0) FROM "payment_dues" WHERE (("payment_dues"."status" = 'pago' OR "payment_dues"."paidAt" IS NOT NULL) AND COALESCE("payment_dues"."paidAt", "payment_dues"."dueDate") >= '2026-03-01' AND COALESCE("payment_dues"."paidAt", "payment_dues"."dueDate") <= '2026-03-31 23:59:59');`);
  await runQuery('Q2 evolution - analyticsRevenue', `SELECT COALESCE(SUM(amount), '0') FROM "analytics_revenue" WHERE "analytics_revenue"."createdAt" >= '2026-03-01' AND "analytics_revenue"."createdAt" <= '2026-03-31 23:59:59';`);
  await runQuery('Q3 schools - heartbeat', `SELECT "users"."organizationId", MAX("analytics_online"."last_ping_at"), CAST(COUNT(DISTINCT "analytics_online"."user_id") FILTER (WHERE "analytics_online"."last_ping_at" >= now() - interval '5 minutes') AS INT) FROM "analytics_online" INNER JOIN "users" ON "users"."id" = "analytics_online"."user_id" WHERE ("users"."organizationId" IS NOT NULL AND "analytics_online"."last_ping_at" >= now() - interval '7 days') GROUP BY "users"."organizationId";`);
  await runQuery('Q4 schools - orgs join plan', `SELECT o.id, o.name, p.name AS plan_name FROM organizations o LEFT JOIN system_plans p ON p.id = o."planId";`);
  conn.end();
}).connect(config);

const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  const code = `
    import { drizzle } from "drizzle-orm/postgres-js";
    import postgres from "postgres";
    import { messageAutomationRules } from "./drizzle/schema.js";

    async function run() {
      console.log("Connecting...");
      const client = postgres(process.env.DATABASE_URL);
      const db = drizzle(client);
      try {
        const [rule] = await db.insert(messageAutomationRules).values({
          organizationId: 1,
          userId: 1,
          name: "Teste",
          trigger: "payment_due",
          messageTemplate: "Ola",
          channel: "whatsapp"
        }).returning();
        console.log("SUCCESS:", rule);
      } catch (e) {
        console.error("ERROR:", e);
      }
      process.exit(0);
    }
    run();
  `;
  const cmd = `docker exec wr-music-app-app-1 sh -c "echo '${code.replace(/'/g, "'\\''")}' > /app/test_insert.ts && npx tsx /app/test_insert.ts"`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    let out = '';
    stream.on('close', (code, signal) => {
      console.log('EXIT CODE:', code);
      console.log(out);
      conn.end();
    }).on('data', (data) => {
      out += data.toString();
    }).stderr.on('data', (data) => {
      out += data.toString();
    });
  });
}).connect({
  host: '76.13.228.159',
  port: 22,
  username: 'root',
  password: 'Walysson2003@'
});

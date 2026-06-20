const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  const cmd = `cd /root/wr-music-app && docker exec wr-music-app-app-1 sh -c 'echo "import \\"dotenv/config\\";
import { getDb } from \\"./server/db\\";
import { notifyUser } from \\"./server/_core/notification\\";

async function test() {
  const db = await getDb();
  if (!db) {
    console.error(\\"No db\\");
    process.exit(1);
  }
  console.log(\\"Sending test notification to user 1...\\");
  await notifyUser(1, {
    title: \\"🎸 Lembrete de Aula: Teste\\",
    content: \\"👤 Aluno: Aluno Teste\\n📱 Número: (11) 99999-9999\\n📅 Data: 20/06/2026\\n⏰ Horário: 15:00\\",
  });
  console.log(\\"Done.\\");
  process.exit(0);
}
test();" > test_vps.ts && npx tsx test_vps.ts'`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => {
      conn.end();
    }).on('data', d => process.stdout.write(d)).stderr.on('data', d => process.stderr.write(d));
  });
}).connect({
  host: '76.13.228.159',
  port: 22,
  username: 'root',
  password: 'Walysson2003@'
});

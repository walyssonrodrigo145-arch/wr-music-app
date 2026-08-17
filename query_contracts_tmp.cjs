const { Client } = require('ssh2');
const conn = new Client();
const SQL = `
SELECT 'SETTINGS org 35' AS titulo;
SELECT id, "userId", "organizationId", "schoolName", "schoolCnpj", "schoolAddress", "schoolCity", "schoolPhone", "schoolEmail" FROM settings WHERE "organizationId" = 35;
SELECT 'ALUNOS org 35' AS titulo;
SELECT id, name, phone, email, cpf, address, "instrumentId", "monthlyFee", "dueDay" FROM students WHERE "organizationId" = 35 ORDER BY id DESC LIMIT 5;
SELECT 'ULTIMOS CONTRATOS' AS titulo;
SELECT id, "contractNumber", title, status, "studentId", "templateId", "organizationId", "monthlyFee", "dueDay", "startDate", "endDate" FROM contracts ORDER BY id DESC LIMIT 6;
SELECT 'TEMPLATES org 35' AS titulo;
SELECT id, name, left(content, 120) AS content_inicio FROM contract_templates WHERE "organizationId" = 35 LIMIT 5;
`;
conn.on('ready', () => {
  conn.exec('cd /root/wr-music-app && docker compose exec -T db psql -U postgres -d wrmusic', (err, stream) => {
    if (err) { console.error('ERRO exec:', err.message); conn.end(); return; }
    let out = '';
    stream.on('close', () => { console.log(out); conn.end(); });
    stream.on('data', (d) => { out += d.toString(); });
    stream.stderr.on('data', (d) => { out += '[stderr] ' + d.toString(); });
    stream.stdin.write(SQL);
    stream.stdin.end();
  });
}).on('error', (e) => { console.error('ERRO SSH:', e.message); process.exit(1); })
  .connect({ host: '179.197.76.174', port: 22, username: 'root', password: 'Walysson2003@', readyTimeout: 60000 });

// Kit de migração Emusys -> MusicPro | 06 - Reconstruir financeiro 1:1
// Uso: node 06-reconstruir-financeiro.js [--commit]
// Apaga TODAS as faturas da organização alvo e reimporta exatamente as linhas do Emusys.

const fs = require('fs');
const net = require('net');
const path = require('path');
const DIR = path.join(__dirname, '..');
const cfg = require('./lib/util.js').carregarConfig();
const { Client } = require(require.resolve('ssh2', { paths: [DIR] }));
const postgres = require(require.resolve('postgres', { paths: [DIR] }));
const vps = cfg.vps;
const dir = path.join(__dirname, 'saida');
const data = JSON.parse(fs.readFileSync(path.join(dir, 'import-data.json'), 'utf8'));
const COMMIT = process.argv.includes('--commit');
const ORG = cfg.target.organizationId, DB_IP = cfg.db.containerIp;

const normalize = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

(async () => {
  const ssh = new Client();
  await new Promise((res, rej) => ssh.on('ready', res).on('error', rej).connect(vps));
  const server = net.createServer((local) => {
    ssh.forwardOut('127.0.0.1', local.remotePort, DB_IP, 5432, (err, stream) => {
      if (err) { local.destroy(); return; }
      local.pipe(stream).pipe(local);
      local.on('error', () => stream.destroy());
      stream.on('error', () => local.destroy());
    });
  });
  await new Promise((res) => server.listen(15437, res));
  const sql = postgres({ host: '127.0.0.1', port: 15437, user: 'postgres', password: cfg.db.password, database: cfg.db.database, max: 3, idle_timeout: 30 });

  const alunos = await sql`SELECT id, name, "professorId" FROM students WHERE "organizationId"=${ORG}`;
  const byNorm = new Map();
  for (const a of alunos) if (!byNorm.has(normalize(a.name))) byNorm.set(normalize(a.name), a);
  const resolve = (raw) => {
    const n = normalize(raw);
    if (!n) return null;
    if (byNorm.has(n)) return byNorm.get(n);
    const parts = n.split(' ');
    if (parts.length >= 2) {
      for (const [key, a] of byNorm) {
        const kp = key.split(' ');
        if (kp.length >= 2 && kp[0] === parts[0] && kp[kp.length - 1] === parts[parts.length - 1]) return a;
      }
      for (const [key, a] of byNorm) {
        const kp = key.split(' ');
        if (kp.length >= 2 && (key.includes(n) || n.includes(key)) && Math.abs(kp.length - parts.length) <= 2) return a;
      }
    }
    return null;
  };

  const rows = [];
  let semAluno = 0, dupExato = 0;
  for (const d of data.dues) {
    const st = resolve(d.nome);
    if (!st) { semAluno++; continue; }
    rows.push({ studentId: st.id, userId: st.professorId, amount: d.amount.toFixed(2), dueDate: d.dueDate, paidAt: d.paidDate ? `${d.paidDate} 12:00:00` : null, status: d.status, month: d.month, year: d.year, notes: `Importado do Emusys: ${d.fatura}${d.forma ? ' | Forma: ' + d.forma : ''}`.slice(0, 400) });
  }

  const esperado = {};
  for (const r of rows) {
    const y = r.year;
    esperado[y] = esperado[y] || { n: 0, total: 0, pago: 0, pagoN: 0, pendente: 0, pendN: 0, atrasado: 0, atrN: 0 };
    const e = esperado[y];
    e.n++; e.total += Number(r.amount);
    if (r.status === 'pago') { e.pago += Number(r.amount); e.pagoN++; }
    else if (r.status === 'atrasado') { e.atrasado += Number(r.amount); e.atrN++; }
    else { e.pendente += Number(r.amount); e.pendN++; }
  }

  const atual = await sql`SELECT count(*) AS n, coalesce(sum(amount),0)::numeric(12,2) AS total FROM payment_dues WHERE "organizationId"=${ORG}`;
  console.log(`atual no banco: n=${atual[0].n} total=${atual[0].total}`);
  console.log(`novo conjunto: n=${rows.length} | sem aluno=${semAluno} | duplicatas exatas=${dupExato}`);
  console.log('esperado por ano:');
  for (const y of Object.keys(esperado).sort()) {
    const e = esperado[y];
    console.log(`  ${y}: n=${e.n} total=${e.total.toFixed(2)} | pago=${e.pago.toFixed(2)}(${e.pagoN}) pend=${e.pendente.toFixed(2)}(${e.pendN}) atr=${e.atrasado.toFixed(2)}(${e.atrN})`);
  }

  if (!COMMIT) {
    console.log('\nsimulação ok (rode com --commit para gravar)');
    await sql.end(); server.close(); ssh.end();
    return;
  }

  const result = await sql.begin(async (tx) => {
    const del = await tx`DELETE FROM payment_dues WHERE "organizationId"=${ORG}`;
    let ins = 0;
    for (const r of rows) {
      await tx`INSERT INTO payment_dues ("organizationId","userId","studentId",amount,"dueDate","paidAt",status,month,year,notes,"billingPeriodicity") VALUES (${ORG},${r.userId},${r.studentId},${r.amount},${r.dueDate},${r.paidAt},${r.status},${r.month},${r.year},${r.notes},'mensal')`;
      ins++;
    }
    return { deletadas: del.count, inseridas: ins };
  });
  console.log('\nEXECUTADO:', JSON.stringify(result));

  const verif = await sql`SELECT year, status, count(*) AS n, sum(amount)::numeric(12,2) AS total FROM payment_dues WHERE "organizationId"=${ORG} GROUP BY year, status ORDER BY year, status`;
  console.log('\nverificação final (MusicPro):');
  for (const v of verif) console.log(`  ${v.year} ${v.status}: n=${v.n} total=${v.total}`);
  const total = await sql`SELECT count(*) AS n, sum(amount)::numeric(12,2) AS total FROM payment_dues WHERE "organizationId"=${ORG}`;
  console.log(`TOTAL: n=${total[0].n} valor=${total[0].total}`);

  await sql.end(); server.close(); ssh.end();
})().catch(e => { console.error('ERRO:', e.message); process.exit(1); });

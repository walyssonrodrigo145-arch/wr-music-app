// Kit de migração Emusys -> MusicPro | 05 - Arquivar inativos (Histórico)
// Uso: node 05-arquivar-inativos.js [--commit]

﻿const fs = require('fs');
const net = require('net');
const path = require('path');
const DIR = path.join(__dirname, '..');
const cfg = require('./lib/util.js').carregarConfig();
const { Client } = require(require.resolve('ssh2', { paths: [DIR] }));
const postgres = require(require.resolve('postgres', { paths: [DIR] }));
const vps = cfg.vps;
const COMMIT = process.argv.includes('--commit');
const ORG = cfg.target.organizationId, ADMIN = cfg.target.adminUserId, DB_IP = cfg.db.containerIp;

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
  await new Promise((res) => server.listen(15435, res));
  const sql = postgres({ host: '127.0.0.1', port: 15435, user: 'postgres', password: cfg.db.password, database: cfg.db.database, max: 3, idle_timeout: 20 });

  const todos = await sql`SELECT status, count(*) AS n FROM students WHERE "organizationId"=${ORG} GROUP BY status ORDER BY status`;
  console.log('por status:', todos.map(r => `${r.status}=${r.n}`).join(' | '));

  const alvos = await sql`SELECT id, name, notes FROM students WHERE "organizationId"=${ORG} AND status='inativo' AND "deletedAt" IS NULL ORDER BY id`;
  console.log('inativos a arquivar:', alvos.length);

  const plano = alvos.map(s => {
    const datas = [...(s.notes || '').matchAll(/Conclu[íi]do em (\d{2})\/(\d{2})\/(\d{4})/gi)].map(m => `${m[3]}-${m[2]}-${m[1]}`);
    datas.sort();
    const temAndamento = /Em Andamento/i.test(s.notes || '');
    const conclusao = datas.length ? datas[datas.length - 1] : null;
    const exitReason = (conclusao && !temAndamento) ? 'conclusao' : 'outro';
    const exitNotes = conclusao
      ? `Importado do Emusys — aluno concluído em ${conclusao.split('-').reverse().join('/')}.`
      : 'Importado do Emusys — aluno já era inativo na migração (sem data de conclusão).';
    return { id: s.id, name: s.name, exitReason, exitNotes, deletedAt: conclusao ? new Date(`${conclusao}T12:00:00`) : new Date() };
  });

  const porMotivo = plano.reduce((acc, p) => { acc[p.exitReason] = (acc[p.exitReason] || 0) + 1; return acc; }, {});
  const comData = plano.filter(p => p.deletedAt).length;
  console.log('motivos:', JSON.stringify(porMotivo), '| com data de conclusão:', comData, '| sem data (usará agora):', plano.length - comData);
  console.log('amostra:', plano.slice(0, 3).map(p => `${p.name} (${p.exitReason}, ${p.deletedAt || 'agora'})`).join(' || '));

  if (!COMMIT) {
    console.log('\nsimulação ok (rode com --commit para gravar)');
    await sql.end(); server.close(); ssh.end();
    return;
  }

  const n = await sql.begin(async (tx) => {
    let count = 0;
    for (const p of plano) {
      await tx`UPDATE students SET "deletedAt" = ${p.deletedAt}, "deletedBy" = ${ADMIN}, "exitReason" = ${p.exitReason}, "exitNotes" = ${p.exitNotes}, "updatedAt" = now() WHERE id = ${p.id}`;
      count++;
    }
    return count;
  });

  const resumo = await sql`SELECT count(*) FILTER (WHERE status='inativo' AND "deletedAt" IS NULL) AS visiveis_inativos, count(*) FILTER (WHERE "deletedAt" IS NOT NULL) AS arquivados, count(*) FILTER (WHERE "deletedAt" IS NULL) AS visiveis FROM students WHERE "organizationId"=${ORG}`;
  console.log(`\nARQUIVADOS: ${n} alunos`);
  console.log('resumo org 33:', JSON.stringify(resumo[0]));
  await sql.end(); server.close(); ssh.end();
})().catch(e => { console.error('ERRO:', e.message); process.exit(1); });

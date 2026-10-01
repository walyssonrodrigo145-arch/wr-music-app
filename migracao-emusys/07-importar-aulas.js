// Kit de migração Emusys -> MusicPro | 07 - Importar aulas (agenda + histórico)
// Uso: node 07-importar-aulas.js [--commit]
// Lê saida/aulas-parseadas.json (gerado pelo 02-extrair-aulas.js).

const fs = require('fs');
const net = require('net');
const path = require('path');
const DIR = path.join(__dirname, '..');
const cfg = require('./lib/util.js').carregarConfig();
const { Client } = require(require.resolve('ssh2', { paths: [DIR] }));
const postgres = require(require.resolve('postgres', { paths: [DIR] }));
const vps = cfg.vps;
const COMMIT = process.argv.includes('--commit');
const dir = path.join(__dirname, 'saida');
const ORG = cfg.target.organizationId, ADMIN = cfg.target.adminUserId, DB_IP = cfg.db.containerIp;

const normalize = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const titleCase = (s) => String(s || '').toLowerCase().replace(/(^|\s|\bd[aeo]s?\s)([a-zà-ú])/g, (m, p, c) => p + c.toUpperCase());
const MESES = { janeiro: 1, fevereiro: 2, marco: 3, 'março': 3, abril: 4, maio: 5, junho: 6, julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12 };

const INSTR_RULES = [
  [/violao|violão/i, 'Violão'], [/guitarra|guitar/i, 'Guitarra'], [/cavaquinho/i, 'Cavaquinho'], [/viola caipira/i, 'Viola Caipira'],
  [/ukulele|ukulelê/i, 'Ukulelê'], [/bateria/i, 'Bateria'], [/percuss/i, 'Percussão'], [/piano/i, 'Piano'],
  [/teclado|teclas/i, 'Teclado'], [/violino/i, 'Violino'], [/teoria/i, 'Teoria Musical'], [/flauta/i, 'Flauta Transversal'],
  [/gaita/i, 'Gaita'], [/canto|vocal/i, 'Canto'], [/contra\s*baixo|contra\s*baico|baixo/i, 'Contrabaixo'],
  [/acorde[aã]o/i, 'Acordeão'], [/sax/i, 'Saxofone'], [/trompete/i, 'Trompete'], [/clarinete/i, 'Clarinete'],
  [/violoncelo|cello/i, 'Violoncelo'], [/musicaliza/i, 'Musicalização'], [/aprenda ingl/i, 'Aprenda Inglês Cantando'],
];
const instrDoCurso = (curso) => { for (const [re, nome] of INSTR_RULES) if (re.test(curso || '')) return nome; return null; };

(async () => {
  const aulas = JSON.parse(fs.readFileSync(path.join(dir, 'aulas-parseadas.json'), 'utf8'));
  const alunos = JSON.parse(fs.readFileSync(path.join(dir, 'alunos-todos.json'), 'utf8'));
  const nomePorMatricula = new Map(alunos.map(a => [a.matriculaId, a.nomeEIdade.replace(/Idade:.*/i, '').trim().replace(/\s+/g, ' ')]));

  // overrides de falta (Aulas Não Efetivadas)
  const faltas = new Set();
  const csvNe = path.join(dir, 'exports', fs.readdirSync(path.join(dir, 'exports')).find(f => f.includes('JeYjla1') && f.endsWith('.csv')));
  if (csvNe && fs.existsSync(csvNe)) {
    const raw = fs.readFileSync(csvNe, 'latin1');
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^"[^"]*?(\d{2})\s+([a-zç]+)\s+(\d{4})\s+[àa]s\s+(\d{2}):(\d{2})","([^"]+)"/i);
      if (m) {
        const mes = MESES[normalize(m[2])];
        if (mes) faltas.add(`${normalize(m[6])}|${m[3]}-${String(mes).padStart(2, '0')}-${m[1]}|${m[4]}:${m[5]}`);
      }
    }
  }
  console.log('overrides de falta (janela recente):', faltas.size);

  // túnel
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
  await new Promise((res) => server.listen(15440, res));
  const sql = postgres({ host: '127.0.0.1', port: 15440, user: 'postgres', password: cfg.db.password, database: cfg.db.database, max: 3, idle_timeout: 60 });

  const dbStudents = await sql`SELECT id, name, "professorId", "instrumentId" FROM students WHERE "organizationId"=${ORG}`;
  const byNorm = new Map();
  for (const s of dbStudents) if (!byNorm.has(normalize(s.name))) byNorm.set(normalize(s.name), s);
  const resolveAluno = (nome) => {
    const n = normalize(nome);
    if (byNorm.has(n)) return byNorm.get(n);
    const parts = n.split(' ');
    if (parts.length >= 2) {
      for (const [key, s] of byNorm) {
        const kp = key.split(' ');
        if (kp.length >= 2 && kp[0] === parts[0] && kp[kp.length - 1] === parts[parts.length - 1]) return s;
      }
    }
    return null;
  };

  const dbUsers = await sql`SELECT id, name FROM users WHERE "organizationId"=${ORG} AND role='professor'`;
  const userByName = new Map(dbUsers.map(u => [normalize(u.name), u.id]));
  const resolveProf = (nome) => {
    const n = normalize(nome);
    if (!n) return null;
    if (userByName.has(n)) return userByName.get(n);
    const parts = n.split(' ').filter(Boolean);
    for (const [key, id] of userByName) {
      const kp = key.split(' ');
      if (kp[0] === parts[0] || (parts[0].length > 3 && key.includes(parts[0]))) return id;
    }
    return null;
  };

  const dbRooms = await sql`SELECT id, name FROM studio_rooms WHERE "organizationId"=${ORG}`;
  const roomOf = (sala) => {
    if (!sala) return null;
    const n = normalize(sala);
    const r = dbRooms.find(x => normalize(x.name) === n);
    return r ? r.id : null;
  };
  const dbInstr = await sql`SELECT id, name FROM instruments WHERE "organizationId"=${ORG}`;
  const instrByName = new Map(dbInstr.map(i => [normalize(i.name), i.id]));

  const existentes = new Set((await sql`SELECT "studentId", "scheduledAt" FROM lessons WHERE "organizationId"=${ORG}`).map(l => `${l.studentId}|${new Date(l.scheduledAt).toISOString().slice(0, 16)}`));

  const hoje = new Date().toISOString().slice(0, 10);
  const rows = [];
  let semAluno = 0, dup = 0, nFalta = 0;
  for (const id of Object.keys(aulas)) {
    const rel = aulas[id];
    if (!rel || !rel.aulas || !rel.aulas.length) continue;
    const nome = rel.nome || nomePorMatricula.get(Number(id));
    const st = resolveAluno(nome);
    if (!st) { semAluno += rel.aulas.length; continue; }
    for (const a of rel.aulas) {
      const iso = `${a.data} ${a.hora}:00`;
      const key = `${st.id}|${a.data}T${a.hora}`;
      if (existentes.has(key)) { dup++; continue; }
      existentes.add(key);
      let status = a.data < hoje ? 'concluida' : 'agendada';
      if (faltas.has(`${normalize(nome)}|${a.data}|${a.hora}`)) { status = 'falta'; nFalta++; }
      const instrNome = instrDoCurso(a.curso);
      const cursoTxt = a.curso.replace(/\s+/g, ' ').trim();
      rows.push({
        studentId: st.id,
        userId: resolveProf(a.professor) || st.professorId || ADMIN,
        title: ('Aula de ' + titleCase(cursoTxt)).slice(0, 200),
        scheduledAt: iso,
        status,
        instrumentId: instrByName.get(normalize(instrNome || '')) || st.instrumentId || null,
        studioRoomId: roomOf(a.sala),
        notes: `Importado do Emusys — ${a.sala || 'sala ?'} | Prof. ${a.professor || '?'}`.slice(0, 500),
      });
    }
  }

  const passadas = rows.filter(r => r.status !== 'agendada').length;
  const futuras = rows.filter(r => r.status === 'agendada').length;
  console.log(`plano: ${rows.length} aulas a inserir (${passadas} passadas, ${futuras} futuras) | duplicadas existentes=${dup} | sem aluno=${semAluno} | faltas=${nFalta}`);
  if (rows.length) console.log('amostra:', JSON.stringify(rows[0]).slice(0, 220));

  if (!COMMIT) {
    console.log('\nsimulação ok (rode com --commit para gravar)');
    await sql.end(); server.close(); ssh.end();
    return;
  }

  const inserted = await sql.begin(async (tx) => {
    // remove agendamentos futuros criados manualmente (o Emusys é a fonte oficial da agenda)
    const del = await tx`DELETE FROM lessons WHERE "organizationId"=${ORG} AND status='agendada' AND "scheduledAt" >= now()`;
    console.log('agendamentos manuais futuros removidos:', del.count);
    let n = 0;
    for (let i = 0; i < rows.length; i += 200) {
      const chunk = rows.slice(i, i + 200);
      await tx`INSERT INTO lessons ("organizationId","userId","studentId",title,"scheduledAt",duration,status,"lessonType",notes,"instrumentId","studioRoomId","alertSent1h","alertSent30m","studentConfirmation")
        VALUES ${tx(chunk.map(r => [ORG, r.userId, r.studentId, r.title, r.scheduledAt, 60, r.status, 'individual', r.notes, r.instrumentId, r.studioRoomId, false, false, 'pendente']))}`;
      n += chunk.length;
      if (n % 2000 === 0) console.log('  ...', n);
    }
    return { del: del.count, n };
  });
  console.log('\nRESULTADO:', JSON.stringify(inserted));

  const total = await sql`SELECT count(*) AS n, count(*) FILTER (WHERE status='agendada' AND "scheduledAt" >= now()) AS futuras FROM lessons WHERE "organizationId"=${ORG}`;
  console.log('total de aulas na org:', JSON.stringify(total[0]));

  await sql.end(); server.close(); ssh.end();
})().catch(e => { console.error('ERRO:', e.message); console.error(e.stack?.split('\n').slice(0, 3).join('\n')); process.exit(1); });

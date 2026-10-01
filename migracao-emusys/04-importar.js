// Kit de migração Emusys -> MusicPro | 04 - Importação (banco)
// Uso: node 04-importar.js            (simulação)
//      node 04-importar.js --commit   (grava em transação única)
// Antes do commit: faça backup do banco e remova o índice uniq_payment_dues_org_student_month.

const fs = require('fs');
const path = require('path');
const net = require('net');
const DIR = path.join(__dirname, '..');
const cfg = require('./lib/util.js').carregarConfig();
const { Client } = require(require.resolve('ssh2', { paths: [DIR] }));
const postgres = require(require.resolve('postgres', { paths: [DIR] }));
const vps = cfg.vps;

const dir = path.join(__dirname, 'saida');
const data = JSON.parse(fs.readFileSync(path.join(dir, 'import-data.json'), 'utf8'));
const COMMIT = process.argv.includes('--commit');
const APP_URL = cfg.app.url;
const ORG = cfg.target.organizationId, ADMIN = cfg.target.adminUserId, DB_IP = cfg.db.containerIp;

const normalize = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const titleCase = (s) => String(s || '').toLowerCase().replace(/(^|\s|\bd[aeo]s?\s)([a-zà-ú])/g, (m, p, c) => p + c.toUpperCase());
const ROOM_RE = /na\s+(SALA\s*\d|RESID[ÊE]NCIA|[^,]{2,30})\s*$/i;
const WEEKDAYS = { domingo: 0, 'segunda-feira': 1, 'terca-feira': 2, 'quarta-feira': 3, 'quinta-feira': 4, 'sexta-feira': 5, sabado: 6 };
const parseAgenda = (agenda) => {
  const out = { weekday: null, timeStr: null, roomName: null };
  if (!agenda) return out;
  for (const [nome, idx] of Object.entries(WEEKDAYS)) if (normalize(agenda).startsWith(nome)) out.weekday = idx;
  const tm = agenda.match(/(\d{1,2}:\d{2})\s+[àa]s/i);
  if (tm) out.timeStr = tm[1].padStart(5, '0');
  const rm = agenda.match(ROOM_RE);
  if (rm) out.roomName = rm[1].trim();
  return out;
};
const parseInicio = (mmYY) => {
  if (!mmYY || !/^\d{2}\/\d{2}$/.test(mmYY)) return null;
  const [m, y] = mmYY.split('/').map(Number);
  if (m < 1 || m > 12) return null;
  return `20${String(y).padStart(2, '0')}-${String(m).padStart(2, '0')}-01`;
};
const durationOf = (plano, parcelas) => {
  const p = normalize(plano || '');
  if (p.includes('anual')) return 12;
  if (p.includes('semestral')) return 6;
  if (p.includes('trimestral')) return 3;
  return parcelas && parcelas > 0 ? parcelas : 12;
};

(async () => {
  // ---------- túnel SSH ----------
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
  await new Promise((res) => server.listen(15434, res));
  console.log('tunel ok');

  const sql = postgres({ host: '127.0.0.1', port: 15434, user: 'postgres', password: cfg.db.password, database: cfg.db.database, max: 4, idle_timeout: 20 });

  // ---------- guarda: índice único de faturas ----------
  const idx = await sql`SELECT indexname FROM pg_indexes WHERE tablename='payment_dues' AND indexname='uniq_payment_dues_org_student_month'`;
  if (idx.length) {
    console.error('\nATENCAO: o banco tem o índice uniq_payment_dues_org_student_month (1 fatura por aluno/mês).');
    console.error('O Emusys permite várias faturas no mesmo mês (2 cursos). Rode antes:');
    console.error("  docker exec <container-db> psql -U postgres -d <db> -c 'DROP INDEX uniq_payment_dues_org_student_month'");
    console.error('(o código do MusicPro já suporta a ausência deste índice)\n');
    process.exit(1);
  }

  // ---------- estado atual ----------
  const dbStudents = await sql`SELECT id, name, email, phone, cpf, address, "guardianName", "instrumentId", "professorId", "monthlyFee", "startDate", status FROM students WHERE "organizationId"=${ORG}`;
  const dbUsers = await sql`SELECT id, name, email, role FROM users WHERE "organizationId"=${ORG}`;
  const dbInstr = await sql`SELECT id, name, category FROM instruments WHERE "organizationId"=${ORG}`;
  const dbRooms = await sql`SELECT id, name FROM studio_rooms WHERE "organizationId"=${ORG}`;
  const dbDues = await sql`SELECT "studentId", month, year, amount FROM payment_dues WHERE "organizationId"=${ORG}`;
  const dbEnrolls = await sql`SELECT "studentId", "instrumentId" FROM student_enrollments WHERE "organizationId"=${ORG}`;
  const dbContracts = await sql`SELECT id FROM contracts WHERE "organizationId"=${ORG}`;
  console.log(`estado: students=${dbStudents.length} users=${dbUsers.length} instr=${dbInstr.length} rooms=${dbRooms.length} dues=${dbDues.length} enrolls=${dbEnrolls.length} contracts=${dbContracts.length}`);

  // ---------- mapas ----------
  const userByName = new Map();
  for (const u of dbUsers) userByName.set(normalize(u.name), u.id);
  const profMap = {};
  for (const p of data.professors) {
    const ov = (cfg.target.professorOverrides || {})[p.nome];
    if (ov) { profMap[p.nome] = ov; continue; }
    const existe = userByName.get(normalize(p.nome));
    profMap[p.nome] = existe || null;
  }
  const profsNovos = data.professors.filter(p => !profMap[p.nome]);

  const instrByName = new Map(dbInstr.map(i => [normalize(i.name), i.id]));
  const instrNovosNecessarios = new Set();
  const instrOf = (name) => name ? instrByName.get(normalize(name)) || null : null;
  for (const s of data.students) for (const b of s.blocks) { if (b.instrumento && !instrOf(b.instrumento)) instrNovosNecessarios.add(b.instrumento); }
  // extras fora das regras
  for (const extra of ['Aprenda Inglês Cantando']) if (!instrOf(extra)) instrNovosNecessarios.add(extra);

  const studentByName = new Map();
  for (const s of dbStudents) studentByName.set(normalize(s.name), s);
  const findStudent = (name) => {
    const n = normalize(name);
    if (studentByName.has(n)) return studentByName.get(n);
    const parts = n.split(' ');
    for (const [key, s] of studentByName) {
      const kp = key.split(' ');
      if (kp[0] === parts[0] && kp[kp.length - 1] === parts[parts.length - 1]) return s;
    }
    return null;
  };

  const roomOf = (name) => {
    if (!name) return null;
    const n = normalize(name);
    const r = dbRooms.find(x => normalize(x.name) === n || normalize(x.name).startsWith(n) || n.startsWith(normalize(x.name)));
    return r ? r.id : null;
  };

  // ---------- plano ----------
  let novosAlunos = 0, existentes = 0, updCampos = 0;
  const emailsUsados = new Set(dbStudents.map(s => (s.email || '').toLowerCase()).filter(Boolean));
  const planoAlunos = [];
  for (const s of data.students) {
    const exist = findStudent(s.nome);
    if (exist) {
      existentes++;
      const upd = {};
      if (!exist.email && s.email && !emailsUsados.has(s.email.toLowerCase())) { upd.email = s.email.toLowerCase(); emailsUsados.add(s.email.toLowerCase()); }
      if (!exist.phone && s.tel) upd.phone = s.tel;
      if (!exist.cpf && s.cpf) upd.cpf = s.cpf;
      if (!exist.address && s.endereco) upd.address = s.endereco;
      if (!exist.guardianName && s.responsavel) upd.guardianName = s.responsavel;
      if (!exist.instrumentId) { const bi = s.blocks.map(b => b.instrumento).filter(Boolean); if (bi.length) upd.instrumentName = bi[bi.length - 1]; }
      if (!exist.startDate && s.inicio) upd.startDate = s.inicio;
      if (Number(exist.monthlyFee) === 0 && s.monthlyFee > 0) upd.monthlyFee = String(s.monthlyFee.toFixed(2));
      if (Object.keys(upd).length) { updCampos++; planoAlunos.push({ tipo: 'update', id: exist.id, campos: upd }); }
    } else {
      novosAlunos++;
      const bi = s.blocks.map(b => b.instrumento).filter(Boolean);
      const profId = (s.blocks.map(b => profMap[b.professor]).filter(Boolean)[0]) || ADMIN;
      let email = s.email ? s.email.toLowerCase() : null;
      if (email && (emailsUsados.has(email) || !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email))) email = null;
      if (email) emailsUsados.add(email);
      planoAlunos.push({
        tipo: 'insert',
        row: {
          organizationId: ORG, userId: ADMIN, professorId: profId,
          name: s.nome, email, phone: s.tel || '', cpf: s.cpf, address: s.endereco || null,
          guardianName: s.responsavel || null, instrumentName: bi[bi.length - 1] || null,
          status: s.ativo ? 'ativo' : 'inativo', monthlyFee: String((s.monthlyFee || 0).toFixed(2)),
          startDate: s.inicio, notes: `Importado do Emusys (matrícula #${s.matriculaId}). Situações: ${s.situacoes}`.slice(0, 1000),
          allowAutoReminders: false,
        },
      });
    }
  }

  // dues a importar (dedup por nome|mês|ano contra o que já existe)
  const studentsByNorm = new Map();
  for (const s of data.students) studentsByNorm.set(normalize(s.nome), s.nome);
  const resolveDuesName = (rawName) => {
    const n = normalize(rawName);
    if (!n) return null;
    if (studentsByNorm.has(n)) return n;
    const parts = n.split(' ');
    if (parts.length >= 2) {
      for (const key of studentsByNorm.keys()) {
        const kp = key.split(' ');
        if (kp.length >= 2 && kp[0] === parts[0] && kp[kp.length - 1] === parts[parts.length - 1]) return key;
      }
      for (const key of studentsByNorm.keys()) {
        const kp = key.split(' ');
        if (kp.length >= 2 && (key.includes(n) || n.includes(key)) && Math.abs(kp.length - parts.length) <= 2) return key;
      }
    }
    return null;
  };
  const duesKey = new Set();
  for (const d of dbDues) {
    const st = dbStudents.find(x => x.id === d.studentId);
    if (st) duesKey.add(`${normalize(st.name)}|${d.month}|${d.year}`);
  }
  let duesNovas = 0, duesSemAluno = 0, duesDup = 0;
  const planoDues = [];
  const naoEncontrados = new Map();
  for (const d of data.dues) {
    let n = resolveDuesName(d.nome);
    if (!n) {
      // cria aluno mínimo (histórico financeiro) para não perder a fatura
      const nomeOriginal = d.nome.replace(/\s+/g, ' ').trim();
      n = normalize(nomeOriginal);
      if (!n) continue;
      if (!studentsByNorm.has(n)) {
        studentsByNorm.set(n, nomeOriginal);
        planoAlunos.push({
          tipo: 'insert',
          row: {
            organizationId: ORG, userId: ADMIN, professorId: ADMIN,
            name: nomeOriginal, email: null, phone: '', cpf: null, address: null,
            guardianName: null, instrumentName: null, status: 'inativo', monthlyFee: '0.00',
            startDate: null, notes: 'Histórico financeiro importado do Emusys (sem cadastro de aluno no sistema antigo)', allowAutoReminders: false,
          },
        });
        novosAlunos++;
      }
      naoEncontrados.set(nomeOriginal.toUpperCase(), (naoEncontrados.get(nomeOriginal.toUpperCase()) || 0) + 1);
    }
    const key = `${n}|${d.month}|${d.year}`;
    if (duesKey.has(key)) { duesDup++; continue; }
    duesKey.add(key);
    duesNovas++;
    planoDues.push({ nome: n, amount: d.amount.toFixed(2), dueDate: d.dueDate, paidAt: d.paidDate ? `${d.paidDate} 12:00:00` : null, status: d.status, month: d.month, year: d.year, notes: `Importado do Emusys: ${d.fatura}${d.forma ? ' | Forma: ' + d.forma : ''}`.slice(0, 400) });
  }
  if (naoEncontrados.size) console.log(`alunos minimos criados (historico financeiro): ${naoEncontrados.size} -> ${[...naoEncontrados.keys()].join(', ')}`);

  // enrollments (dedup por nome|instrumento)
  const enrollKey = new Set();
  for (const e of dbEnrolls) {
    const st = dbStudents.find(x => x.id === e.studentId);
    const instr = dbInstr.find(i => i.id === e.instrumentId);
    if (st) enrollKey.add(`${normalize(st.name)}|${normalize(instr ? instr.name : '')}`);
  }
  let enrollNovos = 0;
  const planoEnroll = [];
  for (const s of data.students) {
    for (const b of s.blocks) {
      if (!b.instrumento) continue;
      const key = `${normalize(s.nome)}|${normalize(b.instrumento)}`;
      if (enrollKey.has(key)) continue;
      enrollKey.add(key);
      const ag = parseAgenda(b.agenda);
      enrollNovos++;
      planoEnroll.push({
        nome: normalize(s.nome), instrNome: b.instrumento, profNome: b.professor,
        roomId: roomOf(ag.roomName), durationMonths: durationOf(b.plano, b.parcelas), weekday: ag.weekday ?? 1, timeStr: ag.timeStr,
        monthlyFee: String(Number(String(b.valor || '0').replace(',', '.') || 0).toFixed(2)),
        startDate: parseInicio(b.inicio), status: s.ativo ? 'ativo' : 'encerrado',
      });
    }
  }

  // contracts (somente os que têm PDF válido)
  let contractsNovos = 0;
  const planoContracts = [];
  const validos = new Set();
  for (const f of fs.readdirSync(path.join(dir, 'contratos'))) {
    const id = (f.match(/contrato-(\d+)\.json/) || [])[1];
    if (!id) continue;
    const raw = fs.readFileSync(path.join(dir, 'contratos', f), 'utf8');
    const i = raw.indexOf('base64,');
    if (i > -1 && raw.length - i > 1500) validos.add(Number(id));
  }
  for (const s of data.students) {
    if (!validos.has(s.matriculaId)) continue;
    const b = s.blocks[0] || {};
    contractsNovos++;
    planoContracts.push({
      nome: normalize(s.nome), monthlyFee: String(Number(String(b.valor || '0').replace(',', '.') || 0).toFixed(2)),
      startDate: s.inicio, contractNumber: `EMUSYS-${s.matriculaId}`,
      title: `Contrato de Adesão — ${(b.curso || 'Emusys')}`.slice(0, 200),
      url: `${APP_URL}/uploads/${cfg.app.contractsFolder}/contrato-${s.matriculaId}.pdf`,
      snapshot: `Importado do Emusys. Curso: ${b.curso || '?'} | Plano: ${b.plano || '?'} | Agenda: ${b.agenda || '?'} | Professor: ${b.professor || '?'}`,
    });
  }

  console.log(`\nPLANO: alunos novos=${novosAlunos} | updates=${updCampos} | profs novos=${profsNovos.length} | instr novos=${instrNovosNecessarios.size} | enrolls=${enrollNovos} | dues=${duesNovas} (dup=${duesDup}, sem aluno=${duesSemAluno}) | contracts=${contractsNovos}`);

  if (!COMMIT) {
    console.log('\nsimulacao ok (rode com --commit para gravar)');
    await sql.end(); server.close(); ssh.end();
    return;
  }

  // ---------- execução ----------
  const result = await sql.begin(async (tx) => {
    const createdProfUsers = {};
    for (const p of profsNovos) {
      const nome = p.nome.split(/\s+/).length > 1 && p.nome === p.nome.toUpperCase() ? titleCase(p.nome) : p.nome;
      const slug = normalize(p.nome).replace(/ /g, '-').slice(0, 40);
      const [u] = await tx`INSERT INTO users ("organizationId", "openId", name, email, role, "loginMethod", "isEmailVerified", "mustChangePassword") VALUES (${ORG}, ${'emusys-prof-' + slug}, ${nome}, ${p.email || null}, 'professor', 'import', false, true) RETURNING id`;
      await tx`INSERT INTO professores ("organizationId", "userId", especialidade, telefone) VALUES (${ORG}, ${u.id}, NULL, ${p.tel || null}) ON CONFLICT ("userId") DO NOTHING`;
      createdProfUsers[p.nome] = u.id;
    }
    console.log('professores criados:', Object.keys(createdProfUsers).length);

    const createdInstr = {};
    const CATS = { 'Acordeão': 'Teclas', 'Saxofone': 'Sopro', 'Trompete': 'Sopro', 'Clarinete': 'Sopro', 'Violoncelo': 'Cordas', 'Musicalização': 'Outro', 'Aprenda Inglês Cantando': 'Outro' };
    for (const nome of instrNovosNecessarios) {
      const [i] = await tx`INSERT INTO instruments ("organizationId", "userId", name, category, icon, color) VALUES (${ORG}, ${ADMIN}, ${nome}, ${CATS[nome] || 'Outro'}, NULL, NULL) RETURNING id`;
      instrByName.set(normalize(nome), i.id);
      createdInstr[nome] = i.id;
    }
    console.log('instrumentos criados:', Object.keys(createdInstr).length);

    // re-resolver profs dos blocos com os novos ids
    for (const s of data.students) for (const b of s.blocks) if (!profMap[b.professor] && createdProfUsers[b.professor]) profMap[b.professor] = createdProfUsers[b.professor];
    for (const s of data.students) for (const b of s.blocks) b.instrId = instrOf(b.instrumento);

    let insStudents = 0, updStudents = 0;
    for (const item of planoAlunos) {
      if (item.tipo === 'insert') {
        const r = item.row;
        const instrId = r.instrumentName ? (instrByName.get(normalize(r.instrumentName)) || null) : null;
        const [row] = await tx`INSERT INTO students ("organizationId","userId","professorId",name,email,phone,cpf,address,"guardianName","instrumentId",status,"monthlyFee","startDate",notes,"allowAutoReminders") VALUES (${r.organizationId},${r.userId},${r.professorId},${r.name},${r.email},${r.phone},${r.cpf},${r.address},${r.guardianName},${instrId},${r.status},${r.monthlyFee},${r.startDate},${r.notes},false) RETURNING id`;
        item.newId = row.id;
        insStudents++;
      } else {
        const campos = { ...item.campos };
        if (campos.instrumentName) { campos.instrumentId = instrByName.get(normalize(campos.instrumentName)) || null; delete campos.instrumentName; }
        await tx`UPDATE students SET ${tx(campos)} WHERE id=${item.id}`;
        updStudents++;
      }
    }
    console.log('students: inserted', insStudents, 'updated', updStudents);

    // recarregar mapa de ids para enrolls/dues/contracts
    const dbStudents2 = await tx`SELECT id, name, "professorId" FROM students WHERE "organizationId"=${ORG}`;
    const nameId = new Map(dbStudents2.map(s => [normalize(s.name), s]));
    const find2 = (name) => {
      const n = normalize(name);
      if (nameId.has(n)) return nameId.get(n);
      const parts = n.split(' ');
      for (const [key, s] of nameId) { const kp = key.split(' '); if (kp[0] === parts[0] && kp[kp.length - 1] === parts[parts.length - 1]) return s; }
      return null;
    };

    let enrollIns = 0;
    for (const e of planoEnroll) {
      const st = find2(e.nome);
      const instrId = instrByName.get(normalize(e.instrNome)) || null;
      if (!st || !instrId) continue;
      try {
        await tx`INSERT INTO student_enrollments ("organizationId","studentId","instrumentId","teacherUserId","studioRoomId","durationMonths","lessonsPerWeek",weekday,"timeStr","monthlyFee","enrollmentFee","startDate",status) VALUES (${ORG},${st.id},${instrId},${profMap[e.profNome] || st.professorId},${e.roomId},${e.durationMonths},1,${e.weekday},${e.timeStr},${e.monthlyFee},'0.00',${e.startDate},${e.status})`;
        enrollIns++;
      } catch (err) {
        console.error('FALHA ENROLL:', JSON.stringify(e), '| st:', st.id, '| instr:', instrId, '| err:', err.message);
        throw err;
      }
    }
    console.log('enrollments inseridos:', enrollIns);

    let duesIns = 0;
    for (const d of planoDues) {
      const st = find2(d.nome);
      if (!st) continue;
      await tx`INSERT INTO payment_dues ("organizationId","userId","studentId",amount,"dueDate","paidAt",status,month,year,notes,"billingPeriodicity") VALUES (${ORG},${st.professorId},${st.id},${d.amount},${d.dueDate},${d.paidAt},${d.status},${d.month},${d.year},${d.notes},'mensal')`;
      duesIns++;
    }
    console.log('dues inseridas:', duesIns);

    let contractIns = 0;
    for (const c of planoContracts) {
      const st = find2(c.nome);
      if (!st) continue;
      await tx`INSERT INTO contracts ("organizationId","userId","studentId","contractNumber",title,status,provider,"templateContentSnapshot","monthlyFee","startDate","signedDocumentUrl","signedAt") VALUES (${ORG},${ADMIN},${st.id},${c.contractNumber},${c.title},'assinado','assinafy',${c.snapshot},${c.monthlyFee},${c.startDate},${c.url},${(c.startDate ? new Date(c.startDate + 'T12:00:00Z') : null)})`;
      contractIns++;
    }
    console.log('contracts inseridos:', contractIns);

    return { insStudents, updStudents, enrollIns, duesIns, contractIns };
  });

  console.log('\nIMPORTACAO CONCLUIDA:', JSON.stringify(result));
  await sql.end();
  server.close();
  ssh.end();
})().catch(e => { console.error('ERRO:', e.message); console.error(e.stack?.split('\n').slice(0, 4).join('\n')); process.exit(1); });

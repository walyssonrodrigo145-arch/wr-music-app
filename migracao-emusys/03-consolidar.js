// Kit de migração Emusys -> MusicPro | 03 - Consolidação
// Lê as extrações em saida/ e gera saida/import-data.json + planilhas de conferência.
// Config em config.json; rode de dentro de migracao-emusys/.

const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..');
const dir = path.join(__dirname, 'saida');
const cfg = require('./lib/util.js').carregarConfig();
const outDir = path.join(dir, 'tabelas');

const normalize = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

const alunos = JSON.parse(fs.readFileSync(path.join(dir, 'alunos-todos.json'), 'utf8'));
const fichas = JSON.parse(fs.readFileSync(path.join(dir, 'fichas-parseadas.json'), 'utf8'));
const responsaveis = JSON.parse(fs.readFileSync(path.join(dir, 'responsaveis.json'), 'utf8'));
const pessoas = JSON.parse(fs.readFileSync(path.join(dir, 'pessoas.json'), 'utf8'));

// --- instrumentos existentes na org 33 ---
const INSTR_EXIST = [
  ['Violão', 131], ['Guitarra', 132], ['Cavaquinho', 133], ['Viola Caipira', 134], ['Ukulelê', 135],
  ['Bateria', 136], ['Percussão', 137], ['Piano', 138], ['Teclado', 139], ['Violino', 140],
  ['Teoria Musical', 141], ['Flauta Transversal', 143], ['Gaita', 144], ['Canto', 147], ['Contrabaixo', 148],
];
const INSTR_RULES = [
  [/violao|violão/i, 'Violão'], [/guitarra|guitar/i, 'Guitarra'], [/cavaquinho/i, 'Cavaquinho'], [/viola caipira/i, 'Viola Caipira'],
  [/ukulele|ukulelê/i, 'Ukulelê'], [/bateria/i, 'Bateria'], [/percuss/i, 'Percussão'], [/piano/i, 'Piano'],
  [/teclado|teclas/i, 'Teclado'], [/violino/i, 'Violino'], [/teoria/i, 'Teoria Musical'], [/flauta/i, 'Flauta Transversal'],
  [/gaita/i, 'Gaita'], [/canto|vocal/i, 'Canto'], [/contra\s*baixo|contra\s*baico|baixo/i, 'Contrabaixo'],
  [/acorde[aã]o/i, 'Acordeão'], [/sax/i, 'Saxofone'], [/trompete/i, 'Trompete'], [/clarinete/i, 'Clarinete'],
  [/violoncelo|cello/i, 'Violoncelo'], [/musicaliza/i, 'Musicalização'], [/aprenda ingl/i, 'Aprenda Inglês Cantando'],
];
const instrName = (curso) => {
  const ov = cfg.target.instrumentoOverrides || {};
  for (const [de, para] of Object.entries(ov)) if (curso && curso.toUpperCase().includes(de.toUpperCase())) return para;
  for (const [re, nome] of INSTR_RULES) if (re.test(curso || '')) return nome;
  return null;
};

// --- professores: existentes na org 33 ---
const PROF_EXIST = []; // (os vínculos por nome/override são resolvidos no 04-importar)
const normProf = () => null;

// --- fichas por aluno ---
const fichaPorId = {};
for (const a of alunos) fichaPorId[a.matriculaId] = fichas[a.matriculaId] || [];

// --- montar registros de alunos ---
const findPessoa = (nome) => {
  const alvo = normalize(nome);
  let p = pessoas.find(x => normalize(x.nome) === alvo);
  if (!p) {
    const parts = alvo.split(' ');
    p = pessoas.find(x => { const np = normalize(x.nome); return np.includes(parts[0]) && np.includes(parts[parts.length - 1]); });
  }
  return p || null;
};

// --- faturas ---
const parseCsvQuote = (raw) => {
  const recs = [];
  let cur = '', row = [], inQ = false;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (inQ) { if (c === '"') { if (raw[i + 1] === '"') { cur += '"'; i++; } else inQ = false; } else cur += c; }
    else if (c === '"') inQ = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else { if (c === '\n' || c === '\r') { if (cur !== '' || row.length) { row.push(cur); recs.push(row); row = []; cur = ''; } } else cur += c; }
  }
  if (cur !== '' || row.length) { row.push(cur); recs.push(row); }
  return recs;
};

const expDir = path.join(dir, 'exports');
const dues = [];
for (const f of fs.readdirSync(expDir)) {
  if (!/^fin-20\d\d-T\.csv$/.test(f)) continue;
  const raw = fs.readFileSync(path.join(expDir, f), 'latin1');
  const recs = parseCsvQuote(raw.replace(/^\uFEFF/, ''));
  for (const r of recs) {
    if (!r || r.length < 6) continue;
    const [venc, sit, nome, fatura, forma, valor] = r;
    if (!/^\d\d\/\d\d\/\d{4}$/.test((venc || '').trim())) continue;
    if (/TOTAL/i.test(fatura || '') || /TOTAL/i.test(forma || '')) continue;
    const paidM = (sit || '').match(/Pago em (\d\d\/\d\d\/\d{4})/i);
    const parcM = (fatura || '').match(/Parcela (\d\d)\/(\d{4})/i) || (fatura || '').match(/Taxa de Matr[íi]cula.*?(\d\d)\/(\d{4})/i);
    const [d, m, y] = venc.trim().split('/').map(Number);
    const valorTxt = String(valor || '0').trim();
    const valorNum = valorTxt.includes(',')
      ? Number(valorTxt.replace(/\./g, '').replace(',', '.')) || 0
      : Number(valorTxt) || 0;
    dues.push({
      nome: (nome || '').split(/\r?\n/)[0].replace(/\s*-\s*Respons[áa]vel:.*$/i, '').trim(),
      dueDate: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      month: parcM ? Number(parcM[1]) : m,
      year: parcM ? Number(parcM[2]) : y,
      amount: valorNum,
      status: paidM ? 'pago' : /Vencido h[áa]/i.test(sit || '') ? 'atrasado' : 'pendente',
      paidDate: paidM ? (() => { const [pd, pm, py] = paidM[1].split('/').map(Number); return `${py}-${String(pm).padStart(2, '0')}-${String(pd).padStart(2, '0')}`; })() : null,
      fatura: (fatura || '').trim().slice(0, 160),
      forma: (forma || '').trim().slice(0, 30),
    });
  }
}

const out = {
  generatedAt: new Date().toISOString(),
  instrExist: INSTR_EXIST,
  students: alunos.map(a => {
    const bs = fichaPorId[a.matriculaId] || [];
    const nome = a.nomeEIdade.replace(/Idade:.*/i, '').trim().replace(/\s+/g, ' ');
    const idade = Number((a.nomeEIdade.match(/Idade:\s*(\d+)/i) || [])[1]) || null;
    const contato = a.contatos.split('\n').map(s => s.trim()).filter(Boolean).join(' | ');
    const tel = (contato.match(/(\(?\d{2}\)?\s?9?\d{4}[-.\s]?\d{4})/) || [])[1] || '';
    const email = (contato.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/i) || [])[0] || '';
    const p = findPessoa(nome);
    const ativo = /Em Andamento/i.test(a.matriculasSituacao) || /Vencendo/i.test(a.matriculasSituacao);
    const inicioRaw = (a.datasMatriculas.match(/(\d\d\/\d\d\/\d{4})/) || [])[1];
    const inicio = inicioRaw ? (() => { const [d, m, y] = inicioRaw.split('/'); return `${y}-${m}-${d}`; })() : null;
    return {
      matriculaId: a.matriculaId,
      nome,
      idade,
      tel,
      email,
      cpf: p ? p.cpf : null,
      endereco: p ? p.endereco : '',
      responsavel: responsaveis[nome.toLowerCase()] || '',
      ativo,
      inicio,
      situacoes: a.matriculasSituacao,
      monthlyFee: (() => { const v = bs.map(b => Number(String(b.valorParcela || '').replace(',', '.'))).filter(v => v > 0); return v.length ? Math.max(...v) : 0; })(),
      blocks: bs.map(b => ({
        curso: b.curso, plano: b.plano, parcelas: b.parcelas, valor: b.valorParcela, pagas: b.pagas, vencidas: b.vencidas,
        presenca: b.presenca, inicio: b.inicio, agenda: b.agenda, professor: b.professor, faltas: b.faltas, reposicoes: b.reposicoes,
        instrumento: instrName(b.curso), profUserId: (normProf(b.professor) || {}).userId || null,
      })),
    };
  }),
  professors: (() => {
    const names = new Set();
    for (const id of Object.keys(fichas)) for (const b of (fichas[id] || [])) if (b.professor) names.add(b.professor.trim());
    return [...names].map(n => {
      const exist = normProf(n);
      const p = findPessoa(n);
      return { nome: n, userId: exist ? exist.userId : null, email: p ? p.email : null, tel: p ? p.telefone : null };
    });
  })(),
  dues,
  contracts: fs.readdirSync(path.join(dir, 'contratos')).map(f => ({ matriculaId: Number((f.match(/contrato-(\d+)\.json/) || [])[1]) })).filter(x => x.matriculaId),
};

fs.writeFileSync(path.join(dir, 'import-data.json'), JSON.stringify(out), 'utf8');
console.log('students:', out.students.length, '| ativos:', out.students.filter(s => s.ativo).length, '| ex:', out.students.filter(s => !s.ativo).length);
console.log('professores distintos:', out.professors.length);
console.log('  - existentes:', out.professors.filter(p => p.userId).map(p => `${p.nome} => ${p.userId}`).join(' | '));
console.log('  - novos:', out.professors.filter(p => !p.userId).map(p => `${p.nome}${p.email ? ' <' + p.email + '>' : ''}`).join(' | '));
console.log('dues:', out.dues.length, '| pagas:', out.dues.filter(d => d.status === 'pago').length, '| atrasadas:', out.dues.filter(d => d.status === 'atrasado').length, '| pendentes:', out.dues.filter(d => d.status === 'pendente').length);
console.log('contratos:', out.contracts.length);
console.log('instrumentos sem match:', [...new Set(out.students.flatMap(s => s.blocks.map(b => b.instrumento ? null : b.curso)).filter(Boolean))].join(' | ') || 'nenhum');
console.log('blocos sem prof:', out.students.flatMap(s => s.blocks).filter(b => !b.profUserId).length);
console.log('tamanho import-data.json:', (fs.statSync(path.join(dir, 'import-data.json')).size / 1024).toFixed(0), 'KB');

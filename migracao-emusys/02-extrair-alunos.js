// Kit de migração Emusys -> MusicPro | 02 - Extrair alunos
// Gera: saida/alunos-todos.json, saida/fichas-parseadas.json, saida/pessoas.json
// Uso: node 02-extrair-alunos.js

const fs = require('fs');
const path = require('path');
const { op, tokensExport, baixarExport, acharGrid, SAIDA, sleep } = require('./lib/client');
const { stripHtml, stripTags } = require('./lib/util');

(async () => {
  fs.mkdirSync(SAIDA, { recursive: true });
  const GRID_ALUNOS = 'J9JuZv1'; // Escola -> Alunos e Ex-Alunos
  const OP_FICHA = '1FE8';

  // 1) lista completa (status 0 = todas as matrículas)
  const filtros = { CursFormGrp_ID: '0', CursoForm_ID: '0', Sala_ID: '0', status: '0', anomes: '0', faixa_etaria: '0', Plano_ID: '0', tiraTrancados: '', diasDesdeMatricula: '0' };
  const r0 = await op({ _x: GRID_ALUNOS, _r: 1, ...filtros }, 'alunos-p0');
  const g0 = acharGrid(r0.text);
  const gridId = g0.id;
  const j0 = JSON.parse(r0.text);
  const colunas = (j0.params || []).find((p) => p.id === '__colunas')?.value;
  const fwl = (j0.params || []).find((p) => p.id === 'filterWidgetList')?.value ?? [];
  const nPag = Number(g0.pag?.nPag || 1);
  console.log('grid', gridId, '| páginas:', nPag, '| registros:', g0.pag?.nReg);

  const rows = [];
  const push = (g) => (g.dd || []).forEach((row) => rows.push({
    matriculaId: row[0], nomeEIdade: stripHtml(row[1]), datasMatriculas: stripHtml(row[2]),
    matriculasSituacao: stripHtml(row[3]), conclusoes: stripHtml(row[4]), contatos: stripHtml(row[5]),
  }));
  push(g0);
  for (let p = 1; p < nPag; p++) {
    await sleep(250);
    const r = await op({ _x: GRID_ALUNOS, _r: 1, ...filtros, __colunas: colunas, filterWidgetList: fwl, [gridId]: { ord: {}, pag: { rPag: 30, cPag: p, scrPos: 0 } }, _xsender: GRID_ALUNOS }, 'alunos-p' + p);
    push(acharGrid(r.text));
  }
  const vistos = new Set();
  const alunos = rows.filter((a) => { if (vistos.has(a.matriculaId)) return false; vistos.add(a.matriculaId); return true; });
  fs.writeFileSync(path.join(SAIDA, 'alunos-todos.json'), JSON.stringify(alunos, null, 1), 'utf8');
  console.log('alunos:', alunos.length);

  // 2) ficha de cada matrícula -> blocos (curso/plano/agenda/professor)
  const parseFicha = (txt) => {
    const j = JSON.parse(txt);
    const texts = [];
    const walk = (o, d) => {
      if (!o || typeof o !== 'object' || d > 16) return;
      if (Array.isArray(o)) return o.forEach((x) => walk(x, d));
      if (typeof o.text === 'string' && o.text.trim()) texts.push(o.text);
      for (const k of Object.keys(o)) walk(o[k], d + 1);
    };
    walk(j, 0);
    const blocks = [];
    for (let i = 0; i < texts.length; i++) {
      const t = stripHtml(texts[i]);
      if (!/^Plano\s/i.test(t)) continue;
      const planoNome = t.split('\n')[0].trim();
      const mParc = t.match(/(\d+)\s+Parcelas?\s+de\s+R\$\s*([\d.,]+)/i);
      const mPag = t.match(/(\d+)\s+pagas?,?\s+(\d+)\s+vencida/i);
      const mPres = t.match(/(\d+)%\s+de\s+Presen/i);
      let curso = null;
      for (let k = i - 1; k >= 0 && k > i - 6; k--) {
        const c = stripHtml(texts[k]);
        if (!c || /^(Contratos|Nome do Curso|Aula Experimental)$/i.test(c) || /^\d+%/.test(c) || /^\d{2}\/\d{2}\s+\d+%$/.test(c)) continue;
        curso = c; break;
      }
      let inicio = null, presenca = mPres ? mPres[1] + '%' : null, agenda = null, professor = null, faltas = null, repor = null;
      for (let k = i + 1; k < Math.min(i + 8, texts.length); k++) {
        const s = stripHtml(texts[k]);
        let mm;
        if (!inicio && (mm = s.match(/^(\d{2}\/\d{2})\s+(\d+)%$/))) { inicio = mm[1]; presenca = presenca || mm[2] + '%'; continue; }
        if (!agenda && /das\s+\d{2}:\d{2}\s+[àa]s\s+\d{2}:\d{2}/i.test(s)) { agenda = s; continue; }
        if (!professor && /Prof\./i.test(texts[k])) {
          const mB = texts[k].match(/<b>([^<]+)<\/b>/);
          professor = mB ? mB[1].trim() : s.replace(/^Prof\.\s*/i, '').split('-')[0].trim();
          const mR = s.match(/Aulas a Repor:\s*(\d+)/i); if (mR) repor = Number(mR[1]);
          const mF = s.match(/Faltas:\s*(\d+)/i); if (mF) faltas = Number(mF[1]);
          continue;
        }
      }
      blocks.push({ curso, plano: planoNome, parcelas: mParc ? Number(mParc[1]) : null, valorParcela: mParc ? mParc[2].replace(/[.,]$/, '') : null, pagas: mPag ? Number(mPag[1]) : null, vencidas: mPag ? Number(mPag[2]) : null, inicio, presenca, agenda, professor, faltas, reposicoes: repor });
    }
    return blocks;
  };

  const fichas = {};
  for (let i = 0; i < alunos.length; i++) {
    const a = alunos[i];
    try {
      const r = await op({ _x: OP_FICHA, Matricula_ID: a.matriculaId, acao: 'zoom', _r: 1 }, 'ficha-' + a.matriculaId, { save: false, retries: 1 });
      fichas[a.matriculaId] = parseFicha(r.text);
    } catch (e) {
      fichas[a.matriculaId] = [];
      if (/EXPIR/i.test(e.message)) { console.log('SESSÃO EXPIROU — rode 01-login.js'); break; }
    }
    if ((i + 1) % 100 === 0) console.log(`  fichas ${i + 1}/${alunos.length}`);
    await sleep(120);
  }
  fs.writeFileSync(path.join(SAIDA, 'fichas-parseadas.json'), JSON.stringify(fichas, null, 1), 'utf8');
  console.log('fichas com blocos:', Object.values(fichas).filter((b) => b.length).length);

  // 3) Pessoas Cadastradas (endereço/CPF/telefones) — op Escola -> {LKmfxt1}
  try {
    const rp = await op({ _x: 'LKmfxt1', _r: 1 }, 'pessoas');
    const tokens = tokensExport(rp.text);
    for (const tk of tokens) {
      const res = await baixarExport(tk, 'escola-pessoas.csv');
      if (res.ok && /\.csv/i.test(res.disp)) break;
    }
    const pessoas = [];
    const f = path.join(SAIDA, 'exports', 'escola-pessoas.csv');
    if (fs.existsSync(f)) {
      const raw = fs.readFileSync(f, 'latin1').replace(/^\uFEFF/, '');
      const recs = [];
      let cur = '', inQ = false;
      for (let i = 0; i < raw.length; i++) {
        const c = raw[i];
        if (c === '"') { if (inQ && raw[i + 1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
        else if (c === '\n' && !inQ) { if (cur.trim()) recs.push(cur); cur = ''; }
        else if (c !== '\r') cur += c;
      }
      if (cur.trim()) recs.push(cur);
      for (const r of recs) {
        const m = r.match(/^"?(\d+)"?,"?([\s\S]*?)"?,"?([\s\S]*?)"?,"?([\d\/]+)"?,"?(\d+)"?$/);
        if (!m) continue;
        const linhas = m[2].split('\n').map((s) => s.trim()).filter(Boolean);
        const linha1 = linhas[0] || '';
        const cpf = (linha1.match(/\s-\s(\d{11}|\d{3}\.\d{3}\.\d{3}-\d{2})/) || [])[1] || null;
        const nome = linha1.replace(/\s-\s\d+.*$/, '').trim();
        const tel = (m[2].match(/(\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4})/) || [])[1] || null;
        const email = (m[2].match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/i) || [])[0] || null;
        pessoas.push({ numero: Number(m[1]), nome, cpf, telefone: tel, email, endereco: m[3].replace(/\n/g, ' ').replace(/\s+/g, ' ').trim(), cadastro: m[4], idade: Number(m[5]) });
      }
    }
    fs.writeFileSync(path.join(SAIDA, 'pessoas.json'), JSON.stringify(pessoas, null, 1), 'utf8');
    console.log('pessoas:', pessoas.length);
  } catch (e) { console.log('aviso: pessoas não extraídas —', e.message); }

  console.log('\nOK! Agora rode 02-extrair-financeiro.js e 02-extrair-contratos.js');
})().catch((e) => { console.error('ERRO:', e.message); process.exit(1); });

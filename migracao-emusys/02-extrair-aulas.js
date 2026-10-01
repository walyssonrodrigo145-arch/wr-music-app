// Kit de migração Emusys -> MusicPro | 02 - Extrair aulas (histórico + agendamentos futuros)
// Baixa o relatório de aulas (PDF) de cada matrícula e parseia em saida/aulas-parseadas.json
// Uso: node 02-extrair-aulas.js

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { op, SAIDA, sleep } = require('./lib/client');

const MESES = { janeiro: 1, fevereiro: 2, marco: 3, 'março': 3, abril: 4, maio: 5, junho: 6, julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12 };
const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function textoDoPdf(pdf) {
  const streams = [];
  const re = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let m;
  while ((m = re.exec(pdf.toString('latin1')))) {
    try { streams.push(zlib.inflateSync(Buffer.from(m[1], 'latin1')).toString('latin1')); } catch {}
  }
  const bruto = streams.join('\n');
  const ops = [...bruto.matchAll(/\((?:[^()\\]|\\.)*\)\s*Tj|\[((?:[^\][\\]|\\.)*)\]\s*TJ/g)];
  let t = '';
  for (const op of ops) {
    const partes = [...op[0].matchAll(/\((?:[^()\\]|\\.)*\)/g)].map((x) => x[0].slice(1, -1).replace(/\\(.)/g, '$1'));
    t += partes.join('') + ' | ';
  }
  return t;
}

(async () => {
  const alunos = JSON.parse(fs.readFileSync(path.join(SAIDA, 'alunos-todos.json'), 'utf8'));
  const pdfDir = path.join(SAIDA, 'aulas-pdf');
  fs.mkdirSync(pdfDir, { recursive: true });
  console.log('relatórios de aulas:', alunos.length);

  let ok = 0, vazio = 0;
  for (let i = 0; i < alunos.length; i++) {
    const a = alunos[i];
    const dest = path.join(pdfDir, `relatorio-${a.matriculaId}.pdf`);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 2000) { ok++; continue; }
    try {
      const r = await op({ _x: 'JPHpIZ1', Matricula_ID: a.matriculaId, _r: 1 }, 'aulas-pdf-' + a.matriculaId, { save: false, retries: 1 });
      const i2 = r.text.indexOf('base64,');
      if (i2 === -1) { vazio++; continue; }
      let k = i2 + 7;
      while (k < r.text.length && (r.text[k] === '\\' || /[A-Za-z0-9+/=]/.test(r.text[k]))) k++;
      const buf = Buffer.from(r.text.slice(i2 + 7, k).replace(/\\\//g, '/').replace(/[^A-Za-z0-9+/=]/g, ''), 'base64');
      if (buf.slice(0, 5).toString() !== '%PDF-') { vazio++; continue; }
      fs.writeFileSync(dest, buf);
      ok++;
    } catch (e) {
      if (/EXPIR/i.test(e.message)) { console.log('SESSÃO EXPIROU — rode 01-login.js'); break; }
    }
    if ((i + 1) % 100 === 0) console.log(`  ...${i + 1}/${alunos.length}`);
    await sleep(120);
  }
  console.log('PDFs ok:', ok, '| vazios:', vazio);

  // parse
  const out = {};
  let divergentes = 0;
  for (const a of alunos) {
    const p = path.join(pdfDir, `relatorio-${a.matriculaId}.pdf`);
    if (!fs.existsSync(p)) { out[a.matriculaId] = { aulas: [] }; continue; }
    let t = textoDoPdf(fs.readFileSync(p)).replace(/,\s*às\s*\|\s*/g, ', às ');
    const nomeM = t.match(/Aulas de (.+?) - Relat[óo]rio/i);
    const totalM = t.match(/Total de Aulas:\s*(\d+)/i);
    const aulas = [];
    const re = /([^|]{2,80}?)\s*\|\s*([a-zçãáéíóúâêô]+(?:-feira)?),\s*(\d{2})\s+de\s+([a-zçãáéíóúâêô]+)\s+de\s+(\d{4}),\s*às\s*(\d{2}:\d{2})\s*\|\s*([^|]*?)\s*\|\s*([^|]+?)(?:\s*\||$)/gi;
    let m;
    while ((m = re.exec(t))) {
      const mes = MESES[norm(m[4])];
      if (!mes) continue;
      aulas.push({ curso: m[1].trim().replace(/\s+/g, ' '), data: `${m[5]}-${String(mes).padStart(2, '0')}-${m[3]}`, hora: m[6], sala: m[7].trim(), professor: m[8].trim() });
    }
    if (totalM && aulas.length !== Number(totalM[1])) divergentes++;
    out[a.matriculaId] = { nome: nomeM ? nomeM[1].trim().replace(/\s+/g, ' ') : null, totalDeclarado: totalM ? Number(totalM[1]) : null, aulas };
  }
  fs.writeFileSync(path.join(SAIDA, 'aulas-parseadas.json'), JSON.stringify(out), 'utf8');
  const total = Object.values(out).reduce((s, r) => s + (r.aulas ? r.aulas.length : 0), 0);
  console.log('aulas parseadas:', total, '| divergências:', divergentes);

  console.log('\nOK! Agora: node 03-consolidar.js');
})().catch((e) => { console.error('ERRO:', e.message); process.exit(1); });

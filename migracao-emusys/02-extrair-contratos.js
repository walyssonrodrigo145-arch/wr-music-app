// Kit de migração Emusys -> MusicPro | 02 - Extrair contratos (+PDF) e modelo de contrato
// Gera: saida/contratos/*.json, saida/contratos-pdf/*.pdf, saida/contrato-modelo-emusys.json
// Uso: node 02-extrair-contratos.js

const fs = require('fs');
const path = require('path');
const { op, acharGrid, SAIDA, sleep } = require('./lib/client');

(async () => {
  const alunos = JSON.parse(fs.readFileSync(path.join(SAIDA, 'alunos-todos.json'), 'utf8'));
  const outJson = path.join(SAIDA, 'contratos');
  const outPdf = path.join(SAIDA, 'contratos-pdf');
  fs.mkdirSync(outJson, { recursive: true });
  fs.mkdirSync(outPdf, { recursive: true });
  console.log('contratos a buscar:', alunos.length);

  let ok = 0, semContrato = 0;
  for (let i = 0; i < alunos.length; i++) {
    const a = alunos[i];
    const dest = path.join(outJson, `contrato-${a.matriculaId}.json`);
    if (fs.existsSync(dest)) { ok++; continue; }
    try {
      const r = await op({ _x: 'JxTJbg1', ContText_Tipo: 'adesao', Matricula_ID: a.matriculaId, _r: 1 }, 'ct-' + a.matriculaId, { save: false, retries: 1 });
      fs.writeFileSync(dest, r.text);
      if (/Contrato n[aã]o encontrado/i.test(r.text)) { semContrato++; fs.rmSync(dest, { force: true }); continue; }
      ok++;
    } catch (e) {
      if (/EXPIR/i.test(e.message)) { console.log('SESSÃO EXPIROU — rode 01-login.js'); break; }
      console.log(`  ${a.matriculaId}: ${e.message}`);
    }
    if ((i + 1) % 100 === 0) console.log(`  ...${i + 1}/${alunos.length}`);
    await sleep(120);
  }
  console.log('contratos JSON:', ok, '| sem contrato:', semContrato);

  // extrair PDFs (base64 com "\/" escapado)
  let pdfs = 0;
  for (const f of fs.readdirSync(outJson)) {
    const id = (f.match(/contrato-(\d+)\.json/) || [])[1];
    if (!id) continue;
    const raw = fs.readFileSync(path.join(outJson, f), 'utf8');
    const i = raw.indexOf('base64,');
    if (i === -1) continue;
    let k = i + 7;
    while (k < raw.length && (raw[k] === '\\' || /[A-Za-z0-9+/=]/.test(raw[k]))) k++;
    const b64 = raw.slice(i + 7, k).replace(/\\\//g, '/').replace(/[^A-Za-z0-9+/=]/g, '');
    const buf = Buffer.from(b64, 'base64');
    if (buf.slice(0, 5).toString() === '%PDF-') { fs.writeFileSync(path.join(outPdf, `contrato-${id}.pdf`), buf); pdfs++; }
  }
  console.log('PDFs de contrato:', pdfs);

  // modelo de contrato (Administração -> Contratos / op Khb5Sk1 -> Khb5Sv1)
  try {
    const rl = await op({ _x: 'Khb5Sk1', _r: 1 }, 'modelos-contrato');
    const gl = acharGrid(rl.text);
    const modeloId = gl && gl.dd && gl.dd[0] ? gl.dd[0][0] : 1;
    const rm = await op({ _x: 'Khb5Sv1', ContratoModelo_ID: modeloId, _r: 1 }, 'modelo-contrato');
    const g = acharGrid(rm.text);
    if (g && g.dd) {
      fs.writeFileSync(path.join(SAIDA, 'contrato-modelo-emusys.json'), JSON.stringify({ cols: g.cols, rows: g.dd }, null, 1), 'utf8');
      console.log('modelo de contrato: itens =', g.dd.length);
    }
  } catch (e) { console.log('aviso: modelo de contrato não extraído —', e.message); }

  console.log('\nOK! Agora rode 02-extrair-aulas.js');
})().catch((e) => { console.error('ERRO:', e.message); process.exit(1); });

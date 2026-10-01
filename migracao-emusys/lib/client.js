// Cliente HTTP da API interna do Emusys (usa a sessão salva pelo 01-login.js).
// Todas as respostas cruas são salvas em saida/http2/ para auditoria.

const fs = require('fs');
const path = require('path');
const { carregarConfig } = require('./util');

const DIR = path.join(__dirname, '..');
const SAIDA = path.join(DIR, 'saida');
const ESTADO = path.join(DIR, '.estado');

function lerConfig() { return carregarConfig(); }

function carregarSessao() {
  const p = path.join(ESTADO, 'state.json');
  if (!fs.existsSync(p)) {
    console.error('Sessão não encontrada. Rode antes: node 01-login.js');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

let seq = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Executa uma operação (_x) na API do Emusys.
 * @example op({ _x: 'J9JuZv1', _r: 1 }, 'alunos-p0')
 */
async function op(payload, label, { save = true, retries = 2 } = {}) {
  const cfg = lerConfig();
  const state = carregarSessao();
  const base = cfg.emusys.base.replace(/\/$/, '');
  const cookies = {};
  for (const c of state.cookies) if (/emusys/.test(c.domain)) cookies[c.name] = c.value;
  const cookieHeader = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
  let ls = {};
  for (const o of state.origins || []) {
    if (o.origin.includes('emusys')) for (const item of o.localStorage || []) ls[item.name] = item.value;
  }

  seq++;
  const outDir = path.join(SAIDA, 'http2');
  fs.mkdirSync(outDir, { recursive: true });
  const body = { ...payload, _m: ls.mac, _uulog: ls._uulog };

  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      const res = await fetch(base + '/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: cookieHeader,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0',
          Origin: base,
          Referer: base + '/',
        },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      if (save) {
        const name = String(seq).padStart(4, '0') + '__' + label.replace(/[^\w-]/g, '_') + '.json';
        fs.writeFileSync(path.join(outDir, name), text);
      }
      fs.appendFileSync(path.join(DIR, 'saida', 'http.log'), `${new Date().toISOString()} #${seq} ${label} status=${res.status} len=${text.length} login=${res.headers.get('login') || '-'}\n`);
      if (res.headers.get('login') === 'true' && /expir|renov/i.test(text)) {
        throw new Error('SESSAO EXPIROU — rode node 01-login.js novamente');
      }
      return { status: res.status, text };
    } catch (e) {
      if (attempt > retries) throw e;
      await sleep(1500 * attempt);
    }
  }
}

/** Baixa um export nativo (token "_relatorio_...") da tela de download do Emusys. */
async function baixarExport(token, nomeArquivo) {
  const cfg = lerConfig();
  const state = carregarSessao();
  const base = cfg.emusys.base.replace(/\/$/, '');
  const cookies = {};
  for (const c of state.cookies) if (/emusys/.test(c.domain)) cookies[c.name] = c.value;
  const cookieHeader = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
  const outDir = path.join(SAIDA, 'exports');
  fs.mkdirSync(outDir, { recursive: true });
  const res = await fetch(`${base}/dln/?file=${encodeURIComponent(token)}`, {
    headers: { Cookie: cookieHeader, 'User-Agent': 'Mozilla/5.0', Referer: base + '/' },
  });
  const buf = Buffer.from(await res.arrayBuffer());
  const disp = res.headers.get('content-disposition') || '';
  if (res.status !== 200 || buf.length < 200) return { ok: false, len: buf.length, disp };
  fs.writeFileSync(path.join(outDir, nomeArquivo), buf);
  return { ok: true, len: buf.length, disp };
}

/** Acha os tokens de export (type: "dln") em uma resposta crua do Emusys. */
function tokensExport(textoJson) {
  const out = [];
  const walk = (o) => {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) return o.forEach(walk);
    if (o.type === 'dln' && typeof o.file === 'string' && o.file.startsWith('_relatorio_')) out.push(o.file);
    for (const k of Object.keys(o)) walk(o[k]);
  };
  try { walk(JSON.parse(textoJson)); } catch {}
  return [...new Set(out)];
}

/** Acha o objeto da grid (cols + dd) em uma resposta crua do Emusys. */
function acharGrid(textoJson) {
  const j = JSON.parse(textoJson);
  let grid = null;
  const scan = (o) => {
    if (grid || !o || typeof o !== 'object') return;
    if (Array.isArray(o)) return o.forEach(scan);
    if (o.type === 'gridlist' || (o.cols && o.dd)) { grid = o; return; }
    for (const k of Object.keys(o)) scan(o[k]);
  };
  scan(j);
  return grid;
}

/** Título (cabeçalho) de uma tela do Emusys. */
function tituloTela(textoJson) {
  try {
    const j = JSON.parse(textoJson);
    const texts = [];
    const walk = (o, d) => {
      if (!o || typeof o !== 'object' || d > 6 || texts.length > 8) return;
      if (Array.isArray(o)) return o.forEach((x) => walk(x, d));
      if (typeof o.text === 'string' && o.text.trim() && !/^\d+$/.test(o.text.trim())) {
        const t = o.text.replace(/<[^>]*>/g, '').trim();
        if (t.length > 2 && !texts.includes(t)) texts.push(t);
      }
      for (const k of Object.keys(o)) walk(o[k], d + 1);
    };
    walk(j.header, 0);
    return texts.slice(0, 4).join(' / ');
  } catch { return '(resposta inválida)'; }
}

module.exports = { op, baixarExport, tokensExport, acharGrid, tituloTela, DIR, SAIDA, ESTADO, sleep };

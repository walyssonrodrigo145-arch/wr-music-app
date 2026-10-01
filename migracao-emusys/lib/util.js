// Utilidades puras compartilhadas pelo kit de migração Emusys -> MusicPro.

const fs = require('fs');
const path = require('path');

/** Config do kit (config.json na raiz do kit). */
function carregarConfig() {
  const p = path.join(__dirname, '..', 'config.json');
  if (!fs.existsSync(p)) {
    console.error('config.json não encontrado. Copie config.example.json e preencha.');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

const normalizar = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const titleCase = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/(^|\s|\bd[aeo]s?\s)([a-zà-ú])/g, (m, p, c) => p + c.toUpperCase());

const stripHtml = (s) =>
  String(s || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();

const stripTags = (s) => String(s || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Valor monetário do Emusys: linhas de fatura vêm "130.00" (US, ponto decimal);
 * linhas TOTAL vêm "1.234,56" (BR). Aceita os dois.
 */
function parseValor(v) {
  const t = String(v || '0').trim();
  if (!t) return 0;
  if (t.includes(',')) return Number(t.replace(/\./g, '').replace(',', '.')) || 0;
  return Number(t) || 0;
}

/** CSV quote-aware (aspas, escapes, quebras internas). Retorna array de linhas (arrays de células). */
function parseCsv(raw) {
  const recs = [];
  let cur = '', row = [], inQ = false;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (inQ) {
      if (c === '"') { if (raw[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
      else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') {
      if (cur !== '' || row.length) { row.push(cur); recs.push(row); row = []; cur = ''; }
    } else cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur); recs.push(row); }
  return recs;
}

const WEEKDAYS = { domingo: 0, 'segunda-feira': 1, 'terca-feira': 2, 'quarta-feira': 3, 'quinta-feira': 4, 'sexta-feira': 5, sabado: 6 };

/** "Terça-feira das 18:00 às 19:00 na SALA 1" -> { weekday, timeStr, roomName } */
function parseAgenda(agenda) {
  const out = { weekday: null, timeStr: null, roomName: null };
  if (!agenda) return out;
  const n = normalizar(agenda);
  for (const [nome, idx] of Object.entries(WEEKDAYS)) if (n.startsWith(nome)) out.weekday = idx;
  const tm = agenda.match(/(\d{1,2}:\d{2})\s+[àa]s/i);
  if (tm) out.timeStr = tm[1].padStart(5, '0');
  const rm = agenda.match(/na\s+(SALA\s*\d|RESID[ÊE]NCIA|[^,]{2,30})\s*$/i);
  if (rm) out.roomName = rm[1].trim();
  return out;
}

/** "11/24" -> "2024-11-01" (null se inválido) */
function parseInicio(mmYY) {
  if (!mmYY || !/^\d{2}\/\d{2}$/.test(mmYY)) return null;
  const [m, y] = mmYY.split('/').map(Number);
  if (m < 1 || m > 12) return null;
  return `20${String(y).padStart(2, '0')}-${String(m).padStart(2, '0')}-01`;
}

/** Duração em meses pelo nome do plano (Semestral=6, Anual=12, Trimestral=3, senão parcelas). */
function duracaoDoPlano(plano, parcelas) {
  const p = normalizar(plano);
  if (p.includes('anual')) return 12;
  if (p.includes('semestral')) return 6;
  if (p.includes('trimestral')) return 3;
  return parcelas && parcelas > 0 ? parcelas : 12;
}

/** "DD/MM/AAAA" -> "AAAA-MM-DD" */
function paraDataISO(ddmmaaaa) {
  const m = String(ddmmaaaa || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

module.exports = {
  carregarConfig,
  normalizar,
  titleCase,
  stripHtml,
  stripTags,
  parseValor,
  parseCsv,
  parseAgenda,
  parseInicio,
  duracaoDoPlano,
  paraDataISO,
  WEEKDAYS,
};

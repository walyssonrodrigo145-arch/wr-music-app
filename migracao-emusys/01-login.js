// Kit de migração Emusys -> MusicPro | 01 - Login (2FA por e-mail)
// Rode e, quando o log pedir, escreva o código recebido no e-mail do cliente em:
//   .estado/codigo.txt
// Ao final grava a sessão em .estado/state.json (usada pelas extrações).

const fs = require('fs');
const path = require('path');
const { carregarConfig } = require('./lib/util');

const ROOT = path.join(__dirname, '..');
const ESTADO = path.join(__dirname, '.estado');
const cfg = carregarConfig();
const base = cfg.emusys.base.replace(/\/$/, '');
const codeFile = path.join(ESTADO, 'codigo.txt');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

function playwright() {
  try { return require(require.resolve('playwright-core', { paths: [ROOT] })); } catch {
    console.error('playwright-core não encontrado. Rode de dentro do repositório do MusicPro ou: npm i playwright-core');
    process.exit(1);
  }
}

async function waitForCode(maxMs) {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    if (fs.existsSync(codeFile)) {
      const raw = fs.readFileSync(codeFile, 'utf8').trim();
      if (raw.length >= 4) return raw;
    }
    await sleep(2000);
  }
  return null;
}

(async () => {
  fs.mkdirSync(ESTADO, { recursive: true });
  if (fs.existsSync(codeFile)) fs.rmSync(codeFile, { force: true });

  const browser = await playwright().chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0',
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  log('abrindo', base);
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#email', { timeout: 30000 });
  await page.fill('#email', cfg.emusys.email);
  await page.fill('#senha', cfg.emusys.password);
  await page.locator('text=Entrar').first().click();
  await sleep(3000);
  log('pós-login:', (await page.evaluate(() => document.body.innerText)).slice(0, 100).replace(/\n/g, ' '));

  for (let attempt = 1; attempt <= 6; attempt++) {
    log(`tentativa ${attempt}: aguardando .estado/codigo.txt (15 min)...`);
    const code = await waitForCode(15 * 60 * 1000);
    if (!code) break;

    if (/reenviar|resend/i.test(code)) {
      log('reenviando código...');
      fs.rmSync(codeFile, { force: true });
      await page.locator('text=Enviar código novamente').first().click().catch(() => {});
      await sleep(2500);
      continue;
    }

    const input = (await page.$('#codigo')) || (await page.$('#codigoConfirmacao')) || (await page.$('input[type="tel"]')) || (await page.$('input[type="text"]:not(#email)'));
    if (!input) { log('campo de código não encontrado'); break; }
    await input.fill(code);
    await page.locator('text=Continuar').first().click().catch(() => page.keyboard.press('Enter'));
    await sleep(8000);

    const body = await page.evaluate(() => document.body.innerText).catch(() => '');
    fs.rmSync(codeFile, { force: true });
    if (/C[oó]digo inv[aá]lido/i.test(body)) { log('código inválido; aguardo o próximo'); continue; }

    const state = await context.storageState();
    fs.writeFileSync(path.join(ESTADO, 'state.json'), JSON.stringify(state, null, 2));
    const logado = !/c[oó]digo|senha|inv[aá]lido/i.test(body.slice(0, 200)) && body.length > 60;
    log('FINAL: logado =', logado);
    if (logado) log('sessão salva em .estado/state.json — agora rode os 02-extrair-*.js');
    break;
  }

  await browser.close();
})().catch((e) => { console.error('ERRO:', e.message); process.exit(1); });

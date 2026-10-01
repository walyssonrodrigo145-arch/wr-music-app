// Kit de migração Emusys -> MusicPro | 04b - Enviar PDFs dos contratos para a VPS
// Empacota saida/contratos-pdf, envia por SFTP e extrai no volume de uploads do MusicPro.
// Uso: node 04-enviar-pdfs.js

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const DIR = path.join(__dirname, '..');
const cfg = require('./lib/util').carregarConfig();
const { Client } = require(require.resolve('ssh2', { paths: [DIR] }));

const SAIDA = path.join(__dirname, 'saida');
const pdfDir = path.join(SAIDA, 'contratos-pdf');
const tarPath = path.join(SAIDA, 'contratos-emusys.tar.gz');
const pasta = cfg.app.contractsFolder || 'contracts-emusys';

(async () => {
  if (!fs.existsSync(pdfDir)) { console.error('sem saida/contratos-pdf — rode 02-extrair-contratos.js'); process.exit(1); }
  const nPdf = fs.readdirSync(pdfDir).filter((f) => f.endsWith('.pdf')).length;
  console.log('empacotando', nPdf, 'PDFs...');
  const tar = spawnSync('tar', ['-czf', tarPath, '-C', pdfDir, '.'], { stdio: 'inherit' });
  if (tar.status !== 0) { console.error('falha ao criar o tar'); process.exit(1); }
  console.log('tar:', (fs.statSync(tarPath).size / 1024 / 1024).toFixed(1), 'MB');

  const ssh = new Client();
  await new Promise((res, rej) => ssh.on('ready', res).on('error', rej).connect(cfg.vps));
  console.log('enviando para a VPS...');
  await new Promise((res, rej) => {
    ssh.sftp((err, sftp) => {
      if (err) return rej(err);
      sftp.fastPut(tarPath, '/root/contratos-emusys.tar.gz', (e) => (e ? rej(e) : res()));
    });
  });

  const cmd = `mkdir -p ${cfg.db.uploadsVolumePath}/${pasta} && tar -xzf /root/contratos-emusys.tar.gz -C ${cfg.db.uploadsVolumePath}/${pasta} && docker exec ${cfg.db.appContainer} sh -c 'ls /app/uploads/${pasta} | wc -l'`;
  await new Promise((res, rej) => {
    ssh.exec(cmd, (err, stream) => {
      if (err) return rej(err);
      let out = '', e = '';
      stream.on('data', (d) => (out += d));
      stream.stderr.on('data', (d) => (e += d));
      stream.on('close', (code) => { console.log('arquivos no container:', out.trim(), e.trim() ? '| err: ' + e.trim() : ''); code === 0 ? res() : rej(new Error('falha na extração')); });
    });
  });

  ssh.end();
  console.log('\nOK! PDFs disponíveis em', `${cfg.app.url}/uploads/${pasta}/contrato-<id>.pdf`);
})().catch((e) => { console.error('ERRO:', e.message); process.exit(1); });

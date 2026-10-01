// Kit de migração Emusys -> MusicPro | 08 - Registrar modelo de contrato no MusicPro
// Lê saida/contrato-modelo-emusys.json (extraído pelo 02-extrair-contratos.js),
// converte para blocos do editor do MusicPro e cria/atualiza o template da escola.
// Uso: node 08-registrar-modelo-contrato.js [--commit]

const fs = require('fs');
const net = require('net');
const path = require('path');
const DIR = path.join(__dirname, '..');
const cfg = require('./lib/util').carregarConfig();
const { Client } = require(require.resolve('ssh2', { paths: [DIR] }));
const postgres = require(require.resolve('postgres', { paths: [DIR] }));

const COMMIT = process.argv.includes('--commit');
const ORG = cfg.target.organizationId;
const SAIDA = path.join(__dirname, 'saida');
const modelo = JSON.parse(fs.readFileSync(path.join(SAIDA, 'contrato-modelo-emusys.json'), 'utf8'));

const limpar = (s) => String(s == null ? '' : s).replace(/\[[A-Za-z0-9]{6,10}\]\s*/g, '').replace(/Clique para visualizar ou editar/g, '').replace(/<[^>]*>/g, ' ').replace(/[ \t]+/g, ' ').trim();
const mapearVariaveis = (t) => t
  .replace(/Nome do Contratante/g, '{{student_name}}')
  .replace(/CPF do Contratante/g, '{{student_cpf}}')
  .replace(/Razão Social da Escola/g, '{{school_name}}')
  .replace(/CNPJ da Escola/g, '{{school_cnpj}}')
  .replace(/Logradouro da Escola[^,]*/g, '{{school_address}}')
  .replace(/Valor da Parcela sem Desconto/g, '{{monthly_fee}}');

const TIPO_BLOCO = { titulo: 'Título', numeracao: 'Texto', contratante: 'Contratante', contratada: 'Contratada', texto: 'Texto', clausula: 'Cláusula', paragrafo: 'Parágrafo Único', data: 'Data/Local', assinaturas: 'Assinaturas' };

const itens = [];
for (const row of modelo.rows) {
  const tipo = limpar(row[1]);
  const titulo = limpar(row[3]) === limpar(row[2]) ? '' : limpar(row[3]);
  const texto = mapearVariaveis(limpar(row[row.length - 1]));
  if (!texto && !titulo) continue;
  itens.push({ tipo, titulo, texto });
}
const blocks = itens.map((it) => ({ type: TIPO_BLOCO[it.tipo] || 'Texto', title: it.titulo, text: it.texto }));
const content = itens.map((it) => (it.titulo ? `${it.titulo.toUpperCase()}\n${it.texto}` : it.texto)).join('\n\n');
console.log('itens:', itens.length, '| chars:', content.length);

(async () => {
  const ssh = new Client();
  await new Promise((res, rej) => ssh.on('ready', res).on('error', rej).connect(cfg.vps));
  const server = net.createServer((local) => {
    ssh.forwardOut('127.0.0.1', local.remotePort, cfg.db.containerIp, 5432, (err, stream) => {
      if (err) { local.destroy(); return; }
      local.pipe(stream).pipe(local);
      local.on('error', () => stream.destroy());
      stream.on('error', () => local.destroy());
    });
  });
  await new Promise((res) => server.listen(15443, res));
  const sql = postgres({ host: '127.0.0.1', port: 15443, user: cfg.db.user, password: cfg.db.password, database: cfg.db.database, max: 2, idle_timeout: 30 });

  const existe = await sql`SELECT id FROM contract_templates WHERE "organizationId"=${ORG} AND name LIKE '%Emusys%'`;
  if (!COMMIT) { console.log(existe.length ? `template já existe (id ${existe[0].id})` : 'template será criado'); console.log('simulação ok (--commit para gravar)'); await sql.end(); server.close(); ssh.end(); return; }

  if (existe.length) {
    await sql`UPDATE contract_templates SET content=${content}, blocks=${JSON.stringify(blocks)}, "updatedAt"=now() WHERE id=${existe[0].id}`;
    console.log('template atualizado, id =', existe[0].id);
  } else {
    const [t] = await sql`INSERT INTO contract_templates ("organizationId", name, description, content, blocks, active) VALUES (${ORG}, 'Contrato de Adesão (Emusys)', 'Modelo migrado do Emusys', ${content}, ${JSON.stringify(blocks)}, true) RETURNING id`;
    console.log('template criado, id =', t.id);
  }
  await sql.end(); server.close(); ssh.end();
})().catch((e) => { console.error('ERRO:', e.message); process.exit(1); });

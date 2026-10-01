// Kit de migração Emusys -> MusicPro | 02 - Extrair financeiro (histórico completo)
// Gera: saida/exports/fin-<ano>-T.csv (todas as faturas, com data de pagamento)
//       saida/responsaveis.json (nome do aluno -> responsável, das faturas)
// Uso: node 02-extrair-financeiro.js

const fs = require('fs');
const path = require('path');
const { op, tokensExport, baixarExport, SAIDA, sleep } = require('./lib/client');
const { carregarConfig } = require('./lib/util');

(async () => {
  const cfg = carregarConfig();
  const anoInicial = Number(cfg.target.financeiroAnoInicial || new Date().getFullYear() - 8);
  const anoFinal = new Date().getFullYear() + 2;
  const OP = 'JHIBhT1'; // Financeiro -> Contas a Receber

  const responsaveis = {};
  const re = /([^"\\]{2,90}?)<i class=cbgray> - <b>Respons\\u00e1vel:<\\\/b> ([^"<\\]+)/g;
  const decodeU = (s) => s.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16))).replace(/\\\//g, '/').replace(/\\(.)/g, '$1');

  for (let ano = anoInicial; ano <= anoFinal; ano++) {
    const r = await op({ _x: OP, _r: 1, ano, situacao: 'T', tipoFiltroData: 'ano' }, `fin-${ano}-T`);
    // responsáveis nas linhas da grid (unicode-escaped)
    let m;
    while ((m = re.exec(r.text))) {
      const nome = decodeU(m[1]).trim().replace(/\\(.)/g, '$1').replace(/[-\s]+$/, '').trim();
      const resp = decodeU(m[2]).trim();
      if (nome && resp) responsaveis[nome.toLowerCase()] = resp;
    }
    const tokens = tokensExport(r.text);
    let salvo = '';
    for (const tk of tokens) {
      const res = await baixarExport(tk, `fin-${ano}-T.csv`);
      if (res.ok && /\.csv/i.test(res.disp)) { salvo = `${(res.len / 1024).toFixed(1)} KB`; break; }
    }
    console.log(`ano ${ano}: ${salvo || 'sem dados'}`);
    await sleep(300);
  }

  fs.writeFileSync(path.join(SAIDA, 'responsaveis.json'), JSON.stringify(responsaveis, null, 1), 'utf8');
  console.log('responsáveis mapeados:', Object.keys(responsaveis).length);
  console.log('\nOK! Agora rode 02-extrair-contratos.js e 02-extrair-aulas.js');
})().catch((e) => { console.error('ERRO:', e.message); process.exit(1); });

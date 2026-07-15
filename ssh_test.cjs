const { Client } = require('ssh2');

const runSsh = (host, password, cmd) => {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn.on('ready', () => {
      console.log(`[SSH] Conectado a ${host}`);
      conn.exec(cmd, (err, stream) => {
        if (err) {
          conn.end();
          return reject(err);
        }
        let output = '';
        stream.on('close', (code, signal) => {
          conn.end();
          resolve({ code, output });
        }).on('data', (data) => {
          output += data;
        }).stderr.on('data', (data) => {
          output += data;
        });
      });
    }).on('error', (err) => {
      reject(err);
    }).connect({
      host: host,
      port: 22,
      username: 'root',
      password: password
    });
  });
};

async function main() {
  const oldVps = '179.197.76.174';
  const newVps = '179.197.76.174';
  const pass = 'Walysson2003@';

  try {
    console.log("Verificando VPS Antiga...");
    const oldRes = await runSsh(oldVps, pass, 'docker ps');
    console.log("VPS Antiga OK, Docker PS:\n", oldRes.output);
  } catch(e) {
    console.error("Erro VPS Antiga:", e);
  }

  try {
    console.log("Verificando VPS Nova...");
    const newRes = await runSsh(newVps, pass, 'docker ps || echo "Docker nao instalado"');
    console.log("VPS Nova OK, Docker PS:\n", newRes.output);
  } catch(e) {
    console.error("Erro VPS Nova:", e);
  }
}

main();

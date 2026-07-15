const { Client } = require('ssh2');

const runSsh = (host, password, cmd) => {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn.on('ready', () => {
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
  const pass = 'Walysson2003@';

  console.log("Iniciando backup Evolution API...");
  try {
    const res = await runSsh(oldVps, pass, `
      cd /var/lib/docker/volumes/
      tar -czvf /root/evolution_backup.tar.gz evolution-api_evolution_instances evolution-api_evolution_store
      ls -lh /root/evolution_backup.tar.gz
    `);
    console.log(res.output);
  } catch(e) {
    console.error("Erro no backup:", e);
  }
}

main();

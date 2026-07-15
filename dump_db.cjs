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

  console.log("Iniciando dump do Postgres...");
  try {
    // pg_dump into a file on the host
    const res = await runSsh(oldVps, pass, `
      docker exec wr-music-app-db-1 pg_dump -U postgres wrmusic > /root/wrmusic_dump.sql
      ls -lh /root/wrmusic_dump.sql
      cat /root/wr-music-app/docker-compose.yml || cat /root/app/docker-compose.yml || echo "docker-compose not found"
      docker inspect evolution-api | grep -i source
    `);
    console.log(res.output);
  } catch(e) {
    console.error("Erro no dump:", e);
  }
}

main();

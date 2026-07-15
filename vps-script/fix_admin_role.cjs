const { Client } = require('ssh2');

const conn = new Client();
const config = {
  host: '179.197.76.174',
  port: 22,
  username: 'root',
  password: 'Walysson2003@',
  readyTimeout: 30000
};

conn.on('ready', () => {
  const commands = `
    cd $(find / -maxdepth 3 -type d -name "wr-music-app" | head -n 1) || exit 1
    docker compose exec app node -e "
      const pg = require('postgres');
      const sql = pg(process.env.DATABASE_URL);
      async function run() {
        console.log('Atualizando role para admin...');
        await sql\\\`UPDATE users SET role = 'admin' WHERE email = 'walyssonrodrigo145@gmail.com'\\\`;
        console.log('Role atualizada!');
        process.exit(0);
      }
      run().catch(console.error);
    "
  `;

  conn.exec(commands, (err, stream) => {
    if (err) return conn.end();
    stream.on('close', () => conn.end()).on('data', (data) => {
      process.stdout.write(data.toString());
    }).stderr.on('data', (data) => {
      process.stderr.write(data.toString());
    });
  });
}).on('error', () => {}).connect(config);

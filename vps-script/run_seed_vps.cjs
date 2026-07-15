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
    echo "Puxando novas atualizações do git..."
    git pull origin main
    echo "Rodando Drizzle Push..."
    docker compose exec app npx drizzle-kit push
    echo "Rodando Seed Script..."
    docker compose exec app npx tsx seed_admin.ts
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

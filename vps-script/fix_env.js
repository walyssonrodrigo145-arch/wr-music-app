const { Client } = require('ssh2');

const conn = new Client();
const config = {
  host: '76.13.228.159',
  port: 22,
  username: 'root',
  password: 'Walysson2003@',
  readyTimeout: 30000
};

conn.on('ready', () => {
  const commands = `
    echo "" >> /root/wr-music-app/.env
    echo 'EVOLUTION_API_URL="http://76.13.228.159:8080"' >> /root/wr-music-app/.env
    echo 'EVOLUTION_API_KEY="minha_chave_secreta_123"' >> /root/wr-music-app/.env
    cd /root/wr-music-app
    docker compose restart app
  `;

  conn.exec(commands, (err, stream) => {
    if (err) return conn.end();
    stream.on('close', () => {
      console.log('Fixed env and restarted app');
      conn.end();
    }).on('data', (data) => {
      process.stdout.write(data.toString());
    }).stderr.on('data', (data) => {
      process.stderr.write(data.toString());
    });
  });
}).on('error', () => {}).connect(config);

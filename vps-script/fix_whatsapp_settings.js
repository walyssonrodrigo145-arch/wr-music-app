const { Client } = require('ssh2');
const conn = new Client();
const config = { host: '76.13.228.159', port: 22, username: 'root', password: 'Walysson2003@', readyTimeout: 30000 };

conn.on('ready', () => {
  console.log('SSH conectado. Executando SQL via stdin...');

  // Usar heredoc para evitar problemas de escape com aspas
  const cmd = `docker exec -i wr-music-app-db-1 psql -U postgres -d wrmusic << 'ENDSQL'
UPDATE settings SET "whatsappBotUrl" = 'http://76.13.228.159:8080', "whatsappBotToken" = 'minha_chave_secreta_123' WHERE ("whatsappBotUrl" IS NULL OR "whatsappBotUrl" = '');
SELECT "userId", "whatsappBotUrl", "whatsappBotToken", "chatbotEnabled" FROM settings;
ENDSQL`;

  conn.exec(cmd, (err, stream) => {
    if (err) { console.error('Exec error:', err); conn.end(); return; }
    stream.on('close', (code) => {
      console.log('Concluído com código:', code);
      conn.end();
    }).on('data', (data) => process.stdout.write(data.toString()))
      .stderr.on('data', (data) => process.stderr.write(data.toString()));
  });
}).connect(config);

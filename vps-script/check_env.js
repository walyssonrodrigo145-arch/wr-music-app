const { Client } = require('ssh2');
const conn = new Client();
const config = { host: '76.13.228.159', port: 22, username: 'root', password: 'Walysson2003@', readyTimeout: 30000 };

conn.on('ready', () => {
  conn.exec(`docker exec wr-music-app-app-1 cat .env`, (err, stream) => {
    if (err) throw err;
    stream.on('data', (data) => process.stdout.write(data.toString()));
    stream.stderr.on('data', (data) => process.stderr.write(data.toString()));
    stream.on('close', () => {
      conn.end();
    });
  });
}).connect(config);

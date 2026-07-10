const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.exec('cat /root/wr-music-app/.env', (err, stream) => {
    stream.on('close', () => { conn.end(); }).on('data', (d) => process.stdout.write(d)).stderr.on('data', (d) => process.stderr.write(d));
  });
}).connect({host: '76.13.228.159', port: 22, username: 'root', password: 'Walysson2003@', readyTimeout: 30000});

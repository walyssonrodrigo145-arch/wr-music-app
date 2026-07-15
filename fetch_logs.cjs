const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.exec('docker logs --tail 100 wr-music-app-app-1', (err, stream) => {
    stream.on('close', () => { conn.end(); }).on('data', (d) => process.stdout.write(d)).stderr.on('data', (d) => process.stderr.write(d));
  });
}).connect({host: '179.197.76.174', port: 22, username: 'root', password: 'Walysson2003@', readyTimeout: 30000});

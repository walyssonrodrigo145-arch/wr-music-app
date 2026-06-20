const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.exec('docker logs --tail 300 wr-music-app-app-1 2>&1', (err, stream) => {
    if (err) throw err;
    let out = '';
    stream.on('close', () => { console.log(out); conn.end(); }).on('data', d => out += d).stderr.on('data', d => out += d);
  });
}).connect({ host: '76.13.228.159', port: 22, username: 'root', password: 'Walysson2003@' });

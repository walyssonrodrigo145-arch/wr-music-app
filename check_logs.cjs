const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.exec('docker logs wr-music-app-app-1 --tail 50', (err, stream) => {
    if (err) throw err;
    stream.on('close', () => conn.end())
          .on('data', data => console.log('' + data))
          .stderr.on('data', data => console.error('' + data));
  });
}).connect({
  host: '76.13.228.159', port: 22, username: 'root', password: 'Walysson2003@'
});

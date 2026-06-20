const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
  console.log('Conectado à VPS...');
  const cmd = `docker logs wr-music-app-caddy-1 --tail 100 2>&1 | grep "automations"`;
  
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    let out = '';
    stream.on('close', () => {
      console.log('--- Caddy Logs ---');
      console.log(out || 'Nenhum log no Caddy');
      conn.end();
    }).on('data', d => { out += d; }).stderr.on('data', d => { out += d; });
  });
}).connect({
  host: '76.13.228.159',
  port: 22,
  username: 'root',
  password: 'Walysson2003@'
});

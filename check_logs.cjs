const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
  console.log('Conectado à VPS...');
  const cmd = `docker logs wr-music-app-app-1 --tail 500 2>&1 | grep -iE "automations.create|RECEIVED REQUEST"`;
  
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    let out = '';
    stream.on('close', () => {
      console.log('--- Logs ---');
      console.log(out || 'Nenhum log encontrado');
      conn.end();
    }).on('data', d => { out += d; }).stderr.on('data', d => { out += d; });
  });
}).connect({
  host: '76.13.228.159',
  port: 22,
  username: 'root',
  password: 'Walysson2003@'
});

const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
  console.log('Conectado à VPS...');
  // Atualiza o código, faz o build e reinicia o app
  const cmd = `cd /root/wr-music-app && git pull && docker compose up -d --build app`;
  
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    let out = '';
    stream.on('close', () => {
      console.log('--- Resposta do Deploy ---');
      console.log(out);
      conn.end();
    }).on('data', d => { out += d; process.stdout.write(d); }).stderr.on('data', d => { out += d; process.stderr.write(d); });
  });
}).connect({
  host: '76.13.228.159',
  port: 22,
  username: 'root',
  password: 'Walysson2003@'
});

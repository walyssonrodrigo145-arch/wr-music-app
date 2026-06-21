const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
  console.log('Conectado à VPS...');
  const cmd = `docker exec wr-music-app-db-1 psql -U postgres -d wrmusic -c "UPDATE organizations SET \\"subscriptionStatus\\" = 'active', \\"trialEndsAt\\" = NULL;"`;
  
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    let out = '';
    stream.on('close', () => {
      console.log('--- DB UPDATE RESPONSE ---');
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

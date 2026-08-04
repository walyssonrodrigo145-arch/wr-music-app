const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
  console.log('Buscando tokens salvos no Postgres...');
  conn.exec('docker exec -i wr-music-app-db-1 psql -U postgres -d wrmusic -c "SELECT id, \\"userId\\", \\"deviceInfo\\", token FROM fcm_tokens;"', (err, stream) => {
    if (err) throw err;
    stream.on('data', d => console.log(d.toString()));
    stream.stderr.on('data', d => console.error(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({
  host: '179.197.76.174',
  port: 22,
  username: 'root',
  password: 'Walysson2003@',
});

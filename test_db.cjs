const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.exec('cd /root/wr-music-app && docker compose exec -T db psql -U postgres -d wrmusic -c "SELECT \\"userId\\", \\"geminiApiKey\\", \\"asaasApiKey\\" FROM settings WHERE \\"geminiApiKey\\" IS NOT NULL;"', (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      conn.end();
    }).on('data', (data) => {
      console.log('STDOUT: ' + data);
    }).stderr.on('data', (data) => {
      console.log('STDERR: ' + data);
    });
  });
}).connect({
  host: '76.13.228.159',
  port: 22,
  username: 'root',
  password: 'Walysson2003@',
  readyTimeout: 30000
});

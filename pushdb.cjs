const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  const cmd = 'docker exec wr-music-app-db-1 psql -U postgres -d wr_music_app -c "TRUNCATE attendance_tokens;" && cd wr-music-app && docker exec wr-music-app-app-1 pnpm run db:push --force';
  conn.exec(cmd, (err, stream) => {
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
  password: 'Walysson2003@'
});

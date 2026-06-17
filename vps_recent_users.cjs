const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
  const query = `docker compose -f /root/wr-music-app/docker-compose.yml exec -T db psql -U postgres -d wrmusic -c 'SELECT id, email, name, "createdAt" FROM users ORDER BY id DESC LIMIT 20;'`;
  conn.exec(query, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()))
          .stderr.on('data', d => process.stderr.write(d.toString()))
          .on('close', () => conn.end());
  });
}).connect({
  host: '76.13.228.159',
  port: 22,
  username: 'root',
  password: 'Walysson2003@'
});

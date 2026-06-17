const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
  const cmd = `cd wr-music-app && docker compose exec -T db psql -U postgres -d wrmusic -c 'ALTER TABLE settings ADD COLUMN IF NOT EXISTS "geminiApiKey" text;'`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => console.log(d.toString()))
          .stderr.on('data', d => console.error(d.toString()))
          .on('close', () => conn.end());
  });
}).connect({
  host: '76.13.228.159',
  port: 22,
  username: 'root',
  password: 'Walysson2003@'
});

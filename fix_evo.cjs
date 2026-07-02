const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  const cmd = `sed -i 's/-e DATABASE_SAVE_DATA_CHATS=true \\\\/-e DATABASE_SAVE_DATA_CHATS=true \\\\\\n  -e CACHE_REDIS_ENABLED=false \\\\\\n  -e QUEUE_REDIS_ENABLED=false \\\\/g' /root/evo_run.sh && bash /root/evo_run.sh`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => conn.end())
          .on('data', data => process.stdout.write(data))
          .stderr.on('data', data => process.stderr.write(data));
  });
}).connect({
  host: '76.13.228.159',
  port: 22,
  username: 'root',
  password: 'Walysson2003@'
});

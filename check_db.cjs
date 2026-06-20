const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.exec(`docker exec wr-music-app-db-1 psql -U postgres -d wrmusic -c "SELECT id, name, trigger, \\"isSystem\\", \\"isActive\\", \\"createdAt\\" FROM message_automation_rules ORDER BY id DESC LIMIT 20;"`, (err, stream) => {
    if (err) throw err;
    let out = '';
    stream.on('close', (code) => {
      console.log('EXIT:', code, '\nRESULT:\n', out);
      conn.end();
    }).on('data', d => out += d).stderr.on('data', d => out += d);
  });
}).connect({ host: '76.13.228.159', port: 22, username: 'root', password: 'Walysson2003@' });

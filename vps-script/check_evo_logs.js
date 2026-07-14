const { Client } = require('ssh2');
const conn = new Client();
const config = { host: '76.13.228.159', port: 22, username: 'root', password: 'Walysson2003@', readyTimeout: 30000 };

conn.on('ready', () => {
  conn.exec(`docker ps -a`, (err, stream) => {
    let out = '';
    stream.on('data', d => out += d.toString())
          .on('close', () => {
            console.log('Containers:\n', out);
            conn.end();
          });
  });
}).connect(config);

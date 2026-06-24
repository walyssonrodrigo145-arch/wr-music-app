const { Client } = require('ssh2');
const conn = new Client();
const config = { host: '76.13.228.159', port: 22, username: 'root', password: 'Walysson2003@', readyTimeout: 30000 };
conn.on('ready', () => {
  conn.exec('docker exec wr-music-app-db-1 psql -U postgres -d wrmusic -c "\\d settings"', (err, stream) => {
    stream.on('close', () => conn.end()).on('data', (data) => process.stdout.write(data.toString())).stderr.on('data', (data) => process.stderr.write(data.toString()));
  });
}).connect(config);

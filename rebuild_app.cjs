const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  console.log('Client :: ready');
  const cmd = `cd wr-music-app && docker compose up -d --build`;
  console.log('Running:', cmd);
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      console.log('Stream :: close :: code: ' + code);
      conn.end();
    }).on('data', (data) => console.log('STDOUT: ' + data))
      .stderr.on('data', (data) => console.log('STDERR: ' + data));
  });
}).connect({
  host: '76.13.228.159', port: 22, username: 'root', password: 'Walysson2003@'
});

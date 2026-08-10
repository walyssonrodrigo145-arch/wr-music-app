const { Client } = require('ssh2');
const fs = require('fs');

const conn = new Client();
const config = {
  host: '179.197.76.174',
  port: 22,
  username: 'root',
  password: 'Walysson2003@',
  readyTimeout: 30000
};

conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    if (err) throw err;
    const local = 'C:/Users/walysson/Downloads/wr-music-app-main/vps-script/test_query_container_tmp.js';
    sftp.fastPut(local, '/root/wr-music-app/tmp_test.js', (err2) => {
      if (err2) { console.error('upload err', err2); conn.end(); return; }
      conn.exec('cd /root/wr-music-app && docker compose exec -T app node tmp_test.js', (e, stream) => {
        if (e) { console.error(e); conn.end(); return; }
        let d = '';
        stream.on('data', x => d += x.toString());
        stream.stderr.on('data', x => d += x.toString());
        stream.on('close', () => {
          console.log(d);
          conn.exec('rm -f /root/wr-music-app/tmp_test.js', () => conn.end());
        });
      });
    });
  });
}).connect(config);

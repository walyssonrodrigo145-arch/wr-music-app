const { Client } = require('ssh2');

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
    const local = 'C:/Users/walysson/AppData/Local/Temp/opencode/test_query_in_container.mjs';
    sftp.fastPut(local, '/root/wr-music-app/tmp_test.mjs', (err2) => {
      if (err2) { console.error('upload err', err2); conn.end(); return; }
      const cmd = `cd /root/wr-music-app && docker compose cp tmp_test.mjs app:/app/tmp_test.mjs && docker compose exec -T app node tmp_test.mjs; rm -f tmp_test.mjs`;
      conn.exec(cmd, (e, stream) => {
        if (e) { console.error(e); conn.end(); return; }
        let d = '';
        stream.on('data', x => d += x.toString());
        stream.stderr.on('data', x => d += x.toString());
        stream.on('close', () => {
          console.log(d);
          conn.end();
        });
      });
    });
  });
}).connect(config);

const { Client } = require('ssh2');

const filesToUpload = [
  'package.json',
  'pnpm-lock.yaml'
];

const conn = new Client();
conn.on('ready', () => {
  console.log('Client :: ready');
  conn.sftp((err, sftp) => {
    if (err) throw err;
    let i = 0;
    const uploadNext = () => {
      if (i >= filesToUpload.length) {
        console.log('All files uploaded. Restarting backend...');
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
        return;
      }
      const file = filesToUpload[i];
      sftp.fastPut(`./${file}`, `/root/wr-music-app/${file}`, (err) => {
        if (err) console.error('Upload error', err);
        else console.log(`Uploaded ${file}`);
        i++;
        uploadNext();
      });
    };
    uploadNext();
  });
}).connect({
  host: '76.13.228.159', port: 22, username: 'root', password: 'Walysson2003@'
});

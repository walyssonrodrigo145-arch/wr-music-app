const fs = require('fs');
const { Client } = require('ssh2');

const filesToUpload = [
  'server/reportEngineRouter.ts',
  'server/report_engine/config.ts',
  'server/report_engine/csvExporter.ts',
  'server/report_engine/excelExporter.ts',
  'server/report_engine/formatter.ts',
  'server/report_engine/helpers.ts',
  'server/report_engine/index.ts',
  'server/report_engine/styles.ts',
  'server/report_engine/types.ts',
  'client/src/utils/downloadReport.ts',
  'client/src/pages/Relatorios.tsx',
  'vps_deploy.cjs'
];

const conn = new Client();
conn.on('ready', () => {
  console.log('Client :: ready');
  conn.sftp((err, sftp) => {
    if (err) throw err;
    let i = 0;
    const uploadNext = () => {
      if (i >= filesToUpload.length) {
        console.log('All files uploaded. Running deploy...');
        // Execute docker build WITHOUT git pull
        const cmd = `cd wr-music-app && docker compose down && docker compose up -d --build`;
        console.log('Running:', cmd);
        conn.exec(cmd, (err, stream) => {
          if (err) throw err;
          stream.on('close', (code, signal) => {
            console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
            conn.end();
          }).on('data', (data) => {
            console.log('STDOUT: ' + data);
          }).stderr.on('data', (data) => {
            console.log('STDERR: ' + data);
          });
        });
        return;
      }
      const file = filesToUpload[i];
      const localFile = `./${file}`;
      const remoteFile = `/root/wr-music-app/${file}`;
      console.log(`Uploading ${localFile} to ${remoteFile}...`);
      
      // Ensure directory exists on remote? The directories might already exist, except report_engine
      const dir = remoteFile.substring(0, remoteFile.lastIndexOf('/'));
      conn.exec(`mkdir -p ${dir}`, (err) => {
        sftp.fastPut(localFile, remoteFile, (err) => {
          if (err) {
             console.error('Upload error for ' + file, err);
          } else {
             console.log(`Uploaded ${file}`);
          }
          i++;
          uploadNext();
        });
      });
    };
    uploadNext();
  });
}).connect({
  host: '76.13.228.159',
  port: 22,
  username: 'root',
  password: 'Walysson2003@'
});

const fs = require('fs');
const { Client } = require('ssh2');

const filesToUpload = [
  { local: 'client/src/pages/Relatorios.tsx', remote: '/root/wr-music-app/client/src/pages/Relatorios.tsx' },
  { local: 'server/reportEngineRouter.ts', remote: '/root/wr-music-app/server/reportEngineRouter.ts' },
  { local: 'server/report_engine/excelExporter.ts', remote: '/root/wr-music-app/server/report_engine/excelExporter.ts' },
  { local: 'server/report_engine/types.ts', remote: '/root/wr-music-app/server/report_engine/types.ts' }
];

const conn = new Client();

console.log("Conectando na VPS...");
conn.on('ready', () => {
  console.log('Conectado. Iniciando upload via SFTP...');
  conn.sftp((err, sftp) => {
    if (err) throw err;
    let uploaded = 0;
    filesToUpload.forEach(file => {
      sftp.fastPut(file.local, file.remote, (err) => {
        if (err) {
          console.error(`Erro no upload de ${file.local}:`, err);
          conn.end();
        } else {
          console.log(`Upload concluído: ${file.remote}`);
          uploaded++;
          if (uploaded === filesToUpload.length) {
             console.log('Todos arquivos upados. Reconstruindo container...');
             conn.exec('cd /root/wr-music-app && docker build -t wr-music-app-app . && docker compose up -d app', (err, stream) => {
                if(err) throw err;
                stream.on('close', () => {
                   console.log('Build e deploy finalizados!');
                   conn.end();
                }).on('data', data => console.log(data.toString()))
                  .stderr.on('data', data => console.error(data.toString()));
             });
          }
        }
      });
    });
  });
}).connect({
  host: '76.13.228.159',
  port: 22,
  username: 'root',
  password: 'Walysson2003@'
});

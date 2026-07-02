const fs = require('fs');
const { Client } = require('ssh2');

const filesToUpload = [
  { local: 'server/utils/whatsapp.ts',          remote: '/root/wr-music-app/server/utils/whatsapp.ts' },
  { local: 'server/utils/whatsappRouting.ts',   remote: '/root/wr-music-app/server/utils/whatsappRouting.ts' },
  { local: 'client/src/pages/Configuracoes.tsx', remote: '/root/wr-music-app/client/src/pages/Configuracoes.tsx' },
  { local: 'server/automationJob.ts',            remote: '/root/wr-music-app/server/automationJob.ts' },
  { local: 'server/routers.ts',                  remote: '/root/wr-music-app/server/routers.ts' },
];

const conn = new Client();

console.log("Conectando na VPS para fixar whatsapp...");
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
             console.log('Arquivos upados. Reconstruindo container...');
             conn.exec('cd /root/wr-music-app && docker compose down && docker build -t wr-music-app-app . && docker compose up -d', (err, stream) => {
                if(err) throw err;
                stream.on('close', () => {
                   console.log('Build e deploy finalizados!');
                   conn.end();
                }).on('data', data => process.stdout.write(data))
                  .stderr.on('data', data => process.stderr.write(data));
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

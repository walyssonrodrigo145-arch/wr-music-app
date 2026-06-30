const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const conn = new Client();
const config = {
  host: '76.13.228.159',
  port: 22,
  username: 'root',
  password: 'Walysson2003@',
  readyTimeout: 30000
};

const filesToUpload = [
  'package.json',
  'pnpm-lock.yaml',
  'server/routers.ts',
  'server/_core/rateLimiter.ts',
  'server/_core/index.ts',
  'client/src/pages/ProfessorExtract.tsx',
  'client/src/pages/Progresso.tsx',
  'client/src/pages/Dashboard.tsx',
  'client/src/pages/student/Dashboard.tsx',
  'client/src/pages/student/Aulas.tsx',
  'client/src/pages/student/Agenda.tsx',
  'client/src/components/StudentSidebar.tsx',
  'client/src/App.tsx',
  'client/src/pages/NovoAluno.tsx',
  'client/src/pages/Alunos.tsx',
  'client/src/pages/IAAssistente.tsx',
  'client/src/pages/student/Exercicios.tsx',
  'client/src/pages/student/Avisos.tsx',
  'client/src/pages/student/Progresso.tsx',
  'client/src/pages/student/Materiais.tsx',
  'client/src/components/RescheduleModal.tsx',
  'server/utils/gemini.ts',
  'client/src/pages/Configuracoes.tsx',
  'drizzle/schema.ts',
  'server/_core/migrate.ts',
  'server/db.ts',
  'server/automationJob.ts',
  'client/src/pages/Aulas.tsx',
  'client/src/pages/Automacoes.tsx',
  'server/utils/whatsappRouting.ts',
  'client/src/pages/Comunicados.tsx',
  'client/src/pages/Financeiro.tsx',
  'client/src/pages/financeiro/MensalidadesTab.tsx',
  'client/src/pages/financeiro/DespesasTab.tsx',
  'client/src/pages/Dashboard.tsx',
  'client/src/pages/Automacoes.tsx',
  'server/automationJob.ts',
  'client/src/pages/Relatorios.tsx',
  'client/src/index.css',
  'client/src/pages/Assinatura.tsx'
];

conn.on('ready', () => {
  console.log('SSH connection established. Uploading files...');
  
  const findCmd = 'find / -maxdepth 3 -type d -name "wr-music-app" | head -n 1';
  conn.exec(findCmd, (err, stream) => {
    if (err) throw err;
    let repoPath = '';
    stream.on('data', (data) => { repoPath += data.toString(); });
    stream.on('close', () => {
      repoPath = repoPath.trim();
      if (!repoPath) {
        console.error('Repo not found!');
        conn.end();
        return;
      }
      
      conn.sftp((err, sftp) => {
        if (err) throw err;
        
        let uploads = 0;
        const finalize = () => {
          uploads++;
          if (uploads === filesToUpload.length) {
            console.log('Uploads complete. Rebuilding container...');
            const rebuildCmd = `
              cd ${repoPath}
              docker compose down
              docker compose up -d --build
            `;
            conn.exec(rebuildCmd, (err, rebuildStream) => {
              if (err) throw err;
              rebuildStream.on('data', data => process.stdout.write(data.toString()));
              rebuildStream.stderr.on('data', data => process.stderr.write(data.toString()));
              rebuildStream.on('close', () => {
                console.log('Deploy finished successfully!');
                conn.end();
              });
            });
          }
        };
        
        filesToUpload.forEach(file => {
          const localPath = path.resolve(__dirname, '../', file);
          const remotePath = `${repoPath}/${file}`;
          console.log(`Uploading ${localPath} to ${remotePath}`);
          
          if (fs.existsSync(localPath)) {
            sftp.fastPut(localPath, remotePath, (err) => {
              if (err) {
                console.error(`Error uploading ${file}:`, err);
              } else {
                console.log(`${file} uploaded successfully.`);
              }
              finalize();
            });
          } else {
            console.warn(`File ${localPath} does not exist locally!`);
            finalize();
          }
        });
      });
    });
  });
}).connect(config);

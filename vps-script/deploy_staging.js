const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const config = {
  host: process.env.VPS_HOST || '179.197.76.174',
  port: parseInt(process.env.VPS_PORT || '22', 10),
  username: process.env.VPS_USER || 'root',
  password: process.env.VPS_PASSWORD || 'Walysson2003@',
};

const filesToUpload = [
  'docker-compose.staging.yml',
  'package.json',
  'pnpm-lock.yaml',
  'server/routers.ts',
  'server/analyticsRouter.ts',
  'server/services/AnalyticsQueue.ts',
  'server/_core/rateLimiter.ts',
  'server/_core/index.ts',
  'server/_core/env.ts',
  'client/src/pages/analytics/AnalyticsDashboard.tsx',
  'drizzle/schema.ts',
  'server/db.ts',
];

console.log('🚀 Iniciando deploy no Ambiente de Testes (STAGING)...');

const conn = new Client();
conn.on('ready', () => {
  console.log('SSH connection established. Locating wr-music-app repository...');
  
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
        
        const mkdirCmd = `mkdir -p ${repoPath}/client/src/pages/analytics ${repoPath}/server/services ${repoPath}/client/src/lib`;
        conn.exec(mkdirCmd, () => {
          let uploads = 0;
          const finalize = () => {
            uploads++;
            if (uploads === filesToUpload.length) {
              console.log('Uploads completed. Rebuilding STAGING container on port 3001...');
              const rebuildCmd = `
                cd ${repoPath}
                docker compose -f docker-compose.staging.yml down || true
                docker compose -f docker-compose.staging.yml build
                docker compose -f docker-compose.staging.yml up -d
                echo "STAGING deploy complete! Accessible at http://179.197.76.174:3001"
              `;
              conn.exec(rebuildCmd, (err, rebuildStream) => {
                if (rebuildStream) {
                  rebuildStream.stdout.on('data', data => process.stdout.write(data.toString()));
                  rebuildStream.stderr.on('data', data => process.stderr.write(data.toString()));
                  rebuildStream.on('close', () => {
                    console.log('✅ Deploy no Staging (Porta 3001) concluído com sucesso!');
                    conn.end();
                  });
                } else {
                  conn.end();
                }
              });
            }
          };
          
          filesToUpload.forEach(file => {
            const localPath = path.resolve(__dirname, '../', file);
            const remotePath = `${repoPath}/${file}`;
            console.log(`Uploading ${localPath} -> ${remotePath}`);
            
            if (fs.existsSync(localPath)) {
              sftp.fastPut(localPath, remotePath, (err) => {
                if (err) console.error(`Error uploading ${file}:`, err);
                else console.log(`${file} uploaded successfully.`);
                finalize();
              });
            } else {
              console.warn(`File not found locally: ${localPath}`);
              finalize();
            }
          });
        });
      });
    });
  });
}).connect(config);

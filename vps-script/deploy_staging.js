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
  'Caddyfile',
  'docker-compose.staging.yml',
  'package.json',
  'pnpm-lock.yaml',
  'server/routers.ts',
  'server/analyticsRouter.ts',
  'server/utils/geoIp.ts',
  'server/services/AnalyticsQueue.ts',
  'server/services/contractService.ts',
  'server/services/signature/SignatureProvider.ts',
  'server/services/signature/AssinafyProvider.ts',
  'server/services/signature/index.ts',
  'server/utils/integrationCrypto.ts',
  'server/marketingRouter.ts',
  'server/crmRouter.ts',
  'server/_core/migrate.ts',
  'server/_core/rateLimiter.ts',
  'server/_core/index.ts',
  'server/_core/env.ts',
  'drizzle/schema.ts',
  'server/db.ts',
  'client/src/lib/exportUtils.ts',
  'client/src/pages/Alunos.tsx',
  'client/src/pages/NovoAluno.tsx',
  'client/src/pages/financeiro/MensalidadesTab.tsx',
  'client/src/pages/marketing/MarketingDashboard.tsx',
  'client/src/pages/marketing/CrmKanban.tsx',
  'client/src/pages/marketing/CampaignDetails.tsx',
  'client/src/pages/marketing/CreateCampaign.tsx',
  'client/src/pages/PublicEnrollment.tsx',
  'server/enrollmentRouter.ts',
  'client/src/pages/Configuracoes.tsx',
  'client/src/pages/ProfessorExtract.tsx',
  'client/src/components/integrations/AssinafyIntegrationCard.tsx',
  'client/src/components/modals/StudentContractsSection.tsx',
  'client/src/components/modals/StudentDetailsModal.tsx',
  'client/src/pages/leads/LeadsApp.tsx',
  'client/src/pages/Comunicados.tsx',
  'client/src/components/AppSidebar.tsx',
  'client/src/components/AppHeader.tsx',
  'client/src/pages/SalasEstudio.tsx',
  'server/studioRoomsRouter.ts',
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
        
        const mkdirCmd = `mkdir -p ${repoPath}/client/src/pages/analytics ${repoPath}/client/src/pages/leads ${repoPath}/server/services ${repoPath}/server/services/signature ${repoPath}/client/src/lib ${repoPath}/client/src/components/integrations ${repoPath}/client/src/components/modals`;
        conn.exec(mkdirCmd, () => {
          let uploads = 0;
          const finalize = () => {
            uploads++;
            if (uploads === filesToUpload.length) {
              console.log('Uploads completed. Rebuilding STAGING container on port 3001...');
              const rebuildCmd = `
                cd ${repoPath}
                git fetch origin main && git reset --hard origin/main || true
                docker compose -f docker-compose.staging.yml down || true
                docker compose -f docker-compose.staging.yml build --no-cache
                docker compose -f docker-compose.staging.yml up -d
                docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile || docker compose restart caddy
                echo "STAGING deploy complete! Accessible at https://staging.wrmusicpro.com.br"
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

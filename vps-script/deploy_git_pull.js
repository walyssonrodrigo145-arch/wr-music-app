const { Client } = require('ssh2');

if (!process.env.VPS_PASSWORD) {
  console.error('Defina VPS_PASSWORD no ambiente (ex.: carregue o .env) antes de rodar o deploy.');
  process.exit(1);
}

const conn = new Client();
const config = {
  host: process.env.VPS_HOST || '179.197.76.174',
  port: parseInt(process.env.VPS_PORT || '22', 10),
  username: process.env.VPS_USER || 'root',
  password: process.env.VPS_PASSWORD,
  readyTimeout: 30000
};

conn.on('ready', () => {
  console.log('SSH connection established. Executing git pull and rebuild...');
  
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
      
      const rebuildCmd = `
        cd ${repoPath}
        git pull origin main
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
    });
  });
}).connect(config);

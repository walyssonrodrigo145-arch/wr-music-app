/**
 * Migration: BUG-002 FIX — Aumentar refId de VARCHAR(100) → VARCHAR(200)
 * Executa via SSH na VPS como parte do deploy de correção de bugs.
 */
const { Client } = require('ssh2');

const conn = new Client();
const config = {
  host: '76.13.228.159',
  port: 22,
  username: 'root',
  password: 'Walysson2003@',
  readyTimeout: 30000
};

conn.on('ready', () => {
  console.log('[Migration] SSH conectado. Executando migration refId...');

  const findCmd = 'find / -maxdepth 3 -type d -name "wr-music-app" | head -n 1';
  conn.exec(findCmd, (err, stream) => {
    if (err) throw err;
    let repoPath = '';
    stream.on('data', (data) => { repoPath += data.toString(); });
    stream.on('close', () => {
      repoPath = repoPath.trim();
      if (!repoPath) {
        console.error('[Migration] Repo não encontrado!');
        conn.end();
        return;
      }

      // Executa a migration SQL direto no Postgres via docker exec
      const migrationSQL = `ALTER TABLE reminders ALTER COLUMN "refId" TYPE VARCHAR(200);`;
      const migrationCmd = `cd ${repoPath} && docker compose exec -T db psql -U postgres -d musicpro -c "${migrationSQL}" 2>&1 || docker compose exec -T db psql -U postgres -d wrmusic -c "${migrationSQL}" 2>&1`;

      conn.exec(migrationCmd, (err, migStream) => {
        if (err) throw err;
        migStream.on('data', data => process.stdout.write(data.toString()));
        migStream.stderr.on('data', data => process.stderr.write(data.toString()));
        migStream.on('close', (code) => {
          if (code === 0) {
            console.log('[Migration] ✅ refId expandido para VARCHAR(200) com sucesso!');
          } else {
            console.warn('[Migration] ⚠️  Migration finalizada com código', code, '— verifique os logs acima.');
          }
          conn.end();
        });
      });
    });
  });
}).connect(config);

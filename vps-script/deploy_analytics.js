// ─── Deploy do SERVIÇO DE ANALYTICS (projeto compose separado) ────────────────
// NÃO toca no MusicPro: sobe/atualiza apenas analytics-compose.yml.
// Uso: VPS_PASSWORD=... node vps-script/deploy_analytics.js
const { Client } = require("ssh2");

const config = {
  host: process.env.VPS_HOST || "179.197.76.174",
  port: parseInt(process.env.VPS_PORT || "22", 10),
  username: process.env.VPS_USER || "root",
  password: process.env.VPS_PASSWORD,
  readyTimeout: 60000,
};

if (!config.password) {
  console.error("Defina VPS_PASSWORD no ambiente antes de rodar.");
  process.exit(1);
}

console.log("📊 Deploy do serviço de Analytics (independente do MusicPro)...");

const conn = new Client();
conn.on("ready", () => {
  const findCmd = 'find / -maxdepth 3 -type d -name "wr-music-app" | head -n 1';
  conn.exec(findCmd, (err, stream) => {
    if (err) throw err;
    let repoPath = "";
    stream.on("data", (d) => (repoPath += d.toString()));
    stream.on("close", () => {
      repoPath = repoPath.trim();
      if (!repoPath) {
        console.error("Repo não encontrado na VPS!");
        conn.end();
        return;
      }

      // 1) Sincroniza o código (inclui analytics-compose.yml + Caddyfile)
      // 2) Cria .env.analytics na primeira execução (usa a senha do Postgres do MusicPro)
      // 3) Sobe/atualiza SOMENTE o projeto analytics
      // 4) Recarrega o Caddy para rotear /ingest/*
      const cmd = `
        cd ${repoPath}
        echo "🔄 Sincronizando código..."
        git fetch origin main && git reset --hard origin/main || { echo "FALHA ao sincronizar"; exit 1; }

        echo "🔐 Garantindo .env.analytics..."
        if [ ! -f .env.analytics ]; then
          DB_PASS=$(grep -m1 'POSTGRES_PASSWORD' docker-compose.yml | sed 's/.*: *//' | tr -d ' \\r')
          printf 'DATABASE_URL=postgres://postgres:%s@db:5432/wrmusic\\n' "$DB_PASS" > .env.analytics
          printf 'CORS_ORIGINS=https://wrmusicpro.com.br,https://www.wrmusicpro.com.br,https://analytics.wrmusicpro.com.br,https://staging.wrmusicpro.com.br\\n' >> .env.analytics
          echo "DATABASE_URL e CORS_ORIGINS criados"
        else
          echo ".env.analytics já existe"
        fi

        echo "🐳 Subindo serviço de analytics (compose separado)..."
        docker compose -f analytics-compose.yml up -d --build || { echo "FALHA no build do analytics"; exit 1; }

        echo "🩺 Healthcheck do serviço:"
        sleep 3
        docker compose -f analytics-compose.yml exec -T analytics wget -qO- http://localhost:3002/health || echo "⚠️ healthcheck falhou"

        echo "🌐 Recarregando Caddy (rota /ingest/*)..."
        docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile || docker compose restart caddy

        echo "📦 Containers:"
        docker ps --format '{{.Names}} | {{.Status}}' | grep -E 'analytics|wr-music-app-app-1|wr-music-app-db-1|wr-music-app-caddy-1' || true

        echo "✅ Deploy do Analytics concluído (MusicPro NÃO foi reiniciado)."
      `;

      const rebuild = conn.exec(cmd, (err2, rebuildStream) => {
        if (err2) throw err2;
        rebuildStream.on("data", (d) => process.stdout.write(d.toString()));
        rebuildStream.stderr.on("data", (d) => process.stderr.write(d.toString()));
        rebuildStream.on("close", (code) => {
          console.log(`\nFinalizado (exit ${code}).`);
          conn.end();
        });
      });
    });
  });
}).connect(config);

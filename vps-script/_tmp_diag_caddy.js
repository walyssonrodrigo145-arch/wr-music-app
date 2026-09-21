// TEMP: diagnóstico do roteamento Caddy -> analytics. Remover após uso.
const { Client } = require("ssh2");
const conn = new Client();
function run(cmd) {
  return new Promise((resolve) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return resolve("ERR: " + err.message);
      let out = "";
      stream.on("data", (d) => (out += d.toString()));
      stream.stderr.on("data", (d) => (out += d.toString()));
      stream.on("close", () => resolve(out));
    });
  });
}
conn.on("ready", async () => {
  const BASE = "cd /root/wr-music-app && ";
  console.log("=== Caddyfile no repo (VPS) ===");
  console.log(await run(`${BASE}cat Caddyfile`));
  console.log("=== Caddyfile DENTRO do container ===");
  console.log(await run("docker exec wr-music-app-caddy-1 cat /etc/caddy/Caddyfile"));
  console.log("=== analytics alcançável pelo Caddy? ===");
  console.log(await run("docker exec wr-music-app-caddy-1 wget -qO- http://analytics:3002/health || echo FALHOU"));
  console.log("=== rotas no config ativo do Caddy (adapt) ===");
  console.log(await run("docker exec wr-music-app-caddy-1 caddy adapt --config /etc/caddy/Caddyfile 2>/dev/null | grep -i -A3 ingest | head -40"));
  console.log("=== teste local no host ===");
  console.log(await run(`curl -s -m 10 -o /dev/null -w '%{http_code}' -H 'Host: analytics.wrmusicpro.com.br' https://localhost/ingest/health -k || true`));
  conn.end();
}).on("error", (e) => { console.error(e.message); process.exit(1); })
  .connect({ host: "179.197.76.174", port: 22, username: "root", password: process.env.VPS_PASSWORD, readyTimeout: 60000 });

const { Client } = require("ssh2");
const conn = new Client();

conn.on("ready", () => {
  console.log("Conectado. Enviando novo compose (evoapicloud/evolution-api:latest)...");
  conn.sftp((err, sftp) => {
    if (err) throw err;
    sftp.fastPut("evolution-v2-compose.yml", "/root/evolution-api/docker-compose.yml", (err) => {
      if (err) { console.error("Erro upload:", err); conn.end(); return; }
      console.log("docker-compose.yml enviado!\n");

      const cmd = [
        "cd /root/evolution-api",
        "echo '=== Parando v1.6.1 ==='",
        "docker stop evolution-api && docker rm evolution-api || true",
        "echo ''",
        "echo '=== Baixando evoapicloud/evolution-api:latest (aguarde) ==='",
        "docker pull evoapicloud/evolution-api:latest",
        "echo ''",
        "echo '=== Verificando versao da imagem baixada ==='",
        "docker run --rm evoapicloud/evolution-api:latest node -e \"const p=require('/app/package.json'); console.log('Versao:', p.version);\" 2>/dev/null || echo 'versao nao detectada'",
        "echo ''",
        "echo '=== Subindo Evolution API v2 ==='",
        "docker compose up -d",
        "echo ''",
        "sleep 10",
        "echo '=== Status final ==='",
        "curl -s http://localhost:8080/ 2>/dev/null | python3 -c \"import sys,json; d=json.load(sys.stdin); print('VERSION:', d.get('version','?'), '\\nMsg:', d.get('message','?'))\" 2>/dev/null || curl -s http://localhost:8080/",
        "echo ''",
        "docker ps --format 'TABLE {{.Names}}\\t{{.Image}}\\t{{.Status}}' | grep evo",
      ].join(" && ");

      conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on("close", () => { console.log("\n? Upgrade para v2 concluido!"); conn.end(); })
          .on("data", d => process.stdout.write(d.toString()))
          .stderr.on("data", d => process.stderr.write(d.toString()));
      });
    });
  });
}).connect({ host: "76.13.228.159", port: 22, username: "root", password: "Walysson2003@" });

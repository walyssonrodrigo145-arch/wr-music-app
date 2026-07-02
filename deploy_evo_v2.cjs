const fs = require("fs");
const { Client } = require("ssh2");
const conn = new Client();

conn.on("ready", () => {
  console.log("Conectado. Enviando novo docker-compose via SFTP...");
  conn.sftp((err, sftp) => {
    if (err) throw err;

    sftp.fastPut("evolution-v2-compose.yml", "/root/evolution-api/docker-compose.yml", (err) => {
      if (err) { console.error("Erro upload:", err); conn.end(); return; }
      console.log("docker-compose.yml atualizado para v2!\n");

      const cmd = [
        "cd /root/evolution-api",
        "echo '=== Parando Evolution API v1.6.1 ==='",
        "docker stop evolution-api && docker rm evolution-api || true",
        "echo ''",
        "echo '=== Baixando Evolution API v2.2.3 ==='",
        "docker pull atendai/evolution-api:v2.2.3",
        "echo ''",
        "echo '=== Subindo Evolution API v2 ==='",
        "docker compose up -d",
        "echo ''",
        "sleep 8",
        "echo '=== Verificando versao ==='",
        "curl -s http://localhost:8080/ 2>/dev/null | python3 -c \"import sys,json; d=json.load(sys.stdin); print('VERSION:', d.get('version','?'), '| Status:', d.get('status','?'))\" 2>/dev/null || curl -s http://localhost:8080/",
        "echo ''",
        "echo '=== Containers ativos ==='",
        "docker ps --format 'TABLE {{.Names}}\\t{{.Image}}\\t{{.Status}}'",
      ].join(" && ");

      conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on("close", () => { console.log("\n? Upgrade concluido!"); conn.end(); })
          .on("data", d => process.stdout.write(d.toString()))
          .stderr.on("data", d => process.stderr.write(d.toString()));
      });
    });
  });
}).connect({ host: "76.13.228.159", port: 22, username: "root", password: "Walysson2003@" });

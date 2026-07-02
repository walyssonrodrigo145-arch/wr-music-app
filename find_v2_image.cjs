const { Client } = require("ssh2");
const conn = new Client();
conn.on("ready", () => {
  const cmd = [
    // Buscar a imagem correta da v2
    'echo "=== Testando imagens Evolution API v2 ==="',
    'docker pull atendai/evolution-api:latest 2>&1 | tail -3',
    'docker inspect atendai/evolution-api:latest --format "{{index .Config.Labels \"org.opencontainers.image.version\"}}" 2>/dev/null || docker run --rm atendai/evolution-api:latest node -e "const p=require(\'/app/package.json\'); console.log(p.version);" 2>/dev/null | head -3',
    'echo ""',
    // Restaurar o container v1.6.1 enquanto buscamos a v2
    'echo "=== Restaurando v1.6.1 temporariamente ==="',
    'cd /root/evolution-api && docker run -d --name evolution-api --restart always -p 8080:8080 -e SERVER_URL=http://76.13.228.159:8080 -e DOCKER_ENV=true -e LOG_LEVEL=ERROR,WARN,DEBUG,INFO,LOG,VERBOSE,DARK,FATAL -e AUTHENTICATION_TYPE=apikey -e "AUTHENTICATION_API_KEY=minha_chave_secreta_123" -e AUTHENTICATION_EXPOSE_IN_SERVER=true -e WEBSOCKET_ENABLED=false -v evolution-api_evolution_instances:/evolution/instances -v evolution-api_evolution_store:/evolution/store atendai/evolution-api:v1.6.1',
    'sleep 3',
    'curl -s http://localhost:8080/ | python3 -c "import sys,json; d=json.load(sys.stdin); print(\'v1.6.1 restaurado:\', d.get(\'version\',\'?\'))" 2>/dev/null',
  ].join(" && ");
  conn.exec(cmd, (err, stream) => {
    if (err) { console.error(err); conn.end(); return; }
    stream.on("close", () => conn.end())
      .on("data", d => process.stdout.write(d.toString()))
      .stderr.on("data", d => process.stderr.write(d.toString()));
  });
}).connect({ host: "76.13.228.159", port: 22, username: "root", password: "Walysson2003@" });

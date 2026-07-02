const { Client } = require("ssh2");
const conn = new Client();

const NEW_COMPOSE = `version: "3.7"

services:
  evolution-api:
    image: atendai/evolution-api:v2.2.3
    container_name: evolution-api
    restart: always
    ports:
      - "8080:8080"
    environment:
      - SERVER_URL=http://76.13.228.159:8080
      - DOCKER_ENV=true
      - LOG_LEVEL=ERROR,WARN,DEBUG,INFO,LOG,VERBOSE,DARK,FATAL
      - LOG_BAILEYS=error
      - DEL_INSTANCE=false
      - AUTHENTICATION_TYPE=apikey
      - AUTHENTICATION_API_KEY=minha_chave_secreta_123
      - AUTHENTICATION_EXPOSE_IN_SERVER=true
      - WEBSOCKET_ENABLED=false
      - QRCODE_LIMIT=10
      - QRCODE_EXPIRATION_LIMIT=30
      - LANGUAGE=pt-BR
    volumes:
      - evolution_instances:/evolution/instances
      - evolution_store:/evolution/store

volumes:
  evolution_instances:
  evolution_store:
`;

conn.on("ready", () => {
  console.log("Conectado na VPS. Iniciando upgrade para v2...\n");

  // Escrever novo compose
  const escapedCompose = NEW_COMPOSE.replace(/'/g, "'\\''");
  const cmd = [
    "cd /root/evolution-api",
    "echo 'Fazendo backup do compose atual...'",
    "cp docker-compose.yml docker-compose.yml.bak",
    `cat > docker-compose.yml << 'ENDOFFILE'\n${NEW_COMPOSE}ENDOFFILE`,
    "echo 'Novo docker-compose.yml escrito.'",
    "cat docker-compose.yml",
    "echo ''",
    "echo 'Parando e removendo container v1.6.1...'",
    "docker stop evolution-api && docker rm evolution-api",
    "echo ''",
    "echo 'Baixando imagem v2.2.3 (pode demorar)...'",
    "docker pull atendai/evolution-api:v2.2.3",
    "echo ''",
    "echo 'Subindo Evolution API v2...'",
    "docker compose up -d",
    "echo ''",
    "echo 'Aguardando 5s para inicializar...'",
    "sleep 5",
    "echo ''",
    "echo 'Verificando versao:'",
    "curl -s http://localhost:8080/ | python3 -c \"import sys,json; d=json.load(sys.stdin); print('Versao:', d.get('version','?'))\" 2>/dev/null || curl -s http://localhost:8080/",
    "echo ''",
    "echo 'Status dos containers:'",
    "docker ps --format 'TABLE {{.Names}}\\t{{.Image}}\\t{{.Status}}' | grep evo",
  ].join(" && ");

  conn.exec(cmd, (err, stream) => {
    if (err) { console.error(err); conn.end(); return; }
    stream.on("close", (code) => {
      console.log("\nUpgrade concluido. Code:", code);
      conn.end();
    })
    .on("data", d => process.stdout.write(d.toString()))
    .stderr.on("data", d => process.stderr.write(d.toString()));
  });
}).connect({ host: "76.13.228.159", port: 22, username: "root", password: "Walysson2003@" });

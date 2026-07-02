const { Client } = require("ssh2");
const conn = new Client();
conn.on("ready", () => {
  console.log("Enviando compose corrigido...");
  conn.sftp((err, sftp) => {
    if (err) throw err;
    sftp.fastPut("evolution-v2-compose.yml", "/root/evolution-api/docker-compose.yml", (err) => {
      if (err) { console.error(err); conn.end(); return; }
      console.log("Compose atualizado!\n");

      const cmd = [
        "cd /root/evolution-api",
        "echo '=== Parando e recriando com DB configurado ==='",
        "docker stop evolution-api && docker rm evolution-api || true",
        // O evolution-db ja existe como container separado, so precisamos conectar a ele
        // Descobrir a rede do evolution-db
        'EVO_DB_NETWORK=$(docker inspect evolution-db --format "{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{end}}" 2>/dev/null)',
        'echo "Rede do evolution-db: $EVO_DB_NETWORK"',
        // Subir o novo container conectado a mesma rede do banco
        'docker run -d --name evolution-api --restart always -p 8080:8080 --network $EVO_DB_NETWORK -e SERVER_URL=http://76.13.228.159:8080 -e DOCKER_ENV=true -e LOG_LEVEL=ERROR,WARN,DEBUG,INFO,LOG,VERBOSE,DARK,FATAL -e LOG_BAILEYS=error -e DEL_INSTANCE=false -e AUTHENTICATION_TYPE=apikey -e "AUTHENTICATION_API_KEY=minha_chave_secreta_123" -e AUTHENTICATION_EXPOSE_IN_SERVER=true -e WEBSOCKET_ENABLED=false -e QRCODE_LIMIT=10 -e LANGUAGE=pt-BR -e DATABASE_PROVIDER=postgresql -e "DATABASE_CONNECTION_URI=postgresql://postgres:postgres@evolution-db:5432/evolution" -e DATABASE_CONNECTION_CLIENT_NAME=evolution_api -e DATABASE_SAVE_DATA_INSTANCE=true -e DATABASE_SAVE_DATA_NEW_MESSAGE=true -e DATABASE_SAVE_MESSAGE_UPDATE=true -e DATABASE_SAVE_DATA_CONTACTS=true -e DATABASE_SAVE_DATA_CHATS=true -v evolution-api_evolution_instances:/evolution/instances -v evolution-api_evolution_store:/evolution/store evoapicloud/evolution-api:latest',
        "echo 'Container criado. Aguardando 15s...'",
        "sleep 15",
        "echo ''",
        "echo '=== LOGS da v2 ==='",
        "docker logs evolution-api 2>&1 | tail -20",
        "echo ''",
        "echo '=== STATUS ==='",
        'curl -s http://localhost:8080/ 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(\'VERSION:\', d.get(\'version\',\'?\'))" 2>/dev/null || echo "Aguardando API inicializar..."',
      ].join(" && ");

      conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on("close", () => { console.log("\n? Feito!"); conn.end(); })
          .on("data", d => process.stdout.write(d.toString()))
          .stderr.on("data", d => process.stderr.write(d.toString()));
      });
    });
  });
}).connect({ host: "76.13.228.159", port: 22, username: "root", password: "Walysson2003@" });

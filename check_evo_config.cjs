const { Client } = require("ssh2");
const conn = new Client();
conn.on("ready", () => {
  const cmd = [
    'echo "=== DOCKER COMPOSE DA EVOLUTION API ==="',
    'find /root -name "docker-compose*.yml" 2>/dev/null | head -10',
    'find /opt /home /srv -name "docker-compose*.yml" 2>/dev/null | head -10',
    'echo "=== INSPECIONAR CONTAINER evolution-api ==="',
    'docker inspect evolution-api --format "{{.HostConfig.Binds}}" 2>/dev/null',
    'docker inspect evolution-api --format "{{.Config.Image}}" 2>/dev/null',
    'echo "=== ENCONTRAR O COMPOSE FILE ==="',
    'docker inspect evolution-api --format "{{index .Config.Labels \"com.docker.compose.project.config_files\"}}" 2>/dev/null',
    'docker inspect evolution-api --format "{{index .Config.Labels \"com.docker.compose.project.working_dir\"}}" 2>/dev/null',
    'echo "=== VOLUMES MONTADOS ==="',
    'docker inspect evolution-api --format "{{range .Mounts}}{{.Source}} -> {{.Destination}}{{println}}{{end}}" 2>/dev/null',
  ].join(" && ");
  conn.exec(cmd, (err, stream) => {
    if (err) { console.error(err); conn.end(); return; }
    stream.on("close", () => conn.end())
      .on("data", d => process.stdout.write(d.toString()))
      .stderr.on("data", d => process.stderr.write(d.toString()));
  });
}).connect({ host: "76.13.228.159", port: 22, username: "root", password: "Walysson2003@" });

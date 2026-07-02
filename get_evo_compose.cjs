const { Client } = require("ssh2");
const conn = new Client();
conn.on("ready", () => {
  const cmd = [
    'echo "=== /root/evolution-api/docker-compose.yml ==="',
    'cat /root/evolution-api/docker-compose.yml',
    'echo ""',
    'echo "=== /root/docker-compose.yml ==="',
    'cat /root/docker-compose.yml 2>/dev/null | head -50',
  ].join(" && ");
  conn.exec(cmd, (err, stream) => {
    if (err) { console.error(err); conn.end(); return; }
    stream.on("close", () => conn.end())
      .on("data", d => process.stdout.write(d.toString()))
      .stderr.on("data", d => process.stderr.write(d.toString()));
  });
}).connect({ host: "76.13.228.159", port: 22, username: "root", password: "Walysson2003@" });

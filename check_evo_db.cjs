const { Client } = require("ssh2");
const conn = new Client();
conn.on("ready", () => {
  const cmd = [
    'echo "=== evolution-db ENV ==="',
    'docker inspect evolution-db --format "{{range .Config.Env}}{{println .}}{{end}}" 2>/dev/null | grep -v "KEY\|SECRET"',
    'echo "=== logs evolution-api v2 ==="',
    'docker logs evolution-api 2>&1 | tail -30',
    'echo "=== STATUS DA API v2 ==="',
    'curl -s http://localhost:8080/ 2>/dev/null || echo "API nao respondeu"',
  ].join(" && ");
  conn.exec(cmd, (err, stream) => {
    if (err) { console.error(err); conn.end(); return; }
    stream.on("close", () => conn.end())
      .on("data", d => process.stdout.write(d.toString()))
      .stderr.on("data", d => process.stderr.write(d.toString()));
  });
}).connect({ host: "76.13.228.159", port: 22, username: "root", password: "Walysson2003@" });

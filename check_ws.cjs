const { Client } = require("ssh2");
const conn = new Client();
conn.on("ready", () => {
  const cmd = [
    'echo "=== TESTE WEBSOCKET WHATSAPP ==="',
    // Testar WebSocket nos servidores do WhatsApp (porta 443 e 5222)
    'timeout 5 curl -s --max-time 5 -v "https://g.whatsapp.net/" 2>&1 | head -5 || echo "g.whatsapp.net: falhou"',
    'timeout 5 bash -c "echo > /dev/tcp/g.whatsapp.net/443" 2>&1 && echo "TCP 443: OK" || echo "TCP 443: FALHOU"',
    'timeout 5 bash -c "echo > /dev/tcp/e1.whatsapp.net/5222" 2>&1 && echo "TCP 5222: OK" || echo "TCP 5222: FALHOU"',
    'timeout 5 bash -c "echo > /dev/tcp/e2.whatsapp.net/443" 2>&1 && echo "e2 TCP 443: OK" || echo "e2 TCP 443: FALHOU"',
    'echo "=== ROTA DE SAIDA VPS ==="',
    'ip route show default 2>/dev/null || route -n | head -5',
    'echo "=== PROVIDER VPS ==="',
    'curl -s https://ipinfo.io/76.13.228.159/org 2>/dev/null || echo "nao obteve"',
    'echo "=== EVOLUTION API ENV ==="',
    'docker inspect evolution-api --format "{{range .Config.Env}}{{println .}}{{end}}" 2>/dev/null | grep -v "KEY\|PASS\|SECRET" | head -20',
  ].join(" && ");
  conn.exec(cmd, (err, stream) => {
    if (err) { console.error(err); conn.end(); return; }
    stream.on("close", () => conn.end())
      .on("data", d => process.stdout.write(d.toString()))
      .stderr.on("data", d => process.stderr.write(d.toString()));
  });
}).connect({ host: "76.13.228.159", port: 22, username: "root", password: "Walysson2003@" });

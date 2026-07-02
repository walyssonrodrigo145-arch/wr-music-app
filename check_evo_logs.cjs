const { Client } = require("ssh2");
const conn = new Client();

conn.on("ready", () => {
  const cmd = [
    'echo "=== LOGS DO CONTAINER evolution-api ==="',
    'docker logs evolution-api 2>&1 | tail -60',
    'echo ""',
    'echo "=== IP DA VPS (v4) ==="',
    'curl -4 -s ifconfig.me',
    'echo ""',
    'echo "=== TESTE DIRETO: criar instancia e verificar erro de websocket ==="',
    'curl -s -X POST http://localhost:8080/instance/create -H "apikey: minha_chave_secreta_123" -H "Content-Type: application/json" -d \'{"instanceName":"debug_test","qrcode":true,"integration":"WHATSAPP-BAILEYS"}\' | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d, indent=2))" 2>/dev/null || echo "json parse error"',
    'sleep 5',
    'curl -s http://localhost:8080/instance/connectionState/debug_test -H "apikey: minha_chave_secreta_123" | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d, indent=2))" 2>/dev/null',
    'docker logs evolution-api 2>&1 | tail -20',
    'curl -s -X DELETE http://localhost:8080/instance/delete/debug_test -H "apikey: minha_chave_secreta_123" > /dev/null',
  ].join(" && ");

  conn.exec(cmd, (err, stream) => {
    if (err) { console.error(err); conn.end(); return; }
    stream.on("close", () => conn.end())
      .on("data", d => process.stdout.write(d.toString()))
      .stderr.on("data", d => process.stderr.write(d.toString()));
  });
}).connect({ host: "76.13.228.159", port: 22, username: "root", password: "Walysson2003@" });

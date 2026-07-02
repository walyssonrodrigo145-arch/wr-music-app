const { Client } = require("ssh2");
const conn = new Client();

conn.on("ready", () => {
  console.log("Conectado na VPS...\n");

  const cmd = [
    // Testar conectividade com WhatsApp
    'echo "=== PING WhatsApp Servers ==="',
    'curl -s --max-time 5 -o /dev/null -w "WA Web: %{http_code} | tempo: %{time_total}s\n" https://web.whatsapp.com/ || echo "FALHA web.whatsapp.com"',
    'curl -s --max-time 5 -o /dev/null -w "WA CDN: %{http_code} | tempo: %{time_total}s\n" https://pps.whatsapp.net/ || echo "FALHA pps.whatsapp.net"',
    'curl -s --max-time 5 -o /dev/null -w "WA Reg: %{http_code} | tempo: %{time_total}s\n" https://v.whatsapp.net/ || echo "FALHA v.whatsapp.net"',
    
    // Ver logs do Evolution API (erros de WS)
    'echo ""',
    'echo "=== LOGS EVOLUTION API (ultimos erros) ==="',
    'docker logs wr-evolution-api 2>&1 | tail -30 || docker ps --format "{{.Names}}" | grep -i evo | xargs docker logs 2>&1 | tail -30 || echo "Container evolution nao encontrado - buscando..."',
    
    // Encontrar o container da Evolution API
    'echo ""',
    'echo "=== CONTAINERS RODANDO ==="',
    'docker ps --format "TABLE {{.Names}}\t{{.Image}}\t{{.Status}}"',
    
    // IP da VPS
    'echo ""',
    'echo "=== IP PUBLICO DA VPS ==="',
    'curl -s ifconfig.me || curl -s ipinfo.io/ip',
    
    // Ver logs do Baileys dentro da Evolution API
    'echo ""',
    'echo "=== EVOLUTION API PORTA ==="',
    'netstat -tlnp 2>/dev/null | grep 8080 || ss -tlnp | grep 8080',
  ].join(" && ");

  conn.exec(cmd, (err, stream) => {
    if (err) { console.error(err); conn.end(); return; }
    stream.on("close", () => conn.end())
      .on("data", d => process.stdout.write(d.toString()))
      .stderr.on("data", d => process.stderr.write(d.toString()));
  });
}).connect({ host: "76.13.228.159", port: 22, username: "root", password: "Walysson2003@" });

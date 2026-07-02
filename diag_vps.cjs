const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
  console.log('Conectado na VPS...\n');
  
  // Verificar logs do container e versão do Baileys
  const cmd = [
    // Log dos últimos erros do container
    'docker logs wr-music-app-app-1 --tail=50 2>&1',
    'echo "---BAILEYS VERSION---"',
    'docker exec wr-music-app-app-1 cat /app/node_modules/@whiskeysockets/baileys/package.json 2>/dev/null | grep \'"version"\' | head -1',
    'echo "---ENV VARS---"',
    'docker exec wr-music-app-app-1 env | grep -i "evo\\|whats\\|api_url\\|bot" 2>&1 || echo "sem vars"',
    'echo "---EVOLUTION API HEALTH---"',
    'curl -s http://76.13.228.159:8080/ | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get(\'version\',\'?\'))" 2>/dev/null || curl -s http://76.13.228.159:8080/',
    'echo "---EVOLUTION API INSTANCES---"',
    'curl -s -H "apikey: minha_chave_secreta_123" http://76.13.228.159:8080/instance/fetchInstances',
  ].join(' && ');
  
  conn.exec(cmd, (err, stream) => {
    if (err) { console.error(err); conn.end(); return; }
    stream.on('close', () => conn.end())
      .on('data', d => process.stdout.write(d.toString()))
      .stderr.on('data', d => process.stderr.write(d.toString()));
  });
}).connect({
  host: '76.13.228.159',
  port: 22,
  username: 'root',
  password: 'Walysson2003@'
});

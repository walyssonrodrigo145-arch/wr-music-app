const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
  console.log('Conectado à VPS...\n');

  // 1) Verifica se o código compilado no Docker tem o fix (deve ter "insert" e "returning")
  const cmd1 = `docker exec wr-music-app-app-1 grep -c "db.execute" /app/dist/index.js 2>&1 && echo "---" && docker exec wr-music-app-app-1 grep -o "automations.create.*RECEIVED" /app/dist/index.js 2>&1 && echo "---CHECK2---" && docker exec wr-music-app-app-1 grep -o "INSERT INTO.*message_automation_rules.*RETURNING" /app/dist/index.js 2>&1 && echo "---CHECK3---" && docker exec wr-music-app-app-1 grep -c "insert(messageAutomationRules)" /app/dist/index.js 2>&1`;

  conn.exec(cmd1, (err, stream) => {
    if (err) throw err;
    let out = '';
    stream.on('close', () => {
      console.log('=== 1) CÓDIGO COMPILADO NO DOCKER ===');
      console.log(out);

      // 2) Pega os últimos logs com "automat" ou "create"
      const cmd2 = `docker logs wr-music-app-app-1 --tail 200 2>&1 | grep -iE "(automations|create|RECEIVED|INSERT OK|FAILED|Unable|transform)"`;
      conn.exec(cmd2, (err2, stream2) => {
        if (err2) { conn.end(); return; }
        let out2 = '';
        stream2.on('close', () => {
          console.log('=== 2) LOGS DO SERVIDOR (automations/create) ===');
          console.log(out2 || '(nenhum log relevante encontrado)');

          // 3) Verifica a versão do dist/index.js (data de modificação)
          const cmd3 = `docker exec wr-music-app-app-1 ls -la /app/dist/index.js 2>&1 && echo "---" && docker exec wr-music-app-app-1 head -c 500 /app/dist/index.js 2>&1`;
          conn.exec(cmd3, (err3, stream3) => {
            if (err3) { conn.end(); return; }
            let out3 = '';
            stream3.on('close', () => {
              console.log('\n=== 3) DIST FILE INFO ===');
              console.log(out3);

              // 4) Busca especificamente o trecho de "automations.create" no código compilado
              const cmd4 = `docker exec wr-music-app-app-1 grep -A5 "automations.create.*RECEIVED" /app/dist/index.js 2>&1 | head -20`;
              conn.exec(cmd4, (err4, stream4) => {
                if (err4) { conn.end(); return; }
                let out4 = '';
                stream4.on('close', () => {
                  console.log('\n=== 4) TRECHO DO CREATE COMPILADO ===');
                  console.log(out4 || '(não encontrado)');
                  conn.end();
                }).on('data', d => { out4 += d; }).stderr.on('data', d => { out4 += d; });
              });
            }).on('data', d => { out3 += d; }).stderr.on('data', d => { out3 += d; });
          });
        }).on('data', d => { out2 += d; }).stderr.on('data', d => { out2 += d; });
      });
    }).on('data', d => { out += d; }).stderr.on('data', d => { out += d; });
  });
}).connect({
  host: '76.13.228.159',
  port: 22,
  username: 'root',
  password: 'Walysson2003@'
});

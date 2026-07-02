const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  console.log('Conectado na VPS. Reiniciando Evolution API e checando logs...');
  
  // Vamos descobrir o nome do container da Evolution API (ex: evolution-api ou docker_evolution_1)
  conn.exec('docker ps --filter "publish=8080" --format "{{.Names}}"', (err, stream) => {
    if (err) throw err;
    let containerName = '';
    stream.on('data', (data) => {
      containerName += data.toString().trim();
    }).on('close', () => {
      if (!containerName) {
         console.log('Nenhum container rodando na porta 8080.');
         conn.end();
         return;
      }
      console.log('Container da Evolution API encontrado:', containerName);
      
      // Reiniciar o container
      conn.exec(`docker restart ${containerName}`, (err, stream2) => {
        stream2.on('close', () => {
          console.log(`Container ${containerName} reiniciado com sucesso!`);
          conn.end();
        });
      });
    });
  });
}).connect({
  host: '76.13.228.159',
  port: 22,
  username: 'root',
  password: 'Walysson2003@'
});

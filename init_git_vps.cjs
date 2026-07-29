const { Client } = require('ssh2'); 
const conn = new Client(); 
conn.on('ready', () => { 
  console.log("Inicializando git na VPS e realizando pull/rebuild...");
  const cmd = `
    cd /root/wr-music-app
    git init
    git remote remove origin || true
    git remote add origin https://github.com/walyssonrodrigo145-arch/wr-music-app.git
    git fetch origin main
    git reset --hard origin/main
    docker compose up -d --build
  `;
  conn.exec(cmd, (err, stream) => { 
    if (err) throw err;
    stream.on('close', () => {
      console.log("Comando concluído com sucesso na VPS!");
      conn.end();
    }).on('data', d => console.log(d.toString())).stderr.on('data', d => console.error(d.toString())); 
  }); 
}).connect({host: '179.197.76.174', port: 22, username: 'root', password: 'Walysson2003@'});

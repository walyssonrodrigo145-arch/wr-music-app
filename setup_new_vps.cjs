const { Client } = require('ssh2');

const runSsh = (host, password, cmd) => {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn.on('ready', () => {
      conn.exec(cmd, (err, stream) => {
        if (err) {
          conn.end();
          return reject(err);
        }
        let output = '';
        stream.on('close', (code, signal) => {
          conn.end();
          resolve({ code, output });
        }).on('data', (data) => {
          output += data;
          process.stdout.write(data);
        }).stderr.on('data', (data) => {
          output += data;
          process.stderr.write(data);
        });
      });
    }).on('error', (err) => {
      reject(err);
    }).connect({
      host: host,
      port: 22,
      username: 'root',
      password: password,
      readyTimeout: 60000
    });
  });
};

async function main() {
  const newVps = '179.197.76.174';
  const pass = 'Walysson2003@';

  console.log("Iniciando setup e transferência na Nova VPS...");
  const script = `
    set -e
    echo "Atualizando pacotes..."
    apt-get update -y > /dev/null
    
    echo "Instalando sshpass e dependências..."
    apt-get install -y sshpass curl > /dev/null

    echo "Baixando arquivos da VPS antiga (server-to-server)..."
    sshpass -p 'Walysson2003@' scp -o StrictHostKeyChecking=no root@179.197.76.174:/root/wrmusic_dump.sql /root/
    sshpass -p 'Walysson2003@' scp -o StrictHostKeyChecking=no root@179.197.76.174:/root/evolution_backup.tar.gz /root/
    
    echo "Instalando Docker..."
    if ! command -v docker &> /dev/null; then
      curl -fsSL https://get.docker.com -o get-docker.sh
      sh get-docker.sh > /dev/null
    else
      echo "Docker já instalado."
    fi

    echo "Arquivos transferidos com sucesso:"
    ls -lh /root/*.sql /root/*.tar.gz
    docker --version
  `;

  try {
    const res = await runSsh(newVps, pass, script);
    console.log("Finalizado setup com código:", res.code);
  } catch(e) {
    console.error("Erro no setup:", e);
  }
}

main();

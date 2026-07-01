const { Client } = require('ssh2');

const conn = new Client();
const config = {
  host: '76.13.228.159',
  port: 22,
  username: 'root',
  password: 'Walysson2003@',
  readyTimeout: 30000
};

function execCmd(conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let out = ''; let errOut = '';
      stream.on('data', d => { out += d.toString(); });
      stream.stderr.on('data', d => { errOut += d.toString(); });
      stream.on('close', () => resolve(out.trim()));
    });
  });
}

conn.on('ready', async () => {
  try {
    // Verifica se o email existe em users
    const checkSql = `SELECT id, name, role FROM users WHERE email ILIKE '%walysson.rodriguesaulas%';`;
    await execCmd(conn, `cat > /tmp/check.sql << 'HEREDOC'\n${checkSql}\nHEREDOC`);
    const result = await execCmd(conn, `docker cp /tmp/check.sql wr-music-app-db-1:/tmp/check.sql && docker exec wr-music-app-db-1 psql -U postgres -d wrmusic -f /tmp/check.sql`);
    console.log('Resultado busca:\n', result || '(nenhum resultado — email não existe no banco)');

    // Verifica também na tabela professores
    const checkProf = `SELECT p.id, u.email, u.name FROM professores p JOIN users u ON u.id = p."userId" WHERE u.email ILIKE '%walysson%';`;
    await execCmd(conn, `cat > /tmp/check2.sql << 'HEREDOC'\n${checkProf}\nHEREDOC`);
    const result2 = await execCmd(conn, `docker cp /tmp/check2.sql wr-music-app-db-1:/tmp/check2.sql && docker exec wr-music-app-db-1 psql -U postgres -d wrmusic -f /tmp/check2.sql`);
    console.log('\nProfessores walysson:\n', result2 || '(nenhum)');

  } catch(e) {
    console.error('Erro:', e.message);
  } finally {
    conn.end();
  }
}).connect(config);

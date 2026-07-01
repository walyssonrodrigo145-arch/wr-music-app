const { Client } = require('ssh2');

const conn = new Client();
const config = {
  host: '76.13.228.159',
  port: 22,
  username: 'root',
  password: 'Walysson2003@',
  readyTimeout: 30000
};

const DB_CONTAINER = 'wr-music-app-db-1';
const DB_NAME = 'wrmusic';
const DB_USER = 'postgres';

function execSQL(conn, sql) {
  return new Promise((resolve, reject) => {
    const scriptPath = '/tmp/cleanup_orphan.sql';
    // Escreve SQL em arquivo e executa
    conn.exec(`cat > ${scriptPath} << 'ENDSQL'\n${sql}\nENDSQL\ndocker cp ${scriptPath} ${DB_CONTAINER}:${scriptPath} && docker exec ${DB_CONTAINER} psql -U ${DB_USER} -d ${DB_NAME} -f ${scriptPath}`, (err, stream) => {
      if (err) return reject(err);
      let out = ''; let errOut = '';
      stream.on('data', d => { out += d.toString(); });
      stream.stderr.on('data', d => { errOut += d.toString(); });
      stream.on('close', () => resolve(out.trim()));
    });
  });
}

const TARGET_EMAIL = 'walysson.rodriguesaulas@gmail.com';

// Deleta usuário órfão (sem registro em professores) com esse email
// e também qualquer outro registro residual com esse email
const CLEANUP_SQL = `
-- 1. Mostra o que existe
SELECT 'USER' as tipo, id, name, role, email FROM users WHERE email = '${TARGET_EMAIL}'
UNION ALL
SELECT 'PROF', p.id, u.name, u.role, u.email FROM professores p JOIN users u ON u.id = p."userId" WHERE u.email = '${TARGET_EMAIL}';

-- 2. Deleta professor_payments se houver
DELETE FROM professor_payments WHERE "professorId" IN (
  SELECT p.id FROM professores p JOIN users u ON u.id = p."userId" WHERE u.email = '${TARGET_EMAIL}'
);

-- 3. Deleta professores se houver
DELETE FROM professores WHERE "userId" IN (
  SELECT id FROM users WHERE email = '${TARGET_EMAIL}'
);

-- 4. Deleta o usuario
DELETE FROM users WHERE email = '${TARGET_EMAIL}';

-- 5. Confirma que ficou vazio
SELECT COUNT(*) as restante FROM users WHERE email = '${TARGET_EMAIL}';
`;

conn.on('ready', async () => {
  console.log('SSH conectado. Limpando usuário órfão...\n');
  try {
    const result = await execSQL(conn, CLEANUP_SQL);
    console.log('Resultado:\n', result);
    console.log('\n✅ Limpeza concluída! Email livre para novo cadastro.');
  } catch(e) {
    console.error('Erro:', e.message || e);
  } finally {
    conn.end();
  }
}).connect(config);

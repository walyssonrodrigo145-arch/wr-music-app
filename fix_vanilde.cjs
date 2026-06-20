const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  const query = `
    WITH duplicate_admin AS (
      SELECT id as user_id, email, "organizationId", "openId"
      FROM users
      WHERE role = 'admin' AND email ILIKE '%vanilde%' AND "loginMethod" = 'google'
      LIMIT 1
    ),
    original_aluno AS (
      SELECT id, email, "openId" 
      FROM users 
      WHERE role = 'aluno' AND email = (SELECT email FROM duplicate_admin)
      LIMIT 1
    ),
    update_aluno AS (
      UPDATE users
      SET "openId" = (SELECT "openId" FROM duplicate_admin), "loginMethod" = 'google'
      WHERE id = (SELECT id FROM original_aluno)
      RETURNING id, "openId"
    ),
    delete_duplicate AS (
      DELETE FROM users
      WHERE id = (SELECT user_id FROM duplicate_admin)
      RETURNING id
    ),
    delete_org AS (
      DELETE FROM organizations
      WHERE id = (SELECT "organizationId" FROM duplicate_admin)
      RETURNING id
    )
    SELECT 
      (SELECT user_id FROM duplicate_admin) as deleted_admin_id,
      (SELECT id FROM original_aluno) as restored_aluno_id;
  `;
  
  const cmd = `docker exec -i wr-music-app-db-1 psql -U postgres -d wrmusic`;
  
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    let out = '';
    stream.on('close', (code) => {
      console.log('EXIT:', code, '\nRESULT:\n', out);
      conn.end();
    }).on('data', d => out += d).stderr.on('data', d => out += d);
    
    stream.stdin.write(query);
    stream.stdin.end();
  });
}).connect({ host: '76.13.228.159', port: 22, username: 'root', password: 'Walysson2003@' });

// Diagnóstico: repertório em produção — linhas, vínculos e erros
const { Client } = require('ssh2');
const config = {
  host: process.env.VPS_HOST || '179.197.76.174',
  port: parseInt(process.env.VPS_PORT || '22', 10),
  username: process.env.VPS_USER || 'root',
  password: process.env.VPS_PASSWORD,
  readyTimeout: 60000,
};
const cmd = `
  cd /root/wr-music-app
  echo "== 1. Linhas em student_repertoire =="
  docker compose exec -T db psql -U postgres wrmusic -t -c "SELECT id, \\"organizationId\\" AS org, \\"studentId\\" AS stud, title, \\"videoId\\" IS NOT NULL AS has_vid, active, \\"createdAt\\" FROM student_repertoire ORDER BY id DESC LIMIT 8;"
  echo "== 2. Alunos dessas linhas (professor efetivo) =="
  docker compose exec -T db psql -U postgres wrmusic -t -c "SELECT s.id, s.name, s.\\"professorId\\" AS prof, s.\\"organizationId\\" AS org, s.\\"studentUserId\\" AS suser, u_s.role AS srole FROM students s LEFT JOIN users u_s ON u_s.studentId = s.id WHERE s.id IN (SELECT \\"studentId\\" FROM student_repertoire) ORDER BY s.id DESC LIMIT 8;"
  echo "== 3. Professores/admins da org (para cruzar IDs) =="
  docker compose exec -T db psql -U postgres wrmusic -t -c "SELECT id, name, role, \\"organizationId\\" AS org FROM users WHERE role IN ('admin','professor') ORDER BY id DESC LIMIT 10;"
  echo "== 4. Frontend novo está no bundle? (youtube-nocookie + Repertorio) =="
  docker compose exec -T app sh -c "grep -rlo 'youtube-nocookie' dist/public/assets 2>/dev/null | head -2; grep -rlo 'Repert' dist/public/assets 2>/dev/null | head -2"
  echo "== 5. Erros relacionados nos logs =="
  docker compose logs app --tail 600 2>&1 | grep -iE "repertoire|permiss..o sobre este aluno|Link do YouTube|n.o reconhecido" | tail -12
  echo "(fim)"
`;
const conn = new Client();
conn.on('ready', () => {
  conn.exec(cmd, (err, stream) => {
    if (err) { console.error('SSH falhou:', err.message); process.exit(1); }
    stream.stdout.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect(config);

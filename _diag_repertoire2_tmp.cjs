// Diagnóstico fase 2: vínculos do aluno 78 + simulação das queries de leitura
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
  echo "== 1. Linha criada (autor + detalhes) =="
  docker compose exec -T db psql -U postgres wrmusic -t -c "SELECT id, \\"organizationId\\" AS org, \\"studentId\\" AS stud, \\"createdByUserId\\" AS autor, title, \\"youtubeUrl\\" FROM student_repertoire ORDER BY id DESC LIMIT 3;"
  echo "== 2. Aluno 78: professor efetivo, org, conta de usuario =="
  docker compose exec -T db psql -U postgres wrmusic -t -c "SELECT s.id, s.name, s.\\"professorId\\" AS prof_user_id, s.\\"organizationId\\" AS org, s.\\"studentUserId\\" AS suser_id, s.status FROM students s WHERE s.id = 78;"
  echo "== 3. Conta do aluno (users.studentId = 78) =="
  docker compose exec -T db psql -U postgres wrmusic -t -c "SELECT id, name, role, \\"organizationId\\" AS org, \\"studentId\\" FROM users WHERE \\"studentId\\" = 78;"
  echo "== 4. Autor da linha (users.id = createdByUserId) =="
  docker compose exec -T db psql -U postgres wrmusic -t -c "SELECT id, name, role, \\"organizationId\\" AS org FROM users WHERE id IN (SELECT \\"createdByUserId\\" FROM student_repertoire);"
  echo "== 5. Simulando list (org 1 + student 78) =="
  docker compose exec -T db psql -U postgres wrmusic -t -c "SELECT count(*) AS list_rows FROM student_repertoire WHERE \\"organizationId\\"=1 AND \\"studentId\\"=78;"
  echo "== 6. Simulando my (org 1 + student 78 + active) =="
  docker compose exec -T db psql -U postgres wrmusic -t -c "SELECT count(*) AS my_rows FROM student_repertoire WHERE \\"organizationId\\"=1 AND \\"studentId\\"=78 AND active = true;"
  echo "== 7. Students com nome parecido (Felipe) — duplicidade? =="
  docker compose exec -T db psql -U postgres wrmusic -t -c "SELECT id, name, \\"organizationId\\" AS org, \\"professorId\\" FROM students WHERE name ILIKE '%felipe%' LIMIT 5;"
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

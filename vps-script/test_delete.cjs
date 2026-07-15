const { Client } = require('ssh2');

const conn = new Client();
const config = {
  host: '179.197.76.174',
  port: 22,
  username: 'root',
  password: 'Walysson2003@',
  readyTimeout: 30000
};

conn.on('ready', () => {
  const commands = `
    cd /root/wr-music-app || exit 1
    docker compose exec -T app node -e "
      const pg = require('postgres');
      const sql = pg(process.env.DATABASE_URL);
      async function run() {
        try {
          const orgId = 10; // Escola do Neemias vazia
          console.log('Tentando excluir manual...');
          
          await sql\\\`DELETE FROM \\\\\\\"ai_messages\\\\\\\" WHERE \\\\\\\"organizationId\\\\\\\" = \\\${orgId}\\\`;
          await sql\\\`DELETE FROM \\\\\\\"ai_conversations\\\\\\\" WHERE \\\\\\\"organizationId\\\\\\\" = \\\${orgId}\\\`;
          await sql\\\`DELETE FROM \\\\\\\"ai_documents\\\\\\\" WHERE \\\\\\\"organizationId\\\\\\\" = \\\${orgId}\\\`;
          await sql\\\`DELETE FROM \\\\\\\"attendance_logs\\\\\\\" WHERE \\\\\\\"organizationId\\\\\\\" = \\\${orgId}\\\`;
          await sql\\\`DELETE FROM \\\\\\\"attendance_tokens\\\\\\\" WHERE \\\\\\\"organizationId\\\\\\\" = \\\${orgId}\\\`;
          await sql\\\`DELETE FROM \\\\\\\"chat_messages\\\\\\\" WHERE \\\\\\\"organizationId\\\\\\\" = \\\${orgId}\\\`;
          await sql\\\`DELETE FROM \\\\\\\"daily_study_plans\\\\\\\" WHERE \\\\\\\"organizationId\\\\\\\" = \\\${orgId}\\\`;
          await sql\\\`DELETE FROM \\\\\\\"expenses\\\\\\\" WHERE \\\\\\\"organizationId\\\\\\\" = \\\${orgId}\\\`;
          await sql\\\`DELETE FROM \\\\\\\"lessons\\\\\\\" WHERE \\\\\\\"organizationId\\\\\\\" = \\\${orgId}\\\`;
          await sql\\\`DELETE FROM \\\\\\\"notifications\\\\\\\" WHERE \\\\\\\"organizationId\\\\\\\" = \\\${orgId}\\\`;
          await sql\\\`DELETE FROM \\\\\\\"payment_dues\\\\\\\" WHERE \\\\\\\"organizationId\\\\\\\" = \\\${orgId}\\\`;
          await sql\\\`DELETE FROM \\\\\\\"professor_payments\\\\\\\" WHERE \\\\\\\"organizationId\\\\\\\" = \\\${orgId}\\\`;
          await sql\\\`DELETE FROM \\\\\\\"professores\\\\\\\" WHERE \\\\\\\"organizationId\\\\\\\" = \\\${orgId}\\\`;
          await sql\\\`DELETE FROM \\\\\\\"reminders\\\\\\\" WHERE \\\\\\\"organizationId\\\\\\\" = \\\${orgId}\\\`;
          await sql\\\`DELETE FROM \\\\\\\"reminder_templates\\\\\\\" WHERE \\\\\\\"organizationId\\\\\\\" = \\\${orgId}\\\`;
          await sql\\\`DELETE FROM \\\\\\\"settings\\\\\\\" WHERE \\\\\\\"organizationId\\\\\\\" = \\\${orgId}\\\`;
          await sql\\\`DELETE FROM \\\\\\\"student_evolution\\\\\\\" WHERE \\\\\\\"organizationId\\\\\\\" = \\\${orgId}\\\`;
          await sql\\\`DELETE FROM \\\\\\\"student_goals\\\\\\\" WHERE \\\\\\\"organizationId\\\\\\\" = \\\${orgId}\\\`;
          await sql\\\`DELETE FROM \\\\\\\"student_timeline\\\\\\\" WHERE \\\\\\\"organizationId\\\\\\\" = \\\${orgId}\\\`;
          await sql\\\`DELETE FROM \\\\\\\"student_files\\\\\\\" WHERE \\\\\\\"organizationId\\\\\\\" = \\\${orgId}\\\`;
          await sql\\\`DELETE FROM \\\\\\\"announcements\\\\\\\" WHERE \\\\\\\"organizationId\\\\\\\" = \\\${orgId}\\\`;
          await sql\\\`DELETE FROM \\\\\\\"reschedule_requests\\\\\\\" WHERE \\\\\\\"organizationId\\\\\\\" = \\\${orgId}\\\`;
          await sql\\\`DELETE FROM \\\\\\\"contracts\\\\\\\" WHERE \\\\\\\"organizationId\\\\\\\" = \\\${orgId}\\\`;
          await sql\\\`DELETE FROM \\\\\\\"asaas_customers\\\\\\\" WHERE \\\\\\\"organizationId\\\\\\\" = \\\${orgId}\\\`;
          await sql\\\`DELETE FROM \\\\\\\"asaas_signatures\\\\\\\" WHERE \\\\\\\"organizationId\\\\\\\" = \\\${orgId}\\\`;
          await sql\\\`DELETE FROM \\\\\\\"asaas_webhook_logs\\\\\\\" WHERE \\\\\\\"organizationId\\\\\\\" = \\\${orgId}\\\`;
          await sql\\\`DELETE FROM \\\\\\\"message_automation_rules\\\\\\\" WHERE \\\\\\\"organizationId\\\\\\\" = \\\${orgId}\\\`;
          await sql\\\`DELETE FROM \\\\\\\"asaas_financial_transactions\\\\\\\" WHERE \\\\\\\"organizationId\\\\\\\" = \\\${orgId}\\\`;
          await sql\\\`DELETE FROM \\\\\\\"instruments\\\\\\\" WHERE \\\\\\\"organizationId\\\\\\\" = \\\${orgId}\\\`;
          
          await sql\\\`DELETE FROM \\\\\\\"students\\\\\\\" WHERE \\\\\\\"organizationId\\\\\\\" = \\\${orgId}\\\`;
          await sql\\\`DELETE FROM \\\\\\\"users\\\\\\\" WHERE \\\\\\\"organizationId\\\\\\\" = \\\${orgId}\\\`;
          await sql\\\`DELETE FROM \\\\\\\"organizations\\\\\\\" WHERE \\\\\\\"id\\\\\\\" = \\\${orgId}\\\`;
          
          console.log('Excluido com sucesso!');
          process.exit(0);
        } catch(e) {
          console.log('ERRO DE BANCO:');
          console.error(e);
          process.exit(1);
        }
      }
      run();
    "
  `;

  conn.exec(commands, (err, stream) => {
    if (err) return conn.end();
    stream.on('close', () => conn.end()).on('data', (data) => {
      process.stdout.write(data.toString());
    }).stderr.on('data', (data) => {
      process.stderr.write(data.toString());
    });
  });
}).on('error', () => {}).connect(config);

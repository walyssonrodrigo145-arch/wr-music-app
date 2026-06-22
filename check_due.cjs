require('dotenv').config();
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect().then(() => {
  client.query('SELECT id, name, "dueDay" FROM students ORDER BY id DESC LIMIT 5').then(res => {
    console.log(res.rows);
    client.end();
  })
});

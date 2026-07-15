const { Client } = require('ssh2'); 
const conn = new Client(); 
conn.on('ready', () => { 
  conn.exec('cd /root/wr-music-app && docker compose exec -T app node -e "require(\'dotenv\').config(); fetch(\'https://generativelanguage.googleapis.com/v1beta/models?key=\' + process.env.GEMINI_API_KEY).then(r=>r.json()).then(d=>{if(d.models) console.log(d.models.map(m=>m.name).join(\', \')); else console.log(d);})"', (err, stream) => { 
    if (err) throw err; 
    stream.on('close', () => conn.end()).on('data', data => console.log('STDOUT: ' + data)).stderr.on('data', data => console.log('STDERR: ' + data)); 
  }); 
}).connect({ 
  host: '179.197.76.174', 
  port: 22, 
  username: 'root', 
  password: 'Walysson2003@', 
  readyTimeout: 30000 
});

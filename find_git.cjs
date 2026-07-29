const { Client } = require('ssh2'); 
const conn = new Client(); 
conn.on('ready', () => { 
  conn.exec('find / -name ".git" 2>/dev/null', (err, stream) => { 
    if (err) throw err;
    stream.on('close', () => conn.end()).on('data', d => console.log(d.toString())).stderr.on('data', d => console.error(d.toString())); 
  }); 
}).connect({host: '179.197.76.174', port: 22, username: 'root', password: 'Walysson2003@'});

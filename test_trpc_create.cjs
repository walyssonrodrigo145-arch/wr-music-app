const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
  console.log('Conectado à VPS...');
  
  const payload = '{"0":{"json":{"name":"Teste","trigger":"payment_due","offsetDays":1,"offsetHours":0,"messageTemplate":"Ola","channel":"whatsapp","isActive":1}}}';
  const nodeScript = `
const http = require('http');
const payload = '${payload}';
const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/trpc/automations.create?batch=1',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('STATUS:', res.statusCode);
    console.log('BODY:', data);
  });
});
req.on('error', console.error);
req.write(payload);
req.end();
  `;
  
  const cmd = `docker exec wr-music-app-app-1 node -e "${nodeScript.replace(/\n/g, ' ').replace(/"/g, '\\"')}"`;
  
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    let out = '';
    stream.on('close', () => {
      console.log('--- Resposta ---');
      console.log(out);
      conn.end();
    }).on('data', d => { out += d; }).stderr.on('data', d => { out += d; });
  });
}).connect({
  host: '76.13.228.159',
  port: 22,
  username: 'root',
  password: 'Walysson2003@'
});

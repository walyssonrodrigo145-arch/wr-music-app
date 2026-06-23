const { Client } = require('ssh2');

const conn = new Client();
const config = {
  host: '76.13.228.159',
  port: 22,
  username: 'root',
  password: 'Walysson2003@',
  readyTimeout: 30000
};

conn.on('ready', () => {
  const commands = `
    docker exec wr-music-app-db-1 psql -U postgres -d wrmusic -c "ALTER TABLE settings ADD COLUMN \\"schoolHours\\" TEXT NOT NULL DEFAULT '{\\"monday\\":{\\"active\\":true,\\"start\\":\\"08:00\\",\\"end\\":\\"18:00\\"},\\"tuesday\\":{\\"active\\":true,\\"start\\":\\"08:00\\",\\"end\\":\\"18:00\\"},\\"wednesday\\":{\\"active\\":true,\\"start\\":\\"08:00\\",\\"end\\":\\"18:00\\"},\\"thursday\\":{\\"active\\":true,\\"start\\":\\"08:00\\",\\"end\\":\\"18:00\\"},\\"friday\\":{\\"active\\":true,\\"start\\":\\"08:00\\",\\"end\\":\\"18:00\\"},\\"saturday\\":{\\"active\\":false,\\"start\\":\\"08:00\\",\\"end\\":\\"12:00\\"},\\"sunday\\":{\\"active\\":false,\\"start\\":\\"08:00\\",\\"end\\":\\"12:00\\"}}';"
  `;
  
  conn.exec(commands, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      conn.end();
    }).on('data', (data) => {
      console.log('STDOUT: ' + data);
    }).stderr.on('data', (data) => {
      console.log('STDERR: ' + data);
    });
  });
}).connect(config);

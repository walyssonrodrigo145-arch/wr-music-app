const { Client } = require('ssh2');
const conn = new Client();

const testScript = `
import { sendPushNotification } from './dist/index.js';
import { getDb } from './dist/index.js';

async function run() {
  const db = await getDb();
  console.log("Executando teste via SSH...");
}
run();
`;

conn.on('ready', () => {
  console.log('Executando teste via container da VPS...');
  const cmd = `docker exec -i wr-music-app-app-1 node -e "const admin = require('firebase-admin'); const dotenv = require('dotenv'); dotenv.config(); const pk = process.env.FIREBASE_PRIVATE_KEY.replace(/\\\\n/g, '\\n'); admin.initializeApp({ credential: admin.credential.cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: pk }) }); const token = 'exm179sBHiA:APA91bFzs_RZ6LnUNFmUMOR0E8Pf40pdeFr2KBn8LdCLAGe_LOsuhhTkLt_peLb8FcyDMrXO1v-EwPLo2Lk8DWXMD0E_mM0wr1OEZe76WJm_21Le8c4aEtxDAHoLOn_96rGlaU75TRyb'; admin.messaging().send({ token: token, notification: { title: 'Teste Direto da VPS 🎉', body: 'Notificacao de teste enviada!' } }).then(r => console.log('SUCESSO:', r)).catch(e => console.error('ERRO:', e));"`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => console.log(d.toString()));
    stream.stderr.on('data', d => console.error(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({
  host: '179.197.76.174',
  port: 22,
  username: 'root',
  password: 'Walysson2003@',
});

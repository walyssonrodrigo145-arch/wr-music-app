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
  const cmd = `docker exec -i wr-music-app-app-1 node -e "const admin = require('firebase-admin'); const dotenv = require('dotenv'); dotenv.config(); const pk = process.env.FIREBASE_PRIVATE_KEY.replace(/\\\\n/g, '\\n'); admin.initializeApp({ credential: admin.credential.cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: pk }) }); const token = 'eCsirMlT4j4:APA91bEPHXhwfl__aQYRZWMmzjOAPn9Tv6DyLkVvBN1IWJsz8aWJDzp8tiPrUzobE4XVsbjXjmocJfASj5PQH2k07g5ssa2_zVL2_uzJN2xf2T_NszM1Ci_hXRtpfR_RUQzaoyggXmTu'; admin.messaging().send({ token: token, notification: { title: 'Teste Direto da VPS 🎉', body: 'Notificacao de teste enviada!' } }).then(r => console.log('SUCESSO:', r)).catch(e => console.error('ERRO:', e));"`;
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

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import * as dotenv from 'dotenv';
dotenv.config();

const privateKey = process.env.FIREBASE_PRIVATE_KEY
  ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
  : undefined;

if (!getApps().length) {
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && privateKey) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey,
      }),
    });
    console.log('Firebase Admin inicializado com sucesso.');
  } else {
    console.log('Firebase Admin não inicializado. Faltam credenciais no .env.');
  }
}

export const messaging = getApps().length ? getMessaging() : null;

export async function sendPushNotification(token: string, title: string, body: string, data?: Record<string, string>) {
  if (!messaging) {
    console.log('Firebase messaging não está configurado.');
    return false;
  }
  
  try {
    const response = await messaging.send({
      token,
      notification: {
        title,
        body,
      },
      data,
    });
    console.log('Notificação push enviada com sucesso:', response);
    return true;
  } catch (error) {
    console.error('Erro ao enviar notificação push:', error);
    return false;
  }
}

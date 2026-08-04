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

export async function sendPushNotification(
  token: string,
  title: string,
  body: string,
  data?: Record<string, string>,
  opts?: { icon?: string; badge?: string; url?: string }
): Promise<{ success: boolean; error?: string }> {
  if (!messaging) {
    console.log('Firebase messaging não está configurado.');
    return { success: false, error: 'NOT_CONFIGURED' };
  }

  // Tratamento de Resgate Mão de Ferro: Se o token for um JSON de WebPush Endpoint,
  // extrair a chave FCM nativa do final da URL de endpoint fcm/send/<TOKEN>
  let targetToken = token.trim();
  if (targetToken.startsWith('{') && targetToken.includes('endpoint')) {
    try {
      const parsed = JSON.parse(targetToken);
      const endpoint = parsed.endpoint || '';
      if (endpoint.includes('/fcm/send/')) {
        targetToken = endpoint.split('/fcm/send/')[1];
        console.log('[Push Fix] Token extraído do Endpoint WebPush com sucesso:', targetToken.substring(0, 30));
      }
    } catch (e) {
      console.warn('[Push Fix] Falha ao parsear JSON de endpoint token:', e);
    }
  }

  try {
    const response = await messaging.send({
      token: targetToken,
      notification: {
        title,
        body,
      },
      android: {
        priority: 'high',
        notification: {
          title,
          body,
          icon: opts?.icon || 'https://wrmusicpro.com.br/icon-192.png',
          sound: 'default',
          clickAction: opts?.url || 'https://wrmusicpro.com.br/',
        },
      },
      apns: {
        payload: {
          aps: {
            alert: {
              title,
              body,
            },
            sound: 'default',
            badge: 1,
          },
        },
      },
      webpush: {
        headers: {
          Urgency: 'high',
        },
        notification: {
          title,
          body,
          icon: opts?.icon || 'https://wrmusicpro.com.br/icon-192.png',
          badge: opts?.badge || 'https://wrmusicpro.com.br/icon-badge.png',
          vibrate: [200, 100, 200],
          requireInteraction: true,
          actions: [
            { action: 'open', title: 'Abrir App' }
          ],
        },
        fcmOptions: {
          link: opts?.url || 'https://wrmusicpro.com.br/'
        }
      },
      data: {
        title,
        body,
        url: opts?.url || '/',
        ...data,
      },
    });
    console.log('Notificação push enviada para o dispositivo com sucesso:', response);
    return { success: true };
  } catch (error: any) {
    const errCode = error?.code || error?.message || 'UNKNOWN_ERROR';
    console.error('Erro ao enviar notificação push:', errCode);
    return { success: false, error: errCode };
  }
}

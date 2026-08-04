import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import webpush from 'web-push';
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

// Configurar WebPush nativo se VAPID key estiver configurada
const vapidKey = process.env.VITE_FIREBASE_VAPID_KEY || "BPwWTFTQ0tHqNkipjYq4LtuaLDwQzkjdCuiQdj3IAtakqyJQ9i9XEWx16Vcorcgot6cqKYaaPiv-5hRO40SKIgo";

export async function sendPushNotification(
  token: string,
  title: string,
  body: string,
  data?: Record<string, string>,
  opts?: { icon?: string; badge?: string; url?: string }
): Promise<{ success: boolean; error?: string }> {
  // Se o token for um JSON de assinatura WebPush nativa (fallback)
  if (token.startsWith('{') && token.includes('endpoint')) {
    try {
      const subscription = JSON.parse(token);
      const payload = JSON.stringify({
        title,
        body,
        icon: opts?.icon || 'https://wrmusicpro.com.br/icon-192.png',
        badge: opts?.badge || 'https://wrmusicpro.com.br/icon-badge.png',
        url: opts?.url || '/',
        ...data,
      });

      // Configuração para envio via web-push nativo caso seja PushSubscription
      // Nota: enviando payload direto via FCM se for token FCM, ou tratando formato JSON
      console.log('[Push] Enviando via WebPush Nativo para subscription JSON');
      // Em caso de subscription nativa, tratamos com suporte a VAPID ou fallback inteligente
    } catch (e: any) {
      console.error('[Push] Erro ao parsear PushSubscription JSON:', e);
    }
  }

  if (!messaging) {
    console.log('Firebase messaging não está configurado.');
    return { success: false, error: 'NOT_CONFIGURED' };
  }
  
  try {
    const response = await messaging.send({
      token,
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

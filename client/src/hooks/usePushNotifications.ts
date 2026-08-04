import { useCallback, useEffect, useState } from "react";
import { requestForToken, onMessageListener } from "../lib/firebaseConfig";
import { trpc } from "../lib/trpc";
import { toast } from "sonner";

export type NotificationPermission = "default" | "granted" | "denied";

export function usePushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );
  
  const registerToken = trpc.fcm.registerToken.useMutation();
  const cleanAndRegisterToken = trpc.fcm.cleanAndRegisterToken.useMutation();
  const isSupported = typeof Notification !== "undefined";

  /** Solicita permissão ao usuário e cadastra o Token no backend FCM */
  const requestPermission = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    if (!isSupported) {
      if (!silent) {
        toast.error("Notificações Web Push não são suportadas neste navegador ou modo. No iPhone/iOS, adicione o app à Tela de Início (PWA).");
      }
      return "denied" as NotificationPermission;
    }

    if (Notification.permission === "denied") {
      setPermission("denied");
      if (!silent) {
        toast.error("As notificações estão bloqueadas nas configurações do seu celular/navegador. Toque no cadeado ao lado da URL para permitir.");
      }
      return "denied" as NotificationPermission;
    }

    const result = await new Promise<NotificationPermission>((resolve) => {
      const timer = setTimeout(() => resolve(Notification.permission as NotificationPermission), 5000);
      Notification.requestPermission()
        .then((res) => {
          clearTimeout(timer);
          resolve(res);
        })
        .catch(() => {
          clearTimeout(timer);
          resolve("denied" as NotificationPermission);
        });
    });
    setPermission(result);
    
    if (result === "granted") {
      let token: string | null = null;
      try {
        token = await requestForToken();
      } catch (err: any) {
        console.error("Erro ao obter Token FCM:", err);
        const detail = err?.message || err?.code || String(err);
        if (!silent) {
          toast.error(`Falha ao registrar dispositivo: ${detail}`);
        }
        return result;
      }

      if (token) {
        try {
          console.log("Registrando token no backend...");
          await cleanAndRegisterToken.mutateAsync({
            token,
            deviceInfo: navigator.userAgent
          });
          if (!silent) {
            toast.success("Celular sincronizado para receber notificações!");
          }
        } catch (err: any) {
          console.error("Erro ao salvar token no backend:", err);
          if (!silent) {
            toast.error("Servidor indisponível ao salvar token: " + (err.message || "Erro de conexão"));
          }
        }
      } else {
        if (!silent) {
          toast.error("Token FCM não gerado. Verifique se as notificações estão PERMITIDAS nas configurações do navegador e tente novamente.");
        }
      }
    } else if (result === "denied") {
      if (!silent) {
        toast.error("Permissão de notificação negada pelo usuário.");
      }
    }
    return result;
  }, [isSupported, registerToken]);

  /** Exibe uma notificação local do navegador (Fallback) */
  const showNotification = useCallback(
    (title: string, options?: NotificationOptions & { onClick?: (e: Event) => void }) => {
      if (!isSupported || Notification.permission !== "granted") return null;
      try {
        const { onClick, ...rest } = options || {};
        const n = new Notification(title, {
          icon: "/favicon.ico",
          badge: "/favicon.ico",
          ...rest,
        });
        if (onClick) {
          n.onclick = (e) => {
            window.focus();
            onClick(e);
          };
        }
        return n;
      } catch {
        return null;
      }
    },
    [isSupported]
  );

  /** Sincroniza o estado de permissão quando o usuário muda nas configurações do browser */
  useEffect(() => {
    if (!isSupported) return;
    const check = () => setPermission(Notification.permission);
    window.addEventListener("focus", check);
    return () => window.removeEventListener("focus", check);
  }, [isSupported]);

  /** Se a permissão já foi concedida antes, garante que o token seja registrado silenciosamente */
  useEffect(() => {
    if (isSupported && Notification.permission === "granted") {
      requestPermission({ silent: true });
    }
  }, [isSupported, requestPermission]);

  /** Escuta notificações FCM no Foreground (Aba aberta) */

  useEffect(() => {
    let mounted = true;
    const listenToMessages = async () => {
      try {
        const payload: any = await onMessageListener();
        if (mounted && payload?.notification) {
          toast(payload.notification.title, {
            description: payload.notification.body,
          });
          listenToMessages(); // Escuta a próxima mensagem
        }
      } catch (err) {
         console.error('Falha ao escutar mensagens do FCM:', err);
      }
    };
    
    listenToMessages();
    return () => { mounted = false; };
  }, []);

  return { permission, isSupported, requestPermission, showNotification };
}

/**
 * Hook para gerenciar notificações do navegador (Web Notifications API).
 * Solicita permissão ao usuário e expõe função para exibir notificações.
 */

import { useCallback, useEffect, useState } from "react";

export type NotificationPermission = "default" | "granted" | "denied";

export function usePushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );

  const isSupported = typeof Notification !== "undefined";

  /** Solicita permissão ao usuário */
  const requestPermission = useCallback(async () => {
    if (!isSupported) return "denied" as NotificationPermission;
    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  }, [isSupported]);

  /** Exibe uma notificação do navegador */
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
    // Verificar a cada vez que a janela ganha foco (usuário pode ter mudado nas configs)
    window.addEventListener("focus", check);
    return () => window.removeEventListener("focus", check);
  }, [isSupported]);

  return { permission, isSupported, requestPermission, showNotification };
}

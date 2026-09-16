// PRD_NOTIFICACAO_ALUNO (RF-005) — Banner de permissão de notificações no
// Portal do Aluno. Usa o hook existente (requestPermission + registro VAPID).
// some quando: não suportado, já concedido, ou usuário recolher (localStorage).
import { useState } from "react";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { Bell, X, Loader2, BellOff } from "lucide-react";

const DISMISS_KEY = "mp_push_banner_dismissed";

export function PushPermissionsBanner() {
  const { permission, isSupported, requestPermission } = usePushNotifications();
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem(DISMISS_KEY) === "1";
  });
  const [loading, setLoading] = useState(false);

  if (!isSupported || permission === "granted" || dismissed) return null;

  const dismiss = () => {
    try { window.localStorage.setItem(DISMISS_KEY, "1"); } catch { /* storage bloqueado */ }
    setDismissed(true);
  };

  const activate = async () => {
    setLoading(true);
    try {
      await requestPermission({ silent: false });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/25 bg-primary/5 px-4 py-3 flex items-center gap-3">
      <div className="w-9 h-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
        {permission === "denied" ? <BellOff size={16} /> : <Bell size={16} />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-black text-foreground tracking-tight">
          {permission === "denied" ? "Notificações bloqueadas no navegador" : "Não perca nada das suas aulas"}
        </p>
        <p className="text-[11px] font-medium text-muted-foreground leading-snug">
          {permission === "denied"
            ? "Toque no cadeado ao lado do endereço do site e permita notificações para receber avisos de aula."
            : "Ative as notificações para receber avisos de aula e confirmar presença na hora."}
        </p>
      </div>
      {permission !== "denied" && (
        <button
          onClick={activate}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-black text-[10px] uppercase tracking-[0.15em] shadow-md hover:bg-primary/90 active:scale-95 transition-all shrink-0"
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <Bell size={12} />}
          Ativar
        </button>
      )}
      <button
        onClick={dismiss}
        className="w-7 h-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center shrink-0"
        aria-label="Dispensar"
      >
        <X size={14} />
      </button>
    </div>
  );
}

// PRD_NOTIFICACAO_ALUNO (RF-005b) — Card de configuração de notificações no
// Perfil do aluno: ativa a permissão do navegador e REGISTRA o token (VAPID)
// em fcm_tokens para o aluno receber pushes de aula/avisos.
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { Bell, BellRing, BellOff, CheckCircle2, Loader2, RefreshCw, Info, Send } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function NotificationsSettingsCard() {
  const { permission, isSupported, requestPermission, showNotification } = usePushNotifications();
  const [loading, setLoading] = useState(false);

  const activate = async () => {
    setLoading(true);
    try { await requestPermission({ silent: false }); } finally { setLoading(false); }
  };

  const reRegister = async () => {
    setLoading(true);
    try { await requestPermission({ silent: true }); } finally { setLoading(false); }
  };

  const sendTest = () => {
    const n = showNotification("🔔 Notificações funcionando!", {
      body: "Você receberá avisos de aula e confirmação de presença por aqui.",
      icon: "/favicon.ico",
    });
    if (!n) { /* fallback silencioso: hook já validou permissão */ }
  };

  const iconBox = (cls: string, icon: React.ReactNode) => (
    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", cls)}>{icon}</div>
  );

  return (
    <Card className="border-none shadow-xl bg-card/50 backdrop-blur-sm">
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
            <Bell size={20} />
          </div>
          <div>
            <p className="text-sm font-black text-foreground">Notificações</p>
            <p className="text-[11px] text-muted-foreground font-medium">Avisos de aula e confirmações no seu celular/navegador</p>
          </div>
        </div>

        {/* Não suportado (ou iOS sem PWA instalada) */}
        {!isSupported && (
          <div className="flex items-start gap-3 rounded-xl bg-muted/40 border border-border/60 p-3.5">
            {iconBox("bg-muted text-muted-foreground", <Info size={14} />)}
            <p className="text-[11px] text-muted-foreground font-medium leading-snug">
              Notificações não são suportadas neste navegador.
              {typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent)
                ? " No iPhone/iPad, adicione o MusicPro à Tela de Início (PWA) para habilitar."
                : " Tente pelo navegador do celular."}
            </p>
          </div>
        )}

        {/* Ativas */}
        {isSupported && permission === "granted" && (
          <div className="space-y-3">
            <div className="flex items-start gap-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 p-3.5">
              {iconBox("bg-emerald-500/15 text-emerald-600", <BellRing size={14} />)}
              <div>
                <p className="text-xs font-black text-emerald-600 flex items-center gap-1.5">
                  <CheckCircle2 size={12} /> Ativadas neste dispositivo
                </p>
                <p className="text-[11px] text-muted-foreground font-medium mt-0.5">
                  Você receberá avisos de aula e de confirmação de presença.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={reRegister}
                disabled={loading}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-muted text-muted-foreground text-[10px] font-black uppercase tracking-wider hover:bg-muted/70 active:scale-95 transition-all disabled:opacity-50"
              >
                {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                Reenviar registro
              </button>
              <button
                onClick={sendTest}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary/10 text-primary text-[10px] font-black uppercase tracking-wider hover:bg-primary/20 active:scale-95 transition-all"
              >
                <Send size={12} /> Testar
              </button>
            </div>
          </div>
        )}

        {/* Pendente de permissão */}
        {isSupported && permission === "default" && (
          <div className="space-y-3">
            <p className="text-[11px] text-muted-foreground font-medium">
              Ative para receber avisos de aula, confirmações e novidades — mesmo com o app fechado.
            </p>
            <button
              onClick={activate}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary text-primary-foreground text-[11px] font-black uppercase tracking-wider shadow-md hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-60"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <BellRing size={14} />}
              Ativar notificações
            </button>
          </div>
        )}

        {/* Bloqueadas pelo navegador */}
        {isSupported && permission === "denied" && (
          <div className="flex items-start gap-3 rounded-xl bg-rose-500/10 border border-rose-500/25 p-3.5">
            {iconBox("bg-rose-500/15 text-rose-600", <BellOff size={14} />)}
            <div>
              <p className="text-xs font-black text-rose-600">Bloqueadas nas configurações do navegador</p>
              <p className="text-[11px] text-muted-foreground font-medium mt-0.5">
                Toque no cadeado 🔒 ao lado do endereço do site e permita as notificações para o MusicPro.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

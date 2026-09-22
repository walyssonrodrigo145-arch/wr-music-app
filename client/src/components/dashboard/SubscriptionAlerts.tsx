// ─── Avisos da assinatura MusicPro (admin) ───────────────────────────────────
//   • SubscriptionRenewalModal  → lembrete amigável a partir de 3 dias do
//     vencimento (1x por dia, via localStorage).
//   • SubscriptionOverdueBanner → aviso fixo no dashboard enquanto a mensalidade
//     estiver vencida/pendente, com CTA para pagar. NUNCA bloqueia o acesso.
// Fontes: currentPeriodEnd (assinante) ou trialEndsAt (trial).

import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatBRL } from "@/lib/money";
import { computeDaysLeft, isSubscriptionOverdue, shouldShowRenewalNotice, buildRenewalNoticeCopy, buildOverdueBannerCopy } from "@shared/subscriptionAlerts";
import { claimModalSlot } from "@/lib/modalCoordinator";
import { CalendarClock, ArrowRight, AlertTriangle, CreditCard } from "lucide-react";

const RENEWAL_STORAGE_KEY = "mp_subscription_renewal_notice";

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Destaca a data em negrito dentro da copy (fonte única em @shared/subscriptionAlerts). */
function withStrongDate(body: string, dateLabel: string): React.ReactNode {
  const idx = body.indexOf(dateLabel);
  if (idx < 0) return body;
  return (
    <>
      {body.slice(0, idx)}
      <strong>{dateLabel}</strong>
      {body.slice(idx + dateLabel.length)}
    </>
  );
}

export interface SubscriptionAlertInfo {
  isAdmin: boolean;
  dueDate: Date | null;
  daysLeft: number | null;
  isOverdue: boolean;
  status: string | null;
  planName: string | null;
  planPrice: number;
  isTrialing: boolean;
}

export function useSubscriptionAlertInfo(): SubscriptionAlertInfo {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { data: sub } = trpc.platform.mySubscription.useQuery(undefined, {
    enabled: isAdmin,
    staleTime: 5 * 60_000,
    refetchInterval: 10 * 60_000,
    retry: false,
  });

  const rawDue = sub?.currentPeriodEnd || sub?.trialEndsAt || null;
  const dueDate = useMemo(() => (rawDue ? new Date(rawDue) : null), [rawDue]);
  const status = sub?.subscriptionStatus ?? null;
  const isTrialing = status === "trialing";

  const daysLeft = computeDaysLeft(dueDate);
  const isOverdue = isSubscriptionOverdue(dueDate, status);

  return {
    isAdmin,
    dueDate,
    daysLeft,
    isOverdue,
    status,
    planName: sub?.planName ?? null,
    planPrice: Number(sub?.planPriceMonthly || 0),
    isTrialing,
  };
}

/** Lembrete amigável: aparece 1x/dia quando faltam até 3 dias para vencer. */
export function SubscriptionRenewalModal() {
  const info = useSubscriptionAlertInfo();
  const [, navigate] = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!info.isAdmin) return;

    let alreadyShownToday = false;
    try {
      alreadyShownToday = localStorage.getItem(RENEWAL_STORAGE_KEY) === todayKey();
    } catch { /* storage indisponível */ }

    const shouldShow = shouldShowRenewalNotice({
      dueDate: info.dueDate,
      status: info.status,
      alreadyShownToday,
    });
    if (!shouldShow) return;
    // Evita abrir junto com o anúncio do Indique & Ganhe (prioridade para este aviso)
    if (!claimModalSlot()) return;

    const timer = setTimeout(() => {
      try { localStorage.setItem(RENEWAL_STORAGE_KEY, todayKey()); } catch { /* noop */ }
      setOpen(true);
    }, 3000);
    return () => clearTimeout(timer);
  }, [info.isAdmin, info.dueDate, info.status, info.daysLeft, info.isOverdue]);

  if (!info.isAdmin || !info.dueDate) return null;

  const dueLabel = info.dueDate.toLocaleDateString("pt-BR");
  // Trial NUNCA fala de mensalidade/plano/valor (fonte única em @shared)
  const copy = buildRenewalNoticeCopy({
    status: info.status,
    daysLeft: info.daysLeft ?? 0,
    dueLabel,
    planName: info.planName,
  });
  const isTrial = copy.kind === "trial";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md rounded-3xl border-0 shadow-2xl p-0 overflow-hidden">
        <div className="bg-gradient-to-br from-indigo-600 to-violet-600 p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 opacity-10">
            <CalendarClock size={120} className="translate-x-6 -translate-y-6" />
          </div>
          <DialogHeader>
            <div className="flex items-start gap-3 relative z-10">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center shrink-0 backdrop-blur-sm">
                <CalendarClock size={22} className="text-white" />
              </div>
              <div>
                <p className="text-indigo-200 text-xs font-bold uppercase tracking-wider mb-1">{copy.eyebrow}</p>
                <DialogTitle className="text-white font-black text-lg leading-tight">
                  {copy.title}
                </DialogTitle>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {withStrongDate(copy.body, dueLabel)}
            {copy.showPlanDetails && info.planPrice > 0 ? <> Valor: <strong>{formatBRL(info.planPrice)}</strong>.</> : null}
          </p>
          {!isTrial && (
            <p className="text-xs text-muted-foreground">
              Nada muda no seu acesso agora — é apenas um lembrete para você não perder nenhum dia de uso.
            </p>
          )}
          <div className="flex flex-col gap-2 pt-1">
            <Button
              onClick={() => { setOpen(false); navigate("/assinatura"); }}
              className="w-full h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[11px] uppercase tracking-widest"
            >
              {isTrial ? "Realizar pagamento" : "Ver minha assinatura"} <ArrowRight size={15} className="ml-2" />
            </Button>
            <Button
              onClick={() => setOpen(false)}
              variant="ghost"
              className="w-full h-10 rounded-2xl font-black text-[10px] uppercase tracking-widest text-muted-foreground"
            >
              Ok, obrigado!
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Aviso fixo no dashboard enquanto a mensalidade do MusicPro estiver vencida. */
export function SubscriptionOverdueBanner() {
  const info = useSubscriptionAlertInfo();
  const [, navigate] = useLocation();

  if (!info.isAdmin || !info.isOverdue) return null;

  const dueLabel = info.dueDate ? info.dueDate.toLocaleDateString("pt-BR") : "—";
  // Trial encerrado NUNCA fala de mensalidade/valor (fonte única em @shared)
  const copy = buildOverdueBannerCopy({ status: info.status, dueLabel });
  const isTrial = copy.kind === "trial";

  return (
    <div className="relative flex items-start gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4">
      <div className="w-9 h-9 rounded-xl bg-white/60 dark:bg-white/10 flex items-center justify-center shrink-0">
        <AlertTriangle size={16} className="text-rose-600 dark:text-rose-400" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-black uppercase tracking-wider text-rose-700 dark:text-rose-300">
          {copy.title}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {withStrongDate(copy.body, dueLabel)}
          {copy.showPlanDetails && info.planPrice > 0 ? <> Valor mensal: <strong>{formatBRL(info.planPrice)}</strong>.</> : null}
        </p>
        <button
          onClick={() => navigate("/assinatura")}
          className="mt-2 inline-flex items-center gap-1.5 h-8 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-black uppercase tracking-widest transition-colors"
        >
          <CreditCard size={12} /> {isTrial ? "Realizar pagamento" : "Pagar agora"}
        </button>
      </div>
    </div>
  );
}

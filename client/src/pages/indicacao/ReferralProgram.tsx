// ─── Painel da escola: Programa Indique & Ganhe (/indicacoes) ─────────────────
// A escola vê seu código/link, compartilha e acompanha indicações e créditos.
// Nenhuma regra crítica é decidida aqui — apenas exibição.

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatBRL as formatMoneyBRL } from "@/lib/money";
import {
  Gift, Copy, MessageCircle, Users, Clock, CheckCircle2,
  Loader2, Sparkles, Ticket, TrendingUp, ArrowRight,
} from "lucide-react";

const STATUS_META: Record<string, { label: string; cls: string }> = {
  PENDENTE: { label: "Aguardando cadastro", cls: "bg-slate-500/10 text-slate-500 border-slate-500/20" },
  TESTE: { label: "Em teste", cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" },
  CONVERTIDA: { label: "Convertida", cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" },
  RECOMPENSA_LIBERADA: { label: "Recompensa liberada", cls: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20" },
  RECOMPENSA_UTILIZADA: { label: "Recompensa utilizada", cls: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20" },
  CANCELADA: { label: "Cancelada", cls: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20" },
  EXPIRADA: { label: "Expirada", cls: "bg-slate-500/10 text-slate-500 border-slate-500/20" },
  FRAUDE: { label: "Fraude", cls: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20" },
};

const REWARD_STATUS_META: Record<string, { label: string; cls: string }> = {
  DISPONIVEL: { label: "Disponível", cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" },
  PARCIALMENTE_UTILIZADA: { label: "Parcialmente utilizada", cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" },
  UTILIZADA: { label: "Utilizada", cls: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20" },
  EXPIRADA: { label: "Expirada", cls: "bg-slate-500/10 text-slate-500 border-slate-500/20" },
  CANCELADA: { label: "Cancelada", cls: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20" },
};

function formatBRL(cents: number) {
  return formatMoneyBRL(cents / 100);
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function ReferralProgram() {
  const utils = trpc.useUtils();
  const { data: program, isLoading } = trpc.referral.getMyProgram.useQuery(undefined, { refetchInterval: 60_000 });
  const { data: discount } = trpc.referral.getPendingDiscount.useQuery(undefined, { refetchInterval: 60_000 });
  const [copied, setCopied] = useState(false);

  const applyMutation = trpc.referral.applyCredits.useMutation({
    onSuccess: (res) => {
      if (res.success) {
        toast.success(res.message);
        utils.referral.getMyProgram.invalidate();
        utils.referral.getPendingDiscount.invalidate();
        if (res.invoiceUrl) window.open(res.invoiceUrl, "_blank");
      } else {
        toast.info(res.message);
      }
    },
    onError: (e) => toast.error("Não foi possível aplicar o desconto: " + e.message),
  });

  const copyLink = async () => {
    if (!program?.link) return;
    try {
      await navigator.clipboard.writeText(program.link);
      setCopied(true);
      toast.success("Link copiado!");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Não foi possível copiar. Copie manualmente: " + program.link);
    }
  };

  const shareWhatsApp = () => {
    if (!program?.link) return;
    const message = program.summary.whatsappMessage.replace(/\n/g, "%0A");
    window.open(`https://wa.me/?text=${message}`, "_blank");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  if (!program) {
    return (
      <div className="p-6 text-center text-muted-foreground">Não foi possível carregar o programa de indicação.</div>
    );
  }

  const { summary } = program;
  const cyclePercent = summary.cycleSize > 0 ? Math.round((summary.cycleConverted / summary.cycleSize) * 100) : 0;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <Gift className="text-primary" /> Programa Indique & Ganhe
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Compartilhe seu link. Quando uma nova escola assinar, você ganha desconto na mensalidade.
          </p>
        </div>
        {!program.active && (
          <span className="text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            Programa temporariamente indisponível
          </span>
        )}
      </div>

      {/* Link exclusivo */}
      <div className="rounded-3xl border border-border bg-card p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Ticket size={16} className="text-primary" />
          <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Seu código exclusivo</span>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-2xl font-black tracking-[0.2em] text-foreground">{program.code}</span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground border border-border rounded-lg px-2 py-1">
            Não alterável
          </span>
        </div>
        <div className="rounded-2xl bg-muted/40 border border-border/60 px-4 py-3 text-xs sm:text-sm font-mono text-muted-foreground break-all">
          {program.link}
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={copyLink} className="h-11 rounded-2xl font-black text-[11px] uppercase tracking-widest">
            <Copy size={15} className="mr-2" /> {copied ? "Copiado!" : "Copiar link"}
          </Button>
          <Button
            onClick={shareWhatsApp}
            variant="outline"
            className="h-11 rounded-2xl font-black text-[11px] uppercase tracking-widest border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
          >
            <MessageCircle size={15} className="mr-2" /> Compartilhar no WhatsApp
          </Button>
        </div>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total de indicações", value: summary.total, icon: Users, cls: "text-foreground" },
          { label: "Em teste", value: summary.inTrial, icon: Clock, cls: "text-amber-600 dark:text-amber-400" },
          { label: "Convertidas", value: summary.converted, icon: CheckCircle2, cls: "text-emerald-600 dark:text-emerald-400" },
          { label: "Créditos disponíveis", value: summary.availableRewards, icon: Sparkles, cls: "text-violet-600 dark:text-violet-400" },
        ].map(({ label, value, icon: Icon, cls }) => (
          <div key={label} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Icon size={14} />
              <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
            </div>
            <p className={cn("text-2xl font-black mt-2 tabular-nums", cls)}>{value}</p>
          </div>
        ))}
      </div>

      {/* Progresso do ciclo */}
      <div className="rounded-3xl border border-border bg-card p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-primary" />
            <span className="text-sm font-black">Seu benefício atual</span>
          </div>
          <span className="text-xs font-black uppercase tracking-widest px-3 py-1 rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400">
            Próxima: {summary.nextRewardPercent}% OFF
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all"
              style={{ width: `${cyclePercent}%` }}
            />
          </div>
          <span className="text-xs font-black tabular-nums text-muted-foreground">
            {summary.cycleConverted}/{summary.cycleSize}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          {summary.remainingToNext === summary.cycleSize
            ? `Indique ${summary.cycleSize} escolas que assinarem para ganhar ${summary.nextRewardPercent}% OFF.`
            : `Faltam ${summary.remainingToNext} indicação(ões) convertida(s) para o próximo benefício.`}
        </p>
      </div>

      {/* Desconto na próxima mensalidade */}
      {discount && discount.rewards.length > 0 && (
        <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-5 sm:p-6 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-emerald-600 dark:text-emerald-400" />
            <span className="text-sm font-black text-emerald-700 dark:text-emerald-300">Desconto na próxima mensalidade</span>
          </div>
          {discount.hasInvoice ? (
            <>
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="text-lg font-bold text-muted-foreground line-through">{formatBRL(discount.invoiceValueCents)}</span>
                <ArrowRight size={14} className="text-muted-foreground" />
                <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400">{formatBRL(discount.finalValueCents)}</span>
                <span className="text-xs font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                  -{formatBRL(discount.discountCents)}
                </span>
              </div>
              <Button
                onClick={() => applyMutation.mutate()}
                disabled={applyMutation.isPending}
                className="h-11 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] uppercase tracking-widest"
              >
                {applyMutation.isPending ? <Loader2 size={15} className="mr-2 animate-spin" /> : <CheckCircle2 size={15} className="mr-2" />}
                Aplicar desconto agora
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Você tem {discount.rewards.length} crédito(s) de indicação. O desconto será aplicado automaticamente
              na sua próxima fatura.
            </p>
          )}
        </div>
      )}

      {/* Lista de indicações */}
      <div className="rounded-3xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border/60">
          <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Suas indicações</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {["Escola", "Data", "Status", "Recompensa"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {program.referrals.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <Gift size={28} className="opacity-20" />
                      <p>Nenhuma indicação ainda. Compartilhe seu link para começar!</p>
                    </div>
                  </td>
                </tr>
              ) : (
                program.referrals.map((r) => {
                  const meta = STATUS_META[r.status] ?? STATUS_META.PENDENTE;
                  return (
                    <tr key={r.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-medium">{r.schoolName ?? "Escola indicada"}</td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{fmtDate(r.createdAt)}</td>
                      <td className="px-4 py-3">
                        <span className={cn("inline-flex items-center text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border", meta.cls)}>
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-bold tabular-nums">
                        {r.rewardPercent > 0 ? `${r.rewardPercent}% OFF` : "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recompensas */}
      <div className="rounded-3xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border/60">
          <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Seus créditos</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {["Origem", "Benefício", "Liberado em", "Validade", "Status"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {program.rewards.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <Sparkles size={28} className="opacity-20" />
                      <p>Nenhum crédito ainda. Os créditos aparecem quando uma indicação é convertida.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                program.rewards.map((r) => {
                  const meta = REWARD_STATUS_META[r.status] ?? REWARD_STATUS_META.DISPONIVEL;
                  return (
                    <tr key={r.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">{r.referralSchoolName ?? "Indicação"}</td>
                      <td className="px-4 py-3 font-black">{r.percent}% OFF</td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{fmtDate(r.releasedAt)}</td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{r.expiresAt ? fmtDate(r.expiresAt) : "Sem validade"}</td>
                      <td className="px-4 py-3">
                        <span className={cn("inline-flex items-center text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border", meta.cls)}>
                          {meta.label}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

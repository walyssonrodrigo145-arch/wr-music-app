// PRD_NOTIFICACAO_ALUNO — Card de confirmação de presença (Portal do Aluno).
// Aparece quando há aula agendada aguardando a resposta do aluno (ou quando a
// notificação/lembrete abre a página com ?confirmar={lessonId}).
import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { CheckCircle2, XCircle, CalendarDays, Clock, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function AttendanceConfirmCard() {
  const confirmParam = useMemo(() => {
    if (typeof window === "undefined") return null;
    const value = new URLSearchParams(window.location.search).get("confirmar");
    return value ? Number(value) : null;
  }, []);

  const { data: pendingLesson, isLoading } = trpc.studentPortal.myPendingConfirmation.useQuery();
  const { data: lessons } = trpc.studentPortal.getLessons.useQuery();

  // Aula alvo: deep-link (?confirmar=) tem prioridade; fallback = próxima pendente
  const target = useMemo(() => {
    if (confirmParam) {
      const linked = lessons?.find(
        (l) => l.id === confirmParam && l.status === "agendada" && l.studentConfirmation === "pendente"
      );
      if (linked) return linked;
      return null;
    }
    return pendingLesson ?? null;
  }, [confirmParam, pendingLesson, lessons]);

  const confirm = trpc.studentPortal.confirmAttendance.useMutation({
    onSuccess: (_data, variables) => {
      if (variables.status === "confirmado") {
        toast.success("Presença confirmada! Até a aula 🎵");
      } else {
        toast.info("Seu professor foi avisado de que você não irá.");
      }
      if (confirmParam) {
        window.history.replaceState({}, "", window.location.pathname);
      }
    },
    onError: (err) => toast.error(err.message || "Não foi possível registrar sua resposta."),
  });

  const [busy, setBusy] = useState<"confirmado" | "nao_vai" | null>(null);

  if (isLoading) {
    return (
      <div className="h-[104px] rounded-[2rem] bg-card border border-border/40 animate-pulse" />
    );
  }
  if (!target) return null;

  const respond = (status: "confirmado" | "nao_vai") => {
    setBusy(status);
    confirm.mutate({ lessonId: target.id, status }, { onSettled: () => setBusy(null) });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-[2rem] border border-primary/25 bg-card shadow-[0_12px_40px_-12px_rgba(124,58,237,0.25)]"
    >
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-purple-500" />
      <div className="absolute top-0 right-0 w-[220px] h-full bg-primary/5 blur-[60px] pointer-events-none" />
      <div className="p-6 sm:p-7 flex flex-col md:flex-row md:items-center gap-5 relative z-10">
        <div className="flex items-center gap-4 flex-1">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
            <CalendarDays size={22} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
              Confirme sua presença
            </p>
            <h3 className="text-lg font-black text-foreground tracking-tight truncate">{target.title}</h3>
            <div className="flex items-center gap-3 mt-1 text-xs font-bold text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Clock size={12} />
                {format(new Date(target.scheduledAt), "EEEE, dd 'de' MMM 'às' HH:mm", { locale: ptBR })}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => respond("confirmado")}
            disabled={confirm.isPending}
            className={cn(
              "flex items-center gap-2 px-5 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-[0.15em] transition-all shadow-lg",
              busy === "confirmado"
                ? "bg-emerald-600 text-white opacity-70"
                : "bg-emerald-500 text-white hover:bg-emerald-600 hover:scale-[1.03] active:scale-95"
            )}
          >
            {busy === "confirmado" ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            Estarei presente
          </button>
          <button
            onClick={() => respond("nao_vai")}
            disabled={confirm.isPending}
            className="flex items-center gap-2 px-5 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-[0.15em] bg-muted text-muted-foreground border border-border hover:bg-rose-500/10 hover:text-rose-600 hover:border-rose-500/30 transition-all active:scale-95"
          >
            {busy === "nao_vai" ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
            Não poderei ir
          </button>
        </div>
      </div>
    </motion.div>
  );
}

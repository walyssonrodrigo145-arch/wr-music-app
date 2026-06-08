import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Loader2, CheckCircle2, MessageCircle, Copy, Trash2, Zap, AlertTriangle, Clock, User, BellOff } from "lucide-react";
import { Reminder, TYPE_CONFIG, STATUS_CONFIG, formatScheduled, openWhatsApp } from "./types";

interface Props {
  reminder: Reminder;
  onDelete: () => void;
}

export function ReminderCard({ reminder, onDelete }: Props) {
  const utils = trpc.useUtils();
  const typeConf = TYPE_CONFIG[reminder.type];
  const statusConf = STATUS_CONFIG[reminder.status];
  const TypeIcon = typeConf.icon;
  const StatusIcon = statusConf.icon;
  const scheduled = new Date(reminder.scheduledAt);
  const isPast = scheduled < new Date();
  
  const isDelayed = isPast && reminder.status === "pendente";

  // ─── Atualização otimista do cache de lembretes ───────────────────────────
  const applyOptimisticStatus = (id: number, status: Reminder["status"], extra?: Partial<Reminder>) => {
    utils.reminders.list.setData(undefined, (old) =>
      old?.map((r: any) => r.id === id ? { ...r, status, sentAt: status === "enviado" ? new Date() : r.sentAt, cancelledAt: status === "cancelado" ? new Date() : r.cancelledAt, ...extra } : r) ?? []
    );
    utils.reminders.pendingCount.setData(undefined, (old) => {
      if (old == null) return old;
      return status !== "pendente" ? Math.max(0, old - 1) : old;
    });
  };

  const revertOptimistic = (previous: any) => {
    utils.reminders.list.setData(undefined, previous);
    utils.reminders.pendingCount.invalidate();
  };

  // ─── Marcar como enviado (Concluir) ──────────────────────────────────────
  const markSent = trpc.reminders.markSent.useMutation({
    onMutate: async ({ id }) => {
      await utils.reminders.list.cancel();
      const previous = utils.reminders.list.getData();
      applyOptimisticStatus(id, "enviado");
      toast.success("Marcado como enviado!");
      return { previous };
    },
    onError: (e, _, context) => {
      // Erros de rede/parsing (e.data é null): o servidor provavelmente processou
      // com sucesso, mas a resposta chegou malformada (problema comum no Render free tier).
      // Nesse caso, NÃO revertemos o estado otímista nem mostramos erro —
      // o onSettled vai buscar o estado real via invalidate().
      const isParsingOrNetworkError = !e.data;
      if (isParsingOrNetworkError) {
        console.warn("[markSent] Erro de parsing/rede ignorado (servidor processou):", e.message);
        return;
      }
      // Erro real de servidor (4xx: auth, validação etc) — reverte e mostra mensagem
      if (context?.previous) revertOptimistic(context.previous);
      toast.error("Erro ao marcar como enviado: " + e.message);
    },
    onSettled: () => {
      utils.reminders.list.invalidate();
      utils.reminders.pendingCount.invalidate();
    },
  });

  // ─── Cancelar lembrete ────────────────────────────────────────────────────
  const cancel = trpc.reminders.cancel.useMutation({
    onMutate: async ({ id }) => {
      await utils.reminders.list.cancel();
      const previous = utils.reminders.list.getData();
      applyOptimisticStatus(id, "cancelado");
      toast.success("Lembrete cancelado");
      return { previous };
    },
    onError: (e, _, context) => {
      // Mesma lógica do markSent: erros de parsing/rede não revertem o estado
      const isParsingOrNetworkError = !e.data;
      if (isParsingOrNetworkError) {
        console.warn("[cancel] Erro de parsing/rede ignorado:", e.message);
        return;
      }
      if (context?.previous) revertOptimistic(context.previous);
      toast.error("Erro ao cancelar: " + e.message);
    },
    onSettled: () => {
      utils.reminders.list.invalidate();
      utils.reminders.pendingCount.invalidate();
    },
  });

  // ─── Enviar via Robô ─────────────────────────────────────────────────────
  const sendViaBot = trpc.reminders.sendViaBot.useMutation({
    onMutate: async ({ id }) => {
      await utils.reminders.list.cancel();
      const previous = utils.reminders.list.getData();
      // Mostra o card como "enviado" optimisticamente
      applyOptimisticStatus(id, "enviado", { errorMessage: null });
      return { previous };
    },
    onSuccess: () => {
      toast.success("Enviado via Robô com sucesso!");
      utils.reminders.list.invalidate();
      utils.reminders.pendingCount.invalidate();
    },
    onError: (e, variables, context) => {
      // Reverte o status para pendente com a mensagem de erro
      utils.reminders.list.setData(undefined, (old) =>
        old?.map((r: any) => r.id === variables.id
          ? { ...r, status: "pendente", errorMessage: e.message.includes("transform") ? "Falha de conexão com o servidor. Tente novamente." : e.message }
          : r
        ) ?? []
      );
      utils.reminders.pendingCount.setData(undefined, (old) => (old != null ? old + 1 : old));
      const msg = e.message.includes("transform") || e.message.includes("parse")
        ? "Falha de conexão com o servidor do robô. Tente novamente em alguns segundos."
        : "Erro ao enviar via robô: " + e.message;
      toast.error(msg);
    },
    onSettled: () => {
      utils.reminders.list.invalidate();
      utils.reminders.pendingCount.invalidate();
    },
  });

  const copyMsg = () => { navigator.clipboard.writeText(reminder.message); toast.success("Mensagem copiada!"); };

  const finalColorBorder = isDelayed 
    ? "border-red-300 dark:border-red-900 shadow-sm shadow-red-500/10" 
    : reminder.status === "enviado" 
      ? "border-emerald-200 dark:border-emerald-900/50" 
      : reminder.status === "cancelado" ? "border-border opacity-60" 
      : "border-border hover:border-primary/30 hover:shadow-md";

  return (
    <div className={cn(
      "group relative flex flex-col bg-card rounded-2xl border transition-all duration-300 overflow-hidden",
      finalColorBorder
    )}>
      {isDelayed && (
        <div className="absolute top-0 right-0 w-24 h-24 overflow-hidden rounded-tr-2xl z-0 pointer-events-none">
          <div className="absolute top-4 -right-8 w-32 h-6 bg-red-500 text-[10px] uppercase font-black text-white text-center flex items-center justify-center rotate-45 shadow-sm">
            Atrasado
          </div>
        </div>
      )}

      {/* Header section */}
      <div className={cn("flex flex-wrap items-center justify-between p-3 border-b border-border/50 bg-muted/20 gap-2")}>
        <div className="flex items-center gap-2 z-10">
          <div className={cn("p-1.5 rounded-lg", typeConf.bg)}>
            <TypeIcon size={14} className={typeConf.color} />
          </div>
          <span className={cn("text-[11px] font-bold uppercase tracking-wider", typeConf.color)}>
            {typeConf.label}
          </span>
          <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border", statusConf.bg, statusConf.color, "border-transparent")}>
            <StatusIcon size={10} /> {statusConf.label}
          </span>
          {reminder.autoGenerated === 1 && (
            <span className="text-[10px] text-primary bg-primary/10 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
              <Zap size={10} /> Auto
            </span>
          )}
        </div>
        <div className={cn("text-[11px] font-medium flex items-center gap-1 z-10", isDelayed ? "text-red-500 font-bold" : "text-muted-foreground")}>
          {isDelayed ? <AlertTriangle size={12} /> : <Clock size={12} />}
          {formatScheduled(scheduled)}
        </div>
      </div>

      {/* Body section */}
      <div className="p-4 flex-1">
        {reminder.studentName ? (
           <div className="flex items-center gap-1.5 mb-2">
             <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
               <User size={10} className="text-primary" />
             </div>
             <p className="text-xs font-bold text-foreground">{reminder.studentName}</p>
           </div>
        ) : (
           <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
             <User size={12} /> Aluno não vinculado
           </p>
        )}
        <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed mt-1 bg-muted/30 p-2.5 rounded-xl border border-transparent group-hover:border-border transition-colors">
          {reminder.message}
        </p>
        {reminder.errorMessage && (
          <div className="mt-2 p-2.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 flex items-start gap-2">
            <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" />
            <div className="text-[11px] text-red-600 dark:text-red-400">
              <span className="font-bold uppercase tracking-wider block mb-0.5">Falha no Robô:</span>
              <span className="line-clamp-2">{reminder.errorMessage}</span>
            </div>
          </div>
        )}
      </div>

      {/* Actions section */}
      <div className="p-3 pt-0 flex items-center gap-2 flex-wrap">
        {reminder.status === "pendente" && (
          <>
            <button
              onClick={() => {
                openWhatsApp(reminder.studentPhone, reminder.message, toast.error);
                markSent.mutate({ id: reminder.id });
              }}
              disabled={markSent.isPending || cancel.isPending}
              className="flex-1 min-w-[120px] flex items-center justify-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-400 hover:to-emerald-500 shadow-sm shadow-emerald-500/20 transition-all hover:scale-[1.02] disabled:opacity-50 disabled:scale-100">
              <MessageCircle size={14} /> Enviar WhatsApp
            </button>
            <button
              onClick={() => sendViaBot.mutate({ id: reminder.id })}
              disabled={sendViaBot.isPending || markSent.isPending || cancel.isPending}
              className="flex-1 min-w-[120px] flex items-center justify-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-500/20 transition-all hover:scale-[1.02] disabled:opacity-50 disabled:scale-100">
              {sendViaBot.isPending ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />} Enviar via Robô
            </button>
            <button
              onClick={() => markSent.mutate({ id: reminder.id })}
              disabled={markSent.isPending || cancel.isPending || sendViaBot.isPending}
              className="px-3 py-2 flex items-center gap-1.5 text-xs font-bold bg-primary/10 text-primary hover:bg-primary/20 rounded-xl transition-colors disabled:opacity-50">
              <CheckCircle2 size={13} /> Concluir
            </button>
            <button
              onClick={() => cancel.mutate({ id: reminder.id })}
              disabled={cancel.isPending || markSent.isPending || sendViaBot.isPending}
              className="px-3 py-2 flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-950/50 rounded-xl transition-colors disabled:opacity-50">
              <BellOff size={13} /> Cancelar
            </button>
          </>
        )}
        {(reminder.status === "enviado" || reminder.status === "cancelado") && (
          <button onClick={copyMsg}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl bg-muted/50 text-foreground hover:bg-muted transition-colors">
            <Copy size={13} /> Copiar texto
          </button>
        )}
        <button onClick={onDelete}
          className="w-10 h-9 flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-xl transition-colors ml-auto">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

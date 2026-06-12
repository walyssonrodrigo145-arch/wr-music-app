import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import {
  BellRing, Plus, Loader2,
  BookOpen, CreditCard, AlertTriangle, ListTodo, Zap, FileText, Bell, RefreshCw, ToggleLeft, ToggleRight,
} from "lucide-react";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

import { Reminder, ReminderType, ReminderStatus, Template, openWhatsApp } from "../components/lembretes/types";
import { ReminderCard } from "../components/lembretes/ReminderCard";
import { RemindersSummary } from "../components/lembretes/RemindersSummary";
import { RemindersFilter } from "../components/lembretes/RemindersFilter";
import { ManualReminderModal, TemplatesModal, DeleteConfirmModal } from "../components/lembretes/ReminderModals";

export default function Lembretes() {
  const utils = trpc.useUtils();
  const [autoEnabled, setAutoEnabled] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [filterType, setFilterType] = useState<ReminderType | "todos">("todos");
  const [filterStatus, setFilterStatus] = useState<ReminderStatus | "todos">("todos");
  const [filterStudent, setFilterStudent] = useState("");
  const [pendingActionMap, setPendingActionMap] = useState<Record<number, "markSent" | "cancel" | "sendBot">>({});

  const { data: allReminders = [], isLoading } = trpc.reminders.list.useQuery(
    undefined,
    {
      refetchInterval: 60_000, // 60s (era 30s)
      refetchIntervalInBackground: false, // Não atualiza quando a aba não está em foco
      staleTime: 30_000, // Considera os dados frescos por 30s
    }
  );
  const { data: students = [] } = trpc.students.list.useQuery(undefined, { staleTime: 300_000 });
  const { data: templates = [] } = trpc.reminderTemplates.list.useQuery(undefined, { staleTime: 300_000 });
  const { data: automationData } = trpc.settings.getAutomation.useQuery(
    undefined,
    { refetchInterval: 60_000, staleTime: 30_000 }
  );

  const { permission, isSupported, requestPermission, showNotification } = usePushNotifications();
  const seenPendingIds = useRef<Set<number>>(new Set());

  useEffect(() => {
    const currentPendings = (allReminders as Reminder[]).filter(r => r.status === "pendente");
    const newItems = currentPendings.filter(r => !seenPendingIds.current.has(r.id));
    currentPendings.forEach(r => seenPendingIds.current.add(r.id));

    if (newItems.length > 0 && autoEnabled) {
      newItems.slice(0, 3).forEach(item => {
        let title = "🔔 Novo Lembrete";
        if (item.type === "aula") title = "⏰ Lembrete de Aula";
        else if (item.type === "cobranca" || item.type === "inadimplencia") title = "💰 Cobrança Pendente";
        showNotification(title, {
          body: item.message,
          tag: `reminder-${item.id}`,
          onClick: () => openWhatsApp(item.studentPhone, item.message, (err) => toast.error(err))
        });
      });
      if (newItems.length > 3) toast.info(`${newItems.length} novos lembretes gerados no total.`);
    }
  }, [allReminders, autoEnabled, showNotification]);

  // ─── Mutations centralizadas (uma instância, não uma por card) ───────────
  const invalidate = useCallback(() => {
    utils.reminders.list.invalidate();
    utils.reminders.pendingCount.invalidate();
  }, [utils]);

  const applyOptimistic = useCallback((id: number, status: Reminder["status"], extra?: Partial<Reminder>) => {
    utils.reminders.list.setData(undefined, (old) =>
      old?.map((r: any) => r.id === id ? { ...r, status, sentAt: status === "enviado" ? new Date() : r.sentAt, cancelledAt: status === "cancelado" ? new Date() : r.cancelledAt, ...extra } : r) ?? []
    );
    utils.reminders.pendingCount.setData(undefined, (old) =>
      old != null && status !== "pendente" ? Math.max(0, old - 1) : old
    );
  }, [utils]);

  const markSentMut = trpc.reminders.markSent.useMutation({
    onMutate: async ({ id }) => {
      await utils.reminders.list.cancel();
      const prev = utils.reminders.list.getData();
      applyOptimistic(id, "enviado");
      toast.success("Marcado como enviado!");
      setPendingActionMap(m => ({ ...m, [id]: "markSent" }));
      return { prev };
    },
    onError: (e, _, ctx) => {
      if (!e.data && ctx?.prev) utils.reminders.list.setData(undefined, ctx.prev);
      else toast.error("Erro: " + e.message);
    },
    onSettled: (_, __, vars) => {
      setPendingActionMap(m => { const n = { ...m }; delete n[vars.id]; return n; });
      invalidate();
    },
  });

  const cancelMut = trpc.reminders.cancel.useMutation({
    onMutate: async ({ id }) => {
      await utils.reminders.list.cancel();
      const prev = utils.reminders.list.getData();
      applyOptimistic(id, "cancelado");
      toast.success("Lembrete cancelado");
      setPendingActionMap(m => ({ ...m, [id]: "cancel" }));
      return { prev };
    },
    onError: (e, _, ctx) => {
      if (!e.data && ctx?.prev) utils.reminders.list.setData(undefined, ctx.prev);
      else toast.error("Erro: " + e.message);
    },
    onSettled: (_, __, vars) => {
      setPendingActionMap(m => { const n = { ...m }; delete n[vars.id]; return n; });
      invalidate();
    },
  });

  const sendBotMut = trpc.reminders.sendViaBot.useMutation({
    onMutate: async ({ id }) => {
      await utils.reminders.list.cancel();
      const prev = utils.reminders.list.getData();
      applyOptimistic(id, "enviado", { errorMessage: null });
      setPendingActionMap(m => ({ ...m, [id]: "sendBot" }));
      return { prev };
    },
    onSuccess: () => { toast.success("Enviado via Robô com sucesso!"); invalidate(); },
    onError: (e, vars, ctx) => {
      if (ctx?.prev) utils.reminders.list.setData(undefined, ctx.prev);
      utils.reminders.pendingCount.setData(undefined, (old) => (old != null ? old + 1 : old));
      const msg = e.message.includes("transform") || e.message.includes("parse")
        ? "Falha de conexão com o servidor do robô. Tente novamente."
        : "Erro ao enviar via robô: " + e.message;
      toast.error(msg);
    },
    onSettled: (_, __, vars) => {
      setPendingActionMap(m => { const n = { ...m }; delete n[vars.id]; return n; });
      invalidate();
    },
  });

  const generateLessons = trpc.reminders.generateLessonReminders.useMutation({
    onSuccess: (r) => {
      toast.success(`${r.created} lembrete(s) de aula gerado(s)! ${r.skipped} ignorado(s).`);
      invalidate();
      if (r.created > 0) showNotification("🔔 Novos Lembretes de Aula", { body: `O sistema gerou ${r.created} novos lembretes de aula.`, tag: "reminders-aula" });
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const generatePayments = trpc.reminders.generatePaymentReminders.useMutation({
    onSuccess: (r) => {
      toast.success(`${r.created} lembrete(s) de cobrança gerado(s)! ${r.skipped} ignorado(s).`);
      invalidate();
      if (r.created > 0) showNotification("🔔 Novos Lembretes de Cobrança", { body: `O sistema gerou ${r.created} novos lembretes de cobrança.`, tag: "reminders-cobranca" });
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const deleteMut = trpc.reminders.delete.useMutation({
    onSuccess: () => { toast.success("Excluído!"); invalidate(); setDeleteId(null); },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const toggleAutomation = trpc.settings.toggleAutomation.useMutation({
    onSuccess: (r) => {
      setAutoEnabled(r.enabled);
      utils.settings.getAutomation.invalidate();
      toast.success(r.enabled ? "Automação ativada!" : "Automação desativada.");
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const testPush = trpc.fcm.testNotification.useMutation({
    onSuccess: (r) => toast.success(`Notificação enviada para ${r.sentCount} dispositivo(s)!`),
    onError: (e) => toast.error("Erro: " + e.message),
  });

  useEffect(() => {
    if (automationData !== undefined) setAutoEnabled(automationData.enabled);
  }, [automationData]);

  const handleGenerateAll = async () => {
    try {
      await generateLessons.mutateAsync();
      await generatePayments.mutateAsync();
    } catch {}
  };

  const filtered = useMemo(() => {
    const raw = allReminders as Reminder[];
    return raw.filter(r => {
      if (filterType !== "todos" && r.type !== filterType) return false;
      if (filterStatus !== "todos" && r.status !== filterStatus) return false;
      if (filterStudent && !r.studentName?.toLowerCase().includes(filterStudent.toLowerCase())) return false;
      return true;
    });
  }, [allReminders, filterType, filterStatus, filterStudent]);

  const groups = useMemo(() => {
    const now = new Date();
    const atrasados: Reminder[] = [];
    const aulas: Reminder[] = [];
    const pagamentos: Reminder[] = [];
    const outros: Reminder[] = [];
    filtered.forEach(r => {
      const isPast = new Date(r.scheduledAt) < now;
      if (isPast && r.status === "pendente") { atrasados.push(r); return; }
      if (r.type === "aula") aulas.push(r);
      else if (r.type === "cobranca" || r.type === "inadimplencia") pagamentos.push(r);
      else outros.push(r);
    });
    return { atrasados, aulas, pagamentos, outros };
  }, [filtered]);

  const rawPendingCount = (allReminders as Reminder[]).filter(r => r.status === "pendente").length;
  const rawDelayedCount = (allReminders as Reminder[]).filter(r => new Date(r.scheduledAt) < new Date() && r.status === "pendente").length;
  const isGenerating = generateLessons.isPending || generatePayments.isPending;
  const studentList = (students as { id: number; name: string; phone?: string | null }[]);

  const renderSection = (title: string, icon: React.ElementType, items: Reminder[], colorClass: string) => {
    if (items.length === 0) return null;
    const Icon = icon;
    return (
      <div className="mb-10 will-change-transform">
        <div className="flex items-center gap-2 mb-4 px-1">
          <div className={cn("p-1.5 rounded-lg text-white", colorClass)}>
            <Icon size={16} />
          </div>
          <h3 className="text-lg font-black text-foreground uppercase tracking-wider">{title}</h3>
          <span className="ml-2 text-xs font-bold bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{items.length}</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map(r => (
            <ReminderCard
              key={r.id}
              reminder={r}
              onDelete={() => setDeleteId(r.id)}
              onMarkSent={(id) => markSentMut.mutate({ id })}
              onCancel={(id) => cancelMut.mutate({ id })}
              onSendBot={(id) => sendBotMut.mutate({ id })}
              pendingAction={pendingActionMap[r.id] ?? null}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] lg:h-[calc(100vh-4rem)] overflow-hidden -m-4 sm:-m-6 bg-background">
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 lg:space-y-8 scrollbar-thin no-scrollbar">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-3 lg:gap-4">
            <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-2xl bg-violet-500/10 flex items-center justify-center shadow-sm shrink-0">
              <Bell size={24} className="text-violet-600" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl lg:text-2xl font-bold text-foreground tracking-tight leading-none">Lembretes</h2>
              <p className="text-[10px] lg:text-xs text-muted-foreground font-bold uppercase tracking-widest mt-1 lg:mt-2">Gestão de avisos e notificações</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2 sm:pb-0">
            <Button variant="outline" className="h-11 rounded-xl px-4 text-[10px] font-black uppercase tracking-widest gap-2 bg-card border-border shrink-0" onClick={() => setTemplatesOpen(true)}>
              <FileText size={16} /> <span className="hidden xs:inline">Modelos</span>
            </Button>
            <Button variant="outline" className="h-11 rounded-xl px-4 text-[10px] font-black uppercase tracking-widest gap-2 bg-card border-border shrink-0" onClick={() => setModalOpen(true)}>
              <Plus size={16} /> <span className="hidden xs:inline">Manual</span>
            </Button>
            <Button className="h-11 rounded-xl px-5 text-[10px] font-black uppercase tracking-widest gap-2 bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 shrink-0" onClick={handleGenerateAll} disabled={isGenerating}>
              {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              Gerar
            </Button>
          </div>
        </div>

        <div className="shrink-0">
          <RemindersSummary total={allReminders.length} pending={rawPendingCount} delayed={rawDelayedCount} />
        </div>

        <div className={cn(
          "relative overflow-hidden p-6 rounded-[2rem] border transition-all duration-300",
          autoEnabled 
            ? "bg-gradient-to-br from-indigo-600 to-indigo-800 border-indigo-700 shadow-xl shadow-indigo-500/20 text-white" 
            : "bg-card border-border shadow-sm text-muted-foreground"
        )}>
          {autoEnabled && (
            <>
              <div className="absolute -right-10 -top-10 w-32 h-32 rounded-full bg-card/10 blur-2xl" />
              <div className="absolute -left-10 -bottom-10 w-24 h-24 rounded-full bg-indigo-400/20 blur-xl" />
            </>
          )}
          <div className="flex flex-col sm:flex-row items-center gap-6 relative z-10">
            <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-lg", autoEnabled ? "bg-card/20 text-white" : "bg-muted text-muted-foreground")}>
              <Zap size={28} />
            </div>
            <div className="flex-1 text-center sm:text-left min-w-0">
              <div className="flex items-center justify-center sm:justify-start gap-3 mb-2">
                <h3 className={cn("text-base font-black uppercase tracking-widest", autoEnabled ? "text-white" : "text-foreground")}>Automação do Robô</h3>
                <span className={cn("text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full", autoEnabled ? "bg-card/20 text-white" : "bg-muted text-muted-foreground")}>
                  {autoEnabled ? "Ativo" : "Inativo"}
                </span>
              </div>
              <p className={cn("text-xs font-medium leading-relaxed", autoEnabled ? "text-white/80" : "text-muted-foreground")}>
                {autoEnabled ? "Varredura automática de aulas e cobranças em execução." : "A automação está desligada. Apenas lembretes manuais serão processados."}
              </p>
            </div>
            <button onClick={() => toggleAutomation.mutate({ enabled: !autoEnabled })} disabled={toggleAutomation.isPending} className="transition-transform hover:scale-110 active:scale-90 disabled:opacity-50">
              {toggleAutomation.isPending
                ? <Loader2 size={48} className="animate-spin opacity-50" />
                : autoEnabled
                  ? <ToggleRight size={64} className="text-white drop-shadow-lg" />
                  : <ToggleLeft size={64} className="text-muted-foreground/30" />
              }
            </button>
          </div>
        </div>

        {isSupported && permission === "default" && (
          <div className="flex flex-col sm:flex-row items-center gap-4 p-5 rounded-2xl bg-amber-500/10 border border-amber-100 shadow-sm shrink-0">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-600 flex items-center justify-center shrink-0"><BellRing size={20} /></div>
            <p className="text-[11px] lg:text-xs text-amber-800 font-bold uppercase tracking-widest flex-1 leading-snug text-center sm:text-left">Ative os alertas para ser avisado sobre novos lembretes.</p>
            <Button size="sm" className="w-full sm:w-auto h-9 rounded-xl bg-amber-600 text-white font-black uppercase tracking-widest text-[9px] px-4 shadow-lg shadow-amber-500/20" onClick={async () => {
              const result = await requestPermission();
              if (result === 'granted') toast.success('Notificações ativadas!');
            }}>Ativar</Button>
          </div>
        )}

        {isSupported && permission === "granted" && (
          <div className="flex flex-col sm:flex-row items-center gap-4 p-5 rounded-2xl bg-emerald-500/10 border border-emerald-100 shadow-sm shrink-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-600 flex items-center justify-center shrink-0"><BellRing size={20} /></div>
            <p className="text-[11px] lg:text-xs text-emerald-800 font-bold uppercase tracking-widest flex-1 leading-snug text-center sm:text-left">Notificações Ativadas! Você pode fechar a aba que continuará sendo avisado.</p>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button size="sm" variant="outline" className="flex-1 sm:flex-none h-9 rounded-xl border-emerald-500/30 text-emerald-700 font-black uppercase tracking-widest text-[9px] px-4 hover:bg-emerald-500/20" onClick={() => requestPermission()}>Sincronizar</Button>
              <Button size="sm" variant="outline" className="flex-1 sm:flex-none h-9 rounded-xl border-emerald-500/30 text-emerald-700 font-black uppercase tracking-widest text-[9px] px-4 hover:bg-emerald-500/20" onClick={() => testPush.mutate()} disabled={testPush.isPending}>
                {testPush.isPending ? <Loader2 size={14} className="animate-spin mr-2" /> : null}Disparar Teste
              </Button>
            </div>
          </div>
        )}

        <div className="shrink-0">
          <RemindersFilter {...{filterStudent, setFilterStudent, filterType, setFilterType, filterStatus, setFilterStatus}} />
        </div>

        <div className="flex-1 space-y-8">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 size={32} className="animate-spin text-indigo-200" />
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Sincronizando...</p>
            </div>
          ) : allReminders.length === 0 ? (
            <div className="bg-card rounded-[2rem] border border-dashed border-border p-20 flex flex-col items-center text-center shadow-sm">
              <div className="w-20 h-20 bg-muted rounded-[2rem] flex items-center justify-center mb-6 shadow-inner">
                <Bell size={36} className="text-muted-foreground/30" />
              </div>
              <h3 className="text-lg font-black text-foreground uppercase tracking-widest">Sem lembretes</h3>
              <p className="text-sm text-muted-foreground font-medium mt-2 mb-8 max-w-xs">Sua caixa está limpa.</p>
            </div>
          ) : (
            <div className="space-y-10 pb-10">
              {renderSection("Atrasados", AlertTriangle, groups.atrasados, "bg-rose-500 shadow-rose-500/20")}
              {renderSection("Aulas", BookOpen, groups.aulas, "bg-indigo-500 shadow-indigo-500/20")}
              {renderSection("Pagamentos", CreditCard, groups.pagamentos, "bg-emerald-500 shadow-emerald-500/20")}
              {renderSection("Manuais", ListTodo, groups.outros, "bg-slate-700 shadow-slate-500/20")}
            </div>
          )}
        </div>
      </div>

      {modalOpen && (
        <ManualReminderModal open={modalOpen} onClose={() => setModalOpen(false)} students={studentList} templates={templates as Template[]} />
      )}
      {templatesOpen && <TemplatesModal open={templatesOpen} onClose={() => setTemplatesOpen(false)} />}
      {deleteId !== null && (
        <DeleteConfirmModal
          onConfirm={() => deleteMut.mutate({ id: deleteId })}
          onCancel={() => setDeleteId(null)}
          isPending={deleteMut.isPending}
        />
      )}
    </div>
  );
}

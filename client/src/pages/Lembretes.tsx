import { useState, useMemo, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import {
  BellRing, Plus, Loader2, CheckCircle2,
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

  const { data: allReminders = [], isLoading } = trpc.reminders.list.useQuery(
    undefined,
    { refetchInterval: autoEnabled ? 60_000 : false }
  );
  const { data: students = [] } = trpc.students.list.useQuery();
  const { data: templates = [] } = trpc.reminderTemplates.list.useQuery();
  const { data: automationData } = trpc.settings.getAutomation.useQuery(
    undefined,
    { refetchInterval: 60_000 }
  );

  const { permission, isSupported, requestPermission, showNotification } = usePushNotifications();
  const prevRemindersRef = useRef<Reminder[]>([]);

  useEffect(() => {
    const currentPendings = (allReminders as Reminder[]).filter(r => r.status === "pendente");
    
    // Se for a primeira carga, apenas inicializa a referência
    if (prevRemindersRef.current.length === 0) {
      prevRemindersRef.current = currentPendings;
      return;
    }

    // Identifica novos lembretes que não estavam na lista anterior
    const newItems = currentPendings.filter(curr => 
      !prevRemindersRef.current.some(prev => prev.id === curr.id)
    );

    if (newItems.length > 0 && autoEnabled) {
      // Notifica individualmente os primeiros 3 para não sobrecarregar a tela
      newItems.slice(0, 3).forEach(item => {
        let title = "🔔 Novo Lembrete";
        if (item.type === "aula") title = "⏰ Lembrete de Aula";
        else if (item.type === "cobranca" || item.type === "inadimplencia") title = "💰 Cobrança Pendente";

        showNotification(title, {
          body: item.message,
          tag: `reminder-${item.id}`,
          onClick: () => {
            openWhatsApp(item.studentPhone, item.message, (err) => toast.error(err));
          }
        });
      });

      if (newItems.length > 3) {
        toast.info(`${newItems.length} novos lembretes gerados no total.`);
      }
    }

    prevRemindersRef.current = currentPendings;
  }, [allReminders, autoEnabled, showNotification]);

  const generateLessons = trpc.reminders.generateLessonReminders.useMutation({
    onSuccess: (r) => {
      toast.success(`${r.created} lembrete(s) de aula gerado(s)! ${r.skipped} ignorado(s).`);
      utils.reminders.list.invalidate();
      utils.reminders.pendingCount.invalidate();
      if (r.created > 0) {
        showNotification("🔔 Novos Lembretes de Aula", {
          body: `O sistema gerou ${r.created} novos lembretes de aula. Clique para visualizar.`,
          tag: "reminders-aula"
        });
      }
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });
  
  const generatePayments = trpc.reminders.generatePaymentReminders.useMutation({
    onSuccess: (r) => {
      toast.success(`${r.created} lembrete(s) de cobrança gerado(s)! ${r.skipped} ignorado(s).`);
      utils.reminders.list.invalidate();
      utils.reminders.pendingCount.invalidate();
      if (r.created > 0) {
        showNotification("🔔 Novos Lembretes de Cobrança", {
          body: `O sistema gerou ${r.created} novos lembretes de cobrança. Clique para visualizar.`,
          tag: "reminders-cobranca"
        });
      }
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });
  
  const deleteMut = trpc.reminders.delete.useMutation({
    onSuccess: () => { toast.success("Excluído!"); utils.reminders.list.invalidate(); utils.reminders.pendingCount.invalidate(); setDeleteId(null); },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const toggleAutomation = trpc.settings.toggleAutomation.useMutation({
    onSuccess: (r) => {
      setAutoEnabled(r.enabled);
      utils.settings.getAutomation.invalidate();
      toast.success(r.enabled ? "Automação ativada! O sistema gerará lembretes automaticamente a cada hora." : "Automação desativada.");
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const testNotification = trpc.reminders.testNotification.useMutation();

  useEffect(() => {
    if (automationData !== undefined) {
      setAutoEnabled(automationData.enabled);
    }
  }, [automationData]);

  const handleGenerateAll = () => {
    if (!autoEnabled) { toast.error("Ative os lembretes automáticos primeiro"); return; }
    generateLessons.mutate();
    generatePayments.mutate();
  };

  const handleToggleAutomation = () => {
    toggleAutomation.mutate({ enabled: !autoEnabled });
  };

  // Filtragem Global
  const filtered = useMemo(() => {
    const raw = allReminders as Reminder[];
    return raw.filter(r => {
      if (filterType !== "todos" && r.type !== filterType) return false;
      if (filterStatus !== "todos" && r.status !== filterStatus) return false;
      if (filterStudent && !r.studentName?.toLowerCase().includes(filterStudent.toLowerCase())) return false;
      return true;
    });
  }, [allReminders, filterType, filterStatus, filterStudent]);

  // Agrupamento Semântico
  const groups = useMemo(() => {
    const now = new Date();
    const atrasados: Reminder[] = [];
    const aulas: Reminder[] = [];
    const pagamentos: Reminder[] = [];
    const outros: Reminder[] = [];

    filtered.forEach(r => {
      const isPast = new Date(r.scheduledAt) < now;
      if (isPast && r.status === "pendente") {
        atrasados.push(r);
        return; // Atrasados ficam apenas na coluna de atrasados para dar foco visual maior.
      }
      
      if (r.type === "aula") {
        aulas.push(r);
      } else if (r.type === "cobranca" || r.type === "inadimplencia") {
        pagamentos.push(r);
      } else {
        outros.push(r);
      }
    });

    return { atrasados, aulas, pagamentos, outros };
  }, [filtered]);

  const rawPendingCount = (allReminders as Reminder[]).filter(r => r.status === "pendente").length;
  // Atrasados de toda a base (para o summary)
  const rawDelayedCount = (allReminders as Reminder[]).filter(r => new Date(r.scheduledAt) < new Date() && r.status === "pendente").length;

  const isGenerating = generateLessons.isPending || generatePayments.isPending;
  const studentList = (students as { id: number; name: string; phone?: string | null }[]);

  const renderSection = (title: string, icon: React.ElementType, items: Reminder[], emptyMsg: string, colorClass: string) => {
    if (items.length === 0) return null;
    const Icon = icon;
    return (
      <div className="mb-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center gap-2 mb-4 px-1">
          <div className={cn("p-1.5 rounded-lg text-white", colorClass)}>
            <Icon size={16} />
          </div>
          <h3 className="text-lg font-black text-foreground uppercase tracking-wider">{title}</h3>
          <span className="ml-2 text-xs font-bold bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{items.length}</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map(r => (
            <ReminderCard key={r.id} reminder={r} onDelete={() => setDeleteId(r.id)} />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-[1200px] w-full pb-16">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-3xl font-black text-foreground tracking-tight">Lembretes</h2>
          <p className="text-sm text-muted-foreground mt-1">Gerencie e envie avisos para seus alunos de forma prática.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" className="gap-2 rounded-xl h-11 transition-all hover:bg-muted font-bold" onClick={() => setTemplatesOpen(true)}>
            <FileText size={16} className="text-primary" /> Modelos
          </Button>
          <Button variant="outline" className="gap-2 rounded-xl h-11 transition-all hover:bg-muted font-bold" onClick={() => setModalOpen(true)}>
            <Plus size={16} className="text-violet-500" /> Manual
          </Button>
          <Button className="gap-2 rounded-xl h-11 font-bold shadow-lg shadow-primary/20 transition-all hover:scale-[1.02]" onClick={handleGenerateAll} disabled={isGenerating || !autoEnabled}>
            {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            Gerar Automáticos
          </Button>
        </div>
      </div>

      {/* SUMMARY */}
      <RemindersSummary 
        total={allReminders.length} 
        pending={rawPendingCount} 
        delayed={rawDelayedCount} 
      />

      {/* PUSH BANNER */}
      {isSupported && permission === "default" && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 mb-6 shadow-sm">
          <BellRing size={20} className="text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <p className="text-sm text-amber-800 dark:text-amber-500 font-medium flex-1 leading-snug">
            Ative as notificações do navegador para ser avisado quando a automação gerar novos lembretes.
          </p>
          <Button size="sm" className="w-full sm:w-auto font-bold rounded-xl bg-amber-500 text-white hover:bg-amber-600 shadow-sm shadow-amber-500/20" onClick={async () => {
            const result = await requestPermission();
            if (result === 'granted') toast.success('Notificações ativadas com sucesso!');
            else if (result === 'denied') toast.error('Notificações bloqueadas. Habilite nas configurações do navegador.');
          }}>
            <Bell size={14} className="mr-2" /> Habilitar Alertas
          </Button>
        </div>
      )}

      {/* AUTOMATION SECTION */}
      <div className={cn(
        "flex flex-col md:flex-row items-start md:items-center justify-between p-5 rounded-2xl border transition-all duration-300 mb-6",
        autoEnabled ? "bg-gradient-to-r from-primary/10 to-transparent border-primary/20 shadow-inner" : "bg-muted/30 border-dashed"
      )}>
        <div className="flex items-start gap-4 flex-1">
          <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm", autoEnabled ? "bg-primary text-white" : "bg-muted text-muted-foreground")}>
            <Zap size={22} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-base font-bold text-foreground tracking-tight">Automação do Robô</p>
              <span className={cn(
                "text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full",
                autoEnabled ? "bg-emerald-500 text-white shadow-sm shadow-emerald-500/20" : "bg-muted-foreground/20 text-muted-foreground"
              )}>
                {autoEnabled ? "LIGADO" : "DESLIGADO"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground md:max-w-[70%] leading-relaxed">
              {autoEnabled
                ? "Lembretes de aula (24h antes) e mensalidades (3 dias antes) serão varridos e gerados automaticamente a cada hora. Sem duplicidades."
                : "Apenas lembretes manuais serão processados enquanto a automação estiver desligada."}
            </p>
            {automationData?.lastRun && autoEnabled && (
              <p className="text-[11px] font-semibold text-primary/70 mt-1.5 flex items-center gap-1">
                <RefreshCw size={11} /> Varrido por último em: {new Date(automationData.lastRun).toLocaleString("pt-BR", { day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" })}
              </p>
            )}
          </div>
        </div>
        <button onClick={handleToggleAutomation} disabled={toggleAutomation.isPending} className="mt-4 md:mt-0 transition-transform hover:scale-105 active:scale-95 disabled:opacity-50">
          {toggleAutomation.isPending
            ? <Loader2 size={36} className="animate-spin text-muted-foreground" />
            : autoEnabled
              ? <ToggleRight size={48} className="text-primary drop-shadow-md" />
              : <ToggleLeft size={48} className="text-muted-foreground" />
          }
        </button>
      </div>

      {/* NOTIFICATION PERMISSION ALERT */}
      {permission === "default" && (
        <div className="flex items-center justify-between p-4 mb-6 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-2xl animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <BellRing size={20} />
            </div>
            <div>
              <p className="text-sm font-bold text-amber-800 dark:text-amber-200">Ativar Notificações no Navegador</p>
              <p className="text-xs text-amber-700/70 dark:text-amber-300/60">Para receber alertas no computador e celular enquanto estiver com o app aberto.</p>
            </div>
          </div>
          <button 
            onClick={() => requestPermission()}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl transition-colors shadow-sm"
          >
            PERMITIR
          </button>
        </div>
      )}

      {autoEnabled && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6 w-full">
          {[
            { icon: BookOpen, color: "text-blue-500", bg: "bg-blue-500/10", border: "border-blue-500/20", title: "Aulas", desc: "Avisa no dia anterior." },
            { icon: CreditCard, color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/20", title: "Cobranças", desc: "Avisa 3 dias antes de vencer." },
            { 
              icon: BellRing, 
              color: "text-amber-500", 
              bg: "bg-amber-500/10", 
              border: "border-amber-500/20", 
              title: "Teste", 
              desc: "Testar notificação agora.",
              onClick: () => {
                toast.promise(testNotification.mutateAsync({ 
                  title: "🔔 Teste de Notificação", 
                  content: "Se você recebeu isso, as notificações no celular e computador estão funcionando!" 
                }), {
                  loading: "Enviando teste...",
                  success: "Teste enviado! Verifique seu celular/computador.",
                  error: "Falha ao enviar teste."
                });
              }
            },
          ].map((item, i) => (
            <div 
              key={i} 
              onClick={item.onClick}
              className={cn(
                "flex items-center gap-3 p-3 rounded-2xl border bg-card overflow-hidden transition-all duration-200", 
                item.bg, 
                item.border,
                item.onClick ? "cursor-pointer hover:scale-[1.02] active:scale-95 shadow-sm" : ""
              )}
            >
              <div className={cn("p-2 rounded-xl bg-background shadow-sm flex-shrink-0", item.color)}><item.icon size={16} /></div>
              <div className="min-w-0">
                <p className={cn("text-xs font-bold uppercase tracking-wider", item.color)}>{item.title}</p>
                <p className="text-xs text-foreground/70 font-medium truncate">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* FILTER (Sticks to top) */}
      <RemindersFilter {...{filterStudent, setFilterStudent, filterType, setFilterType, filterStatus, setFilterStatus}} />

      {/* LIST CONTENT */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
            <Loader2 size={32} className="animate-spin text-primary" />
          </div>
          <p className="text-sm font-bold text-muted-foreground">Buscando lembretes...</p>
        </div>
      ) : allReminders.length === 0 ? (
        <div className="bg-card rounded-3xl border border-dashed border-border p-20 flex flex-col items-center text-center max-w-2xl mx-auto shadow-sm">
          <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-4">
            <Bell size={36} className="text-muted-foreground/50" />
          </div>
          <h3 className="text-xl font-bold text-foreground">A sua caixa está vazia</h3>
          <p className="text-sm text-muted-foreground mt-2 mb-8 leading-relaxed">
            Seu sistema ainda não gerou nenhum lembrete. Ative a Automação do Robô acima para que ele gere automaticamente, ou clique abaixo para criar avulsos ou forçar a geração agora.
          </p>
          <div className="flex gap-3">
            <Button variant="outline" className="gap-2 rounded-xl h-11 font-bold" onClick={() => setModalOpen(true)}>
              <Plus size={16} className="text-violet-500" /> Manual
            </Button>
            <Button className="gap-2 rounded-xl h-11 font-bold shadow-lg shadow-primary/20" onClick={handleGenerateAll} disabled={isGenerating || !autoEnabled}>
              {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              Gerar Automáticos
            </Button>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card rounded-3xl border border-border p-16 flex flex-col items-center text-center shadow-sm max-w-2xl mx-auto">
           <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mb-4">
             <CheckCircle2 size={32} className="text-emerald-500" />
           </div>
           <h3 className="text-lg font-bold text-foreground">Nenhum lembrete na filtragem</h3>
           <p className="text-sm text-muted-foreground mt-1">Limpe os filtros na barra superior para visualizar o resto.</p>
        </div>
      ) : (
        <div className="space-y-8 mt-2">
          {renderSection("Atrasados", AlertTriangle, groups.atrasados, "Tudo em dia!", "bg-red-500 text-white shadow-lg shadow-red-500/30")}
          {renderSection("Aulas", BookOpen, groups.aulas, "Nenhuma aula pendente", "bg-blue-500 text-white shadow-lg shadow-blue-500/30")}
          {renderSection("Pagamentos", CreditCard, groups.pagamentos, "Zero cobranças", "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30")}
          {renderSection("Manuais e Outros", ListTodo, groups.outros, "", "bg-violet-500 text-white shadow-lg shadow-violet-500/30")}
        </div>
      )}

      {/* MODALS */}
      {modalOpen && (
        <ManualReminderModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          students={studentList}
          templates={templates as Template[]}
        />
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

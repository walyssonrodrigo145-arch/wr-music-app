import { useState, useEffect } from "react";
import { 
  User, 
  Clock, 
  Timer, 
  FileText, 
  CheckCircle2, 
  Loader2,
  Music,
  AlertTriangle,
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  Info,
  Beaker,
  UserPlus
} from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";

interface AgendarModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDate?: Date;
  editingLesson?: any;
}

export default function AgendarModal({ open, onOpenChange, initialDate, editingLesson }: AgendarModalProps) {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { data: students } = trpc.students.list.useQuery(undefined, { enabled: open });
  const { data: instruments } = trpc.instruments.list.useQuery(undefined, { enabled: open });
  
  const [formData, setFormData] = useState({
    studentId: "",
    title: "",
    time: "09:00",
    duration: 60,
    notes: "",
    instrumentId: "",
    weeksCount: 1,
    updateSeries: false,
    date: format(new Date(), "yyyy-MM-dd"),
    isExperimental: false,
    experimentalName: ""
  });

  const [conflictError, setConflictError] = useState<string | null>(null);
  const [step, setStep] = useState<"form" | "conflicts">("form");
  const [batchItems, setBatchItems] = useState<{ scheduledAt: string, hasConflict: boolean, conflictingWith: string | null, force: boolean }[]>([]);

  useEffect(() => {
    if (open) {
      if (editingLesson) {
        setFormData({
          studentId: editingLesson.studentId?.toString() || "",
          title: editingLesson.title || "",
          time: format(new Date(editingLesson.scheduledAt), "HH:mm"),
          date: format(new Date(editingLesson.scheduledAt), "yyyy-MM-dd"),
          duration: editingLesson.duration || 60,
          notes: editingLesson.notes || "",
          instrumentId: editingLesson.instrumentId?.toString() || "",
          weeksCount: 1,
          updateSeries: false,
          isExperimental: !!editingLesson.isExperimental,
          experimentalName: editingLesson.experimentalName || ""
        });
      } else {
        setFormData({
          studentId: "",
          title: "",
          time: initialDate ? format(initialDate, "HH:mm") : "09:00",
          date: initialDate ? format(initialDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
          duration: 60,
          notes: "",
          instrumentId: "",
          weeksCount: 1,
          updateSeries: false,
          isExperimental: false,
          experimentalName: ""
        });
      }
      setConflictError(null);
      setStep("form");
    }
  }, [open, initialDate, editingLesson]);

  const checkConflicts = trpc.lessons.checkConflicts.useQuery({
    firstDate: (() => {
      try {
        const [y, M, d] = formData.date.split("-").map(Number);
        const [h, m] = formData.time.split(":").map(Number);
        const date = new Date(y, M - 1, d, h, m, 0, 0);
        return date.toISOString();
      } catch (e) {
        return new Date().toISOString();
      }
    })(),
    duration: formData.duration,
    weeksCount: formData.weeksCount
  }, { enabled: false });

  const createBatchMutation = trpc.lessons.createBatch.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.count} aula(s) agendada(s) com sucesso!`);
      utils.lessons.listRange.invalidate();
      utils.dashboard.stats.invalidate();
      onOpenChange(false);
      resetForm();
    },
    onError: (e) => toast.error("Erro no agendamento em lote: " + e.message)
  });

  const resetForm = () => {
    setFormData({
      studentId: "",
      title: "",
      time: initialDate ? format(initialDate, "HH:mm") : "09:00",
      date: initialDate ? format(initialDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
      duration: 60,
      notes: "",
      instrumentId: "",
      weeksCount: 1,
      updateSeries: false,
      isExperimental: false,
      experimentalName: ""
    });
    setStep("form");
    setBatchItems([]);
    setConflictError(null);
  };

  const createMutation = trpc.lessons.create.useMutation({
    onSuccess: () => {
      toast.success("Aula agendada com sucesso!");
      utils.lessons.listRange.invalidate();
      utils.dashboard.stats.invalidate();
      onOpenChange(false);
      resetForm();
    },
    onError: (e) => {
      if (e.message.includes("conflito") || e.message.includes("sobrepõe")) {
        setConflictError(e.message);
      } else {
        // Mostra o erro detalhado vindo do banco (handleDbError já formata isso)
        toast.error(e.message);
      }
    }
  });

  const updateMutation = trpc.lessons.update.useMutation({
    onSuccess: () => {
      toast.success("Aula atualizada com sucesso!");
      utils.lessons.listRange.invalidate();
      utils.dashboard.stats.invalidate();
      onOpenChange(false);
      resetForm();
    },
    onError: (e) => {
      if (e.message.includes("conflito") || e.message.includes("sobrepõe")) {
        setConflictError(e.message);
      } else {
        toast.error("Erro ao atualizar: " + e.message);
      }
    }
  });

  const handleProcessSubmission = async (e: React.FormEvent) => {
    e.preventDefault();
    setConflictError(null);
    
    if (!formData.isExperimental && !formData.studentId) {
      toast.error("Por favor, selecione um aluno.");
      return;
    }

    if (formData.isExperimental && !formData.experimentalName) {
      toast.error("Por favor, informe o nome do aluno.");
      return;
    }

    // Título padrão se estiver vazio
    const student = students?.find(s => s.id.toString() === formData.studentId);
    const studentLabel = formData.isExperimental ? formData.experimentalName : student?.name;
    const instrument = instruments?.find(i => i.id.toString() === formData.instrumentId);
    const submissionTitle = formData.title || (instrument ? `Aula de ${instrument.name}` : `Aula de Música (${studentLabel})`);

    const [y, M, d] = formData.date.split("-").map(Number);
    const [hours, minutes] = formData.time.split(":").map(Number);
    const scheduledDate = new Date(y, M - 1, d, hours, minutes, 0, 0);

    if (editingLesson) {
      updateMutation.mutate({
        id: editingLesson.id,
        studentId: formData.isExperimental ? null : (formData.studentId ? Number(formData.studentId) : null),
        isExperimental: formData.isExperimental,
        experimentalName: formData.experimentalName,
        title: submissionTitle,
        duration: formData.duration,
        notes: formData.notes,
        instrumentId: formData.instrumentId ? Number(formData.instrumentId) : null,
        scheduledAt: scheduledDate.toISOString(),
        updateSeries: formData.updateSeries
      });
      return;
    }

    if (formData.weeksCount > 1 && !formData.isExperimental) {
      try {
        const conflicts = await checkConflicts.refetch();
        if (conflicts.data) {
          const hasAnyConflict = conflicts.data.some((c: any) => c.hasConflict);
          if (hasAnyConflict) {
            setBatchItems(conflicts.data.map((c: any) => ({ ...c, force: false })));
            setStep("conflicts");
          } else {
            createBatchMutation.mutate({
              studentId: Number(formData.studentId),
              title: submissionTitle,
              duration: formData.duration,
              notes: formData.notes,
              instrumentId: formData.instrumentId ? Number(formData.instrumentId) : null,
              items: conflicts.data.map((c: any) => ({ scheduledAt: c.date, force: false }))
            });
          }
        }
      } catch (err) {
        toast.error("Erro ao validar conflitos.");
      }
    } else {
      createMutation.mutate({
        studentId: formData.isExperimental ? null : (formData.studentId ? Number(formData.studentId) : null),
        isExperimental: formData.isExperimental,
        experimentalName: formData.experimentalName,
        title: submissionTitle,
        scheduledAt: scheduledDate.toISOString(),
        duration: formData.duration,
        notes: formData.notes,
        instrumentId: formData.instrumentId ? Number(formData.instrumentId) : null
      });
    }
  };

  const handleConfirmBatch = () => {
    const instrument = instruments?.find(i => i.id.toString() === formData.instrumentId);
    const submissionTitle = formData.title || (instrument ? `Aula de ${instrument.name}` : "Aula de Música");

    createBatchMutation.mutate({
      studentId: Number(formData.studentId),
      title: submissionTitle,
      duration: formData.duration,
      notes: formData.notes,
      instrumentId: formData.instrumentId ? Number(formData.instrumentId) : null,
      items: batchItems.map(item => ({
        scheduledAt: item.scheduledAt,
        force: item.force
      }))
    });
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={editingLesson ? "Editar Aula" : (formData.weeksCount > 1 ? "Agendamento Recorrente" : "Novo Agendamento")}
      description={editingLesson ? `Ajuste os detalhes da aula` : (formData.weeksCount > 1 ? "Aulas semanais automáticas para este horário." : "Agende uma nova aula para o seu aluno.")}
    >
      {step === "form" ? (
        <form onSubmit={handleProcessSubmission} className="space-y-6 pt-2 pb-10 md:pb-0">
          
          {/* Toggle Aula Experimental */}
          <div className="flex items-center gap-3 p-1">
            <button
              type="button"
              onClick={() => setFormData({ ...formData, isExperimental: false })}
              className={cn(
                "flex-1 h-12 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 border",
                !formData.isExperimental 
                  ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20" 
                  : "bg-muted/5 text-muted-foreground border-border/10 hover:bg-muted/10"
              )}
            >
              <User size={14} /> Aula Comum
            </button>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, isExperimental: true })}
              className={cn(
                "flex-1 h-12 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 border",
                formData.isExperimental 
                  ? "bg-yellow-500 text-yellow-950 border-yellow-500 shadow-lg shadow-yellow-500/20" 
                  : "bg-muted/5 text-muted-foreground border-border/10 hover:bg-muted/10"
              )}
            >
              <Beaker size={14} /> Aula Experimental
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Aluno ou Nome Experimental */}
            <div className="space-y-2">
               <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 px-2">
                 <User size={12} className={cn("text-primary/40", formData.isExperimental && "text-yellow-600/40")} /> {formData.isExperimental ? "Nome do Aluno (Experimental)" : "Aluno"}
               </label>
               {formData.isExperimental ? (
                 <input 
                   type="text"
                   placeholder="Digite o nome..."
                   value={formData.experimentalName}
                   onChange={(e) => setFormData({ ...formData, experimentalName: e.target.value })}
                   className="w-full h-14 bg-yellow-500/5 border border-yellow-500/20 rounded-2xl px-4 text-sm font-bold focus:ring-4 focus:ring-yellow-500/5 outline-none transition-all"
                 />
               ) : (
                 <select
                   value={formData.studentId}
                   onChange={(e) => setFormData({...formData, studentId: e.target.value})}
                   className="w-full h-14 bg-muted/10 border border-border/20 rounded-2xl px-4 text-sm font-bold focus:ring-4 focus:ring-primary/5 outline-none transition-all appearance-none cursor-pointer"
                 >
                   <option value="">Selecione o aluno...</option>
                   {students?.map(s => (
                     <option key={s.id} value={s.id.toString()}>{s.name}</option>
                   ))}
                 </select>
               )}
            </div>

            {/* Instrumento */}
            <div className="space-y-2">
               <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 px-2">
                 <Music size={12} className="text-primary/40" /> Instrumento
               </label>
               <select
                 value={formData.instrumentId}
                 onChange={(e) => setFormData({...formData, instrumentId: e.target.value})}
                 className="w-full h-14 bg-muted/10 border border-border/20 rounded-2xl px-4 text-sm font-bold focus:ring-4 focus:ring-primary/5 outline-none transition-all appearance-none cursor-pointer"
               >
                 <option value="">Opcional...</option>
                 {instruments?.map(inst => (
                   <option key={inst.id} value={inst.id.toString()}>{inst.name}</option>
                 ))}
               </select>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Data */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 px-2">
                <CalendarDays size={12} className="text-primary/40" /> Data
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({...formData, date: e.target.value})}
                className="w-full h-14 bg-muted/10 border border-border/20 rounded-2xl px-4 text-sm font-bold focus:ring-4 focus:ring-primary/5 outline-none transition-all"
              />
            </div>

            {/* Horário */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 px-2">
                <Clock size={12} className="text-primary/40" /> Horário
              </label>
              <input
                type="time"
                value={formData.time}
                onChange={(e) => setFormData({...formData, time: e.target.value})}
                className="w-full h-14 bg-muted/10 border border-border/20 rounded-2xl px-4 text-sm font-bold focus:ring-4 focus:ring-primary/5 outline-none transition-all"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Duração */}
            <div className="space-y-2">
               <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 px-2">
                 <Timer size={12} className="text-primary/40" /> Duração
               </label>
               <select
                 value={formData.duration}
                 onChange={(e) => setFormData({...formData, duration: Number(e.target.value)})}
                 className="w-full h-14 bg-muted/10 border border-border/20 rounded-2xl px-4 text-sm font-bold focus:ring-4 focus:ring-primary/5 outline-none transition-all appearance-none cursor-pointer"
               >
                 <option value={30}>30 min</option>
                 <option value={45}>45 min</option>
                 <option value={50}>50 min</option>
                 <option value={60}>60 min</option>
                 <option value={90}>90 min</option>
                 <option value={120}>120 min</option>
               </select>
            </div>

            {/* Recorrência ou Remarcar Tudo */}
            <div className="space-y-2">
              {!editingLesson ? (
                <>
                  <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 px-2">
                    <CalendarRange size={12} className="text-primary/40" /> Repetir por
                  </label>
                  <select
                    value={formData.weeksCount}
                    onChange={(e) => setFormData({...formData, weeksCount: Number(e.target.value)})}
                    className="w-full h-14 bg-muted/10 border border-border/20 rounded-2xl px-4 text-sm font-bold focus:ring-4 focus:ring-primary/5 outline-none transition-all appearance-none cursor-pointer"
                  >
                    <option value={1}>Apenas hoje</option>
                    {[2,4,8,12,13].map(w => (
                      <option key={w} value={w}>{w} semanas</option>
                    ))}
                  </select>
                </>
              ) : (
                editingLesson.recurringGroupId && (
                  <div className="pt-6">
                    <div 
                      onClick={() => setFormData(prev => ({ ...prev, updateSeries: !prev.updateSeries }))}
                      className={cn(
                        "flex items-center justify-between h-14 px-4 rounded-2xl border transition-all cursor-pointer",
                        formData.updateSeries ? "bg-amber-500/10 border-amber-500/30 ring-1 ring-amber-500/20" : "bg-muted/5 border-border/10"
                      )}
                    >
                      <div className="flex flex-col">
                        <span className="text-[9px] font-black uppercase tracking-tighter text-muted-foreground/60 leading-none mb-0.5">Série</span>
                        <span className={cn("text-[10px] font-bold uppercase tracking-tight", formData.updateSeries ? "text-amber-600" : "text-muted-foreground/40")}>
                          {formData.updateSeries ? "Remarcar Tudo" : "Só esta aula"}
                        </span>
                      </div>
                      <div className={cn(
                        "w-8 h-4 rounded-full p-0.5 transition-all",
                        formData.updateSeries ? "bg-amber-500" : "bg-muted-foreground/20"
                      )}>
                        <div className={cn(
                          "w-3 h-3 bg-white rounded-full shadow-sm transition-all transform",
                          formData.updateSeries ? "translate-x-4" : "translate-x-0"
                        )} />
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>
          </div>

          {/* Notas (Opcional) */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 px-2">
              <FileText size={12} className="text-primary/40" /> Notas / Observações
            </label>
            <textarea
              placeholder="Alguma observação importante..."
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              className="w-full h-24 bg-muted/10 border border-border/20 rounded-2xl px-4 py-3 text-sm font-bold focus:ring-4 focus:ring-primary/5 outline-none transition-all resize-none scrollbar-none"
            />
          </div>

          {conflictError && (
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-2xl flex items-start gap-3">
               <AlertTriangle size={18} className="text-destructive shrink-0 mt-0.5" />
               <div>
                 <h4 className="text-[10px] font-black text-destructive uppercase tracking-widest mb-0.5">Conflito</h4>
                 <p className="text-xs font-bold text-destructive/80 leading-relaxed">{conflictError}</p>
               </div>
            </div>
          )}

          {editingLesson && editingLesson.isExperimental && (
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl flex items-center justify-between gap-4">
               <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-yellow-500/20 text-yellow-600 rounded-xl flex items-center justify-center">
                    <UserPlus size={18} />
                  </div>
                  <div>
                    <h4 className="text-[10px] font-black text-yellow-700 uppercase tracking-widest leading-none mb-1">Aula Experimental</h4>
                    <p className="text-[11px] font-bold text-yellow-800/70 leading-tight">Este aluno ainda não tem cadastro completo.</p>
                  </div>
               </div>
               <button
                 type="button"
                 onClick={() => {
                   onOpenChange(false);
                   setLocation(`/alunos?create=true&name=${encodeURIComponent(formData.experimentalName)}`);
                 }}
                 className="h-10 px-4 bg-yellow-500 text-yellow-950 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-yellow-500/20 hover:scale-105 active:scale-95 transition-all"
               >
                 Conversão
               </button>
            </div>
          )}

          <button
            disabled={createMutation.isPending || checkConflicts.isFetching || updateMutation.isPending}
            type="submit"
            className="w-full h-16 bg-primary text-primary-foreground rounded-2xl font-black uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-3 shadow-xl shadow-primary/20 hover:scale-[1.01] active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {createMutation.isPending || checkConflicts.isFetching || updateMutation.isPending ? (
              <Loader2 size={24} className="animate-spin" />
            ) : (
              <>
                <CheckCircle2 size={20} strokeWidth={3} />
                <span>{editingLesson ? "Salvar Alterações" : (formData.weeksCount > 1 ? "Validar e Agendar" : "Agendar Agora")}</span>
              </>
            )}
          </button>
        </form>
      ) : (
        <div className="space-y-6 pt-2 pb-10 md:pb-0">
           <div className="max-h-[400px] overflow-y-auto scrollbar-none space-y-3 px-1">
              {batchItems.map((item, idx) => (
                <div key={item.scheduledAt} className={cn(
                   "p-4 rounded-2xl border transition-all flex items-center justify-between gap-4",
                   item.hasConflict ? "bg-destructive/5 border-destructive/20" : "bg-emerald-500/5 border-emerald-500/20"
                )}>
                   <div className="flex items-center gap-3">
                      <div className={cn(
                         "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                         item.hasConflict ? "bg-destructive/10 text-destructive" : "bg-emerald-500/10 text-emerald-500"
                      )}>
                         <CalendarRange size={18} />
                      </div>
                      <div>
                        <p className="text-xs font-black text-foreground/80">{format(new Date(item.scheduledAt), "dd/MM/yyyy")}</p>
                        <p className="text-[10px] font-bold text-muted-foreground">
                          {item.hasConflict ? `Conflito com ${item.conflictingWith}` : "Horário disponível"}
                        </p>
                      </div>
                   </div>

                   <div className="flex items-center gap-2">
                      {item.hasConflict ? (
                         <div className="flex bg-muted/20 p-1 rounded-xl">
                            <button 
                              type="button"
                              onClick={() => {
                                const newItems = [...batchItems];
                                newItems[idx].force = true;
                                setBatchItems(newItems);
                              }}
                              className={cn(
                                "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all",
                                item.force ? "bg-destructive text-white shadow-lg" : "text-muted-foreground hover:bg-muted"
                              )}
                            >
                                Marcar
                            </button>
                            <button 
                              type="button"
                              onClick={() => {
                                const newItems = [...batchItems];
                                newItems[idx].force = false;
                                setBatchItems(newItems);
                              }}
                              className={cn(
                                "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all",
                                !item.force ? "bg-muted-foreground/20 text-foreground" : "text-muted-foreground hover:bg-muted"
                              )}
                            >
                                Pular
                            </button>
                         </div>
                      ) : (
                        <div className="px-3 py-1.5 bg-emerald-500/10 text-emerald-500 rounded-lg text-[9px] font-black uppercase">
                          OK
                        </div>
                      )}
                   </div>
                </div>
              ))}
           </div>

           <div className="flex gap-3 pt-2">
              <button 
                onClick={() => setStep("form")}
                className="flex-[0.4] h-14 bg-muted/10 hover:bg-muted/20 text-muted-foreground rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
              >
                 <ChevronLeft size={16} /> Voltar
              </button>
              <button 
                onClick={handleConfirmBatch}
                disabled={createBatchMutation.isPending}
                className="flex-1 h-14 bg-primary text-primary-foreground rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                 {createBatchMutation.isPending ? <Loader2 size={18} className="animate-spin" /> : <>Finalizar Agendamentos <CheckCircle2 size={16} /></>}
              </button>
           </div>
        </div>
      )}
    </ResponsiveDialog>
  );
}

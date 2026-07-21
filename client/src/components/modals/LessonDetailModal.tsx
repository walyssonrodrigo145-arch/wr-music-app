import { 
  X, 
  Calendar, 
  Clock, 
  Timer, 
  FileText, 
  CheckCircle2, 
  XCircle,
  AlertCircle,
  CalendarDays,
  Trash2,
  User,
  Music,
  ExternalLink,
  ChevronLeft,
  Save,
  Users,
  Loader2,
  Check
} from "lucide-react";
import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface LessonDetailModalProps {
  lesson: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChange: (id: number, status: string, newDate?: string) => void;
  onDelete: (id: number) => void;
  onEdit: (id: number) => void;
}

export default function LessonDetailModal({ 
  lesson, 
  open, 
  onOpenChange, 
  onStatusChange, 
  onDelete, 
  onEdit 
}: LessonDetailModalProps) {
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");

  const isTurma = lesson?.lessonType === 'turma';
  const utils = trpc.useUtils();

  const { data: turmaDetails = [], isLoading: isLoadingTurma } = trpc.lessons.getTurmaDetails.useQuery({
    groupId: lesson?.recurringGroupId || undefined,
    scheduledAt: lesson?.scheduledAt ? new Date(lesson.scheduledAt).toISOString() : "",
    title: lesson?.title || "",
  }, {
    enabled: open && !!lesson && isTurma
  });

  const updateTurmaAttendanceMutation = trpc.lessons.updateTurmaAttendance.useMutation({
    onSuccess: () => {
      toast.success("Frequência da turma atualizada!");
      utils.lessons.list.invalidate();
      utils.lessons.getTurmaDetails.invalidate();
    },
    onError: (e) => toast.error("Erro ao atualizar chamada: " + e.message)
  });

  useEffect(() => {
    if (open && lesson) {
      const d = new Date(lesson.scheduledAt);
      setNewDate(format(d, "yyyy-MM-dd"));
      setNewTime(format(d, "HH:mm"));
      setIsRescheduling(false);
    }
  }, [open, lesson]);

  if (!lesson) return null;

  const date = new Date(lesson.scheduledAt);
  
  const statusConfig: any = {
    agendada: { icon: Clock, color: "text-blue-500", bg: "bg-blue-500/10", label: "Agendada", border: "border-blue-500/20" },
    concluida: { icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10", label: "Concluída", border: "border-emerald-500/20" },
    cancelada: { icon: XCircle, color: "text-rose-500", bg: "bg-rose-500/10", label: "Cancelada", border: "border-rose-500/20" },
    remarcada: { icon: CalendarDays, color: "text-yellow-500", bg: "bg-yellow-500/10", label: "Remarcada", border: "border-yellow-500/20" },
    falta: { icon: AlertCircle, color: "text-orange-500", bg: "bg-orange-500/10", label: "Falta", border: "border-orange-500/20" },
  };

  const config = statusConfig[lesson.status] || statusConfig.agendada;
  const StatusIcon = config.icon;

  const handleStudentAttendance = (lessonId: number, status: 'concluida' | 'falta' | 'agendada') => {
    updateTurmaAttendanceMutation.mutate({
      attendances: [{ lessonId, status }]
    });
  };

  const handleAllAttendance = (status: 'concluida' | 'falta') => {
    if (turmaDetails.length === 0) return;
    const attendances = turmaDetails.map(t => ({ lessonId: t.id, status }));
    updateTurmaAttendanceMutation.mutate({ attendances });
  };

  return (
    <ResponsiveDialog 
      open={open} 
      onOpenChange={onOpenChange}
      title={isTurma ? `Turma: ${lesson.title}` : "Detalhes da Aula"}
      description={isTurma ? `Gestão e chamada de alunos da turma` : `Visualizando aula de ${lesson.studentName || lesson.experimentalName || 'Aluno'}`}
    >
        <div className="p-0 overflow-hidden">
          <div className="p-8 pb-4 bg-gradient-to-b from-primary/5 to-transparent">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", isTurma ? "bg-purple-500/10" : config.bg)}>
                  {isTurma ? <Users size={24} className="text-purple-600" /> : <StatusIcon size={24} className={config.color} />}
                </div>
                <div>
                  <h3 className="text-2xl font-black tracking-tighter uppercase leading-none">
                    {isTurma ? lesson.title : "Detalhes da Aula"}
                  </h3>
                  <div className={cn("mt-1 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5", isTurma ? "text-purple-600" : config.color)}>
                     <div className={cn("w-1.5 h-1.5 rounded-full", isTurma ? "bg-purple-600" : config.color.replace('text-', 'bg-'))} />
                     {isTurma ? `Aula em Turma (${turmaDetails.length || (lesson.studentCount || 1)} Alunos)` : config.label}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-8 pt-4 space-y-6">
            {/* Main Info Card */}
            <div className="bg-muted/20 rounded-[2rem] p-5 border border-border/40 space-y-3">
               {!isTurma ? (
                 <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-background flex items-center justify-center text-muted-foreground/40 shrink-0">
                       <User size={20} />
                    </div>
                    <div>
                       <p className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest">Aluno</p>
                       <h4 className="font-bold text-foreground">{lesson.studentName || "Não informado"}</h4>
                    </div>
                 </div>
               ) : (
                 <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-purple-500/10 text-purple-600 flex items-center justify-center shrink-0">
                       <Users size={20} />
                    </div>
                    <div>
                       <p className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest">Turma / Modalidade</p>
                       <h4 className="font-bold text-foreground">{lesson.title}</h4>
                    </div>
                 </div>
               )}

               <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-background flex items-center justify-center text-muted-foreground/40 shrink-0">
                     <Music size={20} />
                  </div>
                  <div>
                     <p className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest">Instrumento</p>
                     <h4 className="font-bold text-foreground">{lesson.instrumentName || "Geral"}</h4>
                  </div>
               </div>
            </div>

            {/* Lista de Alunos e Chamada de Frequência se for Turma */}
            {isTurma && (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                    Chamada / Frequência dos Alunos ({turmaDetails.length})
                  </span>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => handleAllAttendance('concluida')}
                      className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 text-[9px] font-black uppercase rounded-lg transition-all"
                    >
                      Todos Vieram
                    </button>
                    <button
                      onClick={() => handleAllAttendance('falta')}
                      className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 text-[9px] font-black uppercase rounded-lg transition-all"
                    >
                      Todos Faltaram
                    </button>
                  </div>
                </div>

                <div className="bg-card rounded-2xl border border-border/60 divide-y divide-border/40 max-h-60 overflow-y-auto">
                  {isLoadingTurma ? (
                    <div className="p-6 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                      <Loader2 size={16} className="animate-spin text-primary" /> Carregando lista de alunos...
                    </div>
                  ) : turmaDetails.length === 0 ? (
                    <div className="p-4 text-center text-xs text-muted-foreground italic">Nenhum aluno registrado.</div>
                  ) : (
                    turmaDetails.map((item: any) => {
                      const itemCfg = statusConfig[item.status] || statusConfig.agendada;
                      return (
                        <div key={item.id} className="p-3 flex items-center justify-between gap-3 hover:bg-muted/10 transition-colors">
                          <div className="flex items-center gap-3 min-w-0">
                            <Avatar className="w-8 h-8 border border-border shrink-0">
                              <AvatarImage src={item.studentAvatar || undefined} />
                              <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold uppercase">
                                {item.studentName ? item.studentName.substring(0, 2) : "?"}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-foreground truncate">{item.studentName || "Aluno sem nome"}</p>
                              <span className={cn("text-[8px] font-black uppercase px-1.5 py-0.5 rounded border inline-block mt-0.5", itemCfg.bg, itemCfg.text, itemCfg.border)}>
                                {itemCfg.label}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => handleStudentAttendance(item.id, 'concluida')}
                              title="Marcar como Veio/Concluída"
                              className={cn(
                                "h-8 px-2.5 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1 transition-all",
                                item.status === 'concluida' 
                                  ? "bg-emerald-500 text-white shadow-sm" 
                                  : "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
                              )}
                            >
                              <Check size={12} /> Veio
                            </button>
                            <button
                              onClick={() => handleStudentAttendance(item.id, 'falta')}
                              title="Marcar como Falta"
                              className={cn(
                                "h-8 px-2.5 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1 transition-all",
                                item.status === 'falta' 
                                  ? "bg-amber-500 text-white shadow-sm" 
                                  : "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20"
                              )}
                            >
                              <X size={12} /> Faltou
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* Time & Duration */}
            {!isRescheduling ? (
              <div className="grid grid-cols-2 gap-4">
                 <div className="flex items-center gap-3 px-4 py-3 bg-muted/10 rounded-2xl border border-border/20">
                    <Calendar size={16} className="text-primary/40" />
                    <span className="text-xs font-bold text-foreground/70">{format(date, "dd/MM/yyyy")}</span>
                 </div>
                 <div className="flex items-center gap-3 px-4 py-3 bg-muted/10 rounded-2xl border border-border/20">
                    <Clock size={16} className="text-primary/40" />
                    <span className="text-xs font-bold text-foreground/70">{format(date, "HH:mm")}</span>
                 </div>
                 <div className="flex items-center gap-3 px-4 py-3 bg-muted/10 rounded-2xl border border-border/20 col-span-2">
                    <Timer size={16} className="text-primary/40" />
                    <span className="text-xs font-bold text-foreground/70">{lesson.duration} minutos de duração</span>
                 </div>
              </div>
            ) : (
              <div className="space-y-4 p-6 bg-primary/5 rounded-[2rem] border-2 border-primary/20 animate-in zoom-in-95 duration-200">
                 <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary px-1 mb-2">Novo Horário</h4>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                       <label className="text-[9px] font-black uppercase text-muted-foreground/50 px-1">Data</label>
                       <input 
                         type="date" 
                         value={newDate}
                         onChange={(e) => setNewDate(e.target.value)}
                         className="w-full h-12 bg-background border border-border/20 rounded-xl px-3 text-xs font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                       />
                    </div>
                    <div className="space-y-1.5">
                       <label className="text-[9px] font-black uppercase text-muted-foreground/50 px-1">Hora</label>
                       <input 
                         type="time" 
                         value={newTime}
                         onChange={(e) => setNewTime(e.target.value)}
                         className="w-full h-12 bg-background border border-border/20 rounded-xl px-3 text-xs font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                       />
                    </div>
                 </div>
              </div>
            )}

            {/* Description / Notes */}
            {(lesson.description || lesson.notes) && (
              <div className="space-y-2">
                 <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 px-1">
                   <FileText size={12} /> Observações
                 </label>
                 <div className="p-4 bg-muted/5 rounded-2xl border border-dashed border-border/40 text-sm text-foreground/60 leading-relaxed italic">
                    {lesson.description || lesson.notes}
                 </div>
              </div>
            )}

            {/* Actions Section */}
            <div className="space-y-6 pt-2 pb-10 md:pb-0">
               {!isTurma && (!isRescheduling ? (
                 <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => { onStatusChange(lesson.id, "concluida"); onOpenChange(false); }}
                      className="flex items-center justify-center gap-2 h-12 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                    >
                       <CheckCircle2 size={16} />
                       Concluída
                    </button>
                    <button 
                      onClick={() => { onStatusChange(lesson.id, "falta"); onOpenChange(false); }}
                      className="flex items-center justify-center gap-2 h-12 bg-orange-500/10 hover:bg-orange-500/20 text-orange-500 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                    >
                       <AlertCircle size={16} />
                       Falta
                    </button>
                    <button 
                      onClick={() => setIsRescheduling(true)}
                      className="flex items-center justify-center gap-2 h-12 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                    >
                       <CalendarDays size={16} />
                       Remarcar
                    </button>
                    <button 
                      onClick={() => { onStatusChange(lesson.id, "cancelada"); onOpenChange(false); }}
                      className="flex items-center justify-center gap-2 h-12 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                    >
                       <XCircle size={16} />
                       Cancelar
                    </button>
                 </div>
               ) : (
                 <div className="flex gap-3">
                    <button 
                      onClick={() => setIsRescheduling(false)}
                      className="h-14 px-6 bg-muted/10 hover:bg-muted/20 text-muted-foreground rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                    >
                       <ChevronLeft size={16} /> Voltar
                    </button>
                    <button 
                      onClick={() => {
                        const fullDate = new Date(`${newDate}T${newTime}:00`);
                        onOpenChange(false);
                        setTimeout(() => {
                          onStatusChange(lesson.id, "remarcada", fullDate.toISOString());
                        }, 150);
                      }}
                      className="flex-1 h-14 bg-primary text-primary-foreground rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                    >
                       <Save size={16} /> Confirmar Novo Horário
                    </button>
                  </div>
               ))}

               <div className="flex gap-2">
                  <button 
                    onClick={() => { onEdit(lesson.id); onOpenChange(false); }}
                    className="flex-1 flex items-center justify-center gap-2 h-14 bg-primary text-primary-foreground rounded-2xl text-xs font-black uppercase tracking-tighter shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                  >
                     <ExternalLink size={16} />
                     Editar Aula / Turma
                  </button>
                  <button 
                    onClick={() => onDelete(lesson.id)}
                    className="w-14 h-14 flex items-center justify-center bg-muted/20 hover:bg-rose-500/10 text-muted-foreground/30 hover:text-rose-500 rounded-2xl transition-all"
                  >
                     <Trash2 size={20} />
                  </button>
               </div>
            </div>
          </div>
        </div>
    </ResponsiveDialog>
  );
}

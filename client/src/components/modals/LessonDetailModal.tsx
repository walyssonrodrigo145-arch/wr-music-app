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
  Check,
  LayoutList
} from "lucide-react";
import { useState, useEffect } from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LESSON_STATUS_CONFIG, type LessonStatus } from "@/lib/status";

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
  const [localStatuses, setLocalStatuses] = useState<Record<number, string>>({});

  const { data: turmaDetails = [], isLoading: isLoadingTurma } = trpc.lessons.getTurmaDetails.useQuery({
    groupId: lesson?.recurringGroupId || undefined,
    scheduledAt: lesson?.scheduledAt ? new Date(lesson.scheduledAt).toISOString() : "",
    title: lesson?.title || "",
  }, {
    enabled: open && !!lesson && isTurma
  });

  useEffect(() => {
    if (turmaDetails && turmaDetails.length > 0) {
      const initial: Record<number, string> = {};
      turmaDetails.forEach((item: any) => {
        initial[item.id] = item.status || 'agendada';
      });
      setLocalStatuses(initial);
    }
  }, [turmaDetails]);

  const updateTurmaAttendanceMutation = trpc.lessons.updateTurmaAttendance.useMutation({
    onSuccess: () => {
      toast.success("Frequência da turma atualizada!");
      utils.lessons.list.invalidate();
      utils.lessons.getTurmaDetails.invalidate();
    },
    onError: (e) => {
      toast.error("Erro ao atualizar chamada: " + e.message);
      utils.lessons.getTurmaDetails.invalidate();
    }
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
  
  const config = LESSON_STATUS_CONFIG[(lesson.status as LessonStatus) || "agendada"] || LESSON_STATUS_CONFIG.agendada;
  const StatusIcon = config.icon;

  const handleStudentAttendance = (lessonId: number, status: 'concluida' | 'falta' | 'agendada') => {
    setLocalStatuses(prev => ({ ...prev, [lessonId]: status }));
    updateTurmaAttendanceMutation.mutate({
      attendances: [{ lessonId, status }]
    });
  };

  const handleAllAttendance = (status: 'concluida' | 'falta') => {
    if (turmaDetails.length === 0) return;
    const newStatuses: Record<number, string> = {};
    const attendances = turmaDetails.map(t => {
      newStatuses[t.id] = status;
      return { lessonId: t.id, status };
    });
    setLocalStatuses(newStatuses);
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
                 <div className="flex items-center justify-between flex-wrap gap-4">
                   <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-background flex items-center justify-center text-muted-foreground/40 shrink-0">
                         <User size={20} />
                      </div>
                      <div>
                         <p className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest">Aluno</p>
                         <h4 className="font-bold text-foreground">{lesson.studentName || lesson.experimentalName || "Não informado"}</h4>
                      </div>
                   </div>
                   {lesson.teacherName && (
                     <div className="flex items-center gap-3 bg-blue-500/5 px-4 py-2 rounded-2xl border border-blue-500/10">
                       <User size={16} className="text-blue-600" />
                       <div>
                         <p className="text-[9px] font-bold text-muted-foreground uppercase">Professor Responsável</p>
                         <p className="text-xs font-black text-blue-600">Prof. {lesson.teacherName}</p>
                       </div>
                     </div>
                   )}
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
               
               {lesson.studioRoomName && (
                 <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-background flex items-center justify-center text-muted-foreground/40 shrink-0">
                       <LayoutList size={20} className="text-indigo-500" />
                    </div>
                    <div>
                       <p className="text-[10px] font-bold text-indigo-500/60 uppercase tracking-widest">Sala Reservada</p>
                       <h4 className="font-bold text-foreground">{lesson.studioRoomName}</h4>
                    </div>
                 </div>
               )}
            </div>

            {/* Lista de Alunos e Chamada de Frequência se for Turma */}
            {isTurma && (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                    Chamada / Frequência dos Alunos ({turmaDetails.length})
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleAllAttendance('concluida')}
                      className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 text-[9px] font-black uppercase rounded-lg transition-all active:scale-95 cursor-pointer"
                    >
                      Todos Vieram
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAllAttendance('falta')}
                      className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 text-[9px] font-black uppercase rounded-lg transition-all active:scale-95 cursor-pointer"
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
                      const currentStatus = localStatuses[item.id] || item.status || 'agendada';
                      const itemCfg = LESSON_STATUS_CONFIG[(currentStatus as LessonStatus) || "agendada"] || LESSON_STATUS_CONFIG.agendada;
                      const isConcluido = currentStatus === 'concluida';
                      const isFalta = currentStatus === 'falta';

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
                              <span className={cn("text-[8px] font-black uppercase px-1.5 py-0.5 rounded border inline-block mt-0.5", itemCfg.bg, itemCfg.color, itemCfg.border)}>
                                {itemCfg.label}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleStudentAttendance(item.id, isConcluido ? 'agendada' : 'concluida')}
                              title={isConcluido ? "Clique para desmarcar (voltar a agendada)" : "Marcar como Presente/Veio"}
                              className={cn(
                                "h-8 px-2.5 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1 transition-all active:scale-95 cursor-pointer",
                                isConcluido 
                                  ? "bg-emerald-500 text-white shadow-sm ring-2 ring-emerald-500/30 font-extrabold" 
                                  : "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
                              )}
                            >
                              <Check size={12} /> Veio
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStudentAttendance(item.id, isFalta ? 'agendada' : 'falta')}
                              title={isFalta ? "Clique para desmarcar (voltar a agendada)" : "Marcar como Falta"}
                              className={cn(
                                "h-8 px-2.5 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1 transition-all active:scale-95 cursor-pointer",
                                isFalta 
                                  ? "bg-rose-500 text-white shadow-sm ring-2 ring-rose-500/30 font-extrabold" 
                                  : "bg-rose-500/10 text-rose-600 hover:bg-rose-500/20"
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
            {/* Time & Duration */}
            {!isRescheduling ? (
              <div className="grid grid-cols-2 gap-4">
                 <button 
                   type="button"
                   onClick={() => setIsRescheduling(true)}
                   className="flex items-center gap-3 px-4 py-3 bg-muted/10 hover:bg-primary/5 hover:border-primary/30 rounded-2xl border border-border/20 transition-all text-left cursor-pointer group"
                   title="Clique para alterar a data ou horário"
                 >
                    <Calendar size={16} className="text-primary/40 group-hover:text-primary transition-colors" />
                    <span className="text-xs font-bold text-foreground/70 group-hover:text-foreground">{format(date, "dd/MM/yyyy")}</span>
                 </button>
                 <button 
                   type="button"
                   onClick={() => setIsRescheduling(true)}
                   className="flex items-center gap-3 px-4 py-3 bg-muted/10 hover:bg-primary/5 hover:border-primary/30 rounded-2xl border border-border/20 transition-all text-left cursor-pointer group"
                   title="Clique para alterar a data ou horário"
                 >
                    <Clock size={16} className="text-primary/40 group-hover:text-primary transition-colors" />
                    <span className="text-xs font-bold text-foreground/70 group-hover:text-foreground">{format(date, "HH:mm")}</span>
                 </button>
                 <div className="flex items-center gap-3 px-4 py-3 bg-muted/10 rounded-2xl border border-border/20 col-span-2">
                    <Timer size={16} className="text-primary/40" />
                    <span className="text-xs font-bold text-foreground/70">{lesson.duration} minutos de duração</span>
                 </div>
              </div>
            ) : (
              <div className="space-y-4 p-5 bg-primary/5 rounded-[2rem] border-2 border-primary/20 animate-in zoom-in-95 duration-200">
                 <div className="flex items-center justify-between px-1">
                   <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Alterar Data / Horário</h4>
                   <span className="text-[9px] font-bold text-muted-foreground">{newTime || "00:00"}</span>
                 </div>
                 <div className="grid grid-cols-2 gap-3">
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
                 {/* Chips rápidos de horários */}
                 <div className="space-y-1 pt-1">
                   <p className="text-[9px] font-bold text-muted-foreground/70 px-1">Horários rápidos:</p>
                   <div className="flex flex-wrap gap-1">
                     {["08:00", "09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00"].map((t) => (
                       <button
                         key={t}
                         type="button"
                         onClick={() => setNewTime(t)}
                         className={cn(
                           "px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer",
                           newTime === t
                             ? "bg-primary text-white border-primary shadow-sm"
                             : "bg-background text-muted-foreground hover:bg-muted/60 border-border/40"
                         )}
                       >
                         {t}
                       </button>
                     ))}
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

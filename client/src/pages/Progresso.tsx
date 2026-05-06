import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Search,
  Star,
  BookOpen,
  Calendar,
  Clock,
  Plus,
  Activity,
  Edit2,
  Trash2,
  ChevronRight,
  Filter,
  TrendingUp,
  Loader2,
  Smile,
  Frown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

export default function Progresso() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);

  const utils = trpc.useUtils();

  const { data: students = [], isLoading: studentsLoading } = trpc.students.list.useQuery();
  const { data: timeline = [], isLoading: timelineLoading } = trpc.progress.getTimeline.useQuery(
    { studentId: selectedStudentId! },
    { enabled: !!selectedStudentId }
  );
  const { data: summary, isLoading: summaryLoading } = trpc.progress.getSummary.useQuery(
    { studentId: selectedStudentId! },
    { enabled: !!selectedStudentId }
  );

  const createEventMutation = trpc.progress.createTimelineEvent.useMutation({
    onSuccess: () => {
      toast.success("Registro adicionado!");
      utils.progress.getTimeline.invalidate({ studentId: selectedStudentId! });
      utils.progress.getSummary.invalidate({ studentId: selectedStudentId! });
      setIsModalOpen(false);
      resetForm();
    },
  });

  const updateEventMutation = trpc.progress.updateTimelineEvent.useMutation({
    onSuccess: () => {
      toast.success("Registro atualizado!");
      utils.progress.getTimeline.invalidate({ studentId: selectedStudentId! });
      utils.progress.getSummary.invalidate({ studentId: selectedStudentId! });
      setIsModalOpen(false);
      resetForm();
    },
  });

  const deleteEventMutation = trpc.progress.deleteTimelineEvent.useMutation({
    onSuccess: () => {
      toast.success("Registro excluído!");
      utils.progress.getTimeline.invalidate({ studentId: selectedStudentId! });
      utils.progress.getSummary.invalidate({ studentId: selectedStudentId! });
    },
  });

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "geral" as any,
    grade: "",
    achievedAt: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
  });

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      category: "geral",
      grade: "",
      achievedAt: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    });
    setEditingEvent(null);
  };

  const filteredStudents = useMemo(() => {
    return students
      .filter((s) => s.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [students, searchQuery]);

  const selectedStudent = useMemo(() => {
    return students.find((s) => s.id === selectedStudentId);
  }, [students, selectedStudentId]);

  const handleEdit = (event: any) => {
    setEditingEvent(event);
    setFormData({
      title: event.title,
      description: event.description || "",
      category: event.category,
      grade: event.grade || "",
      achievedAt: format(new Date(event.achievedAt), "yyyy-MM-dd'T'HH:mm"),
    });
    setIsModalOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.title) return toast.error("Título é obrigatório");
    
    if (editingEvent) {
      updateEventMutation.mutate({
        id: editingEvent.id,
        ...formData,
      });
    } else {
      createEventMutation.mutate({
        studentId: selectedStudentId!,
        ...formData,
      });
    }
  };

  const getStatusColor = (grade: number) => {
    if (grade >= 8) return "text-emerald-600 bg-emerald-50 border-emerald-100";
    if (grade >= 6) return "text-blue-600 bg-blue-50 border-blue-100";
    return "text-amber-600 bg-amber-50 border-amber-100";
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "tecnica": return "bg-indigo-50 text-indigo-600 border-indigo-100";
      case "teoria": return "bg-amber-50 text-amber-600 border-amber-100";
      case "repertorio": return "bg-emerald-50 text-emerald-600 border-emerald-100";
      default: return "bg-slate-50 text-slate-600 border-slate-100";
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-6rem)] lg:h-[calc(100vh-4rem)] gap-0 lg:gap-8 overflow-hidden -m-4 sm:-m-6">
      {/* Sidebar de Alunos (Linear Style) */}
      <div className={cn(
        "w-full lg:w-72 flex flex-col bg-background border-r border-border/50 transition-all",
        selectedStudentId && "hidden lg:flex"
      )}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground/60">Alunos</h3>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/40" size={14} />
            <Input
              placeholder="Buscar..."
              className="pl-9 h-9 text-sm rounded-lg border-border/40 bg-muted/20 focus:bg-background transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-6 space-y-0.5 scrollbar-thin">
          {studentsLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="animate-spin text-muted-foreground/20" /></div>
          ) : filteredStudents.length === 0 ? (
            <p className="text-xs text-muted-foreground/60 text-center p-8 italic">Nenhum aluno</p>
          ) : (
            filteredStudents.map((student) => (
              <button
                key={student.id}
                onClick={() => setSelectedStudentId(student.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group",
                  selectedStudentId === student.id
                    ? "bg-primary/5 text-primary"
                    : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                )}
              >
                <div className={cn(
                  "w-1.5 h-1.5 rounded-full transition-all",
                  selectedStudentId === student.id ? "bg-primary scale-100" : "bg-transparent scale-0 group-hover:scale-100 group-hover:bg-muted-foreground/30"
                )} />
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-medium truncate">{student.name}</p>
                </div>
                <ChevronRight size={12} className={cn(
                  "transition-all",
                  selectedStudentId === student.id ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2 group-hover:opacity-40 group-hover:translate-x-0"
                )} />
              </button>
            ))
          )}
        </div>
      </div>

      {/* Conteúdo Principal (Modern Dashboard) */}
      <div className={cn(
        "flex-1 flex flex-col min-w-0 bg-muted/5 overflow-hidden",
        !selectedStudentId && "hidden lg:flex"
      )}>
        {!selectedStudentId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
            <div className="w-16 h-16 rounded-2xl bg-muted/20 flex items-center justify-center mb-4">
              <Activity size={24} className="text-muted-foreground/40" />
            </div>
            <h2 className="text-lg font-semibold text-foreground/80">Selecione um aluno</h2>
            <p className="text-sm text-muted-foreground/60 max-w-[240px] mt-1">
              Escolha um aluno na lista ao lado para visualizar o progresso detalhado.
            </p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedStudentId}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex-1 flex flex-col overflow-hidden"
            >
              {/* NÍVEL 1: HEADER COMPACTO */}
              <div className="bg-background border-b border-border/40 px-6 py-4 flex flex-col sm:flex-row items-center gap-4 sm:gap-8 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden shrink-0"
                  onClick={() => setSelectedStudentId(null)}
                >
                  <ChevronRight size={18} className="rotate-180" />
                </Button>

                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <Avatar className="w-10 h-10 border border-border/40">
                    <AvatarFallback className="bg-primary/5 text-primary text-sm font-bold">
                      {selectedStudent?.name.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <h2 className="text-lg font-bold text-foreground truncate leading-none">{selectedStudent?.name}</h2>
                      <span className="px-2 py-0.5 rounded-md bg-muted text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                        {selectedStudent?.level}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-2">
                      <div className="w-32 h-1.5 bg-muted rounded-full overflow-hidden shrink-0">
                        <div 
                          className="h-full bg-primary transition-all duration-700" 
                          style={{ width: `${summary?.frequency || 0}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground font-medium truncate">
                        Última aula: {summary?.lastLesson ? format(new Date(summary.lastLesson), "dd/MM", { locale: ptBR }) : "N/A"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="hidden xl:flex items-center gap-3 max-w-[300px] bg-amber-50/50 border border-amber-100 px-3 py-2 rounded-lg">
                  <div className="shrink-0 w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center">
                    {summary && summary.averageGrade >= 7 ? <Smile size={14} className="text-amber-600" /> : <Frown size={14} className="text-amber-600" />}
                  </div>
                  <p className="text-[11px] text-amber-900/70 font-medium leading-tight">
                    {summaryLoading ? "Analisando..." : (
                      summary && summary.averageGrade >= 8 ? "Evolução excelente! Mantenha o ritmo." :
                      summary && summary.averageGrade >= 6 ? "Progresso constante. Foco na técnica." :
                      "Atenção aos fundamentos básicos."
                    )}
                  </p>
                </div>
              </div>

              {/* NÍVEL 2: CARDS DE MÉTRICAS */}
              <div className="px-6 py-6 overflow-x-auto scrollbar-none shrink-0">
                <div className="flex items-center gap-4 min-w-max lg:min-w-0 lg:grid lg:grid-cols-4">
                  {[
                    { label: "Média de notas", value: summary?.averageGrade || "0.0", icon: Star, color: "text-amber-500" },
                    { label: "Aulas registradas", value: summary?.completedCount || 0, icon: BookOpen, color: "text-blue-500" },
                    { label: "Frequência", value: `${summary?.frequency || 0}%`, icon: Calendar, color: "text-emerald-500" },
                    { label: "Evolução", value: "Ativo", icon: TrendingUp, color: "text-indigo-500" },
                  ].map((stat, i) => (
                    <div key={i} className="bg-background rounded-xl border border-border/40 p-4 flex items-center gap-4 w-56 lg:w-full shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
                      <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center bg-muted/30", stat.color)}>
                        <stat.icon size={16} />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 leading-none mb-1.5">{stat.label}</p>
                        <p className="text-lg font-bold text-foreground leading-none">{stat.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* NÍVEL 3: TIMELINE (FOCO PRINCIPAL) */}
              <div className="flex-1 px-6 pb-6 overflow-hidden flex flex-col">
                <div className="flex items-center justify-between mb-6 shrink-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-foreground">Atividade Recente</h3>
                    <div className="h-4 w-px bg-border/60 mx-2" />
                    <button className="text-[11px] font-medium text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors">
                      <Filter size={12} />
                      Filtrar
                    </button>
                  </div>
                  
                  <Button 
                    onClick={() => { resetForm(); setIsModalOpen(true); }}
                    className="h-8 rounded-lg px-3 bg-primary hover:bg-primary/90 text-white text-[11px] font-bold gap-1.5 shadow-sm transition-all active:scale-95"
                  >
                    <Plus size={14} />
                    Novo registro
                  </Button>
                </div>

                <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin space-y-4">
                  {timelineLoading ? (
                    <div className="flex justify-center p-12"><Loader2 className="animate-spin text-muted-foreground/20" /></div>
                  ) : timeline.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/40 border-2 border-dashed border-border/40 rounded-2xl">
                      <p className="text-xs font-medium italic">Nenhuma atividade registrada.</p>
                    </div>
                  ) : (
                    <div className="relative pl-4 border-l border-border/60 ml-2 space-y-8 pb-8">
                      {timeline.map((event) => (
                        <div key={event.id} className="relative">
                          {/* Dot */}
                          <div className={cn(
                            "absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-background ring-4 ring-background shadow-sm",
                            event.category === 'tecnica' ? 'bg-indigo-500' :
                            event.category === 'teoria' ? 'bg-amber-500' :
                            event.category === 'repertorio' ? 'bg-emerald-500' :
                            'bg-slate-400'
                          )} />
                          
                          <div className="group bg-background hover:border-primary/20 p-4 rounded-xl border border-border/40 transition-all duration-200 shadow-[0_1px_2px_rgba(0,0,0,0.03)] hover:shadow-md">
                            <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-3 mb-2">
                                  <span className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest">
                                    {format(new Date(event.achievedAt), "dd MMM yyyy", { locale: ptBR })}
                                  </span>
                                  <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border", getCategoryColor(event.category))}>
                                    {event.category}
                                  </span>
                                </div>
                                <h4 className="text-sm font-bold text-foreground mb-1">{event.title}</h4>
                                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{event.description}</p>
                              </div>
                              
                              <div className="flex items-center gap-6 shrink-0 self-end sm:self-center">
                                {event.grade && (
                                  <div className={cn("flex items-center gap-1 px-2 py-1 rounded-lg border font-bold text-xs", getStatusColor(Number(event.grade)))}>
                                    <Star size={12} className="fill-current" />
                                    {Number(event.grade).toFixed(1)}
                                  </div>
                                )}
                                
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => handleEdit(event)}>
                                    <Edit2 size={12} />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteEventMutation.mutate({ id: event.id })}>
                                    <Trash2 size={12} />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {/* Modal: Novo/Editar Registro (Clean Style) */}
      <Dialog open={isModalOpen} onOpenChange={(open) => {
        setIsModalOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="sm:max-w-[440px] p-0 gap-0 border-none shadow-2xl rounded-2xl overflow-hidden">
          <div className="px-6 py-6 border-b border-border/40">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-foreground">
                {editingEvent ? "Editar registro" : "Novo registro"}
              </DialogTitle>
              <p className="text-[11px] text-muted-foreground mt-1">
                Adicione detalhes sobre a evolução musical hoje.
              </p>
            </DialogHeader>
          </div>
          
          <div className="px-6 py-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 ml-0.5">Data</label>
                <Input
                  type="datetime-local"
                  className="rounded-lg h-9 text-xs border-border/40 bg-muted/10"
                  value={formData.achievedAt}
                  onChange={(e) => setFormData({ ...formData, achievedAt: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 ml-0.5">Categoria</label>
                <Select
                  value={formData.category}
                  onValueChange={(val) => setFormData({ ...formData, category: val as any })}
                >
                  <SelectTrigger className="rounded-lg h-9 text-xs border-border/40 bg-muted/10">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="tecnica">Técnica</SelectItem>
                    <SelectItem value="teoria">Teoria</SelectItem>
                    <SelectItem value="repertorio">Repertório</SelectItem>
                    <SelectItem value="geral">Geral</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 ml-0.5">Título</label>
              <Input
                placeholder="Ex: Escala de Sol Maior"
                className="rounded-lg h-9 text-xs border-border/40 bg-muted/10"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 ml-0.5">Descrição (opcional)</label>
              <Textarea
                placeholder="Como foi o desempenho?"
                className="rounded-lg text-xs border-border/40 bg-muted/10 min-h-[80px] resize-none"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 ml-0.5">Nota</label>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  max="10"
                  className="rounded-lg h-9 text-xs border-border/40 bg-muted/10 w-20"
                  value={formData.grade}
                  onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                />
                <div className="flex gap-1.5">
                  {[6, 7, 8, 9, 10].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setFormData({ ...formData, grade: n.toString() })}
                      className={cn(
                        "w-7 h-7 rounded-md text-[10px] font-bold border border-border/40 transition-all",
                        formData.grade === n.toString() ? "bg-primary text-white border-primary" : "bg-muted/10 hover:bg-muted/30"
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="px-6 py-4 bg-muted/20 flex gap-2">
            <Button
              variant="ghost"
              onClick={() => setIsModalOpen(false)}
              className="h-9 px-4 text-xs font-bold"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createEventMutation.isPending || updateEventMutation.isPending}
              className="h-9 px-6 bg-primary text-white text-xs font-bold shadow-sm"
            >
              {createEventMutation.isPending || updateEventMutation.isPending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                editingEvent ? "Salvar alterações" : "Salvar registro"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
